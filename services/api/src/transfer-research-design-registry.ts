import type { TransferEvidenceRecordCandidate, TransferStudyDefinitionVersion } from "@simwar/shared-contracts";
import type { TransferResearchDesignPersistencePort } from "./transfer-research-design-ports.js";

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryTransferResearchDesignRegistry implements TransferResearchDesignPersistencePort {
  private readonly studies: TransferStudyDefinitionVersion[] = [];
  private readonly candidates: TransferEvidenceRecordCandidate[] = [];

  async listStudies(tenantId: string): Promise<TransferStudyDefinitionVersion[]> {
    return clone(this.studies.filter((study) => study.study_ref.tenant_id === tenantId));
  }

  async getStudy(tenantId: string, studyId: string): Promise<TransferStudyDefinitionVersion | null> {
    const study = this.studies.find((candidate) => candidate.study_ref.tenant_id === tenantId && candidate.study_ref.resource_id === studyId);
    return study ? clone(study) : null;
  }

  async appendStudy(study: TransferStudyDefinitionVersion): Promise<"created" | "reused"> {
    const existing = this.studies.find((candidate) => candidate.study_ref.resource_id === study.study_ref.resource_id && candidate.study_ref.version === study.study_ref.version && candidate.study_ref.tenant_id === study.study_ref.tenant_id);
    if (existing) {
      if (existing.content_digest !== study.content_digest) throw new Error("D6_DUPLICATE_CONFLICT");
      return "reused";
    }
    this.studies.push(clone(study));
    return "created";
  }

  async listCandidates(tenantId: string): Promise<TransferEvidenceRecordCandidate[]> {
    return clone(this.candidates.filter((candidate) => candidate.candidate_ref.tenant_id === tenantId));
  }

  async appendCandidate(candidate: TransferEvidenceRecordCandidate): Promise<"created" | "reused"> {
    const existing = this.candidates.find((item) => item.candidate_ref.resource_id === candidate.candidate_ref.resource_id && item.candidate_ref.tenant_id === candidate.candidate_ref.tenant_id && item.candidate_ref.version === candidate.candidate_ref.version);
    if (existing) {
      if (existing.content_digest !== candidate.content_digest) throw new Error("D6_DUPLICATE_CONFLICT");
      return "reused";
    }
    this.candidates.push(clone(candidate));
    return "created";
  }
}
