import type {
  PendingCourseBlueprintBinding,
  CourseBlueprintBindingPort
} from "./course-blueprint-binding-store.js";
import type {
  CourseBlueprintApprovalRecord,
  CourseBlueprintRegistryPort,
  CourseBlueprintVersion
} from "./course-blueprint-authority.js";
import { CourseBlueprintAuthorityError } from "./course-blueprint-authority.js";
import {
  assertValidCourseBlueprintBinding,
  type CourseBlueprintBinding
} from "./course-blueprint-binding.js";
import type { FormalCourseAuthorityBinding } from "./formal-course-authority-binding.js";
import { FormalCourseAuthorityBindingStoreError } from "./formal-course-authority-binding-store.js";
import type { PendingFormalCourseAuthorityBinding } from "./formal-course-authority-binding-store.js";
import type { FormalRunRuntimeBinding } from "@simwar/shared-contracts";
import type { FormalRunRuntimeBindingPort } from "./formal-run-runtime-binding-store.js";
import type {
  ParameterSetApprovalRecord,
  ParameterSetRegistryPort,
  ParameterSetVersion
} from "./parameter-set-authority.js";
import { ParameterSetAuthorityError } from "./parameter-set-authority.js";
import type {
  PluginReleaseApprovalRecord,
  PluginReleaseAvailabilityRecord,
  PluginReleaseRegistryPort,
  PluginReleaseVersion
} from "./plugin-release-authority.js";
import { PluginReleaseAuthorityError } from "./plugin-release-authority.js";
import type {
  ScenarioPackageApprovalRecord,
  ScenarioPackageRegistryPort,
  ScenarioPackageVersion
} from "./scenario-package-authority.js";
import { ScenarioPackageAuthorityError } from "./scenario-package-authority.js";
import type { CoursePackageRegistryPort } from "./course-package-json-registry.js";
import {
  CoursePackageRegistryError,
  assertValidCoursePackageVersion,
  createCoursePackageVersionReference
} from "./course-package-json-registry.js";
import type { JsonFormalScenarioAuthorityPersistence } from "./json-repository-adapter.js";
import type { CourseBlueprintReference } from "@simwar/shared-contracts";
import type {
  ParameterSetReference,
  PluginReleaseReference,
  ScenarioPackageReference,
  CoursePackageVersionReference,
  CoursePackageVersion
} from "@simwar/shared-contracts";
import type { FormalCourseAuthorityBindingPort } from "./formal-course-authority-binding-store.js";
import type {
  PostgresQueryExecutor,
  PostgresTransactionExecutor
} from "./postgres-repository-adapter.js";

interface PostgresFormalPersistenceOptions {
  queryExecutor: PostgresQueryExecutor;
  transactionExecutor: PostgresTransactionExecutor;
}

interface FormalRecordInput {
  tenantId: string;
  authorityType: string;
  recordKind: string;
  recordId: string;
  version?: string;
  status?: string;
  contentDigest?: string;
  payload: Record<string, unknown>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameReference(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return Object.keys(right).every((key) => left[key] === right[key]);
}

async function readPayloads<T>(
  query: PostgresQueryExecutor,
  input: Omit<FormalRecordInput, "payload" | "contentDigest"> & { contentDigest?: string }
): Promise<T[]> {
  const result = await query(
    `SELECT payload FROM w025_formal_authority_records
       WHERE tenant_id = $1 AND authority_type = $2 AND record_kind = $3
         AND ($4::text = '' OR record_id = $4) AND ($5::text = '' OR version = $5)
         AND ($6::text = '' OR status = $6)
         AND ($7::text = '' OR content_digest = $7)
       ORDER BY append_sequence ASC`,
    [
      input.tenantId,
      input.authorityType,
      input.recordKind,
      input.recordId,
      input.version ?? "",
      input.status ?? "",
      input.contentDigest ?? ""
    ]
  );
  return result.rows.map((row) => clone((row as { payload: T }).payload));
}

async function writeRecord(
  query: PostgresQueryExecutor,
  input: FormalRecordInput,
  duplicateError: Error
): Promise<void> {
  const result = await query(
    `INSERT INTO w025_formal_authority_records
       (tenant_id, authority_type, record_kind, record_id, version, status, content_digest, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (tenant_id, authority_type, record_kind, record_id, version, status)
     DO NOTHING`,
    [
      input.tenantId,
      input.authorityType,
      input.recordKind,
      input.recordId,
      input.version ?? "",
      input.status ?? "",
      input.contentDigest ?? "",
      JSON.stringify(input.payload)
    ]
  );
  if (result.rowCount !== 1) throw duplicateError;
}

async function deleteRecord(
  query: PostgresQueryExecutor,
  input: Pick<FormalRecordInput, "tenantId" | "authorityType" | "recordKind" | "recordId">
): Promise<void> {
  await query(
    `DELETE FROM w025_formal_authority_records
       WHERE tenant_id = $1 AND authority_type = $2 AND record_kind = $3 AND record_id = $4`,
    [input.tenantId, input.authorityType, input.recordKind, input.recordId]
  );
}

function parameterReferenceMatches(
  candidate: ParameterSetVersion,
  reference: ParameterSetReference
): boolean {
  return (
    candidate.reference.parameter_set_id === reference.parameter_set_id &&
    candidate.reference.version === reference.version &&
    candidate.reference.content_digest === reference.content_digest
  );
}

class PostgresParameterSetRegistry implements ParameterSetRegistryPort {
  constructor(private readonly options: PostgresFormalPersistenceOptions) {}

  async appendApprovedVersion(
    version: ParameterSetVersion,
    record: ParameterSetApprovalRecord
  ): Promise<void> {
    await this.options.transactionExecutor(async (query) => {
      await writeRecord(
        query,
        {
          tenantId: version.tenant_id,
          authorityType: "parameter_set",
          recordKind: "snapshot",
          recordId: version.parameter_set_id,
          version: version.version,
          status: version.status,
          contentDigest: version.content_digest,
          payload: version as unknown as Record<string, unknown>
        },
        new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS")
      );
      await writeRecord(
        query,
        {
          tenantId: record.tenant_id,
          authorityType: "parameter_set",
          recordKind: "approval",
          recordId: record.approval_id,
          version: record.parameter_set_reference.version,
          status: "APPROVED",
          contentDigest: record.parameter_set_reference.content_digest,
          payload: record as unknown as Record<string, unknown>
        },
        new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS")
      );
    });
  }

  async appendVersion(version: ParameterSetVersion): Promise<void> {
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: version.tenant_id,
        authorityType: "parameter_set",
        recordKind: "snapshot",
        recordId: version.parameter_set_id,
        version: version.version,
        status: version.status,
        contentDigest: version.content_digest,
        payload: version as unknown as Record<string, unknown>
      },
      new ParameterSetAuthorityError("PARAMETER_SET_VERSION_ALREADY_EXISTS")
    );
  }

  async getByReference(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<ParameterSetVersion | null> {
    const rows = await readPayloads<ParameterSetVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "parameter_set",
      recordKind: "snapshot",
      recordId: reference.parameter_set_id,
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.at(-1) ?? null;
  }

  async listApprovalRecords(
    tenantId: string,
    reference: ParameterSetReference
  ): Promise<ParameterSetApprovalRecord[]> {
    const rows = await readPayloads<ParameterSetApprovalRecord>(this.options.queryExecutor, {
      tenantId,
      authorityType: "parameter_set",
      recordKind: "approval",
      recordId: "",
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.filter((row) =>
      sameReference(
        row.parameter_set_reference as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
  }

  async listApprovalRecordsForTenant(tenantId: string): Promise<readonly unknown[]> {
    return readPayloads<ParameterSetApprovalRecord>(this.options.queryExecutor, {
      tenantId,
      authorityType: "parameter_set",
      recordKind: "approval",
      recordId: ""
    });
  }

  async listLifecycleSnapshots(
    tenantId: string,
    parameterSetId: string,
    version?: string
  ): Promise<ParameterSetVersion[]> {
    return readPayloads<ParameterSetVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "parameter_set",
      recordKind: "snapshot",
      recordId: parameterSetId,
      ...(version === undefined ? {} : { version })
    });
  }

  async assertBindable(tenantId: string, reference: ParameterSetReference): Promise<void> {
    const rows = await this.listLifecycleSnapshots(
      tenantId,
      reference.parameter_set_id,
      reference.version
    );
    if (rows.length === 0) throw new ParameterSetAuthorityError("NOT_FOUND");
    const exact = rows.filter((row) => parameterReferenceMatches(row, reference));
    const latest = exact.at(-1);
    if (!latest) throw new ParameterSetAuthorityError("DIGEST_MISMATCH");
    if (latest.status === "RETIRED")
      throw new ParameterSetAuthorityError("RETIRED_FOR_NEW_BINDING");
    if (latest.status !== "APPROVED") throw new ParameterSetAuthorityError("NOT_APPROVED");
  }
}

class PostgresScenarioPackageRegistry implements ScenarioPackageRegistryPort {
  constructor(private readonly options: PostgresFormalPersistenceOptions) {}

  async appendApprovedVersion(
    version: ScenarioPackageVersion,
    record: ScenarioPackageApprovalRecord
  ): Promise<void> {
    await this.options.transactionExecutor(async (query) => {
      await writeRecord(
        query,
        {
          tenantId: version.tenant_id,
          authorityType: "scenario_package",
          recordKind: "snapshot",
          recordId: version.scenario_package_id,
          version: version.version,
          status: version.status,
          contentDigest: version.content_digest,
          payload: version as unknown as Record<string, unknown>
        },
        new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS")
      );
      await writeRecord(
        query,
        {
          tenantId: record.tenant_id,
          authorityType: "scenario_package",
          recordKind: "approval",
          recordId: record.approval_id,
          version: record.scenario_package_reference.version,
          status: "APPROVED",
          contentDigest: record.scenario_package_reference.content_digest,
          payload: record as unknown as Record<string, unknown>
        },
        new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS")
      );
    });
  }

  async appendVersion(version: ScenarioPackageVersion): Promise<void> {
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: version.tenant_id,
        authorityType: "scenario_package",
        recordKind: "snapshot",
        recordId: version.scenario_package_id,
        version: version.version,
        status: version.status,
        contentDigest: version.content_digest,
        payload: version as unknown as Record<string, unknown>
      },
      new ScenarioPackageAuthorityError("SCENARIO_PACKAGE_VERSION_ALREADY_EXISTS")
    );
  }

  async getByReference(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageVersion | null> {
    const rows = await readPayloads<ScenarioPackageVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "scenario_package",
      recordKind: "snapshot",
      recordId: reference.scenario_package_id,
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.at(-1) ?? null;
  }

  async listApprovalRecords(
    tenantId: string,
    reference: ScenarioPackageReference
  ): Promise<ScenarioPackageApprovalRecord[]> {
    const rows = await readPayloads<ScenarioPackageApprovalRecord>(this.options.queryExecutor, {
      tenantId,
      authorityType: "scenario_package",
      recordKind: "approval",
      recordId: "",
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.filter((row) =>
      sameReference(
        row.scenario_package_reference as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
  }

  async listApprovalRecordsForTenant(tenantId: string): Promise<readonly unknown[]> {
    return readPayloads<ScenarioPackageApprovalRecord>(this.options.queryExecutor, {
      tenantId,
      authorityType: "scenario_package",
      recordKind: "approval",
      recordId: ""
    });
  }

  async listLifecycleSnapshots(
    tenantId: string,
    scenarioPackageId: string,
    version?: string
  ): Promise<ScenarioPackageVersion[]> {
    return readPayloads<ScenarioPackageVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "scenario_package",
      recordKind: "snapshot",
      recordId: scenarioPackageId,
      ...(version === undefined ? {} : { version })
    });
  }

  async listApprovedForTenant(tenantId: string) {
    const rows = await readPayloads<ScenarioPackageVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "scenario_package",
      recordKind: "snapshot",
      recordId: ""
    });
    const latest = new Map<string, ScenarioPackageVersion>();
    for (const row of rows) latest.set(`${row.scenario_package_id}:${row.version}`, row);
    return [...latest.values()]
      .filter((row) => row.status === "APPROVED")
      .map((row) => ({
        artifact_policy: clone(row.artifact_policy),
        compatibility_metadata: clone(row.compatibility_metadata),
        content_digest: row.content_digest,
        parameter_set_reference: clone(row.parameter_set_reference),
        plugin_dependencies: clone(row.plugin_dependencies),
        reference: clone(row.reference),
        scenario_package_id: row.scenario_package_id,
        schema_version: row.schema_version,
        status: "APPROVED" as const,
        tenant_id: row.tenant_id,
        title:
          typeof row.metadata.title === "string" ? row.metadata.title : row.scenario_package_id,
        version: row.version
      }));
  }

  async assertBindable(tenantId: string, reference: ScenarioPackageReference): Promise<void> {
    const rows = await this.listLifecycleSnapshots(
      tenantId,
      reference.scenario_package_id,
      reference.version
    );
    if (rows.length === 0) throw new ScenarioPackageAuthorityError("NOT_FOUND");
    const exact = rows.filter((row) =>
      sameReference(
        row.reference as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
    const latest = exact.at(-1);
    if (!latest) throw new ScenarioPackageAuthorityError("DIGEST_MISMATCH");
    if (latest.status === "RETIRED")
      throw new ScenarioPackageAuthorityError("RETIRED_FOR_NEW_BINDING");
    if (latest.status !== "APPROVED") throw new ScenarioPackageAuthorityError("NOT_APPROVED");
  }
}

class PostgresCourseBlueprintRegistry implements CourseBlueprintRegistryPort {
  constructor(private readonly options: PostgresFormalPersistenceOptions) {}

  async appendApprovedVersion(
    version: CourseBlueprintVersion,
    record: CourseBlueprintApprovalRecord
  ): Promise<void> {
    await this.options.transactionExecutor(async (query) => {
      await writeRecord(
        query,
        {
          tenantId: version.tenant_id,
          authorityType: "course_blueprint",
          recordKind: "snapshot",
          recordId: version.course_blueprint_id,
          version: version.version,
          status: version.status,
          contentDigest: version.content_digest,
          payload: version as unknown as Record<string, unknown>
        },
        new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS")
      );
      await writeRecord(
        query,
        {
          tenantId: record.tenant_id,
          authorityType: "course_blueprint",
          recordKind: "approval",
          recordId: record.approval_id,
          version: record.course_blueprint_reference.version,
          status: "APPROVED",
          contentDigest: record.course_blueprint_reference.content_digest,
          payload: record as unknown as Record<string, unknown>
        },
        new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS")
      );
    });
  }

  async appendVersion(version: CourseBlueprintVersion): Promise<void> {
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: version.tenant_id,
        authorityType: "course_blueprint",
        recordKind: "snapshot",
        recordId: version.course_blueprint_id,
        version: version.version,
        status: version.status,
        contentDigest: version.content_digest,
        payload: version as unknown as Record<string, unknown>
      },
      new CourseBlueprintAuthorityError("COURSE_BLUEPRINT_VERSION_ALREADY_EXISTS")
    );
  }

  async getByReference(
    tenantId: string,
    reference: CourseBlueprintReference
  ): Promise<CourseBlueprintVersion | null> {
    const rows = await readPayloads<CourseBlueprintVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_blueprint",
      recordKind: "snapshot",
      recordId: reference.course_blueprint_id,
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.at(-1) ?? null;
  }

  async listApprovalRecords(
    tenantId: string,
    reference: CourseBlueprintReference
  ): Promise<CourseBlueprintApprovalRecord[]> {
    const rows = await readPayloads<CourseBlueprintApprovalRecord>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_blueprint",
      recordKind: "approval",
      recordId: "",
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.filter((row) =>
      sameReference(
        row.course_blueprint_reference as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
  }

  async listLifecycleSnapshots(
    tenantId: string,
    courseBlueprintId: string,
    version: string
  ): Promise<CourseBlueprintVersion[]> {
    return readPayloads<CourseBlueprintVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_blueprint",
      recordKind: "snapshot",
      recordId: courseBlueprintId,
      version
    });
  }

  async listForTenant(tenantId: string): Promise<CourseBlueprintVersion[]> {
    const rows = await readPayloads<CourseBlueprintVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_blueprint",
      recordKind: "snapshot",
      recordId: ""
    });
    const latest = new Map<string, CourseBlueprintVersion>();
    for (const row of rows) latest.set(`${row.course_blueprint_id}:${row.version}`, row);
    return [...latest.values()].filter((row) => row.status === "APPROVED");
  }

  async assertBindable(tenantId: string, reference: CourseBlueprintReference): Promise<void> {
    const rows = await this.listLifecycleSnapshots(
      tenantId,
      reference.course_blueprint_id,
      reference.version
    );
    if (rows.length === 0) throw new CourseBlueprintAuthorityError("NOT_FOUND");
    const exact = rows.filter((row) =>
      sameReference(
        row.reference as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
    const latest = exact.at(-1);
    if (!latest) throw new CourseBlueprintAuthorityError("DIGEST_MISMATCH");
    if (latest.status === "RETIRED")
      throw new CourseBlueprintAuthorityError("RETIRED_FOR_NEW_BINDING");
    if (latest.status !== "APPROVED") throw new CourseBlueprintAuthorityError("NOT_APPROVED");
  }
}

class PostgresPluginReleaseRegistry implements PluginReleaseRegistryPort {
  constructor(private readonly options: PostgresFormalPersistenceOptions) {}

  async appendVersion(version: PluginReleaseVersion): Promise<void> {
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: "__global__",
        authorityType: "plugin_release",
        recordKind: "snapshot",
        recordId: version.plugin_package_id,
        version: version.version,
        status: version.status,
        contentDigest: version.content_digest,
        payload: version as unknown as Record<string, unknown>
      },
      new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS")
    );
  }

  async appendApprovedVersion(
    version: PluginReleaseVersion,
    record: PluginReleaseApprovalRecord
  ): Promise<void> {
    await this.options.transactionExecutor(async (query) => {
      await this.appendVersionWithQuery(query, version);
      await writeRecord(
        query,
        {
          tenantId: "__global__",
          authorityType: "plugin_release",
          recordKind: "approval",
          recordId: record.owner_decision_id,
          version: record.plugin_release_reference.version,
          status: "APPROVED",
          contentDigest: record.plugin_release_reference.content_digest,
          payload: record as unknown as Record<string, unknown>
        },
        new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS")
      );
    });
  }

  async appendAvailableVersion(
    version: PluginReleaseVersion,
    record: PluginReleaseAvailabilityRecord
  ): Promise<void> {
    await this.options.transactionExecutor(async (query) => {
      await this.appendVersionWithQuery(query, version);
      await writeRecord(
        query,
        {
          tenantId: "__global__",
          authorityType: "plugin_release",
          recordKind: "availability",
          recordId: record.availability_decision_id,
          version: record.plugin_release_reference.version,
          status: "AVAILABLE",
          contentDigest: record.plugin_release_reference.content_digest,
          payload: record as unknown as Record<string, unknown>
        },
        new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS")
      );
    });
  }

  private async appendVersionWithQuery(
    query: PostgresQueryExecutor,
    version: PluginReleaseVersion
  ): Promise<void> {
    await writeRecord(
      query,
      {
        tenantId: "__global__",
        authorityType: "plugin_release",
        recordKind: "snapshot",
        recordId: version.plugin_package_id,
        version: version.version,
        status: version.status,
        contentDigest: version.content_digest,
        payload: version as unknown as Record<string, unknown>
      },
      new PluginReleaseAuthorityError("PLUGIN_RELEASE_VERSION_ALREADY_EXISTS")
    );
  }

  async getByReference(reference: PluginReleaseReference): Promise<PluginReleaseVersion | null> {
    const rows = await readPayloads<PluginReleaseVersion>(this.options.queryExecutor, {
      tenantId: "__global__",
      authorityType: "plugin_release",
      recordKind: "snapshot",
      recordId: reference.plugin_package_id,
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.at(-1) ?? null;
  }

  async listApprovalRecords(
    reference: PluginReleaseReference
  ): Promise<PluginReleaseApprovalRecord[]> {
    const rows = await readPayloads<PluginReleaseApprovalRecord>(this.options.queryExecutor, {
      tenantId: "__global__",
      authorityType: "plugin_release",
      recordKind: "approval",
      recordId: "",
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.filter((row) =>
      sameReference(
        row.plugin_release_reference as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
  }

  async listAvailabilityRecords(
    reference: PluginReleaseReference
  ): Promise<PluginReleaseAvailabilityRecord[]> {
    const rows = await readPayloads<PluginReleaseAvailabilityRecord>(this.options.queryExecutor, {
      tenantId: "__global__",
      authorityType: "plugin_release",
      recordKind: "availability",
      recordId: "",
      version: reference.version,
      contentDigest: reference.content_digest
    });
    return rows.filter((row) =>
      sameReference(
        row.plugin_release_reference as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
  }

  async listLifecycleSnapshots(
    pluginPackageId: string,
    version: string
  ): Promise<PluginReleaseVersion[]> {
    return readPayloads<PluginReleaseVersion>(this.options.queryExecutor, {
      tenantId: "__global__",
      authorityType: "plugin_release",
      recordKind: "snapshot",
      recordId: pluginPackageId,
      version
    });
  }

  async resolveAvailableForNewBinding(
    pluginPackageId: string,
    version: string
  ): Promise<PluginReleaseVersion | null> {
    const rows = await this.listLifecycleSnapshots(pluginPackageId, version);
    const digests = new Set(rows.map((row) => row.content_digest));
    if (digests.size > 1)
      throw new PluginReleaseAuthorityError("PLUGIN_RELEASE_CONTENT_DIGEST_CONFLICT");
    return rows.at(-1)?.status === "AVAILABLE" ? rows.at(-1)! : null;
  }
}

class PostgresCoursePackageRegistry implements CoursePackageRegistryPort {
  private readonly now = () => new Date().toISOString();

  constructor(private readonly options: PostgresFormalPersistenceOptions) {}

  currentTime(): string {
    return this.now();
  }

  async append(snapshot: CoursePackageVersion): Promise<void> {
    assertValidCoursePackageVersion(snapshot);
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: snapshot.tenant_id,
        authorityType: "course_package",
        recordKind: "snapshot",
        recordId: snapshot.course_package_id,
        version: snapshot.version,
        status: snapshot.status,
        contentDigest: snapshot.content_digest,
        payload: snapshot as unknown as Record<string, unknown>
      },
      new CoursePackageRegistryError("COURSE_PACKAGE_LIFECYCLE_INVALID")
    );
  }

  captureAuditCheckpointForCompensation(): CoursePackageVersion[] {
    return [];
  }

  restoreAuditCheckpointAfterFailure(): void {
    throw new CoursePackageRegistryError("COURSE_PACKAGE_POSTGRES_COMPENSATION_UNAVAILABLE");
  }

  async getByReference(
    tenantId: string,
    reference: CoursePackageVersionReference
  ): Promise<CoursePackageVersion | null> {
    const rows = await readPayloads<CoursePackageVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_package",
      recordKind: "snapshot",
      recordId: reference.course_package_id,
      version: reference.version
    });
    const exact = rows.filter((row) =>
      sameReference(
        createCoursePackageVersionReference(row) as unknown as Record<string, unknown>,
        reference as unknown as Record<string, unknown>
      )
    );
    return exact.at(-1) ?? null;
  }

  async listForTenant(tenantId: string): Promise<CoursePackageVersion[]> {
    const rows = await readPayloads<CoursePackageVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_package",
      recordKind: "snapshot",
      recordId: ""
    });
    const latest = new Map<string, CoursePackageVersion>();
    for (const row of rows) latest.set(`${row.course_package_id}:${row.version}`, row);
    return [...latest.values()].sort(
      (left, right) =>
        left.course_package_id.localeCompare(right.course_package_id) ||
        left.version.localeCompare(right.version)
    );
  }

  async listLifecycleSnapshots(
    tenantId: string,
    coursePackageId: string,
    version: string
  ): Promise<CoursePackageVersion[]> {
    return readPayloads<CoursePackageVersion>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_package",
      recordKind: "snapshot",
      recordId: coursePackageId,
      version
    });
  }
}

class PostgresCourseBlueprintBindingStore implements CourseBlueprintBindingPort {
  private readonly pending = new Map<symbol, PendingCourseBlueprintBinding>();
  constructor(private readonly options: PostgresFormalPersistenceOptions) {}

  async append(binding: CourseBlueprintBinding): Promise<void> {
    assertValidCourseBlueprintBinding(binding);
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: binding.tenant_id,
        authorityType: "course_blueprint_binding",
        recordKind: "binding",
        recordId: binding.course_id,
        payload: binding as unknown as Record<string, unknown>
      },
      new Error("course_blueprint_binding_already_exists")
    );
  }
  async appendPending(binding: CourseBlueprintBinding): Promise<PendingCourseBlueprintBinding> {
    await this.append(binding);
    const token = Symbol("postgres-course-blueprint-binding-pending");
    const pending = Object.freeze({
      course_id: binding.course_id,
      tenant_id: binding.tenant_id,
      token
    });
    this.pending.set(token, pending);
    return pending;
  }
  commitPending(pending: PendingCourseBlueprintBinding): void {
    if (!this.pending.delete(pending.token))
      throw new Error("course_blueprint_binding_pending_invalid");
  }
  async removeUncommitted(pending: PendingCourseBlueprintBinding): Promise<void> {
    if (!this.pending.delete(pending.token))
      throw new Error("course_blueprint_binding_pending_invalid");
    await deleteRecord(this.options.queryExecutor, {
      tenantId: pending.tenant_id,
      authorityType: "course_blueprint_binding",
      recordKind: "binding",
      recordId: pending.course_id
    });
  }
  async getForCourse(tenantId: string, courseId: string): Promise<CourseBlueprintBinding | null> {
    const rows = await readPayloads<CourseBlueprintBinding>(this.options.queryExecutor, {
      tenantId,
      authorityType: "course_blueprint_binding",
      recordKind: "binding",
      recordId: courseId
    });
    return rows.at(-1) ?? null;
  }
}

class PostgresFormalCourseAuthorityBindingStore implements FormalCourseAuthorityBindingPort {
  private readonly pending = new Map<
    symbol,
    {
      pending: PendingFormalCourseAuthorityBinding;
      retain_for_compensation: boolean;
      status: "pending" | "committed";
    }
  >();
  constructor(private readonly options: PostgresFormalPersistenceOptions) {}

  async append(binding: FormalCourseAuthorityBinding): Promise<void> {
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: binding.tenant_id,
        authorityType: "formal_course_binding",
        recordKind: "binding",
        recordId: binding.course_id,
        payload: binding as unknown as Record<string, unknown>
      },
      new FormalCourseAuthorityBindingStoreError("FORMAL_COURSE_BINDING_ALREADY_EXISTS")
    );
  }
  async appendPending(
    binding: FormalCourseAuthorityBinding,
    options: { readonly retain_for_compensation?: boolean } = {}
  ): Promise<PendingFormalCourseAuthorityBinding> {
    await this.append(binding);
    const token = Symbol("postgres-formal-course-binding-pending");
    const pending = Object.freeze({
      course_id: binding.course_id,
      tenant_id: binding.tenant_id,
      token
    });
    this.pending.set(token, {
      pending,
      retain_for_compensation: options.retain_for_compensation === true,
      status: "pending"
    });
    return pending;
  }
  commitPending(pending: PendingFormalCourseAuthorityBinding): void {
    const current = this.requirePending(pending, "pending");
    if (current.retain_for_compensation) {
      current.status = "committed";
      return;
    }
    this.pending.delete(pending.token);
  }
  finalizePending(pending: PendingFormalCourseAuthorityBinding): void {
    const current = this.requirePending(pending, "committed");
    if (!current.retain_for_compensation)
      throw new Error("formal_course_authority_binding_pending_finalize_invalid");
    this.pending.delete(pending.token);
  }
  async rollbackPending(pending: PendingFormalCourseAuthorityBinding): Promise<void> {
    const current = this.requirePending(pending);
    if (!current.retain_for_compensation)
      throw new Error("formal_course_authority_binding_pending_rollback_invalid");
    await deleteRecord(this.options.queryExecutor, {
      tenantId: pending.tenant_id,
      authorityType: "formal_course_binding",
      recordKind: "binding",
      recordId: pending.course_id
    });
    this.pending.delete(pending.token);
  }
  async removeUncommitted(pending: PendingFormalCourseAuthorityBinding): Promise<void> {
    this.requirePending(pending, "pending");
    await deleteRecord(this.options.queryExecutor, {
      tenantId: pending.tenant_id,
      authorityType: "formal_course_binding",
      recordKind: "binding",
      recordId: pending.course_id
    });
    this.pending.delete(pending.token);
  }
  async getForCourse(
    tenantId: string,
    courseId: string
  ): Promise<FormalCourseAuthorityBinding | null> {
    const rows = await readPayloads<FormalCourseAuthorityBinding>(this.options.queryExecutor, {
      tenantId,
      authorityType: "formal_course_binding",
      recordKind: "binding",
      recordId: courseId
    });
    return rows.at(-1) ?? null;
  }

  private requirePending(
    pending: PendingFormalCourseAuthorityBinding,
    expectedStatus?: "pending" | "committed"
  ): {
    pending: PendingFormalCourseAuthorityBinding;
    retain_for_compensation: boolean;
    status: "pending" | "committed";
  } {
    const current = this.pending.get(pending.token);
    if (
      !current ||
      current.pending.course_id !== pending.course_id ||
      current.pending.tenant_id !== pending.tenant_id ||
      (expectedStatus !== undefined && current.status !== expectedStatus)
    ) {
      throw new Error("formal_course_authority_binding_pending_invalid");
    }
    return current;
  }
}

class PostgresFormalRunRuntimeBindingStore implements FormalRunRuntimeBindingPort {
  constructor(private readonly options: PostgresFormalPersistenceOptions) {}
  async append(binding: FormalRunRuntimeBinding): Promise<void> {
    await writeRecord(
      this.options.queryExecutor,
      {
        tenantId: binding.tenant_id,
        authorityType: "formal_run_binding",
        recordKind: "binding",
        recordId: binding.run_id,
        payload: binding as unknown as Record<string, unknown>
      },
      new Error("FORMAL_RUN_BINDING_ALREADY_EXISTS")
    );
  }
  async removeAfterFailedCreation(binding: FormalRunRuntimeBinding): Promise<void> {
    const current = await this.getForRun(binding.tenant_id, binding.run_id);
    if (!current || current.binding_digest !== binding.binding_digest)
      throw new Error("formal_run_binding_failed_creation_missing");
    await deleteRecord(this.options.queryExecutor, {
      tenantId: binding.tenant_id,
      authorityType: "formal_run_binding",
      recordKind: "binding",
      recordId: binding.run_id
    });
  }
  async getForRun(tenantId: string, runId: string): Promise<FormalRunRuntimeBinding | null> {
    const rows = await readPayloads<FormalRunRuntimeBinding>(this.options.queryExecutor, {
      tenantId,
      authorityType: "formal_run_binding",
      recordKind: "binding",
      recordId: runId
    });
    return rows.at(-1) ?? null;
  }
}

export interface PostgresW025BindingPorts {
  readonly courseBlueprintBindingStore: CourseBlueprintBindingPort;
  readonly formalCourseAuthorityBindingStore: FormalCourseAuthorityBindingPort;
  readonly formalRunRuntimeBindingStore: FormalRunRuntimeBindingPort;
}

export interface PostgresFormalAuthorityPersistence extends JsonFormalScenarioAuthorityPersistence {
  readonly coursePackageRegistry: CoursePackageRegistryPort;
  readonly w025Bindings: PostgresW025BindingPorts;
}

export function createPostgresFormalAuthorityPersistence(
  options: PostgresFormalPersistenceOptions
): PostgresFormalAuthorityPersistence {
  const removeTenantBaselineMaterialization = async (materialization: {
    readonly idempotencyKeyDigest: string;
    readonly parameterSet: { readonly approvalId: string; readonly parameterSetId: string };
    readonly provisioningRequestDigest: string;
    readonly scenarioPackage: { readonly approvalId: string; readonly scenarioPackageId: string };
    readonly tenantId: string;
  }): Promise<void> => {
    const baselineMatch = (field: string, parameter: number) =>
      `(payload->'baseline_provenance'->>'${field}') = $${parameter}`;
    await options.transactionExecutor(async (query) => {
      await query(
        `DELETE FROM w025_formal_authority_records
           WHERE tenant_id = $1 AND authority_type IN ('parameter_set', 'scenario_package')
             AND record_kind = 'snapshot'
             AND ${baselineMatch("idempotency_key_digest", 2)}
             AND (payload->'baseline_provenance'->>'provisioning_request_digest') = $3`,
        [
          materialization.tenantId,
          materialization.idempotencyKeyDigest,
          materialization.provisioningRequestDigest
        ]
      );
      await query(
        `DELETE FROM w025_formal_authority_records
           WHERE tenant_id = $1 AND authority_type = 'parameter_set'
             AND record_kind = 'approval' AND record_id = $2`,
        [materialization.tenantId, materialization.parameterSet.approvalId]
      );
      await query(
        `DELETE FROM w025_formal_authority_records
           WHERE tenant_id = $1 AND authority_type = 'scenario_package'
             AND record_kind = 'approval' AND record_id = $2`,
        [materialization.tenantId, materialization.scenarioPackage.approvalId]
      );
    });
  };
  return {
    createCourseBlueprintRegistry: () => new PostgresCourseBlueprintRegistry(options),
    createParameterSetRegistry: () => new PostgresParameterSetRegistry(options),
    createPluginReleaseRegistry: () => new PostgresPluginReleaseRegistry(options),
    createScenarioPackageRegistry: () => new PostgresScenarioPackageRegistry(options),
    removeTenantBaselineMaterialization,
    coursePackageRegistry: new PostgresCoursePackageRegistry(options),
    w025Bindings: {
      courseBlueprintBindingStore: new PostgresCourseBlueprintBindingStore(options),
      formalCourseAuthorityBindingStore: new PostgresFormalCourseAuthorityBindingStore(options),
      formalRunRuntimeBindingStore: new PostgresFormalRunRuntimeBindingStore(options)
    }
  };
}
