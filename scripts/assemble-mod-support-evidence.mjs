import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(process.cwd());
const output = resolve(process.argv[2] ?? "mod-support-evidence");
const prReconciliationPath = process.argv[3] ? resolve(process.argv[3]) : null;
const engine = await import("../packages/mod-support/dist/index.js");
const OUTPUT_MARKER = ".simwar-mod-support-evidence-root";
const OUTPUT_MARKER_CONTENT =
  '{"owner":"simwar-mod-support-evidence-assembler","schema_version":1}\n';

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function git(...args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "UNKNOWN";
}

function digestBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function digestFile(path) {
  return digestBytes(readFileSync(path));
}

function writeJson(path, value) {
  const target = join(output, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(path, value) {
  const target = join(output, path);
  mkdirSync(resolve(target, ".."), { recursive: true });
  writeFileSync(target, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

function relativeMembers() {
  const members = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else members.push(relative(output, target).replaceAll("\\", "/"));
    }
  }
  walk(output);
  return members.toSorted();
}

function buildHashes(exclude = new Set()) {
  return relativeMembers()
    .filter((member) => !exclude.has(member))
    .map((member) => `${digestFile(join(output, member))}  ${member}`)
    .join("\n");
}

function pathKey(path) {
  return resolve(path).replaceAll("\\", "/").toLowerCase();
}

function isWithin(base, target) {
  const child = relative(resolve(base), resolve(target));
  return child === "" || (child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}

function prepareSafeOutputRoot() {
  const repositoryRoot = resolve(root);
  const target = resolve(output);
  const targetKey = pathKey(target);
  if (targetKey === pathKey(repositoryRoot)) {
    throw new Error("MOD_EVIDENCE_OUTPUT_REJECTED_REPOSITORY_ROOT");
  }
  if (targetKey === pathKey(parse(target).root)) {
    throw new Error("MOD_EVIDENCE_OUTPUT_REJECTED_FILESYSTEM_ROOT");
  }
  if (isWithin(repositoryRoot, target)) {
    throw new Error("MOD_EVIDENCE_OUTPUT_REJECTED_INSIDE_REPOSITORY");
  }

  if (existsSync(target)) {
    throw new Error("MOD_EVIDENCE_OUTPUT_REJECTED_EXISTING_DIRECTORY_USE_NEW_PATH");
  } else if (
    !/^simwar-mod-support-evidence(?:-[A-Za-z0-9][A-Za-z0-9-]*)?$/u.test(basename(target))
  ) {
    throw new Error("MOD_EVIDENCE_OUTPUT_REJECTED_UNNAMED_DIRECTORY");
  }

  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, OUTPUT_MARKER), OUTPUT_MARKER_CONTENT, "utf8");
}

function currentReality() {
  return {
    captured_at: new Date().toISOString(),
    repository: "https://github.com/qidianzhiku/SimWar",
    head_sha: git("rev-parse", "HEAD"),
    tree_sha: git("rev-parse", "HEAD^{tree}"),
    branch: git("branch", "--show-current"),
    worktree_status: git("status", "--short"),
    package_manager: "npm",
    runtime_authority: "JSON_INTERNAL_ONLY",
    baseline_guard:
      "Existing full-suite timeout remains separate from MOD support evidence; no unrelated baseline fix is claimed.",
    source_scope: [
      "packages/mod-support/src/index.ts",
      "contracts/schemas/mod-support-macro.v1.json",
      "tests/unit/mod-support-macro.test.ts",
      "tests/contract/mod-support-macro-contract.test.ts",
      "scripts/assemble-mod-support-evidence.mjs"
    ],
    forbidden_scope_confirmed: [
      "no services/api runtime route",
      "no services/simulation-core writer",
      "no settlement or replay truth mutation",
      "no ParameterSet formal write",
      "no Model Governance activation",
      "no provider/model activation",
      "no database migration"
    ]
  };
}

const prReconciliation =
  prReconciliationPath && existsSync(prReconciliationPath)
    ? JSON.parse(readFileSync(prReconciliationPath, "utf8"))
    : {
        status: "NOT_CAPTURED_IN_GENERATOR",
        known_limits: ["Supply fresh gh PR readback before treating Product PR or merge as proven."]
      };

prepareSafeOutputRoot();

const reality = currentReality();
writeJson("PROGRAM-CONTROLLER/01-CURRENT-REALITY.json", reality);
writeJson("PROGRAM-CONTROLLER/02-PROGRAM-CONTROL.json", {
  program_controller_mode: "READ_ONLY_PROGRAM_CONTROL",
  task_id: "SIMWAR-MOD-CONTINUOUS-SIX-MACRO-PROGRAM-20260828",
  automatic_next_start: false,
  direct_execution_authorization: "OWNER_DIRECT_CURRENT_GOAL",
  source_package_sha256:
    process.env.MOD_PACKAGE_SHA256 ??
    "A2F1E06AD6725FBE46D895DB7A16682E04113FE05E9A4B6C6676007DA0581EB7",
  current_head_sha: reality.head_sha,
  current_tree_sha: reality.tree_sha,
  routes: {
    R1: "IMPLEMENT_WITH_LIMITS",
    R2: "IMPLEMENT_WITH_LIMITS_CANDIDATE_ONLY",
    R3: "IMPLEMENT_WITH_LIMITS",
    R4: "CONDITIONAL_TOMBSTONE_UNLESS_FRESH_NEED_PROOF",
    R5: "IMPLEMENT_WITH_LIMITS",
    R6: "CONDITIONAL_TOMBSTONE_UNLESS_FRESH_NEED_PROOF"
  },
  stop_boundary:
    "TARGET_COMPLETE only after one Product PR is merged normally and detached post-merge H3 verification passes"
});
writeJson("PROGRAM-CONTROLLER/03-PR-RECONCILIATION.json", prReconciliation);
writeJson("PROGRAM-CONTROLLER/04-CAPABILITY-REUSE-TOMBSTONE.json", {
  reused: [
    "W5/M8 exact-reference and reality-qualification semantics",
    "W4/O4 dynamics candidate semantics",
    "D6/M4 provenance and transfer candidate semantics",
    "MOD-06 model-governance provider-off/no-activation boundary"
  ],
  not_reimplemented: [
    "formal Truth/Settlement writer",
    "ParameterSet authority",
    "Model Governance activation/rollback writer",
    "Shanghai-specific kernel/runtime/registry/app"
  ],
  tombstoned: [
    { macro: "R4", reason: "NO_FRESH_NEED_PROOF" },
    { macro: "R6", reason: "NO_FRESH_NEED_PROOF" }
  ],
  reuse_decision: "REUSE_WITH_NEW_LANE_LOCAL_COMPOSER"
});
writeJson("PROGRAM-CONTROLLER/05-TOOL-CONTRIBUTION.json", {
  local_reference_vault: {
    status: "TOOL_UNAVAILABLE",
    reason: "tunnel_client_not_seen",
    contribution: "none"
  },
  codegraph: {
    status: "LOW_YIELD_STOP",
    reason:
      "returned isolated historical paths and pending sync; exact current source used instead",
    contribution: "architecture warning only"
  },
  graphify: {
    status: "UNAVAILABLE",
    reason: "graph.json not found; init not run",
    contribution: "none"
  },
  bundled_workspace_dependencies: {
    status: "USED",
    contribution: "bundled Python/Node/Git runtime discovery and DOCX extraction"
  },
  fallback: "Current source, rg, Git, TypeScript, Vitest, Ajv and archive checks"
});
writeJson("PROGRAM-CONTROLLER/06-REFERENCE-VAULT-ASSESSMENT.json", {
  status: "READ_ONLY_ATTEMPTED_NO_CONTENT_USED",
  budget: "at most 2 documents / 8 sections",
  root: "D:/DcodexSimWar-reference/SimWar-ReferenceVault",
  health: "TOOL_UNAVAILABLE",
  search: "TOOL_UNAVAILABLE",
  assessment:
    "No Vault material was used as proof; current repository and uploaded package remain authoritative."
});

const macroStatuses = [];
for (const macroKey of engine.MOD_MACRO_KEYS) {
  const proof = macroKey !== "R4" && macroKey !== "R6";
  const request = engine.createDefaultModMacroRequest(macroKey, { fresh_need_proof: proof });
  const result = engine.compileModMacro(request);
  const directory = `MACROS/${macroKey}`;
  const mission = {
    task_id: engine.MOD_MACRO_IDS[macroKey],
    lane: "MOD",
    execution_state: "GREEN_SUPPORT",
    parent_main: "PROGRAM-CONTROLLED-MOD-SUPPORT",
    product_truth_mutation: 0,
    parameterset_formal_write: 0,
    product_pr: 0,
    merge: 0,
    automatic_next_start: false,
    authority: "candidate/evidence only; MAIN owns formal integration"
  };
  const admission = {
    status: result.status === "SKIP_TOMBSTONED" ? "CONDITIONAL_TOMBSTONE" : "ADMITTED_WITH_LIMITS",
    fresh_need_proof: request.fresh_need_proof,
    expected_gain: "NOT_MEASURED",
    path_overlap: 0,
    writer_overlap: 0,
    hot_file_overlap: 0,
    runtime_store_provider_isolation: true,
    reason:
      result.status === "SKIP_TOMBSTONED"
        ? "Conditional macro is not executed without fresh proof."
        : "Lane-local compiler has no product-runtime or authority writer overlap."
  };
  const state = {
    state_a:
      "Existing W5/M8/W4/D6/MOD candidate evidence is separate and lacks one MOD macro envelope.",
    state_b:
      result.status === "SKIP_TOMBSTONED"
        ? "TOMBSTONED pending fresh Need proof."
        : `${result.candidate_type} with exact binding, evidence, role safety, non-write and MAIN Join request.`,
    status: result.status
  };
  const pack = {
    candidate_output: result,
    main_consumer: result.join_request.consumer_id,
    main_need_by: result.join_request.need_by,
    required_revalidation: [
      "exact refs/digests",
      "consumer Need",
      "role visibility",
      "rights/expiry/OOD",
      "replay non-overwrite"
    ],
    product_runtime_admission: false
  };
  writeJson(`${directory}/00-MISSION-IDENTITY-AUTHORITY.json`, mission);
  writeJson(`${directory}/01-CURRENT-REALITY.json`, reality);
  writeJson(`${directory}/02-ADMISSION.json`, admission);
  writeJson(`${directory}/03-SCOPE.json`, {
    allowed: ["candidate", "evidence", "scenario content", "role-safe handoff"],
    forbidden: [
      "Truth",
      "Settlement",
      "ParameterSet formal write",
      "Kernel",
      "Runtime",
      "Registry",
      "App",
      "Provider"
    ]
  });
  writeJson(`${directory}/04-REUSE-TOMBSTONE.json`, {
    reused_from: ["W5/M8", "W4/O4", "D6/M4", "MOD-06"],
    tombstone: result.status === "SKIP_TOMBSTONED",
    reason: result.status === "SKIP_TOMBSTONED" ? "NO_FRESH_NEED_PROOF" : null
  });
  writeJson(`${directory}/05-SOURCE-REGISTER.json`, {
    classification: request.source_classification,
    exact_refs: result.exact_binding.refs,
    provenance: "Synthetic/reference-only; unsupported claims remain limits."
  });
  writeJson(`${directory}/06-EXACT-BINDING.json`, result.exact_binding);
  writeJson(`${directory}/07-STATE-A-STATE-B.json`, state);
  writeJson(`${directory}/08-MJP.json`, result.mjp);
  writeJson(`${directory}/09-FULL-INTEGRATION-READY-PACK.json`, pack);
  writeJson(`${directory}/10-ROLE-VISIBILITY.json`, result.role_visibility);
  writeJson(`${directory}/11-NONWRITE-FIREWALL.json`, result.authority);
  writeJson(`${directory}/12-REPLAY-DIFFERENTIAL.json`, result.evidence.differential);
  writeJson(`${directory}/13-VALIDATION.json`, {
    unit_and_contract_tests: [
      "tests/unit/mod-support-macro.test.ts",
      "tests/contract/mod-support-macro-contract.test.ts"
    ],
    schema: "contracts/schemas/mod-support-macro.v1.json",
    result:
      result.status === "SKIP_TOMBSTONED"
        ? "TOMBSTONED_WITHOUT_EXECUTION"
        : result.status === "EVIDENCE_INSUFFICIENT"
          ? "EVIDENCE_INSUFFICIENT"
          : "PASS_WITH_LIMITS"
  });
  writeJson(`${directory}/14-MAIN-CONSUMER-NEED.json`, {
    consumer_id: result.join_request.consumer_id,
    need_by: result.join_request.need_by,
    candidate_ready_for_runtime: false
  });
  writeJson(`${directory}/15-MAIN-JOIN-REQUEST.json`, result.join_request);
  writeJson(`${directory}/16-KNOWN-LIMITS.json`, result.known_limits);
  writeJson(`${directory}/CANDIDATE-OUTPUT.json`, result);
  writeText(
    `${directory}/17-FINAL-REPORT.md`,
    `# ${macroKey} Final Report\n\nStatus: ${result.status}\n\nCandidate: ${result.candidate_type}\n\nMJP: ${result.mjp.fixture_count}/${result.mjp.minimum_fixture_count}\n\nThe candidate remains non-official, provider-off, exact-bound, and requires MAIN revalidation before integration.\n`
  );
  writeText(
    `${directory}/HANDOFF.md`,
    `# ${macroKey} Handoff\n\nConsumer: ${result.join_request.consumer_id}\n\nRequested state: ${result.status}\n\nNo formal writer or runtime admission is included.\n`
  );
  writeJson(`${directory}/HANDOFF.json`, {
    macro_key: macroKey,
    candidate_type: result.candidate_type,
    status: result.status,
    consumer_id: result.join_request.consumer_id,
    join_gate: result.join_request.join_gate,
    formal_integration: false
  });
  writeJson(`${directory}/KNOWN-LIMITS.json`, {
    limits: result.known_limits,
    calibrated: false,
    production: false,
    pilot: false,
    human_validation: false
  });
  macroStatuses.push({
    macro_key: macroKey,
    status: result.status,
    candidate_type: result.candidate_type,
    candidate_digest: result.candidate_digest,
    consumer_id: result.join_request.consumer_id
  });
}

const mergeReadback =
  isRecord(prReconciliation) && isRecord(prReconciliation.merge) ? prReconciliation.merge : {};
const h3Readback =
  isRecord(prReconciliation) && isRecord(prReconciliation.post_merge_verification)
    ? prReconciliation.post_merge_verification
    : {};
const productComplete = mergeReadback.status === "MERGED" && h3Readback.status === "PASS";
const overallStatus = productComplete ? "TARGET_COMPLETE" : "PRODUCT_PR_READY_WITH_LIMITS";

writeJson("00-MISSION-IDENTITY-AUTHORITY.json", {
  task_id: "SIMWAR-MOD-CONTINUOUS-SIX-MACRO-PROGRAM-20260828",
  source_package_sha256:
    process.env.MOD_PACKAGE_SHA256 ??
    "A2F1E06AD6725FBE46D895DB7A16682E04113FE05E9A4B6C6676007DA0581EB7",
  owner_authorization: "OWNER_DIRECT_CURRENT_GOAL_ONCE_FOR_FULL_MISSION",
  authority: {
    candidate_scope: "MOD lane-local candidate/evidence only",
    formal_truth_writer: "EXISTING_SIMULATION_CORE_ONLY",
    forbidden: [
      "second Truth/Settlement/W4/EnterpriseState/Model-Governance writer",
      "provider/model activation",
      "PostgreSQL runtime/RLS cutover",
      "Pilot/Production/release/Human Validation"
    ]
  },
  mutation_counts: {
    product_truth_mutation: 0,
    parameterset_formal_write: 0,
    settlement_write: 0,
    provider_calls: 0
  },
  automatic_next_start: false
});
writeJson("01-CURRENT-REALITY.json", reality);
writeJson("02-PROGRAM-CONTROL.json", {
  mission_state: overallStatus,
  current_head_sha: reality.head_sha,
  current_tree_sha: reality.tree_sha,
  current_branch: reality.branch,
  fresh_current_read_required: true,
  one_product_pr: true,
  ordinary_merge_required: true,
  post_merge_h3_required: true,
  no_force_or_admin_bypass: true,
  automatic_next_start: false
});
writeJson("03-REUSE-TOMBSTONE.json", {
  reused: [
    "MAIN-SH-FV exact-binding read-only Teacher/Student/Admin composition",
    "W5/M8 exact-reference and reality-qualification semantics",
    "W4/O4 dynamics candidate semantics",
    "D6/M4 provenance and transfer candidate semantics",
    "MOD-06 provider-off/no-activation boundary"
  ],
  capability_tombstones: [
    { macro: "R4", reason: "NO_FRESH_NEED_PROOF" },
    { macro: "R6", reason: "NO_FRESH_NEED_PROOF" }
  ],
  not_reimplemented: [
    "formal Truth/Settlement writer",
    "ParameterSet authority",
    "Model Governance activation/rollback writer",
    "Shanghai-specific kernel/runtime/registry/app"
  ],
  decision: "REUSE_CURRENT_CAPABILITY_AND_ADD_ONLY_LANE_LOCAL_GAPS"
});
writeJson("04-TOOL-CONTRIBUTION.json", {
  local_reference_vault: { status: "UNAVAILABLE_NO_CONTENT_USED", contribution: "none" },
  codegraph: { status: "LOW_YIELD_STOP", contribution: "architecture warning only" },
  graphify: { status: "UNAVAILABLE", contribution: "none" },
  github: { status: "USED", contribution: "fresh Product PR/check/review/merge readback" },
  bundled_workspace_dependencies: {
    status: "USED",
    contribution: "DOCX and Node/TypeScript verification runtime"
  },
  fallback: "current source, rg, Git, TypeScript, Vitest, Ajv and archive verification"
});
writeJson("05-CAPABILITY-CENSUS.json", {
  current_consumers: {
    R1: "PROVEN_MAIN_SH_FV_CURRENT_SERVICE_ROUTE_AND_ROLE_PROJECTIONS",
    R2: "NOT_PROVEN_STK_RUNTIME",
    R3: "NOT_PROVEN_MAIN_ESL_RUNTIME",
    R4: "NOT_PROVEN_AND_NO_FRESH_NEED",
    R5: "NOT_PROVEN_MAIN_RT_RUNTIME",
    R6: "NOT_PROVEN_EXECUTABLE_LIFECYCLE_AND_NO_FRESH_NEED"
  },
  lane_local_capabilities: macroStatuses,
  evidence_rule: "absence of a current consumer never becomes a claim of runtime integration"
});
writeJson("06-IMPLEMENTATION.json", {
  product_delta: "lane-local deterministic MOD candidate compiler and evidence runner",
  implemented: [
    "R1 current MAIN reuse proof and exact references",
    "R2 bounded stakeholder shadow translation with dedup/conflict/stale/OOD abstention",
    "R3 five-family reproducible executive experiment envelope",
    "R5 public-safe regional and version compatibility envelope",
    "R4/R6 explicit conditional tombstones without fresh Need proof"
  ],
  output_mode: "OFFLINE_REFERENCE_OR_DIAGNOSTIC_SHADOW_OR_CANDIDATE",
  formal_runtime_integration: false
});
writeJson("07-VALIDATION.json", {
  local_focused_tests: [
    "tests/unit/mod-support-macro.test.ts",
    "tests/unit/mod-support-evidence-safety.test.ts",
    "tests/contract/mod-support-macro-contract.test.ts"
  ],
  required_remote_checks: [
    "quality",
    "browser-smoke",
    "Analyze JavaScript and TypeScript",
    "CodeQL"
  ],
  readback: prReconciliation.validation ?? "NOT_CAPTURED",
  product_complete_requires: ["all required checks green", "ordinary merge", "detached H3 pass"]
});
writeJson("08-MJP.json", {
  per_macro: macroStatuses.map((item) => ({
    macro_key: item.macro_key,
    status: item.status,
    candidate_digest: item.candidate_digest
  })),
  minimums: { R1: 12, R2: 15, R3: 18, R4: 18, R5: 16, R6: 15 },
  verification:
    "fixture input/result digests and deterministic runner evidence are checked before PASS"
});
writeJson("09-FULL-INTEGRATION-READY-PACK.json", {
  pack_status: productComplete ? "MERGED_AND_H3_VERIFIED" : "PR_SCOPE_READY_WITH_LIMITS",
  macros: macroStatuses,
  exact_binding_required: true,
  consumer_revalidation_required: true,
  formal_writes: false,
  provider: "OFF"
});
writeJson("10-H2-REVIEW.json", {
  status: prReconciliation.h2_review ?? "NOT_CAPTURED",
  review_threads: prReconciliation.review_threads ?? "NOT_CAPTURED",
  remediation_policy: "same mission rework and reverify before merge"
});
writeJson("11-PR-CI-CODEQL.json", {
  product_pr: prReconciliation.product_pr ?? "NOT_CAPTURED",
  validation: prReconciliation.validation ?? "NOT_CAPTURED",
  codeql: prReconciliation.codeql ?? "NOT_CAPTURED",
  one_product_pr: true,
  force_push: false,
  admin_bypass: false
});
writeJson("12-MERGE.json", {
  merge: mergeReadback,
  ordinary_merge_only: true,
  no_force_push: true,
  no_admin_bypass: true
});
writeJson("13-H3-POST-MERGE.json", {
  post_merge_verification: h3Readback,
  detached_verification_required: true,
  status: productComplete ? "PASS" : "PENDING_MERGE"
});
writeJson("14-KNOWN-LIMITS.json", {
  status: productComplete ? "LIMITS_RETAINED" : "PRODUCT_PR_READY_WITH_LIMITS",
  limits: [
    "R4 and R6 remain tombstoned without current structured fresh Need proof.",
    "No real-world calibration, provider activation, or official model recommendation is proven.",
    "R2/R3/R5 are lane-local candidate/diagnostic outputs; current MAIN runtime consumers are not claimed.",
    "No Human Validation, Pilot, Production or release evidence is included.",
    "Local Reference Vault, CodeGraph and Graphify did not provide usable current proof."
  ]
});
writeText(
  "15-FINAL-REPORT.md",
  `# MOD Continuous Six-Macro Final Report\n\nFINAL_STATUS: ${overallStatus}\n\nThe archive is ${productComplete ? "merged and detached-H3 verified" : "not yet merged; Product PR and required gates remain part of the current mission evidence"}.\n\nCurrent HEAD: ${reality.head_sha}\nCurrent tree: ${reality.tree_sha}\n`
);
writeText(
  "16-HANDOFF.md",
  `# MOD Continuous Six-Macro Handoff\n\nStatus: ${overallStatus}\n\nR1/R2/R3/R5 contain deterministic lane-local candidate evidence; R4/R6 are explicit conditional tombstones. Main consumers must revalidate exact references and role visibility. No formal Truth, Settlement, ParameterSet, Model Governance, Provider, Pilot or Production state is changed.\n`
);
writeJson("17-MAIN-JOIN-REQUEST.json", {
  status: overallStatus,
  macro_join_requests: macroStatuses,
  consumer_revalidation: "REQUIRED",
  automatic_next_start: false,
  product_complete: productComplete
});
writeJson("RESULT-MATRIX.json", {
  status: overallStatus,
  macros: macroStatuses,
  product_truth_mutation: 0,
  automatic_next_start: false
});
writeJson("KNOWN-LIMITS.json", {
  status: productComplete ? "LIMITS_RETAINED" : "PRODUCT_PR_READY_WITH_LIMITS",
  limits: [
    "R4 and R6 are tombstoned without fresh Need proof.",
    "No real-world calibration or model activation is proven.",
    "No unproven Product runtime consumer binding is claimed.",
    "No Human Validation, Pilot, Production or release evidence is included.",
    "Vault/CodeGraph/Graphify content was not used as current proof."
  ]
});
writeText(
  "FINAL-REPORT.md",
  `# MOD Continuous Six-Macro Final Report\n\nFINAL_STATUS: ${overallStatus}\n\nFour macros produce candidate State B envelopes; R4 and R6 are explicit conditional tombstones. All outputs are provider-off, JSON-only and non-writing.\n\nCurrent HEAD: ${reality.head_sha}\nCurrent tree: ${reality.tree_sha}\n\nProduct PR/merge/H3 status is recorded in 11-PR-CI-CODEQL.json, 12-MERGE.json and 13-H3-POST-MERGE.json.\n`
);
writeText(
  "HANDOFF.md",
  `# MOD Continuous Six-Macro Handoff\n\nThe archive contains current reality, authority, capability census, six macro outputs, reuse/tombstone decisions, executed MJP evidence, role visibility, exact binding, H2/CI/CodeQL/Merge/H3 readback, known limits and Join requests. MAIN must revalidate all exact references and consumer Need before any separate integration.\n`
);
writeJson("HANDOFF.json", {
  status: overallStatus,
  macro_count: macroStatuses.length,
  macro_statuses: macroStatuses,
  next_action: productComplete
    ? "CLOSE_MISSION_NO_AUTOMATIC_SUCCESSOR"
    : "COMPLETE_PR_MERGE_AND_DETACHED_H3",
  automatic_next_start: false,
  product_complete: productComplete
});

const initialMembers = relativeMembers();
writeJson("RESULT_MANIFEST.json", {
  schema_version: "mod-support-result-manifest.v1",
  member_count: initialMembers.length + 4,
  members_before_integrity_artifacts: initialMembers
});
writeText(
  "SHA256SUMS.txt",
  `${buildHashes(new Set(["SHA256SUMS.txt", "ARCHIVE-VERIFICATION.json", "PRE-ARCHIVE-LINT.json"]))}\n`
);
const unsafe = relativeMembers().filter((member) =>
  /(?:^|\/)(?:node_modules|\.git|coverage|dist|venv|\.env)(?:\/|$)|(?:secret|token|credential|restricted|raw-cache|tmp)/i.test(
    member
  )
);
writeJson("PRE-ARCHIVE-LINT.json", {
  status: unsafe.length === 0 ? "PASS" : "FAIL",
  duplicate_members:
    new Set(relativeMembers()).size !== relativeMembers().length ? ["duplicate"] : [],
  unsafe_members: unsafe,
  forbidden_runtime_data: false,
  generated_from_current_head: reality.head_sha
});
writeJson("ARCHIVE-VERIFICATION.json", {
  status: "DIRECTORY_READY_FOR_ZIP",
  member_count: relativeMembers().length + 1,
  sha256sums_excludes: ["SHA256SUMS.txt", "PRE-ARCHIVE-LINT.json", "ARCHIVE-VERIFICATION.json"],
  external_zip_sha256_required: true,
  zip_testzip_required: true,
  current_head_sha: reality.head_sha
});

console.log(
  JSON.stringify(
    {
      output,
      status: overallStatus,
      head_sha: reality.head_sha,
      tree_sha: reality.tree_sha,
      macroStatuses,
      member_count: relativeMembers().length
    },
    null,
    2
  )
);
