import { createHash } from "node:crypto";
import {
  isTeacherConfirmationContext,
  type TeacherConfirmationContext
} from "@simwar/shared-contracts";

export type TeacherConfirmationClaimStatus = "CLAIMED" | "RELEASED" | "EXPIRED";

export interface TeacherConfirmationWorkClaim {
  readonly claim_id: string;
  readonly tenant_id: string;
  readonly context: { course_id: string; run_id: string; team_id: string; role_key: string };
  readonly evidence_set_digest: string;
  readonly claimed_by: string;
  readonly claimed_at: string;
  readonly expires_at: string;
  readonly status: TeacherConfirmationClaimStatus;
}

export interface TeacherConfirmationClaimVerification {
  assertActive(input: {
    claim_id: string;
    actor_id: string;
    tenant_id: string;
    context: TeacherConfirmationContext;
    evidence_set_digest: string;
    now: string;
  }): void;
}

export class TeacherConfirmationWorkClaimError extends Error {
  constructor(
    readonly code: "D3_WORK_CLAIM_CONFLICT" | "D3_WORK_CLAIM_EXPIRED" | "D3_INPUT_INVALID"
  ) {
    super(code);
    this.name = "TeacherConfirmationWorkClaimError";
  }
}

function key(
  input: Pick<TeacherConfirmationWorkClaim, "tenant_id" | "context" | "evidence_set_digest">
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenant_id: input.tenant_id,
        context: canonicalContext(input.context),
        evidence_set_digest: input.evidence_set_digest
      })
    )
    .digest("hex");
}

function canonicalContext(context: TeacherConfirmationWorkClaim["context"]): string {
  return JSON.stringify([context.course_id, context.run_id, context.team_id, context.role_key]);
}

export class TeacherConfirmationWorkClaimService {
  private readonly claims = new Map<string, TeacherConfirmationWorkClaim>();
  private sequence = 0;

  claim(input: {
    tenant_id: string;
    context: TeacherConfirmationWorkClaim["context"];
    evidence_set_digest: string;
    claimed_by: string;
    now: string;
    ttl_seconds?: number;
  }): TeacherConfirmationWorkClaim {
    const ttlSeconds = input.ttl_seconds ?? 300;
    if (
      !input.tenant_id ||
      !input.claimed_by ||
      !/^[a-f0-9]{64}$/.test(input.evidence_set_digest) ||
      !isTeacherConfirmationContext(input.context) ||
      !Number.isInteger(ttlSeconds) ||
      ttlSeconds < 1 ||
      ttlSeconds > 3600 ||
      Number.isNaN(Date.parse(input.now))
    ) {
      throw new TeacherConfirmationWorkClaimError("D3_INPUT_INVALID");
    }
    const claimKey = key({
      tenant_id: input.tenant_id,
      context: input.context,
      evidence_set_digest: input.evidence_set_digest
    });
    const existing = this.claims.get(claimKey);
    if (
      existing &&
      existing.status === "CLAIMED" &&
      Date.parse(existing.expires_at) > Date.parse(input.now)
    ) {
      if (existing.claimed_by !== input.claimed_by)
        throw new TeacherConfirmationWorkClaimError("D3_WORK_CLAIM_CONFLICT");
      return structuredClone(existing);
    }
    const expiresAt = new Date(Date.parse(input.now) + ttlSeconds * 1000).toISOString();
    const claim: TeacherConfirmationWorkClaim = {
      claim_id: `claim_${++this.sequence}`,
      tenant_id: input.tenant_id,
      context: structuredClone(input.context),
      evidence_set_digest: input.evidence_set_digest,
      claimed_by: input.claimed_by,
      claimed_at: input.now,
      expires_at: expiresAt,
      status: "CLAIMED"
    };
    this.claims.set(claimKey, claim);
    return structuredClone(claim);
  }

  release(claimId: string, actorId: string): TeacherConfirmationWorkClaim {
    const entry = [...this.claims.entries()].find(([, claim]) => claim.claim_id === claimId);
    if (!entry || entry[1].claimed_by !== actorId)
      throw new TeacherConfirmationWorkClaimError("D3_WORK_CLAIM_CONFLICT");
    const released = { ...entry[1], status: "RELEASED" as const };
    this.claims.set(entry[0], released);
    return structuredClone(released);
  }

  get(claimId: string, actorId: string, now: string): TeacherConfirmationWorkClaim {
    const entry = [...this.claims.entries()].find(([, claim]) => claim.claim_id === claimId);
    if (!entry || entry[1].claimed_by !== actorId) {
      throw new TeacherConfirmationWorkClaimError("D3_WORK_CLAIM_CONFLICT");
    }
    const claim = entry[1];
    if (claim.status === "CLAIMED" && Date.parse(claim.expires_at) <= Date.parse(now)) {
      const expired = { ...claim, status: "EXPIRED" as const };
      this.claims.set(entry[0], expired);
      return structuredClone(expired);
    }
    return structuredClone(claim);
  }

  assertActive(input: {
    claim_id: string;
    actor_id: string;
    tenant_id: string;
    context: TeacherConfirmationWorkClaim["context"];
    evidence_set_digest: string;
    now: string;
  }): void {
    const claim = this.get(input.claim_id, input.actor_id, input.now);
    if (claim.status === "EXPIRED") {
      throw new TeacherConfirmationWorkClaimError("D3_WORK_CLAIM_EXPIRED");
    }
    if (
      claim.status !== "CLAIMED" ||
      claim.tenant_id !== input.tenant_id ||
      claim.evidence_set_digest !== input.evidence_set_digest ||
      canonicalContext(claim.context) !== canonicalContext(input.context)
    ) {
      throw new TeacherConfirmationWorkClaimError("D3_WORK_CLAIM_CONFLICT");
    }
  }

  expire(now: string): number {
    let count = 0;
    for (const [claimKey, claim] of this.claims) {
      if (claim.status === "CLAIMED" && Date.parse(claim.expires_at) <= Date.parse(now)) {
        this.claims.set(claimKey, { ...claim, status: "EXPIRED" });
        count += 1;
      }
    }
    return count;
  }
}
