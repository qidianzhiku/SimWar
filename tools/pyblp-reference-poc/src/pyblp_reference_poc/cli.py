from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from .canonical import load_json
from .contracts import validate_output
from .errors import ReferencePocError

POC_ROOT = Path(__file__).resolve().parents[2]
INPUT_ROOT = POC_ROOT / "reference_cases" / "inputs"
OUTPUT_ROOT = POC_ROOT / "outputs"


def _resolve_input(argument: str) -> Path:
    candidate = Path(argument).resolve()
    if INPUT_ROOT not in candidate.parents:
        raise ReferencePocError("input must be a checked-in synthetic reference case")
    return candidate


def _resolve_output(argument: str | None, input_path: Path) -> Path:
    candidate = (Path(argument) if argument else OUTPUT_ROOT / f"{input_path.stem}.json").resolve()
    if OUTPUT_ROOT not in candidate.parents:
        raise ReferencePocError("output must remain under the POC output root")
    return candidate


def run_cli(input_argument: str, output_argument: str | None = None) -> dict[str, object]:
    input_path = _resolve_input(input_argument)
    output_path = _resolve_output(output_argument, input_path)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    trusted_source = str(POC_ROOT / "src")
    environment = {"PYTHONPATH": trusted_source, "PYTHONNOUSERSITE": "1"}
    with tempfile.TemporaryDirectory(prefix="worker-", dir=OUTPUT_ROOT) as worker_cwd:
        completed = subprocess.run(
            [sys.executable, "-m", "pyblp_reference_poc.worker", "--input", str(input_path), "--output", str(output_path)],
            capture_output=True,
            cwd=worker_cwd,
            env=environment,
            text=True,
            timeout=30,
            check=False,
        )
    if completed.returncode:
        try:
            detail = json.loads(completed.stdout)
        except json.JSONDecodeError:
            detail = {"code": "REFERENCE_POC_WORKER_FAILURE", "message": completed.stderr.strip() or "worker failed"}
        raise ReferencePocError(str(detail.get("message", "worker failed")))
    output = load_json(output_path)
    validate_output(output, load_json(input_path))
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Run an isolated synthetic PyBLP reference POC case.")
    parser.add_argument("input")
    parser.add_argument("--output")
    args = parser.parse_args()
    try:
        result = run_cli(args.input, args.output)
    except (ReferencePocError, ValueError, subprocess.TimeoutExpired) as error:
        print(json.dumps({"code": "REFERENCE_POC_ERROR", "message": str(error)}, sort_keys=True))
        return 2
    print(json.dumps({"artifact_digest": result["artifact_digest"], "case_id": result["case_id"], "status": "PASS"}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
