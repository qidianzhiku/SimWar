import type {
  TransferEvidenceRecordCandidate,
  TransferResearchDesignBundle,
  TransferStudyDefinitionVersion
} from "@simwar/shared-contracts";

export type { TransferResearchDesignBundle };

export interface TransferResearchDesignPersistencePort {
  listStudies(tenantId: string): Promise<TransferStudyDefinitionVersion[]>;
  getStudy(tenantId: string, studyId: string): Promise<TransferStudyDefinitionVersion | null>;
  appendStudy(study: TransferStudyDefinitionVersion): Promise<"created" | "reused">;
  listCandidates(tenantId: string): Promise<TransferEvidenceRecordCandidate[]>;
  appendCandidate(candidate: TransferEvidenceRecordCandidate): Promise<"created" | "reused">;
}
