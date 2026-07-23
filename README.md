<p align="center">
  <img src="demo_assets/logo_ovolyn.svg" alt="OVOLYN" width="360" />
</p>

# OVOLYN — The Autonomous Bank for AI Agents

**Agent operators deposit USDC. Idle balances earn treasury yield. Humans set the policy. Agents spend autonomously within it.**

Built on [Arc](https://docs.arc.io) (Circle's stablecoin-native L1, USDC as gas) for the [Programmable Money Hackathon](https://www.encodeclub.com/programmes/arc-hackathon). Tracks: **Agentic Economy** (primary) + **DeFi** (yield treasury layer).

## Why

AI agents are becoming economic actors — they buy API calls, pay for inference, settle jobs. Marketplaces for agent services already exist. What doesn't exist is the layer every one of those agents needs: **an account where their money lives**. Today an agent's funds sit idle in a raw wallet — earning nothing, guarded by nothing but a private key.

Ovolyn is that missing layer:

- **Deposit** — fund an agent account with USDC from any chain (CCTP v2 / Bridge Kit)
- **Earn** — idle balances auto-sweep into tokenized treasury yield (USYC)
- **Govern** — the human CFO sets spending policy: per-tx limits, allowlists, budgets; out-of-bounds spends are blocked on-chain
- **Spend** — the agent autonomously pays for services via x402 nanopayments and rebalances currencies via Swap (Arc Testnet exclusive)

We monetize the balance sheet, not the payments — payments are why the balance exists.

## Architecture

```
any chain ──CCTP──▶ Ovolyn Account (Arc Testnet)
                      ├─ idle balance ──auto-sweep──▶ USYC yield
                      ├─ policy engine (limits / allowlists / budgets)
                      └─ agent spend ──x402 nanopayments──▶ services
                                     └─ swap-kit ──▶ USDC / EURC rebalancing
```

## Circle / Arc stack used

| Layer | Product |
|---|---|
| Chain | Arc Testnet (USDC-native gas) |
| Cross-chain deposits | CCTP v2 via `@circle-fin/bridge-kit` |
| Agent wallets & policies | Circle Agent Stack (Agent Wallets + CLI) |
| Micropayments | Nanopayments / x402 (`@circle-fin/x402-batching`) |
| FX / rebalancing | `@circle-fin/swap-kit` (USDC · EURC — Swap is Arc-Testnet-exclusive) |
| Yield | USYC (tokenized treasury) |

## Status

Hackathon build in progress — final MVP due 2026-08-09.

- [x] Agent wallet provisioned on Arc Testnet via Circle Agent Stack
- [x] Circle Gateway funded (direct on-chain deposit, sub-second finality)
- [x] First x402 nanopayment completed on Arc Testnet — $0.001 USDC, 402 → 200, settled via Gateway ([`services/demo-stall/`](services/demo-stall/server.ts))
- [x] CFO console with live balances, editable spending policy, agent spend actions
- [x] Policy enforcement verified on-chain: in-bounds $0.001 settled, out-of-bounds $0.05 **blocked** by per-tx limit
- [x] USYC idle sweep live: agent wallet → treasury → Teller.deposit, 3 USDC → 2.650424 USYC minted on Arc Testnet
- [x] CCTP V2 cross-chain deposit live: Sepolia burn → fast attestation → mint to the agent wallet on Arc
- [ ] USDC/EURC treasury rebalancing via Swap
- [ ] 3-minute demo video + final deck

**All four verbs — deposit, earn, govern, spend — are now live and demoable from one console.**

## Team

Solo build.
