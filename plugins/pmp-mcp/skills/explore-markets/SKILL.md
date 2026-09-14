---
name: explore-markets
description: Use when finding a Polymarket market to trade, comparing outcomes, or reading a market's price, liquidity, tick size, or minimum order size through the pmp-mcp server. Covers search_markets, get_market_quote, and handing a tokenId to the trade prompt.
---

# Explore markets

Discovery on `pmp-mcp` is two read-only tools. They move no funds and no guardrail applies, so
exploring freely is safe — the cost of a mistake here is a bad order later.

## Which skill

This one **finds a market and reads its constraints**. It moves nothing and stakes nothing.

| The user wants | Skill |
| --- | --- |
| To set the server up, or add money to the pool | `pmp-mcp-quickstart` |
| How much to stake, split across orders, and the exit | `plan-betting-strategy` |
| A script or bot against the SDK instead of these tools | `write-trading-bot` |

If `get_status` shows an empty pool, stop and route to `pmp-mcp-quickstart` — a market is no
use until there is something to bet with.

## Never hand-roll the HTTP call

`search_markets` and `get_market_quote` are the supported path. Do not `curl` or `fetch`
`gamma-api.polymarket.com` or `clob.polymarket.com` yourself, and do not write a script to do
it: the tools already parse the index-aligned outcome/price/token arrays Gamma returns as JSON
strings, and drop markets with no orderable token. A hand-rolled call gets that pairing wrong
quietly, and a mis-paired tokenId buys the other side.

If `search_markets` is not among your tools, the pmp-mcp server is not connected. Stop and say
so — point the user at the `pmp-mcp-quickstart` skill (`pmp-mcp check`). Do not substitute a web
search or any other source: a tokenId found that way cannot be handed to the trade step.

## The sequence

1. **`search_markets`** with the user's words: `{"query": "fed rate cut", "limit": 5}`. Keep
   `limit` small — default 10, maximum 25. Each row carries the question, slug, conditionId,
   endDate, the `negRisk` flag, and one entry per orderable outcome with its `tokenId` and last
   price.
2. **Pick the outcome, not the market.** An order is placed on a `tokenId` and every market has
   at least two. Say in words which outcome you chose and at what price before going further.
3. **`get_market_quote`** on that `tokenId` — the live book; the search price is a snapshot.
   - `tickSize` — the price grid. An off-grid limit price is rejected.
   - `minOrderSize` — the share floor for a LIMIT order.
   - `bestBidPrice` / `bestAskPrice` — top of book. **`null` means that side is empty; absent
     means the book was not parsed, which is not the same as no liquidity.** Neither is a price
     you may treat as zero.
   - `negRisk` — carry the quote's value, not the search row's, into the order.
4. **Hand off — do not order from here.** Carry the `tokenId` and `negRisk` forward. If your
   client lists MCP prompts, the server's `trade` prompt is the canonical playbook for the
   funding and the order (in Claude Code: `/pmp-mcp:trade`). If it does not, hand them to the
   `plan-betting-strategy` skill instead and let it size the legs. Either way, do not call
   `place_order` or `buy_privately` straight out of this skill.

## Reporting a market to a person

Prices are probabilities: `0.62` is "the market says 62%", not "$0.62 of value". Name the
outcome label with the price — "Yes at 62¢" is useless when there are five candidates. Give the
`endDate`; an hour out is a different proposition from a year out. If `active` is false, say so
and stop rather than sizing an order on it.

## Empty and failed searches are different answers

An empty list means nothing matched — try other words or a broader query. A refusal with an
unknown-state code means the search itself failed; the tool never reports a failed read as "no
markets". The refusal's `code` and `kind` say which; the server's own doctrine (sent at
initialize) and each tool's description hold the error-kind rules — read them there before
retrying anything, and never retry on the strength of this skill alone.

## Then

Sizing: the `plan-betting-strategy` skill. Buying: the `trade` prompt if your client lists MCP
prompts, otherwise `plan-betting-strategy` then the order tools directly. If the user wants to
browse rather than search, say so — this server has no market-list tool.
