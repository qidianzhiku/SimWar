import type { TeacherConfirmationVersion } from "@simwar/shared-contracts";

export { createJsonTeacherConfirmationRepositoryPort } from "./json-repository-adapter.js";

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
