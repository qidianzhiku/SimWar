import {
  R7_BFF_ENDPOINT_CONTRACT_EXPLICIT_NON_PROOFS,
  createR7BffEndpointContractDraft,
  validateR7BffEndpointContractDraft
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";

describe("R7 BFF endpoint contract draft without implementation", () => {
  it("defines a future contract without enabling a route or runtime", () => {
    const draft = createR7BffEndpointContractDraft();

    expect(draft.evidence_kind).toBe("r7_bff_endpoint_contract_draft_no_implementation");
    expect(draft.status).toBe("CONTRACT_DRAFT_ONLY");
    expect(draft.request_context.tenant_id).toBe("required");
    expect(draft.response_contract.student_visibility).toBe("redacted_projection_only");
    expect(draft.boundary.api_route_enabled).toBe(false);
    expect(draft.boundary.bff_endpoint_enabled).toBe(false);
    expect(draft.boundary.frontend_fetch_enabled).toBe(false);
    expect(draft.boundary.io_enabled).toBe(false);
    expect(draft.boundary.runtime_activation_enabled).toBe(false);
    expect(draft.boundary.official_parameter_set_write).toBe(false);
    expect(draft.boundary.replay_execution_enabled).toBe(false);
    expect(draft.boundary.settlement_result_write).toBe(false);
    expect(draft.boundary.state_true_exposure).toBe(false);
    expect(validateR7BffEndpointContractDraft(draft)).toEqual({ issues: [], ok: true });
    expect(R7_BFF_ENDPOINT_CONTRACT_EXPLICIT_NON_PROOFS).toContain(
      "BFF endpoint contract != BFF endpoint implementation"
    );
  });

  it("fails closed when implementation or truth boundaries drift", () => {
    const draft = createR7BffEndpointContractDraft();
    const drifted = {
      ...draft,
      boundary: { ...draft.boundary, api_route_enabled: true },
      response_contract: { ...draft.response_contract, state_true_exposed: true }
    };

    const result = validateR7BffEndpointContractDraft(drifted);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "R7_BFF_ENDPOINT_ROUTE_IMPLEMENTATION_DRIFT",
        "R7_BFF_ENDPOINT_STATE_TRUE_EXPOSURE_DRIFT"
      ])
    );
  });

  it("keeps future endpoint context explicit without creating an endpoint", () => {
    const draft = createR7BffEndpointContractDraft();

    expect(draft.request_context.required_fields).toEqual([
      "tenant_id",
      "course_id",
      "run_id",
      "scenario_package_id",
      "parameter_set_id"
    ]);
    expect(draft.allowed_future_gate).toBe("OWNER_AUTHORIZED_R7_BFF_ENDPOINT_IMPLEMENTATION");
    expect(draft.no_go_register).toEqual(
      expect.arrayContaining([
        "student_private_visibility",
        "cross_tenant_scope",
        "direct_internal_route_access",
        "official_result_overwrite"
      ])
    );
  });
});
