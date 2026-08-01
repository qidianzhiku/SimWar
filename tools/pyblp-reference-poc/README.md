# PyBLP Reference POC

This directory is an isolated, reviewable numerical reference tool for Program M M1. It is not imported by SimWar's Node runtime, does not register a model, and cannot read or write Courses, Runs, Decisions, `state_true`, Settlement, Score, Rank, ParameterSet, ModelVersion, Replay, or classroom stores.

The tool accepts synthetic canonical case inputs, solves a deterministic PyBLP logit reference problem, and emits a schema-aligned, closed-object artifact with numerical diagnostics and a no-write sentinel. The executable validator mirrors the checked-in JSON Schema's closed-object policy; frozen-reference tests separately prove numerical agreement. `reference_cases/expected/` is generated only with an explicit freeze command.

## Use

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
.\.venv\Scripts\python.exe scripts\run_reference.py reference_cases\inputs\case-01.json --output outputs\case-01.json
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

To deliberately refresh checked-in expected artifacts after reviewing numerical output:

```powershell
.\.venv\Scripts\python.exe scripts\freeze_expected.py --accept-pyblp-1.2.0 --replace
```

## Boundaries

- Inputs contain synthetic market and product data only.
- The deterministic index functions are sufficient only for this synthetic numerical POC. They are not economic instrument evidence, calibration evidence, or a production identification strategy.
- The solver fails closed on non-convergence, reported warnings, under-identification, or rank-deficient synthetic instruments. The digest is self-integrity only; numerical authenticity is established by comparison with reviewed frozen references.
- `PYBLP_REFERENCE_POC` is not a production dependency and has no fallback into classroom runtime.
- The output sentinel proves only that the input artifact was not overwritten by this process; it does not prove durable recovery, calibration, or runtime activation.
- `requirements.lock` is version-pinned but does not contain distribution hashes. The SBOM is an inventory, not a complete license attestation or dependency provenance record.
- Remove the directory and its isolated virtual environment to remove this POC. No migration is required.
