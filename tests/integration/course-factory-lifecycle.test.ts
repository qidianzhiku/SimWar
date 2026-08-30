import { once } from "node:events";
import { type Server } from "node:http";
import { describe, expect, it } from "vitest";
import type {
  ApiEnvelope,
  AuthSession,
  CourseFactoryVersion,
  CoursePackageVersionReference
} from "../../packages/shared-contracts/src";
import { CourseBlueprintCommandService } from "../../services/api/src/course-blueprint-authority";
import { createJsonFormalScenarioAuthorityPersistence } from "../../services/api/src/json-repository-adapter";
import { createJsonFormalScenarioAuthorityRuntime } from "../../services/api/src/formal-scenario-authority-runtime";
import { createApiServer } from "../../services/api/src/server";
import { DEFAULT_TENANT_ID, createP1Store, type SimWarStore } from "../../services/api/src/store";
import { buildM30CourseFactorySourceEvidence } from "@simwar/sh-next-support";

const VERSION = "1.0.0";

async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: { body?: unknown; method?: string; token?: string } = {}
): Promise<{ body: T; status: number }> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": "application/json",
      "x-tenant-id": DEFAULT_TENANT_ID
    },
    method: options.method ?? "GET"
  });
  return { body: (await response.json()) as T, status: response.status };
}

async function login(baseUrl: string, username: string, password: string): Promise<AuthSession> {
  const result = await requestJson<ApiEnvelope<AuthSession>>(baseUrl, "/api/v1/auth/login", {
    body: { password, username },
    method: "POST"
  });
  expect(result.status).toBe(200);
  return result.body.data;
}

async function startServer(): Promise<{ baseUrl: string; server: Server; store: SimWarStore }> {
  const store = createP1Store();
  const server = createApiServer(store);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  return { baseUrl: `http://127.0.0.1:${address.port}`, server, store };
}

async function seedApprovedSources(store: SimWarStore) {
  const persistence = createJsonFormalScenarioAuthorityPersistence(store);
  const formal = createJsonFormalScenarioAuthorityRuntime(persistence);
  const actor = {
    actor_id: "usr_platform",
    capabilities: ["course_blueprint:manage", "parameter_set:manage", "scenario_package:manage"],
    correlation_id: "course_factory_lifecycle_seed",
    tenant_id: DEFAULT_TENANT_ID
  };
  const parameterDraft = await formal.parameterSets.createDraft(actor, {
    compatibility_metadata: { engine_family: "toy_logit" },
    model_version_ref: "toy_logit_wellness_v1@0.1.0",
    parameter_set_id: "parameter_course_factory_e2e",
    parameter_values: { base_capacity: 120 },
    schema_version: "parameter-set.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  });
  const parameterValidated = await formal.parameterSets.validate(actor, parameterDraft.reference);
  const parameterFrozen = await formal.parameterSets.freeze(actor, parameterValidated.reference);
  const parameterApproved = await formal.parameterSets.approve(
    actor,
    parameterFrozen.reference,
    "course_factory_parameter_approval"
  );
  const scenarioDraft = await formal.scenarioPackages.createDraft(actor, {
    artifact_policy: { mode: "INLINE", retention: "IMMUTABLE" },
    compatibility_metadata: { scenario_family: "course-factory" },
    content: { rounds: 1 },
    metadata: { title: "Course Factory scenario" },
    parameter_set_reference: parameterApproved.version.reference,
    plugin_dependencies: [],
    scenario_package_id: "scenario_course_factory_e2e",
    schema_version: "scenario-package.v1",
    tenant_id: DEFAULT_TENANT_ID,
    version: VERSION
  });
  const scenarioValidated = await formal.scenarioPackages.validate(actor, scenarioDraft.reference);
  const scenarioFrozen = await formal.scenarioPackages.freeze(actor, scenarioValidated.reference);
  const scenarioApproved = await formal.scenarioPackages.approve(
    actor,
    scenarioFrozen.reference,
    "course_factory_scenario_approval"
  );
  const blueprints = new CourseBlueprintCommandService(persistence.createCourseBlueprintRegistry());
  const blueprintDraft = await blueprints.createDraft(actor, {
    activity_plan: [{ activity_id: "course_factory_activity" }],
    course_blueprint_id: "blueprint_course_factory_e2e",
    description: "Course Factory blueprint.",
    duration_minutes: 60,
    instructor_guidance_reference: "guide://course-factory",
    objectives: ["Reuse a governed course package."],
    ordered_phases: [
      {
        activity_type: "briefing",
        duration_minutes: 60,
        order: 1,
        phase_id: "course_factory_phase",
        student_instruction: "Read the brief.",
        teacher_guidance: "Keep it bounded.",
        title: "Briefing"
      }
    ],
    required_product_capabilities: ["course:create"],
    scenario_compatibility_constraints: { scenario_family: "course-factory" },
    schema_version: "course-blueprint.v1",
    tenant_id: DEFAULT_TENANT_ID,
    title: "Course Factory blueprint",
    version: VERSION
  });
  const blueprintValidated = await blueprints.validate(actor, blueprintDraft.reference);
  const blueprintFrozen = await blueprints.freeze(actor, blueprintValidated.reference);
  const blueprintApproved = await blueprints.approve(
    actor,
    blueprintFrozen.reference,
    "course_factory_blueprint_approval"
  );
  return {
    course_blueprint_reference: blueprintApproved.version.reference,
    parameter_set_reference: parameterApproved.version.reference,
    scenario_package_reference: scenarioApproved.version.reference
  };
}

describe("Course Factory governed lifecycle", () => {
  it("runs the exact package lifecycle and role-safe projections without touching formal truth", async () => {
    const { baseUrl, server, store } = await startServer();
    try {
      const references = await seedApprovedSources(store);
      const admin = await login(baseUrl, "admin", "admin");
      const teacher = await login(baseUrl, "teacher", "teacher");
      const beforeFormalTruth = structuredClone({
        courses: store.courses,
        decisions: store.decisions,
        runs: store.runs,
        settlementResults: store.settlementResults
      });
      const metadata = {
        known_limits: ["JSON runtime only"],
        provenance: { kind: "ORIGINAL" },
        rights: {
          allowed_tenant_ids: [DEFAULT_TENANT_ID],
          copy_allowed: true,
          export_allowed: true,
          expires_at: "2027-08-30T00:00:00.000Z",
          owner_tenant_id: DEFAULT_TENANT_ID
        },
        schema_version: "course-factory.v1",
        source_evidence_reference: buildM30CourseFactorySourceEvidence(),
        source_manifest: references,
        user_data_policy: {
          copied_private_data: false,
          copied_user_decisions: false,
          copied_user_results: false
        }
      } as const;
      const malformedEvidenceRequest = await requestJson<ApiEnvelope<unknown>>(
        baseUrl,
        "/api/v1/admin/course-factory/versions",
        {
          body: {
            ...references,
            course_package_id: "course_factory_invalid_source_date",
            description: "Reject impossible source evidence dates.",
            factory_metadata: {
              ...metadata,
              source_evidence_reference: {
                ...metadata.source_evidence_reference,
                living_operations: {
                  ...metadata.source_evidence_reference.living_operations,
                  expires_at: "2026-13-40"
                }
              }
            },
            title: "Invalid source date",
            version: VERSION
          },
          method: "POST",
          token: admin.access_token
        }
      );
      expect(malformedEvidenceRequest.status).toBe(422);

      const crossTenantProfileRequest = await requestJson<ApiEnvelope<unknown>>(
        baseUrl,
        "/api/v1/admin/course-factory/versions",
        {
          body: {
            ...references,
            course_package_id: "course_factory_cross_tenant_profile",
            description: "Reject cross-tenant project profiles.",
            factory_metadata: {
              ...metadata,
              source_manifest: {
                ...metadata.source_manifest,
                project_profile_reference: {
                  content_digest: "a".repeat(64),
                  project_profile_id: "profile_other_tenant",
                  tenant_id: "tenant_other",
                  version: VERSION
                }
              }
            },
            title: "Cross-tenant profile",
            version: VERSION
          },
          method: "POST",
          token: admin.access_token
        }
      );
      expect(crossTenantProfileRequest.status).toBe(403);

      const crossTenantCatalog = await requestJson<ApiEnvelope<unknown>>(
        baseUrl,
        "/api/v1/admin/course-factory/catalog?tenant_id=tenant_other",
        { token: admin.access_token }
      );
      expect(crossTenantCatalog.status).toBe(403);

      const crossTenantSponsor = await requestJson<ApiEnvelope<unknown>>(
        baseUrl,
        "/api/v1/bff/enterprise/course-factory/sponsor?tenant_id=tenant_other",
        { token: admin.access_token }
      );
      expect(crossTenantSponsor.status).toBe(403);

      const created = await requestJson<ApiEnvelope<CourseFactoryVersion>>(
        baseUrl,
        "/api/v1/admin/course-factory/versions",
        {
          body: {
            ...references,
            course_package_id: "course_factory_lifecycle_e2e",
            description: "Reusable governed course package.",
            factory_metadata: metadata,
            title: "Course Factory E2E",
            version: VERSION
          },
          method: "POST",
          token: admin.access_token
        }
      );
      expect(created.status).toBe(201);
      const reference: CoursePackageVersionReference = {
        content_digest: created.body.data.content_digest,
        course_package_id: created.body.data.course_package_id,
        tenant_id: DEFAULT_TENANT_ID,
        version: VERSION
      };

      const transition = async (action: string, contentDigest = reference.content_digest) =>
        requestJson<ApiEnvelope<CourseFactoryVersion>>(
          baseUrl,
          `/api/v1/admin/course-factory/versions/${reference.course_package_id}/versions/${VERSION}/${action}`,
          { body: { content_digest: contentDigest }, method: "POST", token: admin.access_token }
        );
      expect((await transition("validate")).status).toBe(200);
      expect((await transition("approve")).status).toBe(200);
      const published = await transition("publish");
      expect(published.status).toBe(200);
      expect(published.body.data.status).toBe("PUBLISHED");

      const legacyRetire = await requestJson<ApiEnvelope<CourseFactoryVersion>>(
        baseUrl,
        `/api/v1/admin/course-package-versions/${reference.course_package_id}/versions/${VERSION}/retire`,
        {
          body: {
            content_digest: reference.content_digest,
            course_package_id: reference.course_package_id,
            version: reference.version
          },
          method: "POST",
          token: admin.access_token
        }
      );
      expect(legacyRetire.status).toBe(409);

      const teacherCatalog = await requestJson<
        ApiEnvelope<{ catalog: readonly CourseFactoryVersion[] }>
      >(baseUrl, "/api/v1/bff/teacher/course-factory/catalog", { token: teacher.access_token });
      expect(teacherCatalog.status).toBe(200);
      expect(teacherCatalog.body.data.catalog).toHaveLength(1);
      expect(teacherCatalog.body.data.catalog[0]?.status).toBe("PUBLISHED");
      expect(
        teacherCatalog.body.data.catalog[0]?.factory_metadata.source_evidence_reference
          ?.binding_request_id
      ).toBe("SH-M29-MAIN-PULL-BINDING-REQUEST");

      const adminCatalog = await requestJson<
        ApiEnvelope<{ catalog: readonly CourseFactoryVersion[] }>
      >(baseUrl, "/api/v1/admin/course-factory/catalog", { token: admin.access_token });
      expect(adminCatalog.body.data.catalog[0]?.factory_metadata.source_evidence_reference).toEqual(
        metadata.source_evidence_reference
      );

      const audit = await requestJson<ApiEnvelope<{ lifecycle: readonly string[] }>>(
        baseUrl,
        `/api/v1/admin/course-factory/versions/${reference.course_package_id}/versions/${VERSION}/audit?content_digest=${reference.content_digest}`,
        { token: admin.access_token }
      );
      expect(audit.status).toBe(200);
      expect(audit.body.data.lifecycle).toEqual(["DRAFT", "VALIDATED", "APPROVED", "PUBLISHED"]);

      const exported = await requestJson<ApiEnvelope<CourseFactoryVersion>>(
        baseUrl,
        `/api/v1/admin/course-factory/versions/${reference.course_package_id}/versions/${VERSION}/export?content_digest=${reference.content_digest}`,
        { token: admin.access_token }
      );
      expect(exported.status, JSON.stringify(exported.body)).toBe(200);
      expect(exported.body.data.status).toBe("PUBLISHED");
      expect(
        store.auditLogs.some(
          (log) =>
            log.action === "course_factory.export" &&
            log.resource_id === `${reference.course_package_id}:${VERSION}` &&
            log.resource_type === "course_factory_version"
        )
      ).toBe(true);

      const sponsor = await requestJson<
        ApiEnvelope<{
          evidence_pack: { private_data_included: false };
          delivery_progress: { published_versions: number };
        }>
      >(baseUrl, "/api/v1/bff/enterprise/course-factory/sponsor", { token: admin.access_token });
      expect(sponsor.status).toBe(200);
      expect(sponsor.body.data.delivery_progress.published_versions).toBe(1);
      expect(sponsor.body.data.evidence_pack.private_data_included).toBe(false);
      expect(sponsor.body.data.evidence_pack.source_evidence_count).toBe(1);
      expect(sponsor.body.data.catalog[0]?.source_context).toEqual({
        target_region: "Hangzhou",
        epoch_version: "epoch-b.2026-08-30",
        qualification_status: "LIMITED",
        consumption_status: "LOOKAHEAD_READY",
        exact_binding_required: true
      });
      expect(sponsor.body.data.catalog[0]).not.toHaveProperty("factory_metadata");

      const cloned = await requestJson<ApiEnvelope<CourseFactoryVersion>>(
        baseUrl,
        "/api/v1/admin/course-factory/versions/clone",
        {
          body: {
            course_package_id: "course_factory_lifecycle_clone",
            description: "A derived governed course.",
            source_course_package_reference: reference,
            title: "Course Factory clone",
            version: "2.0.0"
          },
          method: "POST",
          token: admin.access_token
        }
      );
      expect(cloned.status).toBe(201);
      expect(cloned.body.data.factory_metadata.provenance.kind).toBe("CLONED");
      expect(cloned.body.data.factory_metadata.user_data_policy).toEqual(metadata.user_data_policy);
      expect({
        courses: store.courses,
        decisions: store.decisions,
        runs: store.runs,
        settlementResults: store.settlementResults
      }).toEqual(beforeFormalTruth);

      const wrongDigest = await transition("publish", "f".repeat(64));
      expect(wrongDigest.status).toBe(404);
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
