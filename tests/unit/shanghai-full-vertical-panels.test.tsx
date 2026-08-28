/** @vitest-environment jsdom */

import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { ShanghaiFullVerticalAdminPanel } from "../../apps/admin/src/ShanghaiFullVerticalPanel";
import { ShanghaiFullVerticalStudentPanel } from "../../apps/student/src/ShanghaiFullVerticalPanel";
import { ShanghaiFullVerticalTeacherPanel } from "../../apps/teacher/src/ShanghaiFullVerticalPanel";

describe("Shanghai full vertical role panels", () => {
  it("keeps Teacher configuration and preview language explicit", () => {
    const markup = renderToStaticMarkup(
      <ShanghaiFullVerticalTeacherPanel
        apiBase="http://localhost:3000"
        courseId="course_demo"
        roundNo={1}
        runId="run_demo"
        tenantId="tenant_demo"
        token="teacher-token"
      />
    );

    expect(markup).toContain("上海全链路产品旅程");
    expect(markup).toContain("Teacher scenario configuration");
    expect(markup).toContain("等待 Teacher projection");
  });

  it("does not render Student projection without exact context", () => {
    const markup = renderToStaticMarkup(
      <ShanghaiFullVerticalStudentPanel
        apiBase="http://localhost:3000"
        courseId="course_demo"
        tenantId="tenant_demo"
        token="student-token"
      />
    );

    expect(markup).toContain("需要 exact draft/run/round 上下文");
    expect(markup).not.toContain("parameter_values");
    expect(markup).not.toContain("content_digest");
  });

  it("keeps Admin audit projection read-only and exact", () => {
    const markup = renderToStaticMarkup(
      <ShanghaiFullVerticalAdminPanel
        apiBase="http://localhost:3000"
        courseId="course_demo"
        draftId="draft_demo"
        roundNo={1}
        runId="run_demo"
        tenantId="tenant_demo"
        token="admin-token"
      />
    );

    expect(markup).toContain("Admin tenant-safe audit projection");
    expect(markup).toContain("等待 Admin audit projection");
    expect(markup).toContain("只读");
  });
});
