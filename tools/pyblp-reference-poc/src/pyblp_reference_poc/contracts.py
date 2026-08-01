from __future__ import annotations

import math
from typing import Any

from .canonical import sha256_digest
from .errors import ReferencePocError

INPUT_SCHEMA_VERSION = "m1-pyblp-reference-input.v1"
OUTPUT_SCHEMA_VERSION = "m1-pyblp-reference-output.v1"
PYBLP_VERSION = "1.2.0"


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ReferencePocError(message)


def _number(value: Any, label: str) -> float:
    _require(isinstance(value, (int, float)) and not isinstance(value, bool), f"{label} must be a finite number")
    numeric = float(value)
    _require(math.isfinite(numeric), f"{label} must be a finite number")
    return numeric


def _matrix(value: Any, label: str, rows: int, columns: int | None = None) -> None:
    expected_columns = columns if columns is not None else rows
    _require(isinstance(value, list) and len(value) == rows, f"{label} must have {rows} rows")
    for row_index, row in enumerate(value):
        _require(isinstance(row, list) and len(row) == expected_columns, f"{label}[{row_index}] has an invalid dimension")
        for column_index, cell in enumerate(row):
            _number(cell, f"{label}[{row_index}][{column_index}]")


def validate_input(payload: dict[str, Any]) -> None:
    _require(isinstance(payload, dict), "input must be an object")
    _require(
        set(payload) == {"schema_version", "case_id", "seed", "pyblp_version", "markets", "counterfactual"},
        "input contains unsupported properties",
    )
    _require(payload.get("schema_version") == INPUT_SCHEMA_VERSION, "unsupported input schema_version")
    _require(isinstance(payload.get("case_id"), str) and payload["case_id"], "case_id is required")
    _require(isinstance(payload.get("seed"), int) and not isinstance(payload["seed"], bool), "seed must be an integer")
    _require(payload.get("pyblp_version") == PYBLP_VERSION, "input must pin PyBLP 1.2.0")
    markets = payload.get("markets")
    _require(isinstance(markets, list) and markets, "markets must be a non-empty list")
    market_ids: set[str] = set()
    product_ids: set[str] = set()
    for market in markets:
        _require(isinstance(market, dict), "market must be an object")
        _require(set(market) == {"market_id", "products"}, "market contains unsupported properties")
        market_id = market.get("market_id")
        _require(isinstance(market_id, str) and market_id and market_id not in market_ids, "market_id must be unique")
        market_ids.add(market_id)
        products = market.get("products")
        _require(isinstance(products, list) and len(products) >= 2, f"market {market_id} needs at least two products")
        share_total = 0.0
        for product in products:
            _require(isinstance(product, dict), "product must be an object")
            _require(set(product) == {"product_id", "firm_id", "price", "share"}, "product contains unsupported properties")
            product_id = product.get("product_id")
            _require(isinstance(product_id, str) and product_id and product_id not in product_ids, "product_id must be globally unique")
            product_ids.add(product_id)
            _require(isinstance(product.get("firm_id"), str) and product["firm_id"], "firm_id is required")
            _number(product.get("price"), f"price for {product_id}")
            share = _number(product.get("share"), f"share for {product_id}")
            _require(0 < share < 1, f"share for {product_id} must be in (0, 1)")
            share_total += share
        _require(share_total < 1, f"market {market_id} has no positive outside share")
    counterfactual = payload.get("counterfactual")
    _require(isinstance(counterfactual, dict), "counterfactual is required")
    _require(set(counterfactual) == {"name", "firm_ids"}, "counterfactual contains unsupported properties")
    _require(isinstance(counterfactual.get("name"), str) and counterfactual["name"], "counterfactual.name is required")
    firm_ids = counterfactual.get("firm_ids")
    _require(
        isinstance(firm_ids, list) and len(firm_ids) == 1 and all(isinstance(item, str) and item for item in firm_ids),
        "counterfactual.firm_ids must contain exactly one synthetic merged-firm id",
    )
    _require(set(firm_ids).issubset({product["firm_id"] for market in markets for product in market["products"]}), "counterfactual refers to an unknown firm")


def expected_input_binding(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "case_id": payload["case_id"],
        "input_digest": sha256_digest(payload),
        "market_ids": [market["market_id"] for market in payload["markets"]],
        "product_ids": [product["product_id"] for market in payload["markets"] for product in market["products"]],
        "counterfactual": {"firm_ids": payload["counterfactual"]["firm_ids"], "name": payload["counterfactual"]["name"]},
        "pyblp_version": PYBLP_VERSION,
        "seed": payload["seed"],
    }


def validate_output(payload: dict[str, Any], input_payload: dict[str, Any]) -> None:
    _require(isinstance(payload, dict), "output must be an object")
    _require(
        set(payload)
        == {
            "schema_version",
            "case_id",
            "seed",
            "pyblp_version",
            "input_digest",
            "results",
            "counterfactual",
            "diagnostics",
            "calibration_artifact",
            "non_overwrite_proof",
            "artifact_digest",
        },
        "output contains unsupported properties",
    )
    _require(payload.get("schema_version") == OUTPUT_SCHEMA_VERSION, "unsupported output schema_version")
    expected = expected_input_binding(input_payload)
    for key in ("case_id", "input_digest", "pyblp_version", "seed"):
        _require(payload.get(key) == expected[key], f"output {key} does not bind to requested input")
    results = payload.get("results")
    _require(isinstance(results, dict) and set(results) == {"markets"}, "results must contain only markets")
    output_markets = results["markets"]
    _require(isinstance(output_markets, list) and len(output_markets) == len(input_payload["markets"]), "results market count differs from input")
    for source_market, result_market in zip(input_payload["markets"], output_markets, strict=True):
        _require(
            set(result_market) == {"market_id", "products", "outside_share", "probabilities", "elasticities", "diversion_ratios"},
            "result market contains unsupported properties",
        )
        _require(result_market.get("market_id") == source_market["market_id"], "result market identity differs from input")
        products = result_market.get("products")
        _require(isinstance(products, list) and len(products) == len(source_market["products"]), "result product count differs from input")
        for source_product, result_product in zip(source_market["products"], products, strict=True):
            _require(set(result_product) == {"product_id", "price", "latent_share"}, "result product contains unsupported properties")
            _require(result_product.get("product_id") == source_product["product_id"], "result product identity differs from input")
            _number(result_product.get("price"), "result price")
            _number(result_product.get("latent_share"), "result latent_share")
        _number(result_market.get("outside_share"), "outside_share")
        dimension = len(products)
        _matrix(result_market.get("probabilities"), "probabilities", dimension, 1)
        _matrix(result_market.get("elasticities"), "elasticities", dimension)
        _matrix(result_market.get("diversion_ratios"), "diversion_ratios", dimension)
    counterfactual = payload.get("counterfactual")
    _require(isinstance(counterfactual, dict), "counterfactual result is required")
    _require(set(counterfactual) == {"name", "firm_ids", "equilibrium_prices"}, "counterfactual result contains unsupported properties")
    _require(counterfactual.get("name") == expected["counterfactual"]["name"], "counterfactual name differs from input")
    _require(counterfactual.get("firm_ids") == expected["counterfactual"]["firm_ids"], "counterfactual firm_ids differ from input")
    prices = counterfactual.get("equilibrium_prices")
    _require(isinstance(prices, list) and len(prices) == len(expected["product_ids"]), "counterfactual price vector differs from requested product scope")
    for price in prices:
        _number(price, "counterfactual equilibrium price")
    diagnostics = payload.get("diagnostics")
    _require(isinstance(diagnostics, dict), "diagnostics are required")
    _require(
        set(diagnostics)
        == {"beta_price", "converged", "demand_moment_count", "instrument_rank", "parameter_count", "solver_message_digest", "solver_warning_count"},
        "diagnostics contain unsupported properties",
    )
    _number(diagnostics.get("beta_price"), "diagnostics.beta_price")
    _require(isinstance(diagnostics.get("converged"), bool), "diagnostics.converged must be boolean")
    _require(isinstance(diagnostics.get("demand_moment_count"), int), "diagnostics.demand_moment_count must be integer")
    _require(isinstance(diagnostics.get("instrument_rank"), int), "diagnostics.instrument_rank must be integer")
    _require(isinstance(diagnostics.get("parameter_count"), int), "diagnostics.parameter_count must be integer")
    _require(diagnostics["demand_moment_count"] >= diagnostics["parameter_count"], "diagnostics report under-identification")
    _require(diagnostics["instrument_rank"] >= diagnostics["parameter_count"], "diagnostics report rank-deficient instruments")
    _require(diagnostics.get("solver_warning_count") == 0, "diagnostics report PyBLP warnings")
    _require(isinstance(diagnostics.get("solver_message_digest"), str) and len(diagnostics["solver_message_digest"]) == 64, "diagnostics.solver_message_digest is invalid")
    calibration = payload.get("calibration_artifact")
    _require(isinstance(calibration, dict), "calibration_artifact is required")
    _require(
        set(calibration) == {"artifact_id", "beta_price", "input_digest", "method", "pyblp_version"},
        "calibration artifact contains unsupported properties",
    )
    _require(calibration.get("input_digest") == expected["input_digest"], "calibration artifact differs from input")
    _require(calibration.get("pyblp_version") == PYBLP_VERSION, "calibration artifact PyBLP version differs")
    _require(calibration.get("method") == "SYNTHETIC_LOGIT_REFERENCE_ONLY", "calibration artifact method is invalid")
    _number(calibration.get("beta_price"), "calibration_artifact.beta_price")
    proof = payload.get("non_overwrite_proof")
    _require(isinstance(proof, dict), "non_overwrite_proof is required")
    _require(
        set(proof) == {"scope", "input_digest_before", "input_digest_after", "input_unchanged"},
        "non_overwrite proof contains unsupported properties",
    )
    _require(proof.get("scope") == "INPUT_SENTINEL_ONLY", "non_overwrite scope is invalid")
    _require(proof.get("input_digest_before") == expected["input_digest"], "input sentinel before digest differs")
    _require(proof.get("input_digest_after") == expected["input_digest"], "input sentinel after digest differs")
    _require(proof.get("input_unchanged") is True, "input sentinel must prove unchanged input")
    artifact = {key: value for key, value in payload.items() if key != "artifact_digest"}
    _require(payload.get("artifact_digest") == sha256_digest(artifact), "artifact_digest is not self-consistent")
