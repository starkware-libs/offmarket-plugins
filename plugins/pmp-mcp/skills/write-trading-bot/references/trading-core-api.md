# trading-core public surface

Import only from the barrel `@starkware-libs/pmp-trading-core` (and
`@starkware-libs/pmp-trading-core/testing` in tests). Reaching into `dist/` internals is not a
supported API. Verify any name here against the package's own `index.ts` before relying on it.

## Entry point

- `createTradingClient(options: CreateClientOptions): Promise<TradingClient>` — one identity,
  one store. `TradingClient` carries `evmAddress`, `starknetAddress`, the read methods, the
  flow methods, and `close()`. `CreateClientOptions` is `{ identity, storage, infrastructure,
  env?, logger?, seedWalletIndex?, operationalConfig? }` — `infrastructure` is REQUIRED, one
  complete `TradingInfrastructure` profile (below); there is no default and no fallback between
  profiles.
- `openFileStorage(dir)` — the durable store. File-backed, never in-memory: it holds the burn
  cursors that stand between a restart and a second burn. `close()` releases its dir lock.
- `configFromEnv(env)` / `TradingConfig` — config resolution.
- `walletIndexFloor(n)` / `SeedWalletIndex` — the next-index floor; unset makes funding refuse
  `SEED_SCAN_REQUIRED` rather than allocating an unscanned index.

## Infrastructure

`TradingInfrastructure` (`infrastructure/types.ts`) is a discriminated union — pass exactly one:

```ts
// managed — an Offmarket API key, no operator-owned endpoint or secret
{ mode: 'managed', apiKey: 'pmp_live_…', gatewayUrl?: string, timeoutMs?: number }

// local — every endpoint and secret is the operator's own
{
  mode: 'local',
  endpoints: {
    starknetRpc: string, polygonRpc?: string, polygonBundler?: string,
    prover: string, indexer: string, avnuPaymaster?: string,
  },
  credentials: { avnuPaymasterApiKey: string, builder?: { key, secret, passphrase } },
  timeoutMs?: number,
}
```

Managed derives one `<gateway>/<apiKey>/<route>` URL per capability (the key is a URL path
segment, never a header); `resolveInfrastructure`/`createTradingClient` redact it from any
thrown error. `timeoutMs` reaches only the Polygon read client — see the type's own doc comment
for the legs it cannot bound. Mixing local endpoints into a `managed` profile (or vice versa) is
a `TypeScript` type error, and passing both `endpoints`/`credentials` and `apiKey`/`gatewayUrl`
throws at `resolveInfrastructure`. See `packages/mcp-server/README.md` for the env-driven form
(`infrastructureFromEnv`) an MCP host builds this from.

## Reads (a throw is UNKNOWN, never zero)

`getPoolBalance()`, `getDepositWalletBalances(slot)`, `getMarketQuote(tokenId)`,
`searchMarkets({ query, limit })`, `listOpenOrders(slot)`, `listPositions(slots)`,
`pendingFlows()`. Types: `MarketLimits`, `MarketSummary`, `MarketToken`, `SearchMarketsArgs`,
`DepositWalletBalances`, `CtfShares`, `RestingOrder`, `DiscoveredPosition`.

## Flows

`buyPrivately` / `acknowledgeTerminalBuy` (`BuyPrivatelyArgs`, `BuyPrivatelyResult`),
`depositToPool` (`DepositToPoolArgs`), `redeemPosition` (`RedeemOutcome`), `sellPosition`
(`SellRequest`, `SellOutcome`, `SellSizeIntent`), `returnToPool` (`ReturnToPoolResult`),
`resume` (`ResumeDeps`, `ResumeResult`), `classifyReturnCursor` / `readReturnCursor`.
Order types: `PlaceOrderArgs`, `PlaceOrderRequest`, `OrderOutcome`, `FakFillVerification`.

## Errors — classify, never string-match

`TradingError` with an `ErrorKind`; `FundsInFlightError`, `IdentityMismatchError`,
`SingleIdentityError`, `MintUnconfirmedError`, `MintUnacknowledgedError`, `BurnStrandedError`,
`OrderUnacknowledgedError`, `ReturnInFlightError`, `ReturnBurnStrandedError`. Branch on `kind`.

## Denominations

Micro units (integer, 6 decimals) as `bigint` at the flow boundary: `amount`, `spendMicro`,
balances. Whole units as `number`: `amountUsdc`, `price`, `size`, `shares`. Never a float for a
micro amount.
