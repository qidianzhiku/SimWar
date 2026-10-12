import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  isGSICrossRoundPairOptions,
  type DdtExactContext,
  type GSIAdminProjection,
  type GSICrossRoundAdminProjection,
  type GSICrossRoundPairOptions
} from "@simwar/shared-contracts";
import { DecisionThreadEvidenceSpine } from "@simwar/ui";
import "@simwar/ui/decision-thread-evidence-spine.css";
import "./gsi-xr.css";

export const GSI_AUDIT_PATH = "/api/v1/bff/admin/gsi/audit";
const DDT_AUTHORIZED_ACTIVITY_ID = "activity_consequence";
const PAIR_SELECTION_MESSAGE =
  "服务器尚未提供可用的回合配对列表。请先提供受控课程、运行和队伍上下文，再选择两个精确回合。";

export interface GovernedStakeholderIntelligenceAuditPanelProps {
  apiBase: string;
  tenantId: string;
  token: string;
  initialCandidateId?: string;
  initialComparison?: GSICrossRoundAdminProjection;
  onReauthenticate?: (() => void) | undefined;
}

interface EnvelopeError {
  code?: string;
  message?: string;
}

interface PairOptionsEnvelope {
  code?: string;
  message?: string;
  request_id?: string;
  data?: GSICrossRoundPairOptions | EnvelopeError;
  error?: EnvelopeError;
}

function isEnvelopeErrorData(value: unknown): value is EnvelopeError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

function normalizeEnvelopeError(value: unknown): EnvelopeError {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const candidate = value as { code?: unknown; message?: unknown };
  return {
    ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
    ...(typeof candidate.message === "string" ? { message: candidate.message } : {})
  };
}

function readEnvelopeError(payload: unknown): EnvelopeError {
  if (!isRecord(payload)) return {};
  const envelope = payload as {
    code?: unknown;
    data?: unknown;
    error?: unknown;
    message?: unknown;
  };
  const topLevel: EnvelopeError = {
    ...(typeof envelope.code === "string" ? { code: envelope.code } : {}),
    ...(typeof envelope.message === "string" ? { message: envelope.message } : {})
  };
  if (envelope.error !== undefined && envelope.error !== null) {
    return { ...topLevel, ...normalizeEnvelopeError(envelope.error) };
  }
  return isEnvelopeErrorData(envelope.data)
    ? { ...topLevel, ...normalizeEnvelopeError(envelope.data) }
    : topLevel;
}

function hasEnvelopeData<T>(payload: unknown): payload is { data: T } {
  return (
    isRecord(payload) &&
    Object.hasOwn(payload, "data") &&
    payload.data !== undefined &&
    !isEnvelopeErrorData(payload.data)
  );
}

function hasEnvelopeError(payload: unknown): boolean {
  return isRecord(payload) && Object.hasOwn(payload, "error");
}

function hasNonOkEnvelopeCode(payload: unknown): boolean {
  return isRecord(payload) && payload.code !== undefined && payload.code !== "OK";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  return (
    Object.keys(value).length === required.length &&
    required.every((key) => Object.hasOwn(value, key))
  );
}

function isExactString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !["latest", "current", "default", "fallback", "first", "last", "newest"].includes(
      value.toLowerCase()
    )
  );
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value as T[number]);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isRoundSide(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = ["candidate_id", "candidate_digest", "round_id", "round_no"];
  return (
    hasExactKeys(value, keys) &&
    isExactString(value.candidate_id) &&
    isDigest(value.candidate_digest) &&
    isExactString(value.round_id) &&
    typeof value.round_no === "number" &&
    Number.isSafeInteger(value.round_no) &&
    value.round_no > 0
  );
}

function isComparisonPair(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = ["tenant_id", "course_id", "run_id", "team_id", "from", "to"];
  return (
    hasExactKeys(value, keys) &&
    isExactString(value.tenant_id) &&
    isExactString(value.course_id) &&
    isExactString(value.run_id) &&
    isExactString(value.team_id) &&
    isRoundSide(value.from) &&
    isRoundSide(value.to)
  );
}

function isComparisonMovement(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const required = ["signal_key", "stakeholder_type", "intent", "direction"];
  const optional = ["from_value", "to_value", "delta"];
  if (
    !required.every((key) => Object.hasOwn(value, key)) ||
    !Object.keys(value).every((key) => required.includes(key) || optional.includes(key))
  )
    return false;
  const inRange = (candidate: unknown, limit: number) =>
    candidate === undefined ||
    (typeof candidate === "number" && Number.isFinite(candidate) && Math.abs(candidate) <= limit);
  return (
    isExactString(value.signal_key) &&
    isOneOf(value.stakeholder_type, ["customer", "regulator", "bank", "employee", "media"]) &&
    isOneOf(value.intent, [
      "protect_demand",
      "reduce_regulatory_risk",
      "preserve_liquidity",
      "retain_workforce",
      "protect_reputation"
    ]) &&
    isOneOf(value.direction, ["NEW", "REMOVED", "INCREASED", "DECREASED", "STABLE"]) &&
    inRange(value.from_value, 1) &&
    inRange(value.to_value, 1) &&
    inRange(value.delta, 2)
  );
}

function isComparison(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = [
    "discriminator",
    "pair",
    "movements",
    "comparison_digest",
    "non_causal",
    "causal_proof",
    "known_limits"
  ];
  return (
    hasExactKeys(value, keys) &&
    value.discriminator === "gsi_cross_round_comparison" &&
    isComparisonPair(value.pair) &&
    Array.isArray(value.movements) &&
    value.movements.every(isComparisonMovement) &&
    isDigest(value.comparison_digest) &&
    value.non_causal === true &&
    value.causal_proof === false &&
    Array.isArray(value.known_limits) &&
    value.known_limits.length > 0 &&
    value.known_limits.every((limit) => typeof limit === "string")
  );
}

function isContextBinding(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = [
    "activity_id",
    "course_id",
    "role_key",
    "round_id",
    "round_no",
    "run_id",
    "team_id",
    "tenant_id"
  ];
  return (
    hasExactKeys(value, keys) &&
    ["activity_id", "course_id", "role_key", "round_id", "run_id", "team_id", "tenant_id"].every(
      (key) => isExactString(value[key])
    ) &&
    typeof value.round_no === "number" &&
    Number.isSafeInteger(value.round_no) &&
    value.round_no > 0
  );
}

function isComparisonContext(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const keys = [
    "status",
    "context",
    "anchors",
    "context_digest",
    "non_causal",
    "causal_proof",
    "official_outcome_recomputed",
    "official_truth_write",
    "recovery",
    "known_limits",
    "context_binding"
  ];
  if (
    !hasExactKeys(value, keys) ||
    !isOneOf(value.status, ["AVAILABLE", "CONTEXT_UNAVAILABLE", "REBASE_REQUIRED"]) ||
    !isContextBinding(value.context) ||
    !isContextBinding(value.context_binding) ||
    !Array.isArray(value.anchors) ||
    !value.anchors.every((anchor) => {
      if (!isRecord(anchor)) return false;
      return (
        hasExactKeys(anchor, ["source", "context_digest", "status"]) &&
        isOneOf(anchor.source, ["W3", "M2P5"]) &&
        isDigest(anchor.context_digest) &&
        anchor.status === "PUBLISHED"
      );
    }) ||
    !isDigest(value.context_digest) ||
    value.non_causal !== true ||
    value.causal_proof !== false ||
    value.official_outcome_recomputed !== false ||
    value.official_truth_write !== false ||
    !isOneOf(value.recovery, ["RELOAD_EXACT_CONTEXT", "WAIT_FOR_PUBLICATION"]) ||
    !Array.isArray(value.known_limits) ||
    value.known_limits.length === 0 ||
    !value.known_limits.every((limit) => typeof limit === "string")
  )
    return false;
  return true;
}

function isAdminComparison(value: unknown): value is GSICrossRoundAdminProjection {
  if (!isRecord(value)) return false;
  const keys = [
    "surface",
    "tenant_id",
    "comparison",
    "context",
    "provider",
    "official_truth_write",
    "known_limits",
    "recovery"
  ];
  return (
    hasExactKeys(value, keys) &&
    value.surface === "admin" &&
    isExactString(value.tenant_id) &&
    isComparison(value.comparison) &&
    isComparisonContext(value.context) &&
    value.provider === "OFF" &&
    value.official_truth_write === false &&
    Array.isArray(value.known_limits) &&
    value.known_limits.length > 0 &&
    value.known_limits.every((limit) => typeof limit === "string") &&
    isOneOf(value.recovery, ["RELOAD_EXACT_CONTEXT", "WAIT_FOR_PUBLICATION"])
  );
}

function matchesContextBinding(
  left: GSICrossRoundAdminProjection["context"]["context"],
  right: GSICrossRoundAdminProjection["context"]["context"]
): boolean {
  return (
    left.activity_id === right.activity_id &&
    left.course_id === right.course_id &&
    left.role_key === right.role_key &&
    left.round_id === right.round_id &&
    left.round_no === right.round_no &&
    left.run_id === right.run_id &&
    left.team_id === right.team_id &&
    left.tenant_id === right.tenant_id
  );
}

function hasAdminInternalIdentity(value: GSICrossRoundAdminProjection): boolean {
  const pair = value.comparison.pair;
  const context = value.context.context;
  const contextBinding = value.context.context_binding;
  return (
    value.tenant_id === pair.tenant_id &&
    matchesContextBinding(context, contextBinding) &&
    pair.course_id === context.course_id &&
    pair.run_id === context.run_id &&
    pair.team_id === context.team_id &&
    context.round_id === pair.to.round_id &&
    context.round_no === pair.to.round_no
  );
}

function isAcceptedAdminBootstrap(
  value: unknown,
  tenantId: string
): value is GSICrossRoundAdminProjection {
  return (
    isAdminComparison(value) && value.tenant_id === tenantId && hasAdminInternalIdentity(value)
  );
}

type AdminComparisonSelection =
  | {
      mode: "candidate";
      tenant_id: string;
      activity_id: string;
      role_key: string;
      from_candidate_id: string;
      to_candidate_id: string;
      course_id?: string;
      run_id?: string;
      team_id?: string;
    }
  | {
      mode: "round";
      tenant_id: string;
      course_id: string;
      run_id: string;
      team_id: string;
      activity_id: string;
      role_key: string;
      from_round_id: string;
      to_round_id: string;
    };

function isAcceptedAdminComparison(
  value: unknown,
  selection: AdminComparisonSelection
): value is GSICrossRoundAdminProjection {
  if (!isAdminComparison(value) || !hasAdminInternalIdentity(value)) return false;
  const pair = value.comparison.pair;
  const context = value.context.context;
  if (
    value.tenant_id !== selection.tenant_id ||
    context.tenant_id !== selection.tenant_id ||
    context.activity_id !== selection.activity_id ||
    context.role_key !== selection.role_key
  )
    return false;
  if (selection.mode === "round") {
    return (
      context.course_id === selection.course_id &&
      context.run_id === selection.run_id &&
      context.team_id === selection.team_id &&
      pair.from.round_id === selection.from_round_id &&
      pair.to.round_id === selection.to_round_id
    );
  }
  return (
    (selection.course_id === undefined || context.course_id === selection.course_id) &&
    (selection.run_id === undefined || context.run_id === selection.run_id) &&
    (selection.team_id === undefined || context.team_id === selection.team_id) &&
    pair.from.candidate_id === selection.from_candidate_id &&
    pair.to.candidate_id === selection.to_candidate_id
  );
}

function isPairOptionsEnvelope(value: unknown): value is PairOptionsEnvelope {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAcceptedPairOptionsEnvelope(value: unknown): value is PairOptionsEnvelope {
  return (
    isPairOptionsEnvelope(value) &&
    Object.keys(value).length === 4 &&
    ["code", "data", "message", "request_id"].every((key) => Object.hasOwn(value, key)) &&
    value.code === "OK" &&
    typeof value.message === "string" &&
    typeof value.request_id === "string"
  );
}

function matchesPairSelection(
  context: GSICrossRoundPairOptions["context"],
  selected: {
    course_id: string;
    run_id: string;
    team_id: string;
    activity_id: string;
    role_key: string;
  }
): boolean {
  return (
    context.course_id === selected.course_id &&
    context.run_id === selected.run_id &&
    context.team_id === selected.team_id &&
    context.activity_id === selected.activity_id &&
    context.role_key === selected.role_key
  );
}

type ComparisonState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; data: GSICrossRoundAdminProjection }
  | { kind: "rebase"; message: string }
  | { kind: "context-unavailable"; message: string }
  | { kind: "error"; message: string };

type PairOptionsState =
  | { kind: "unavailable"; message: string }
  | { kind: "loading" }
  | { kind: "ready"; data: GSICrossRoundPairOptions }
  | { kind: "error"; message: string };

function stateForError(code: string | undefined, message: string): ComparisonState {
  if (code === "GSI_REBASE_REQUIRED") return { kind: "rebase", message };
  if (code === "GSI_CONTEXT_UNAVAILABLE") return { kind: "context-unavailable", message };
  return { kind: "error", message };
}

function directionLabel(direction: string): string {
  return direction === "NEW"
    ? "新增"
    : direction === "REMOVED"
      ? "移除"
      : direction === "INCREASED"
        ? "上升"
        : direction === "DECREASED"
          ? "下降"
          : "稳定";
}

function renderValue(value: number | undefined): string {
  return value === undefined ? "未提供（不是数值 0）" : value.toFixed(3);
}

export function GovernedStakeholderIntelligenceAuditPanel({
  apiBase,
  tenantId,
  token,
  initialCandidateId = "",
  initialComparison,
  onReauthenticate
}: GovernedStakeholderIntelligenceAuditPanelProps) {
  const [candidateId, setCandidateId] = useState(initialCandidateId);
  const [projection, setProjection] = useState<GSIAdminProjection | null>(null);
  const [courseId, setCourseId] = useState("");
  const [runId, setRunId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [fromCandidateId, setFromCandidateId] = useState("");
  const [toCandidateId, setToCandidateId] = useState("");
  const [fromRoundId, setFromRoundId] = useState("");
  const [toRoundId, setToRoundId] = useState("");
  const [ddtRoundId, setDdtRoundId] = useState("");
  const [ddtRoundNo, setDdtRoundNo] = useState("");
  const [activityId, setActivityId] = useState("activity_gsi_xr");
  const [roleKey, setRoleKey] = useState("CEO");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acceptedInitialComparison =
    initialComparison && isAcceptedAdminBootstrap(initialComparison, tenantId)
      ? initialComparison
      : undefined;
  const auditController = useRef<AbortController | null>(null);
  const auditIdentity = JSON.stringify([apiBase, tenantId, token, candidateId]);
  const currentAuditIdentity = useRef(auditIdentity);
  currentAuditIdentity.current = auditIdentity;
  useEffect(() => {
    auditController.current?.abort();
    setProjection(null);
    setError(null);
    setBusy(false);
    return () => auditController.current?.abort();
  }, [auditIdentity]);
  const [comparisonState, setComparisonState] = useState<ComparisonState>(
    acceptedInitialComparison
      ? { kind: "ready", data: acceptedInitialComparison }
      : { kind: "unavailable", message: PAIR_SELECTION_MESSAGE }
  );
  const [pairOptionsState, setPairOptionsState] = useState<PairOptionsState>({
    kind: "unavailable",
    message: PAIR_SELECTION_MESSAGE
  });
  const pairOptionsRequestId = useRef(0);
  const pairOptionsController = useRef<AbortController | null>(null);
  const comparisonRequestId = useRef(0);
  const comparisonController = useRef<AbortController | null>(null);
  const pairIdentity = JSON.stringify([
    apiBase,
    token,
    tenantId,
    courseId,
    runId,
    teamId,
    activityId,
    roleKey
  ]);
  const comparisonIdentity = JSON.stringify([
    pairIdentity,
    fromCandidateId,
    toCandidateId,
    fromRoundId,
    toRoundId,
    ddtRoundId,
    ddtRoundNo
  ]);
  const currentPairIdentity = useRef(pairIdentity);
  const currentComparisonIdentity = useRef(comparisonIdentity);
  currentPairIdentity.current = pairIdentity;
  currentComparisonIdentity.current = comparisonIdentity;
  const previousPairIdentity = useRef(pairIdentity);
  const previousComparisonIdentity = useRef(comparisonIdentity);
  useEffect(() => {
    if (previousPairIdentity.current !== pairIdentity) {
      setPairOptionsState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
      setFromRoundId("");
      setToRoundId("");
    }
    previousPairIdentity.current = pairIdentity;
    return () => {
      pairOptionsRequestId.current += 1;
      pairOptionsController.current?.abort();
    };
  }, [pairIdentity]);
  useEffect(() => {
    if (previousComparisonIdentity.current !== comparisonIdentity) {
      setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    }
    previousComparisonIdentity.current = comparisonIdentity;
    return () => {
      comparisonRequestId.current += 1;
      comparisonController.current?.abort();
    };
  }, [comparisonIdentity]);
  const decisionThreadContext = useMemo<DdtExactContext | undefined>(() => {
    const roundNo = Number(ddtRoundNo.trim());
    if (
      !courseId.trim() ||
      !runId.trim() ||
      !teamId.trim() ||
      !roleKey.trim() ||
      !ddtRoundId.trim() ||
      !Number.isSafeInteger(roundNo) ||
      roundNo < 1
    ) {
      return undefined;
    }
    return {
      activity_id: DDT_AUTHORIZED_ACTIVITY_ID,
      course_id: courseId.trim(),
      role_key: roleKey.trim(),
      round_id: ddtRoundId.trim(),
      round_no: roundNo,
      run_id: runId.trim(),
      team_id: teamId.trim(),
      tenant_id: tenantId
    };
  }, [courseId, ddtRoundId, ddtRoundNo, roleKey, runId, teamId, tenantId]);

  function invalidateComparisonSelection(): void {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  function invalidateContextSelection(): void {
    pairOptionsRequestId.current += 1;
    pairOptionsController.current?.abort();
    invalidateComparisonSelection();
    setPairOptionsState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    setFromRoundId("");
    setToRoundId("");
    setDdtRoundId("");
    setDdtRoundNo("");
  }

  async function loadPairOptions() {
    const requestId = ++pairOptionsRequestId.current;
    pairOptionsController.current?.abort();
    const context = {
      course_id: courseId.trim(),
      run_id: runId.trim(),
      team_id: teamId.trim(),
      activity_id: activityId.trim(),
      role_key: roleKey.trim()
    };
    if (Object.values(context).some((value) => !value)) {
      comparisonRequestId.current += 1;
      comparisonController.current?.abort();
      setPairOptionsState({
        kind: "unavailable",
        message: "请先提供完整的受控课程、运行、队伍、活动和角色上下文。"
      });
      return;
    }
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    setFromRoundId("");
    setToRoundId("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    setPairOptionsState({ kind: "loading" });
    const controller = new AbortController();
    pairOptionsController.current = controller;
    try {
      const query = new URLSearchParams(context);
      const response = await fetch(
        `${apiBase}/api/v1/bff/admin/gsi/candidates/pair-options?${query.toString()}`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
          signal: controller.signal
        }
      );
      const payload = (await response.json()) as unknown;
      if (
        controller.signal.aborted ||
        requestId !== pairOptionsRequestId.current ||
        currentPairIdentity.current !== pairIdentity
      )
        return;
      const details = isPairOptionsEnvelope(payload) ? readEnvelopeError(payload) : {};
      const options =
        isAcceptedPairOptionsEnvelope(payload) && hasEnvelopeData(payload)
          ? payload.data
          : undefined;
      if (
        !response.ok ||
        !isAcceptedPairOptionsEnvelope(payload) ||
        options === undefined ||
        !isGSICrossRoundPairOptions(options) ||
        options.surface !== "admin" ||
        options.context.tenant_id !== tenantId ||
        !matchesPairSelection(options.context, context)
      ) {
        setPairOptionsState({
          kind: "error",
          message: details.message ?? "服务器回合配对暂不可用"
        });
        return;
      }
      setPairOptionsState({ kind: "ready", data: options });
      setFromRoundId("");
      setToRoundId("");
      setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
    } catch (cause) {
      if (
        controller.signal.aborted ||
        requestId !== pairOptionsRequestId.current ||
        currentPairIdentity.current !== pairIdentity ||
        (cause instanceof DOMException && cause.name === "AbortError")
      )
        return;
      setPairOptionsState({
        kind: "error",
        message: cause instanceof Error ? cause.message : "服务器回合配对暂不可用"
      });
    }
  }

  async function loadAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    auditController.current?.abort();
    const controller = new AbortController();
    auditController.current = controller;
    const isCurrent = () =>
      !controller.signal.aborted &&
      currentAuditIdentity.current === auditIdentity &&
      auditController.current === controller;
    setProjection(null);
    const id = candidateId.trim();
    if (!id) {
      setError("请输入候选 ID。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBase}${GSI_AUDIT_PATH}?candidate_id=${encodeURIComponent(id)}`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
          signal: controller.signal
        }
      );
      const payload = (await response.json()) as unknown;
      if (!isCurrent()) return;
      const details = readEnvelopeError(payload);
      if (
        !response.ok ||
        hasEnvelopeError(payload) ||
        hasNonOkEnvelopeCode(payload) ||
        !hasEnvelopeData<GSIAdminProjection>(payload)
      ) {
        throw new Error(details.message ?? "利益相关方审计加载失败");
      }
      setProjection(payload.data);
    } catch (cause) {
      if (!isCurrent()) return;
      setProjection(null);
      setError(cause instanceof Error ? cause.message : "利益相关方审计加载失败");
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  async function compareRounds(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fromRound = fromRoundId.trim();
    const toRound = toRoundId.trim();
    const from = fromCandidateId.trim();
    const to = toCandidateId.trim();
    const activity = activityId.trim();
    const role = roleKey.trim();
    const selectedRounds = Boolean(fromRound && toRound);
    const selectedCandidates = Boolean(from && to);
    if (!selectedRounds && !selectedCandidates) {
      comparisonRequestId.current += 1;
      comparisonController.current?.abort();
      setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
      return;
    }
    if (selectedRounds === selectedCandidates) {
      comparisonRequestId.current += 1;
      comparisonController.current?.abort();
      setComparisonState({
        kind: "error",
        message: "请使用两个服务器回合，或仅在高级诊断中使用两个候选 ID。"
      });
      return;
    }
    const requestId = ++comparisonRequestId.current;
    comparisonController.current?.abort();
    const controller = new AbortController();
    comparisonController.current = controller;
    setComparisonState({ kind: "loading" });
    const selection: AdminComparisonSelection = selectedRounds
      ? {
          mode: "round",
          tenant_id: tenantId,
          course_id: courseId.trim(),
          run_id: runId.trim(),
          team_id: teamId.trim(),
          activity_id: activity,
          role_key: role,
          from_round_id: fromRound,
          to_round_id: toRound
        }
      : {
          mode: "candidate",
          tenant_id: tenantId,
          activity_id: activity,
          role_key: role,
          from_candidate_id: from,
          to_candidate_id: to,
          ...(courseId.trim() ? { course_id: courseId.trim() } : {}),
          ...(runId.trim() ? { run_id: runId.trim() } : {}),
          ...(teamId.trim() ? { team_id: teamId.trim() } : {})
        };
    const query = selection.mode === "round"
      ? new URLSearchParams({
          course_id: selection.course_id,
          run_id: selection.run_id,
          team_id: selection.team_id,
          from_round_id: fromRound,
          to_round_id: toRound,
          activity_id: activity,
          role_key: role
        })
      : new URLSearchParams({
          from_candidate_id: from,
          to_candidate_id: to,
          activity_id: activity,
          role_key: role
        });
    try {
      const response = await fetch(
        `${apiBase}/api/v1/bff/admin/gsi/candidates/compare?${query.toString()}`,
        {
          headers: { authorization: `Bearer ${token}`, "x-tenant-id": tenantId },
          signal: controller.signal
        }
      );
      const payload = (await response.json()) as unknown;
      if (
        controller.signal.aborted ||
        requestId !== comparisonRequestId.current ||
        currentComparisonIdentity.current !== comparisonIdentity
      )
        return;
      const details = readEnvelopeError(payload);
      const data = isRecord(payload) ? payload.data : undefined;
      if (
        !response.ok ||
        hasEnvelopeError(payload) ||
        hasNonOkEnvelopeCode(payload) ||
        !isAcceptedAdminComparison(data, selection)
      ) {
        setComparisonState(
          stateForError(details.code, details.message ?? "两个回合的审计比较暂不可用")
        );
        return;
      }
      setComparisonState({ kind: "ready", data });
    } catch (cause) {
      if (
        controller.signal.aborted ||
        requestId !== comparisonRequestId.current ||
        currentComparisonIdentity.current !== comparisonIdentity ||
        (cause instanceof DOMException && cause.name === "AbortError")
      )
        return;
      setComparisonState({
        kind: "error",
        message: cause instanceof Error ? cause.message : "两个回合的审计比较暂不可用"
      });
    }
  }

  function resetComparison() {
    comparisonRequestId.current += 1;
    comparisonController.current?.abort();
    pairOptionsRequestId.current += 1;
    pairOptionsController.current?.abort();
    setFromCandidateId("");
    setToCandidateId("");
    setFromRoundId("");
    setToRoundId("");
    setDdtRoundId("");
    setDdtRoundNo("");
    setComparisonState({ kind: "unavailable", message: PAIR_SELECTION_MESSAGE });
  }

  return (
    <section className="panel form-panel gsi-xr-panel" aria-label="GSI-XR admin audit workspace">
      <div className="panel-title gsi-xr-panel-title">
        <div>
          <p className="eyebrow">GSI-XR · admin audit / secondary evidence</p>
          <h3>审计两个回合</h3>
        </div>
        <span className="technical-compatibility">read-only · Provider OFF</span>
      </div>
      <p className="lifecycle-boundary">
        管理员先查看选定租户和比较状态，再展开技术来源。此面板只读，不写入正式 Decision / Settlement
        / Outcome。
      </p>
      <div className="gsi-xr-context-strip" aria-label="Admin selected tenant context">
        <strong>Selected tenant</strong>
        <span>{tenantId} · tenant echo must match the authorized request context</span>
      </div>
      <DecisionThreadEvidenceSpine
        apiBase={apiBase}
        context={decisionThreadContext}
        heading="审计证据线程"
        surface="admin"
        tenantId={tenantId}
        token={token}
        onReauthenticate={onReauthenticate}
      />
      <form
        className="gsi-xr-pair-form"
        aria-label="GSI admin exact cross-round comparison"
        onSubmit={compareRounds}
      >
        <div className="gsi-xr-pair-heading">
          <div>
            <p className="eyebrow">Primary audit task</p>
            <span className="gsi-xr-legacy-heading">利益相关方候选审计</span>
            <h4>选择两个精确回合</h4>
          </div>
          <span className="gsi-xr-state-badge">NO-WRITE · writes_official_truth=false</span>
        </div>
        <p className="gsi-xr-muted">
          先提交明确的课程、运行和队伍上下文，再由服务器返回可比较回合；不会根据
          latest、默认值或缓存顺序选择。
        </p>
        <div className="gsi-xr-field-grid">
          <label>
            Course context
            <input
              aria-label="GSI admin course context"
              value={courseId}
              onChange={(event) => {
                invalidateContextSelection();
                setCourseId(event.target.value);
              }}
              placeholder="course_id"
            />
          </label>
          <label>
            Run context
            <input
              aria-label="GSI admin run context"
              value={runId}
              onChange={(event) => {
                invalidateContextSelection();
                setRunId(event.target.value);
              }}
              placeholder="run_id"
            />
          </label>
          <label>
            Team context
            <input
              aria-label="GSI admin team context"
              value={teamId}
              onChange={(event) => {
                invalidateContextSelection();
                setTeamId(event.target.value);
              }}
              placeholder="team_id"
            />
          </label>
          <label>
            DDT exact round ID
            <input
              aria-label="DDT admin exact round ID"
              value={ddtRoundId}
              onChange={(event) => {
                invalidateComparisonSelection();
                setDdtRoundId(event.target.value);
              }}
              placeholder="round_id"
            />
          </label>
          <label>
            DDT exact round number
            <input
              aria-label="DDT admin exact round number"
              inputMode="numeric"
              value={ddtRoundNo}
              onChange={(event) => {
                invalidateComparisonSelection();
                setDdtRoundNo(event.target.value);
              }}
              placeholder="round_no"
            />
          </label>
        </div>
        <p className="gsi-xr-muted">
          DDT 证据线程使用上面的精确回合上下文单独请求；服务器会校验租户、课程、运行、队伍和回合，
          不依赖 GSI 比较配对，也不会替管理员选择 latest 或默认回合。
        </p>
        <div className="gsi-xr-actions">
          <button type="button" onClick={() => void loadPairOptions()}>
            {pairOptionsState.kind === "loading" ? "正在加载回合…" : "加载可比较回合"}
          </button>
        </div>
        {pairOptionsState.kind === "ready" ? (
          <div className="gsi-xr-field-grid">
            <label>
              From round
              <select
                aria-label="GSI admin from round"
                value={fromRoundId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setFromRoundId(event.target.value);
                }}
              >
                <option value="">选择起始回合</option>
                {pairOptionsState.data.rounds.map((round) => (
                  <option key={round.round_id} value={round.round_id}>
                    Round {round.round_no}
                  </option>
                ))}
              </select>
            </label>
            <label>
              To round
              <select
                aria-label="GSI admin to round"
                value={toRoundId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setToRoundId(event.target.value);
                }}
              >
                <option value="">选择目标回合</option>
                {pairOptionsState.data.rounds.map((round) => (
                  <option key={round.round_id} value={round.round_id}>
                    Round {round.round_no}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        {pairOptionsState.kind === "ready" && pairOptionsState.data.rounds.length < 2 ? (
          <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
            <strong>PAIR_SELECTION_UNAVAILABLE</strong>
            <p>当前上下文没有至少两个唯一可比较回合。</p>
          </div>
        ) : null}
        {pairOptionsState.kind === "error" ? (
          <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
            <strong>PAIR_SELECTION_UNAVAILABLE</strong>
            <p>{pairOptionsState.message}</p>
          </div>
        ) : null}
        <details className="gsi-xr-advanced">
          <summary>高级：输入精确候选配对</summary>
          <div className="gsi-xr-field-grid">
            <label>
              From candidate ID
              <input
                aria-label="GSI admin from candidate ID"
                value={fromCandidateId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setFromCandidateId(event.target.value);
                }}
                placeholder="candidate_from"
              />
            </label>
            <label>
              To candidate ID
              <input
                aria-label="GSI admin to candidate ID"
                value={toCandidateId}
                onChange={(event) => {
                  invalidateComparisonSelection();
                  setToCandidateId(event.target.value);
                }}
                placeholder="candidate_to"
              />
            </label>
            <label>
              Activity
              <input
                aria-label="GSI admin activity ID"
                value={activityId}
                onChange={(event) => {
                  invalidateContextSelection();
                  setActivityId(event.target.value);
                }}
              />
            </label>
            <label>
              Role
              <input
                aria-label="GSI admin role key"
                value={roleKey}
                onChange={(event) => {
                  invalidateContextSelection();
                  setRoleKey(event.target.value);
                }}
              />
            </label>
          </div>
        </details>
        <div className="gsi-xr-actions">
          <button type="submit" disabled={comparisonState.kind === "loading"}>
            {comparisonState.kind === "loading" ? "正在读取…" : "读取审计变化"}
          </button>
          <button type="button" className="secondary" onClick={resetComparison}>
            重新选择
          </button>
        </div>
      </form>
      {comparisonState.kind === "unavailable" ? (
        <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
          <strong>PAIR_SELECTION_UNAVAILABLE</strong>
          <p>{comparisonState.message}</p>
          <p>
            安全下一步：先加载当前授权上下文的回合列表，或由有权限的管理员使用高级 exact candidate
            诊断。
          </p>
        </div>
      ) : null}
      {comparisonState.kind === "rebase" ? (
        <div className="gsi-xr-status gsi-xr-status-error" role="alert">
          <strong>REBASE_REQUIRED</strong>
          <p>{comparisonState.message}</p>
          <button type="button" className="secondary" onClick={resetComparison}>
            重新选择精确回合
          </button>
        </div>
      ) : null}
      {comparisonState.kind === "context-unavailable" ? (
        <div className="gsi-xr-status gsi-xr-status-warning" role="status" aria-live="polite">
          <strong>CONTEXT_UNAVAILABLE</strong>
          <p>{comparisonState.message}</p>
        </div>
      ) : null}
      {comparisonState.kind === "error" ? (
        <div className="gsi-xr-status gsi-xr-status-error" role="alert">
          <strong>比较暂不可用</strong>
          <p>{comparisonState.message}</p>
        </div>
      ) : null}
      {comparisonState.kind === "ready" ? (
        <article className="gsi-xr-result" aria-label="GSI admin cross-round comparison result">
          <div className="gsi-xr-result-heading">
            <div>
              <p className="eyebrow">Movement evidence</p>
              <h4>
                Round {comparisonState.data.comparison.pair.from.round_no} ↔ Round{" "}
                {comparisonState.data.comparison.pair.to.round_no}
              </h4>
            </div>
            <span className="gsi-xr-state-badge">{comparisonState.data.context.status}</span>
          </div>
          <p className="gsi-xr-non-causal">
            NON-CAUSAL · causal_proof=false · official_truth_write=false
          </p>
          <details className="gsi-xr-admin-provenance-details">
            <summary>Technical provenance (secondary)</summary>
            <div className="gsi-xr-admin-provenance">
              <strong>Exact pair provenance</strong>
              <span>
                {comparisonState.data.comparison.pair.from.candidate_id} →{" "}
                {comparisonState.data.comparison.pair.to.candidate_id}
              </span>
              <span>tenant echo: {comparisonState.data.tenant_id}</span>
              <span>
                context_binding: {JSON.stringify(comparisonState.data.context.context_binding)}
              </span>
            </div>
          </details>
          <ul className="gsi-xr-movement-list">
            {comparisonState.data.comparison.movements.map((movement) => (
              <li key={movement.signal_key}>
                <div>
                  <strong>{directionLabel(movement.direction)}</strong>
                  <span>
                    {movement.stakeholder_type} / {movement.intent}
                  </span>
                </div>
                <span>
                  {renderValue(movement.from_value)} → {renderValue(movement.to_value)}
                  {movement.delta === undefined ? "" : ` · Δ ${movement.delta.toFixed(3)}`}
                </span>
              </li>
            ))}
          </ul>
          <details className="gsi-xr-limit-details">
            <summary>查看限制与恢复</summary>
            <ul>
              {comparisonState.data.known_limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </details>
        </article>
      ) : null}
      {error ? (
        <p role="alert" className="lifecycle-error">
          {error}
        </p>
      ) : null}
      <details className="gsi-xr-legacy">
        <summary>高级：单候选审计回退</summary>
        <p className="gsi-xr-muted">保留既有 exact candidate 审计读取；此路径仍为只读。</p>
        <form onSubmit={loadAudit}>
          <label>
            候选 ID
            <input
              aria-label="GSI audit candidate ID"
              value={candidateId}
              onChange={(event) => setCandidateId(event.target.value)}
              placeholder="gsi_candidate_…"
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "正在查询…" : "查询候选审计"}
          </button>
        </form>
      </details>
      {projection ? (
        <article className="candidate-preview" aria-label="GSI audit projection">
          <h4>候选审计摘要</h4>
          <dl>
            <div>
              <dt>provider</dt>
              <dd>{projection.provider}</dd>
            </div>
            <div>
              <dt>plane_mode</dt>
              <dd>{projection.plane_mode}</dd>
            </div>
            <div>
              <dt>writes_official_truth</dt>
              <dd>{String(projection.writes_official_truth)}</dd>
            </div>
            <div>
              <dt>resolver_digest</dt>
              <dd>
                <code>{projection.resolver_digest}</code>
              </dd>
            </div>
            <div>
              <dt>signal_digest</dt>
              <dd>
                <code>{projection.signal_digest}</code>
              </dd>
            </div>
            <div>
              <dt>candidate_digest</dt>
              <dd>
                <code>{projection.candidate_digest}</code>
              </dd>
            </div>
          </dl>
        </article>
      ) : null}
    </section>
  );
}
