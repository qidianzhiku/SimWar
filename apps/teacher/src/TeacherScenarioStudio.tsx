import { useEffect, useMemo, useState, type ReactElement } from "react";
import type {
  CoursePackageVersionReference,
  TeacherScenarioStudioCatalogDto,
  TeacherScenarioStudioConfiguration,
  TeacherScenarioStudioDraftDto,
  TeacherScenarioStudioPreviewDto,
  TeacherScenarioStudioValidationDto
} from "@simwar/shared-contracts";
import {
  activateTeacherScenarioStudio,
  createTeacherScenarioStudioDraft,
  freezeTeacherScenarioStudio,
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
    if (error.status === 401) return "请先登录教师账号。";
    if (error.status === 403) return "当前会话没有 Teacher Scenario Studio 权限。";
    if (error.status === 409) return `当前候选被治理门禁阻断：${error.code}`;
    return `Scenario Studio 请求失败：${error.code}`;
  }
  return error instanceof Error ? error.message : "Scenario Studio 请求失败。";
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
  const [activationCourseId, setActivationCourseId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"IDLE" | "LOADING" | "READY" | "ERROR">("IDLE");
  const [error, setError] = useState<string | null>(null);

  const selectedBlueprint = catalog?.course_blueprints[blueprintIndex];
  const selectedScenario = catalog?.scenario_packages[scenarioIndex];
  const modelVersionRef = catalog?.model_versions[0]?.model_version_ref ?? "";

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

  async function run<T>(operation: () => Promise<T>, onSuccess: (value: T) => void): Promise<void> {
    setPhase("LOADING");
    setError(null);
    try {
      onSuccess(await operation());
      setPhase("READY");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setPhase("ERROR");
    }
  }

  async function loadCatalog(): Promise<void> {
    await run(
      () => loadTeacherScenarioStudioCatalog({ apiBase: props.apiBase, token: props.token }),
      (nextCatalog) => {
        setCatalog(nextCatalog);
        setBlueprintIndex(0);
        setScenarioIndex(0);
      }
    );
  }

  useEffect(() => {
    void loadCatalog();
    // The session identity is the only reload boundary for this product surface.
  }, [props.token, props.tenantId]);

  function toggleModule(key: ModuleKey): void {
    setModuleConfiguration((current) => ({
      ...current,
      [key]: { ...current[key], enabled: current[key].enabled !== true }
    }));
  }

  async function createDraft(): Promise<void> {
    if (!draftInput) return;
    await run(
      () =>
        createTeacherScenarioStudioDraft({
          apiBase: props.apiBase,
          draft: draftInput,
          token: props.token
        }),
      (nextDraft) => {
        setDraft(nextDraft);
        setReference(nextDraft.course_package_reference);
        setValidation(null);
        setPreview(null);
        setActivationCourseId(null);
      }
    );
  }

  async function validateDraft(): Promise<void> {
    if (!reference) return;
    await run(
      () =>
        validateTeacherScenarioStudio({ apiBase: props.apiBase, reference, token: props.token }),
      setValidation
    );
  }

  async function freezeDraft(): Promise<void> {
    if (!reference) return;
    await run(
      () => freezeTeacherScenarioStudio({ apiBase: props.apiBase, reference, token: props.token }),
      (nextDraft) => {
        setDraft(nextDraft);
        setPreview(null);
      }
    );
  }

  async function previewDraft(): Promise<void> {
    if (!reference) return;
    await run(
      () => previewTeacherScenarioStudio({ apiBase: props.apiBase, reference, token: props.token }),
      setPreview
    );
  }

  async function activateDraft(): Promise<void> {
    if (!reference) return;
    await run(
      () =>
        activateTeacherScenarioStudio({ apiBase: props.apiBase, reference, token: props.token }),
      (result) => setActivationCourseId(result.course.course_id)
    );
  }

  const disabled = phase === "LOADING";
  return (
    <section
      className="candidate-surface teacher-scenario-studio"
      aria-label="Teacher Scenario Studio"
    >
      <div className="candidate-heading">
        <div>
          <p className="eyebrow">M2 · TSS</p>
          <h2>
            受控教师场景工作室 <small>Governed Teacher Scenario Studio</small>
          </h2>
        </div>
        <button className="secondary" disabled={disabled} onClick={() => void loadCatalog()}>
          刷新来源目录
        </button>
      </div>
      <p className="evidence-note">
        统一编辑只生成一个 CoursePackage
        candidate；CourseBlueprint、ScenarioPackage、ParameterSet、ModelVersion 仍由各自 authority
        管理，custom parameters 始终 DRAFT_ONLY。
      </p>
      {error ? (
        <p className="readiness-message" role="alert">
          {error}
        </p>
      ) : null}
      {!catalog ||
      catalog.course_blueprints.length === 0 ||
      catalog.scenario_packages.length === 0 ? (
        <p className="evidence-note" role="status">
          {phase === "LOADING"
            ? "正在读取 exact approved sources…"
            : "当前没有可用的 exact approved Blueprint/Scenario source。"}
        </p>
      ) : (
        <>
          <div className="status-grid">
            <label>
              CourseBlueprint
              <select
                aria-label="Teacher Scenario Studio CourseBlueprint"
                value={blueprintIndex}
                disabled={disabled || Boolean(reference)}
                onChange={(event) => setBlueprintIndex(Number(event.target.value))}
              >
                {catalog.course_blueprints.map((item, index) => (
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
                value={scenarioIndex}
                disabled={disabled || Boolean(reference)}
                onChange={(event) => setScenarioIndex(Number(event.target.value))}
              >
                {catalog.scenario_packages.map((item, index) => (
                  <option key={item.scenario_package_reference.content_digest} value={index}>
                    {item.scenario_package_reference.scenario_package_id} /{" "}
                    {item.scenario_package_reference.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ExperienceProfile
              <select
                aria-label="Teacher Scenario Studio ExperienceProfile"
                value={experienceProfile}
                disabled={disabled || Boolean(reference)}
                onChange={(event) =>
                  setExperienceProfile(event.target.value as "STANDARD" | "ADVANCED")
                }
              >
                <option value="STANDARD">STANDARD</option>
                <option value="ADVANCED">ADVANCED</option>
              </select>
            </label>
          </div>
          <div className="status-grid">
            <label>
              标题
              <input
                aria-label="Teacher Scenario Studio title"
                value={title}
                disabled={disabled || Boolean(reference)}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Candidate ID
              <input
                aria-label="Teacher Scenario Studio candidate id"
                value={coursePackageId}
                disabled={disabled || Boolean(reference)}
                onChange={(event) => setCoursePackageId(event.target.value)}
              />
            </label>
            <label>
              版本
              <input
                aria-label="Teacher Scenario Studio version"
                value={version}
                disabled={disabled || Boolean(reference)}
                onChange={(event) => setVersion(event.target.value)}
              />
            </label>
          </div>
          <div className="tag-list" aria-label="Scenario Studio modules">
            {MODULE_KEYS.map((key) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(moduleConfiguration[key].enabled)}
                  disabled={disabled || Boolean(reference)}
                  onChange={() => toggleModule(key)}
                />{" "}
                {key}
              </label>
            ))}
          </div>
          <p className="evidence-note">
            Explicit model: {modelVersionRef} · provider: OFF · ParameterSet:{" "}
            {selectedScenario?.parameter_set_reference.parameter_set_id}
          </p>
          <div className="button-row">
            <button
              className="primary"
              disabled={disabled || Boolean(reference) || !draftInput}
              onClick={() => void createDraft()}
            >
              创建 DRAFT
            </button>
            <button
              className="secondary"
              disabled={disabled || !reference || Boolean(validation)}
              onClick={() => void validateDraft()}
            >
              验证兼容性
            </button>
            <button
              className="secondary"
              disabled={disabled || !reference || !validation || Boolean(preview)}
              onClick={() => void freezeDraft()}
            >
              冻结候选
            </button>
            <button
              className="secondary"
              disabled={disabled || !reference || !draft || draft.status !== "FROZEN"}
              onClick={() => void previewDraft()}
            >
              Teacher 预览
            </button>
            <button
              className="primary"
              disabled={disabled || !reference || !draft || draft.status !== "FROZEN"}
              onClick={() => void activateDraft()}
            >
              激活到 Course
            </button>
          </div>
        </>
      )}
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
      {activationCourseId ? (
        <p className="evidence-note" role="status">
          已通过现有 Course/formal binding writers 创建 Course：{activationCourseId}。Run activation
          仍交由现有 Run writer。
        </p>
      ) : null}
    </section>
  );
}
