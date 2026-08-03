import type { TeacherConfirmationVersion } from "@simwar/shared-contracts";
import type {
  TeacherConfirmationAppendCommand,
  TeacherConfirmationRepositoryPort
} from "./repository-ports.js";
import type { SimWarStore } from "./store.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** JSON-only D3 registry; it is not a Truth, Settlement, or Student authority. */
export function createJsonTeacherConfirmationRepositoryPort(
  store: SimWarStore
): TeacherConfirmationRepositoryPort {
  return {
    async list(tenantId) {
      return clone(
        store.teacherConfirmationVersions.filter(
          (confirmation) => confirmation.confirmation_ref.tenant_id === tenantId
        )
      );
    },

    async append(command: TeacherConfirmationAppendCommand) {
      const previousConfirmations = clone(store.teacherConfirmationVersions);
      const previousAudits = clone(store.auditLogs);
      store.teacherConfirmationVersions.push(clone(command.confirmation));
      store.auditLogs.push(clone(command.audit_log));
      try {
        store.persist();
      } catch (error) {
        store.teacherConfirmationVersions.splice(
          0,
          store.teacherConfirmationVersions.length,
          ...previousConfirmations
        );
        store.auditLogs.splice(0, store.auditLogs.length, ...previousAudits);
        throw error;
      }
    }
  };
}

export function latestTeacherConfirmation(
  records: readonly TeacherConfirmationVersion[],
  tenantId: string,
  confirmationId: string
): TeacherConfirmationVersion | null {
  return (
    records
      .filter(
        (record) =>
          record.confirmation_ref.tenant_id === tenantId &&
          record.confirmation_ref.resource_id === confirmationId
      )
      .sort((left, right) => left.confirmation_ref.version.localeCompare(right.confirmation_ref.version))
      .at(-1) ?? null
  );
}
