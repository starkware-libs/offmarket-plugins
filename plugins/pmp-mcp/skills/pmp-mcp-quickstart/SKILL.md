---
name: pmp-mcp-quickstart
description: Use when you want to bet or trade on Offmarket or Polymarket privately, need to set up or fund pmp-mcp, hit a first run, or a start that refuses to launch. Covers setting up, configuring, installing, or first-running the pmp-mcp MCP server, when it refuses to start, or when funding it — adding money, depositing USDC into the pool, "how do I put funds in", an empty pool balance, or which address to send to. Covers choosing the managed (Offmarket API key) or local (own infrastructure) profile, the env template, per-variable validation, generating and backing up the identity key, funding the Polygon trading address and deposit_to_pool, wiring it into Claude Code / Codex / Cursor / opencode, and what may never be defaulted. Covers PMP_INFRA_MODE, PMP_OFFMARKET_API_KEY, PMP_WALLET_INDEX_FLOOR, PMP_CIRCLE_PAYMASTER_ENABLED, storage, RPC/prover/indexer endpoints, builder credentials, and the order cap.
---

# pmp-mcp quickstart

`pmp-mcp` trades on Polymarket with funds withdrawn from the starknet-privacy pool. It moves
real money, it holds a private key, and it starts only when its whole environment is right.
Work in this order; do not skip ahead to starting the server.

The server always runs **locally**, in both profiles: the identity key, the durable store, and
every signing decision stay on this machine.

## Which skill

This one covers **setup, funding and depositing** — the whole path from install to a funded pool.
Hand off once the server is running and funded:

| The user wants | Skill |
| --- | --- |
| A market to trade, or one market's price/tick/minimum | `explore-markets` |
| How much to stake, split across orders, and the exit | `plan-betting-strategy` |
| A script or bot against the SDK instead of these tools | `write-trading-bot` |

Setup, a refused start, or "how do I add money" stay here. Do not start looking for markets
until the pool actually holds funds — step 7 is what gets it there.

## 0. Say what this is — before running any command

Explain it first, in these five sentences and nothing longer. The `init` command prints the same
lines, so quote them rather than paraphrasing:

> Offmarket lets you trade on Polymarket (Polygon) privately: your funds sit in a privacy pool on Starknet.
> For each bet they are withdrawn through Circle CCTP onto a fresh Polygon trading wallet that is not linkable to the pool identity, and they come back the same way.
> This server, pmp-mcp, drives that flow for an AI agent: it runs locally, holds one identity key on this machine, and refuses any order above the per-order cap you set.
> There are two ways to run it — local, where you supply every service endpoint yourself, and managed, where an Offmarket API key from offmarket.cx buys the infrastructure.
> Managed means Offmarket runs that infrastructure and its gateway can see which route your traffic hit and when, so read the threat model before choosing it.

Do not add marketing adjectives, do not promise anonymity beyond what the threat model claims,
and do not run a command until the user has read this. Then continue with step 1.

## 1. Ask which infrastructure the user has — before naming any variable

There are exactly two complete profiles, and they are mutually exclusive. Ask first:

**"Do you run your own prover, indexer and paymaster, or do you have an Offmarket API key?"**

- **Own infrastructure (local)** — `pmp-mcp init`, then step 2 and step 3 below.
- **An Offmarket API key (managed)** — `pmp-mcp init --managed`, then have the user run
  **`pmp-mcp set-key` in their own terminal** (it reads the key from a hidden prompt or a pipe
  and writes it into the file). **Never accept a key in chat** — if one is pasted anyway, do not
  repeat it, tell them it is now in the transcript and should be revoked, and point them at
  `set-key`. That is the whole configuration: no endpoint, no upstream credential.
  Leave `PMP_OFFMARKET_GATEWAY_URL` commented out unless you are deliberately testing against
  the dev gateway `https://test.offmarket.sw-dev.io/mcp`; confirm which one you are pointed at
  with `pmp-mcp check`, which prints the gateway **host**. Skip to step 4.
- **Neither** — send the user to **offmarket.cx**, connect a wallet or sign in, and press
  **Generate API key**. Do **not** invent a prover, indexer or paymaster URL on their behalf,
  and do not tell them running their own prover is the only option.

The key authorizes **infrastructure only**: it cannot sign a transaction or move funds. It is
shown once and is revocable per key from the same view. It becomes a **path segment of every
managed endpoint URL**, so treat a managed URL as a secret too — never paste one into a log, an
issue, or chat. `pmp-mcp check` prints the gateway host only, and the server replaces the key
with `[redacted]` in any error that quotes a URL back.

Do not mix the two. `PMP_INFRA_MODE=managed` alongside any local endpoint refuses the start and
names the endpoint to **remove** — the fix is deleting that variable, not changing the mode.

## 2. Write the local template

```
pmp-mcp init            # writes ./.env.pmp; pass a path for anywhere else
```

Safe to run twice — it refuses to overwrite. Pre-filled: `PMP_INFRA_MODE=local`, a storage dir, a
conservative order cap (`PMP_MAX_ORDER_USDC`), the public Starknet account class hash, two **free
public** RPC endpoints (Starknet and Polygon), and a **shared free-tier** Polymarket builder
credential — enough for a first run. It also **generates the identity key** and prints the
derived EVM address to stderr (`--no-key` to import your own instead).

## 3. Ask the user these two questions

The pre-filled defaults are deliberately the cheapest thing that works, not the right thing.
Before going further, ask:

1. **"Do you have a paid Starknet and/or Polygon RPC endpoint?"** If yes, replace
   `PMP_STARKNET_RPC_URL` and `PMP_POLYGON_RPC_URL` with your own. The shipped defaults are free public endpoints — rate-limited and best-effort, which on a
   value path means a read that fails when it matters.
2. **"Do you have your own Polymarket builder key?"** If not, the shared default works for a
   first run — but it is one rate limit shared by everyone who never changed it, and it can be
   revoked out from under you. Create your own through the Polymarket builder program and
   replace `PMP_BUILDER_CREDS` **before trading real size**.

### Then fill the local blanks yourself

No operator-specific endpoint ships with a default, because a defaulted one silently routes
proofs and orders through whatever host was in the package. You supply, by these exact names:
`PMP_STARKNET_RPC_URL`, `PMP_PROVER_URL`, `PMP_INDEXER_URL`, and `PMP_AVNU_PAYMASTER_API_KEY` —
those four and no more.

`PMP_POLYGON_RPC_URL` and `PMP_AVNU_PAYMASTER_URL` default to public endpoints (`check` prints
them as `default`), and `PMP_BUILDER_CREDS` is **optional**: unset, the relayer answers 401 on
Builder-signed calls — a documented degrade, not a failed start — so set it before trading real
size. When a user says "paymaster key" or "prover", map it to the name above — do not guess a
variant. The README's env table says what each one means.

`PMP_EVM_PRIVATE_KEY` is **not** yours to supply: `init` generates a fresh identity, stores it,
writes only a reference into the 0600 file, and prints the derived **EVM address** — that address
is what gets funded in step 7. Never ask for a private key and never repeat one back; a user
importing an existing identity runs `pmp-mcp init --no-key` and supplies theirs as the
`PMP_EVM_PRIVATE_KEY` environment variable.

Where the key goes (`--key-store`, or `PMP_KEY_STORE`; default `auto`):
- `auto` — the **OS keychain** (`keychain:<id>`) if one answers within 5s, else a **0600 key
  file** under `$XDG_CONFIG_HOME/pmp-mcp` (`keyfile:<id>`), the way `gh` does it.
- `file` — always the key file. Use it on **headless Linux, containers and CI**, where there is
  no Secret Service to answer.
- `keychain` — keychain or nothing; `init` writes nothing and exits 1 if it refuses.

`pmp-mcp init --print-key` still hands the key over once for the user's own secrets manager —
**the user runs that themselves, in their own terminal**: never run it for them and never repeat
its output back, or the key lands in this transcript forever. Neither store protects against
another process running as the same user.

In the managed profile the only secrets are the generated `PMP_EVM_PRIVATE_KEY` and `PMP_OFFMARKET_API_KEY`.

**Never paste any of these into chat, a commit, a log, or a tool argument.** They belong in the
env file and nowhere else. If the user offers one in conversation, tell them to put it in the
file — and do not repeat the value back, not even inside a code block, an example line, or "the
lines to add": write `PMP_AVNU_PAYMASTER_API_KEY=` (or `PMP_OFFMARKET_API_KEY=`) followed by nothing and say "the key you sent".
Every repeat is another copy in a transcript. Quote the variable NAME in an error, never its
value — the server redacts credential-bearing values in its own diagnostics; match that.

`PMP_BUILDER_CREDS` is JSON: keep it inside single quotes, or sourcing the file strips the quotes
and the server refuses to start.

## 4. Validate before starting

```
pmp-mcp check
```

It loads the env file when present; shell values win over the file. The **server** loads the
same file by the same order, so a green `check` is a startable server:
`--env-file <path>` → `$PMP_ENV_FILE` → `./.env.pmp` → `~/.config/pmp-mcp/.env.pmp`. One
line per variable: `set`, `missing`, or `malformed: <reason>`, values never printed. It
exits non-zero on any problem and does **not** open the durable store, so it is safe against a
running server. Fix what it names and re-run until it says `ok.` — including the variables the
startup resolvers do not see themselves. In the managed profile it also prints
`gateway: <host>` so you can see at a glance whether you are pointed at production or the dev
gateway; the key itself never appears in its output. If a tool later refuses with a config code, re-run
`check` before theorising. A run from a directory with no `./.env.pmp` falls through to the
user-global file silently otherwise — `get_status`'s `config.envFileSource` names which rung
answered (`"global"` means that fallback fired), and stderr says so explicitly on start.

## 5. Wire it into your agent

```
pmp-mcp install --agent claude|codex|cursor|opencode|all   # add --global for the home directory
```

This copies these skills where that agent looks (`.claude/skills` for Claude Code,
`.agents/skills` for Codex, Cursor, and opencode — Claude Code does not read `.agents/skills`, and
the others do not read `.claude/skills`, so tell the user which directory their agent got and why
a copy in the other one would be invisible) and then **prints** the MCP server snippet for
it — `.mcp.json`, `~/.codex/config.toml`, `.cursor/mcp.json`, or `opencode.json`. It never writes
an MCP config: paste the snippet yourself, so your other servers survive. The snippet carries
variable NAMES only; the values come from the env file above, so **no shell exports are needed**.

**Claude Code plugin.** Same story: the plugin-launched server reads `./.env.pmp`,
`$PMP_ENV_FILE`, or `~/.config/pmp-mcp/.env.pmp`. If the plugin shows only "Connection closed",
run `pmp-mcp` by hand in a terminal — the host hides the server's stderr, which names the file it
loaded and the reason it refused.

## 6. Then connect

At initialize the server sends its own operating doctrine: error kinds, recovery-by-flow, latches,
denominations, guardrails. **Read that doctrine; it is the authority, not this skill.** Confirm
with `get_status`, which moves nothing. Its `identity` carries the Polygon trading address only;
the Starknet pool identity comes from `get_pool_identity`. Call one, not both — showing both in
one message (or one transcript) links them, and that unlinkability is what the pool is for.

Three settings decide what the server will do at all:

- `PMP_MAX_ORDER_USDC` — per-order notional cap. **Unset refuses every order tool**; it does not
  mean "no limit". Start small.
- `PMP_ALLOWED_MARKETS` — optional token-id allowlist. Unset permits every market, and it gates
  entries only, never exits.
- `PMP_ALLOWED_DESTINATIONS` — payout allowlist for `cash_out`. **Unset refuses every fresh
  exit**; a change needs a restart. Name it before the user asks to withdraw, not after.
- `PMP_WALLET_INDEX_FLOOR` — optional next-index **floor**. Leave it unset: the first
  `fund_wallet` reconstructs the used indices from chain and starts at 0 when nothing is used.
  Setting it **skips that scan**, so use it only to vouch for an identity that funded wallets
  outside this store, above every index it used. If the scan cannot complete, `fund_wallet`
  refuses `SEED_SCAN_REQUIRED` rather than guessing — retry, do not work around it.
  (`PMP_WALLET_INDEX` is the deprecated alias.)

## 7. Fund the trading identity — ASK, before any trading talk

`get_status` green does not mean funded. Say this next, with the real address, and do not go
looking for markets until the user answers:

> Send **native USDC on Polygon (chain 137, token `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`)**
> to `<identity.evmAddress from get_status>` — that exact address, that exact token (USDC.e is a
> different contract and will not be seen), and Polygon is the only source chain this server
> deposits from. Send **at least $3**: a first market BUY has to clear the CLOB's $1 marketable
> minimum, `plan_funding` adds the CCTP forward fee and the market taker fee on top of the bet
> (~$0.20 on a $1.50 bet), and the pool takes its own fee. Whatever you send, we deposit **that
> minus 0.20 USDC** — the paymaster keeps that much on the address to pay Polygon gas in USDC.
> Send 10.00 and we deposit 9.80. Tell me when it has landed and I will run `deposit_to_pool`.
>
> One thing first: **back up whatever holds your key** — the `pmp-mcp` keychain entry, or the
> `identity-<id>.key` file `init` named. `init` generated that identity and that is the only copy of its key — no seed phrase, no copy on any
> server. Lose it and you lose whatever is on that address and in the pool behind it. Keep
> `.env.pmp` too: it holds the reference that finds the key.

Then deposit `balance − 0.20`, never the balance: an over-ask refuses
`GASLESS_DEPOSIT_INSUFFICIENT_USDC` and the refusal carries `maxDepositMicro` — re-call with that
number rather than deriving one, and never clamp on the user's behalf without saying so. Gasless
is ON unless `PMP_CIRCLE_PAYMASTER_ENABLED` is turned off, and off it refuses
`DEPOSIT_PROVIDER_UNAVAILABLE` (deposit from the web app instead). The pool side is bounded by
`PMP_MAX_POOL_BALANCE`. 0.20 is the Polygon default reserve, not a constant, and `plan_funding`
is the only authority on the bridge fee — quote neither as exact.

## Cashing out

The `cash_out` tool description is the authority — read it. Two things belong here because they
are CONFIGURATION: `PMP_ALLOWED_DESTINATIONS` must list the payout address before any fresh
exit (unset, `cash_out` refuses every one), and it lives in `.env.pmp`, so adding an address
needs a **restart** — tell the user up front rather than failing late. And "send my balance" is
a maximum the server computes: the refusal carries `fullExitMicro`, so re-call with it instead
of asking the user for a number. Do call `plan_cash_out` first — `amountMicro` is the pool
DEBIT, so it is the only place the fees and what actually arrives are readable — and state both
figures in one line as you execute, never as a question.

## How to ask for consent — ONCE, for a plan

Ask for one approval covering the whole plan, then execute every leg of it without stopping to
ask again. State in one message: how much to deposit, the market and side, the order size, and
the exit. Get one yes, then run it — deposit -> get_job, fund/buy -> get_job, and the exit if
the plan named one. Report as you go; do not turn a report into a permission question.

Re-ask ONLY when: you are deviating from the approved plan (different market, bigger size, an
extra leg), a leg refuses or trips a latch in a way that changes the plan, or the plan would
exceed a budget the user stated. `PMP_MAX_ORDER_USDC` already bounds every single order, so a
per-leg confirmation buys nothing and turns one trade into six prompts.

## When a start still refuses

**"Connection closed" or a connect timeout — STOP AND HAND IT BACK.** The host hides the
server's stderr, and that stderr is the whole answer. Do **not** read or disassemble the
plugin's source or `dist/`, `~/.claude.json`, MCP host config, or any other file on this
machine: none of them contain the failure, and the user's files are not yours to search. Ask
the user to run, in a terminal, in the directory they start their agent from:

```
pmp-mcp check
pmp-mcp                 # Ctrl-C after a few seconds
```

and paste the output. Then stop and wait for it. The first line of `pmp-mcp` names the env file
it loaded, or `no env file`.

**A locked OS keychain** no longer hangs: `pmp-mcp` gives up after 5s and prints one stderr line
saying so. Tell the user to unlock their keychain (on macOS, answer the "node wants to access
pmp-mcp" prompt with Always Allow), or to re-run `pmp-mcp init --key-store file` in a fresh
directory to keep the key in a 0600 file instead.

The server prints one line naming the variable and exits non-zero. Fix that variable and re-run
`pmp-mcp check`. Do not work around a refusal, and do not restart hoping it takes — a refusal is
a configuration fact. A refusal about value already in motion is a recovery question, not a
configuration one: read `get_status` first.

## 8. Next

Finding something to trade: the `explore-markets` skill. Sizing one: `plan-betting-strategy`.
If your client lists MCP prompts, the server's `trade` prompt is the canonical playbook for a
first order and `recover` for anything already in flight; if it does not, drive the tools
directly and read `get_status` between legs.
