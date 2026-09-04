import { describe, expect, it } from "vitest";
import type {
  EvidenceAdoptionRecord,
  EvidenceAdoptionReference,
  EvidenceAdoptionState,
  ModelQualification,
  ModelQualificationRecord,
  ModelQualificationSourcePackage
} from "@simwar/shared-contracts";
import { deriveEvidenceAdoptionEpoch } from "../../services/api/src/model-qualification-adopted-run-admission";
import {
  assessAdoptionDrift,
  digestAdoptionOperationsPolicy,
  digestEvidenceAdoptionState,
  MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1,
  stableSha256,
  type AdoptionDriftAssessmentInput
} from "../../services/api/src/model-qualification-adoption-drift-assessment";
import {
  EVIDENCE_ADOPTION_ADMIN,
  EVIDENCE_ADOPTION_NOW,
  createEvidenceAdoptionServiceFixture,
  type EvidenceAdoptionServiceFixture
} from "../helpers/model-qualification-evidence-adoption-fixtures";

const LATER = "2031-01-01T00:00:00.000Z";

interface AdoptedChain {
  readonly fixture: EvidenceAdoptionServiceFixture;
  readonly record: ModelQualificationRecord;
  readonly state: EvidenceAdoptionState;
  readonly current: EvidenceAdoptionRecord;
  readonly predecessor: EvidenceAdoptionRecord;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function reference(record: EvidenceAdoptionRecord): EvidenceAdoptionReference {
  return {
    adoption_digest: record.adoption_digest,
    adoption_id: record.adoption_id
  };
}

function adopt(
  fixture: EvidenceAdoptionServiceFixture,
  qualificationId: string,
  expectedAdoption: EvidenceAdoptionReference | null,
  suffix: string
): EvidenceAdoptionRecord {
  const { primary, service } = fixture;
  const record = service.getRecordForScope(primary.scope)!;
  const epoch = deriveEvidenceAdoptionEpoch(
    record,
    qualificationId,
    service.modelCatalog,
    EVIDENCE_ADOPTION_NOW
  );
  const requested = service.requestEvidenceAdoption(primary.actor, primary.scope, {
    command_id: `${suffix}-request`,
    expected_adoption: expectedAdoption,
    qualification_id: qualificationId
  });
  const reviewed = service.reviewEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, primary.scope, {
    command_id: `${suffix}-review`,
    decision: "APPROVED",
    note: `${suffix} exact governance review`,
    proposal_digest: requested.proposal.proposal_digest,
    proposal_id: requested.proposal.proposal_id
  });
  const disposed = service.disposeEvidenceAdoption(EVIDENCE_ADOPTION_ADMIN, primary.scope, {
    command_id: `${suffix}-dispose`,
    disposition: "ADOPTED_FOR_FUTURE_ADMISSION",
    expires_at: null,
    note: `${suffix} exact future admission adoption`,
    proposal_digest: requested.proposal.proposal_digest,
    proposal_id: requested.proposal.proposal_id
  });
  expect(requested.proposal.epoch).toEqual(epoch);
  expect(reviewed.review.proposal_id).toBe(requested.proposal.proposal_id);
  return disposed.adoption;
}

function adoptedChain(): AdoptedChain {
  const fixture = createEvidenceAdoptionServiceFixture();
  const predecessor = adopt(
    fixture,
    fixture.primary.qualificationA.qualification_id,
    null,
    "o6-a1-a"
  );
  const current = adopt(
    fixture,
    fixture.primary.qualificationB.qualification_id,
    reference(predecessor),
    "o6-a1-b"
  );
  const record = fixture.service.getRecordForScope(fixture.primary.scope)!;
  return {
    current,
    fixture,
    predecessor,
    record,
    state: record.evidence_adoption!
  };
}

function inputFor(
  chain: AdoptedChain,
  overrides: Partial<AdoptionDriftAssessmentInput> = {}
): AdoptionDriftAssessmentInput {
  return {
    assessed_at: EVIDENCE_ADOPTION_NOW,
    expected_adoption: reference(chain.current),
    expected_adoption_state_digest: digestEvidenceAdoptionState(chain.state),
    expected_operations_policy_digest: digestAdoptionOperationsPolicy(
      MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1
    ),
    record: clone(chain.record),
    selection_requirement: "CURRENT",
    state: clone(chain.state),
    ...overrides
  };
}

function withSource(
  record: ModelQualificationRecord,
  sourceId: string,
  update: (source: ModelQualificationSourcePackage) => ModelQualificationSourcePackage
): ModelQualificationRecord {
  return {
    ...clone(record),
    source_packages: record.source_packages.map((source) =>
      source.source_package_id === sourceId ? update(clone(source)) : source
    )
  };
}

function withQualification(
  record: ModelQualificationRecord,
  qualificationId: string,
  update: (qualification: ModelQualification) => ModelQualification
): ModelQualificationRecord {
  return {
    ...clone(record),
    qualifications: record.qualifications.map((qualification) =>
      qualification.qualification_id === qualificationId
        ? update(clone(qualification))
        : qualification
    )
  };
}

function sourceIdentity(source: ModelQualificationSourcePackage) {
  return {
    content_digest: source.content_digest,
    evidence_refs: [...source.evidence_refs],
    expires_at: source.expires_at,
    feature_schema_digest: source.feature_schema_digest,
    freshness_status: source.freshness_status,
    observed_at: source.observed_at,
    quality: clone(source.quality),
    rights_status: source.rights_status,
    source_package_id: source.source_package_id,
    source_ref: source.source_ref,
    source_version: source.source_version
  };
}

function withUnresolvedRequalification(chain: AdoptedChain): ModelQualificationRecord {
  const record = clone(chain.record);
  const qualification = record.qualifications.find(
    (item) => item.qualification_id === chain.current.epoch.qualification_id
  )!;
  const baseline = record.source_packages.find(
    (item) => item.source_package_id === qualification.source_package_id
  )!;
  return {
    ...record,
    requalification_previews: [
      {
        change_set: {
          affected_qualification_ids: [qualification.qualification_id],
          baseline: sourceIdentity(baseline),
          candidate: sourceIdentity(baseline),
          changed_dimensions: ["content_digest"],
          change_set_digest: "f".repeat(64),
          course_id: record.course_id,
          generated_at: EVIDENCE_ADOPTION_NOW,
          historical_non_overwrite: true,
          tenant_id: record.tenant_id
        },
        course_id: record.course_id,
        created_at: EVIDENCE_ADOPTION_NOW,
        historical_non_overwrite: true,
        known_limits: ["test unresolved requalification"],
        preview_id: "mq_preview_o6_a1_unresolved",
        reasons: ["SOURCE_CONTENT_DIGEST_CHANGED"],
        resolution: "PENDING",
        review: { status: "APPROVED" },
        status: "REQUALIFICATION_REQUIRED",
        tenant_id: record.tenant_id,
        updated_at: EVIDENCE_ADOPTION_NOW
      }
    ]
  };
}

describe("O6 adoption drift assessment domain", () => {
  it("returns a deterministic healthy current assessment with the frozen safety flags", () => {
    const chain = adoptedChain();
    const first = assessAdoptionDrift(inputFor(chain));
    const second = assessAdoptionDrift(inputFor(chain));

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      adoption: reference(chain.current),
      advisory_only: true,
      adoption_mutation: false,
      assessment_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      future_admission_impact: "UNCHANGED",
      issue_codes: [],
      official_truth_write: false,
      operations_policy_digest: digestAdoptionOperationsPolicy(
        MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1
      ),
      provider: "OFF",
      status: "HEALTHY"
    });
    expect(first.epoch).toEqual(chain.current.epoch);
    expect(first.assessment_id).toMatch(/^adoption_drift_[a-f0-9]{64}$/);
    expect(Object.keys(first.adoption).sort()).toEqual(["adoption_digest", "adoption_id"]);
    expect(Object.keys(first).sort()).toEqual(
      [
        "adoption",
        "adoption_mutation",
        "adoption_state_digest",
        "advisory_only",
        "assessed_at",
        "assessment_digest",
        "assessment_id",
        "epoch",
        "future_admission_impact",
        "issue_codes",
        "known_limits",
        "official_truth_write",
        "operations_policy_digest",
        "provider",
        "status"
      ].sort()
    );
    const { assessment_digest: assessmentDigest, ...assessmentShape } = first;
    expect(assessmentDigest).toBe(stableSha256(assessmentShape));
  });

  it("uses sorted-key SHA-256 digests for policy and adoption state", () => {
    const chain = adoptedChain();
    const reorderedState: EvidenceAdoptionState = {
      commands: chain.state.commands,
      course_id: chain.state.course_id,
      proposals: chain.state.proposals,
      records: chain.state.records,
      reviews: chain.state.reviews,
      selections: chain.state.selections,
      tenant_id: chain.state.tenant_id
    };
    const policy = MODEL_QUALIFICATION_ADOPTION_OPERATIONS_POLICY_V1;
    const reorderedPolicy = {
      dry_run_only: policy.dry_run_only,
      expiry_warning_window_hours: policy.expiry_warning_window_hours,
      max_drift_score: policy.max_drift_score,
      max_missingness_rate: policy.max_missingness_rate,
      max_ood_rate: policy.max_ood_rate,
      max_sensitivity_delta: policy.max_sensitivity_delta,
      policy_id: policy.policy_id,
      provider: policy.provider,
      require_bound_qualification: policy.require_bound_qualification,
      require_fresh_source: policy.require_fresh_source,
      require_valid_rights: policy.require_valid_rights,
      require_zero_holdout_leakage: policy.require_zero_holdout_leakage,
      schema_version: policy.schema_version
    };

    expect(digestEvidenceAdoptionState(reorderedState)).toBe(
      digestEvidenceAdoptionState(chain.state)
    );
    expect(digestAdoptionOperationsPolicy(reorderedPolicy)).toBe(
      digestAdoptionOperationsPolicy(policy)
    );
  });

  it("assesses an exact retained predecessor without treating it as the current selection", () => {
    const chain = adoptedChain();
    const result = assessAdoptionDrift(
      inputFor(chain, {
        expected_adoption: reference(chain.predecessor),
        selection_requirement: "HISTORICAL_PREDECESSOR"
      })
    );

    expect(result).toMatchObject({
      adoption: reference(chain.predecessor),
      future_admission_impact: "REVIEW_REQUIRED",
      issue_codes: [],
      status: "REVIEW_REQUIRED",
      known_limits: expect.arrayContaining(["SOURCE_EXPIRY_APPROACHING"])
    });
    expect(result.epoch).toEqual(chain.predecessor.epoch);
  });

  it("returns REBASE_REQUIRED when the exact state or policy digest moved", () => {
    const chain = adoptedChain();
    const movedState: EvidenceAdoptionState = {
      ...chain.state,
      commands: [...chain.state.commands].reverse()
    };
    const stateMoved = assessAdoptionDrift(
      inputFor(chain, {
        state: movedState
      })
    );
    const policyMoved = assessAdoptionDrift(
      inputFor(chain, {
        expected_operations_policy_digest: "0".repeat(64)
      })
    );

    expect(stateMoved).toMatchObject({
      future_admission_impact: "REBASE_REQUIRED",
      issue_codes: ["ADOPTION_STATE_DIGEST_CHANGED"],
      status: "REBASE_REQUIRED"
    });
    expect(stateMoved.adoption_state_digest).toBe(digestEvidenceAdoptionState(movedState));
    expect(policyMoved).toMatchObject({
      future_admission_impact: "REBASE_REQUIRED",
      issue_codes: ["OPERATIONS_POLICY_DIGEST_CHANGED"],
      status: "REBASE_REQUIRED"
    });
  });

  it("fails closed for a non-current selection and historical identity mismatch", () => {
    const chain = adoptedChain();
    const notCurrent = assessAdoptionDrift(
      inputFor(chain, { expected_adoption: reference(chain.predecessor) })
    );
    const brokenRecord = withSource(
      chain.record,
      chain.current.epoch.source_package_id,
      (source) => ({
        ...source,
        content_digest: "1".repeat(64)
      })
    );

    expect(notCurrent).toMatchObject({
      future_admission_impact: "BLOCKED",
      issue_codes: ["ADOPTION_NOT_CURRENT"],
      status: "FUTURE_ADMISSION_BLOCKED"
    });
    expect(() => assessAdoptionDrift(inputFor(chain, { record: brokenRecord }))).toThrow(
      "O6_SOURCE_IDENTITY_MISMATCH"
    );
  });

  it("fails closed when the exact adoption is missing, has the wrong digest, or is duplicated", () => {
    const chain = adoptedChain();
    const missing = {
      adoption_digest: "0".repeat(64),
      adoption_id: "o6-a1-missing-adoption"
    };
    const incorrectDigest = {
      adoption_digest: "0".repeat(64),
      adoption_id: chain.current.adoption_id
    };
    const duplicateState: EvidenceAdoptionState = {
      ...chain.state,
      records: [...chain.state.records, clone(chain.current)]
    };

    expect(() => assessAdoptionDrift(inputFor(chain, { expected_adoption: missing }))).toThrow(
      "O6_EXACT_ADOPTION_REQUIRED"
    );
    expect(() =>
      assessAdoptionDrift(inputFor(chain, { expected_adoption: incorrectDigest }))
    ).toThrow("O6_EXACT_ADOPTION_REQUIRED");
    expect(() =>
      assessAdoptionDrift(
        inputFor(chain, {
          expected_adoption_state_digest: digestEvidenceAdoptionState(duplicateState),
          state: duplicateState
        })
      )
    ).toThrow("O6_EXACT_ADOPTION_REQUIRED");
  });

  it("reports source, dataset, qualification, diagnostic, and requalification blockers", () => {
    const chain = adoptedChain();
    const sourceBlocked = withSource(
      chain.record,
      chain.current.epoch.source_package_id,
      (source) => ({
        ...source,
        freshness_status: "STALE",
        quality: { ...source.quality, missingness_rate: 0.5 },
        rights_status: "RESTRICTED"
      })
    );
    const datasetBlocked: ModelQualificationRecord = {
      ...clone(chain.record),
      calibration_datasets: chain.record.calibration_datasets.map((dataset) =>
        dataset.calibration_dataset_id === chain.current.epoch.calibration_dataset_id
          ? {
              ...dataset,
              holdout_leakage_count: 1,
              status: "NOT_ELIGIBLE" as const,
              zero_holdout_leakage: false
            }
          : dataset
      )
    };
    const qualificationBlocked = withQualification(
      chain.record,
      chain.current.epoch.qualification_id,
      (qualification) => ({
        ...qualification,
        binding: { ...qualification.binding, status: "UNBOUND" as const },
        decision: "REJECTED" as const,
        diagnostics: {
          ...qualification.diagnostics,
          drift_score: 0.9,
          ood_rate: 0.9,
          sensitivity_max_delta: 0.9
        },
        review: { ...qualification.review, status: "PENDING" as const }
      })
    );

    expect(assessAdoptionDrift(inputFor(chain, { record: sourceBlocked }))).toMatchObject({
      issue_codes: ["SOURCE_RIGHTS_INVALID", "SOURCE_NOT_FRESH", "SOURCE_QUALITY_INVALID"],
      status: "FUTURE_ADMISSION_BLOCKED"
    });
    expect(assessAdoptionDrift(inputFor(chain, { record: datasetBlocked }))).toMatchObject({
      issue_codes: ["DATASET_NOT_READY", "HOLDOUT_LEAKAGE"],
      status: "FUTURE_ADMISSION_BLOCKED"
    });
    expect(assessAdoptionDrift(inputFor(chain, { record: qualificationBlocked }))).toMatchObject({
      issue_codes: [
        "QUALIFICATION_NOT_APPROVED",
        "QUALIFICATION_REVIEW_NOT_APPROVED",
        "QUALIFICATION_NOT_BOUND",
        "QUALIFICATION_DIAGNOSTIC_DRIFT",
        "QUALIFICATION_DIAGNOSTIC_OOD",
        "QUALIFICATION_DIAGNOSTIC_SENSITIVITY"
      ],
      status: "FUTURE_ADMISSION_BLOCKED"
    });
    expect(
      assessAdoptionDrift(
        inputFor(chain, {
          record: withUnresolvedRequalification(chain)
        })
      )
    ).toMatchObject({
      issue_codes: ["REQUALIFICATION_UNRESOLVED"],
      status: "FUTURE_ADMISSION_BLOCKED"
    });
  });

  it("treats an expired exact source as blocked even for a retained predecessor", () => {
    const chain = adoptedChain();
    const result = assessAdoptionDrift(
      inputFor(chain, {
        assessed_at: LATER,
        expected_adoption: reference(chain.predecessor),
        selection_requirement: "HISTORICAL_PREDECESSOR"
      })
    );

    expect(result).toMatchObject({
      future_admission_impact: "BLOCKED",
      issue_codes: ["SOURCE_EXPIRED"],
      status: "FUTURE_ADMISSION_BLOCKED"
    });
  });
});
