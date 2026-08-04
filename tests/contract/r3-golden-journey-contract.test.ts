import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  R3_GOLDEN_SCHEMA_VERSION,
  isCorrelationChainDto,
  isGoldenJourneyAllowedActionsDto,
  isGoldenJourneyContextDto,
  isGoldenJourneyStatusDto,
  isCrossSliceReceiptIndex
} from "@simwar/shared-contracts";

const digest = "a".repeat(64);
const ref = {
  content_digest: digest,
  discriminator: "exact_ref" as const,
  resource_id: "course_demo",
  resource_type: "course_package_version" as const,
  tenant_id: "tenant_demo",
  version: "1.0.0"
};

const context = {
  correlation_id: "corr_r3_001",
  course_id: "course_demo",
  course_package_ref: ref,
  discriminator: "golden_journey_context" as const,
  journey_id: "journey_r3_001",
  known_limits: ["JSON_INTERNAL_ONLY"],
  request_id: "req_r3_001",
  role_keys: ["CEO"],
  run_id: "run_demo",
  runtime_authority: "JSON_INTERNAL_ONLY" as const,
  schema_version: R3_GOLDEN_SCHEMA_VERSION,
  status: "ready" as const,
  team_id: "team_alpha",
  tenant_id: "tenant_demo"
};

describe("R3 Golden Journey contract", () => {
  it("compiles the strict JSON Schema and rejects the invalid fixture", () => {
    const schema = JSON.parse(
      readFileSync(resolve(process.cwd(), "contracts/schemas/r3-golden-journey.v1.json"), "utf8")
    );
    const valid = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/fixtures/r3-golden-journey.valid.json"),
        "utf8"
      )
    );
    const invalid = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "contracts/fixtures/r3-golden-journey.invalid.json"),
        "utf8"
      )
    );
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
  });

  it("accepts a closed context and rejects unknown fields", () => {
    expect(isGoldenJourneyContextDto(context)).toBe(true);
    expect(isGoldenJourneyContextDto({ ...context, private_payload: {} })).toBe(false);
  });

  it("accepts only explicitly allowed actions", () => {
    const value = {
      allowed_actions: ["view_context", "view_receipts"],
      blocked_reasons: [],
      correlation_id: context.correlation_id,
      discriminator: "golden_journey_allowed_actions",
      journey_id: context.journey_id,
      request_id: context.request_id,
      role: "teacher",
      schema_version: R3_GOLDEN_SCHEMA_VERSION
    } as const;
    expect(isGoldenJourneyAllowedActionsDto(value)).toBe(true);
    expect(isGoldenJourneyAllowedActionsDto({ ...value, allowed_actions: ["write_truth"] })).toBe(
      false
    );
  });

  it("requires receipt and correlation references to remain exact and closed", () => {
    const index = {
      chain_digest: digest,
      correlation_id: context.correlation_id,
      discriminator: "cross_slice_receipt_index",
      entries: [
        {
          exact_refs: [ref],
          receipt_id: "receipt_r3_001",
          slice: "D1",
          status: "PASS"
        }
      ],
      journey_id: context.journey_id,
      request_id: context.request_id,
      schema_version: R3_GOLDEN_SCHEMA_VERSION
    } as const;
    expect(isCrossSliceReceiptIndex(index)).toBe(true);
    expect(
      isCrossSliceReceiptIndex({
        ...index,
        entries: [{ ...index.entries[0], exact_refs: [{ ...ref, version: "latest" }] }]
      })
    ).toBe(false);

    const chain = {
      correlation_id: context.correlation_id,
      discriminator: "correlation_chain",
      journey_id: context.journey_id,
      request_id: context.request_id,
      schema_version: R3_GOLDEN_SCHEMA_VERSION,
      status: "complete",
      steps: [{ exact_refs: [ref], operation: "context.read", slice: "R3" }]
    } as const;
    expect(isCorrelationChainDto(chain)).toBe(true);
  });

  it("keeps student status projection non-authoritative", () => {
    const status = {
      allowed_actions: {
        allowed_actions: ["view_context"],
        blocked_reasons: [],
        correlation_id: context.correlation_id,
        discriminator: "golden_journey_allowed_actions",
        journey_id: context.journey_id,
        request_id: context.request_id,
        role: "student",
        schema_version: R3_GOLDEN_SCHEMA_VERSION
      },
      context: { ...context, role_keys: [] },
      correlation_chain: {
        correlation_id: context.correlation_id,
        discriminator: "correlation_chain",
        journey_id: context.journey_id,
        request_id: context.request_id,
        schema_version: R3_GOLDEN_SCHEMA_VERSION,
        status: "complete",
        steps: []
      },
      discriminator: "golden_journey_status",
      formal_truth_write: false,
      receipt_index: {
        chain_digest: digest,
        correlation_id: context.correlation_id,
        discriminator: "cross_slice_receipt_index",
        entries: [],
        journey_id: context.journey_id,
        request_id: context.request_id,
        schema_version: R3_GOLDEN_SCHEMA_VERSION
      },
      runtime_authority: "JSON_INTERNAL_ONLY",
      schema_version: R3_GOLDEN_SCHEMA_VERSION,
      student_private_fields_exposed: false
    } as const;
    expect(isGoldenJourneyStatusDto(status)).toBe(true);
    expect(isGoldenJourneyStatusDto({ ...status, student_private_fields_exposed: true })).toBe(
      false
    );
  });
});
