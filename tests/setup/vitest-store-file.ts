import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.SIMWAR_STORE_FILE ??= join(
  tmpdir(),
  `simwar-vitest-store-${process.pid}-${process.env.VITEST_WORKER_ID ?? "worker"}-${randomUUID()}.json`
);
