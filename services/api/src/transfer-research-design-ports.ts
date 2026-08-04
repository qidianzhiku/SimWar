import type {
  TransferInstrumentVersion,
  TransferEvidenceRecordCandidate,
  TransferResearchDesignBundle,
  TransferResearchDesignInput,
  TransferResearchDesignListDto,
  TransferStudyDefinitionVersion
} from "@simwar/shared-contracts";

export type { TransferResearchDesignBundle };

export type TransferResearchAuditAction =
  | "D6_RESEARCH_DESIGN_FROZEN"
  | "D6_RESEARCH_DESIGN_REVISED"
  | "D6_RESEARCH_DESIGN_RETIRED";

export interface TransferResearchAuditEntry {
  readonly action: TransferResearchAuditAction;
  readonly actor_id: string;
  readonly audit_id: string;
  readonly created_at: string;
  readonly request_digest: string;
  readonly study_ref: TransferStudyDefinitionVersion["study_ref"];
  readonly tenant_id: string;
}

export interface TransferResearchDesignCommandPort {
  preview(
    tenantId: string,
    input: TransferResearchDesignInput
  ): Promise<TransferResearchDesignBundle>;
  freeze(
    actor: { actor_id: string; tenant_id: string },
    input: TransferResearchDesignInput
  ): Promise<{
    readonly bundle: TransferResearchDesignBundle;
    readonly status: "created" | "reused";
  }>;
  revise(
    actor: { actor_id: string; tenant_id: string },
    studyId: string,
    input: TransferResearchDesignInput
  ): Promise<{
    readonly bundle: TransferResearchDesignBundle;
    readonly status: "created" | "reused";
  }>;
  retire(
    actor: { actor_id: string; tenant_id: string },
    studyId: string
  ): Promise<TransferStudyDefinitionVersion>;
}

export interface TransferResearchDesignQueryPort {
  list(tenantId: string): Promise<TransferResearchDesignListDto>;
}

export interface TransferInstrumentRegistryPort {
  resolveInstrument(
    tenantId: string,
    instrumentId: string
  ): Promise<TransferInstrumentVersion | null>;
}

export interface SyntheticTransferPreviewPort {
  syntheticPreview(
    actor: { actor_id: string; tenant_id: string },
    studyId: string
  ): Promise<TransferEvidenceRecordCandidate>;
}

export interface ResearchAuditPort {
  appendAudit(entry: TransferResearchAuditEntry): Promise<void>;
  listAudit(tenantId: string): Promise<TransferResearchAuditEntry[]>;
}

export interface TransferResearchDesignPersistencePort
  extends TransferInstrumentRegistryPort, ResearchAuditPort {
  listStudies(tenantId: string): Promise<TransferStudyDefinitionVersion[]>;
  getStudy(tenantId: string, studyId: string): Promise<TransferStudyDefinitionVersion | null>;
  appendStudy(study: TransferStudyDefinitionVersion): Promise<"created" | "reused">;
  listCandidates(tenantId: string): Promise<TransferEvidenceRecordCandidate[]>;
  appendCandidate(candidate: TransferEvidenceRecordCandidate): Promise<"created" | "reused">;
  appendBundle(
    bundle: TransferResearchDesignBundle,
    audit: TransferResearchAuditEntry
  ): Promise<"created" | "reused">;
  retireStudy(
    tenantId: string,
    studyId: string,
    audit: TransferResearchAuditEntry
  ): Promise<TransferStudyDefinitionVersion | null>;
}
