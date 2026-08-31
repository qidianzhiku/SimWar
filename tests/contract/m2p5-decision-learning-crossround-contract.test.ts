import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as unknown;

describe("M2-P5 decision learning cross-round contract", () => {
  it("accepts the bounded safe fixture and rejects private truth fields", () => {
    const schema = readJson("contracts/schemas/m2p5-decision-learning-crossround.v1.json");
    const decisionContextEvidenceSchema = readJson(
      "contracts/schemas/student-decision-context-evidence.v1.json"
    );
    const valid = readJson("contracts/fixtures/m2p5-decision-learning-crossround.valid.json");
    const invalid = readJson("contracts/fixtures/m2p5-decision-learning-crossround.invalid.json");
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    ajv.addSchema(decisionContextEvidenceSchema);
    const validate = ajv.compile(schema);

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(valid).toMatchObject({
      learning_loop: {
        schema_version: "m2p6-teacher-debrief-learning-transfer.v1",
        recovery_state: "EXACT_CONTEXT_RESTORED"
      }
    });
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).not.toContain("replay_hash");
    for (const forbidden of [
      "decision_batch_hash",
      "json_runtime_source_digest",
      "canonical_evidence_digest",
      "replay_input_manifest",
      "authority_diagnostics"
    ]) {
      expect(JSON.stringify(valid)).not.toContain(forbidden);
    }

    const invalidRecovery = structuredClone(valid) as {
      learning_loop: Record<string, unknown>;
    };
    invalidRecovery.learning_loop.recovery_state = "FALLBACK_CONTEXT";
    expect(validate(invalidRecovery)).toBe(false);

    const injectedInternal = structuredClone(valid) as {
      learning_loop: Record<string, unknown>;
    };
    injectedInternal.learning_loop.json_runtime_source_digest = "a".repeat(64);
    expect(validate(injectedInternal)).toBe(false);

    const wrongCanonicalType = structuredClone(valid) as {
      learning_loop: { canonical_decision_ref: Record<string, unknown> };
    };
    wrongCanonicalType.learning_loop.canonical_decision_ref.resource_type = "round";
    expect(validate(wrongCanonicalType)).toBe(false);
  });

  it("enforces the status-dependent source evidence lifecycle", () => {
    const schema = readJson("contracts/schemas/student-decision-context-evidence.v1.json");
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    const validate = ajv.compile(schema);
    const ready = {
      schema_version: "student-decision-context-evidence.v1",
      evidence_id: "sdcx.v1.ready",
      evidence_version: "student-decision-context.v1",
      status: "READY",
      scope: {
        activity_id: "activity_consequence",
        course_id: "course_demo",
        role_key: "CEO",
        round_id: "round_m31",
        round_no: 1,
        run_id: "run_m31",
        team_id: "team_alpha",
        tenant_id: "tenant_demo"
      },
      source_context: {
        target_region: "Hangzhou",
        epoch_version: "epoch-b.2026-08-30",
        qualification_status: "LIMITED",
        consumption_status: "LOOKAHEAD_READY",
        exact_binding_required: true
      },
      continuity: {
        context: "PROVEN",
        decision: "PROVEN",
        consequence: "PENDING_PUBLISH",
        debrief: "PENDING_PUBLISH",
        regional_transfer: "PENDING_PUBLISH"
      },
      known_limits: ["qualification LIMITED"]
    };
    const blocked = structuredClone(ready) as Record<string, unknown>;
    delete blocked.source_context;
    Object.assign(blocked, {
      evidence_id: "sdcx.v1.blocked",
      status: "BLOCKED",
      continuity: {
        context: "PROVEN",
        decision: "BLOCKED",
        consequence: "BLOCKED",
        debrief: "BLOCKED",
        regional_transfer: "BLOCKED"
      },
      blocker_codes: ["SOURCE_EVIDENCE_UNAVAILABLE"]
    });

    expect(validate(ready)).toBe(true);
    expect(validate(blocked)).toBe(true);

    const readyWithoutSource = structuredClone(ready) as Record<string, unknown>;
    delete readyWithoutSource.source_context;
    expect(validate(readyWithoutSource)).toBe(false);

    const readyWithBlocker = {
      ...ready,
      blocker_codes: ["SOURCE_EVIDENCE_UNAVAILABLE"]
    };
    expect(validate(readyWithBlocker)).toBe(false);

    const blockedWithoutBlocker = structuredClone(blocked) as Record<string, unknown>;
    delete blockedWithoutBlocker.blocker_codes;
    expect(validate(blockedWithoutBlocker)).toBe(false);

    const blockedWithSource = {
      ...blocked,
      source_context: ready.source_context
    };
    expect(validate(blockedWithSource)).toBe(false);
  });

  it("binds both exact-scope BFF surfaces to the M2-P5 response schema", () => {
    const openApi = yaml.load(
      readFileSync(resolve("contracts/openapi/p0-api.openapi.yaml"), "utf8")
    ) as { paths?: Record<string, unknown>; components?: { schemas?: Record<string, unknown> } };
    expect(
      openApi.paths?.["/api/v1/bff/student/m2p5/runs/{runId}/rounds/{roundNo}/decision-learning"]
    ).toBeDefined();
    expect(
      openApi.paths?.["/api/v1/bff/teacher/m2p5/runs/{runId}/rounds/{roundNo}/decision-learning"]
    ).toMatchObject({
      get: {
        summary: expect.stringContaining("M2P6")
      }
    });
    expect(
      openApi.paths?.["/api/v1/bff/student/m2p5/runs/{runId}/rounds/{roundNo}/decision-learning"]
    ).toMatchObject({
      get: {
        summary: expect.stringContaining("M2P6")
      }
    });
    expect(openApi.components?.schemas?.M2P5DecisionLearningEnvelope).toMatchObject({
      properties: {
        data: { $ref: "#/components/schemas/M2P5DecisionLearningResponse" }
      }
    });
    expect(openApi.components?.schemas?.M2P5DecisionLearningResponse).toMatchObject({
      $ref: "../schemas/m2p5-decision-learning-crossround.v1.json"
    });
  });
});
