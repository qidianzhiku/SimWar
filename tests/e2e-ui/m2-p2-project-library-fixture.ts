import { createP1Store } from "../../services/api/src/store";
import { getShanghaiMarketWorldReference } from "../../services/api/src/market-world-product";

const RUN_ID = "run_m2_p2_project_library_browser";
const ROUND_ID = "round_m2_p2_project_library_browser";

export function seedM2P2ProjectLibraryFixture(storeFile: string): void {
  const store = createP1Store({ persistenceFile: storeFile });
  if (
    store.runs.some((run) => run.run_id === RUN_ID) ||
    store.rounds.some((round) => round.round_id === ROUND_ID)
  ) {
    throw new Error("M2-P2 Project Library fixture must be seeded into a freshly reset store.");
  }
  const course = store.courses.find((candidate) => candidate.course_id === "course_demo");
  if (!course) throw new Error("M2-P2 fixture requires the default demo course.");
  course.market_world_reference = getShanghaiMarketWorldReference();
  store.runs.push({
    course_id: course.course_id,
    parameter_set_id: course.parameter_set_id,
    run_id: RUN_ID,
    scenario_package_id: course.scenario_package_id,
    seed: 20260821,
    status: "active",
    tenant_id: course.tenant_id
  });
  store.rounds.push({
    round_id: ROUND_ID,
    round_no: 1,
    run_id: RUN_ID,
    status: "open",
    tenant_id: course.tenant_id
  });
  store.persist();
}
