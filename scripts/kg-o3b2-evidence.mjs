/**
 * KG-O3B2 historical shadow-evidence helpers.
 *
 * These helpers are deliberately pure and read-only. They normalize evidence
 * supplied by an external runner; they do not read the Product repository,
 * write Product state, or select an answer from current source. Historical
 * cells must carry an exact commit/tree identity and an explicitly historical
 * source snapshot.
 */

import { createHash } from "node:crypto";

export const HC07_TASK_ID = "HC-07";
export const HC07_LOCATOR_SHA = "14e577bf9c8745e3b8694812efb88fe3f4188e4a";
export const WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK =
  "WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK";

const HISTORICAL_CELL_SCHEMA = "SIMWAR_KG_HISTORICAL_CELL_V1";
const HISTORICAL_COMPARISON_SCHEMA = "SIMWAR_KG_HISTORICAL_COMPARISON_V1";
const FORWARD_SELECTOR_SCHEMA = "SIMWAR_KG_FORWARD_PILOT_SELECTOR_V1";
const SHA_RE = /^[0-9a-f]{40}$/iu;
const SHA256_RE = /^[0-9a-f]{64}$/iu;
const MAX_STRING = 512;
const MAX_LIST = 32;
const MAX_EXCLUDED_TASKS = 64;
const MAX_OBJECT_DEPTH = 5;

const CELL_KINDS = new Set(["SOURCE_ONLY", "KG_ASSISTED"]);
const OPEN_TASK_STATUSES = new Set(["OPEN"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value, field, { required = false, max = MAX_STRING } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new TypeError(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") throw new TypeError(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized && required) throw new TypeError(`${field} is required`);
  return normalized.slice(0, max) || null;
}

function firstString(value, fields, options = {}) {
  for (const field of fields) {
    if (value?.[field] !== undefined && value?.[field] !== null)
      return asString(value[field], field, options);
  }
  if (options.required) throw new TypeError(`${fields[0]} is required`);
  return null;
}

function asSha(value, field, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new TypeError(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") throw new TypeError(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized && required) throw new TypeError(`${field} is required`);
  if (!normalized) return null;
  if (!SHA_RE.test(normalized)) throw new TypeError(`${field} must be an exact 40-character SHA`);
  return normalized.toLowerCase();
}

function firstSha(value, fields, options = {}) {
  for (const field of fields) {
    if (value?.[field] !== undefined && value?.[field] !== null)
      return asSha(value[field], field, options);
  }
  if (options.required) throw new TypeError(`${fields[0]} is required`);
  return null;
}

function asFiniteNumber(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${field} must be finite`);
  return number;
}

function asBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function boundedList(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().slice(0, MAX_STRING))
        .filter(Boolean)
    )
  ].slice(0, MAX_LIST);
}

function safeClone(value, depth = 0) {
  if (depth > MAX_OBJECT_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, MAX_LIST).map((item) => safeClone(item, depth + 1));
  if (!isRecord(value)) {
    if (typeof value === "string") return value.slice(0, MAX_STRING);
    if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MAX_LIST)
      .map(([key, item]) => [key.slice(0, MAX_STRING), safeClone(item, depth + 1)])
      .filter(([, item]) => item !== undefined)
  );
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function normalizedUpper(value, fallback = null) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toUpperCase();
  return normalized || fallback;
}

function findAnswerKeyPaths(value, path = "$", paths = []) {
  if (paths.length >= 16 || value === null || value === undefined) return paths;
  if (Array.isArray(value)) {
    for (let index = 0; index < Math.min(value.length, MAX_LIST); index += 1)
      findAnswerKeyPaths(value[index], `${path}[${index}]`, paths);
    return paths;
  }
  if (!isRecord(value)) return paths;
  for (const [key, child] of Object.entries(value).slice(0, MAX_LIST)) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, "");
    const childPath = `${path}.${key}`;
    if (
      normalizedKey === "answerkey" ||
      normalizedKey === "goldanswer" ||
      normalizedKey === "groundtruth" ||
      normalizedKey === "expectedanswer" ||
      normalizedKey === "expectedfinding" ||
      normalizedKey === "expectedfindingid" ||
      normalizedKey === "referenceanswer"
    )
      paths.push(childPath);
    findAnswerKeyPaths(child, childPath, paths);
    if (paths.length >= 16) break;
  }
  return paths;
}

function assertNoAnswerKey(value, label) {
  const paths = findAnswerKeyPaths(value);
  if (paths.length) throw new TypeError(`${label} cannot contain an answer key (${paths[0]})`);
}

function currentSourceMarker(value) {
  if (!isRecord(value)) return false;
  if (value.is_current === true || value.isCurrent === true) return true;
  const marker = normalizedUpper(
    value.provenance ?? value.source_kind ?? value.sourceKind ?? value.kind,
    ""
  );
  if (marker.includes("CURRENT") || marker.includes("WORKTREE") || marker.includes("REPAIRED")) return true;
  for (const field of ["path", "source_ref", "sourceRef", "ref"]) {
    if (typeof value[field] === "string" && /current|worktree|repaired/iu.test(value[field])) return true;
  }
  return false;
}

function sourceSnapshotFor(input, targetSha, targetTreeSha) {
  const supplied = isRecord(input.source_snapshot)
    ? input.source_snapshot
    : isRecord(input.sourceSnapshot)
      ? input.sourceSnapshot
      : {};
  if (currentSourceMarker(supplied) || currentSourceMarker(input))
    throw new TypeError("current repaired source cannot be used as a historical blind input");

  const sourceSha =
    firstSha(supplied, ["target_sha", "targetSha", "source_sha", "sourceSha", "snapshot_sha"], {}) ||
    firstSha(input, ["source_sha", "sourceSha", "source_target_sha", "sourceTargetSha"], {}) ||
    targetSha;
  const sourceTreeSha =
    firstSha(supplied, ["tree_sha", "treeSha", "target_tree_sha", "targetTreeSha"], {}) ||
    firstSha(input, ["source_tree_sha", "sourceTreeSha"], {}) ||
    targetTreeSha;
  if (sourceSha !== targetSha || sourceTreeSha !== targetTreeSha)
    throw new TypeError("historical source snapshot must match the exact target SHA and tree");

  const currentSha =
    firstSha(input, ["current_repaired_source_sha", "currentRepairedSourceSha", "current_source_sha"], {}) ||
    firstSha(supplied, ["current_repaired_source_sha", "currentRepairedSourceSha", "current_source_sha"], {});
  if (currentSha && (currentSha === sourceSha || currentSha === targetSha))
    throw new TypeError("current repaired source cannot equal the historical blind target");

  return {
    target_sha: sourceSha,
    tree_sha: sourceTreeSha,
    provenance: "HISTORICAL_SNAPSHOT"
  };
}

function observationFor(input) {
  const supplied = isRecord(input.observation)
    ? input.observation
    : isRecord(input.measurements)
      ? input.measurements
      : isRecord(input.metrics)
        ? input.metrics
        : {};
  const read = (field, ...aliases) => {
    for (const candidate of [field, ...aliases]) {
      if (supplied[candidate] !== undefined) return supplied[candidate];
      if (input[candidate] !== undefined) return input[candidate];
    }
    return undefined;
  };
  const observation = {};
  const findingId = read("finding_id", "findingId", "finding");
  if (typeof findingId === "string" && findingId.trim()) observation.finding_id = findingId.trim().slice(0, MAX_STRING);
  const findingCorrect = asBoolean(read("finding_correct", "findingCorrect"));
  if (findingCorrect !== null) observation.finding_correct = findingCorrect;
  const falsePositive = asBoolean(read("false_positive", "falsePositive"));
  if (falsePositive !== null) observation.false_positive = falsePositive;
  for (const [field, ...aliases] of [
    ["total_investigation_ms", "totalInvestigationMs"],
    ["scope_delta", "scopeDelta"],
    ["mandatory_test_delta", "mandatoryTestDelta"],
    ["authority_delta", "authorityDelta"]
  ]) {
    const number = asFiniteNumber(read(field, ...aliases), field);
    if (number !== null) observation[field] = number;
  }
  for (const [field, ...aliases] of [
    ["source_anchors", "sourceAnchors"],
    ["test_anchors", "testAnchors"],
    ["unresolved", "unresolved"]
  ]) {
    const values = read(field, ...aliases);
    if (Array.isArray(values)) observation[field] = boundedList(values);
  }
  return observation;
}

function cellTarget(cell) {
  if (!isRecord(cell)) return { sha: null, tree: null };
  const sha =
    firstSha(cell, ["target_sha", "targetSha", "historical_target_sha", "historicalTargetSha"], {}) ||
    firstSha(cell.target, ["sha", "target_sha", "commit_sha", "commitSha"], {});
  const tree =
    firstSha(cell, ["target_tree_sha", "target_tree", "targetTreeSha", "tree_sha", "treeSha"], {}) ||
    firstSha(cell.target, ["tree_sha", "tree", "treeSha"], {});
  return { sha, tree };
}

function cellSource(cell) {
  if (!isRecord(cell)) return null;
  const source = isRecord(cell.source_snapshot)
    ? cell.source_snapshot
    : isRecord(cell.sourceSnapshot)
      ? cell.sourceSnapshot
      : {};
  const sha =
      firstSha(source, ["target_sha", "targetSha", "source_sha", "sourceSha", "snapshot_sha"], {}) ||
      firstSha(cell, ["source_sha", "sourceSha", "source_target_sha", "sourceTargetSha"], {});
  const tree =
      firstSha(source, ["tree_sha", "treeSha", "target_tree_sha", "targetTreeSha"], {}) ||
      firstSha(cell, ["source_tree_sha", "sourceTreeSha"], {});
  const currentSha =
    firstSha(source, ["current_repaired_source_sha", "currentRepairedSourceSha", "current_source_sha"], {}) ||
    firstSha(cell, ["current_repaired_source_sha", "currentRepairedSourceSha", "current_source_sha"], {});
  return {
    sha,
    tree,
    current:
      currentSourceMarker(source) ||
      currentSourceMarker(cell) ||
      (currentSha !== null && (currentSha === sha || currentSha === cellTarget(cell).sha))
  };
}

function cellStatus(cell) {
  return cell?.status === "SEALED" || cell?.sealed === true ? "SEALED" : "UNSEALED";
}

function validateCellForComparison(cell, name) {
  try {
    if (!isRecord(cell)) return { ok: false, reason: "HISTORICAL_CELL_REQUIRED" };
    assertNoAnswerKey(cell, name);
    const cellId = firstString(cell, ["cell_id", "cellId"], {});
    const cellRole = cellId?.toLowerCase();
    if (cellRole !== "control" && cellRole !== "treatment")
      return { ok: false, reason: "CELL_ROLE_REQUIRED" };
    const cellKind = normalizedUpper(cell.cell_kind ?? cell.cellKind, "");
    const expectedKind = cellRole === "control" ? "SOURCE_ONLY" : "KG_ASSISTED";
    if (cellKind !== expectedKind) return { ok: false, reason: "CELL_ROLE_MISMATCH" };
    const sourceSnapshot = isRecord(cell.source_snapshot)
      ? cell.source_snapshot
      : isRecord(cell.sourceSnapshot)
        ? cell.sourceSnapshot
        : null;
    if (!sourceSnapshot || normalizedUpper(sourceSnapshot.provenance, "") !== "HISTORICAL_SNAPSHOT")
      return { ok: false, reason: "HISTORICAL_SOURCE_PROVENANCE_REQUIRED" };
    const target = cellTarget(cell);
    const source = cellSource(cell);
    if (!target.sha || !target.tree) return { ok: false, reason: "HISTORICAL_TARGET_REQUIRED" };
    if (source?.current || cell.current_repaired_source_used === true)
      return { ok: false, reason: "CURRENT_REPAIRED_SOURCE_FORBIDDEN" };
    if (source?.sha && source.sha !== target.sha)
      return { ok: false, reason: "HISTORICAL_SOURCE_TARGET_MISMATCH" };
    if (source?.tree && source.tree !== target.tree)
      return { ok: false, reason: "HISTORICAL_SOURCE_TREE_MISMATCH" };
    if (cellStatus(cell) === "SEALED") {
      if (!SHA256_RE.test(cell.seal_hash ?? "")) return { ok: false, reason: "SEALED_HASH_REQUIRED" };
      const withoutSeal = safeClone(cell);
      delete withoutSeal.seal_hash;
      if (sha256(withoutSeal) !== cell.seal_hash) return { ok: false, reason: "SEALED_HASH_MISMATCH" };
    }
    return { ok: true, target, source };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/answer key/iu.test(message)) return { ok: false, reason: "ANSWER_KEY_PRESENT_IN_CELL" };
    if (/current|repaired|worktree/iu.test(message))
      return { ok: false, reason: "CURRENT_REPAIRED_SOURCE_FORBIDDEN" };
    return { ok: false, reason: "HISTORICAL_TARGET_INVALID" };
  }
}
function cellObservation(cell) {
  if (!isRecord(cell)) return {};
  if (isRecord(cell.observation)) return cell.observation;
  if (isRecord(cell.measurements)) return cell.measurements;
  if (isRecord(cell.metrics)) return cell.metrics;
  return cell;
}

function observedFindingCorrect(cell, answerKey) {
  const observation = cellObservation(cell);
  const observed = observation.finding_id ?? observation.findingId ?? observation.finding;
  const expected =
    answerKey?.finding_id ??
    answerKey?.findingId ??
    answerKey?.expected_finding_id ??
    answerKey?.expectedFindingId;
  if (typeof observed === "string" && typeof expected === "string") return observed === expected;
  const expectedByCell = answerKey?.finding_correct ?? answerKey?.findingCorrect;
  if (isRecord(expectedByCell)) {
    const cellId = cell?.cell_id ?? cell?.cellId;
    if (typeof cellId === "string" && typeof expectedByCell[cellId] === "boolean")
      return expectedByCell[cellId];
  }
  return null;
}

function safeMetric(cell, field, ...aliases) {
  const observation = cellObservation(cell);
  for (const candidate of [field, ...aliases]) {
    const value = observation[candidate];
    if (value !== undefined && value !== null) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
  }
  return 0;
}

function comparisonWaiting({ experimentId, taskId, target, control, treatment, reason }) {
  const waiting = {
    schema_version: HISTORICAL_COMPARISON_SCHEMA,
    experiment_id: experimentId,
    task_id: taskId,
    historical_only: true,
    target_sha: target?.sha ?? null,
    target_tree_sha: target?.tree ?? null,
    status: "WAITING_FOR_BOTH_CELLS_TO_SEAL",
    reason,
    answer_key_status: "WITHHELD",
    cells: {
      control: { cell_id: control?.cell_id ?? "control", status: cellStatus(control) },
      treatment: { cell_id: treatment?.cell_id ?? "treatment", status: cellStatus(treatment) }
    },
    contribution: "NOT_COMPUTED",
    statistics: "NOT_COMPUTED",
    current_repaired_source_used: false
  };
  return waiting;
}

/**
 * Create one unsealed blind historical cell.
 *
 * `target_sha` and `target_tree_sha` are required exact identities. The
 * source snapshot defaults to that target, but an explicitly supplied source
 * snapshot must match it and must not be marked current/repaired. Answer keys
 * are rejected at this boundary so evaluators cannot accidentally prime a
 * blind cell.
 */
export function createHistoricalCell(input = {}) {
  if (!isRecord(input)) throw new TypeError("historical cell input must be an object");
  assertNoAnswerKey(input, "historical cell");

  const taskId = firstString(input, ["task_id", "taskId"], { required: true });
  const experimentId = firstString(input, ["experiment_id", "experimentId"], {}) || taskId;
  const cellId = firstString(input, ["cell_id", "cellId"], { required: true });
  const requestedKind = normalizedUpper(input.cell_kind ?? input.cellKind, null);
  const cellKind = requestedKind || (cellId.toLowerCase() === "control" ? "SOURCE_ONLY" : "KG_ASSISTED");
  if (!CELL_KINDS.has(cellKind)) throw new TypeError("cell_kind must be SOURCE_ONLY or KG_ASSISTED");

  const targetSha = firstSha(
    input,
    ["target_sha", "targetSha", "historical_target_sha", "historicalTargetSha"],
    { required: true }
  );
  const targetTreeSha = firstSha(
    input,
    ["target_tree_sha", "target_tree", "targetTreeSha", "tree_sha", "treeSha"],
    { required: true }
  );
  const sourceSnapshot = sourceSnapshotFor(input, targetSha, targetTreeSha);
  const observation = observationFor(input);
  const cell = {
    schema_version: HISTORICAL_CELL_SCHEMA,
    experiment_id: experimentId,
    task_id: taskId,
    cell_id: cellId,
    cell_kind: cellKind,
    target_sha: targetSha,
    target_tree_sha: targetTreeSha,
    source_snapshot: sourceSnapshot,
    observation,
    status: "UNSEALED",
    sealed: false,
    answer_key_status: "WITHHELD",
    current_repaired_source_used: false
  };
  const currentSha = firstSha(
    input,
    ["current_repaired_source_sha", "currentRepairedSourceSha", "current_source_sha"],
    {}
  );
  if (currentSha) cell.current_repaired_source_sha = currentSha;
  cell.cell_digest = sha256(cell);
  return cell;
}

/**
 * Seal one blind cell without adding or returning an answer key.
 *
 * The function accepts either `{ cell, sealed_at }` or a cell as its first
 * argument with an optional options object for small runner integrations.
 */
export function sealHistoricalCell(input = {}, options = {}) {
  const envelope = isRecord(input) && Object.prototype.hasOwnProperty.call(input, "cell")
    ? input
    : { ...options, cell: input };
  const cell = envelope.cell;
  const validation = validateCellForComparison(cell, "historical cell");
  if (!validation.ok) throw new TypeError(validation.reason);
  if (cellStatus(cell) === "SEALED") {
    const existing = safeClone(cell);
    delete existing.answer_key;
    delete existing.answerKey;
    return existing;
  }
  const normalized = safeClone(cell);
  delete normalized.answer_key;
  delete normalized.answerKey;
  const sealedAt = envelope.sealed_at ?? envelope.sealedAt ?? cell.sealed_at ?? null;
  if (sealedAt !== null) {
    asString(sealedAt, "sealed_at", { required: true, max: 64 });
    if (!Number.isFinite(Date.parse(sealedAt))) throw new TypeError("sealed_at must be an ISO timestamp");
  }
  const sealed = {
    ...normalized,
    status: "SEALED",
    sealed: true,
    sealed_at: sealedAt,
    answer_key_status: "WITHHELD",
    current_repaired_source_used: false
  };
  delete sealed.seal_hash;
  sealed.seal_hash = sha256(sealed);
  return sealed;
}

/**
 * Compare two sealed historical cells. Before both cells seal, the answer key
 * is intentionally absent from the returned object. Once both cells seal, a
 * supplied key may be used for the HC-07 finding classification and is then
 * returned as an explicit post-seal field.
 */
export function compareHistoricalCells(input = {}) {
  if (!isRecord(input)) throw new TypeError("historical comparison input must be an object");
  const control = input.control;
  const treatment = input.treatment;
  const controlCheck = validateCellForComparison(control, "control cell");
  const treatmentCheck = validateCellForComparison(treatment, "treatment cell");
  const experimentId =
    firstString(control, ["experiment_id", "experimentId"], {}) ||
    firstString(treatment, ["experiment_id", "experimentId"], {}) ||
    HC07_TASK_ID;
  const taskId =
    firstString(input, ["task_id", "taskId"], {}) ||
    firstString(control, ["task_id", "taskId"], {}) ||
    firstString(treatment, ["task_id", "taskId"], {}) ||
    experimentId;

  if (!controlCheck.ok || !treatmentCheck.ok) {
    const reason = !controlCheck.ok ? controlCheck.reason : treatmentCheck.reason;
    return {
      schema_version: HISTORICAL_COMPARISON_SCHEMA,
      experiment_id: experimentId,
      task_id: taskId,
      historical_only: true,
      status: reason,
      answer_key_status: "WITHHELD",
      contribution: "NOT_COMPUTED",
      statistics: "NOT_COMPUTED",
      current_repaired_source_used: reason === "CURRENT_REPAIRED_SOURCE_FORBIDDEN"
    };
  }

  const target = controlCheck.target;
  if (
    target.sha !== treatmentCheck.target.sha ||
    target.tree !== treatmentCheck.target.tree
  ) {
    return {
      schema_version: HISTORICAL_COMPARISON_SCHEMA,
      experiment_id: experimentId,
      task_id: taskId,
      historical_only: true,
      status: "HISTORICAL_TARGET_MISMATCH",
      target_sha: target.sha,
      target_tree_sha: target.tree,
      answer_key_status: "WITHHELD",
      contribution: "NOT_COMPUTED",
      statistics: "NOT_COMPUTED",
      current_repaired_source_used: false
    };
  }

  const controlTaskId = firstString(control, ["task_id", "taskId"], {}) || taskId;
  const treatmentTaskId = firstString(treatment, ["task_id", "taskId"], {}) || taskId;
  if (controlTaskId !== treatmentTaskId) {
    return {
      schema_version: HISTORICAL_COMPARISON_SCHEMA,
      experiment_id: experimentId,
      task_id: taskId,
      historical_only: true,
      status: "TASK_MISMATCH",
      target_sha: target.sha,
      target_tree_sha: target.tree,
      answer_key_status: "WITHHELD",
      contribution: "NOT_COMPUTED",
      statistics: "NOT_COMPUTED",
      current_repaired_source_used: false
    };
  }

  if (cellStatus(control) !== "SEALED" || cellStatus(treatment) !== "SEALED")
    return comparisonWaiting({
      experimentId,
      taskId,
      target,
      control,
      treatment,
      reason: "BOTH_CELLS_MUST_BE_SEALED_BEFORE_ANSWER_KEY_ACCESS"
    });

  const answerKey = input.answer_key ?? input.answerKey;
  if (!isRecord(answerKey)) {
    return {
      schema_version: HISTORICAL_COMPARISON_SCHEMA,
      experiment_id: experimentId,
      task_id: taskId,
      historical_only: true,
      status: "WAITING_FOR_ANSWER_KEY",
      target_sha: target.sha,
      target_tree_sha: target.tree,
      answer_key_status: "WITHHELD",
      contribution: "NOT_COMPUTED",
      statistics: "NOT_COMPUTED",
      current_repaired_source_used: false
    };
  }

  const controlCorrect = observedFindingCorrect(control, answerKey);
  const treatmentCorrect = observedFindingCorrect(treatment, answerKey);
  const treatmentMissed = treatmentCorrect === false;
  const controlMissed = controlCorrect === false;
  const falsePositive = cellObservation(treatment).false_positive === true;
  const scopeDelta =
    safeMetric(treatment, "scope_delta", "scopeDelta") - safeMetric(control, "scope_delta", "scopeDelta");
  const mandatoryTestDelta =
    safeMetric(treatment, "mandatory_test_delta", "mandatoryTestDelta") -
    safeMetric(control, "mandatory_test_delta", "mandatoryTestDelta");
  const authorityDelta =
    safeMetric(treatment, "authority_delta", "authorityDelta") -
    safeMetric(control, "authority_delta", "authorityDelta");
  const material =
    treatmentCorrect === true &&
    (controlMissed || scopeDelta !== 0 || mandatoryTestDelta !== 0 || authorityDelta !== 0);
  const contribution = falsePositive
    ? "FP"
    : treatmentMissed
      ? "FN"
      : material
        ? "MATERIAL"
        : treatmentCorrect === true
          ? "CONFIRMATORY"
          : treatmentCorrect === false
            ? "NO_MATERIAL"
            : "NOT_COMPUTED";

  return {
    schema_version: HISTORICAL_COMPARISON_SCHEMA,
    experiment_id: experimentId,
    task_id: taskId,
    historical_only: true,
    target_sha: target.sha,
    target_tree_sha: target.tree,
    status: "COMPARED",
    answer_key_status: "REVEALED_AFTER_BOTH_CELLS_SEALED",
    answer_key: safeClone(answerKey),
    control: {
      cell_id: control.cell_id ?? "control",
      sealed: true,
      finding_correct: controlCorrect,
      total_investigation_ms: safeMetric(control, "total_investigation_ms", "totalInvestigationMs")
    },
    treatment: {
      cell_id: treatment.cell_id ?? "treatment",
      sealed: true,
      finding_correct: treatmentCorrect,
      total_investigation_ms: safeMetric(treatment, "total_investigation_ms", "totalInvestigationMs")
    },
    finding_correct: treatmentCorrect,
    finding_missed: treatmentMissed,
    false_positive: falsePositive,
    false_negative: treatmentMissed,
    scope_delta: scopeDelta,
    mandatory_test_delta: mandatoryTestDelta,
    authority_delta: authorityDelta,
    contribution,
    statistics: "NOT_COMPUTED",
    current_repaired_source_used: false
  };
}

function candidateList(input) {
  for (const field of [
    "tasks",
    "candidates",
    "eligible_tasks",
    "eligibleTasks",
    "product_tasks",
    "candidate_tasks",
    "productTasks"
  ]) {
    if (Array.isArray(input?.[field])) return input[field];
  }
  return [];
}

function candidateId(task) {
  return firstString(task, ["task_id", "taskId", "id"], {});
}

function candidateStatus(task) {
  return normalizedUpper(task?.status ?? task?.state ?? task?.review_status ?? task?.reviewStatus, "");
}

function candidateIsPreReview(task) {
  if (task?.pre_review === true || task?.preReview === true) return true;
  return new Set(["PRE_REVIEW", "PRE_REVIEW_OPEN", "READY_FOR_PRE_REVIEW"]).has(
    normalizedUpper(task?.stage ?? task?.review_stage ?? task?.reviewStage, "")
  );
}

function candidateIsProduct(task) {
  if (task?.product_task === true || task?.productTask === true) return true;
  const kind = normalizedUpper(task?.kind ?? task?.type ?? task?.lane, "");
  return kind === "PRODUCT" || kind === "PRODUCT_TASK" || kind.startsWith("PRODUCT_");
}

function candidateIsHistorical(task) {
  const id = candidateId(task);
  const kind = normalizedUpper(task?.kind ?? task?.type ?? task?.lane, "");
  let targetSha = null;
  try {
    targetSha = firstSha(task, ["target_sha", "targetSha", "historical_target_sha"], {});
  } catch {
    // A non-exact reference is handled by the selector as an ineligible task;
    // it must never become a silently accepted historical target.
    targetSha = null;
  }
  return (
    id === HC07_TASK_ID ||
    task?.historical === true ||
    task?.is_historical === true ||
    task?.isHistorical === true ||
    kind.includes("HISTORICAL") ||
    kind.includes("SHADOW") ||
    targetSha === HC07_LOCATOR_SHA
  );
}

function candidateHasNonExactTarget(task) {
  for (const field of ["target_sha", "targetSha", "historical_target_sha", "historicalTargetSha"]) {
    if (task?.[field] === undefined || task?.[field] === null || task?.[field] === "") continue;
    try {
      firstSha(task, [field], { required: true });
    } catch {
      return true;
    }
  }
  for (const field of ["target_tree_sha", "target_tree", "targetTreeSha", "tree_sha", "treeSha"]) {
    if (task?.[field] === undefined || task?.[field] === null || task?.[field] === "") continue;
    try {
      firstSha(task, [field], { required: true });
    } catch {
      return true;
    }
  }
  return false;
}

function summarizeCandidate(task) {
  const summary = {
    task_id: candidateId(task),
    kind: normalizedUpper(task?.kind ?? task?.type ?? task?.lane, "PRODUCT"),
    status: candidateStatus(task) || "UNKNOWN",
    pre_review: candidateIsPreReview(task)
  };
  let targetSha = null;
  try {
    targetSha = firstSha(task, ["target_sha", "targetSha"], {});
  } catch {
    targetSha = null;
  }
  if (targetSha) summary.target_sha = targetSha;
  const title = firstString(task, ["title", "name"], {});
  if (title) summary.title = title;
  const priority = asFiniteNumber(task?.priority, "priority");
  if (priority !== null) summary.priority = priority;
  return summary;
}

/**
 * Select one explicitly eligible forward Product task. Historical HC-07 and
 * other completed/non-product tasks are always excluded. With no eligible
 * task, all state aliases intentionally carry the required waiting value so
 * callers cannot mistake an empty result for permission to invent work.
 */
export function selectForwardPilot(input = {}) {
  if (!isRecord(input)) throw new TypeError("forward selector input must be an object");
  const candidates = candidateList(input);
  const eligible = [];
  const excluded = [];
  for (const task of candidates.slice(0, MAX_EXCLUDED_TASKS)) {
    const taskId = candidateId(task) || "UNIDENTIFIED_TASK";
    let reason = null;
    if (!candidateId(task)) reason = "TASK_ID_REQUIRED";
    else if (candidateIsHistorical(task)) reason = "HISTORICAL_COMPARISON_NOT_FORWARD_ELIGIBLE";
    else if (candidateHasNonExactTarget(task)) reason = "NON_EXACT_TARGET";
    else if (!candidateIsProduct(task)) reason = "NOT_A_PRODUCT_TASK";
    else if (!candidateIsPreReview(task)) reason = "NOT_PRE_REVIEW";
    else if (!OPEN_TASK_STATUSES.has(candidateStatus(task))) reason = "TASK_NOT_OPEN";
    else if (task?.review_complete === true || task?.reviewComplete === true || task?.post_review === true)
      reason = "REVIEW_ALREADY_STARTED";
    if (reason) excluded.push({ task_id: taskId, reason });
    else eligible.push(task);
  }

  eligible.sort((left, right) => {
    const leftPriority = Number.isFinite(Number(left?.priority)) ? Number(left.priority) : Number.MAX_SAFE_INTEGER;
    const rightPriority = Number.isFinite(Number(right?.priority)) ? Number(right.priority) : Number.MAX_SAFE_INTEGER;
    return leftPriority - rightPriority || String(candidateId(left)).localeCompare(String(candidateId(right)));
  });

  const selected = eligible[0] ? summarizeCandidate(eligible[0]) : null;
  const state = selected ? "SELECTED_PRE_REVIEW_PRODUCT_TASK" : WAITING_FOR_NEXT_PRE_REVIEW_PRODUCT_TASK;
  return {
    schema_version: FORWARD_SELECTOR_SCHEMA,
    state,
    status: state,
    selector_state: state,
    eligible_count: eligible.length,
    selected_task: selected,
    excluded_tasks: excluded.slice(0, MAX_EXCLUDED_TASKS),
    hc07_forward_pilot: false,
    reason: selected ? "EXPLICIT_PRE_REVIEW_PRODUCT_TASK_SELECTED" : "NO_ELIGIBLE_PRE_REVIEW_PRODUCT_TASK",
    answer_key_access: "NOT_APPLICABLE"
  };
}
