import { describe, expect, it } from "vitest";
import {
  M1_TEACHING_OFFICIAL_RESULT_LABEL,
  M1_TEACHING_PRODUCT_PACKAGE
} from "../../packages/shared-contracts/src";

describe("M1 teaching product package", () => {
  it("covers the internal teacher trial-prep package without expanding runtime claims", () => {
    expect(M1_TEACHING_PRODUCT_PACKAGE.scenario.name).toContain("康养商战 M1");
    expect(M1_TEACHING_PRODUCT_PACKAGE.scenario.resultLabel).toBe(
      M1_TEACHING_OFFICIAL_RESULT_LABEL
    );

    expect(M1_TEACHING_PRODUCT_PACKAGE.courseBlueprint.timing).toContain("30-60");
    expect(M1_TEACHING_PRODUCT_PACKAGE.courseBlueprint.objectives).toEqual(
      expect.arrayContaining([
        "教师能带领一个康养经营回合完成决策、锁轮、结算和结果发布。",
        "学员能以 Team 成员身份提交结构化经营决策并解释结果反馈。",
        "课堂能使用结果差异、决策质量和下一轮风险完成复盘讨论。"
      ])
    );
    expect(M1_TEACHING_PRODUCT_PACKAGE.courseBlueprint.phases).toHaveLength(5);

    expect(M1_TEACHING_PRODUCT_PACKAGE.instructorKit.operationChecklist).toEqual(
      expect.arrayContaining([
        "确认课程为 M1 康养教学闭环课程并完成教师登录。",
        "创建 Run、开启回合、等待学员提交、锁定回合、请求结算、发布结果。",
        "发布后使用课堂复盘材料组织三段式讨论。"
      ])
    );
    expect(M1_TEACHING_PRODUCT_PACKAGE.learnerOnboarding.submissionChecklist).toEqual(
      expect.arrayContaining([
        "确认当前回合为 open。",
        "填写定价、营销预算、服务质量预算、产能计划、现金缓冲和策略说明。",
        "提交后等待教师锁轮、结算和发布结果。"
      ])
    );
    expect(M1_TEACHING_PRODUCT_PACKAGE.debriefKit.teacherDiscussionPoints).toEqual(
      expect.arrayContaining([
        "价格、服务质量和产能扩张之间的取舍是否一致？",
        "分数、排名、需求和利润区间与团队提交的策略是否匹配？"
      ])
    );
    expect(M1_TEACHING_PRODUCT_PACKAGE.minimumAssessmentEvidence.rubric).toHaveLength(4);

    expect(M1_TEACHING_PRODUCT_PACKAGE.boundaries.runtime).toBe("current_json_active_runtime");
    expect(M1_TEACHING_PRODUCT_PACKAGE.boundaries.nonGoals).toEqual(
      expect.arrayContaining([
        "does_not_claim_internal_pilot_release",
        "does_not_claim_controlled_teaching_pilot",
        "does_not_claim_production_launch",
        "does_not_activate_postgresql_runtime",
        "does_not_enable_ai_truth_write"
      ])
    );
  });
});
