from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pyblp_reference_poc.canonical import load_json  # noqa: E402
from pyblp_reference_poc.runner import run_reference_case  # noqa: E402

ABS_TOL = 1e-9
REL_TOL = 1e-9


def assert_equivalent(test_case: unittest.TestCase, expected: Any, actual: Any, path: str = "output") -> None:
    if isinstance(expected, float):
        test_case.assertIsInstance(actual, (int, float), path)
        test_case.assertTrue(math.isclose(expected, float(actual), abs_tol=ABS_TOL, rel_tol=REL_TOL), path)
    elif isinstance(expected, list):
        test_case.assertIsInstance(actual, list, path)
        test_case.assertEqual(len(expected), len(actual), path)
        for index, (expected_item, actual_item) in enumerate(zip(expected, actual, strict=True)):
            assert_equivalent(test_case, expected_item, actual_item, f"{path}[{index}]")
    elif isinstance(expected, dict):
        test_case.assertIsInstance(actual, dict, path)
        test_case.assertEqual(set(expected), set(actual), path)
        for key in expected:
            assert_equivalent(test_case, expected[key], actual[key], f"{path}.{key}")
    else:
        test_case.assertEqual(expected, actual, path)


class ReferenceCaseTests(unittest.TestCase):
    def test_all_frozen_reference_cases(self) -> None:
        for input_path in sorted((ROOT / "reference_cases" / "inputs").glob("case-*.json")):
            with self.subTest(case=input_path.stem):
                expected = load_json(ROOT / "reference_cases" / "expected" / input_path.name)
                actual = run_reference_case(load_json(input_path))
                assert_equivalent(self, expected, actual)
