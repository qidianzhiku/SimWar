import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { isW020AdvisoryReceipt } from "@simwar/shared-contracts";

describe("W020 governed AI advisory contract", () => {
  it("validates the closed receipt fixture and rejects raw prompt/truth writes", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/w020-governed-ai-advisory.v1.json"), "utf8")
    );
    const valid = JSON.parse(
      readFileSync(resolve("contracts/fixtures/w020-governed-ai-advisory.valid.json"), "utf8")
    );
    const invalid = JSON.parse(
      readFileSync(resolve("contracts/fixtures/w020-governed-ai-advisory.invalid.json"), "utf8")
    );
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    const validate = ajv.compile(schema);
    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
    expect(isW020AdvisoryReceipt(valid)).toBe(true);
    expect(valid).not.toHaveProperty("model_call_log");
    expect(JSON.stringify(valid)).not.toContain("state_true");
    expect(JSON.stringify(valid)).not.toContain("SettlementResult");
  });

  it("rejects private or inconsistent fields in the bounded public receipt", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/w020-governed-ai-advisory.v1.json"), "utf8")
    );
    const valid = JSON.parse(
      readFileSync(resolve("contracts/fixtures/w020-governed-ai-advisory.valid.json"), "utf8")
    );
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    const validate = ajv.compile(schema);
    const structurallyInvalidVariants = [
      structuredClone(valid),
      structuredClone(valid),
      structuredClone(valid)
    ];
    const runtimeOnlyInvalid = structuredClone(valid);

    structurallyInvalidVariants[0].projection.title = "   ";
    structurallyInvalidVariants[1].projection.raw_prompt = "private prompt";
    structurallyInvalidVariants[2].context.role_key = "latest";
    runtimeOnlyInvalid.projection.evidence_refs = ["event_other"];

    for (const invalid of structurallyInvalidVariants) {
      expect(validate(invalid)).toBe(false);
      expect(isW020AdvisoryReceipt(invalid)).toBe(false);
    }

    expect(validate(runtimeOnlyInvalid)).toBe(true);
    expect(isW020AdvisoryReceipt(runtimeOnlyInvalid)).toBe(false);
  });

  it("validates the exact W019-safe teacher debrief projection and rejects missing safe source", () => {
    const schema = JSON.parse(
      readFileSync(resolve("contracts/schemas/w020-governed-ai-advisory.v1.json"), "utf8")
    );
    const student = JSON.parse(
      readFileSync(resolve("contracts/fixtures/w020-governed-ai-advisory.valid.json"), "utf8")
    );
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    const validate = ajv.compile(schema);
    const teacher = structuredClone(student);
    teacher.context.actor_role = "teacher";
    teacher.context.activity_id = "activity_001";
    teacher.context.advisory_scopes = ["debrief"];
    teacher.context.source_event_ids = [];
    teacher.context.source_event_types = [];
    teacher.context.teacher_safe_source = {
      activity_id: "activity_001",
      confirmation_status: "CONFIRMED",
      course_report_available: true,
      eligible_event_count: 1,
      evidence_count: 1,
      known_limits: ["Human Validation is not performed."],
      missing: [],
      outcome_status: "CONFIRMED",
      role_key: "CEO",
      runtime_authority: "JSON_INTERNAL_ONLY",
      source_schema_version: "teaching-closure.v1",
      student_safe_preview: {
        criterion_count: 1,
        evidence_count: 1,
        next_focus: "Review the confirmed criterion outcome with the student.",
        status: "CONFIRMED",
        visibility: "student_safe"
      }
    };
    teacher.projection = {
      advisory_only: true,
      evidence_refs: [],
      known_limits: ["Human Validation is not performed."],
      recommendations: ["Use the confirmed safe source to prepare a discussion."],
      surface: "teacher_debrief",
      teacher_debrief: {
        activity_id: "activity_001",
        discussion_prompts: ["What changed?"],
        explanations: ["One confirmed evidence artifact is available."],
        next_focus: "Review the confirmed criterion outcome with the student.",
        role_key: "CEO",
        tradeoffs: ["Compare evidence coverage with Known Limits."]
      },
      title: "Teacher Debrief Advisor"
    };

    expect(validate(teacher)).toBe(true);
    expect(isW020AdvisoryReceipt(teacher)).toBe(true);
    const missingSource = structuredClone(teacher);
    delete missingSource.context.teacher_safe_source;
    expect(validate(missingSource)).toBe(false);
    expect(isW020AdvisoryReceipt(missingSource)).toBe(false);
  });
});
