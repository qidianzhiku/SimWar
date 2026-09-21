import { describe, expect, it, vi } from "vitest";
import type { DdtEvidenceSpineRequestContext } from "@simwar/shared-contracts";
import {
  DecisionThreadEvidenceSpineError,
  DecisionThreadEvidenceSpineService,
  classifyIndustryModelStatus,
  classifyModelQualificationStatus,
  type DecisionThreadEvidenceSpineReaders
} from "../../services/api/src/decision-thread-evidence-spine.js";

const context: DdtEvidenceSpineRequestContext = {
  tenant_id: "tenant-001",
  course_id: "course-001",
  run_id: "run-001",
  team_id: "team-001",
  round_id: "round-002",
  round_no: 2,
  role_key: "CEO",
  activity_id: "activity-ddt"
};

function readers(
  overrides: Partial<DecisionThreadEvidenceSpineReaders> = {}
): DecisionThreadEvidenceSpineReaders {
  const source = (name: string) => async () => ({
    status: "AVAILABLE" as const,
    summary: `${name} evidence`,
    known_limits: [`${name} limit`],
    source_context: context,
    provenance: {
      authority_owner: `${name}_AUTHORITY`,
      source_ref: `${name}:exact`,
      contract_version: `${name}.v1`
    }
  });
  return {
    authorizeContext: async () => true,
    m2p6: source("M2P6"),
    modelQualification: source("MODEL_QUALIFICATION"),
    strategicPortfolio: source("STRATEGIC_PORTFOLIO"),
    industryModel: source("INDUSTRY_MODEL"),
    gsi: async (_actor, _context, _surface, selection) => ({
      status: "AVAILABLE" as const,
      summary: "GSI movement",
      known_limits: ["movement is descriptive"],
      source_context: context,
      selected_round_pair: selection
    }),
    ...overrides
  };
}

describe("Decision Thread Evidence Spine service", () => {
  it.each(["AVAILABLE", "CONTEXT_UNAVAILABLE", "REBASE_REQUIRED", "STALE", "LIMITED"] as const)(
    "preserves GSI %s semantics",
    async (status) => {
      const service = new DecisionThreadEvidenceSpineService(
        readers({
          gsi: async (_actor, _context, _surface, selection) => ({
            status,
            summary: "descriptive movement",
            known_limits: ["non-causal"],
            source_context: context,
            selected_round_pair: selection
          })
        })
      );
      for (const surface of ["teacher", "student", "admin"] as const) {
        const response = await service.getSpine({
          actor: {
            user_id: "user_1",
            tenant_id: context.tenant_id,
            team_id: context.team_id,
            roles: [surface === "admin" ? "tenant_admin" : surface]
          },
          context: { ...context, gsi_from_round_id: "round-001", gsi_to_round_id: "round-002" },
          surface
        });
        expect(response.sources.find((source) => source.source === "GSI")?.status).toBe(status);
        expect(response.formal_write_count).toBe(0);
        expect(response.provider).toBe("OFF");
      }
    }
  );

  it("composes exact-context sources without writing or collapsing ledgers", async () => {
    const service = new DecisionThreadEvidenceSpineService(readers());
    const response = await service.getSpine({
      actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
      context: { ...context, gsi_from_round_id: "round-001", gsi_to_round_id: "round-002" },
      surface: "teacher"
    });

    expect(response.sources).toHaveLength(5);
    expect(response.sources.map((source) => source.ledger)).toEqual([
      "OFFICIAL",
      "DIAGNOSTIC",
      "DIAGNOSTIC",
      "DIAGNOSTIC",
      "ADVISORY"
    ]);
    expect(response.exact_context).toEqual(context);
    expect(response.sources.find((source) => source.source === "GSI")).toMatchObject({
      selected_round_pair: { from_round_id: "round-001", to_round_id: "round-002" }
    });
    expect(
      response.sources.every((source) => !Object.hasOwn(source.exact_context, "gsi_from_round_id"))
    ).toBe(true);
    expect(response.formal_write_count).toBe(0);
    expect(response.official_truth_write).toBe(false);
    expect(response.non_causal).toBe(true);
    expect(response.causal_proof).toBe(false);
  });

  it("does not let one unavailable source fabricate zero or suppress other sources", async () => {
    const service = new DecisionThreadEvidenceSpineService(
      readers({
        strategicPortfolio: async () => {
          throw new Error("W4_CONTEXT_UNAVAILABLE");
        }
      })
    );
    const response = await service.getSpine({
      actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
      context,
      surface: "teacher"
    });
    const portfolio = response.sources.find((source) => source.source === "STRATEGIC_PORTFOLIO");
    const m2p6 = response.sources.find((source) => source.source === "M2P6");
    expect(portfolio?.status).toBe("CONTEXT_UNAVAILABLE");
    expect(portfolio?.summary).not.toContain("0");
    expect(m2p6?.status).toBe("AVAILABLE");
  });

  it("preserves a source's bounded context scope instead of attributing it to the full spine context", async () => {
    const service = new DecisionThreadEvidenceSpineService(
      readers({
        modelQualification: async () => ({
          status: "AVAILABLE" as const,
          summary: "course qualification",
          known_limits: ["模型资格仅绑定租户和课程；不证明活动、具体运行、队伍、回合或角色绑定。"],
          context_scope: "TENANT_COURSE" as const,
          source_context: context
        })
      })
    );
    const response = await service.getSpine({
      actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
      context,
      surface: "teacher"
    });
    expect(
      response.sources.find((source) => source.source === "MODEL_QUALIFICATION")
    ).toMatchObject({
      context_scope: "TENANT_COURSE",
      known_limits: expect.arrayContaining([
        "模型资格仅绑定租户和课程；不证明活动、具体运行、队伍、回合或角色绑定。"
      ])
    });
  });

  it("keeps known source failures visible as source-local unavailable states", async () => {
    const service = new DecisionThreadEvidenceSpineService(
      readers({
        modelQualification: async () => {
          throw new Error("MODEL_QUALIFICATION_BINDING_REQUIRED");
        },
        gsi: async () => {
          throw new Error("GSI_PAIR_AMBIGUOUS");
        }
      })
    );
    const response = await service.getSpine({
      actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
      context: { ...context, gsi_from_round_id: "round-001", gsi_to_round_id: context.round_id },
      surface: "teacher"
    });
    expect(response.sources.find((source) => source.source === "MODEL_QUALIFICATION")?.status).toBe(
      "CONTEXT_UNAVAILABLE"
    );
    expect(response.sources.find((source) => source.source === "GSI")?.status).toBe(
      "CONTEXT_UNAVAILABLE"
    );
  });

  it("maps an expected missing canonical decision to bounded M2P6 unavailability", async () => {
    const service = new DecisionThreadEvidenceSpineService(
      readers({
        m2p6: async () => {
          throw new Error("W3_CANONICAL_DECISION_REQUIRED");
        }
      })
    );
    const response = await service.getSpine({
      actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
      context,
      surface: "teacher"
    });
    expect(response.sources.find((source) => source.source === "M2P6")).toMatchObject({
      status: "CONTEXT_UNAVAILABLE",
      known_limits: expect.arrayContaining(["源能力当前未提供可用的精确上下文证据。"])
    });
    expect(response.sources.find((source) => source.source === "MODEL_QUALIFICATION")?.status).toBe(
      "AVAILABLE"
    );
  });

  it("maps canonical GSI pair availability and compatibility failures locally", async () => {
    for (const code of ["GSI_PAIR_NOT_AVAILABLE", "GSI_COMPARISON_INVALID"]) {
      const service = new DecisionThreadEvidenceSpineService(
        readers({
          gsi: async () => {
            throw new Error(code);
          }
        })
      );
      const response = await service.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context: { ...context, gsi_from_round_id: "round-001", gsi_to_round_id: context.round_id },
        surface: "teacher"
      });
      expect(response.sources.find((source) => source.source === "GSI")?.status).toBe(
        "CONTEXT_UNAVAILABLE"
      );
      expect(response.sources.find((source) => source.source === "M2P6")?.status).toBe("AVAILABLE");
    }
  });

  it("maps stale industry producer evidence to a stale spine source", () => {
    expect(classifyIndustryModelStatus("READY", [{ freshness: "STALE" }])).toBe("STALE");
    expect(classifyIndustryModelStatus("READY_WITH_LIMITS", [{ freshness: "FRESH" }])).toBe(
      "LIMITED"
    );
  });

  it("preserves rebase-required precedence over stale producer evidence", () => {
    expect(classifyIndustryModelStatus("REBASE_REQUIRED", "STALE")).toBe("REBASE_REQUIRED");
    expect(classifyIndustryModelStatus("REBASE_REQUIRED", [{ freshness: "STALE" }])).toBe(
      "REBASE_REQUIRED"
    );
  });

  it.each([
    [["FRESH"], "AVAILABLE"],
    [["STALE"], "STALE"],
    [["UNKNOWN"], "LIMITED"],
    [["FRESH", "STALE"], "STALE"],
    [["FRESH", "UNKNOWN"], "LIMITED"],
    [[], "CONTEXT_UNAVAILABLE"],
    [[undefined], "CONTEXT_UNAVAILABLE"]
  ] as const)("preserves canonical qualification freshness %s as %s", (freshness, expected) => {
    expect(classifyModelQualificationStatus(freshness)).toBe(expected);
  });

  it("applies a Student allowlist and rejects a mixed-role actor on the Student surface", async () => {
    const service = new DecisionThreadEvidenceSpineService(
      readers({
        authorizeContext: async (actor, requestedContext) =>
          actor.team_id === requestedContext.team_id
      })
    );
    const response = await service.getSpine({
      actor: {
        user_id: "student-001",
        tenant_id: context.tenant_id,
        team_id: context.team_id,
        roles: ["student", "admin"]
      },
      context,
      surface: "student"
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("tenant-001");
    expect(serialized).not.toContain("MODEL_QUALIFICATION_AUTHORITY");
    expect(serialized).not.toContain("source_ref");
    expect(serialized).not.toContain("candidate_id");
    expect(response.sources.every((source) => !Object.hasOwn(source, "provenance"))).toBe(true);

    await expect(
      service.getSpine({
        actor: {
          user_id: "student-001",
          tenant_id: context.tenant_id,
          team_id: "other-team",
          roles: ["student", "admin"]
        },
        context,
        surface: "student"
      })
    ).rejects.toMatchObject<Partial<DecisionThreadEvidenceSpineError>>({
      code: "DDT_SCOPE_VIOLATION"
    });
  });

  it("allows an authorized Student context when the session lacks a singular team_id", async () => {
    const service = new DecisionThreadEvidenceSpineService(readers());
    const response = await service.getSpine({
      actor: { user_id: "student-001", tenant_id: context.tenant_id, roles: ["student"] },
      context,
      surface: "student"
    });
    expect(response.surface).toBe("student");
    expect(response.exact_context.team_id).toBe(context.team_id);
  });

  it("requires complete explicit GSI selection rather than a default pair", async () => {
    const gsi = vi.fn(readers().gsi);
    const service = new DecisionThreadEvidenceSpineService(readers({ gsi }));
    const withoutSelection = await service.getSpine({
      actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
      context,
      surface: "teacher"
    });
    expect(withoutSelection.sources.find((source) => source.source === "GSI")?.status).toBe(
      "CONTEXT_UNAVAILABLE"
    );
    expect(gsi).not.toHaveBeenCalled();
    await expect(
      service.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context: { ...context, gsi_from_round_id: "round-001" },
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_GSI_PAIR_INVALID" });
  });

  it("validates GSI selectors and the trusted context at the service boundary", async () => {
    const service = new DecisionThreadEvidenceSpineService(readers());
    const unauthorizedService = new DecisionThreadEvidenceSpineService(
      readers({ authorizeContext: async () => false })
    );
    await expect(
      service.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context: {
          ...context,
          gsi_from_round_id: "latest-round",
          gsi_to_round_id: "round-003"
        },
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_GSI_PAIR_INVALID" });
    await expect(
      unauthorizedService.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context,
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_SCOPE_VIOLATION" });
  });

  it("binds every source to the requested exact context and GSI pair", async () => {
    const mismatchedSource = new DecisionThreadEvidenceSpineService(
      readers({
        m2p6: async () => ({
          status: "AVAILABLE" as const,
          summary: "wrong context",
          known_limits: ["wrong context"],
          source_context: { ...context, round_id: "round-001", round_no: 1 }
        })
      })
    );
    await expect(
      mismatchedSource.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context,
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_OUTPUT_INVALID" });

    await expect(
      new DecisionThreadEvidenceSpineService(readers()).getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context: { ...context, gsi_from_round_id: "round-001", gsi_to_round_id: "round-003" },
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_GSI_PAIR_INVALID" });
  });

  it("rejects reader output that changes a source ledger or hides an unknown failure", async () => {
    const ledgerTamper = new DecisionThreadEvidenceSpineService(
      readers({
        m2p6: async () => ({
          ledger: "DIAGNOSTIC" as never,
          status: "AVAILABLE" as const,
          summary: "tampered",
          known_limits: ["tampered"],
          source_context: context
        })
      })
    );
    await expect(
      ledgerTamper.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context,
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_OUTPUT_INVALID" });

    const unknownFailure = new DecisionThreadEvidenceSpineService(
      readers({
        m2p6: async () => {
          throw new Error("unexpected reader failure");
        }
      })
    );
    await expect(
      unknownFailure.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context,
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_OUTPUT_INVALID" });

    const malformedLimits = new DecisionThreadEvidenceSpineService(
      readers({
        m2p6: async () => ({
          status: "AVAILABLE" as const,
          summary: "malformed limits",
          known_limits: [""],
          source_context: context
        })
      })
    );
    await expect(
      malformedLimits.getSpine({
        actor: { user_id: "teacher-001", tenant_id: context.tenant_id, roles: ["teacher"] },
        context,
        surface: "teacher"
      })
    ).rejects.toMatchObject({ code: "DDT_OUTPUT_INVALID" });
  });

  it("keeps infrastructure-only limits out of the Student projection", async () => {
    const service = new DecisionThreadEvidenceSpineService(
      readers({
        m2p6: async () => ({
          status: "AVAILABLE" as const,
          summary: "student-safe",
          known_limits: ["JSON_INTERNAL_ONLY", "durable PostgreSQL/RLS", "Human Validation"],
          source_context: context
        })
      })
    );
    const response = await service.getSpine({
      actor: {
        user_id: "student-001",
        tenant_id: context.tenant_id,
        team_id: context.team_id,
        roles: ["student"]
      },
      context,
      surface: "student"
    });
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("JSON_INTERNAL_ONLY");
    expect(serialized).not.toContain("PostgreSQL");
    expect(serialized).not.toContain("Human Validation");
  });
});
