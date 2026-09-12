import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

export const USAGE_EVENT_SCHEMA_VERSION = "SIMWAR_KG_USAGE_EVENT_V2";
export const USAGE_RECEIPT_SCHEMA_VERSION = "SIMWAR_KG_USAGE_RECEIPT_V2";
export const GRAPH_SUPPORT_ENVELOPE_SCHEMA_VERSION = "SIMWAR_GRAPH_SUPPORT_ENVELOPE_V1_2";
export const DERIVED_AUTHORITY = "DERIVED_ENGINEERING_EVIDENCE_ONLY";

const STORAGE_DIRECTORIES = Object.freeze({
  staging: "staging",
  complete: "complete",
  finalized: "final"
});
const STORAGE_FIELDS = new Set([
  "storage_status",
  "event_hash",
  "storage_redactions",
  "unresolved_parents",
  "parent_resolution",
  "complete_hash",
  "finalized_at"
]);
const SECRET_KEY_PATTERN =
  /(?:^|[_-])(api[_-]?key|access[_-]?key|client[_-]?secret|password|passwd|secret|token|authorization|cookie|private[_-]?key)(?:$|[_-])/iu;
const SECRET_VALUE_PATTERNS = [
  /\bBearer\s+[^\s,;]+/giu,
  /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/giu,
  /\b(?:sk|pk|ghp|github_pat|xox[baprs])-[A-Za-z0-9_-]{8,}\b/gu,
  /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/gu
];
const EVENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/iu;
const RAW_PAYLOAD_KEYS = new Set([
  "command",
  "command_line",
  "shell_command",
  "script",
  "stdout",
  "stderr",
  "raw_output",
  "raw_command",
  "command_output",
  "terminal_output"
]);
const VALIDATED_ROOTS = new Map();

function isSecretKey(key) {
  if (typeof key !== "string") return false;
  const normalized = key.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
  return SECRET_KEY_PATTERN.test(normalized) || /(?:^|_)(?:auth|access|refresh|api|client)?_?(?:token|secret|password|passwd|key)(?:$|_)/u.test(normalized);
}
function isRawPayloadKey(key) {
  if (typeof key !== "string") return false;
  const normalized = key.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase();
  return RAW_PAYLOAD_KEYS.has(normalized);
}


export class UsageTelemetryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "UsageTelemetryError";
    this.code = code;
    Object.assign(this, details);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireObject(value, label) {
  if (!isObject(value))
    throw new UsageTelemetryError("INVALID_INPUT", `${label} must be an object`);
  return value;
}

function normalizeText(value, label) {
  if (typeof value !== "string" || !value.trim())
    throw new UsageTelemetryError("INVALID_INPUT", `${label} must be a non-empty string`);
  return value.trim();
}

function normalizePathSeparators(value) {
  return String(value).replaceAll("\\", "/");
}

function pathKey(value) {
  const normalized = normalizePathSeparators(resolve(value));
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function pathWithin(candidate, parent) {
  const candidateKey = pathKey(candidate);
  const parentKey = pathKey(parent);
  if (candidateKey === parentKey) return true;
  const remainder = normalizePathSeparators(relative(parentKey, candidateKey));
  return remainder !== ".." && !remainder.startsWith("../") && !isAbsolute(remainder);
}

function assertNoSymlinkInPath(candidate, label) {
  const absolute = resolve(candidate);
  let cursor = absolute;
  while (true) {
    if (existsSync(cursor)) {
      let stat;
      try {
        stat = lstatSync(cursor);
      } catch (error) {
        throw new UsageTelemetryError(
          "UNSAFE_PATH",
          `Unable to inspect ${label}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      if (stat.isSymbolicLink())
        throw new UsageTelemetryError(
          "UNSAFE_SYMLINK",
          `${label} contains a symlink or reparse point`
        );
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
}

function canonicalPhysicalPath(candidate, label) {
  try {
    return realpathSync(candidate);
  } catch (error) {
    throw new UsageTelemetryError(
      "UNSAFE_PATH",
      `Unable to canonicalize ${label}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate and create an event root that is physically outside the Product
 * repository. Telemetry is intentionally kept in a caller-owned external
 * evidence root; this helper never creates a Product-repository directory.
 */
function assertExternalEventRoot(eventRoot, productRepoRoot) {
  const root = resolve(normalizeText(eventRoot, "eventRoot"));
  const product = resolve(
    productRepoRoot ? normalizeText(productRepoRoot, "productRepoRoot") : process.cwd()
  );
  if (pathWithin(root, product))
    throw new UsageTelemetryError(
      "EXTERNAL_ROOT_REQUIRED",
      "eventRoot must be outside the Product repository"
    );
  const cacheKey = `${pathKey(root)}\u0000${pathKey(product)}`;
  const cached = VALIDATED_ROOTS.get(cacheKey);
  if (cached && existsSync(root)) {
    const rootStat = lstatSync(root);
    if (!rootStat.isDirectory())
      throw new UsageTelemetryError("UNSAFE_PATH", "eventRoot is not a directory");
    if (rootStat.isSymbolicLink())
      throw new UsageTelemetryError(
        "UNSAFE_SYMLINK",
        "eventRoot contains a symlink or reparse point"
      );
    return { root, product, physicalRoot: cached.physicalRoot };
  }
  assertNoSymlinkInPath(root, "eventRoot");
  if (existsSync(product)) assertNoSymlinkInPath(product, "productRepoRoot");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  assertNoSymlinkInPath(root, "eventRoot");
  const physicalRoot = canonicalPhysicalPath(root, "eventRoot");
  const physicalProduct = existsSync(product)
    ? canonicalPhysicalPath(product, "productRepoRoot")
    : product;
  if (pathWithin(physicalRoot, physicalProduct))
    throw new UsageTelemetryError(
      "EXTERNAL_ROOT_REQUIRED",
      "eventRoot resolves inside the Product repository"
    );
  VALIDATED_ROOTS.set(cacheKey, { physicalRoot });
  return { root, product, physicalRoot };
}

function assertSafeArtifactPath(root, artifactPath, label) {
  const absolute = resolve(artifactPath);
  if (!pathWithin(absolute, root) || pathKey(absolute) === pathKey(root))
    throw new UsageTelemetryError("UNSAFE_PATH", `${label} escapes eventRoot`);
  assertNoSymlinkInPath(absolute, label);
  return absolute;
}

function ensureStorageDirectories(root) {
  const result = {};
  for (const [key, directory] of Object.entries(STORAGE_DIRECTORIES)) {
    const path = assertSafeArtifactPath(root, join(root, directory), `${key} directory`);
    if (existsSync(path)) {
      if (!lstatSync(path).isDirectory())
        throw new UsageTelemetryError("UNSAFE_PATH", `${key} storage path is not a directory`);
    } else {
      mkdirSync(path, { recursive: true, mode: 0o700 });
    }
    assertNoSymlinkInPath(path, `${key} directory`);
    result[key] = path;
  }
  return result;
}

function assertSafeEventId(value) {
  const eventId = normalizeText(value, "event_id");
  if (!EVENT_ID_PATTERN.test(eventId))
    throw new UsageTelemetryError("UNSAFE_EVENT_ID", "event_id must be a path-safe identifier");
  return eventId;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value))
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)])
    );
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" || Buffer.isBuffer(value) ? value : canonicalJson(value))
    .digest("hex");
}

function secretValueMatch(value) {
  return (
    typeof value === "string" &&
    SECRET_VALUE_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(value);
    })
  );
}

function redactSecretValue(value) {
  let redacted = value;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

function sanitizeValue(value, { policy, path = "$", redactions, seen }) {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    if (typeof value === "string" && secretValueMatch(value)) {
      if (policy === "reject")
        throw new UsageTelemetryError("SECRET_REJECTED", `Secret-like value found at ${path}`);
      redactions.push(path);
      return redactSecretValue(value);
    }
    return value;
  }
  if (
    typeof value === "undefined" ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  )
    throw new UsageTelemetryError("INVALID_INPUT", `Unsupported value at ${path}`);
  if (seen.has(value))
    throw new UsageTelemetryError("INVALID_INPUT", `Cyclic value found at ${path}`);
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map((entry, index) =>
      sanitizeValue(entry, { policy, path: `${path}[${index}]`, redactions, seen })
    );
    seen.delete(value);
    return result;
  }
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const keyPath = `${path}.${key}`;
    if (isRawPayloadKey(key))
      throw new UsageTelemetryError(
        "RAW_PAYLOAD_REJECTED",
        `Raw command/output payload field is not allowed at ${keyPath}`
      );
    if (STORAGE_FIELDS.has(key))
      throw new UsageTelemetryError("IMMUTABLE_FIELD_REJECTED", `${key} is reserved for storage`);
    if (isSecretKey(key)) {
      if (policy === "reject")
        throw new UsageTelemetryError(
          "SECRET_REJECTED",
          `Secret-bearing field found at ${keyPath}`
        );
      redactions.push(keyPath);
      result[key] = "[REDACTED]";
      continue;
    }
    result[key] = sanitizeValue(entry, { policy, path: keyPath, redactions, seen });
  }
  seen.delete(value);
  return result;
}

function normalizeSecretPolicy(input) {
  const raw = input?.secretPolicy ?? input?.secret_policy ?? "reject";
  const policy = String(raw).toLowerCase();
  if (policy !== "reject" && policy !== "redact")
    throw new UsageTelemetryError("INVALID_INPUT", "secretPolicy must be reject or redact");
  return policy;
}

function extractArguments(input, options = {}) {
  const value = requireObject(input, "input");
  const nestedEvent = isObject(value.event)
    ? value.event
    : isObject(value.usage_event)
      ? value.usage_event
      : null;
  const configKeys = new Set([
    "event",
    "usage_event",
    "eventRoot",
    "event_root",
    "root",
    "usageRoot",
    "usage_root",
    "productRepoRoot",
    "product_repo_root",
    "repoRoot",
    "repo_root",
    "secretPolicy",
    "secret_policy",
    "eventId",
    "event_id",
    "receiptPath",
    "receipt_path",
    "sealPath",
    "seal_path"
  ]);
  const event = nestedEvent
    ? nestedEvent
    : Object.fromEntries(Object.entries(value).filter(([key]) => !configKeys.has(key)));
  const eventRoot =
    value.eventRoot ??
    value.event_root ??
    value.root ??
    value.usageRoot ??
    value.usage_root ??
    options.eventRoot ??
    options.event_root;
  const productRepoRoot =
    value.productRepoRoot ??
    value.product_repo_root ??
    value.repoRoot ??
    value.repo_root ??
    options.productRepoRoot ??
    options.product_repo_root;
  return { value, event, eventRoot, productRepoRoot, options };
}

function normalizeEvent(event, policy) {
  requireObject(event, "event");
  const eventId = assertSafeEventId(event.event_id ?? event.eventId);
  const eventType = normalizeText(event.event_type ?? event.eventType, "event_type");
  const occurredAt = normalizeText(event.occurred_at ?? event.occurredAt, "occurred_at");
  if (!ISO_TIMESTAMP_PATTERN.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt)))
    throw new UsageTelemetryError(
      "INVALID_INPUT",
      "occurred_at must be an ISO-8601 timestamp with timezone"
    );
  const parents = event.parents ?? event.parent_ids ?? event.parentIds ?? [];
  if (
    !Array.isArray(parents) ||
    parents.some((parent) => typeof parent !== "string" || !parent.trim())
  )
    throw new UsageTelemetryError(
      "INVALID_INPUT",
      "parents must be an array of non-empty event ids"
    );
  const parentIds = [...new Set(parents.map((parent) => assertSafeEventId(parent)))].sort(
    (left, right) => left.localeCompare(right)
  );
  const payload = event.payload ?? {};
  requireObject(payload, "payload");
  const eventRecord = {
    ...event,
    schema_version: event.schema_version ?? USAGE_EVENT_SCHEMA_VERSION,
    event_id: eventId,
    event_type: eventType,
    occurred_at: occurredAt,
    parents: parentIds,
    payload
  };
  if (eventRecord.schema_version !== USAGE_EVENT_SCHEMA_VERSION)
    throw new UsageTelemetryError(
      "INVALID_SCHEMA",
      `event schema must be ${USAGE_EVENT_SCHEMA_VERSION}`
    );
  const redactions = [];
  const sanitized = sanitizeValue(eventRecord, {
    policy,
    redactions,
    seen: new WeakSet()
  });
  return { event: canonicalize(sanitized), redactions: [...new Set(redactions)].sort() };
}

function immutableEvent(record) {
  const value = { ...record };
  for (const field of STORAGE_FIELDS) delete value[field];
  return canonicalize(value);
}

function parseJsonFile(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new UsageTelemetryError(
      "CORRUPT_ARTIFACT",
      `Unable to read ${label}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function writeExclusiveJson(path, value, label) {
  const text = `${canonicalJson(value)}\n`;
  assertNoSymlinkInPath(path, label);
  try {
    writeFileSync(path, text, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return { created: true, text };
  } catch (error) {
    if (error?.code !== "EEXIST")
      throw new UsageTelemetryError(
        "WRITE_FAILED",
        `Unable to write ${label}: ${error instanceof Error ? error.message : String(error)}`
      );
    const existing = parseJsonFile(path, label);
    const existingText = `${canonicalJson(existing)}\n`;
    if (existingText !== text)
      throw new UsageTelemetryError(
        "DUPLICATE_CONFLICT",
        `DUPLICATE_CONFLICT: ${label} already exists with different content`
      );
    return { created: false, text };
  }
}

function buildPaths(root, eventId) {
  const directories = ensureStorageDirectories(root);
  return {
    staging_path: assertSafeArtifactPath(
      root,
      join(directories.staging, `${eventId}.json`),
      "staging artifact"
    ),
    complete_path: assertSafeArtifactPath(
      root,
      join(directories.complete, `${eventId}.json`),
      "complete artifact"
    ),
    final_path: assertSafeArtifactPath(
      root,
      join(directories.finalized, `${eventId}.json`),
      "final artifact"
    )
  };
}

function eventRecordFromStorage(path, expectedStatus) {
  const record = parseJsonFile(path, `${expectedStatus} event`);
  if (!isObject(record) || record.storage_status !== expectedStatus)
    throw new UsageTelemetryError(
      "CORRUPT_ARTIFACT",
      `${expectedStatus} event has an invalid storage status`
    );
  const event = immutableEvent(record);
  const eventId = assertSafeEventId(event.event_id);
  const eventHash = sha256(event);
  if ((expectedStatus === "COMPLETE" || expectedStatus === "FINALIZED") && !record.event_hash)
    throw new UsageTelemetryError(
      "HASH_MISMATCH",
      `${expectedStatus} event ${eventId} is missing its stored event hash`
    );
  if (record.event_hash && record.event_hash !== eventHash)
    throw new UsageTelemetryError(
      "HASH_MISMATCH",
      `${expectedStatus} event ${eventId} has an invalid event hash`
    );
  return { record, event, event_id: eventId, event_hash: eventHash, path };
}

function readFinalEvents(root) {
  const directories = ensureStorageDirectories(root);
  const directory = directories.finalized;
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  const records = [];
  const seen = new Map();
  for (const entry of entries) {
    if (!entry.name.endsWith(".json")) continue;
    const path = assertSafeArtifactPath(root, join(directory, entry.name), "final artifact");
    if (!entry.isFile())
      throw new UsageTelemetryError("UNSAFE_PATH", `Final artifact ${entry.name} is not a file`);
    const parsed = eventRecordFromStorage(path, "FINALIZED");
    if (seen.has(parsed.event_id) && seen.get(parsed.event_id).event_hash !== parsed.event_hash)
      throw new UsageTelemetryError(
        "DUPLICATE_CONFLICT",
        `Final event ${parsed.event_id} has conflicting copies`
      );
    if (!seen.has(parsed.event_id)) {
      seen.set(parsed.event_id, parsed);
      records.push(parsed);
    }
  }
  return records;
}

function storageConfigFor(input, options) {
  const args = extractArguments(input, options);
  const root = assertExternalEventRoot(args.eventRoot, args.productRepoRoot);
  return { ...args, ...root };
}

/** Stage one immutable usage event in the external append-only event root. */
export function createUsageEvent(input, options = {}) {
  const args = storageConfigFor(input, options);
  const policy = normalizeSecretPolicy(args.value);
  const normalized = normalizeEvent(args.event, policy);
  const paths = buildPaths(args.root, normalized.event.event_id);
  const eventHash = sha256(normalized.event);
  const candidateStage = {
    ...normalized.event,
    storage_status: "STAGED",
    storage_redactions: normalized.redactions
  };
  if (existsSync(paths.final_path)) {
    const existing = eventRecordFromStorage(paths.final_path, "FINALIZED");
    if (existing.event_hash !== eventHash)
      throw new UsageTelemetryError(
        "DUPLICATE_CONFLICT",
        `Event ${normalized.event.event_id} conflicts with finalized content`
      );
    return {
      status: "REUSED",
      event_root: args.root,
      event_id: normalized.event.event_id,
      event_hash: existing.event_hash,
      redactions: existing.record.storage_redactions ?? [],
      ...paths
    };
  }
  const stageResult = writeExclusiveJson(paths.staging_path, candidateStage, "staging artifact");
  if (!stageResult.created) {
    const existing = eventRecordFromStorage(paths.staging_path, "STAGED");
    if (existing.event_hash !== eventHash)
      throw new UsageTelemetryError(
        "DUPLICATE_CONFLICT",
        `Event ${normalized.event.event_id} conflicts with staged content`
      );
    return {
      status: "REUSED",
      event_root: args.root,
      event_id: normalized.event.event_id,
      event_hash: eventHash,
      redactions: existing.record.storage_redactions ?? [],
      ...paths
    };
  }
  return {
    status: "STAGED",
    event_root: args.root,
    event_id: normalized.event.event_id,
    event_hash: eventHash,
    redactions: normalized.redactions,
    ...paths
  };
}

function finalizeArguments(input, options = {}) {
  const value = requireObject(input, "input");
  const eventRoot =
    value.eventRoot ??
    value.event_root ??
    value.root ??
    value.event_root_path ??
    options.eventRoot ??
    options.event_root ??
    value.event_root;
  const productRepoRoot =
    value.productRepoRoot ??
    value.product_repo_root ??
    options.productRepoRoot ??
    options.product_repo_root;
  const eventId = value.eventId ?? value.event_id ?? value.id;
  if (!eventId)
    throw new UsageTelemetryError("INVALID_INPUT", "finalizeUsageEvent requires eventId");
  const root = assertExternalEventRoot(eventRoot, productRepoRoot);
  const id = assertSafeEventId(eventId);
  return { value, eventRoot: root.root, productRepoRoot, id, paths: buildPaths(root.root, id) };
}

/** Complete and exclusively finalize one staged usage event. */
export function finalizeUsageEvent(input, options = {}) {
  const args = finalizeArguments(input, options);
  if (existsSync(args.paths.final_path)) {
    const existing = eventRecordFromStorage(args.paths.final_path, "FINALIZED");
    return {
      status: "REUSED",
      event_root: args.eventRoot,
      event_id: existing.event_id,
      event_hash: existing.event_hash,
      unresolved_parents: existing.record.unresolved_parents ?? [],
      redactions: existing.record.storage_redactions ?? [],
      staging_path: args.paths.staging_path,
      complete_path: args.paths.complete_path,
      final_path: args.paths.final_path
    };
  }
  if (!existsSync(args.paths.staging_path))
    throw new UsageTelemetryError("EVENT_NOT_FOUND", `No staged event exists for ${args.id}`);
  const staged = eventRecordFromStorage(args.paths.staging_path, "STAGED");
  const knownFinalIds = new Set(readFinalEvents(args.eventRoot).map((entry) => entry.event_id));
  const unresolvedParents = (staged.event.parents ?? [])
    .filter((parentId) => !knownFinalIds.has(parentId))
    .sort((left, right) => left.localeCompare(right));
  const complete = {
    ...staged.event,
    storage_status: "COMPLETE",
    event_hash: staged.event_hash,
    storage_redactions: staged.record.storage_redactions ?? [],
    unresolved_parents: unresolvedParents,
    parent_resolution: unresolvedParents.length > 0 ? "UNRESOLVED" : "RESOLVED"
  };
  const completeResult = writeExclusiveJson(
    args.paths.complete_path,
    complete,
    "complete artifact"
  );
  if (!completeResult.created) {
    const existingComplete = eventRecordFromStorage(args.paths.complete_path, "COMPLETE");
    if (existingComplete.event_hash !== staged.event_hash)
      throw new UsageTelemetryError(
        "DUPLICATE_CONFLICT",
        `Complete event ${args.id} conflicts with staged content`
      );
  }
  const finalized = {
    ...staged.event,
    storage_status: "FINALIZED",
    event_hash: staged.event_hash,
    storage_redactions: staged.record.storage_redactions ?? [],
    unresolved_parents: unresolvedParents,
    parent_resolution: unresolvedParents.length > 0 ? "UNRESOLVED" : "RESOLVED"
  };
  const finalResult = writeExclusiveJson(args.paths.final_path, finalized, "final artifact");
  if (!finalResult.created) {
    const existingFinal = eventRecordFromStorage(args.paths.final_path, "FINALIZED");
    if (existingFinal.event_hash !== staged.event_hash)
      throw new UsageTelemetryError(
        "DUPLICATE_CONFLICT",
        `Final event ${args.id} conflicts with staged content`
      );
    return {
      status: "REUSED",
      event_root: args.eventRoot,
      event_id: staged.event_id,
      event_hash: staged.event_hash,
      unresolved_parents: existingFinal.record.unresolved_parents ?? unresolvedParents,
      redactions: staged.record.storage_redactions ?? [],
      staging_path: args.paths.staging_path,
      complete_path: args.paths.complete_path,
      final_path: args.paths.final_path
    };
  }
  return {
    status: "FINALIZED",
    event_root: args.eventRoot,
    event_id: staged.event_id,
    event_hash: staged.event_hash,
    unresolved_parents: unresolvedParents,
    redactions: staged.record.storage_redactions ?? [],
    staging_path: args.paths.staging_path,
    complete_path: args.paths.complete_path,
    final_path: args.paths.final_path
  };
}

function topologicalOrder(records) {
  const byId = new Map(records.map((record) => [record.event_id, record]));
  const indegree = new Map(records.map((record) => [record.event_id, 0]));
  const children = new Map(records.map((record) => [record.event_id, []]));
  const unresolvedParents = [];
  for (const record of records) {
    for (const parentId of record.event.parents ?? []) {
      if (!byId.has(parentId)) {
        unresolvedParents.push({ event_id: record.event_id, parent_id: parentId });
        continue;
      }
      indegree.set(record.event_id, indegree.get(record.event_id) + 1);
      children.get(parentId).push(record.event_id);
    }
  }
  for (const childIds of children.values())
    childIds.sort((left, right) => left.localeCompare(right));
  const ready = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([eventId]) => eventId)
    .sort((left, right) => left.localeCompare(right));
  const orderedIds = [];
  while (ready.length > 0) {
    const eventId = ready.shift();
    orderedIds.push(eventId);
    for (const childId of children.get(eventId) ?? []) {
      const degree = indegree.get(childId) - 1;
      indegree.set(childId, degree);
      if (degree === 0) {
        ready.push(childId);
        ready.sort((left, right) => left.localeCompare(right));
      }
    }
  }
  const cycleIds = [...indegree.entries()]
    .filter(([, degree]) => degree > 0)
    .map(([eventId]) => eventId)
    .sort((left, right) => left.localeCompare(right));
  return {
    ordered: orderedIds.map((eventId) => byId.get(eventId)),
    unresolvedParents: unresolvedParents.sort((left, right) =>
      `${left.event_id}\u0000${left.parent_id}`.localeCompare(
        `${right.event_id}\u0000${right.parent_id}`
      )
    ),
    cycleIds
  };
}

function validateReceiptHash(receipt) {
  if (!isObject(receipt) || receipt.schema_version !== USAGE_RECEIPT_SCHEMA_VERSION)
    throw new UsageTelemetryError(
      "INVALID_RECEIPT",
      `receipt must be ${USAGE_RECEIPT_SCHEMA_VERSION}`
    );
  if (!SHA256_PATTERN.test(receipt.receipt_hash ?? ""))
    throw new UsageTelemetryError("INVALID_RECEIPT", "receipt_hash must be a SHA-256 digest");
  const withoutHash = { ...receipt };
  delete withoutHash.receipt_hash;
  if (sha256(withoutHash) !== receipt.receipt_hash)
    throw new UsageTelemetryError("HASH_MISMATCH", "receipt_hash does not match receipt content");
}

/** Compile finalized external events into one deterministic, non-authoritative receipt. */
export function compileUsageReceipt(input, options = {}) {
  const value = requireObject(input, "input");
  const eventRoot =
    value.eventRoot ?? value.event_root ?? value.root ?? options.eventRoot ?? options.event_root;
  const productRepoRoot =
    value.productRepoRoot ??
    value.product_repo_root ??
    options.productRepoRoot ??
    options.product_repo_root;
  const root = assertExternalEventRoot(eventRoot, productRepoRoot);
  const records = readFinalEvents(root.root);
  const order = topologicalOrder(records);
  const byId = new Map(records.map((record) => [record.event_id, record]));
  const orderedRecords = [
    ...order.ordered,
    ...order.cycleIds.map((eventId) => byId.get(eventId)).filter(Boolean)
  ];
  const events = orderedRecords.map((record) => ({
    ...record.event,
    event_hash: record.event_hash,
    unresolved_parents: order.unresolvedParents
      .filter((parent) => parent.event_id === record.event_id)
      .map((parent) => parent.parent_id)
  }));
  const receiptBase = {
    schema_version: USAGE_RECEIPT_SCHEMA_VERSION,
    authority: DERIVED_AUTHORITY,
    event_root_external: true,
    event_root_ref: "external-append-only-event-dag",
    event_count: events.length,
    event_ids: events.map((event) => event.event_id),
    compile_order: "topological(parent-first),event_id-ascending",
    events,
    unresolved_parents: order.unresolvedParents,
    unresolved_cycles: order.cycleIds,
    status:
      order.cycleIds.length > 0
        ? "BLOCKED_CYCLE"
        : order.unresolvedParents.length > 0
          ? "PASS_WITH_LIMITS"
          : "PASS",
    limits: [
      ...(order.unresolvedParents.length > 0 ? ["UNRESOLVED_PARENTS"] : []),
      ...(order.cycleIds.length > 0 ? ["CYCLE_DETECTED"] : [])
    ],
    excluded_from_truth_hash: [
      "knowledge_card",
      "recommendation",
      "role_draft",
      "learning_evidence",
      "billing",
      "entitlement",
      "data_policy",
      "case_candidate",
      "pre_review_decision"
    ],
    controller: "NONE",
    evidence_store: "EXTERNAL_EVENT_DAG_ONLY"
  };
  const receipt = { ...receiptBase, receipt_hash: sha256(receiptBase) };
  const receiptPath =
    value.receiptPath ?? value.receipt_path ?? options.receiptPath ?? options.receipt_path;
  if (receiptPath) {
    const safeReceiptPath = assertSafeArtifactPath(root.root, receiptPath, "receipt artifact");
    writeExclusiveJson(safeReceiptPath, receipt, "receipt artifact");
  }
  return receipt;
}

function evidencePresent(value) {
  if (typeof value === "string") return value.trim().length > 0;
  return isObject(value) && Object.keys(value).length > 0;
}

function evidenceReference(value, fields) {
  if (typeof value === "string") return value.trim() || null;
  if (!isObject(value)) return null;
  for (const field of fields) {
    if (typeof value[field] === "string" && value[field].trim()) return value[field].trim();
  }
  return null;
}

function hasStrongEvidence(value, fields = []) {
  if (!evidencePresent(value)) return false;
  if (fields.length === 0) return true;
  return fields.every((field) => {
    const entry = value?.[field];
    return typeof entry === "string"
      ? entry.trim().length > 0
      : entry !== null && entry !== undefined;
  });
}

function hasStringField(value, fields) {
  return isObject(value) && fields.some((field) => typeof value[field] === "string" && value[field].trim());
}

function hasTypedValueEvidence(value) {
  const knowledgeCard = value.knowledge_card;
  const source = value.source;
  const before = value.before_judgement ?? value.beforeJudgement;
  const after = value.after_judgement ?? value.afterJudgement;
  const changed = value.changed_artifact ?? value.changedArtifact;
  const action = value.actual_action ?? value.actualAction;
  const counterfactual = value.counterfactual;
  return (
    hasStringField(knowledgeCard, ["id", "ref"]) &&
    hasStringField(knowledgeCard, ["claim"]) &&
    hasStringField(source, ["ref", "path", "id"]) &&
    hasStringField(source, ["digest"]) &&
    hasStringField(before, ["id", "evidence_ref", "ref", "result"]) &&
    hasStringField(after, ["id", "evidence_ref", "ref", "result"]) &&
    hasStringField(changed, ["ref", "path", "id"]) &&
    hasStringField(changed, ["digest"]) &&
    hasStringField(action, ["action_id", "id"]) &&
    hasStringField(action, ["outcome"]) &&
    counterfactual?.available === true &&
    hasStringField(counterfactual, ["id", "ref", "result"])
  );
}

/**
 * Reconcile development value without treating graph usage, advice, or shadow
 * observations as proof. Actual value requires the complete source-to-action
 * chain and a recorded counterfactual.
 */
export function reconcileValue(input = {}) {
  const value = requireObject(input, "value reconciliation");
  const typedComplete = hasTypedValueEvidence(value);
  const checks = [
    [
      "knowledge_card",
      hasStrongEvidence(value.knowledge_card, ["id", "claim"]) ||
        evidencePresent(value.knowledge_card)
    ],
    ["source", hasStrongEvidence(value.source, ["ref", "digest"]) || evidencePresent(value.source)],
    ["before_judgement", evidencePresent(value.before_judgement ?? value.beforeJudgement)],
    ["after_judgement", evidencePresent(value.after_judgement ?? value.afterJudgement)],
    [
      "changed_artifact",
      hasStrongEvidence(value.changed_artifact ?? value.changedArtifact, ["ref", "digest"])
    ],
    [
      "actual_action",
      hasStrongEvidence(value.actual_action ?? value.actualAction, ["action_id", "outcome"])
    ],
    [
      "counterfactual",
      value.counterfactual?.available === true && evidencePresent(value.counterfactual)
    ]
  ];
  const missing = checks.filter(([, complete]) => !complete).map(([field]) => field);
  const refs = {
    knowledge_card: evidenceReference(value.knowledge_card, ["id", "ref"]),
    source: evidenceReference(value.source, ["ref", "path"]),
    before_judgement: evidenceReference(value.before_judgement ?? value.beforeJudgement, [
      "id",
      "evidence_ref"
    ]),
    after_judgement: evidenceReference(value.after_judgement ?? value.afterJudgement, [
      "id",
      "evidence_ref"
    ]),
    changed_artifact: evidenceReference(value.changed_artifact ?? value.changedArtifact, [
      "ref",
      "path",
      "id"
    ]),
    actual_action: evidenceReference(value.actual_action ?? value.actualAction, [
      "action_id",
      "id"
    ]),
    counterfactual: evidenceReference(value.counterfactual, ["id", "ref"])
  };
  const chainComplete = missing.length === 0 && typedComplete;
  if (!typedComplete) {
    for (const field of ["knowledge_card", "source", "before_judgement", "after_judgement", "changed_artifact", "actual_action", "counterfactual"])
      if (!missing.includes(field)) missing.push(field);
  }
  return {
    schema_version: "SIMWAR_KG_VALUE_RECONCILIATION_V1",
    authority: DERIVED_AUTHORITY,
    status: chainComplete ? "DEVELOPMENT_VALUE_PROVEN" : "DEVELOPMENT_VALUE_NOT_PROVEN",
    proof_status: chainComplete ? "PROVEN" : "NOT_PROVEN",
    chain_complete: chainComplete,
    chain: Object.fromEntries(
      checks.map(([field, complete]) => [field, complete ? "OBSERVED" : "MISSING"])
    ),
    missing,
    evidence_refs: refs,
    statistics: "NOT_COMPUTED",
    actual_action_required: true,
    recommendation_only:
      evidencePresent(value.recommendation) &&
      !hasStrongEvidence(value.actual_action ?? value.actualAction, ["action_id", "outcome"]),
    shadow_only:
      evidencePresent(value.shadow_observation ?? value.shadowObservation) && !chainComplete,
    non_proofs: [
      "recommendation_without_actual_action",
      "shadow_observation_without_changed_artifact",
      "event_count_or_node_count",
      "receipt_presence_without_value_judgement"
    ]
  };
}

function boundedStrings(value, limit) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim())
    .slice(0, limit);
}

function summarizeUsageReceipt(value) {
  if (!isObject(value)) return { receipt_hash: null, event_count: 0, status: "NOT_OBSERVED" };
  return {
    receipt_hash: SHA256_PATTERN.test(value.receipt_hash ?? "") ? value.receipt_hash : null,
    event_count:
      Number.isInteger(value.event_count) && value.event_count >= 0 ? value.event_count : 0,
    status: typeof value.status === "string" ? value.status : "NOT_OBSERVED",
    unresolved_parent_count: Array.isArray(value.unresolved_parents)
      ? value.unresolved_parents.length
      : 0,
    event_root_external: value.event_root_external === true
  };
}

function summarizeValueReconciliation(value) {
  return reconcileValue(isObject(value) ? value : {});
}

/** Build a compact V1.2 graph envelope; it remains derived evidence only. */
export function buildGraphSupportEnvelopeV12(input = {}) {
  const value = isObject(input) ? input : {};
  const limit = {
    source_anchors: 10,
    consumer_paths: 10,
    shared_authorities: 10,
    writer_paths: 10,
    cross_cell_convergence: 10,
    mandatory_tests: 15,
    candidate_tests: 15,
    unresolved: 10
  };
  const envelope = {
    schema_version: GRAPH_SUPPORT_ENVELOPE_SCHEMA_VERSION,
    authority: DERIVED_AUTHORITY,
    mission_id: value.mission_id ?? null,
    lane: value.lane ?? null,
    target_sha: value.target_sha ?? null,
    target_tree: value.target_tree ?? null,
    risk_class: value.risk_class ?? null,
    risk_reasons: boundedStrings(value.risk_reasons, 10),
    canonical_seam: value.canonical_seam ?? null,
    decision_needed: value.decision_needed ?? null,
    tool_route: isObject(value.tool_route) ? canonicalize(value.tool_route) : {},
    source_anchors: boundedStrings(value.source_anchors, limit.source_anchors),
    consumer_paths: boundedStrings(value.consumer_paths, limit.consumer_paths),
    shared_authorities: boundedStrings(value.shared_authorities, limit.shared_authorities),
    writer_paths: boundedStrings(value.writer_paths, limit.writer_paths),
    cross_cell_convergence: boundedStrings(
      value.cross_cell_convergence,
      limit.cross_cell_convergence
    ),
    mandatory_tests: boundedStrings(value.mandatory_tests, limit.mandatory_tests),
    candidate_tests: boundedStrings(value.candidate_tests, limit.candidate_tests),
    unresolved: boundedStrings(value.unresolved, limit.unresolved),
    admission: value.admission ?? "SOURCE_FALLBACK",
    usage_receipt: summarizeUsageReceipt(value.usage_receipt ?? value.usageReceipt),
    value_reconciliation: summarizeValueReconciliation(
      value.value_reconciliation ?? value.valueReconciliation
    ),
    pre_review_seal: isObject(value.pre_review_seal ?? value.preReviewSeal)
      ? {
          status: (value.pre_review_seal ?? value.preReviewSeal).status ?? "NOT_OBSERVED",
          receipt_hash: SHA256_PATTERN.test(
            (value.pre_review_seal ?? value.preReviewSeal).receipt_hash ?? ""
          )
            ? (value.pre_review_seal ?? value.preReviewSeal).receipt_hash
            : null,
          approval: "NOT_GRANTED"
        }
      : { status: "NOT_OBSERVED", receipt_hash: null, approval: "NOT_GRANTED" },
    external_event_dag: {
      storage: "EXTERNAL_APPEND_ONLY",
      controller: "NONE",
      evidence_store: "EXTERNAL_EVENT_DAG_ONLY"
    },
    limits: { ...limit, usage_receipt: 1, value_reconciliation: 1, pre_review_seal: 1 },
    non_goals: [
      "product truth",
      "formal writer",
      "settlement",
      "score",
      "rank",
      "raw graph dump",
      "second evidence store",
      "global controller",
      "development value without actual action"
    ]
  };
  return canonicalize(envelope);
}

/** Seal a deterministic receipt for human pre-review, never for Product approval. */
export function sealPreReviewDecision(input = {}) {
  const value = requireObject(input, "pre-review seal");
  const receipt = value.receipt ?? value.usage_receipt ?? value.usageReceipt;
  validateReceiptHash(receipt);
  const decision = value.decision ?? value.pre_review_decision ?? value.preReviewDecision;
  requireObject(decision, "decision");
  const policy = normalizeSecretPolicy(value);
  const redactions = [];
  const sanitizedDecision = canonicalize(
    sanitizeValue(decision, { policy, path: "$.decision", redactions, seen: new WeakSet() })
  );
  const sealBase = {
    schema_version: "SIMWAR_KG_PRE_REVIEW_SEAL_V1",
    authority: DERIVED_AUTHORITY,
    status: "PRE_REVIEW_SEALED",
    receipt_hash: receipt.receipt_hash,
    decision_hash: sha256(sanitizedDecision),
    decision: sanitizedDecision,
    redactions: [...new Set(redactions)].sort(),
    approval: "NOT_GRANTED",
    product_truth_write: false,
    formal_writer: false,
    settlement_mutation: false
  };
  const seal = { ...sealBase, seal_hash: sha256(sealBase) };
  return seal;
}
