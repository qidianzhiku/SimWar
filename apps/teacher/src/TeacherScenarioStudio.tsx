import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import type {
  CoursePackageVersionReference,
  TeacherScenarioStudioActivationDto,
  TeacherScenarioStudioCatalogDto,
  TeacherScenarioStudioConfiguration,
  TeacherScenarioStudioDraftDto,
  TeacherScenarioStudioPreviewDto,
  TeacherScenarioStudioValidationDto
} from "@simwar/shared-contracts";
import {
  AuthorityBadge,
  KnownLimitBanner,
  StatePanel,
  WorkbenchFrame,
  type StateStatus
} from "@simwar/ui";
import {
  activateTeacherScenarioStudio,
  createTeacherScenarioStudioDraft,
  freezeTeacherScenarioStudio,
  getTeacherScenarioStudioModelSelection,
  loadTeacherScenarioStudioCatalog,
  previewTeacherScenarioStudio,
  TeacherScenarioStudioRequestError,
  validateTeacherScenarioStudio
} from "./teacher-scenario-studio-client";

const MODULE_KEYS = [
  "capital",
  "environment",
  "funding",
  "policy_shocks",
  "project_template",
  "workforce"
] as const;

type ModuleKey = (typeof MODULE_KEYS)[number];
type StudioPhase =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "ERROR"
  | "PERMISSION_DENIED"
  | "REAUTH_REQUIRED"
  | "STALE"
  | "CONFLICT"
  | "UNKNOWN_COMMAND_RESULT"
  | "BLOCKED";
type LifecycleStage =
  "SOURCE_SELECTION" | "DRAFT" | "VALIDATED" | "FROZEN" | "PREVIEWED" | "ACTIVATED" | "BLOCKED";

const emptyModuleConfiguration =
  (): TeacherScenarioStudioConfiguration["module_configuration"] => ({
    capital: { enabled: true },
    environment: { enabled: true },
    funding: { enabled: true },
    policy_shocks: { enabled: false },
    project_template: { enabled: true },
    workforce: { enabled: true }
  });

function getErrorMessage(error: unknown): string {
  if (error instanceof TeacherScenarioStudioRequestError) {
    if (error.status === 401) return "当前会话已失效，请重新登录后再读取 exact source。";
    if (error.status === 403) return "当前会话没有 Teacher Scenario Studio 权限。";
    if (error.status === 404) return "当前候选已过期或不在当前 exact context，请刷新来源目录。";
    if (error.status === 409) return `当前候选被治理门禁阻断：${error.code}`;
    return `Scenario Studio 请求失败：${error.code}`;
  }
  return error instanceof Error ? error.message : "Scenario Studio 请求失败。";
}

function errorPhase(error: unknown): StudioPhase {
  if (error instanceof TeacherScenarioStudioRequestError) {
    if (error.status === 401) return "REAUTH_REQUIRED";
    if (error.status === 403) return "PERMISSION_DENIED";
    if (error.status === 404) return "STALE";
    if (error.status === 409) return "CONFLICT";
  }
  return "ERROR";
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function referenceLabel(reference: CoursePackageVersionReference): string {
  return `${reference.course_package_id} / ${reference.version}`;
}

export function TeacherScenarioStudio(props: {
  apiBase: string;
  tenantId: string;
  token: string;
}): ReactElement {
  const [catalog, setCatalog] = useState<TeacherScenarioStudioCatalogDto | null>(null);
  const [blueprintIndex, setBlueprintIndex] = useState(0);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [selectedModelVersionRef, setSelectedModelVersionRef] = useState("");
  const [title, setTitle] = useState("Governed Teacher Scenario Studio candidate");
  const [description] = useState("Coupled scenario configuration for a bounded teaching run.");
  const [coursePackageId, setCoursePackageId] = useState("teacher_scenario_studio_candidate");
  const [version, setVersion] = useState("1.0.0");
  const [experienceProfile, setExperienceProfile] = useState<"STANDARD" | "ADVANCED">("STANDARD");
  const [moduleConfiguration, setModuleConfiguration] = useState(emptyModuleConfiguration);
  const [reference, setReference] = useState<CoursePackageVersionReference | null>(null);
  const [draft, setDraft] = useState<TeacherScenarioStudioDraftDto | null>(null);
  const [validation, setValidation] = useState<TeacherScenarioStudioValidationDto | null>(null);
  const [preview, setPreview] = useState<TeacherScenarioStudioPreviewDto | null>(null);
  const [activationReceipt, setActivationReceipt] =
    useState<TeacherScenarioStudioActivationDto | null>(null);
  const [phase, setPhase] = useState<StudioPhase>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const requestEpochRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const contextKeyRef = useRef(`${props.tenantId}:${props.token}`);
  contextKeyRef.current = `${props.tenantId}:${props.token}`;

  const selectedBlueprint = catalog?.course_blueprints[blueprintIndex];
  const selectedScenario = catalog?.scenario_packages[scenarioIndex];
  const selectedModel = catalog?.model_versions.find(
    (model) => model.model_version_ref === selectedModelVersionRef
  );
  const modelVersionRef = selectedModel?.model_version_ref ?? "";
  const modelSelection = getTeacherScenarioStudioModelSelection(
    catalog ?? { model_versions: [] },
    selectedModelVersionRef
  );

  const draftInput = useMemo(() => {
    if (!selectedBlueprint || !selectedScenario || !modelVersionRef) return null;
    return {
      course_blueprint_reference: selectedBlueprint.course_blueprint_reference,
      course_package_id: coursePackageId,
      description,
      parameter_set_reference: selectedScenario.parameter_set_reference,
      scenario_package_reference: selectedScenario.scenario_package_reference,
      studio_configuration: {
        custom_parameters: { mode: "DRAFT_ONLY" as const, values: {} },
        experience_profile: experienceProfile,
        model_version_ref: modelVersionRef,
        module_configuration: moduleConfiguration,
        schema_version: "teacher-scenario-studio.v1" as const
      },
      title,
      version
    };
  }, [
    coursePackageId,
    description,
    experienceProfile,
    modelVersionRef,
    moduleConfiguration,
    selectedBlueprint,
    selectedScenario,
    title,
    version
  ]);

  async function run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    onSuccess: (value: T) => void,
    options: { ambiguousTransport?: boolean } = {}
  ): Promise<void> {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    const epoch = ++requestEpochRef.current;
    const contextKey = contextKeyRef.current;
    activeControllerRef.current = controller;
    const isCurrent = () =>
      mountedRef.current &&
      requestEpochRef.current === epoch &&
      contextKeyRef.current === contextKey;
    setPhase("LOADING");
    setError(null);
    try {
      const value = await operation(controller.signal);
      if (!isCurrent()) return;
      onSuccess(value);
      setPhase("READY");
    } catch (nextError) {
      if (!isCurrent() || isAbortError(nextError)) return;
      const ambiguousTransport =
        options.ambiguousTransport &&
        (!(nextError instanceof TeacherScenarioStudioRequestError) || nextError.status >= 500);
      if (ambiguousTransport) {
        setError("操作结果暂未确认；请先刷新 exact source/readback，不会自动重试。");
        setPhase("UNKNOWN_COMMAND_RESULT");
        return;
      }
      setError(getErrorMessage(nextError));
      setPhase(errorPhase(nextError));
    } finally {
      if (isCurrent()) activeControllerRef.current = null;
    }
  }

  async function loadCatalog(): Promise<void> {
    setCatalog(null);
    setDraft(null);
    setReference(null);
    setValidation(null);
    setPreview(null);
    setActivationReceipt(null);
    setSelectedModelVersionRef("");
    await run(
      (signal) =>
        loadTeacherScenarioStudioCatalog({
          apiBase: props.apiBase,
          signal,
          token: props.token
        }),
      (nextCatalog) => {
        setCatalog(nextCatalog);
        setBlueprintIndex(0);
        setScenarioIndex(0);
      }
    );
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadCatalog();
    return () => {
      activeControllerRef.current?.abort();
      requestEpochRef.current += 1;
    };
    // The session identity is the only reload boundary for this product surface.
  }, [props.token, props.tenantId]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      activeControllerRef.current?.abort();
    },
    []
  );

  function toggleModule(key: ModuleKey): void {
    setModuleConfiguration((current) => ({
      ...current,
      [key]: { ...current[key], enabled: current[key].enabled !== true }
    }));
  }

  async function createDraft(): Promise<void> {
    if (!draftInput) return;
    await run(
      (nextSignal) =>
        createTeacherScenarioStudioDraft({
          apiBase: props.apiBase,
          draft: draftInput,
          signal: nextSignal,
          token: props.token
        }),
      (nextDraft) => {
        setDraft(nextDraft);
        setReference(nextDraft.course_package_reference);
        setValidation(null);
        setPreview(null);
        setActivationReceipt(null);
      },
      { ambiguousTransport: true }
    );
  }

  async function validateDraft(): Promise<void> {
    if (!reference) return;
    await run(
      (signal) =>
        validateTeacherScenarioStudio({
          apiBase: props.apiBase,
          reference,
          signal,
          token: props.token
        }),
      setValidation,
      { ambiguousTransport: true }
    );
  }

  async function freezeDraft(): Promise<void> {
    if (!reference) return;
    await run(
      (signal) =>
        freezeTeacherScenarioStudio({
          apiBase: props.apiBase,
          reference,
          signal,
          token: props.token
        }),
      (nextDraft) => {
        setDraft(nextDraft);
        setPreview(null);
      },
      { ambiguousTransport: true }
    );
  }

  async function previewDraft(): Promise<void> {
    if (!reference) return;
    await run(
      (signal) =>
        previewTeacherScenarioStudio({
          apiBase: props.apiBase,
          reference,
          signal,
          token: props.token
        }),
      setPreview,
      { ambiguousTransport: true }
    );
  }

  async function activateDraft(): Promise<void> {
    if (!reference) return;
    await run(
      (signal) =>
        activateTeacherScenarioStudio({
          apiBase: props.apiBase,
          reference,
          signal,
          token: props.token
        }),
      (result) => setActivationReceipt(result),
      { ambiguousTransport: true }
    );
  }

  const stage: LifecycleStage = activationReceipt
    ? "ACTIVATED"
    : validation?.status === "BLOCKED"
      ? "BLOCKED"
      : preview
        ? "PREVIEWED"
        : draft?.status === "FROZEN"
          ? "FROZEN"
          : validation
            ? "VALIDATED"
            : draft
              ? "DRAFT"
              : "SOURCE_SELECTION";
  const hasApprovedSources = Boolean(
    catalog && catalog.course_blueprints.length > 0 && catalog.scenario_packages.length > 0
  );
  const hasApprovedModel = Boolean(catalog && catalog.model_versions.length > 0);
  const sourceReady = Boolean(
    hasApprovedSources && modelSelection.kind === "SELECTED" && draftInput
  );
  const disabled = phase === "LOADING";
  const primaryActionLabel: Record<LifecycleStage, string> = {
    SOURCE_SELECTION: "创建 DRAFT",
    DRAFT: "下一步：验证兼容性",
    VALIDATED: "下一步：冻结候选",
    FROZEN: "下一步：Teacher 预览",
    PREVIEWED: "下一步：激活到 Course",
    ACTIVATED: "Course 已交接，Run 未激活",
    BLOCKED: "检查并恢复 exact source"
  };
  const primaryDisabled =
    disabled ||
    stage === "ACTIVATED" ||
    (stage === "SOURCE_SELECTION" && !sourceReady) ||
    (stage === "DRAFT" && !reference) ||
    (stage === "VALIDATED" && !reference) ||
    (stage === "FROZEN" && (!reference || !draft)) ||
    (stage === "PREVIEWED" && (!reference || !draft));

  async function runPrimaryAction(): Promise<void> {
    if (stage === "BLOCKED") return loadCatalog();
    if (stage === "SOURCE_SELECTION") return createDraft();
    if (stage === "DRAFT") return validateDraft();
    if (stage === "VALIDATED") return freezeDraft();
    if (stage === "FROZEN") return previewDraft();
    if (stage === "PREVIEWED") return activateDraft();
  }

  let statePanel: ReactElement;
  if (phase === "LOADING") {
    statePanel = <StatePanel status="loading" message="正在读取 exact approved sources…" />;
  } else if (error) {
    const status: StateStatus =
      phase === "PERMISSION_DENIED" || phase === "REAUTH_REQUIRED"
        ? "permission-denied"
        : phase === "STALE"
          ? "stale"
          : phase === "CONFLICT"
            ? "conflict"
            : phase === "UNKNOWN_COMMAND_RESULT"
              ? "unknown"
              : "error";
    statePanel = (
      <StatePanel
        status={status}
        message={error}
        recoveryAction="刷新 exact source catalog"
        onRecover={() => void loadCatalog()}
      />
    );
  } else if (!catalog) {
    statePanel = <StatePanel status="empty" message="尚未读取 exact approved source。" />;
  } else if (!hasApprovedSources) {
    statePanel = (
      <StatePanel
        status="empty"
        message="当前没有可用的 exact approved Blueprint/Scenario source。"
        recoveryAction="刷新 exact source catalog"
        onRecover={() => void loadCatalog()}
      />
    );
  } else if (!hasApprovedModel) {
    statePanel = (
      <StatePanel
        status="blocked"
        message="没有可用的 approved ModelVersion source；Create DRAFT 保持禁用。"
        recoveryAction="刷新 approved ModelVersion catalog"
        onRecover={() => void loadCatalog()}
      />
    );
  } else if (validation?.status === "BLOCKED") {
    statePanel = (
      <StatePanel
        status="blocked"
        message="当前候选未通过 readiness 检查；请先检查 exact source，不会盲目重放操作。"
        recoveryAction="刷新 exact source catalog"
        onRecover={() => void loadCatalog()}
      />
    );
  } else if (!selectedModelVersionRef) {
    statePanel = (
      <StatePanel status="ready" message="请选择并确认一个 approved ModelVersion 后继续。" />
    );
  } else {
    statePanel = (
      <StatePanel status="ready" message={`当前阶段：${stage}；下一步只有一个主操作。`} />
    );
  }

  return (
    <WorkbenchFrame
      ariaLabel="Teacher Scenario Studio"
      className="candidate-surface teacher-scenario-studio"
      eyebrow="M2 · TSS"
      title="受控教师场景工作室"
      badge={<AuthorityBadge authority="draft" />}
      boundary="candidate 只承载受控草稿，不拥有 Blueprint、Scenario、ParameterSet、ModelVersion 或 Run 的 underlying authority。"
      headerActions={
        <button
          className="secondary"
          disabled={disabled}
          type="button"
          onClick={() => void loadCatalog()}
        >
          刷新来源目录
        </button>
      }
      actions={
        <div className="tss-primary-action" aria-label="Scenario Studio primary action">
          <button
            className="primary"
            data-testid="tss-primary-action"
            disabled={primaryDisabled}
            type="button"
            onClick={() => void runPrimaryAction()}
          >
            {primaryActionLabel[stage]}
          </button>
        </div>
      }
      state={statePanel}
    >
      <div className="tss-context-summary" aria-label="Scenario Studio context summary">
        <span>租户</span>
        <strong>{props.tenantId}</strong>
        <span>模式</span>
        <strong>DRAFT_ONLY</strong>
      </div>
      <div className="tss-task-layout">
        <div className="tss-task-canvas">
          <p className="evidence-note">
            先确认客户任务，再执行一个合法的生命周期下一步。Provider 保持 OFF，custom parameters
            始终 DRAFT_ONLY。
          </p>
          <div className="tss-source-grid">
            <label>
              CourseBlueprint
              <select
                aria-label="Teacher Scenario Studio CourseBlueprint"
                disabled={disabled || Boolean(reference)}
                value={blueprintIndex}
                onChange={(event) => setBlueprintIndex(Number(event.target.value))}
              >
                {catalog?.course_blueprints.map((item, index) => (
                  <option key={item.course_blueprint_reference.content_digest} value={index}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ScenarioPackage
              <select
                aria-label="Teacher Scenario Studio ScenarioPackage"
                disabled={disabled || Boolean(reference)}
                value={scenarioIndex}
                onChange={(event) => setScenarioIndex(Number(event.target.value))}
              >
                {catalog?.scenario_packages.map((item, index) => (
                  <option key={item.scenario_package_reference.content_digest} value={index}>
                    {item.scenario_package_reference.scenario_package_id} /{" "}
                    {item.scenario_package_reference.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              approved ModelVersion（需显式选择）
              <select
                aria-label="Teacher Scenario Studio ModelVersion"
                disabled={disabled || Boolean(reference) || !hasApprovedModel}
                value={selectedModelVersionRef}
                onChange={(event) => setSelectedModelVersionRef(event.target.value)}
              >
                <option value="">请选择 approved ModelVersion</option>
                {catalog?.model_versions.map((model) => (
                  <option key={model.model_version_ref} value={model.model_version_ref}>
                    {model.model_version_ref} · {model.status} · provider {model.provider}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="status-grid">
            <label>
              ExperienceProfile
              <select
                aria-label="Teacher Scenario Studio ExperienceProfile"
                disabled={disabled || Boolean(reference)}
                value={experienceProfile}
                onChange={(event) =>
                  setExperienceProfile(event.target.value as "STANDARD" | "ADVANCED")
                }
              >
                <option value="STANDARD">STANDARD</option>
                <option value="ADVANCED">ADVANCED</option>
              </select>
            </label>
            <label>
              标题
              <input
                aria-label="Teacher Scenario Studio title"
                disabled={disabled || Boolean(reference)}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Candidate ID
              <input
                aria-label="Teacher Scenario Studio candidate id"
                disabled={disabled || Boolean(reference)}
                value={coursePackageId}
                onChange={(event) => setCoursePackageId(event.target.value)}
              />
            </label>
            <label>
              CoursePackage version
              <input
                aria-label="Teacher Scenario Studio version"
                disabled={disabled || Boolean(reference)}
                value={version}
                onChange={(event) => setVersion(event.target.value)}
              />
            </label>
          </div>
          <div className="tag-list" aria-label="Scenario Studio modules">
            {MODULE_KEYS.map((key) => (
              <label key={key}>
                <input
                  checked={Boolean(moduleConfiguration[key].enabled)}
                  disabled={disabled || Boolean(reference)}
                  type="checkbox"
                  onChange={() => toggleModule(key)}
                />
                <span>{key}</span>
              </label>
            ))}
          </div>
          <section className="tss-evidence" aria-label="Scenario Studio evidence summary">
            <h3>Evidence summary</h3>
            <p>ModelVersion：{modelVersionRef || "等待 Teacher 显式选择"}</p>
            <p>
              ParameterSet：
              {selectedScenario?.parameter_set_reference.parameter_set_id ?? "尚未绑定"}
            </p>
            <p>Course receipt != Run activation。</p>
          </section>
          {draft ? (
            <p className="evidence-note" role="status">
              候选状态：{draft.status} · {referenceLabel(draft.course_package_reference)}
            </p>
          ) : null}
          {validation ? (
            <p className="evidence-note">
              验证：exact refs PASS · compatibility PASS · model PASS · custom parameters
              PASS_WITH_LIMITS
            </p>
          ) : null}
          {preview ? (
            <p className="evidence-note">
              {preview.role_safe_preview.summary} · modules:{" "}
              {preview.role_safe_preview.module_labels.join(", ")}
            </p>
          ) : null}
          {activationReceipt ? (
            <section
              className="tss-evidence tss-course-receipt"
              aria-label="Course handoff receipt"
              data-testid="tss-course-receipt"
            >
              <h3>Course handoff receipt</h3>
              <p>Course ID：{activationReceipt.course.course_id}</p>
              <p>Course status：{activationReceipt.course.status}</p>
              <p>Activation status：{activationReceipt.activation.status}</p>
              <p>Activation writer：{activationReceipt.activation.writer}</p>
              <p>Run activation：{activationReceipt.activation.run_activation}</p>
              <p>Course receipt != Run activation。</p>
              <p>Run 创建与激活继续交由现有 server-owned Run writer。</p>
            </section>
          ) : null}
        </div>
        <details className="tss-inspector">
          <summary>技术 Inspector（按需展开）</summary>
          <dl>
            <div>
              <dt>Blueprint digest</dt>
              <dd>{selectedBlueprint?.course_blueprint_reference.content_digest ?? "未绑定"}</dd>
            </div>
            <div>
              <dt>Scenario digest</dt>
              <dd>{selectedScenario?.scenario_package_reference.content_digest ?? "未绑定"}</dd>
            </div>
            <div>
              <dt>ModelVersion ref</dt>
              <dd>{modelVersionRef || "未确认"}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>OFF</dd>
            </div>
            <div>
              <dt>Limits</dt>
              <dd>custom parameters DRAFT_ONLY；Run activation outside TSS</dd>
            </div>
          </dl>
        </details>
      </div>
      <KnownLimitBanner
        limitation="TSS 只创建 CoursePackage candidate，不重写 source authority。"
        unaffected="现有 BFF、writers、Run authority 与 GSI surface。"
        notProven="Product Acceptance、Human Validation 与 Merge。"
        scope="Teacher Scenario Studio feature-local target。"
      />
    </WorkbenchFrame>
  );
}
