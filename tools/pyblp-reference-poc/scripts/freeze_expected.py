from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pyblp_reference_poc.canonical import load_json, write_json  # noqa: E402
from pyblp_reference_poc.contracts import PYBLP_VERSION  # noqa: E402
from pyblp_reference_poc.runner import run_reference_case  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Explicitly freeze reviewed synthetic PyBLP reference outputs.")
    parser.add_argument("--accept-pyblp-1.2.0", action="store_true", dest="accept_pyblp_1_2_0")
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    if not args.accept_pyblp_1_2_0 or not args.replace:
        parser.error("expected --accept-pyblp-1.2.0 --replace")
    for input_path in sorted((ROOT / "reference_cases" / "inputs").glob("case-*.json")):
        write_json(ROOT / "reference_cases" / "expected" / input_path.name, run_reference_case(load_json(input_path)))
    print(f"froze reference cases for PyBLP {PYBLP_VERSION}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
