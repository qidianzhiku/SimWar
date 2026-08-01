from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pyblp_reference_poc.canonical import sha256_digest  # noqa: E402


class CanonicalTests(unittest.TestCase):
    def test_input_digest_preserves_distinct_finite_float_values(self) -> None:
        self.assertNotEqual(sha256_digest({"value": 1.0000000000001}), sha256_digest({"value": 1.0000000000002}))

    def test_non_finite_float_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            sha256_digest({"value": math.nan})
