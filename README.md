<p align="center">
  <img src="demo_assets/brand/ovolyn-lockup-horizontal.svg" alt="OVOLYN" width="320" />
</p>

# OVOLYN — The Autonomous Bank for AI Agents

**Agent operators deposit USDC. Idle balances earn treasury yield. Humans set the policy. Agents spend autonomously within it.**

**Live: [ovolyn.xyz](https://ovolyn.xyz)** · [Deck](docs/ovolyn-deck.pdf) · [Deployment](docs/DEPLOY.md) · [Spec](docs/PRODUCT-SPEC.md)

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

## What is live

All four verbs — deposit, earn, govern, spend — plus FX rebalancing run from one console at [ovolyn.xyz](https://ovolyn.xyz), and every figure is verifiable on Arc Testnet.

- Agent wallet provisioned on Arc Testnet via Circle Agent Stack
- Circle Gateway funded by direct on-chain deposit, sub-second finality
- x402 nanopayments settling on Arc Testnet — $0.001 USDC, 402 → 200, through Gateway
- Policy enforcement proven both ways: an in-bounds $0.001 settles, an out-of-bounds $0.05 is **refused**, and the refusal is written to the ledger with its reason
- USYC idle sweep: agent wallet → treasury → `Teller.deposit`, minting USYC on Arc
- CCTP V2 cross-chain deposit: Sepolia burn → fast attestation → mint on Arc
- USDC/EURC treasury rebalancing via Swap — the only testnet where this exists
- Open service registry: anyone may list against a signature from their payout address, a Tier-0 probe decides the tier, and no human reviews the queue
- An LLM decision loop that reads balances and policy, substitutes a cheaper service when refused, and escalates to its operator instead of raising its own limit

### Try it without an account

The four seed stalls are public x402 endpoints. Any agent, on any of a dozen testnets, can pay one:

```bash
curl -i https://ovolyn.xyz/stall/gas-oracle     # 402 + a payment-required quote
```

Reading is open to everyone — balances, the market, and the whole ledger including the refusals. Moving money is not: those routes answer only to the account named in `OPERATOR_ALLOWLIST`.

## Run it

See [docs/DEPLOY.md](docs/DEPLOY.md). Three containers, two persistent volumes, automatic HTTPS.

```bash
cp .env.example .env      # fill in the Circle keys and your operator identity
docker compose up -d --build
```

## Repo map

| Path | What is in it |
|---|---|
| `app/` | Next.js console — landing, `/bank`, `/market`, `/ledger`, `/agents`, and the API |
| `lib/` | The bank itself — CCTP, treasury, policy engine, registry, agent loop |
| `services/stalls/` | The four seed x402 services the agent can buy from |
| `cli/` | Agent-side CLI: pair with an account, read the market, request a spend |
| `scripts/` | `responsive-audit.mjs` — measures layout overflow across viewports over CDP |
| `docs/` | Deck, deployment guide, product spec |

## Team

Solo build.

## License

[MIT](LICENSE) — use it, change it, ship it, sell it. Keep the notice.
