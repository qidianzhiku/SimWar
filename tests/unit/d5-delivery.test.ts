import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { LearningExportBundleVersion } from "@simwar/shared-contracts";
import { D5DeliveryService } from "../../services/api/src/d5-delivery.js";
import { InMemoryD5ExportRegistry } from "../../services/api/src/d5-export-registry.js";

const bundle = JSON.parse(
  readFileSync(resolve(process.cwd(), "contracts/fixtures/d5-export.valid.json"), "utf8")
) as LearningExportBundleVersion;

function service(registry: InMemoryD5ExportRegistry) {
  return new D5DeliveryService({
    repository: registry,
    assembler: { getDestination: () => ({ destination_ref: bundle.statement_batch.destination_ref }) },
    now: () => "2026-08-04T00:00:00.000Z"
  });
}

describe("D5 Mock LRS delivery", () => {
  it("is idempotent for the same sealed bundle and preserves its digest", async () => {
    const registry = new InMemoryD5ExportRegistry();
    await registry.appendBundle(bundle);
    const delivery = service(registry);
    const input = { bundle_ref: bundle.bundle_ref, idempotency_key: "d5_job_same" };
    const first = await delivery.createJob({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, input);
    const second = await delivery.createJob({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, input);
    expect(first.status).toBe("created");
    expect(first.job.status).toBe("DELIVERED");
    expect(second.status).toBe("reused");
    expect((await registry.listReceipts("tenant_demo"))[0]?.sealed_payload_digest).toBe(bundle.bundle_digest);
  });

  it("keeps timeout retryable and retries the same sealed payload", async () => {
    const registry = new InMemoryD5ExportRegistry();
    await registry.appendBundle(bundle);
    const delivery = service(registry);
    const first = await delivery.createJob(
      { actor_id: "usr_teacher", tenant_id: "tenant_demo" },
      { bundle_ref: bundle.bundle_ref, idempotency_key: "d5_job_retry" },
      "TIMEOUT"
    );
    expect(first.job.status).toBe("RETRYABLE");
    const retried = await delivery.retryJob({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, first.job.job_ref.resource_id);
    expect(retried.status).toBe("DELIVERED");
    expect(retried.attempt_count).toBe(2);
    expect((await registry.listAttempts("tenant_demo", retried.job_ref.resource_id)).every((attempt) => attempt.sealed_payload_digest === bundle.bundle_digest)).toBe(true);
  });

  it("does not cancel a delivered job", async () => {
    const registry = new InMemoryD5ExportRegistry();
    await registry.appendBundle(bundle);
    const delivery = service(registry);
    const result = await delivery.createJob({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, { bundle_ref: bundle.bundle_ref, idempotency_key: "d5_job_done" });
    await expect(delivery.cancelJob({ actor_id: "usr_teacher", tenant_id: "tenant_demo" }, result.job.job_ref.resource_id)).rejects.toMatchObject({ code: "D5_EXPORT_CANCEL_FORBIDDEN" });
  });
});
