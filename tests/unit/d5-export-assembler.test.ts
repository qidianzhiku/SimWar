import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { StudentLearningReport } from "@simwar/shared-contracts";
import { D5ExportAssembler } from "../../services/api/src/d5-export-assembler.js";
import { InMemoryD5ExportRegistry } from "../../services/api/src/d5-export-registry.js";

const report = JSON.parse(
  readFileSync(resolve(process.cwd(), "contracts/fixtures/student-learning-report.valid.json"), "utf8")
) as StudentLearningReport;

function assembler(reports: readonly StudentLearningReport[] = [report]) {
  return new D5ExportAssembler({
    reports: { listPreview: async () => ({ known_limits: [], reports, report_schema_version: "student-learning-report.v1", runtime_authority: "JSON_INTERNAL_ONLY", scope: "tenant_preview" }) },
    repository: new InMemoryD5ExportRegistry(),
    now: () => "2026-08-04T00:00:00.000Z"
  });
}

describe("D5 export assembler", () => {
  it("projects one exact D4 report into deterministic xAPI and AoL output", async () => {
    const service = assembler();
    const preview = await service.preview("tenant_demo", { report_refs: [report.report_ref] });
    expect(preview.statements).toHaveLength(1);
    expect(preview.statements[0]?.context.extensions.report_ref).toEqual(report.report_ref);
    expect(preview.statements[0]?.actor.account.name).toMatch(/^actor_[a-f0-9]{32}$/);
    expect(preview.aol_dataset.rows[0]?.sample_size).toBe(1);
    expect(preview.aol_dataset.rows[0]?.suppressed).toBe(true);
    expect(JSON.stringify(preview)).not.toMatch(/"teacher_feedback"|"raw_evidence_payload"|"student_email":/i);
  });

  it("seals once and reuses the same immutable bundle for the same source set", async () => {
    const service = assembler();
    const input = { report_refs: [report.report_ref] };
    const first = await service.seal({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, input);
    const second = await service.seal({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, input);
    expect(first.status).toBe("generated");
    expect(second.status).toBe("reused");
    expect(second.bundle.bundle_digest).toBe(first.bundle.bundle_digest);
  });

  it("rejects a report reference from another tenant before projection", async () => {
    const service = assembler();
    await expect(service.preview("tenant_demo", { report_refs: [{ ...report.report_ref, tenant_id: "tenant_other" }] })).rejects.toMatchObject({ code: "D5_EXACT_REFERENCE_INVALID" });
  });

  it("rejects a bundle that crosses course, run, team, or role scope", async () => {
    const otherScope = { ...report, report_ref: { ...report.report_ref, resource_id: "report_other" }, context: { ...report.context, run_id: "run_other" } };
    const service = assembler([report, otherScope]);
    await expect(service.preview("tenant_demo", { report_refs: [report.report_ref, otherScope.report_ref] })).rejects.toMatchObject({ code: "D5_EXPORT_SCOPE_VIOLATION" });
  });
});
