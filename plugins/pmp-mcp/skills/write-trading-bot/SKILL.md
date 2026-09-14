---
name: write-trading-bot
description: Use when writing a script, bot, or automation that trades Polymarket through @starkware-libs/pmp-trading-core rather than through the pmp-mcp MCP tools — client setup, storage and resume, error classification, fail-closed behaviour, and key hygiene.
---

# Write a trading bot

A bot is the same value path as the MCP server with no human in the loop, so every invariant the
server enforces you now enforce yourself. Use the library directly; do not shell out to
`pmp-mcp` and scrape its JSON-RPC.

`references/trading-core-api.md` lists the public surface. Import from the package barrel only.

## Which skill

This one is for **code against `@starkware-libs/pmp-trading-core`**, not for driving the MCP
tools in a conversation.

| The user wants | Skill |
| --- | --- |
| To set the server up, or add money to the pool | `pmp-mcp-quickstart` |
| A market to trade, or one market's price/tick/minimum | `explore-markets` |
| How much to stake, split across orders, and the exit | `plan-betting-strategy` |

The env names, the two infrastructure profiles and the funding path are the quickstart's, not
this skill's — read it rather than restating it here.

## Skeleton

```ts
import { createTradingClient, openFileStorage } from '@starkware-libs/pmp-trading-core';

const client = await createTradingClient({
  identity: { kind: 'evm-private-key', privateKey: process.env.BOT_KEY as `0x${string}` },
  storage: openFileStorage(process.env.BOT_STORAGE_DIR!),
  env: process.env,
});
try {
  // reads, then flows
} finally {
  client.close();
}
```

Three things that skeleton is load-bearing about:

- **File-backed storage, never in-memory.** The store holds the burn cursors; in-memory turns
  every restart into a possible second burn.
- **`close()` in a `finally`.** It releases the dir lock; a bare exit leaves a lockfile the next
  open must reclaim from a dead pid.
- **The key comes from the environment and stays in memory.** Never log it, persist it, commit
  it in a config file, or include it in an error report. Same for the builder credentials and
  the paymaster key.

## Start every run with the reads

`getPoolBalance()` and `pendingFlows()` before anything that moves value. A non-empty
`pendingFlows()` means the previous run left value in motion: **continue that flow, do not start
a new one.** Which continuation applies depends on the flow — the server doctrine's
`RECOVERY BY FLOW` block is the authority (each flow continues exactly one way, and `resume` is
not the universal answer). Encode that mapping once, from the doctrine, and branch on the cursor.

## Fail closed on unknown state

- A read that throws is **unknown**, not zero. Never `?? 0n` a failed balance read into a
  decision: that turns an RPC outage into "the funds are gone".
- A flow whose outcome is unknown must **not** be retried. Re-read state and continue the one
  documented way. A blind re-call of a burn-carrying flow is a second burn, and idempotency
  elsewhere does not make it safe.
- A submit with no transaction hash or an unknown status is never re-submitted.
- Classify on the error's `kind`, walking the cause chain — each wrapping layer builds a new
  error, so the outer `kind` can be undefined exactly when it matters. Never match on message
  text.

## Accepted is not filled

Gate downstream value movement on the outcome kind: only `filled` bought shares, only `sold`
gave up shares. A resting GTC limit is a legitimate non-fill rather than an error — but it has
bought nothing either, and a bot that assumes a fill sizes its next leg against shares it does
not hold.

## Bound the bot yourself

The server's caps come from the operator's env; a library caller has none. Put an explicit
per-order notional ceiling in the bot and **refuse** above it rather than clamping — clamping
hides a mis-sized signal. Take the ceiling from configuration, not a literal in the loop.

## Testing

Keep the value path in pure functions testable offline: sizing, cursor classification, error
branching. Use `@starkware-libs/pmp-trading-core/testing` for the seams. Live legs (CCTP
attestation, the CLOB, a pUSD wrap) cannot be exercised offline — name that boundary rather than
asserting past it.

## Then

Interactive trading instead of a bot: `explore-markets`, plus the `trade` prompt if your client
lists MCP prompts. Configuring or installing the server: `pmp-mcp-quickstart`.
