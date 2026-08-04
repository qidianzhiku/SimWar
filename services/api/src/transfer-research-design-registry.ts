import type {
  TransferEvidenceRecordCandidate,
  TransferInstrumentVersion,
  TransferStudyDefinitionVersion
} from "@simwar/shared-contracts";
import type {
  TransferResearchAuditEntry,
  TransferResearchDesignBundle,
  TransferResearchDesignPersistencePort
} from "./transfer-research-design-ports.js";

const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryTransferResearchDesignRegistry implements TransferResearchDesignPersistencePort {
  private readonly studies: TransferStudyDefinitionVersion[] = [];
  private readonly candidates: TransferEvidenceRecordCandidate[] = [];
  private readonly instruments: TransferInstrumentVersion[] = [];
  private readonly audit: TransferResearchAuditEntry[] = [];

  async listStudies(tenantId: string): Promise<TransferStudyDefinitionVersion[]> {
    return clone(this.studies.filter((study) => study.study_ref.tenant_id === tenantId));
  }

  async getStudy(
    tenantId: string,
    studyId: string
  ): Promise<TransferStudyDefinitionVersion | null> {
    const study = this.studies.find(
      (candidate) =>
        candidate.study_ref.tenant_id === tenantId && candidate.study_ref.resource_id === studyId
    );
    return study ? clone(study) : null;
  }

  async appendStudy(study: TransferStudyDefinitionVersion): Promise<"created" | "reused"> {
    const existing = this.studies.find(
      (candidate) =>
        candidate.study_ref.resource_id === study.study_ref.resource_id &&
        candidate.study_ref.version === study.study_ref.version &&
        candidate.study_ref.tenant_id === study.study_ref.tenant_id
    );
    if (existing) {
      if (existing.content_digest !== study.content_digest)
        throw new Error("D6_DUPLICATE_CONFLICT");
      return "reused";
    }
    this.studies.push(clone(study));
    return "created";
  }

  async listCandidates(tenantId: string): Promise<TransferEvidenceRecordCandidate[]> {
    return clone(
      this.candidates.filter((candidate) => candidate.candidate_ref.tenant_id === tenantId)
    );
  }

  async appendCandidate(candidate: TransferEvidenceRecordCandidate): Promise<"created" | "reused"> {
    const existing = this.candidates.find(
      (item) =>
        item.candidate_ref.resource_id === candidate.candidate_ref.resource_id &&
        item.candidate_ref.tenant_id === candidate.candidate_ref.tenant_id &&
        item.candidate_ref.version === candidate.candidate_ref.version
    );
    if (existing) {
      if (existing.content_digest !== candidate.content_digest)
        throw new Error("D6_DUPLICATE_CONFLICT");
      return "reused";
    }
    this.candidates.push(clone(candidate));
    return "created";
  }

  async resolveInstrument(
    tenantId: string,
    instrumentId: string
  ): Promise<TransferInstrumentVersion | null> {
    const instrument = this.instruments.find(
      (candidate) =>
        candidate.instrument_ref.tenant_id === tenantId &&
        candidate.instrument_ref.resource_id === instrumentId
    );
    return instrument ? clone(instrument) : null;
  }

  async appendAudit(entry: TransferResearchAuditEntry): Promise<void> {
    this.audit.push(clone(entry));
  }

  async listAudit(tenantId: string): Promise<TransferResearchAuditEntry[]> {
    return clone(this.audit.filter((entry) => entry.tenant_id === tenantId));
  }

  async appendBundle(
    bundle: TransferResearchDesignBundle,
    audit: TransferResearchAuditEntry
  ): Promise<"created" | "reused"> {
    const studiesBefore = clone(this.studies);
    const candidatesBefore = clone(this.candidates);
    const instrumentsBefore = clone(this.instruments);
    const auditBefore = clone(this.audit);
    try {
      const studyStatus = await this.appendStudy(bundle.study);
      const instrumentExists = this.instruments.find(
        (candidate) =>
          candidate.instrument_ref.tenant_id === bundle.instrument.instrument_ref.tenant_id &&
          candidate.instrument_ref.resource_id === bundle.instrument.instrument_ref.resource_id &&
          candidate.instrument_ref.version === bundle.instrument.instrument_ref.version
      );
      if (instrumentExists && instrumentExists.content_digest !== bundle.instrument.content_digest)
        throw new Error("D6_DUPLICATE_CONFLICT");
      if (!instrumentExists) this.instruments.push(clone(bundle.instrument));
      await this.appendCandidate(bundle.synthetic_preview);
      if (studyStatus === "created") await this.appendAudit(audit);
      return studyStatus;
    } catch (error) {
      this.studies.splice(0, this.studies.length, ...studiesBefore);
      this.candidates.splice(0, this.candidates.length, ...candidatesBefore);
      this.instruments.splice(0, this.instruments.length, ...instrumentsBefore);
      this.audit.splice(0, this.audit.length, ...auditBefore);
      throw error;
    }
  }

  async retireStudy(
    tenantId: string,
    studyId: string,
    audit: TransferResearchAuditEntry
  ): Promise<TransferStudyDefinitionVersion | null> {
    const index = this.studies.findIndex(
      (candidate) =>
        candidate.study_ref.tenant_id === tenantId && candidate.study_ref.resource_id === studyId
    );
    if (index < 0) return null;
    const current = this.studies[index];
    if (!current) return null;
    if (current.lifecycle !== "RETIRED") {
      this.studies[index] = clone({ ...current, lifecycle: "RETIRED" });
      await this.appendAudit(audit);
    }
    const retired = this.studies[index];
    return retired ? clone(retired) : null;
  }
}
