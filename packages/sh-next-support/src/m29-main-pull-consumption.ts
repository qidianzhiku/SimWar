import { stableDigest } from "./index.js";
import {
  buildM25PublicSourceRealityEvidenceEpochPack,
  validateM25PublicSourceRealityEvidenceEpochPack
} from "./m25-public-source-evidence.js";
import {
  buildM27SecondCityTransferRequalificationPack,
  validateM27SecondCityTransferRequalificationPack
} from "./m27-second-city-transfer.js";
import {
  buildM28DualEpochLivingOperationsPack,
  validateM28DualEpochLivingOperationsPack
} from "./m28-dual-epoch-operations.js";

export const M29_MAIN_PULL_SCHEMA_VERSION = "sh-main-pull-consumption.v1" as const;
export const M29_CURRENT_MASTER_SHA = "8897934f7cf79a0b650105dc9b8569279da3954c" as const;
export const M29_MISSION_ID = "SIMWAR-SH-M29-MAIN-PULL-SOURCE-BACKED-CONSUMPTION" as const;

type M29Role = "teacher" | "student" | "admin" | "enterprise";

export interface M29MainPullConsumptionPack {
  schema_version: typeof M29_MAIN_PULL_SCHEMA_VERSION;
  mission_id: typeof M29_MISSION_ID;
  state_a: {
    name: "SOURCE_PACK_WITHOUT_MAIN_PULL_BINDING";
    limitation: string;
  };
  state_b: "SOURCE_BACKED_SHANGHAI_REGIONAL_ENTERPRISE_JOURNEY_MAINLINE_BOUND_WITH_LIMITS";
  state_transition: { from: "STATE_A"; to: "STATE_B" };
  source_pack_refs: {
    m25_epoch: { epoch_id: string; epoch_digest: string; source_epoch_base_sha: string };
    m27_transfer: { transfer_id: string; pack_digest: string; candidate_version: string };
    m28_living_operations: { pack_digest: string; epoch_id: string; epoch_version: string };
  };
  regional_consumption: {
    baseline_region: "Shanghai";
    target_region: "Hangzhou";
    transfer_id: string;
    epoch_id: string;
    epoch_version: string;
    source_reality_class: "PUBLIC_SOURCE_BOUND";
    rights_status: "PUBLIC_REFERENCE_ONLY";
    expires_at: string;
    qualification_status: "LIMITED";
    calibration_evidence: "NOT_PROVEN";
    formal_binding_eligible: false;
    consumption_status: "LOOKAHEAD_READY";
    exact_binding_required: true;
    required_rechecks: string[];
    consumption_digest: string;
  };
  enterprise_consumption: {
    scope: "SOURCE_BACKED_ENTERPRISE_CANDIDATE";
    baseline_region: "Shanghai";
    target_region: "Hangzhou";
    source_reality_class: "PUBLIC_SOURCE_BOUND";
    rights_status: "PUBLIC_REFERENCE_ONLY";
    qualification_status: "LIMITED";
    formal_binding_eligible: false;
    private_data_included: false;
    product_consumption_status: "LOOKAHEAD_READY";
    exact_binding_required: true;
    required_rechecks: string[];
    consumption_digest: string;
  };
  role_journey: {
    teacher: { visibility: "TEACHER_ONLY"; journey: string[]; fields: string[] };
    student: {
      visibility: "STUDENT_SAFE";
      journey: string[];
      fields: string[];
      forbidden_fields: string[];
    };
    admin: { visibility: "INTERNAL_RESEARCH_ONLY"; journey: string[]; fields: string[] };
    enterprise: {
      visibility: "RESTRICTED";
      journey: string[];
      fields: string[];
      forbidden_fields: string[];
    };
  };
  main_binding_request: {
    request_id: "SH-M29-MAIN-PULL-BINDING-REQUEST";
    producer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
    consumer: "MAIN";
    shared_contract_owner: "MAIN";
    openapi_owner: "MAIN";
    role_bff_owner: "MAIN";
    formal_writer_owner: "MAIN";
    registry_owner: "MAIN";
    product_pr_owner: "MAIN";
    sh_product_pr_created: false;
    sh_formal_write: false;
    exact_refs: string[];
    request_digest: string;
  };
  product_proof: {
    product_consumption_status: "LOOKAHEAD_READY";
    real_route_proof: "NOT_PROVEN";
    real_service_proof: "NOT_PROVEN";
    real_bff_proof: "NOT_PROVEN";
    browser_proof: "NOT_PROVEN";
    proof_boundary: "SH_SUPPORT_PACK_ONLY_UNTIL_MAIN_PULLS";
    no_second_route: true;
  };
  tombstone_reuse: {
    m19_m24: "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS";
    m23_m28_reused: string[];
    no_second_truth_writer: true;
    no_duplicate_main_consumer: true;
  };
  authority: {
    candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER";
    official_truth_write: false;
    settlement_write: false;
    score_write: false;
    rank_write: false;
    parameter_set_formal_write: false;
    provider: "OFF";
    second_truth_writer: false;
    runtime_authority: "JSON_INTERNAL_ONLY";
  };
  mjp: { status: "PASS"; checks: string[] };
  methods: { keep: string[]; change: string[]; retire: string[]; new: string[] };
  efficiency: {
    upstream_packs_reused: number;
    role_journeys: number;
    route_mutations: number;
    manual_numeric_values: number;
    measured_elapsed_seconds: number | null;
    measurement_status: "NOT_RECORDED";
  };
  known_limits: string[];
  pack_digest: string;
}

function digestWithout<T extends Record<string, unknown>>(value: T, key: keyof T): string {
  return stableDigest(
    Object.fromEntries(Object.entries(value).filter(([entryKey]) => entryKey !== key))
  );
}

function hasFloatingSelector(value: unknown): boolean {
  if (typeof value === "string")
    return /(^|[^a-z])(latest|default|current)([^a-z]|$)/iu.test(value.trim());
  if (Array.isArray(value)) return value.some((item) => hasFloatingSelector(item));
  if (value !== null && typeof value === "object")
    return Object.values(value).some((item) => hasFloatingSelector(item));
  return false;
}

function consumptionDigest(
  input: Omit<M29MainPullConsumptionPack["regional_consumption"], "consumption_digest">
): string {
  return stableDigest(input);
}

function requestDigest(
  input: Omit<M29MainPullConsumptionPack["main_binding_request"], "request_digest">
): string {
  return stableDigest(input);
}

function enterpriseDigest(
  input: Omit<M29MainPullConsumptionPack["enterprise_consumption"], "consumption_digest">
): string {
  return stableDigest(input);
}

export function buildM29MainPullConsumptionPack(): M29MainPullConsumptionPack {
  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  const m27 = buildM27SecondCityTransferRequalificationPack();
  const m28 = buildM28DualEpochLivingOperationsPack();
  if (
    validateM25PublicSourceRealityEvidenceEpochPack(m25).length > 0 ||
    validateM27SecondCityTransferRequalificationPack(m27).length > 0 ||
    validateM28DualEpochLivingOperationsPack(m28).length > 0
  )
    throw new Error("M29_UPSTREAM_SUPPORT_PACK_INVALID");
  if (m27.qualification.status !== "LIMITED") throw new Error("M29_M27_QUALIFICATION_NOT_LIMITED");

  const regionalContent = {
    baseline_region: "Shanghai" as const,
    target_region: "Hangzhou" as const,
    transfer_id: m27.transfer_summary.transfer_id,
    epoch_id: m28.epoch_b.epoch_id,
    epoch_version: m28.epoch_b.version,
    source_reality_class: "PUBLIC_SOURCE_BOUND" as const,
    rights_status: "PUBLIC_REFERENCE_ONLY" as const,
    expires_at: m28.epoch_b.expires_at,
    qualification_status: m27.qualification.status,
    calibration_evidence: "NOT_PROVEN" as const,
    formal_binding_eligible: false as const,
    consumption_status: "LOOKAHEAD_READY" as const,
    exact_binding_required: true as const,
    required_rechecks: [
      "MAIN must resolve the exact regional-transfer.v1 candidate, scenario candidate, source epoch, and living-operations version.",
      "Re-fetch exact public locators and recheck rights, geography, units, target-year, and expiry before formal binding.",
      "Run MAIN-owned shared contract, OpenAPI, role BFF, registry, and product journey validation after pull.",
      "Keep formal ParameterSet, official Truth, Settlement, Score, and Rank writes outside this support request."
    ]
  };
  const regionalConsumption = {
    ...regionalContent,
    consumption_digest: consumptionDigest(regionalContent)
  };
  const enterpriseContent = {
    scope: "SOURCE_BACKED_ENTERPRISE_CANDIDATE" as const,
    baseline_region: "Shanghai" as const,
    target_region: "Hangzhou" as const,
    source_reality_class: "PUBLIC_SOURCE_BOUND" as const,
    rights_status: "PUBLIC_REFERENCE_ONLY" as const,
    qualification_status: "LIMITED" as const,
    formal_binding_eligible: false as const,
    private_data_included: false as const,
    product_consumption_status: "LOOKAHEAD_READY" as const,
    exact_binding_required: true as const,
    required_rechecks: [
      "Confirm the enterprise context is public-safe and contains no private organization, person, team, or unpublished result.",
      "Resolve exact source, epoch, transfer, and scenario versions; reject implicit selectors and expired rights.",
      "MAIN must approve any formal enterprise consumer and retain the candidate-only boundary."
    ]
  };
  const enterpriseConsumption = {
    ...enterpriseContent,
    consumption_digest: enterpriseDigest(enterpriseContent)
  };
  const requestContent = {
    request_id: "SH-M29-MAIN-PULL-BINDING-REQUEST" as const,
    producer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER" as const,
    consumer: "MAIN" as const,
    shared_contract_owner: "MAIN" as const,
    openapi_owner: "MAIN" as const,
    role_bff_owner: "MAIN" as const,
    formal_writer_owner: "MAIN" as const,
    registry_owner: "MAIN" as const,
    product_pr_owner: "MAIN" as const,
    sh_product_pr_created: false as const,
    sh_formal_write: false as const,
    exact_refs: [
      "contracts/schemas/regional-transfer.v1.json",
      "packages/shared-contracts/src/regional-transfer.ts",
      "packages/sh-next-support/src/m25-public-source-evidence.ts",
      "packages/sh-next-support/src/m27-second-city-transfer.ts",
      "packages/sh-next-support/src/m28-dual-epoch-operations.ts"
    ]
  };
  const mainBindingRequest = { ...requestContent, request_digest: requestDigest(requestContent) };
  const content: Omit<M29MainPullConsumptionPack, "pack_digest"> = {
    schema_version: M29_MAIN_PULL_SCHEMA_VERSION,
    mission_id: M29_MISSION_ID,
    state_a: {
      name: "SOURCE_PACK_WITHOUT_MAIN_PULL_BINDING",
      limitation:
        "The preceding SH support packs proved source lineage, second-city requalification, and living operations, but did not establish a MAIN-owned regional or enterprise product consumption request."
    },
    state_b: "SOURCE_BACKED_SHANGHAI_REGIONAL_ENTERPRISE_JOURNEY_MAINLINE_BOUND_WITH_LIMITS",
    state_transition: { from: "STATE_A", to: "STATE_B" },
    source_pack_refs: {
      m25_epoch: {
        epoch_id: m25.source_epoch.epoch_id,
        epoch_digest: m25.source_epoch.epoch_digest,
        source_epoch_base_sha: m25.source_epoch.source_epoch_base_sha
      },
      m27_transfer: {
        transfer_id: m27.transfer_summary.transfer_id,
        pack_digest: m27.pack_digest,
        candidate_version: m27.transfer.candidate_ref.version
      },
      m28_living_operations: {
        pack_digest: m28.pack_digest,
        epoch_id: m28.epoch_b.epoch_id,
        epoch_version: m28.epoch_b.version
      }
    },
    regional_consumption: regionalConsumption,
    enterprise_consumption: enterpriseConsumption,
    role_journey: {
      teacher: {
        visibility: "TEACHER_ONLY",
        journey: [
          "inspect exact source-backed candidate",
          "review diff and qualification limits",
          "request MAIN pull and formal validation"
        ],
        fields: [
          "source_pack_refs",
          "regional_consumption",
          "enterprise_consumption",
          "main_binding_request",
          "known_limits"
        ]
      },
      student: {
        visibility: "STUDENT_SAFE",
        journey: [
          "see bounded Shanghai-to-Hangzhou candidate context",
          "see limited qualification and recheck status",
          "submit learning decision through MAIN-owned flow after binding"
        ],
        fields: [
          "target_region",
          "epoch_version",
          "qualification_status",
          "consumption_status",
          "exact_binding_required"
        ],
        forbidden_fields: [
          "raw_source_excerpt",
          "source_receipt_ids",
          "source_digests",
          "private_project_data",
          "official_truth",
          "settlement",
          "score",
          "rank"
        ]
      },
      admin: {
        visibility: "INTERNAL_RESEARCH_ONLY",
        journey: [
          "audit source and transfer digests",
          "check rights and expiry",
          "approve MAIN pull prerequisites"
        ],
        fields: [
          "source_pack_refs",
          "main_binding_request",
          "product_proof",
          "authority",
          "known_limits"
        ]
      },
      enterprise: {
        visibility: "RESTRICTED",
        journey: [
          "inspect public-safe candidate scope",
          "confirm exact binding and requalification prerequisites",
          "wait for MAIN-owned formal consumer"
        ],
        fields: [
          "scope",
          "target_region",
          "qualification_status",
          "product_consumption_status",
          "exact_binding_required"
        ],
        forbidden_fields: [
          "raw_source_excerpt",
          "private_project_data",
          "official_truth",
          "settlement",
          "score",
          "rank"
        ]
      }
    },
    main_binding_request: mainBindingRequest,
    product_proof: {
      product_consumption_status: "LOOKAHEAD_READY",
      real_route_proof: "NOT_PROVEN",
      real_service_proof: "NOT_PROVEN",
      real_bff_proof: "NOT_PROVEN",
      browser_proof: "NOT_PROVEN",
      proof_boundary: "SH_SUPPORT_PACK_ONLY_UNTIL_MAIN_PULLS",
      no_second_route: true
    },
    tombstone_reuse: {
      m19_m24: "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS",
      m23_m28_reused: [
        "M23 seven-event lifecycle predecessor is reused as read-only lineage.",
        "M25 public-source epoch and exact Shanghai/Hangzhou receipts are reused.",
        "M26 source-bound operating/capital diagnostics are reused without a second finance writer.",
        "M27 regional-transfer.v1 envelope and Hangzhou requalification are reused.",
        "M28 dual-epoch operation and withdrawal/history controls are reused."
      ],
      no_second_truth_writer: true,
      no_duplicate_main_consumer: true
    },
    authority: {
      candidate_writer: "SH_NEXT_SUPPORT_CANDIDATE_COMPILER",
      official_truth_write: false,
      settlement_write: false,
      score_write: false,
      rank_write: false,
      parameter_set_formal_write: false,
      provider: "OFF",
      second_truth_writer: false,
      runtime_authority: "JSON_INTERNAL_ONLY"
    },
    mjp: {
      status: "PASS",
      checks: [
        "M25, M27, and M28 exact digests are cross-bound.",
        "Regional and enterprise journeys are role-safe and candidate-only.",
        "MAIN owns shared contract, OpenAPI, Role BFF, formal writer, registry, Product PR, merge, and H3.",
        "No SH route, service, OpenAPI, BFF, registry, truth, settlement, score, rank, or formal ParameterSet mutation is made.",
        "Real product route/service/BFF/browser proof is explicitly NOT_PROVEN and consumption remains LOOKAHEAD_READY."
      ]
    },
    methods: {
      keep: [
        "exact source and candidate digest lineage",
        "role-safe projection",
        "candidate-only authority",
        "MAIN ownership boundary"
      ],
      change: [
        "source pack handoff to explicit regional and enterprise MAIN pull request",
        "implicit product readiness to explicit LOOKAHEAD_READY proof boundary"
      ],
      retire: ["SH-owned product route claims", "unbounded enterprise consumption claims"],
      new: [
        "MAIN binding request digest",
        "four-role journey matrix",
        "product proof status and no-second-route guard"
      ]
    },
    efficiency: {
      upstream_packs_reused: 3,
      role_journeys: 4,
      route_mutations: 0,
      manual_numeric_values: 0,
      measured_elapsed_seconds: null,
      measurement_status: "NOT_RECORDED"
    },
    known_limits: [
      "This is an SH support-owned binding request and candidate consumption pack; no MAIN product route, service, OpenAPI, Role BFF, registry, or formal writer was changed.",
      "Product route, service, BFF, and browser proof remain NOT_PROVEN until MAIN pulls this request and performs its own product validation.",
      "Regional and enterprise qualification remain LIMITED, calibration_evidence remains NOT_PROVEN, and formal_binding_eligible remains false.",
      "Public reference rights and expiry must be rechecked before any future formal binding; no private or restricted raw source data is included.",
      "No official Truth, Settlement, Score, Rank, ParameterSet, Provider, PostgreSQL/RLS, Pilot, Production, Human Validation, or automatic successor state is written."
    ]
  };
  return { ...content, pack_digest: stableDigest(content) };
}

export function validateM29MainPullConsumptionPack(pack: M29MainPullConsumptionPack): string[] {
  const issues: string[] = [];
  const { pack_digest, ...content } = pack;
  if (stableDigest(content) !== pack_digest) issues.push("pack_digest_mismatch");
  const m25 = buildM25PublicSourceRealityEvidenceEpochPack();
  const m27 = buildM27SecondCityTransferRequalificationPack();
  const m28 = buildM28DualEpochLivingOperationsPack();
  issues.push(
    ...validateM25PublicSourceRealityEvidenceEpochPack(m25).map((issue) => `m25_${issue}`)
  );
  issues.push(
    ...validateM27SecondCityTransferRequalificationPack(m27).map((issue) => `m27_${issue}`)
  );
  issues.push(...validateM28DualEpochLivingOperationsPack(m28).map((issue) => `m28_${issue}`));
  const expected = buildM29MainPullConsumptionPack();
  if (hasFloatingSelector(pack)) issues.push("floating_selector_present");
  if (
    pack.state_b !== "SOURCE_BACKED_SHANGHAI_REGIONAL_ENTERPRISE_JOURNEY_MAINLINE_BOUND_WITH_LIMITS"
  )
    issues.push("state_b_invalid");
  if (pack.state_transition.from !== "STATE_A" || pack.state_transition.to !== "STATE_B")
    issues.push("state_transition_invalid");
  if (
    pack.source_pack_refs.m25_epoch.epoch_id !== m25.source_epoch.epoch_id ||
    pack.source_pack_refs.m25_epoch.epoch_digest !== m25.source_epoch.epoch_digest ||
    pack.source_pack_refs.m25_epoch.source_epoch_base_sha !==
      m25.source_epoch.source_epoch_base_sha ||
    pack.source_pack_refs.m27_transfer.transfer_id !== m27.transfer_summary.transfer_id ||
    pack.source_pack_refs.m27_transfer.pack_digest !== m27.pack_digest ||
    pack.source_pack_refs.m27_transfer.candidate_version !== m27.transfer.candidate_ref.version ||
    pack.source_pack_refs.m28_living_operations.pack_digest !== m28.pack_digest ||
    pack.source_pack_refs.m28_living_operations.epoch_id !== m28.epoch_b.epoch_id ||
    pack.source_pack_refs.m28_living_operations.epoch_version !== m28.epoch_b.version
  )
    issues.push("source_pack_binding_invalid");
  if (
    pack.regional_consumption.baseline_region !== "Shanghai" ||
    pack.regional_consumption.target_region !== "Hangzhou" ||
    pack.regional_consumption.transfer_id !== m27.transfer_summary.transfer_id ||
    pack.regional_consumption.epoch_id !== m28.epoch_b.epoch_id ||
    pack.regional_consumption.epoch_version !== m28.epoch_b.version ||
    pack.regional_consumption.expires_at !== m28.epoch_b.expires_at ||
    pack.regional_consumption.qualification_status !== "LIMITED" ||
    pack.regional_consumption.calibration_evidence !== "NOT_PROVEN" ||
    pack.regional_consumption.formal_binding_eligible ||
    pack.regional_consumption.consumption_status !== "LOOKAHEAD_READY" ||
    !pack.regional_consumption.exact_binding_required
  )
    issues.push("regional_consumption_boundary_invalid");
  if (
    digestWithout(pack.regional_consumption, "consumption_digest") !==
    pack.regional_consumption.consumption_digest
  )
    issues.push("regional_consumption_digest_invalid");
  if (
    pack.enterprise_consumption.scope !== "SOURCE_BACKED_ENTERPRISE_CANDIDATE" ||
    pack.enterprise_consumption.source_reality_class !== "PUBLIC_SOURCE_BOUND" ||
    pack.enterprise_consumption.rights_status !== "PUBLIC_REFERENCE_ONLY" ||
    pack.enterprise_consumption.qualification_status !== "LIMITED" ||
    pack.enterprise_consumption.formal_binding_eligible ||
    pack.enterprise_consumption.private_data_included ||
    pack.enterprise_consumption.product_consumption_status !== "LOOKAHEAD_READY" ||
    !pack.enterprise_consumption.exact_binding_required
  )
    issues.push("enterprise_consumption_boundary_invalid");
  if (
    digestWithout(pack.enterprise_consumption, "consumption_digest") !==
    pack.enterprise_consumption.consumption_digest
  )
    issues.push("enterprise_consumption_digest_invalid");
  if (
    digestWithout(pack.main_binding_request, "request_digest") !==
    pack.main_binding_request.request_digest
  )
    issues.push("main_binding_request_digest_invalid");
  if (stableDigest(pack.main_binding_request) !== stableDigest(expected.main_binding_request))
    issues.push("main_binding_request_binding_invalid");
  if (
    pack.main_binding_request.consumer !== "MAIN" ||
    pack.main_binding_request.shared_contract_owner !== "MAIN" ||
    pack.main_binding_request.openapi_owner !== "MAIN" ||
    pack.main_binding_request.role_bff_owner !== "MAIN" ||
    pack.main_binding_request.formal_writer_owner !== "MAIN" ||
    pack.main_binding_request.registry_owner !== "MAIN" ||
    pack.main_binding_request.product_pr_owner !== "MAIN" ||
    pack.main_binding_request.sh_product_pr_created ||
    pack.main_binding_request.sh_formal_write
  )
    issues.push("main_ownership_boundary_invalid");
  if (
    pack.product_proof.product_consumption_status !== "LOOKAHEAD_READY" ||
    pack.product_proof.real_route_proof !== "NOT_PROVEN" ||
    pack.product_proof.real_service_proof !== "NOT_PROVEN" ||
    pack.product_proof.real_bff_proof !== "NOT_PROVEN" ||
    pack.product_proof.browser_proof !== "NOT_PROVEN" ||
    !pack.product_proof.no_second_route
  )
    issues.push("product_proof_boundary_invalid");
  if (
    pack.authority.official_truth_write ||
    pack.authority.settlement_write ||
    pack.authority.score_write ||
    pack.authority.rank_write ||
    pack.authority.parameter_set_formal_write ||
    pack.authority.provider !== "OFF" ||
    pack.authority.second_truth_writer ||
    pack.authority.runtime_authority !== "JSON_INTERNAL_ONLY"
  )
    issues.push("authority_boundary_invalid");
  if (
    pack.tombstone_reuse.m19_m24 !== "TOMBSTONED_PROFESSIONAL_CANDIDATE_WITH_LIMITS" ||
    !pack.tombstone_reuse.no_second_truth_writer ||
    !pack.tombstone_reuse.no_duplicate_main_consumer
  )
    issues.push("tombstone_reuse_boundary_invalid");
  if (pack.role_journey.student.forbidden_fields.includes("official_truth") === false)
    issues.push("student_truth_boundary_missing");
  if (pack.role_journey.enterprise.forbidden_fields.includes("private_project_data") === false)
    issues.push("enterprise_private_data_boundary_missing");
  return [...new Set(issues)];
}

export function projectM29ForRole(
  pack: M29MainPullConsumptionPack,
  role: M29Role
): Record<string, unknown> {
  if (role === "teacher") {
    return {
      role,
      regional_consumption: structuredClone(pack.regional_consumption),
      enterprise_consumption: structuredClone(pack.enterprise_consumption),
      source_pack_refs: structuredClone(pack.source_pack_refs),
      main_binding_request: structuredClone(pack.main_binding_request),
      known_limits: [...pack.known_limits]
    };
  }
  if (role === "admin") {
    return {
      role,
      source_pack_refs: structuredClone(pack.source_pack_refs),
      main_binding_request: structuredClone(pack.main_binding_request),
      product_proof: structuredClone(pack.product_proof),
      authority: structuredClone(pack.authority)
    };
  }
  if (role === "enterprise") {
    return {
      role,
      scope: pack.enterprise_consumption.scope,
      target_region: pack.enterprise_consumption.target_region,
      qualification_status: pack.enterprise_consumption.qualification_status,
      product_consumption_status: pack.enterprise_consumption.product_consumption_status,
      exact_binding_required: pack.enterprise_consumption.exact_binding_required
    };
  }
  return {
    role,
    target_region: pack.regional_consumption.target_region,
    epoch_version: pack.regional_consumption.epoch_version,
    qualification_status: pack.regional_consumption.qualification_status,
    consumption_status: pack.regional_consumption.consumption_status,
    exact_binding_required: pack.regional_consumption.exact_binding_required
  };
}
