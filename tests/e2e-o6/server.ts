import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createApiServer } from "../../services/api/src/server";
import { createP1Store } from "../../services/api/src/store";
import { seedO5FormalCourse } from "../helpers/model-qualification-o5-product-fixture";
import { resolvePlaywrightStoreFile } from "../e2e-ui/store-isolation";

const persistenceFile = resolvePlaywrightStoreFile();
mkdirSync(dirname(persistenceFile), { recursive: true });
const store = createP1Store({ persistenceFile });
await seedO5FormalCourse(store);
const server = createApiServer(store);
server.listen(Number(process.env.API_PORT ?? 3610), "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
