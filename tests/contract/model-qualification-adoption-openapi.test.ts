import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";
import Ajv2020 from "ajv/dist/2020.js";
import {
  createEvidenceAdoptionServiceFixture,
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_STUDENT
} from "../helpers/model-qualification-evidence-adoption-fixtures";

const document = yaml.load(readFileSync("contracts/openapi/p0-api.openapi.yaml", "utf8")) as {
  paths: Record<string, { post?: unknown; get?: unknown }>;
  components: {
    schemas: Record<string, { required: string[]; properties: Record<string, { $ref?: string }> }>;
  };
};
describe("O5 canonical route and versioned admission contract", () => {
  it("validates real adopted projections and rejects missing immutable review provenance", () => {
    const { service, primary } = createEvidenceAdoptionServiceFixture();
    const { actor, scope, qualificationA } = primary;
    const proposal = service.requestEvidenceAdoption(actor, scope, {
      command_id: "schema-request",
      qualification_id: qualificationA.qualification_id,
      expected_adoption: null
    }).proposal;
    const review = service.reviewEvidenceAdoption(actor, scope, {
      command_id: "schema-review",
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      decision: "APPROVED",
      note: "Exact schema review"
    }).review;
    const adoption = service.disposeEvidenceAdoption(actor, scope, {
      command_id: "schema-adopt",
      proposal_id: proposal.proposal_id,
      proposal_digest: proposal.proposal_digest,
      disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
      expires_at: null,
      note: "Exact schema adoption"
    }).adoption;
    expect(adoption.review_digest).toBe(review.review_digest);
    const schema = JSON.parse(
      readFileSync("contracts/schemas/model-qualification.v1.json", "utf8")
    );
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    const teacher = service.getTeacherProjection(actor, scope);
    const admin = service.getAdminProjection(EVIDENCE_ADOPTION_ADMIN, scope);
    const student = service.getStudentProjection(
      EVIDENCE_ADOPTION_STUDENT,
      scope,
      qualificationA.qualification_id
    );
    for (const projection of [teacher, admin, student]) {
      expect(validate(projection), JSON.stringify(validate.errors)).toBe(true);
    }
    const invalid = JSON.parse(JSON.stringify(teacher));
    delete invalid.evidence_adoption.reviews[0].review_digest;
    expect(validate(invalid)).toBe(false);
    expect(JSON.stringify(student)).not.toContain(adoption.adoption_id);
    expect(JSON.stringify(student)).not.toContain(review.review_digest);
  });
  it("documents both governance roles and exact historical lookup", () => {
    for (const role of ["teacher", "admin"]) {
      for (const action of ["request", "review", "disposition"]) {
        expect(
          document.paths[`/api/v1/bff/${role}/model-qualification/evidence-adoptions/${action}`]
            ?.post
        ).toBeDefined();
      }
      expect(
        document.paths[`/api/v1/bff/${role}/model-qualification/run-admissions/{runId}`]?.get
      ).toBeDefined();
    }
  });
  it("keeps v1 intact and requires an explicit adoption in the versioned live contract", () => {
    const schemas = document.components.schemas;
    expect(schemas.QualifiedRunAdmissionReceipt.properties).not.toHaveProperty("adoption");
    expect(schemas.AdoptedQualifiedRunAdmissionRequest.required).toContain("adoption");
    expect(schemas.AdoptedQualifiedRunAdmissionReceipt.required).toEqual(
      expect.arrayContaining(["adoption", "evidence_epoch", "admitted_at", "schema_version"])
    );
    expect(schemas.RunCreateInput.properties.qualified_run_admission.$ref).toBe(
      "#/components/schemas/AdoptedQualifiedRunAdmissionRequest"
    );
    expect(
      schemas.ValidationEnvironmentLaunchStartRequest.properties.qualified_run_admission.$ref
    ).toBe("#/components/schemas/AdoptedQualifiedRunAdmissionRequest");
  });
});
