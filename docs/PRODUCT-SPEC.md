# Ovolyn Product Specification

> The autonomous bank for AI agents. This spec covers the three actors, their
> onboarding, permissions, and how the open service market works. Status tags:
> `[live]` verified on Arc Testnet today · `[build]` hackathon scope · `[roadmap]` post-hackathon.

## 0. The founding rule: authority is human-created, permission is machine-delegated

Everything below follows from one line:

> **A human opens the account. The account issues the agent's credential. The
> agent spends inside limits the human set.**

Registration is therefore split into three separate flows, and only the first
one roots authority:

| Flow | Who performs it | Gate | Why it is drawn here |
|---|---|---|---|
| **Account** (owner) | **Human only — never an agent** | Wallet signature (SIWE) or email OTP | The account holds funds and defines policy. Its authority must root in something only the human possesses; if an agent could open an account, whoever controls that agent's prompt controls the money, and no non-repudiable human consent sits at the root of the chain. |
| **Agent identity** | An agent may register itself | An Agent Key issued by an already-authenticated account | This is a *delegated* credential with hard-capped powers, so self-service is safe — the authority still traces back to the human who opened the account. A newly registered agent starts with **zero spending allowance**: it can authenticate and read, but cannot move a cent until the owner assigns it a budget and policy. |
| **Service listing** (ASP) | Human signature; an agent may prepare the submission | Signature from the payout address | The signature *is* the proof of ownership — an agent without the key cannot produce one. |

The convenience of conversational onboarding stops exactly where funds begin.
An agent can install the skills pack, register itself, read balances and
request spending; it cannot open the account, fund it, raise its own limits,
or withdraw.

## 1. Three actors, three doors

| Actor | Auth | Why this door |
|---|---|---|
| **Operator** (human who runs agents) | Email + OTP | The spending wallet is provisioned *by* the platform (Circle MPC) — there is no pre-existing key to sign with. Email honestly signals a managed account. |
| **Service provider** (stall owner) | **Wallet signature (SIWE)** — MetaMask / OKX Wallet / Binance Wallet | Their one hard requirement is a payout address; signing proves they own it. Listing, pricing, delisting and reputation are cryptographically bound to that address. No account to steal — only an address and its signatures. |
| **Agent** (the machine) | **Agent Key** issued by its operator | Agents never authenticate as humans and never hold keys to funds. |

An email-registered operator who wants to sell is prompted to bind a wallet
(sign once) before listing. There is deliberately **no OAuth anywhere** — agent
integration goes through skills and keys (§4), not browser redirects.

## 2. Operator: onboarding & permissions

The operator registers in person — wallet signature or email OTP, never
delegated to an agent (§0). Registration then auto-provisions the rest:
managed spending wallet, conservative default policy (per-tx $0.01 / daily
$0.10 / verified-tier merchants only), and a testnet faucet drip. Deposit via
direct transfer or CCTP from any chain `[live]`. Idle balances sweep into
tokenized treasury yield (USYC) `[live]`.

**One account, three kinds of keys:**

| Capability | Owner (human) | Agent Key | Viewer |
|---|---|---|---|
| Deposit / withdraw to external address | ✅ | ❌ never | ❌ |
| Edit policy (limits, budgets, merchant scope) | ✅ | ❌ never | ❌ |
| Spend via x402 | ✅ | ✅ within policy only | ❌ |
| Sweep to yield / FX rebalance | ✅ | ✅ if delegated | ❌ |
| Read balances, ledger, remaining budget | ✅ | ✅ own account only | ✅ |
| Issue / revoke Agent Keys | ✅ | ❌ | ❌ |

Agent Key limits are protocol-level ceilings, not defaults: a compromised or
misbehaving agent can at worst spend within policy at allowlisted merchants.
Withdrawals only ever go to the operator's bound self-custody address.

`[roadmap]` Progressive tiers for mainnet: unverified (small limits) → KYC →
KYB. Passkeys as an additional owner factor.

## 3. Service provider: open registry with trust tiers

Technical floor for selling is deliberately minimal — an EVM payout address
plus an endpoint that speaks x402. Listing form: payout address (proven by
signature), endpoint URL + method, price, category, description, I/O schema,
availability commitment. Email optional (used for Tier 1 verification only).

**Trust tiers — permissionless base, earned badges:**

- **Tier 0 · Listed** — self-serve, no human approval. Automated probes gate
  the listing: endpoint alive, valid 402 payment-required header, dust-level
  test purchase settles and delivers. `[build]`
- **Tier 1 · Verified** — email/domain/GitHub identity verified. `[build]`
- **Tier 2 · Audited** — manual quality review; featured placement. `[roadmap]`

Unlisted or Tier-0 services remain directly callable by URL — the registry
curates *display*, never *access*. Buyer-side policy can require a minimum
tier ("my agent only trades with Tier 1+"), connecting seller trust directly
into the spending policy engine.

**Reputation** `[roadmap]`: reviews require proof of payment (settlement
records), so rating a merchant costs real money — sybil resistance priced in
by economics. Continuous monitoring delists dead endpoints and flags silent
price changes.

**Market composition, honestly labeled:** first-party seed services are tagged
`Ovolyn first-party`; third-party stalls join via the open registry. Real-money
counterparties exist on mainnet today via Gateway — the same agent code buys
from independent vendors there `[build: mainnet lane]`. Negotiated
agent-to-agent jobs with escrow and arbitration align with ERC-8183 and are
`[roadmap]`.

## 4. Agent integration — skills first, keys underneath, no OAuth

**Primary path — the skills pack** `[build]`:

```
npx skills add ovolyn/skills -g
```

installs Ovolyn know-how into the user's own agent (Claude Code, Codex, or any
skills-compatible runtime). From there the agent handles its own onboarding
conversationally — *"Register yourself against my Ovolyn account and show me
what you're allowed to spend"* — registering, obtaining its Agent Key and
reading its limits without forms or manual key transport.

What it cannot do is open the account: that is the owner's own act, performed
once at the website with a wallet signature or an email OTP (§0). The agent's
registration attaches to an account that already exists, and the agent it
creates starts at a zero allowance until the owner funds it and sets a policy.
The convenience stops where the funds begin.

**Developer path — raw HTTP API** `[build]`: three endpoints with
`Authorization: Bearer <agent-key>`:

- `GET  /api/v1/market` — search the open registry (+ Circle catalog passthrough)
- `POST /api/v1/spend` — request a purchase; returns goods or a structured refusal
- `GET  /api/v1/budget` — balance, remaining daily budget, policy summary

**Ecosystem path — MCP server** `[build, after LLM loop]`: Ovolyn exposed as an
MCP server (`pay_service`, `check_budget`, `search_market`) so any
MCP-compatible agent connects natively.

**The hard boundary (all paths):** the agent holds *the right to request
spending* — never funds, never keys, never policy. The bank executes payments
server-side after the four-gate check (allowlist → live price estimate →
per-tx limit → daily budget) `[live]`. A refusal returns a structured reason
the agent can reason about: downgrade, abort, or escalate to its human.

> Wallet-based integrations give the agent a wallet. Ovolyn gives it a credit
> card — the limits, the merchant scope and the kill-switch stay with the
> issuer.

## 5. Economic model

Ovolyn monetizes the balance sheet, not the payments:

1. **Yield share** — spread on USYC treasury yield from idle balances
2. **Management fees** — policy engine, auditable ledger, treasury automation
3. **FX & flow fees** — basis points on USDC/EURC rebalancing and cross-chain deposits

Core metric: TVL held in agent accounts. Two-sided flywheel: operators open
accounts to govern spending; providers open accounts because settlement into an
Ovolyn account is instant and their revenue auto-earns — both sides become
depositors, and account density makes both sides harder to leave.

## 6. Build phases

| Phase | Scope |
|---|---|
| Hackathon (→ Aug 9) | Console + four verbs `[live]` · LLM decision loop · market-search perception (registry + catalog) · Agent Key API · registry v0 with Tier-0 probes · mainnet real-counterparty lane |
| Accelerator | Skills pack GA · MCP server · Tier 1/2 · reputation · A2A escrow (ERC-8183) · KYC tiers · licensing/legal review |
