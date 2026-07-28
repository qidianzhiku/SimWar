import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  ApiErrorEnvelope,
  DecisionPayload,
  M1DecisionSubmitRequest,
  M1DecisionSubmitSuccessEnvelope,
  M1StudentResultEnvelope,
  M1TeacherAdminResultEnvelope
} from "../../packages/shared-contracts/src";

type JsonSchema = { properties?: Record<string, unknown> };
type SchemaVisibleKeys<T> = {
  [Key in keyof T]-?: [NonNullable<T[Key]>] extends [never] ? never : Key;
}[keyof T];

const schemaKeys = (file: string, path: string[] = []): string[] => {
  const schema = JSON.parse(readFileSync(resolve("contracts/schemas", file), "utf8")) as JsonSchema;
  let value: unknown = schema;

  for (const key of path) {
    value = (value as Record<string, unknown>)[key];
  }

  return Object.keys((value as JsonSchema).properties ?? {}).sort();
};

const apiErrorKeys = {
  code: true,
  details: true,
  message: true,
  request_id: true
} satisfies Record<keyof ApiErrorEnvelope, true>;

const decisionPayloadKeys = {
  capacity_plan: true,
  cash_buffer_target: true,
  marketing_budget: true,
  pricing: true,
  service_quality_budget: true,
  strategy_statement: true
} satisfies Record<keyof DecisionPayload, true>;

const decisionRequestKeys = {
  decision_payload: true,
  team_id: true
} satisfies Record<keyof M1DecisionSubmitRequest, true>;

const decisionSuccessDataKeys = {
  canonical_source: true,
  decision_id: true,
  merge_commit_id: true,
  payload: true,
  round_id: true,
  round_no: true,
  run_id: true,
  status: true,
  submitted_by: true,
  team_confirmation_id: true,
  team_id: true,
  tenant_id: true,
  validation_report: true,
  version: true
} satisfies Record<keyof M1DecisionSubmitSuccessEnvelope["data"], true>;

const studentResultDataKeys = {
  classroom_debrief_prompts: true,
  replay_hash: true,
  result_label: true,
  results: true,
  round_no: true,
  run_id: true,
  runtime_boundary: true,
  runtime_limitations: true,
  status: true
} satisfies Record<SchemaVisibleKeys<M1StudentResultEnvelope["data"]>, true>;

const teacherAdminResultDataKeys = {
  classroom_debrief_prompts: true,
  replay_evidence: true,
  replay_hash: true,
  result_label: true,
  results: true,
  round_no: true,
  run_id: true,
  runtime_boundary: true,
  runtime_limitations: true,
  status: true
} satisfies Record<keyof M1TeacherAdminResultEnvelope["data"], true>;

describe("M1 shared contract and JSON Schema parity", () => {
  it("keeps request, success, result, and error contract keys aligned", () => {
    expect(schemaKeys("api-error-envelope.v1.json")).toEqual(Object.keys(apiErrorKeys).sort());
    expect(schemaKeys("m1-decision-submit-request.v1.json")).toEqual(
      Object.keys(decisionRequestKeys).sort()
    );
    expect(
      schemaKeys("m1-decision-submit-request.v1.json", ["properties", "decision_payload"])
    ).toEqual(Object.keys(decisionPayloadKeys).sort());
    expect(
      schemaKeys("m1-decision-submit-success-envelope.v1.json", ["properties", "data"])
    ).toEqual(Object.keys(decisionSuccessDataKeys).sort());
    expect(schemaKeys("m1-student-result-envelope.v1.json", ["properties", "data"])).toEqual(
      Object.keys(studentResultDataKeys).sort()
    );
    expect(schemaKeys("m1-teacher-admin-result-envelope.v1.json", ["properties", "data"])).toEqual(
      Object.keys(teacherAdminResultDataKeys).sort()
    );
  });
});
