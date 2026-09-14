# `@off-market/pmp-mcp` — `pmp-mcp`

Local **stdio** MCP over `@starkware-libs/pmp-trading-core`: one identity, one file-backed store,
guardrails from env. Tool semantics live in `src/doctrine.ts`. This file is the operator contract.

Two exclusive infrastructure profiles. Mixed env **fails at startup** (names only, never values).
`PMP_OFFMARKET_GATEWAY_URL` selects/tests a gateway — it is **not** a hybrid profile.

| | Managed | Local |
| --- | --- | --- |
| `PMP_INFRA_MODE` | `managed` | `local` |
| Infra credentials | `PMP_OFFMARKET_API_KEY` (a path segment of every gateway URL) | Required: `PMP_STARKNET_RPC_URL`, `PMP_PROVER_URL`, `PMP_INDEXER_URL`, `PMP_AVNU_PAYMASTER_API_KEY`. `PMP_POLYGON_RPC_URL` and `PMP_AVNU_PAYMASTER_URL` default to public endpoints; `PMP_BUILDER_CREDS` is optional (unset ⇒ relayer 401s on Builder calls) |
| Default gateway | `https://offmarket.cx/mcp/` (override for the dev gateway `https://test.offmarket.se-dev.io/mcp`) | — |
| Forbidden | Local service vars (`PMP_STARKNET_RPC_URL`, `PMP_PROVER_URL`, `PMP_INDEXER_URL`, `PMP_POLYGON_RPC_URL`, `PMP_POLYGON_BUNDLER_URL`, `PMP_AVNU_PAYMASTER_API_KEY`, `PMP_AVNU_PAYMASTER_URL`, `PMP_BUILDER_CREDS`) | `PMP_OFFMARKET_API_KEY`, `PMP_OFFMARKET_GATEWAY_URL` |
| Egress | Gateway only (derived `/mcp/*` paths) | **Zero** to `offmarket.cx` or the configured gateway |
| Execution / state | This process: identity key, `PMP_STORAGE_DIR`, jobs | Same |

Architecture: `docs/architecture.md`. Privacy: `docs/threat-model.md`. GKE ops: `deploy/README.md`.

## Shared env

`PMP_*` only. Config knobs rewrite to `VITE_*`; identity/credential names are **dropped** (`src/envFromPmp.ts`).
`PMP_INFRA_MODE` and `PMP_EVM_PRIVATE_KEY` are the only variables required in **both** profiles —
everything else is per-profile (Managed / Local below) or optional here.

| Variable | Required | Meaning |
| --- | --- | --- |
| `PMP_EVM_PRIVATE_KEY` | ✅ | Identity seed, 32-byte hex. **`init` generates one** (pass `--no-key` to import your own) and prints only the derived EVM address. In-memory — never logged, persisted, or mapped into core. |
| `PMP_STORAGE_DIR` | — | Durable store (**burn cursors**). Defaults to `~/.local/share/pmp-mcp/<eoa-address>` (per identity), printed to stderr at start. Lost dir = lost recovery. Locked while running. **In a container:** mount a volume and set this, or the cursors die with it. |
| `PMP_OZ_ACCOUNT_CLASS_HASH` | — | Account class hash; defaults to the mainnet OZ class this project deploys (`PMP_OZ_ACCOUNT_CLASS_HASH_MAINNET` wins if set). |
| `PMP_MAX_ORDER_USDC` | — | Per-order notional cap. **UNSET REFUSES** every order tool (`ORDER_CAP_UNSET`). |
| `PMP_ALLOWED_MARKETS` | — | Optional token-id allowlist. Unset = all markets. Never applied to sell/redeem/return. |
| `PMP_ALLOWED_DESTINATIONS` | — | Comma-separated EVM addresses `cash_out` may pay. Unset ⇒ every fresh `cash_out` refuses (a resumed one-way burn is exempt). |
| `PMP_MAX_POOL_BALANCE` | — | Pool-exposure cap, human USDC (default `1000`). |
| `PMP_WALLET_INDEX_FLOOR` | — | Optional next-index **floor**, and setting it **skips the on-chain scan**. Unset ⇒ `fund_wallet` reconstructs used indices from chain and starts at 0 when none are used; a scan that cannot complete refuses `SEED_SCAN_REQUIRED` (with a `hint`). `check` shows `default (0; scanned on first fund)`. `PMP_WALLET_INDEX` is a deprecated alias. |
| `PMP_CIRCLE_PAYMASTER_ENABLED` | — | Bot-only switch, **ON when unset** — it is the only deposit route a key-only host has. `true`/`1`/`yes` on, `false`/`0`/`no` off, case-insensitive; anything else refuses start. `check` shows `default (enabled)`. See `deposit_to_pool`. Never a web `VITE_*` flag. |
| `PMP_USDC_GAS_BUNDLER_URL_137`, `PMP_USDC_GAS_PAYMASTER_137`, `PMP_USDC_GAS_PERMIT_MAX` | — | Gasless-deposit knobs. Bundler defaults to the **public** `public.pimlico.io`. Permit ceiling defaults to `2000000` ($2.00), hard-capped at $10.00. |

Complete examples: `.env.example`.

## Install and run the CLI

Three ways in. **(a) The registry** — the only one that puts `pmp-mcp` on your PATH. No token, no
scope mapping: the package is on **npmjs** and its `dist` inlines the whole `@starkware-libs`
chain (pool SDK and bridge), which is published only to GitHub Packages.

```
npm i -g @off-market/pmp-mcp
pmp-mcp check
```

`pmp-mcp init` says so only if `@off-market` is mapped away from npmjs — a redirect would hand a
process carrying `PMP_EVM_PRIVATE_KEY` to a registry that is not ours. `THIRD_PARTY_LICENSES.md`
names what the bundle inlines.

**(b) Claude Code plugin marketplace** — skills, prompts, and a ready `.mcp.json` that runs the
published server through a source-only launcher. The launcher refuses to resolve the package when
`@off-market` is mapped off npmjs, and otherwise needs nothing configured:

```
claude plugin marketplace add starkware-libs/offmarket#trading-sdk
claude plugin install pmp-mcp@offmarket
```

**(c) From source**, for working on the package itself:

```
GITHUB_TOKEN=$(gh auth token) pnpm install     # the private SDK needs it — root README
pnpm --filter @starkware-libs/pmp-trading-core build
pnpm --filter @off-market/pmp-mcp build
```

A source checkout does **not** link `pmp-mcp` onto your PATH. Two supported invocations, `<repo>`
being the **repo root**:

```
node <repo>/packages/mcp-server/dist/bin.js check          # from YOUR project dir
alias pmp-mcp='node <repo>/packages/mcp-server/dist/bin.js'  # optional, then `pmp-mcp check`
pnpm --filter @off-market/pmp-mcp exec node dist/bin.js install --agent claude
```

The `pnpm exec` form runs with the **package** as its cwd, so use it for `install` only — `init`
and `check` read `./.env.pmp` from the current directory.

## Setup

`<pmp-mcp>` below is either invocation above.

```
<pmp-mcp> init              # writes ./.env.pmp 0600 (annotated; refuses to overwrite)
<pmp-mcp> init --managed    # the managed template instead: gateway + API key, no local endpoints
$EDITOR .env.pmp            # fill every blank; replace the free defaults if you have better
<pmp-mcp> check             # per-variable set / missing / malformed / default, values redacted, exit 1 on any problem
```

Managed is two lines and no editor — the key never has to pass through an agent or a chat log:

```
<pmp-mcp> init --managed
<pmp-mcp> set-key           # hidden prompt on a TTY; also `set-key < key.txt` / `echo $K | set-key`
```

`set-key` validates the `pmp_live_…` shape, upserts `PMP_OFFMARKET_API_KEY` in `./.env.pmp` (or
`--env-file <path>`) leaving every other line and the file's mode untouched, and prints a masked
confirmation only.

`init` writes the file **0600** because it holds `PMP_EVM_PRIVATE_KEY`. If you copy it anywhere,
`chmod 600` the copy.

`check` never opens `PMP_STORAGE_DIR`, so it is safe to run against a live server; in **managed**
mode it makes one request to the gateway (see below). It covers `PMP_OZ_ACCOUNT_CLASS_HASH`,
which the startup resolvers do not see — felt shape when you set one, `default` when you do not
(core bakes the mainnet OZ class in) — and reports `PMP_BUILDER_CREDS` as `set` / `unset` (unset starts fine and refuses every
order tool). It also reads `./.env.pmp` (or `--env-file <path>`) when present, filling only names
your shell has not already set — so `check` right after `init` sees what you just wrote.

`init` pre-fills what is public or shared: `PMP_INFRA_MODE=local`, a storage dir, a conservative
`PMP_MAX_ORDER_USDC`, the public OpenZeppelin account class hash, two **free public** RPC
endpoints (rate-limited — replace them with a paid RPC for anything real), and a **shared
free-tier** Polymarket builder credential so a first run works. That shared credential is one
rate limit for everyone who never changed it and can be revoked; create your own through the
Polymarket builder program before trading real size.

It also **generates `PMP_EVM_PRIVATE_KEY`** — a fresh 32-byte CSPRNG identity — and prints only
the derived EVM address, how to fund it, and a reminder to **back the file up**: it holds the
only copy of that key. The first `fund_wallet` seeds its index from CHAIN, so a fresh
identity starts at 0 with no floor to set. Pass `--no-key` to leave the key line blank and
import an existing identity instead. Every operator-owned service endpoint still stays blank by design:
a defaulted prover or paymaster URL would silently route proofs through a host you did not choose.

With no subcommand, the bin serves MCP over stdio.

## Managed

Required: `PMP_INFRA_MODE=managed`, `PMP_OFFMARKET_API_KEY`.

Optional `PMP_OFFMARKET_GATEWAY_URL`: HTTPS (HTTP only on loopback `localhost` / `127.0.0.1` / `::1`); no userinfo, query, or fragment; trailing slash normalized. Default `https://offmarket.cx/mcp/`. `check` prints `gateway: <host> reachable|unreachable|key rejected` — HOST only, never a path, which carries the key.

**Startup probe.** A managed start makes one `starknet_chainId` call before serving and refuses
rather than defer the failure to your first money-adjacent tool call: `GATEWAY_UNREACHABLE`
(names `PMP_OFFMARKET_GATEWAY_URL` + host), `GATEWAY_UNAUTHORIZED` (names
`PMP_OFFMARKET_API_KEY`), `GATEWAY_UNHEALTHY` (5xx).

**Daily usage.** `get_usage` returns the authenticated owner's request count, remaining daily
allowance, exact UTC `resetAt`, warning state, and the operator's current support links; managed
`get_status` includes the same snapshot when it is reachable. At 1,500 requests, a **fresh**
`buy_privately` refuses with `NEW_PRIVATE_BUY_DAILY_RESERVE`, its reset time, and support links,
preserving the final 500 of the 2,000-request allowance for active flows and recovery. An existing
`buyPrivately / activeBuy` continues. Sells, redemptions, returns, cash-outs, resumes, and latch
recovery are never quota-gated. Contact links may rotate; use the returned support page rather than
hard-coding a Telegram or X handle, and never send any API key, private key, signature, or viewing
key to support.

**How each leg authenticates.** Managed endpoints carry the API key as a URL **path segment** —
`<gateway>/<key>/<route>`, the Alchemy/Infura/Pimlico convention — so every embedded client
authenticates from the URL alone. There is no bearer header or transport seam, and this package
never wraps or replaces `globalThis.fetch`; the bounded usage reader calls its own injected fetch
dependency. Because the key is in the path, it is never printed: `check`
reports the gateway HOST only, and any error whose message or cause chain quotes a managed URL
(starknet.js embeds `nodeUrl`, viem the transport URL) has the key replaced with `[redacted]`
before it leaves the SDK or reaches a tool result. Treat a managed URL as a secret: never paste
one into a log, an issue, or a chat. Local mode has no key at all.

Token: wallet sidebar **memory only** (cleared on close). Challenge 5 min, access **30 days**. No individual revoke — older tokens stay valid until expiry. GKE issues; Vercel production only rewrites challenge/issue (no secret on Vercel; previews must not mint production tokens).

## Local

Required: `PMP_INFRA_MODE=local`, `PMP_STARKNET_RPC_URL`, `PMP_PROVER_URL`, `PMP_INDEXER_URL`, `PMP_AVNU_PAYMASTER_API_KEY` (absolute URLs — SDK defaults are Vite-proxy paths).

`PMP_BUILDER_CREDS` JSON `{"key","secret","passphrase"}` — a Polymarket builder-program credential, the single local-signing HMAC (a cred pool is a web-DEV affordance; PROD there signs remotely). Optional to *start*, required for any *trading*: deposit-wallet creation and approvals go through the builder relayer, so unset ⇒ every trade path 401s at the first WALLET call. Malformed ⇒ refused start. In-memory only; never mapped into core's config. Other `VITE_*` core knobs accept a `PMP_` name (`packages/trading-core/src/config/defaults.ts`). `PMP_STARKNET_RPC_URL` is required here even though core bakes a public default — local mode never silently borrows one.

## `deposit_to_pool`

**Gasless by default.** The source-chain leg needs an EIP-1193 provider that can switch chains and a key-only host has none, so the bot takes the gasless (USDC-paid, **Polygon 137 only**) path unless `PMP_CIRCLE_PAYMASTER_ENABLED` is turned off — with it off the tool answers `DEPOSIT_PROVIDER_UNAVAILABLE` and you deposit from the web app. There is **no native-POL fallback**. Source is **native USDC on the identity EOA**, and the paymaster keeps a gas reserve, so deposit at most **balance − $0.20** (Polygon default); an over-ask refuses `GASLESS_DEPOSIT_INSUFFICIENT_USDC` carrying `maxDepositMicro`.

`resolve_gasless_deposit` is bound **regardless** of that switch: it is the escape from an orphaned `pmp.inflightGaslessDeposit` record (a pre-submit cursor for a UserOperation the bundler never took, which blocks a fresh deposit while having no mint to acknowledge). It asks the bundler, clears only a positive "no such op", and moves no funds.

## `plan_cash_out`

`cash_out`'s `amountMicro` is the **pool debit** — what leaves the pool. The destination
receives it minus two fees charged in different places: the pool's own paymaster fee (an extra
USDC withdraw baked into the same proof, so the pool is debited it **on top of** the burn) and
Circle's forwarding `max_fee` (deducted from the burn before minting). `plan_cash_out` is the
read-only preview that reconciles all three, exactly:

- `poolDebitMicro` − `fees` = `destinationNetMicro`
- `poolDebitMicro` + `poolRemainingMicro` = the pool balance (signed: a negative residual is an
  over-ask, which `affordable` also reports)

Every `…Micro` field arrives with its `…Usdc` sibling (`usdc.ts`), fees included.

`fullExitMicro` is the whole balance and the real maximum; `maxCashOutMicro` is the largest
debit that still leaves the return-fee buffer. Both are filtered through the fee floor, so a
**nonzero ceiling always passes the quote** — `0` means there is no legal exit at that size, and
both `0` means the pool cannot cover the pool fee plus the forwarding fee at all. Send `receiveMicro` instead of `amountMicro` to
solve for the debit that nets an exact amount at the destination. `cash_out`'s own result
repeats the same figures as `breakdown` (absent on a resume — the fees were charged by the run
that committed the burn).

## Startup

Missing/forbidden names print **one line** (sorted) and exit non-zero. Credential-bearing names (`…PRIVATE_KEY`, `…SIGNATURE`, `…CREDS`, `…SECRET`, `…PASSPHRASE`, `…API_KEY`, `…TOKEN`, any `…_URL`) are elided; plain config prints. Bin logs `infrastructure profile: <kind>` on stderr (kind only).

## Install as a Claude Code plugin

The package is plugin-shaped: `.claude-plugin/plugin.json`, a root `.mcp.json`, and four skills
under `skills/`.

The `trading-sdk` branch root carries `.claude-plugin/marketplace.json`, so `marketplace add`
(route **b** above) is the supported install. The `#trading-sdk` suffix is **required** until that
branch reaches `main`: `marketplace add` clones the default branch, which carries neither the
marketplace file nor this package, and fails with "Marketplace file not found". Against a local
checkout instead:

```
claude plugin validate packages/mcp-server
claude --plugin-dir packages/mcp-server
```

The bundled `.mcp.json` runs `npx -y @off-market/pmp-mcp@0.1.2` — a marketplace install gets the
repo's **source**, never a built `dist`, so the server comes from the registry; the version is
pinned — and reads the same `PMP_*` names from your shell — source your env file before launching. For the **managed** profile,
export `PMP_INFRA_MODE=managed` and `PMP_OFFMARKET_API_KEY` in place of the local endpoint set;
`PMP_CIRCLE_PAYMASTER_ENABLED=true` opts into the
gasless deposit path in either profile. An optional variable left unset expands to empty and is
treated as unset everywhere the server reads it — in Claude Code's own env map only `${NAME:-}`
is safe for that, since a bare `${NAME}` for an unset shell var is left as the literal text.
Skills load namespaced `pmp-mcp:<name>`; prompts as `/pmp-mcp:trade`, `/pmp-mcp:recover`,
`/pmp-mcp:close-out`.

| Skill | Use when |
| --- | --- |
| `pmp-mcp-quickstart` | Configuring, installing, first run, or a refused start. |
| `explore-markets` | Finding a market; reading price, tick size, minimum size. |
| `plan-betting-strategy` | Sizing and staging under the operator's caps. |
| `write-trading-bot` | Scripting against trading-core directly. |

Skills carry their own tool sequences and delegate doctrine depth to `src/doctrine.ts` /
`src/playbooks.ts`, so no client is regressed and the prose cannot drift.

**Headless.** A project `.mcp.json` sits at "pending approval" until an interactive `claude`
trusts it, so `claude -p` alone sees no pmp-mcp tools. Use
`claude -p "…" --mcp-config .mcp.json --strict-mcp-config`.

**Releases.** A `pmp-v<version>` tag publishes both packages to GitHub Packages
(`.github/workflows/publish-packages.yml`); the tag must match both `package.json` versions.

## Install into Codex, Cursor, or opencode

```
<pmp-mcp> install --agent claude|codex|cursor|opencode|all   # add --global for your home directory
<pmp-mcp> install --agent claude > .mcp.json                 # stdout is the document; prose goes to stderr
```

It copies `skills/*` where that agent looks and **prints** the MCP snippet for it — the config
document on **stdout**, every human line on **stderr**, so a redirect yields a parseable file. It
never writes an MCP config itself, so your other servers survive; merge the snippet if the file
already exists. Add `--force` only to replace a skill directory you have edited.

| Agent | Project skills dir | `--global` | MCP config to paste into | Tool namespace |
| --- | --- | --- | --- | --- |
| Claude Code | `.claude/skills` | `~/.claude/skills` | `.mcp.json` (or `claude mcp add --transport stdio pmp-mcp -- node <abs>/packages/mcp-server/dist/bin.js`) | `mcp__pmp-mcp__<tool>` |
| Codex | `.agents/skills` | `~/.agents/skills` | `~/.codex/config.toml` (or `codex mcp add pmp-mcp -- node <abs>/packages/mcp-server/dist/bin.js`) | host-defined |
| Cursor | `.agents/skills` | `~/.cursor/skills` | `.cursor/mcp.json` | host-defined |
| opencode | `.agents/skills` | `~/.config/opencode/skills` | `opencode.json` | `pmp-mcp_<tool>` |

`.agents/skills` is the shared convention for Codex, Cursor, and opencode; **Claude Code does not
read it**, which is why the subcommand takes an `--agent`.

The printed snippets, with `<abs>` the absolute path to the **repo root**:

```json
// .mcp.json  ·  .cursor/mcp.json
{ "mcpServers": { "pmp-mcp": {
  "command": "node", "args": ["<abs>/packages/mcp-server/dist/bin.js"],
  "env": { "PMP_EVM_PRIVATE_KEY": "${PMP_EVM_PRIVATE_KEY}", "PMP_STORAGE_DIR": "${PMP_STORAGE_DIR}" }
} } }
```

```toml
# ~/.codex/config.toml
[mcp_servers.pmp-mcp]
command = "node"
args = ["<abs>/packages/mcp-server/dist/bin.js"]
# NAMES only — passed through from your shell
env_vars = ["PMP_EVM_PRIVATE_KEY", "PMP_STORAGE_DIR"]
```

```json
// opencode.json
{ "mcp": { "pmp-mcp": {
  "type": "local", "command": ["node", "<abs>/packages/mcp-server/dist/bin.js"],
  "enabled": true
} } }
```

Each host gets its own form, chosen so an unset name arrives **empty** (which the server treats
as unset) rather than as literal text: Claude Code `${NAME:-}`, Cursor `${env:NAME}`, Codex a
names-only `env_vars` passthrough. opencode gets **no** `environment` map: it substitutes
`{env:NAME}` as text before parsing the file, so a JSON value such as `PMP_BUILDER_CREDS` breaks
the config — the server inherits your shell env instead (verified live), so source the env file
before launching. Cursor does not document its unset behaviour — export every listed name
before launching; empty is fine.

`install` prints the full variable list; the excerpts above are abbreviated. Values never
appear in the output — source your env file, then start the agent.

Whether these clients surface an MCP server's `instructions` or its `prompts` as slash commands
is client-specific and unverified, so each skill stands on its own and names `/pmp-mcp:trade` and
friends only as "if your client lists MCP prompts".

`npx skills add <owner>/<repo>` (Vercel's `skills` CLI) does **not** work here: it reads a repo's
root `skills/`, and ours live under `packages/mcp-server/skills`. Use `install`.

## Result shapes

Rules every tool result follows. Raw fields are never removed — a client pinned to one keeps working.

| Convention | Shape |
|---|---|
| Amounts | every `…Micro` carries a 6-dp sibling `…Usdc` (`mintedMicro` → `mintedUsdc`). `sharesMicro` is exempt — a share count is not dollars. |
| Tx hashes | every hash gets `{hash, chain, url}` beside it (`burnTxHash` → `burnTx`). The chain is per **tool**: a withdrawal burns on Starknet, a return on Polygon. An unlisted tool/field gets no link rather than a guessed one. |
| Balances | `place_order`, `sell_position`, `fund_wallet`, `return_to_pool` carry `before`/`after` for the accounts they touch. `fund_wallet` has no `before.wallet` — it picks the slot. A read that threw is `{unknown: true}`, never `0`. |
| Sell remainder | `remainingShares` + `dust`, with `dustFloor` naming which CLOB floor was used: `min-order-size-shares` (limit) or `marketable-minimum-usd` ($1, marketable). `unknown` ⇒ the floor was unreadable and `dust` is **absent**, never `false`. |
| Settlement | The chain reflects seconds after the CLOB acks, so a `filled` buy's and a `sold` sell's `after` read is POLLED until it moves (~30s). If it never does, the result carries `settled: false` and the sell remainder is omitted entirely — the last read is reported, never as truth. Outcomes that predict no movement (`resting`, `unmatched-killed`) are read once, unpolled and unmarked. Informational only: the fill is the matched amount, never this read. |
| Next action | `get_status` and every terminal `get_job` carry `nextAction: {tool, args, why}` while a state blocks the next call (today: a terminal `buy_privately` record). |

`get_status` adds `accounts`: the pool balance plus each covered wallet's USDC (native / USDC.e / pUSD
+ `totalMicro`), its open positions, and `totalSpendableUsdcMicro`. Two limits are explicit in the
shape: `scope` — `recorded-and-cursor-named-slots` covers the wallets this store records as funded
plus the ones in-flight cursors name (`cursor-named-slots` is the cursors alone, which omits every
funding that already completed); neither is a chain scan, so a wallet funded from another store is
still invisible. And `totalSpendableUnknown: true` **instead of** a total whenever a covered
read failed. The **pool address is never here**; it comes from `get_pool_identity` alone.

## Supervised live test

The bot cannot deposit — the **web app seeds the pool**, MCP drives everything after. Local needs `PMP_BUILDER_CREDS` (else relayer 401s at step 4). Managed uses the gateway builder-sign route — do not set local builder creds.

1. Web app, same `PMP_EVM_PRIVATE_KEY` identity: deposit a small amount into the pool.
2. `get_status` — confirm `poolBalanceMicro` and empty `pendingFlows`.
3. Set `PMP_WALLET_INDEX_FLOOR` above every index the web app has used, and restart — that identity's other wallets are exactly the case the floor exists for.
4. `fund_wallet` (or `buy_privately`) → poll `get_job`. **CLOB success is not a fill.**
5. `sell_position`, or `redeem_position` once the market resolves.
6. `return_to_pool` for leftovers.

Unknown-state or funds-in-flight: **`resume`, never a re-invoke**. `pendingFlows` is the durable record; jobs are in-process and lost on restart. A gateway timeout/5xx is **not** submission evidence — do not auto-retry money-moving tools.
