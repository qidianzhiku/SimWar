from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pyblp_reference_poc.canonical import load_json, sha256_digest  # noqa: E402
from pyblp_reference_poc.contracts import validate_output  # noqa: E402
from pyblp_reference_poc.errors import ReferencePocError  # noqa: E402
from pyblp_reference_poc.cli import _resolve_input, _resolve_output  # noqa: E402
from test_reference_cases import assert_equivalent  # noqa: E402


class ContractTests(unittest.TestCase):
    def test_forged_results_with_self_consistent_new_result_artifact_digest_are_rejected(self) -> None:
        input_payload = load_json(ROOT / "reference_cases" / "inputs" / "case-01.json")
        output_payload = load_json(ROOT / "reference_cases" / "expected" / "case-01.json")
        forged = copy.deepcopy(output_payload)
        forged["results"]["markets"][0]["products"][0]["product_id"] = "forged-product"
        forged["artifact_digest"] = sha256_digest({key: value for key, value in forged.items() if key != "artifact_digest"})
        with self.assertRaises(ReferencePocError):
            validate_output(forged, input_payload)

    def test_exact_input_binding_is_required(self) -> None:
        input_payload = load_json(ROOT / "reference_cases" / "inputs" / "case-01.json")
        output_payload = load_json(ROOT / "reference_cases" / "expected" / "case-01.json")
        forged = copy.deepcopy(output_payload)
        forged["case_id"] = "case-other"
        forged["artifact_digest"] = sha256_digest({key: value for key, value in forged.items() if key != "artifact_digest"})
        with self.assertRaises(ReferencePocError):
            validate_output(forged, input_payload)

    def test_closed_input_and_output_objects_reject_unknown_properties(self) -> None:
        input_payload = load_json(ROOT / "reference_cases" / "inputs" / "case-01.json")
        output_payload = load_json(ROOT / "reference_cases" / "expected" / "case-01.json")
        forged_input = copy.deepcopy(input_payload)
        forged_input["unexpected"] = True
        with self.assertRaises(ReferencePocError):
            from pyblp_reference_poc.contracts import validate_input

            validate_input(forged_input)
        forged_output = copy.deepcopy(output_payload)
        forged_output["diagnostics"]["unexpected"] = True
        forged_output["artifact_digest"] = sha256_digest(
            {key: value for key, value in forged_output.items() if key != "artifact_digest"}
        )
        with self.assertRaises(ReferencePocError):
            validate_output(forged_output, input_payload)

    def test_frozen_reference_comparison_rejects_numeric_forgery_with_valid_self_digest(self) -> None:
        expected = load_json(ROOT / "reference_cases" / "expected" / "case-01.json")
        forged = copy.deepcopy(expected)
        forged["results"]["markets"][0]["products"][0]["latent_share"] += 0.1
        forged["artifact_digest"] = sha256_digest({key: value for key, value in forged.items() if key != "artifact_digest"})
        with self.assertRaises(AssertionError):
            assert_equivalent(self, expected, forged)

    def test_cli_rejects_paths_outside_its_synthetic_input_and_output_roots(self) -> None:
        with self.assertRaises(ReferencePocError):
            _resolve_input(str(ROOT / "README.md"))
        with self.assertRaises(ReferencePocError):
            _resolve_output(str(ROOT / "outside.json"), ROOT / "reference_cases" / "inputs" / "case-01.json")
