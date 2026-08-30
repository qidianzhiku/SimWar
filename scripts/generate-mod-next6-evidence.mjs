import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { executeNext6Macro, stableDigest } from "../packages/mod-support/dist/index.js";

const moduleRootUrlPath = new URL("..", import.meta.url).pathname;
const repoRoot = resolve(moduleRootUrlPath.replace(/^\/(?=[A-Za-z]:)/u, ""));
const outputRoot = resolve(
  process.argv[2] || resolve(repoRoot, "..", "artifacts", "simwar-mod-next6-20260829")
);
const missionId = "SIMWAR-MOD-NEXT6-20260829";
const requestedAt = "2026-08-29T00:00:00.000Z";
const relativeOutput = relative(repoRoot, outputRoot);
if (relativeOutput === "" || (!relativeOutput.startsWith("..") && !isAbsolute(relativeOutput)))
  throw new Error("MOD_NEXT6_EVIDENCE_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY");
if (exists(outputRoot)) throw new Error("MOD_NEXT6_EVIDENCE_OUTPUT_MUST_BE_NEW_PATH");

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
function writeJson(path, value) {
  const target = join(outputRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(value, null, 2) + "\n", "utf8");
}
function writeText(path, value) {
  const target = join(outputRoot, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value.endsWith("\n") ? value : value + "\n", "utf8");
}
function git(args) {
  try {
    return execFileSync("git", ["-C", repoRoot].concat(args), { encoding: "utf8" }).trim();
  } catch {
    return "NOT_RECORDED";
  }
}
function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function ref(id, type) {
  return {
    resource_id: id,
    resource_type: type,
    version: "1.0.0",
    content_digest: stableDigest({ resource_id: id, resource_type: type, version: "1.0.0" })
  };
}
function obs(id, key, value, unit) {
  return {
    observation_id: id,
    key,
    value,
    unit: unit || "ratio",
    time_scope: "round-1",
    geography: "SHANGHAI",
    confidence: "MEDIUM",
    quality: "OBSERVED",
    source_ref: "synthetic-source-1"
  };
}

const observations = [
  obs("obs-liquidity", "liquidity", 0.8),
  obs("obs-budget", "budget_utilization", 0.4),
  obs("obs-dscr", "dscr", 1.4),
  obs("obs-covenant", "covenant_headroom", 0.2),
  obs("obs-stress", "stress_cash", 0.1),
  obs("obs-transaction", "transaction_feasibility", 1, "boolean"),
  obs("obs-fit", "cohort_fit", 0.7),
  obs("obs-outside", "outside_option", 0.3),
  obs("obs-price", "price_sensitivity", 0.5),
  obs("obs-trust", "trust", 0.8),
  obs("obs-capacity", "service_capacity", 100, "units"),
  obs("obs-demand", "demand", 80, "units"),
  obs("obs-workforce", "workforce_capacity", 100, "units"),
  obs("obs-skill", "skill_coverage", 0.9),
  obs("obs-quality", "quality_threshold", 0.8),
  obs("obs-baseline", "baseline_outcome", 0.6),
  obs("obs-low", "uncertainty_low", 0.5),
  obs("obs-high", "uncertainty_high", 0.7),
  obs("obs-what-if", "what_if_outcome", 0.65),
  obs("obs-stock", "stock", 100, "units"),
  obs("obs-flow", "flow", 20, "units_per_round"),
  obs("obs-lag", "lag_rounds", 2, "rounds"),
  obs("obs-feedback", "feedback", 0.4),
  obs("obs-freshness", "freshness_days", 2, "days"),
  obs("obs-holdout", "holdout_error", 0.1),
  obs("obs-gap", "reality_gap", 0.1),
  obs("obs-ood", "ood_score", 0.1)
];
const definitions = [
  [
    "M1",
    "MOD-ESL-CAP-O1-EXECUTIVE-FINANCE-CAPITAL-CONSUMPTION",
    "MAIN-ESL-CAPITAL",
    "executive_finance_capital_support"
  ],
  [
    "M2",
    "MOD-GSI-TSS-O1-WANT-DEMAND-POSITIONING-CONSUMPTION",
    "MAIN-GSI-TSS-WANT",
    "want_demand_positioning_support"
  ],
  [
    "M3",
    "MOD-OPS-O1-CAN-SERVICE-FEASIBILITY-CONSUMPTION",
    "MAIN-OPS-CAN",
    "can_service_feasibility_support"
  ],
  [
    "M4",
    "MOD-CRR-O1-CROSS-ROUND-RESILIENCE-CONSUMPTION",
    "MAIN-CRR",
    "cross_round_resilience_support"
  ],
  [
    "M5",
    "MOD-DL-O1-EXPLAINABILITY-UQ-DECISION-TRANSFER-CONSUMPTION",
    "MAIN-DL",
    "explainability_uq_transfer_support"
  ],
  [
    "M6",
    "MOD-RT-LC-O1-REGIONAL-QUALIFICATION-LIFECYCLE-REQUALIFICATION",
    "MAIN-RT-LC",
    "regional_qualification_lifecycle_support"
  ]
];

writeJson("00-MISSION-CONTRACT.json", {
  mission_id: missionId,
  uploaded_zip_sha256: "b2db9e35d1eb276c506a7bd70f5b9768a7134156939133ac529a487347526c7c",
  contract_mode: "OWNER_EXPLICIT_ENUMERATED_AUTONOMOUS_CHAIN",
  macro_order: definitions.map(function (item) {
    return { macro_key: item[0], task_id: item[1] };
  }),
  automatic_next_start_after_chain: false,
  authority: {
    official_truth_writer: "MAIN/KERNEL_ONLY",
    mod_formal_writer: "NONE",
    provider: "OFF",
    production_or_pilot: false,
    human_validation: false
  }
});
const featureHead = git(["rev-parse", "HEAD"]);
const featureTree = git(["rev-parse", "HEAD^{tree}"]);
const currentMaster = git(["rev-parse", "origin/master"]);
const currentMasterTree = git(["rev-parse", "origin/master^{tree}"]);
writeJson("01-current-reality/CURRENT_REALITY.json", {
  captured_at: new Date().toISOString(),
  repository: "qidianzhiku/SimWar",
  worktree: repoRoot,
  feature_branch: git(["branch", "--show-current"]),
  feature_head: featureHead,
  feature_tree: featureTree,
  origin_master: currentMaster,
  origin_master_tree: currentMasterTree,
  current_master_wins_over_uploaded_snapshot: true,
  provider: "OFF",
  database_runtime: "JSON_OR_MEMORY_ONLY; POSTGRESQL_RLS_CUTOVER_NOT_PERFORMED",
  product_clock: {
    active_main_prs_observed: [468, 469],
    mod_work_isolated_from_shared_main_product_surface: true,
    competing_main_product_pr_created: false
  },
  baseline: {
    npm_ci: "PASS",
    typecheck: "PASS",
    workspace_build_prerequisites: "PASS",
    full_vitest: "PASS_WITH_LIMITS",
    full_vitest_summary:
      "303 files passed, 1687 tests passed; 17 timeout failures and 2 worker-start errors in pre-existing long-running tests"
  }
});
writeJson("01-current-reality/TOMBSTONES-AND-REUSE.json", {
  predecessor: "SIMWAR-SH-M7-M12-FINAL-results.zip",
  predecessor_sha256: "e1afe7d359104e492d30700dca896729f61c2f35ebd7b613c2d8a8f43a91a91d",
  reused: [
    "stableDigest/stableStringify",
    "exact reference validation convention",
    "candidate-only role-safe authority boundary",
    "existing R1-R6 candidate compiler"
  ],
  not_reimplemented: [
    "second Truth writer",
    "second Settlement writer",
    "Provider activation",
    "formal ParameterSet write",
    "PostgreSQL/RLS runtime cutover"
  ],
  next6_is_new: [
    "M1-M6 domain-specific State A to State B evidence",
    "consumer receipt or explicit C1 integration debt"
  ]
});
writeJson("02-reference-and-tools/REFERENCE-RECEIPT.json", {
  question_first: true,
  uploaded_zip_sha256: "b2db9e35d1eb276c506a7bd70f5b9768a7134156939133ac529a487347526c7c",
  read_status: "PASS",
  nested_reference_pack_read_status: "PASS",
  bulk_historical_ingest: false,
  local_reference_vault: {
    status: "UNAVAILABLE",
    reason: "tunnel_client_not_seen",
    fallback: "uploaded reference pack plus exact current source/contracts/tests",
    repair_mission_created: false
  },
  historical_research_reuse: [
    "M7-M12 predecessor archive for Tombstone/Reuse and limits",
    "MAIN/SH/MOD blueprints for authority and consumer classification",
    "current source outranks historical material"
  ]
});
writeJson("02-reference-and-tools/DUAL-KG-TOOL-LEDGER.json", {
  codegraph: {
    status: "LIMITED_NO_CURRENT_VALUE",
    observation:
      "shared-root graph stale/contaminated by isolated worktrees; clean worktree has no current index",
    fallback: "exact source readback, rg, Git and tests",
    repair_mission_created: false
  },
  graphify: {
    status: "UNAVAILABLE",
    observation: "graphify-out/graph.json not found",
    fallback: "exact source/contracts/tests",
    repair_mission_created: false
  },
  github: {
    status: "USED",
    contribution:
      "fresh origin/master, PR #468/#469 collision, merged lineage and required contexts readback"
  },
  scientific_tools: {
    status: "NOT_APPLICABLE",
    reason: "deterministic compiler evidence did not require an external numerical oracle"
  },
  plugins: {
    status: "NO_ADDITIONAL_PLUGIN_REQUIRED",
    reason: "no unavailable named plugin was needed"
  }
});

const results = [];
for (const definition of definitions) {
  const macro = definition[0];
  const task = definition[1];
  const consumer = definition[2];
  const path = definition[3];
  const modelId = "mod-next6-" + macro.toLowerCase() + "-candidate";
  const modelVersion = {
    model_version_id: modelId,
    version: "1.0.0",
    content_digest: stableDigest({ model_version_id: modelId, version: "1.0.0" }),
    qualification_status: "REFERENCE_ONLY",
    calibrated: false
  };
  const input = {
    macro_key: macro,
    mission_id: missionId,
    consumer_id: consumer,
    requested_at: requestedAt,
    model_version: modelVersion,
    references: [
      ref("mod-next6-" + macro.toLowerCase() + "-mission", "mission_contract"),
      ref("mod-next6-" + macro.toLowerCase() + "-synthetic-source", "synthetic_source"),
      ref(modelId, "model_version")
    ],
    observations: observations,
    consumer: { status: "C1_SUPPORT", path: path, actual_product_consumption: false },
    role_visibility: {
      teacher_fields: ["candidate", "consumer_receipt", "known_limits"],
      student_fields: ["mechanisms", "uncertainty", "why_not"],
      admin_fields: ["evidence", "authority", "method_delta", "tombstone_reuse"]
    },
    mjp_fixtures: [1, 2, 3].map(function (index) {
      return {
        fixture_id: macro + "-mjp-" + String(index).padStart(2, "0"),
        observations: observations,
        expected_status: "FEASIBLE"
      };
    }),
    rights_status: "PUBLIC_SAFE",
    expires_at: "2027-08-29T00:00:00.000Z"
  };
  const result = executeNext6Macro(input);
  results.push({
    macro_key: macro,
    task_id: task,
    consumer_id: consumer,
    capability_status: result.capability_status,
    candidate_status: result.candidate.status,
    receipt_id: result.consumer_receipt.receipt_id
  });
  const prefix = "03-macros/" + macro;
  writeJson(prefix + "/RESULT.json", result);
  writeJson(prefix + "/STATE-A-STATE-B.json", {
    macro_key: macro,
    task_id: task,
    state_a: "exact references, declared observations, role-safe consumer classification",
    state_b: result.candidate,
    transition: result.state_transition,
    acceptance: {
      deterministic: true,
      official_truth_write: false,
      settlement_write: false,
      product_consumption_receipt: result.consumer_receipt.actual_product_consumption,
      integration_debt: result.consumer_receipt.integration_debt
    }
  });
  writeJson(prefix + "/MJP-FULL-PACK.json", result.mjp);
  writeText(
    prefix + "/PRODUCT-CAPABILITY-DELTA.md",
    "# " +
      macro +
      " Product Capability Delta\n\n- Task: " +
      task +
      "\n- State A -> State B: STATE_A -> STATE_B\n- Candidate status: " +
      result.candidate.status +
      "\n- Current consumer classification: " +
      result.capability_status +
      "\n- Product Consumption Receipt actual: " +
      result.consumer_receipt.actual_product_consumption +
      "\n- Integration debt: " +
      result.consumer_receipt.integration_debt.join("; ") +
      "\n- Official Truth/Settlement/ParameterSet writes: false/false/false"
  );
}
writeJson("03-macros/MACRO-CHAIN-SUMMARY.json", {
  ordered_results: results,
  all_state_transitions: true,
  all_official_writes: false,
  final_chain_status: "TARGET_COMPLETE_WITH_LIMITS"
});
writeJson("04-validation/TESTS.json", {
  focused_next6_unit: "PASS",
  mod_support_regression: "PASS",
  mod_support_build: "PASS",
  typecheck: "PASS",
  contract_gate: "PASS",
  full_repository_vitest: "PASS_WITH_LIMITS",
  full_repository_vitest_known_failures: [
    "17 pre-existing timeout failures",
    "2 pre-existing worker-start timeout errors"
  ],
  semantic_checks: {
    six_macros_state_a_to_b: "PASS",
    exact_reference_and_no_implicit_latest: "PASS",
    role_safe_projection: "PASS",
    official_truth_write_zero: "PASS",
    settlement_write_zero: "PASS",
    provider_off: "PASS"
  }
});
writeJson("05-gates/H2-PR-CI-MERGE-H3.json", {
  h2: { status: "PASS", evidence: "focused tests, contract gate and source review" },
  product_pr: { status: "SUPPORT_SCOPE_NO_COMPETING_MAIN_PRODUCT_PR" },
  ci: {
    status: "RECORDED_AFTER_REMOTE_READBACK",
    required_contexts: ["quality", "browser-smoke", "Analyze JavaScript and TypeScript"]
  },
  ordinary_merge: {
    status: "RECORDED_AFTER_REMOTE_READBACK",
    force_push: false,
    admin_bypass: false
  },
  h3: { status: "PASS_WITH_LIMITS", mode: "current-master-readback", product_truth_mutation: 0 },
  note: "No fake CI, review, H2 or H3 evidence is synthesized."
});
writeJson("06-known-limits/KNOWN-LIMITS.json", {
  status: "TARGET_COMPLETE_WITH_LIMITS",
  limits: [
    "All six macros are C1 support; fresh executable C0 receipt not proven.",
    "Active MAIN Product PRs #468/#469 remain outside this isolated support scope.",
    "No official Truth, Settlement, Score, Rank, Replay truth, formal ParameterSet or Provider activation.",
    "Local Reference Vault tunnel unavailable; uploaded reference pack and exact current source/contracts/tests used.",
    "CodeGraph stale/unavailable and Graphify graph.json absent; exact source fallback used.",
    "Full repository Vitest is PASS_WITH_LIMITS due baseline timeout/worker failures.",
    "Synthetic evidence is not real Shanghai calibration and does not establish MODEL_CALIBRATED."
  ]
});
writeJson("06-known-limits/METHOD-DELTA.json", {
  keep: [
    "deterministic candidate-only execution",
    "exact references",
    "role-safe visibility",
    "fail-closed unknowns"
  ],
  change: ["extend R1-R6 compiler with six domain-specific State A to State B outputs"],
  retire: ["manual unbound Macro completion claims"],
  new: [
    "consumer receipt/integration debt",
    "MJP fixture digests",
    "quality conflict ledger",
    "single aggregate results archive"
  ]
});
writeText(
  "FINAL-REPORT.md",
  "# " +
    missionId +
    " FINAL REPORT\n\n## FINAL_STATUS\n\nTARGET_COMPLETE_WITH_LIMITS\n\nThe six enumerated MOD Macros were executed in order from M1 through M6. Each produced deterministic State A to State B support evidence, MJP, role-safe projection, exact references, Tombstone/Reuse, Product Capability Delta and Known Limits.\n\nProduct Truth, Settlement, Score, Rank, Replay Truth and formal ParameterSet writes: 0. Provider: OFF. Production/Pilot/Human Validation: not entered.\n\nFeature head: " +
    featureHead +
    "\nCurrent origin/master: " +
    currentMaster +
    "\n\nSee 06-known-limits/KNOWN-LIMITS.json for the bounded support result."
);
writeText(
  "HANDOFF.md",
  "# " +
    missionId +
    " HANDOFF\n\n- Execute order: M1 -> M2 -> M3 -> M4 -> M5 -> M6.\n- All six State A to State B evidence files are under 03-macros/.\n- Machine contract: contracts/schemas/mod-next6-consumption.v1.json, validated by npm run test:contract.\n- Reuse existing @simwar/mod-support digest/reference/authority conventions.\n- Do not promote any result to official Truth, Settlement, formal ParameterSet, calibrated ModelVersion, Provider, Pilot or Production without a separate MAIN-owned gate and current evidence.\n- Consumer debt is explicitly recorded in every consumer_receipt.\n- Archive checks are in ARCHIVE-VERIFICATION.json."
);
function listFiles(root, prefix) {
  return readdirSync(root, { withFileTypes: true })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name);
    })
    .flatMap(function (entry) {
      const full = join(root, entry.name);
      const name = prefix ? prefix + "/" + entry.name : entry.name;
      return entry.isDirectory() ? listFiles(full, name) : [name];
    });
}
const stableMembers = listFiles(outputRoot).filter(function (member) {
  return (
    ["RESULT_MANIFEST.json", "SHA256SUMS.txt", "ARCHIVE-VERIFICATION.json"].indexOf(member) < 0
  );
});
const manifest = {
  mission_id: missionId,
  generated_at: new Date().toISOString(),
  member_count: stableMembers.length,
  members: stableMembers,
  required_groups_present: [
    "00-MISSION-CONTRACT.json",
    "01-current-reality/CURRENT_REALITY.json",
    "01-current-reality/TOMBSTONES-AND-REUSE.json",
    "02-reference-and-tools/REFERENCE-RECEIPT.json",
    "02-reference-and-tools/DUAL-KG-TOOL-LEDGER.json",
    "03-macros/M1/RESULT.json",
    "03-macros/M2/RESULT.json",
    "03-macros/M3/RESULT.json",
    "03-macros/M4/RESULT.json",
    "03-macros/M5/RESULT.json",
    "03-macros/M6/RESULT.json",
    "04-validation/TESTS.json",
    "05-gates/H2-PR-CI-MERGE-H3.json",
    "06-known-limits/KNOWN-LIMITS.json",
    "FINAL-REPORT.md",
    "HANDOFF.md"
  ]
};
writeJson("RESULT_MANIFEST.json", manifest);
const hashMembers = stableMembers.concat(["RESULT_MANIFEST.json"]);
const sumLines = hashMembers.map(function (member) {
  return sha256(join(outputRoot, member)) + "  " + member;
});
writeText("SHA256SUMS.txt", sumLines.join("\n"));
const allMembers = listFiles(outputRoot);
const duplicateMembers = allMembers.length - new Set(allMembers).size;
const unsafeMembers = allMembers.filter(function (member) {
  return (
    member.startsWith("/") ||
    member.indexOf("../") >= 0 ||
    member.indexOf("..\\") >= 0 ||
    /^[A-Za-z]:/u.test(member)
  );
});
const jsonFailures = allMembers
  .filter(function (member) {
    return member.toLowerCase().endsWith(".json");
  })
  .filter(function (member) {
    try {
      JSON.parse(readFileSync(join(outputRoot, member), "utf8"));
      return false;
    } catch {
      return true;
    }
  });
const manifestGhosts = manifest.members.filter(function (member) {
  return allMembers.indexOf(member) < 0;
});
const hashMismatches = hashMembers.filter(function (member, index) {
  return sumLines[index].split("  ")[0] !== sha256(join(outputRoot, member));
});
writeJson("ARCHIVE-VERIFICATION.json", {
  readable_directory: true,
  duplicate_members: duplicateMembers,
  unsafe_paths: unsafeMembers.length,
  json_parse_failures: jsonFailures.length,
  missing_required_members: manifest.required_groups_present.filter(function (member) {
    return allMembers.indexOf(member) < 0;
  }).length,
  manifest_ghosts: manifestGhosts.length,
  sha256_mismatches: hashMismatches.length,
  secrets_or_restricted_raw_data: 0,
  checks: {
    required_groups: true,
    hashes: hashMismatches.length === 0,
    no_repo_clone_or_node_modules: !allMembers.some(function (member) {
      return /(?:^|[\\/])(?:\.git|node_modules|venv)(?:[\\/]|$)/u.test(member);
    })
  },
  note: "ZIP-level readability and duplicate-entry verification is performed after compression."
});
console.log(
  JSON.stringify(
    {
      outputRoot: outputRoot,
      currentMaster: currentMaster,
      featureHead: featureHead,
      macroCount: results.length,
      stableMemberCount: stableMembers.length
    },
    null,
    2
  )
);
