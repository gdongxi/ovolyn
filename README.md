<p align="center">
  <img src="demo_assets/brand/ovolyn-lockup-horizontal.svg" alt="OVOLYN" width="320" />
</p>

# OVOLYN — The Autonomous Bank for AI Agents

**Agent operators deposit USDC. Idle balances earn treasury yield. Humans set the policy. Agents spend autonomously within it.**

Built on [Arc](https://docs.arc.io) (Circle's stablecoin-native L1, USDC as gas) for the [Programmable Money Hackathon](https://www.encodeclub.com/programmes/arc-hackathon). Tracks: **Agentic Economy** (primary) + **DeFi** (yield treasury layer).

## Why

AI agents are becoming economic actors — they buy API calls, pay for inference, settle jobs. Marketplaces for agent services already exist. What doesn't exist is the layer every one of those agents needs: **an account where their money lives**. Today an agent's funds sit idle in a raw wallet — earning nothing, guarded by nothing but a private key.

Ovolyn is that missing layer:

- **Deposit** — fund an agent account with USDC from any chain (CCTP v2 / Bridge Kit)
- **Earn** — idle balances above a threshold sweep into tokenized treasury yield (USYC)
- **Govern** — the human CFO sets spending policy: per-tx limits, allowlists, budgets; out-of-bounds spends are blocked on-chain
- **Spend** — the agent autonomously pays for services via x402 nanopayments and rebalances currencies via Swap (Arc Testnet exclusive)

We monetize the balance sheet, not the payments — payments are why the balance exists.

## Architecture

```
any chain ──CCTP──▶ Ovolyn Account (Arc Testnet)
                      ├─ idle balance ──sweep──▶ USYC yield
                      ├─ policy engine (limits / allowlists / budgets)
                      └─ agent spend ──x402 nanopayments──▶ services
                                     └─ Swap ──▶ USDC / EURC rebalancing
```

## Circle / Arc stack used

| Layer | How it is integrated |
|---|---|
| Chain | Arc Testnet (chain 5042002), USDC-native gas |
| Cross-chain deposits | CCTP V2 contracts called directly (`TokenMessengerV2.depositForBurn` on Sepolia → Circle attestation → `MessageTransmitterV2.receiveMessage` on Arc) via `@circle-fin/developer-controlled-wallets` |
| Agent wallets & spending | Circle Agent Stack — agent wallet + `@circle-fin/cli` for Gateway funding and x402 payment |
| Micropayments | Nanopayments / x402 — `@circle-fin/x402-batching` (seller middleware) |
| FX / rebalancing | Circle App Kit — `@circle-fin/app-kit` + `@circle-fin/adapter-circle-wallets` (Swap is Arc-Testnet-exclusive among testnets) |
| Yield | USYC via the issuer's Teller contract (allowlisted treasury wallet) |

## Status

Hackathon build in progress — final MVP due 2026-08-09.

- [x] Agent wallet provisioned on Arc Testnet via Circle Agent Stack
- [x] Circle Gateway funded (direct on-chain deposit, sub-second finality)
- [x] First x402 nanopayment completed on Arc Testnet — $0.001 USDC, 402 → 200, settled via Gateway ([`services/demo-stall/`](services/demo-stall/server.ts))
- [x] CFO console with live balances, editable spending policy, agent spend actions
- [x] Policy enforcement verified on-chain: in-bounds $0.001 settled, out-of-bounds $0.05 **blocked** by per-tx limit
- [x] USYC idle sweep live: agent wallet → treasury → Teller.deposit, 3 USDC → 2.650424 USYC minted on Arc Testnet
- [x] CCTP V2 cross-chain deposit live: Sepolia burn → fast attestation → mint to the agent wallet on Arc
- [x] USDC/EURC treasury rebalancing via Swap — the only testnet where this exists (2 USDC → 1.538147 EURC, live)
- [ ] 3-minute demo video + final deck

**All four verbs — deposit, earn, govern, spend — plus FX rebalancing are live and demoable from one console.**

## Team

Solo build.
