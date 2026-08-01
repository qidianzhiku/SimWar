from __future__ import annotations

import sys
import unittest
import warnings
from pathlib import Path
from types import SimpleNamespace

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from pyblp_reference_poc.errors import ReferencePocError  # noqa: E402
from pyblp_reference_poc.runner import _captured_warning_messages, _fail_closed_diagnostics  # noqa: E402


def _problem(*, parameter_count: int = 2, demand_moment_count: int = 3, instruments: list[list[float]] | None = None):
    return SimpleNamespace(
        K1=parameter_count,
        MD=demand_moment_count,
        products=SimpleNamespace(ZD=np.asarray(instruments or [[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])),
    )


def _solved(*, converged: bool = True):
    return SimpleNamespace(converged=converged, beta=np.asarray([[0.0], [-1.0]]))


class RunnerDiagnosticsTests(unittest.TestCase):
    def test_non_convergence_is_rejected(self) -> None:
        with self.assertRaises(ReferencePocError):
            _fail_closed_diagnostics(_problem(), _solved(converged=False), "", [])

    def test_solver_message_warning_is_rejected(self) -> None:
        with self.assertRaises(ReferencePocError):
            _fail_closed_diagnostics(_problem(), _solved(), "Warning: synthetic diagnostic", [])

    def test_captured_python_warning_is_rejected(self) -> None:
        with warnings.catch_warnings(record=True) as captured:
            warnings.simplefilter("always")
            warnings.warn("synthetic runtime warning", RuntimeWarning)
        with self.assertRaises(ReferencePocError):
            _fail_closed_diagnostics(_problem(), _solved(), "", _captured_warning_messages(captured))

    def test_under_identification_and_rank_deficiency_are_rejected(self) -> None:
        with self.assertRaises(ReferencePocError):
            _fail_closed_diagnostics(_problem(parameter_count=3, demand_moment_count=2), _solved(), "", [])
        with self.assertRaises(ReferencePocError):
            _fail_closed_diagnostics(
                _problem(instruments=[[1.0, 1.0], [2.0, 2.0], [3.0, 3.0]]), _solved(), "", []
            )
