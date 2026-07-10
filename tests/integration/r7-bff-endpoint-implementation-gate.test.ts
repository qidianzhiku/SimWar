import {
  R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_EXPLICIT_NON_PROOFS,
  createR7BffEndpointImplementationGate,
  validateR7BffEndpointImplementationGate
} from "@simwar/shared-contracts";
import { describe, expect, it } from "vitest";

describe("R7 BFF endpoint implementation gate", () => {
  it("requires Teacher-only, tenant-scoped prerequisites without enabling runtime", () => {
    const gate = createR7BffEndpointImplementationGate();

    expect(gate.evidence_kind).toBe("r7_bff_endpoint_implementation_gate");
    expect(gate.status).toBe("IMPLEMENTATION_GATE_ONLY");
    expect(gate.authorized_roles).toEqual(["teacher"]);
    expect(gate.request_context.required_fields).toEqual([
      "tenant_id",
      "course_id",
      "run_id",
      "teacher_id",
      "scenario_package_id",
      "parameter_set_id"
    ]);
    expect(gate.prerequisites).toEqual(
      expect.arrayContaining([
        "authenticated_teacher",
        "explicit_tenant_context",
        "course_run_authority",
        "approved_scenario_package",
        "read_only_parameterset_reference",
        "student_projection_negative_tests"
      ])
    );
    expect(gate.boundary.route_enabled).toBe(false);
    expect(gate.boundary.handler_enabled).toBe(false);
    expect(gate.boundary.frontend_fetch_enabled).toBe(false);
    expect(gate.boundary.runtime_activation_enabled).toBe(false);
    expect(gate.boundary.official_parameter_set_write).toBe(false);
    expect(gate.boundary.replay_execution_enabled).toBe(false);
    expect(gate.boundary.state_true_exposure).toBe(false);
    expect(validateR7BffEndpointImplementationGate(gate)).toEqual({
      issues: [],
      ok: true
    });
  });

  it("fails closed for Student, missing tenant and forbidden runtime drift", () => {
    const gate = createR7BffEndpointImplementationGate();
    const drifted = {
      ...gate,
      authorized_roles: ["teacher", "student"],
      request_context: { ...gate.request_context, tenant_required: false },
      boundary: {
        ...gate.boundary,
        route_enabled: true,
        official_parameter_set_write: true,
        state_true_exposure: true
      }
    };

    const result = validateR7BffEndpointImplementationGate(drifted);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "R7_BFF_GATE_ROLE_SCOPE_DRIFT",
        "R7_BFF_GATE_TENANT_CONTEXT_DRIFT",
        "R7_BFF_GATE_ROUTE_IMPLEMENTATION_DRIFT",
        "R7_BFF_GATE_PARAMETERSET_WRITE_DRIFT",
        "R7_BFF_GATE_TRUTH_VISIBILITY_DRIFT"
      ])
    );
  });

  it("keeps explicit no-go conditions and non-proofs reviewable", () => {
    const gate = createR7BffEndpointImplementationGate();

    expect(gate.no_go_register).toEqual(
      expect.arrayContaining([
        "student_invocation",
        "missing_tenant_context",
        "cross_tenant_scope",
        "private_replay_visibility",
        "official_result_overwrite",
        "runtime_activation"
      ])
    );
    expect(R7_BFF_ENDPOINT_IMPLEMENTATION_GATE_EXPLICIT_NON_PROOFS).toEqual(
      expect.arrayContaining([
        "implementation gate != endpoint implementation",
        "gate pass != Owner authorization"
      ])
    );
  });
});
