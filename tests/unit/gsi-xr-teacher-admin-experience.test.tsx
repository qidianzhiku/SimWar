/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
  GSIExactBinding,
  GSICrossRoundAdminProjection,
  GSICrossRoundTeacherProjection
} from "@simwar/shared-contracts";
import { GovernedStakeholderIntelligenceAuditPanel } from "../../apps/admin/src/GovernedStakeholderIntelligenceAuditPanel";
import { GovernedStakeholderIntelligenceWorkspace } from "../../apps/teacher/src/GovernedStakeholderIntelligenceWorkspace";

const teacherComparison = {
  surface: "teacher",
  comparison: {
    discriminator: "gsi_cross_round_comparison",
    pair: {
      tenant_id: "tenant_demo",
      course_id: "course_demo",
      run_id: "run_demo",
      team_id: "team_demo",
      from: {
        candidate_id: "candidate_from",
        candidate_digest: "a".repeat(64),
        round_id: "round_1",
        round_no: 1
      },
      to: {
        candidate_id: "candidate_to",
        candidate_digest: "b".repeat(64),
        round_id: "round_2",
        round_no: 2
      }
    },
    movements: [
      {
        signal_key: "customer:protect_demand",
        stakeholder_type: "customer",
        intent: "protect_demand",
        from_value: 0.2,
        to_value: 0.7,
        delta: 0.5,
        direction: "INCREASED"
      }
    ],
    comparison_digest: "c".repeat(64),
    non_causal: true,
    causal_proof: false,
    known_limits: ["descriptive only"]
  },
  context: {
    status: "CONTEXT_UNAVAILABLE",
    context: {
      activity_id: "activity_demo",
      course_id: "course_demo",
      role_key: "CEO",
      round_id: "round_2",
      round_no: 2,
      run_id: "run_demo",
      team_id: "team_demo",
      tenant_id: "tenant_demo"
    },
    anchors: [],
    context_digest: "d".repeat(64),
    non_causal: true,
    causal_proof: false,
    official_outcome_recomputed: false,
    official_truth_write: false,
    recovery: "WAIT_FOR_PUBLICATION",
    known_limits: ["context unavailable"]
  },
  provider: "OFF",
  official_truth_write: false,
  known_limits: ["descriptive only"],
  recovery: "WAIT_FOR_PUBLICATION"
} satisfies GSICrossRoundTeacherProjection;

const adminComparison = {
  surface: "admin",
  tenant_id: "tenant_demo",
  comparison: teacherComparison.comparison,
  context: { ...teacherComparison.context, context_binding: teacherComparison.context.context },
  provider: "OFF",
  official_truth_write: false,
  known_limits: ["read-only"],
  recovery: "WAIT_FOR_PUBLICATION"
} satisfies GSICrossRoundAdminProjection;

const teacherComparisonForRequest = {
  ...teacherComparison,
  context: {
    ...teacherComparison.context,
    context: { ...teacherComparison.context.context, activity_id: "activity_gsi_xr" }
  }
} satisfies GSICrossRoundTeacherProjection;

const adminComparisonForRequest = {
  ...adminComparison,
  context: {
    ...adminComparison.context,
    context: { ...adminComparison.context.context, activity_id: "activity_gsi_xr" },
    context_binding: {
      ...adminComparison.context.context_binding,
      activity_id: "activity_gsi_xr"
    }
  }
} satisfies GSICrossRoundAdminProjection;

const pairOptionsBinding = {
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  run_id: "run_demo",
  round_id: "round_1",
  round_no: 1,
  activity_id: "activity_gsi_xr",
  role_key: "CEO",
  team_id: "team_demo",
  scenario_package_id: "scenario_demo",
  scenario_version: "1.0.0",
  parameter_set_id: "parameter_demo",
  parameter_set_version: "1.0.0",
  model_version_id: "model_demo",
  model_version: "1.0.0",
  model_artifact_id: "artifact_demo",
  model_artifact_version: "1.0.0"
} satisfies GSIExactBinding;

type PairOptionsSurface = "teacher" | "admin";
type InvalidPairOptionsCase =
  | "malformed"
  | "wrong surface"
  | "wrong tenant"
  | "wrong context"
  | "forbidden code"
  | "own error null"
  | "own error undefined"
  | "own error object message"
  | "own error array message"
  | "own error number message"
  | "null envelope"
  | "non-object envelope";
type InvalidSuccessEnvelopeCase =
  | "missing success code"
  | "undefined success code"
  | "missing success message"
  | "missing request id"
  | "nonstring success message"
  | "nonstring request id"
  | "extra envelope field";
type PairSelectionContextField = "course_id" | "run_id" | "team_id" | "activity_id" | "role_key";
type InvalidComparisonEnvelopeCase =
  | "nonOK code"
  | "own error null"
  | "own error array"
  | "top-level API error";
type ComparisonIdentityCase =
  | "wrong tenant"
  | "wrong candidate"
  | "wrong activity"
  | "wrong role"
  | "wrong context round"
  | "wrong internal binding";

const invalidPairOptionsCases: readonly (InvalidPairOptionsCase | InvalidSuccessEnvelopeCase)[] = [
  "malformed",
  "wrong surface",
  "wrong tenant",
  "forbidden code",
  "own error null",
  "own error undefined",
  "own error object message",
  "own error array message",
  "own error number message",
  "null envelope",
  "non-object envelope",
  "missing success code",
  "undefined success code",
  "missing success message",
  "missing request id",
  "nonstring success message",
  "nonstring request id",
  "extra envelope field"
];
const pairSelectionContextFields: readonly PairSelectionContextField[] = [
  "course_id",
  "run_id",
  "team_id",
  "activity_id",
  "role_key"
];

function makeValidPairOptionsPayload(surface: PairOptionsSurface) {
  const context = {
    tenant_id: "tenant_demo",
    course_id: "course_demo",
    run_id: "run_demo",
    team_id: "team_demo",
    activity_id: "activity_gsi_xr",
    role_key: "CEO"
  };
  const valid = {
    surface,
    context,
    rounds: [
      { round_id: "round_1", round_no: 1 },
      { round_id: "round_2", round_no: 2 }
    ],
    provider: "OFF",
    official_truth_write: false,
    non_causal: true,
    causal_proof: false,
    known_limits: ["descriptive only"]
  };
  return {
    surface,
    context,
    rounds: valid.rounds,
    provider: valid.provider,
    official_truth_write: valid.official_truth_write,
    non_causal: valid.non_causal,
    causal_proof: valid.causal_proof,
    known_limits: valid.known_limits
  };
}

function makePairOptionsPayload(
  surface: PairOptionsSurface,
  invalidCase: InvalidPairOptionsCase | InvalidSuccessEnvelopeCase,
  wrongContextField?: PairSelectionContextField
): unknown {
  const valid = makeValidPairOptionsPayload(surface);
  const success = { code: "OK", data: valid, message: "OK", request_id: "req_pair_options" };
  if (invalidCase === "missing success code") {
    return { data: valid, message: "OK", request_id: "req_pair_options" };
  }
  if (invalidCase === "undefined success code") return { ...success, code: undefined };
  if (invalidCase === "missing success message") {
    return { code: "OK", data: valid, request_id: "req_pair_options" };
  }
  if (invalidCase === "missing request id") {
    return { code: "OK", data: valid, message: "OK" };
  }
  if (invalidCase === "nonstring success message") return { ...success, message: 1 };
  if (invalidCase === "nonstring request id") return { ...success, request_id: null };
  if (invalidCase === "extra envelope field") return { ...success, unexpected: true };
  if (invalidCase === "malformed") {
    return { ...success, data: { surface, context: valid.context, rounds: valid.rounds } };
  }
  if (invalidCase === "wrong surface") {
    return {
      ...success,
      data: { ...valid, surface: surface === "teacher" ? "student" : "teacher" }
    };
  }
  if (invalidCase === "wrong tenant") {
    return {
      ...success,
      data: { ...valid, context: { ...valid.context, tenant_id: "tenant_other" } }
    };
  }
  if (invalidCase === "wrong context") {
    const field = wrongContextField ?? "activity_id";
    return {
      ...success,
      data: { ...valid, context: { ...valid.context, [field]: `unexpected_${field}` } }
    };
  }
  if (invalidCase === "forbidden code") {
    return { ...success, code: "FORBIDDEN" };
  }
  if (invalidCase === "own error null") {
    return { ...success, error: null };
  }
  if (invalidCase === "own error undefined") {
    return { ...success, error: undefined };
  }
  if (invalidCase === "own error object message") {
    return {
      ...success,
      error: { code: "GSI_PAIR_NOT_AVAILABLE", message: { reason: "malformed" } }
    };
  }
  if (invalidCase === "own error array message") {
    return {
      ...success,
      error: { code: "GSI_PAIR_NOT_AVAILABLE", message: ["malformed"] }
    };
  }
  if (invalidCase === "own error number message") {
    return {
      ...success,
      error: { code: "GSI_PAIR_NOT_AVAILABLE", message: 409 }
    };
  }
  if (invalidCase === "null envelope") {
    return null;
  }
  return "not-an-envelope";
}

function responseWithJson(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => payload
  } as Response;
}

async function setInputValue(host: HTMLElement, label: string, value: string): Promise<void> {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function invalidComparisonPayload(
  surface: "teacher" | "admin",
  invalidCase:
    | "null data"
    | "array data"
    | "missing comparison"
    | "array movements"
    | "wrong digest type"
    | "wrong context status"
    | "array direction"
    | "array recovery"
    | "reserved identifier"
): unknown {
  const base = surface === "teacher" ? teacherComparison : adminComparison;
  if (invalidCase === "null data") return null;
  if (invalidCase === "array data") return [];
  if (invalidCase === "missing comparison") {
    return Object.fromEntries(Object.entries(base).filter(([key]) => key !== "comparison"));
  }
  if (invalidCase === "array movements") {
    return { ...base, comparison: { ...base.comparison, movements: "not-an-array" } };
  }
  if (invalidCase === "wrong digest type") {
    return { ...base, comparison: { ...base.comparison, comparison_digest: 7 } };
  }
  if (invalidCase === "array direction") {
    return {
      ...base,
      comparison: {
        ...base.comparison,
        movements: base.comparison.movements.map((movement) => ({
          ...movement,
          direction: ["INCREASED"]
        }))
      }
    };
  }
  if (invalidCase === "array recovery") {
    return {
      ...base,
      context: { ...base.context, recovery: ["WAIT_FOR_PUBLICATION"] }
    };
  }
  if (invalidCase === "reserved identifier") {
    return {
      ...base,
      comparison: {
        ...base.comparison,
        pair: {
          ...base.comparison.pair,
          from: { ...base.comparison.pair.from, candidate_id: "latest" }
        }
      }
    };
  }
  return { ...base, context: { ...base.context, status: "NOT_A_STATUS" } };
}

function invalidComparisonEnvelope(
  surface: PairOptionsSurface,
  invalidCase: InvalidComparisonEnvelopeCase
): unknown {
  const data = surface === "teacher" ? teacherComparisonForRequest : adminComparisonForRequest;
  if (invalidCase === "nonOK code") {
    return { code: "FORBIDDEN", data, message: "top-level forbidden" };
  }
  if (invalidCase === "own error null") return { data, error: null };
  if (invalidCase === "own error array") return { data, error: ["malformed"] };
  return { code: "GSI_REBASE_REQUIRED", message: "top-level rebase" };
}

function comparisonForIdentityCase(
  surface: PairOptionsSurface,
  invalidCase: ComparisonIdentityCase
): unknown {
  if (surface === "teacher") {
    const base = teacherComparisonForRequest;
    if (invalidCase === "wrong tenant") {
      return {
        ...base,
        comparison: {
          ...base.comparison,
          pair: { ...base.comparison.pair, tenant_id: "tenant_other" }
        },
        context: {
          ...base.context,
          context: { ...base.context.context, tenant_id: "tenant_other" }
        }
      };
    }
    if (invalidCase === "wrong candidate") {
      return {
        ...base,
        comparison: {
          ...base.comparison,
          pair: {
            ...base.comparison.pair,
            from: { ...base.comparison.pair.from, candidate_id: "candidate_other" }
          }
        }
      };
    }
    if (invalidCase === "wrong activity") {
      return {
        ...base,
        context: {
          ...base.context,
          context: { ...base.context.context, activity_id: "activity_other" }
        }
      };
    }
    if (invalidCase === "wrong role") {
      return {
        ...base,
        context: { ...base.context, context: { ...base.context.context, role_key: "CFO" } }
      };
    }
    if (invalidCase === "wrong context round") {
      return {
        ...base,
        context: {
          ...base.context,
          context: { ...base.context.context, round_id: "round_1", round_no: 1 }
        }
      };
    }
    return {
      ...base,
      context: { ...base.context, context: { ...base.context.context, course_id: "course_other" } }
    };
  }

  const base = adminComparisonForRequest;
  if (invalidCase === "wrong tenant") {
    return {
      ...base,
      comparison: {
        ...base.comparison,
        pair: { ...base.comparison.pair, tenant_id: "tenant_other" }
      },
      context: {
        ...base.context,
        context: { ...base.context.context, tenant_id: "tenant_other" },
        context_binding: { ...base.context.context_binding, tenant_id: "tenant_other" }
      }
    };
  }
  if (invalidCase === "wrong candidate") {
    return {
      ...base,
      comparison: {
        ...base.comparison,
        pair: {
          ...base.comparison.pair,
          from: { ...base.comparison.pair.from, candidate_id: "candidate_other" }
        }
      }
    };
  }
  if (invalidCase === "wrong activity") {
    return {
      ...base,
      context: {
        ...base.context,
        context: { ...base.context.context, activity_id: "activity_other" },
        context_binding: { ...base.context.context_binding, activity_id: "activity_other" }
      }
    };
  }
  if (invalidCase === "wrong role") {
    return {
      ...base,
      context: {
        ...base.context,
        context: { ...base.context.context, role_key: "CFO" },
        context_binding: { ...base.context.context_binding, role_key: "CFO" }
      }
    };
  }
  if (invalidCase === "wrong context round") {
    return {
      ...base,
      context: {
        ...base.context,
        context: { ...base.context.context, round_id: "round_1", round_no: 1 },
        context_binding: { ...base.context.context_binding, round_id: "round_1", round_no: 1 }
      }
    };
  }
  return {
    ...base,
    context: {
      ...base.context,
      context_binding: { ...base.context.context_binding, role_key: "CFO" }
    }
  };
}

async function enterAdminContext(host: HTMLElement): Promise<void> {
  for (const [label, value] of [
    ["GSI admin course context", "course_demo"],
    ["GSI admin run context", "run_demo"],
    ["GSI admin team context", "team_demo"]
  ] as const) {
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

async function submitCandidateComparison(
  host: HTMLElement,
  surface: PairOptionsSurface
): Promise<void> {
  await setInputValue(
    host,
    `${surface === "teacher" ? "GSI" : "GSI admin"} from candidate ID`,
    "candidate_from"
  );
  await setInputValue(
    host,
    `${surface === "teacher" ? "GSI" : "GSI admin"} to candidate ID`,
    "candidate_to"
  );
  await act(async () => {
    host
      .querySelector<HTMLFormElement>(
        surface === "teacher"
          ? 'form[aria-label="GSI exact cross-round comparison"]'
          : 'form[aria-label="GSI admin exact cross-round comparison"]'
      )!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("GSI-XR Teacher/Admin experience", () => {
  it.each(["success", "error"])(
    "ignores late Admin audit %s across identity changes",
    async (outcome) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      let finish!: (value: Response) => void;
      let fail!: (error: Error) => void;
      let signal: AbortSignal | undefined;
      const pending = new Promise<Response>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_input, options) => {
        signal = options?.signal as AbortSignal;
        return pending;
      });
      const host = document.createElement("div");
      const root = createRoot(host);
      try {
        await act(async () => {
          root.render(
            <GovernedStakeholderIntelligenceAuditPanel
              apiBase="http://api.test"
              tenantId="tenant_one"
              token="old"
              initialCandidateId="candidate_one"
            />
          );
        });
        await act(async () => {
          host
            .querySelectorAll("form")[1]!
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        await act(async () => {
          root.render(
            <GovernedStakeholderIntelligenceAuditPanel
              apiBase="http://api.test"
              tenantId="tenant_two"
              token="new"
              initialCandidateId="candidate_one"
            />
          );
        });
        expect(signal?.aborted).toBe(true);
        await act(async () => {
          if (outcome === "error") fail(new Error("late private audit"));
          else
            finish(
              new Response(
                JSON.stringify({
                  data: {
                    provider: "OFF",
                    candidate_digest: "late_private_audit",
                    writes_official_truth: false
                  }
                }),
                { status: 200 }
              )
            );
        });
        expect(host.textContent).not.toContain("late_private_audit");
        expect(host.textContent).not.toContain("late private audit");
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
      }
    }
  );

  it("makes exact pair selection primary and keeps candidate provenance advanced-only", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceWorkspace
        apiBase="http://api.test"
        binding={{
          tenant_id: "tenant_demo",
          course_id: "course_demo",
          run_id: "run_demo",
          round_id: "round_1",
          round_no: 1,
          activity_id: "activity_gsi_xr",
          role_key: "CEO",
          team_id: "team_demo",
          scenario_package_id: "scenario_demo",
          scenario_version: "1.0.0",
          parameter_set_id: "parameter_demo",
          parameter_set_version: "1.0.0",
          model_version_id: "model_demo",
          model_version: "1.0.0",
          model_artifact_id: "artifact_demo",
          model_artifact_version: "1.0.0"
        }}
        tenantId="tenant_demo"
        token="token"
        initialComparison={teacherComparison}
      />
    );
    expect(markup).toContain("对比两个回合");
    expect(markup).toContain("Round 1");
    expect(markup).toContain("Round 2");
    expect(markup).toContain("INCREASED");
    expect(markup).toContain("CONTEXT_UNAVAILABLE");
    expect(markup).toContain("NON-CAUSAL");
    expect(markup).toContain("candidate_from");
    expect(markup).toContain("高级");
  });

  it("does not disguise a missing server pair selector as an empty ready state", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceWorkspace
        apiBase="http://api.test"
        binding={{
          tenant_id: "tenant_demo",
          course_id: "course_demo",
          run_id: "run_demo",
          round_id: "round_1",
          team_id: "team_demo",
          scenario_package_id: "scenario_demo",
          scenario_version: "1.0.0",
          parameter_set_id: "parameter_demo",
          parameter_set_version: "1.0.0",
          model_version_id: "model_demo",
          model_version: "1.0.0",
          model_artifact_id: "artifact_demo",
          model_artifact_version: "1.0.0"
        }}
        tenantId="tenant_demo"
        token="token"
      />
    );
    expect(markup).toContain("PAIR_SELECTION_UNAVAILABLE");
    expect(markup).toContain("服务器尚未提供可用的回合配对列表");
  });

  it("keeps Admin provenance secondary and collapsed with no-write/non-causal markers", () => {
    const markup = renderToStaticMarkup(
      <GovernedStakeholderIntelligenceAuditPanel
        apiBase="http://api.test"
        tenantId="tenant_demo"
        token="token"
        initialComparison={adminComparison}
      />
    );
    expect(markup).toContain("审计两个回合");
    expect(markup).toContain("tenant_demo");
    expect(markup).toContain("gsi-xr-admin-provenance-details");
    expect(markup).toContain("Technical provenance (secondary)");
    expect(markup).not.toContain("gsi-xr-admin-provenance-details open");
    expect(markup).toContain("context_binding");
    expect(markup).toContain("NON-CAUSAL");
    expect(markup).toContain("不写入正式 Decision / Settlement / Outcome");
    expect(markup).toContain("DDT admin exact round ID");
    expect(markup).toContain("不依赖 GSI 比较配对");
  });

  it.each(
    (["teacher", "admin"] as const).flatMap((surface) =>
      (
        [
          "null data",
          "array data",
          "missing comparison",
          "array movements",
          "wrong digest type",
          "wrong context status",
          "array direction",
          "array recovery",
          "reserved identifier"
        ] as const
      ).map((invalidCase) => ({ surface, invalidCase }))
    )
  )(
    "fails closed for a mounted $surface component on an invalid compare payload: $invalidCase",
    async ({ surface, invalidCase }) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          responseWithJson({ data: invalidComparisonPayload(surface, invalidCase) })
        );
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
        });
        const prefix = surface === "teacher" ? "GSI" : "GSI admin";
        await setInputValue(host, `${prefix} from candidate ID`, "candidate_from");
        await setInputValue(host, `${prefix} to candidate ID`, "candidate_to");
        await act(async () => {
          host
            .querySelector<HTMLFormElement>(
              surface === "teacher"
                ? 'form[aria-label="GSI exact cross-round comparison"]'
                : 'form[aria-label="GSI admin exact cross-round comparison"]'
            )!
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          await Promise.resolve();
          await Promise.resolve();
        });
        expect(
          host.querySelector(
            surface === "teacher"
              ? '[aria-label="GSI cross-round comparison result"]'
              : '[aria-label="GSI admin cross-round comparison result"]'
          )
        ).toBeNull();
        expect(host.textContent).toContain("比较暂不可用");
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );

  it.each(
    (["teacher", "admin"] as const).flatMap((surface) =>
      (["nonOK code", "own error null", "own error array", "top-level API error"] as const).map(
        (invalidCase) => ({ surface, invalidCase })
      )
    )
  )(
    "fails closed for a mounted $surface component on a malformed compare envelope: $invalidCase",
    async ({ surface, invalidCase }) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(responseWithJson(invalidComparisonEnvelope(surface, invalidCase)));
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
        });
        await submitCandidateComparison(host, surface);
        expect(
          host.querySelector(
            surface === "teacher"
              ? '[aria-label="GSI cross-round comparison result"]'
              : '[aria-label="GSI admin cross-round comparison result"]'
          )
        ).toBeNull();
        expect(host.textContent).toContain(
          invalidCase === "top-level API error"
            ? "top-level rebase"
            : invalidCase === "nonOK code"
              ? "top-level forbidden"
              : "比较暂不可用"
        );
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );

  it.each(["teacher", "admin"] as const)(
    "admits a mounted %s component for a valid compare fetch without a code field",
    async (surface) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const requestUrls: string[] = [];
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        requestUrls.push(url);
        if (url.includes("/pair-options?")) {
          return responseWithJson({
            code: "OK",
            data: makeValidPairOptionsPayload(surface),
            message: "OK",
            request_id: "req_pair_options"
          });
        }
        return responseWithJson({
          data: surface === "teacher" ? teacherComparisonForRequest : adminComparisonForRequest
        });
      });
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
          await Promise.resolve();
          await Promise.resolve();
        });
        await submitCandidateComparison(host, surface);
        expect(
          host.querySelector(
            surface === "teacher"
              ? '[aria-label="GSI cross-round comparison result"]'
              : '[aria-label="GSI admin cross-round comparison result"]'
          )
        ).not.toBeNull();
        const compareUrl = requestUrls.find((url) => url.includes("/compare?"));
        expect(compareUrl).toBeDefined();
        const query = new URL(compareUrl!).searchParams;
        expect(query.get("from_candidate_id")).toBe("candidate_from");
        expect(query.get("to_candidate_id")).toBe("candidate_to");
        expect(query.get("course_id")).toBeNull();
        expect(query.get("run_id")).toBeNull();
        expect(query.get("team_id")).toBeNull();
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );

  it.each(
    (["teacher", "admin"] as const).flatMap((surface) =>
      (
        [
          "wrong tenant",
          "wrong candidate",
          "wrong activity",
          "wrong role",
          "wrong context round",
          "wrong internal binding"
        ] as const
      ).map((invalidCase) => ({ surface, invalidCase }))
    )
  )(
    "fails closed for a mounted $surface component when compare identity is not bound: $invalidCase",
    async ({ surface, invalidCase }) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        responseWithJson({
          code: "OK",
          data: comparisonForIdentityCase(surface, invalidCase)
        })
      );
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
        });
        await submitCandidateComparison(host, surface);
        expect(
          host.querySelector(
            surface === "teacher"
              ? '[aria-label="GSI cross-round comparison result"]'
              : '[aria-label="GSI admin cross-round comparison result"]'
          )
        ).toBeNull();
        expect(host.textContent).toContain("比较暂不可用");
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );

  it("rejects an Admin candidate comparison when a populated scope field differs", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const response = {
      ...adminComparisonForRequest,
      comparison: {
        ...adminComparisonForRequest.comparison,
        pair: { ...adminComparisonForRequest.comparison.pair, course_id: "course_response" }
      },
      context: {
        ...adminComparisonForRequest.context,
        context: { ...adminComparisonForRequest.context.context, course_id: "course_response" },
        context_binding: {
          ...adminComparisonForRequest.context.context_binding,
          course_id: "course_response"
        }
      }
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(responseWithJson({ code: "OK", data: response }));
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.append(host);
    try {
      await act(async () => {
        root.render(
          <GovernedStakeholderIntelligenceAuditPanel
            apiBase="http://api.test"
            tenantId="tenant_demo"
            token="token"
          />
        );
      });
      await enterAdminContext(host);
      await submitCandidateComparison(host, "admin");
      expect(
        host.querySelector('[aria-label="GSI admin cross-round comparison result"]')
      ).toBeNull();
      expect(host.textContent).toContain("比较暂不可用");
    } finally {
      await act(async () => root.unmount());
      fetchSpy.mockRestore();
      vi.unstubAllGlobals();
      host.remove();
    }
  });

  it.each(["teacher", "admin"] as const)(
    "rejects an invalid %s bootstrap without using outer scope",
    (surface) => {
      const invalid =
        surface === "teacher"
          ? {
              ...teacherComparison,
              context: {
                ...teacherComparison.context,
                context: { ...teacherComparison.context.context, round_id: "round_1", round_no: 1 }
              }
            }
          : {
              ...adminComparison,
              context: {
                ...adminComparison.context,
                context_binding: { ...adminComparison.context.context_binding, role_key: "CFO" }
              }
            };
      const markup = renderToStaticMarkup(
        surface === "teacher" ? (
          <GovernedStakeholderIntelligenceWorkspace
            apiBase="http://api.test"
            binding={pairOptionsBinding}
            tenantId="tenant_demo"
            token="token"
            initialComparison={invalid as GSICrossRoundTeacherProjection}
          />
        ) : (
          <GovernedStakeholderIntelligenceAuditPanel
            apiBase="http://api.test"
            tenantId="tenant_demo"
            token="token"
            initialComparison={invalid as GSICrossRoundAdminProjection}
          />
        )
      );
      expect(markup).not.toContain(
        surface === "teacher"
          ? 'aria-label="GSI cross-round comparison result"'
          : 'aria-label="GSI admin cross-round comparison result"'
      );
      expect(markup).toContain("PAIR_SELECTION_UNAVAILABLE");
    }
  );

  it("aborts an in-flight Teacher compare when the component unmounts", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    let resolveCompare!: (value: Response) => void;
    const comparePending = new Promise<Response>((resolve) => {
      resolveCompare = resolve;
    });
    let compareSignal: AbortSignal | undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, options) => {
      if (String(input).includes("/compare?")) {
        compareSignal = options?.signal as AbortSignal;
        return comparePending;
      }
      return Promise.resolve(
        responseWithJson({
          code: "OK",
          data: makeValidPairOptionsPayload("teacher"),
          message: "OK",
          request_id: "req_pair_options"
        })
      );
    });
    const host = document.createElement("div");
    const root = createRoot(host);
    document.body.append(host);
    try {
      await act(async () => {
        root.render(
          <GovernedStakeholderIntelligenceWorkspace
            apiBase="http://api.test"
            binding={pairOptionsBinding}
            tenantId="tenant_demo"
            token="token"
          />
        );
        await Promise.resolve();
        await Promise.resolve();
      });
      await submitCandidateComparison(host, "teacher");
      expect(compareSignal).toBeDefined();
      await act(async () => root.unmount());
      expect(compareSignal?.aborted).toBe(true);
      await act(async () => {
        resolveCompare(responseWithJson({ data: teacherComparisonForRequest }));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(host.querySelector('[aria-label="GSI cross-round comparison result"]')).toBeNull();
    } finally {
      fetchSpy.mockRestore();
      vi.unstubAllGlobals();
      host.remove();
    }
  });

  it.each(
    (["teacher", "admin"] as const).flatMap((surface) =>
      invalidPairOptionsCases.map((invalidCase) => ({ surface, invalidCase }))
    )
  )(
    "fails closed for a mounted $surface component on a $invalidCase pair-options payload",
    async ({ surface, invalidCase }) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(responseWithJson(makePairOptionsPayload(surface, invalidCase)));
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
        });
        if (surface === "admin") {
          await enterAdminContext(host);
          await act(async () => {
            const button = [...host.querySelectorAll("button")].find((candidate) =>
              candidate.textContent?.includes("加载可比较回合")
            );
            button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();
          });
        } else {
          await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
          });
        }
        expect(host.textContent).toContain("PAIR_SELECTION_UNAVAILABLE");
        expect(host.querySelector('option[value="round_1"]')).toBeNull();
        expect(fetchSpy).toHaveBeenCalled();
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );

  it.each(["teacher", "admin"] as const)(
    "preserves a legitimate string pair-options error message for a mounted %s component",
    async (surface) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        responseWithJson({
          code: "OK",
          data: makeValidPairOptionsPayload(surface),
          error: {
            code: "GSI_PAIR_NOT_AVAILABLE",
            message: "server rejected the current pair context"
          }
        })
      );
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
        });
        if (surface === "admin") {
          await enterAdminContext(host);
          await act(async () => {
            const button = [...host.querySelectorAll("button")].find((candidate) =>
              candidate.textContent?.includes("加载可比较回合")
            );
            button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();
          });
        } else {
          await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
          });
        }
        expect(host.textContent).toContain("PAIR_SELECTION_UNAVAILABLE");
        expect(host.textContent).toContain("server rejected the current pair context");
        expect(host.querySelector('option[value="round_1"]')).toBeNull();
        expect(fetchSpy).toHaveBeenCalled();
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );

  it.each(
    (["teacher", "admin"] as const).flatMap((surface) =>
      pairSelectionContextFields.map((field) => ({ surface, field }))
    )
  )(
    "fails closed for a mounted $surface component when pair-options $field does not match the request context",
    async ({ surface, field }) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          responseWithJson(makePairOptionsPayload(surface, "wrong context", field))
        );
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
        });
        if (surface === "admin") {
          await enterAdminContext(host);
          await act(async () => {
            const button = [...host.querySelectorAll("button")].find((candidate) =>
              candidate.textContent?.includes("加载可比较回合")
            );
            button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();
          });
        } else {
          await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
          });
        }
        expect(host.textContent).toContain("PAIR_SELECTION_UNAVAILABLE");
        expect(host.querySelector('option[value="round_1"]')).toBeNull();
        expect(fetchSpy).toHaveBeenCalled();
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );

  it.each(["teacher", "admin"] as const)(
    "admits a mounted %s component for a genuine code OK pair-options envelope",
    async (surface) => {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        responseWithJson({
          code: "OK",
          data: makeValidPairOptionsPayload(surface),
          message: "OK",
          request_id: "req_pair_options"
        })
      );
      const host = document.createElement("div");
      const root = createRoot(host);
      document.body.append(host);
      try {
        await act(async () => {
          root.render(
            surface === "teacher" ? (
              <GovernedStakeholderIntelligenceWorkspace
                apiBase="http://api.test"
                binding={pairOptionsBinding}
                tenantId="tenant_demo"
                token="token"
              />
            ) : (
              <GovernedStakeholderIntelligenceAuditPanel
                apiBase="http://api.test"
                tenantId="tenant_demo"
                token="token"
              />
            )
          );
        });
        if (surface === "admin") {
          await enterAdminContext(host);
          await act(async () => {
            const button = [...host.querySelectorAll("button")].find((candidate) =>
              candidate.textContent?.includes("加载可比较回合")
            );
            button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
            await Promise.resolve();
            await Promise.resolve();
          });
        } else {
          await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
          });
        }
        expect(host.querySelector('option[value="round_1"]')).not.toBeNull();
        expect(host.querySelector('option[value="round_2"]')).not.toBeNull();
        expect(fetchSpy).toHaveBeenCalled();
      } finally {
        await act(async () => root.unmount());
        fetchSpy.mockRestore();
        vi.unstubAllGlobals();
        host.remove();
      }
    }
  );
});
it("generates a Student handoff from ready exact context without candidate identifiers", () => {
  const markup = renderToStaticMarkup(
    <GovernedStakeholderIntelligenceWorkspace
      apiBase="http://api.test"
      studentAppBaseUrl="http://student.test/"
      binding={{
        tenant_id: "tenant_demo",
        course_id: "outer_course",
        run_id: "outer_run",
        round_id: "round_1",
        round_no: 1,
        activity_id: "outer_activity",
        role_key: "CFO",
        team_id: "outer_team",
        scenario_package_id: "scenario_demo",
        scenario_version: "1.0.0",
        parameter_set_id: "parameter_demo",
        parameter_set_version: "1.0.0",
        model_version_id: "model_demo",
        model_version: "1.0.0",
        model_artifact_id: "artifact_demo",
        model_artifact_version: "1.0.0"
      }}
      tenantId="tenant_demo"
      token="token"
      initialComparison={teacherComparison}
    />
  );
  const handoff = markup
    .match(/href="([^"]+)"[^>]*>生成 Student 学习查看链接/)?.[1]
    ?.replaceAll("&amp;", "&");
  expect(handoff).toBe(
    "http://student.test/?gsi_course_id=course_demo&gsi_run_id=run_demo&gsi_team_id=team_demo&gsi_activity_id=activity_demo&gsi_role_key=CEO#gsi-student-reflection"
  );
  expect(handoff).not.toContain("candidate_");
  expect(handoff).not.toContain("comparison_digest");
});

it("does not expose a Student handoff before an exact comparison is ready", () => {
  const markup = renderToStaticMarkup(
    <GovernedStakeholderIntelligenceWorkspace
      apiBase="http://api.test"
      studentAppBaseUrl="http://student.test/"
      binding={{
        tenant_id: "tenant_demo",
        course_id: "course_demo",
        run_id: "run_demo",
        round_id: "round_1",
        team_id: "team_demo",
        scenario_package_id: "scenario_demo",
        scenario_version: "1.0.0",
        parameter_set_id: "parameter_demo",
        parameter_set_version: "1.0.0",
        model_version_id: "model_demo",
        model_version: "1.0.0",
        model_artifact_id: "artifact_demo",
        model_artifact_version: "1.0.0"
      }}
      tenantId="tenant_demo"
      token="token"
    />
  );
  expect(markup).not.toContain("生成 Student 学习查看链接");
  expect(markup).not.toContain("gsi_course_id=course_demo");
});

it("preserves an admitted Teacher bootstrap after mounted pair-options loading", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    responseWithJson({
      code: "OK",
      message: "OK",
      request_id: "req_bootstrap",
      data: makeValidPairOptionsPayload("teacher")
    })
  );
  const host = document.createElement("div");
  const root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => {
      root.render(
        <GovernedStakeholderIntelligenceWorkspace
          apiBase="http://api.test"
          binding={pairOptionsBinding}
          tenantId="tenant_demo"
          token="token"
          initialComparison={teacherComparison}
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('[aria-label="GSI cross-round comparison result"]')).not.toBeNull();
    expect(host.textContent).toContain("生成 Student 学习查看链接");
  } finally {
    await act(async () => root.unmount());
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
    host.remove();
  }
});

it("blocks all Teacher BFF operations when binding tenant differs from the authorized tenant", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/pair-options?"))
      return responseWithJson({
        code: "OK",
        message: "OK",
        request_id: "req_tenant",
        data: makeValidPairOptionsPayload("teacher")
      });
    if (url.includes("/compare?"))
      return responseWithJson({ code: "OK", data: teacherComparisonForRequest });
    return responseWithJson({ code: "GSI_INPUT_INVALID", message: "invalid tenant binding" });
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => {
      root.render(
        <GovernedStakeholderIntelligenceWorkspace
          apiBase="http://api.test"
          binding={{ ...pairOptionsBinding, tenant_id: "tenant_other" }}
          tenantId="tenant_demo"
          token="token"
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await submitCandidateComparison(host, "teacher");
    await act(async () => {
      for (const form of host.querySelectorAll("form")) {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="GSI cross-round comparison result"]')).toBeNull();
    expect(host.textContent).not.toContain("生成 Student 学习查看链接");
  } finally {
    await act(async () => root.unmount());
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
    host.remove();
  }
});

it("refreshes Teacher activity and role when the mounted binding changes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const requests: string[] = [];
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    requests.push(String(input));
    return responseWithJson({
      code: "OK",
      message: "OK",
      request_id: "req_binding",
      data: makeValidPairOptionsPayload("teacher")
    });
  });
  const host = document.createElement("div");
  const root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => {
      root.render(
        <GovernedStakeholderIntelligenceWorkspace
          apiBase="http://api.test"
          binding={pairOptionsBinding}
          tenantId="tenant_demo"
          token="token"
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      root.render(
        <GovernedStakeholderIntelligenceWorkspace
          apiBase="http://api.test"
          binding={{ ...pairOptionsBinding, activity_id: "activity_other", role_key: "CFO" }}
          tenantId="tenant_demo"
          token="token"
        />
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    const query = new URL(requests.at(-1)!).searchParams;
    expect(query.get("activity_id")).toBe("activity_other");
    expect(query.get("role_key")).toBe("CFO");
    expect(host.querySelector('[aria-label="GSI cross-round comparison result"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
    host.remove();
  }
});

it("rejects an Admin bootstrap whose nested tenant conflicts with the comparison pair", () => {
  const initialComparison = {
    ...adminComparison,
    context: {
      ...adminComparison.context,
      context: { ...adminComparison.context.context, tenant_id: "tenant_other" },
      context_binding: { ...adminComparison.context.context_binding, tenant_id: "tenant_other" }
    }
  };
  const markup = renderToStaticMarkup(
    <GovernedStakeholderIntelligenceAuditPanel
      apiBase="http://api.test"
      tenantId="tenant_demo"
      token="token"
      initialComparison={initialComparison}
    />
  );
  expect(markup).not.toContain('aria-label="GSI admin cross-round comparison result"');
});

it("preserves Teacher bootstrap across StrictMode replay but never revives it after a real selection identity change", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    responseWithJson({
      code: "OK",
      message: "OK",
      request_id: "req_strict_bootstrap",
      data: makeValidPairOptionsPayload("teacher")
    })
  );
  const host = document.createElement("div");
  const root = createRoot(host);
  document.body.append(host);
  const view = (binding: GSIExactBinding) => (
    <React.StrictMode>
      <GovernedStakeholderIntelligenceWorkspace
        apiBase="http://api.test"
        binding={binding}
        tenantId="tenant_demo"
        token="token"
        initialComparison={teacherComparison}
      />
    </React.StrictMode>
  );
  try {
    await act(async () => {
      root.render(view(pairOptionsBinding));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('[aria-label="GSI cross-round comparison result"]')).not.toBeNull();
    expect(host.textContent).toContain("生成 Student 学习查看链接");
    await act(async () => {
      root.render(view({ ...pairOptionsBinding, course_id: "course_other" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('[aria-label="GSI cross-round comparison result"]')).toBeNull();
    await act(async () => {
      root.render(view(pairOptionsBinding));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.querySelector('[aria-label="GSI cross-round comparison result"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    fetchSpy.mockRestore();
    vi.unstubAllGlobals();
    host.remove();
  }
});
