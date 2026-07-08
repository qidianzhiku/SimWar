import { expect, test } from "@playwright/test";
import {
  L1_RUNTIME_PATH_ACTIVATION_FORBIDDEN_STUDENT_MARKERS,
  L1_RUNTIME_PATH_ACTIVATION_REQUIRED_ACTIONS
} from "../../services/api/src/l1-runtime-path-activation";

test("renders runtime path activation evidence without expanding student visibility", async ({
  page
}) => {
  const runtimeActivationSummary = {
    direct_store_delta: "NONE",
    evidence_kind: "l1_runtime_path_activation_package",
    g0_pass: "NOT_GRANTED",
    g0_status: "EXCEPTION",
    helper_path_classification: [
      {
        classification: "HELPER_PATH",
        runtime_caller_observed: false,
        symbol: "createL1InternalValidationReadyPackage"
      },
      {
        classification: "RUNTIME_PATH",
        runtime_caller_observed: true,
        symbol: "routeRequest"
      }
    ],
    l1_status: "NOT_READY",
    runtime_path_activation_boundary:
      "EXISTING_CONTROLLED_API_PATHS_CONNECTED_PENDING_INDEPENDENT_REVIEW",
    runtime_paths: L1_RUNTIME_PATH_ACTIVATION_REQUIRED_ACTIONS
  };

  await page.setContent(
    `<main>
      <h1>L1 Runtime Path Activation</h1>
      <pre>${JSON.stringify(runtimeActivationSummary, null, 2)}</pre>
      <section aria-label="student visible result">
        <h2>Student result projection</h2>
        <p>redacted result only</p>
        <p>replay evidence visible: false</p>
        <p>protected truth visible: false</p>
      </section>
    </main>`
  );

  await expect(page.getByText("l1_runtime_path_activation_package")).toBeVisible();
  await expect(page.getByText("EXISTING_CONTROLLED_API_PATHS_CONNECTED")).toBeVisible();
  await expect(page.getByText("decision.submit")).toBeVisible();
  await expect(page.getByText("createL1InternalValidationReadyPackage")).toBeVisible();
  await expect(page.getByText("routeRequest")).toBeVisible();
  await expect(page.getByText("NOT_READY")).toBeVisible();

  const studentVisibleText = await page
    .getByRole("region", { name: "student visible result" })
    .innerText();
  for (const marker of L1_RUNTIME_PATH_ACTIVATION_FORBIDDEN_STUDENT_MARKERS) {
    expect(studentVisibleText).not.toContain(marker);
  }
});
