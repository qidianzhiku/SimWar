from __future__ import annotations

import argparse
import json
from pathlib import Path

from .canonical import load_json, write_json
from .errors import ReferencePocError
from .runner import run_reference_case


def main() -> int:
    parser = argparse.ArgumentParser(description="Run one synthetic PyBLP reference case.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        output = run_reference_case(load_json(Path(args.input)))
        write_json(Path(args.output), output)
    except (ReferencePocError, ValueError) as error:
        print(json.dumps({"code": "REFERENCE_POC_ERROR", "message": str(error)}, sort_keys=True))
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
