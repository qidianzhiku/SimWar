import type {
  TeacherConfirmationTeacherDto,
  TeacherConfirmationVersion
} from "@simwar/shared-contracts";
import { TeacherConfirmationCommandService } from "./teacher-confirmation.js";

const KNOWN_LIMITS = [
  "D3 confirmation is teacher-only and is not final grading.",
  "JSON_INTERNAL_ONLY is the active runtime authority; durable locking and recovery are not proven.",
  "D3 does not write Truth, SettlementResult, Score, Rank, or Replay authority.",
  "Human Validation is not performed."
] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class TeacherConfirmationQueryService {
  constructor(private readonly commands: TeacherConfirmationCommandService) {}

  async listTeacher(tenantId: string): Promise<{
    confirmations: readonly TeacherConfirmationVersion[];
    known_limits: readonly string[];
    runtime_authority: "JSON_INTERNAL_ONLY";
  }> {
    return {
      confirmations: clone(await this.commands.list(tenantId)),
      known_limits: [...KNOWN_LIMITS],
      runtime_authority: "JSON_INTERNAL_ONLY"
    };
  }

  async getTeacher(tenantId: string, confirmationId: string): Promise<TeacherConfirmationTeacherDto | null> {
    const result = await this.commands.list(tenantId);
    const candidates = result
      .filter((confirmation) => confirmation.confirmation_ref.resource_id === confirmationId)
      .sort((left, right) => left.confirmation_ref.version.localeCompare(right.confirmation_ref.version));
    const confirmation = candidates.at(-1);
    return confirmation
      ? { confirmation: clone(confirmation), known_limits: [...KNOWN_LIMITS], runtime_authority: "JSON_INTERNAL_ONLY" }
      : null;
  }
}
