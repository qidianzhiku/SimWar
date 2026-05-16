import { createHealthPayload, type HealthPayload } from "@simwar/shared-contracts";

export function getApiHealthPayload(): HealthPayload {
  return createHealthPayload("@simwar/api");
}
