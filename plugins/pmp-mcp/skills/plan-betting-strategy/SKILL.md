---
name: plan-betting-strategy
description: Use when sizing, splitting, or staging a bet under the per-order cap — how much per order — while planning a Polymarket position through pmp-mcp, including how to split a position across orders under the operator's cap, and what to check before and after each leg. Covers PMP_MAX_ORDER_USDC, order outcomes, and when to stop.
---

# Plan a betting strategy

A plan on this server is a sequence of bounded legs, each with a read that decides whether the
next one is safe. It is not a forecast and it is not advice.

## Which skill

This one **sizes and stages a position** once a market is chosen and the pool is funded.

| The user wants | Skill |
| --- | --- |
| To set the server up, or add money to the pool | `pmp-mcp-quickstart` |
| A market to trade, or one market's price/tick/minimum | `explore-markets` |
| A script or bot against the SDK instead of these tools | `write-trading-bot` |

No market yet? `explore-markets` first — a plan needs a real tokenId, a real tick size and a
real minimum, never an assumed one.

## Say what this is not

Never present a plan as a guarantee, an expected return, or a recommendation to bet. A market
price is a probability, not a prediction, and a plan that "wins" only in the branch you assumed
is not a plan. State the assumption, what would falsify it, and the maximum loss — on a
prediction market, the full stake on a losing outcome.

## Bound every order before you plan the sequence

`PMP_MAX_ORDER_USDC` is the operator's per-order notional cap. It **refuses**, it does not
clamp, and unset refuses every order tool rather than meaning "no limit". So:

- Size each order under the cap with room to spare — a market buy's notional is `amountUsdc`, a
  limit's is `price * size`.
- A position larger than the cap becomes SEVERAL orders. Say how many and at what size; never
  propose one order the cap will refuse and then plan the retry.
- The pool withdrawal that funds a slot counts as staked notional and is bounded by the same
  cap, so a plan that funds once and buys three times needs the funding leg under it too.
- `PMP_ALLOWED_MARKETS`, when set, refuses token ids outside the list — entries only.

The server's own doctrine (sent at initialize) holds the authoritative table of which tool is
gated on what. Read it there rather than assuming from this list.

## Get the sizing inputs from the quote, not the search row

`get_market_quote` on the exact `tokenId`: `tickSize` is the grid a limit price must sit on,
`minOrderSize` is the limit share floor, and `bestBidPrice`/`bestAskPrice` are the live top of
book. A `search_markets` result's price is a snapshot and the wrong input to a slippage floor.

## How to ask for consent — ONCE, for a plan

Ask for one approval covering the whole plan, then execute every leg of it without stopping to
ask again. State in one message: how much to deposit, the market and side, the order size, and
the exit. Get one yes, then run it — deposit -> get_job, fund/buy -> get_job, and the exit if
the plan named one. Report as you go; do not turn a report into a permission question.

Re-ask ONLY when: you are deviating from the approved plan (different market, bigger size, an
extra leg), a leg refuses or trips a latch in a way that changes the plan, or the plan would
exceed a budget the user stated. `PMP_MAX_ORDER_USDC` already bounds every single order, so a
per-leg confirmation buys nothing and turns one trade into six prompts.

## Structure of a plan

1. `get_status`. If `pendingFlows` is non-empty, the plan stops here: value is already in
   motion. Continue that flow — the `recover` prompt if your client lists MCP prompts, otherwise
   `get_job` on the named flow and the one continuation the server's doctrine gives it.
2. State the thesis, the stake, and the per-order size that fits under the cap.
3. For each leg, name the tool, the arguments (including `slot.accountIndex`), and **the read
   that confirms it before the next leg starts**.
4. State the exit before the entry: which outcome resolves it, and whether the exit is a sell
   (market still open) or a redeem (market resolved). The `close-out` prompt drives that where
   prompts are available; `sell_position` and `redeem_position` are the tools underneath.

## After each order: accepted is not filled

A CLOB success is not a fill. Read the job's outcome kind — only `filled` bought shares;
`resting` locked collateral on the book, and `unmatched-killed` moved nothing while the funding
still left the pool. **Never plan the next leg on an order you have only seen accepted**, and
never report one to the user as a purchase.

## When a leg errors, branch on the doctrine, not on the plan

Every refusal carries a `kind`. The server doctrine's ERROR KINDS block is the authority on what
each means and which is the only retryable one — read it there; do not re-derive it, and do not
let the plan's momentum choose the branch. A leg whose outcome is unknown is never a failure and
never a blind retry: re-read state, then take the one continuation the doctrine names for that
flow. "Retry on error" is wrong for four of the five kinds.

## Stop conditions, written down before the first order

- The cap refuses a leg ⇒ the plan was mis-sized. Re-size; do not raise the cap.
- Any pending flow appears ⇒ stop, `recover`.
- An unknown-state or funds-in-flight kind ⇒ stop planning, read state.
- The thesis is falsified ⇒ exit via `close-out`; do not average down to rescue it.

## Then

The market: `explore-markets`. Executing a leg: the `trade` prompt where prompts are listed,
otherwise the order tools with a `get_status` read between legs. Getting out: `close-out`, or
`sell_position` / `redeem_position` directly.
