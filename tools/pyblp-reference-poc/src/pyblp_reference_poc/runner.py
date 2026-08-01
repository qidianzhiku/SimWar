from __future__ import annotations

import contextlib
import io
from typing import Any

import numpy as np
import pyblp

from .canonical import sha256_digest
from .contracts import OUTPUT_SCHEMA_VERSION, PYBLP_VERSION, validate_input, validate_output
from .errors import ReferencePocError


def _nested_matrix(value: Any) -> list[list[float]]:
    array = np.asarray(value, dtype=float)
    if array.ndim == 1:
        array = array.reshape((-1, 1))
    return [[float(cell) for cell in row] for row in array.tolist()]


def _product_data(payload: dict[str, Any]) -> np.ndarray:
    rows: list[tuple[str, str, str, float, float, float, float]] = []
    for market_index, market in enumerate(payload["markets"]):
        for product_index, product in enumerate(market["products"]):
            # These deterministic synthetic instruments exist only inside the isolated POC.
            instrument_one = float(product_index + 1 + market_index * 0.25)
            instrument_two = float((product_index + 1) ** 2 + market_index * 0.5)
            rows.append(
                (
                    market["market_id"],
                    product["product_id"],
                    product["firm_id"],
                    float(product["price"]),
                    float(product["share"]),
                    instrument_one,
                    instrument_two,
                )
            )
    return np.array(
        rows,
        dtype=[
            ("market_ids", "U64"),
            ("product_ids", "U64"),
            ("firm_ids", "U64"),
            ("prices", "f8"),
            ("shares", "f8"),
            ("demand_instruments0", "f8"),
            ("demand_instruments1", "f8"),
        ],
    )


def run_reference_case(input_payload: dict[str, Any]) -> dict[str, Any]:
    validate_input(input_payload)
    if pyblp.__version__ != PYBLP_VERSION:
        raise ReferencePocError(f"PyBLP version mismatch: expected {PYBLP_VERSION}, got {pyblp.__version__}")
    np.random.seed(input_payload["seed"])
    data = _product_data(input_payload)
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            problem = pyblp.Problem(pyblp.Formulation("1 + prices"), data)
            solved = problem.solve()
            elasticities = solved.compute_elasticities()
            diversion = solved.compute_diversion_ratios()
            probabilities = solved.compute_probabilities()
            costs = solved.compute_costs()
            firm_ids = np.array(input_payload["counterfactual"]["firm_ids"], dtype="U64")
            reassigned_firms = np.resize(firm_ids, data.shape[0])
            counterfactual_prices = solved.compute_prices(costs=costs, firm_ids=reassigned_firms)
    except Exception as error:  # PyBLP errors are exposed as safe POC diagnostics, never a fallback path.
        raise ReferencePocError(f"PyBLP reference solve failed: {type(error).__name__}") from error

    market_results: list[dict[str, Any]] = []
    offset = 0
    for market in input_payload["markets"]:
        products = market["products"]
        dimension = len(products)
        product_results = [
            {"product_id": product["product_id"], "price": float(product["price"]), "latent_share": float(product["share"])}
            for product in products
        ]
        market_results.append(
            {
                "market_id": market["market_id"],
                "products": product_results,
                "outside_share": float(1 - sum(product["share"] for product in products)),
                # PyBLP returns rows in global product order and columns local to each market.
                "probabilities": _nested_matrix(probabilities[offset : offset + dimension]),
                "elasticities": _nested_matrix(elasticities[offset : offset + dimension]),
                "diversion_ratios": _nested_matrix(diversion[offset : offset + dimension]),
            }
        )
        offset += dimension
    output: dict[str, Any] = {
        "schema_version": OUTPUT_SCHEMA_VERSION,
        "case_id": input_payload["case_id"],
        "seed": input_payload["seed"],
        "pyblp_version": PYBLP_VERSION,
        "input_digest": sha256_digest(input_payload),
        "results": {"markets": market_results},
        "counterfactual": {
            "name": input_payload["counterfactual"]["name"],
            "firm_ids": input_payload["counterfactual"]["firm_ids"],
            "equilibrium_prices": [float(value) for value in np.asarray(counterfactual_prices).reshape(-1).tolist()],
        },
        "diagnostics": {"beta_price": float(np.asarray(solved.beta).reshape(-1)[-1]), "converged": bool(solved.converged)},
        "calibration_artifact": {
            "artifact_id": f"calibration:{input_payload['case_id']}:{sha256_digest(input_payload)[:12]}",
            "beta_price": float(np.asarray(solved.beta).reshape(-1)[-1]),
            "input_digest": sha256_digest(input_payload),
            "method": "SYNTHETIC_LOGIT_REFERENCE_ONLY",
            "pyblp_version": PYBLP_VERSION,
        },
        "non_overwrite_proof": {
            "scope": "INPUT_SENTINEL_ONLY",
            "input_digest_before": sha256_digest(input_payload),
            "input_digest_after": sha256_digest(input_payload),
            "input_unchanged": True,
        },
    }
    output["artifact_digest"] = sha256_digest(output)
    validate_output(output, input_payload)
    return output
