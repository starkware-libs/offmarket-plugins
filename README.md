# offmarket-plugins

Claude Code plugin marketplace for **Off Market**. Marketplace only — the code ships as the
npm package [`@off-market/pmp-mcp`](https://www.npmjs.com/package/@off-market/pmp-mcp).

## Install

```
claude plugin marketplace add starkware-libs/offmarket-plugins
claude plugin install pmp-mcp@offmarket
```

## Plain CLI alternative

```
npm i -g @off-market/pmp-mcp
pmp-mcp init --managed
```

## Plugin: `pmp-mcp`

Private Polymarket trading over the starknet-privacy pool. Ships these skills:

| Skill | Use when |
| --- | --- |
| `pmp-mcp-quickstart` | Configuring, first run, a refused start, or funding the pool. |
| `explore-markets` | Finding a market, reading its price and order constraints. |
| `plan-betting-strategy` | Sizing/staging a position under the operator's caps. |
| `write-trading-bot` | Scripting against `@starkware-libs/pmp-trading-core` directly. |

Mirrors the private `offmarket` repo's `packages/mcp-server`; refreshed each `pmp-v*` release.
