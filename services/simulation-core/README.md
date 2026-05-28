# Simulation Core

`services/simulation-core` contains the structured truth-engine boundary used by the API settlement service.

Phase 2 starts with a TypeScript engine adapter so the monorepo can keep contract, API, replay, and UI flows in one local loop. The current adapter is `toy_logit_wellness_v1`, split across:

- `src/market.ts`
- `src/operations.ts`
- `src/finance.ts`
- `src/scoring.ts`
- `src/wellness-plugin.ts`
- `src/wellness-parameters.ts`

`wellnessPluginV1` publishes a manifest and implements the four allowed hooks: `adjustDemand`, `adjustOperations`, `adjustFinance`, and `adjustScore`. New industry plugins should register a `SettlementPlugin` adapter and manifest through the plugin registry instead of modifying the engine main flow.

Future Python or external engines must implement the same `SettlementEngine` boundary and keep L1-L3 truth writes inside the structured core/plugin path. No LLM or Agent service may write settlement truth fields.
