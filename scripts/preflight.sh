#!/usr/bin/env bash
# Everything that has to be true before the camera rolls, checked by function
# rather than by status text — `circle wallet status` has said "Not logged in"
# about a session that works.
#
#   bash scripts/preflight.sh
#
# Any ✗ means stop and fix it. A run costs 3 USDC and a bad take costs a retake.

set -uo pipefail
HOST=root@150.109.254.190
IP=150.109.254.190
SITE=https://ovolyn.xyz
AGENT_WALLET=0xec831132b305310837f921ec7656b55356a36c98
SEPOLIA_SRC=e9e16a83ea80beeddae4afbca8560bfee09ff91f
SEPOLIA_USDC=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

fail=0
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
bad()  { printf "  \033[31m✗\033[0m %s\n" "$1"; fail=$((fail+1)); }
note() { printf "    %s\n" "$1"; }

echo "── containers ──"
ps=$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" 'cd ~/ovolyn && docker compose ps --format "{{.Service}} {{.State}}"' 2>/dev/null)
for s in app stalls caddy; do
  echo "$ps" | grep -q "^$s running" && ok "$s running" || bad "$s NOT running"
done

echo "── pages ──"
for p in / /bank /market /ledger /agents; do
  c=$(curl -s -o /dev/null -m 25 --resolve ovolyn.xyz:443:$IP -w '%{http_code}' "$SITE$p")
  [ "$c" = "200" ] && ok "$p" || bad "$p returned $c"
done

echo "── stalls quoting ──"
for s in gas-oracle usyc-nav treasury-signal deep-analysis; do
  c=$(curl -s -o /dev/null -m 20 --resolve ovolyn.xyz:443:$IP -w '%{http_code}' "$SITE/stall/$s")
  [ "$c" = "402" ] && ok "$s → 402" || bad "$s → $c (expected 402)"
done

echo "── circle cli session (the one that fails silently) ──"
est=$(ssh -o BatchMode=yes -o ConnectTimeout=20 "$HOST" \
  "cd ~/ovolyn && timeout 150 docker compose exec -T app npx circle services pay \
   $SITE/stall/gas-oracle --address $AGENT_WALLET --chain ARC-TESTNET --estimate --testnet" 2>&1 | tail -3)
if echo "$est" | grep -qi "payment required"; then ok "session works — $(echo "$est" | grep -i 'payment required')"
else bad "estimate failed — the spend stages will fail on camera"; note "$est"; fi

echo "── funds ──"
bank=$(curl -s -m 25 --resolve ovolyn.xyz:443:$IP "$SITE/bank")
wallet=$(printf '%s' "$bank" | sed -n 's/.*SPENDING WALLET[^0-9]*\([0-9.]\+\).*/\1/p' | head -1)
[ -z "$wallet" ] && wallet=$(printf '%s' "$bank" | grep -o 'class="value">[0-9.]*' | head -1 | cut -d'>' -f2)
if [ -n "$wallet" ]; then
  awk -v w="$wallet" 'BEGIN{exit !(w+0 >= 10)}' \
    && ok "spending wallet $wallet USDC (≥10, Earn will trigger)" \
    || bad "spending wallet $wallet USDC — below 10, the Earn stage will skip"
else bad "could not read the wallet balance from /bank"; fi

src=$(curl -s -m 20 -X POST https://ethereum-sepolia-rpc.publicnode.com -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$SEPOLIA_USDC\",\"data\":\"0x70a08231000000000000000000000000$SEPOLIA_SRC\"},\"latest\"]}" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('%.2f'%(int(d['result'],16)/1e6))" 2>/dev/null)
if [ -n "$src" ]; then
  awk -v s="$src" 'BEGIN{exit !(s+0 >= 3)}' \
    && ok "sepolia source $src USDC ($(awk -v s="$src" 'BEGIN{printf "%d", s/3}') run(s) left, 3 per run)" \
    || bad "sepolia source $src USDC — a run needs 3; top up at faucet.circle.com"
else bad "could not read the sepolia source balance"; fi

echo
if [ "$fail" -eq 0 ]; then
  printf "\033[32mall clear — sign in first, then roll\033[0m\n"
  echo "  the buttons answer 401 to a signed-out browser, and that is the take wasted"
else
  printf "\033[31m%d check(s) failed — do not start\033[0m\n" "$fail"
fi
exit "$fail"
