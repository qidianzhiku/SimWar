# Simulation Core

`services/simulation-core` is reserved for the structured truth engine.

Phase 0 keeps this service as a boundary placeholder because the current local environment does not expose a Python runtime. The target stack remains Python 3.11 for L1-L3 settlement, replayable calculations, and parameter-governed truth writes.

Until the Python service is initialized, no LLM or Agent service may write settlement truth fields. See `AGENTS.md` and `docs/devops/tech-stack.md`.
