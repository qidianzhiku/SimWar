/** @vitest-environment jsdom */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildExactTeacherGsiBinding,
  TeacherGsiMissingContextPanel
} from "../../apps/teacher/src/App";

const run = {
  run_id: "run_demo",
  tenant_id: "tenant_demo",
  course_id: "course_demo",
  scenario_package_id: "scenario_demo",
  parameter_set_id: "parameter_demo"
} as const;

const round = {
  round_id: "round_demo",
  tenant_id: "tenant_demo",
  run_id: "run_demo"
} as const;

const exactReference = {
  scenario_package_id: "scenario_demo",
  scenario_version: "2.1.0",
  parameter_set_id: "parameter_demo",
  parameter_set_version: "4.0.0"
} as const;

describe("GSI-XR exact Teacher binding", () => {
  it("does not select the first team when no explicit or persisted team is valid", () => {
    expect(
      buildExactTeacherGsiBinding({
        tenantId: "tenant_demo",
        selectedRun: run,
        selectedRound: round,
        teams: [{ team_id: "team_first" }, { team_id: "team_second" }],
        scenarioReference: exactReference
      })
    ).toBeUndefined();
  });

  it("does not invent missing scenario or parameter versions", () => {
    expect(
      buildExactTeacherGsiBinding({
        tenantId: "tenant_demo",
        selectedRun: run,
        selectedRound: round,
        selectedTeamId: "team_second",
        teams: [{ team_id: "team_second" }],
        scenarioReference: {
          scenario_package_id: "scenario_demo",
          parameter_set_id: "parameter_demo"
        }
      })
    ).toBeUndefined();
  });

  it("requires exact selected context and versions before constructing the binding", () => {
    expect(
      buildExactTeacherGsiBinding({
        tenantId: "tenant_demo",
        selectedRun: run,
        selectedRound: round,
        selectedTeamId: "team_second",
        teams: [{ team_id: "team_first" }, { team_id: "team_second" }],
        scenarioReference: exactReference
      })
    ).toMatchObject({
      team_id: "team_second",
      scenario_version: "2.1.0",
      parameter_set_version: "4.0.0"
    });
  });

  it("renders an explicit missing-context recovery state when GSI cannot bind", () => {
    const markup = renderToStaticMarkup(<TeacherGsiMissingContextPanel />);
    expect(markup).toContain("GSI-XR · MISSING_CONTEXT");
    expect(markup).toContain("尚未具备精确的 GSI 上下文");
    expect(markup).toContain("重新选择明确的课程、Run、回合和队伍");
  });
});
