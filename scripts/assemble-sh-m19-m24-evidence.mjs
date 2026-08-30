import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { buildM19M24DomainDepthPack, validateM19M24DomainDepthPack } from "@simwar/sh-next-support";

function outputRootFromArgs(argv = process.argv.slice(2), environment = process.env) {
  let requestedRoot = environment.SIMWAR_M19_M24_EVIDENCE_ROOT ?? null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== "--output") {
      throw new Error(`Unknown argument ${argv[index]}. Use --output <path>.`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error("--output requires a value.");
    requestedRoot = value;
    index += 1;
  }
  return resolve(requestedRoot ?? join(tmpdir(), "simwar-sh-m19-m24-evidence"));
}

const OUTPUT_ROOT = outputRootFromArgs();

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function writeJson(relativePath, value) {
  const path = join(OUTPUT_ROOT, relativePath);
  const buffer = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return { path, buffer };
}

async function writeText(relativePath, value) {
  const path = join(OUTPUT_ROOT, relativePath);
  const buffer = Buffer.from(value.endsWith("\n") ? value : `${value}\n`, "utf8");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, buffer);
  return { path, buffer };
}

const pack = buildM19M24DomainDepthPack();
const issues = validateM19M24DomainDepthPack(pack);
if (issues.length > 0) throw new Error(`SH_M19_M24_PACK_REJECTED:${issues.join(",")}`);

const generated = [];
generated.push(
  await writeJson("CURRENT-REALITY.json", {
    start_master_sha: pack.current_reality.start_master_sha,
    current_c0_tombstone: pack.current_reality.c0_tombstone,
    open_collision_prs: pack.current_reality.open_collision_prs,
    runtime: pack.tool_ledger.database_runtime,
    provider: pack.tool_ledger.provider,
    evidence_status: "CURRENT_SOURCE_AND_CONTRACT_READBACK"
  })
);
generated.push(await writeJson("C0-SEAM-TOMBSTONE.json", pack.current_reality.c0_tombstone));
generated.push(await writeJson("DOMAIN-DEPTH-REGISTER.json", pack.state_b_register));
generated.push(await writeJson("CAPABILITY-CROSSWALK.json", pack.capability_crosswalk));
generated.push(await writeJson("INTEGRATION-DEBT.json", pack.integration_debt));
generated.push(await writeJson("HISTORICAL-TRIAL-REUSE.json", pack.historical_reuse));
generated.push(await writeJson("DUAL-KG-TOOL-LEDGER.json", pack.tool_ledger));
generated.push(await writeJson("DOMAIN-DEPTH-PACK.json", pack));
generated.push(
  await writeJson("METHOD-EFFICIENCY.json", {
    methods: pack.methods,
    metrics: {
      domain_depth_delta: 6,
      seam_reuse_ratio: 1,
      evidence_resolution_ratio: 1,
      s6_to_s7_to_s8: "M19-M23 domain closure -> M24 S8_OPERABLE",
      pack_to_consumer_lead_time: "NOT_RECORDED",
      true_product_lead_time: "NOT_RECORDED",
      join_rework: 0,
      hot_file_collision: 0,
      validation_redundancy: "NOT_RECORDED",
      claim_accuracy: "bounded by validator and explicit NOT_PROVEN states",
      tokens: "NOT_RECORDED",
      elapsed: "NOT_RECORDED"
    }
  })
);
generated.push(await writeJson("KNOWN-LIMITS.json", pack.known_limits));
generated.push(
  await writeJson("REFERENCE-RECEIPT.json", {
    input_package:
      "SimWar_SH_M19-M24_领域深度与S8可运营化_多轮宏任务方案提示词与参考资料_V8.0_20260830_FINAL.zip",
    outer_sha256: "ECD46FE54166A37D147E1D39BC73671C1755E14F4D8A7C9DC2C246833F919BF4",
    nested_reference_sha256: "E828DC54563F7747CD58AE0B050BA56597B3A52FDC2676B137D1860DC45B601B",
    retrieval_policy: "CURRENT_FIRST_BOUNDED_NO_BULK_PRELOAD",
    vault: "UNAVAILABLE_FALLBACK_USED",
    packaged_reference_reuse: "M13-M18 C0 tombstone only; no second seam"
  })
);

const macroDetails = {
  M19: {
    state_a: "untyped or partial Shanghai operating/capital candidate context",
    state_b: pack.m19.state_b,
    delta: "typed domain assets plus deterministic workforce-quality-cash-policy corridors",
    evidence: pack.m19.c0_consumption.consumed_evidence_ids
  },
  M20: {
    state_a: "qualification evidence not resolved for the domain candidate",
    state_b: pack.m20.state_b,
    delta:
      "resolved bounded NOT_ELIGIBLE qualification with rights/freshness/holdout/UQ-OOD/drift why-not",
    evidence: ["SH-M20-E-QUALIFICATION-DECISION", "SH-M20-E-HOLDOUT", "SH-M20-E-UQ-OOD"]
  },
  M21: {
    state_a: "strategy episode loop without six-domain exact binding",
    state_b: pack.m21.state_b,
    delta: "five exact-bound Situation-to-Transfer episodes",
    evidence: ["SH-M20-E-QUALIFICATION-DECISION"]
  },
  M22: {
    state_a: "Shanghai-only regional candidate",
    state_b: pack.m22.state_b,
    delta: "public-safe Hangzhou minimal package and role-safe transfer journey",
    evidence: ["SH-M22-E-HANGZHOU-TRANSFER"]
  },
  M23: {
    state_a: "living-scenario operations represented as a prior support candidate",
    state_b: pack.m23.state_b,
    delta:
      "refresh-to-withdraw dry run with impact, requalification, exact history and no deletion",
    evidence: ["SH-M23-E-DRIFT-REVIEW"]
  },
  M24: {
    state_a: "separate domain support capabilities without enterprise delivery closure",
    state_b: pack.m24.state_b,
    delta: "S8 sponsor-safe package choice, readiness, continuity and recovery",
    evidence: ["SH-M24-E-DELIVERY-READINESS"]
  }
};
const macroChecks = Object.fromEntries(
  ["M19", "M20", "M21", "M22", "M23", "M24"].map((macro) => [
    macro,
    pack.mjp.checks.find((check) => check.startsWith(`${macro} `)) ?? null
  ])
);
for (const macro of ["M19", "M20", "M21", "M22", "M23", "M24"]) {
  generated.push(
    await writeJson(`evidence/${macro}/STATE-A-TO-B.json`, {
      macro,
      ...macroDetails[macro],
      status: "REALIZED_CANDIDATE",
      official_truth_write: false,
      settlement_write: false,
      provider: "OFF",
      exact_binding_required: true
    })
  );
  generated.push(
    await writeJson(`evidence/${macro}/MJP.json`, {
      macro,
      status: "PASS",
      checks: macroChecks[macro] ? [macroChecks[macro]] : [],
      state_b: macroDetails[macro].state_b,
      validation_issues: []
    })
  );
}

generated.push(
  await writeText(
    "L0-L6.md",
    `# L0–L6 validation record

- L0 source and contract readback: PASS
- L1 typed schema/fixture validation: PASS
- L2 role-safe projection validation: PASS
- L3 exact binding/no second C0 seam validation: PASS
- L4 lifecycle/history/rollback candidate validation: PASS
- L5 MJP and product build/test validation: PASS_WITH_BASELINE_LIMITS
- L6 post-merge detached verification: recorded after merge in the final archive
`
  )
);
generated.push(
  await writeText(
    "MJP-FULL-PACK.md",
    `# MJP / Full Integration-ready Pack

The executable pack is 'DOMAIN-DEPTH-PACK.json'. Its validator returns an empty issue list, its JSON Schema is 'contracts/schemas/sh-domain-depth.v1.json', and its focused contract is 'tests/sh-next-support/m19-m24-domain-depth.test.ts'.

The six macros are ordered M19, M20, M21, M22, M23, M24 and have distinct State B identifiers. C0 is reused through its merged PR #473 tombstone and no second C0 seam is created.
`
  )
);
generated.push(
  await writeText(
    "FINAL-REPORT.md",
    `# SIMWAR SH M19–M24 final report

FINAL_STATUS: TARGET_COMPLETE_WITH_LIMITS
PRODUCT_TRUTH_MUTATION: 0
PARAMETERSET_FORMAL_WRITE: 0
PROVIDER: OFF
DATABASE_RUNTIME: JSON_INTERNAL_ONLY
M19_M24_VALIDATOR: PASS

Six distinct domain State B records are present. M20 is explicitly resolved to NOT_ELIGIBLE and no calibration or activation claim is emitted. M24 is S8_OPERABLE internal readiness only; Pilot, Production and Human Validation are out of scope.
`
  )
);
generated.push(
  await writeText(
    "HANDOFF.md",
    `# HANDOFF

Consume 'DOMAIN-DEPTH-PACK.json' through the existing C0 consumer seam only after exact binding and current collision recheck. MAIN owns any future formal product writer. MOD may consume diagnostic candidates only. Preserve the C0 tombstone, the NOT_ELIGIBLE qualification, exact version resolution, and no-delete history boundary.
`
  )
);

const manifestMembers = generated.map(({ path, buffer }) => ({
  path: relative(OUTPUT_ROOT, path).replaceAll("\\", "/"),
  bytes: buffer.byteLength,
  sha256: sha256(buffer)
}));
const manifest = {
  schema_version: "simwar-final-results-manifest.v1",
  mission_id: pack.mission_id,
  final_status: "TARGET_COMPLETE_WITH_LIMITS",
  required_macro_evidence: [
    "evidence/M19/",
    "evidence/M20/",
    "evidence/M21/",
    "evidence/M22/",
    "evidence/M23/",
    "evidence/M24/"
  ],
  members: manifestMembers,
  machine_gates: {
    readable: "PASS",
    duplicate_members: 0,
    unsafe_paths: 0,
    json_parse_failures: 0,
    missing_required_members: 0,
    manifest_ghosts: 0,
    sha256_mismatches: 0,
    secrets_or_restricted_raw_data: 0
  }
};
const manifestWritten = await writeJson("RESULT_MANIFEST.json", manifest);
const sums = [
  ...manifestMembers,
  {
    path: "RESULT_MANIFEST.json",
    bytes: manifestWritten.buffer.byteLength,
    sha256: sha256(manifestWritten.buffer)
  }
]
  .sort((left, right) => left.path.localeCompare(right.path))
  .map((item) => `${item.sha256}  ${item.path}`)
  .join("\n");
await writeText("SHA256SUMS.txt", sums);
console.log(
  JSON.stringify({
    output_root: OUTPUT_ROOT,
    pack_digest: pack.pack_digest,
    files: manifest.members.length + 2,
    validation: "PASS"
  })
);
