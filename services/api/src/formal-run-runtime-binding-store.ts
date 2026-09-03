import type { FormalRunRuntimeBinding } from "@simwar/shared-contracts";
import type { SimWarStore } from "./store.js";

export type FormalRunRuntimeBindingStoreFailureCode = "FORMAL_RUN_BINDING_ALREADY_EXISTS";

export class FormalRunRuntimeBindingStoreError extends Error {
  readonly code: FormalRunRuntimeBindingStoreFailureCode;

  constructor(code: FormalRunRuntimeBindingStoreFailureCode) {
    super(code);
    this.code = code;
    this.name = "FormalRunRuntimeBindingStoreError";
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }

  return value;
}

export interface FormalRunRuntimeBindingPort {
  append(binding: FormalRunRuntimeBinding): void | Promise<void>;
  /**
   * Private compensation for a binding appended by the current failed
   * creation command. It must never be used to rewrite historical bindings.
   */
  removeAfterFailedCreation?(binding: FormalRunRuntimeBinding): void | Promise<void>;
  getForRun(
    tenantId: string,
    runId: string
  ): FormalRunRuntimeBinding | null | Promise<FormalRunRuntimeBinding | null>;
}

/**
 * Private append-only JSON persistence for formal bindings. The public Run
 * remains ID-only so legacy callers cannot mistake a legacy lookup for a
 * formal Authority binding.
 */
export class FormalRunRuntimeBindingStore implements FormalRunRuntimeBindingPort {
  constructor(private readonly store: SimWarStore) {}

  append(binding: FormalRunRuntimeBinding): void {
    const existing = this.store.formalRunRuntimeBindings.find(
      (candidate) =>
        candidate.tenant_id === binding.tenant_id && candidate.run_id === binding.run_id
    );

    if (existing) {
      throw new FormalRunRuntimeBindingStoreError("FORMAL_RUN_BINDING_ALREADY_EXISTS");
    }

    this.store.formalRunRuntimeBindings.push(deepFreeze(clone(binding)));
  }

  removeAfterFailedCreation(binding: FormalRunRuntimeBinding): void {
    const index = this.store.formalRunRuntimeBindings.findIndex(
      (candidate) =>
        candidate.tenant_id === binding.tenant_id &&
        candidate.run_id === binding.run_id &&
        candidate.binding_digest === binding.binding_digest
    );
    if (index < 0) throw new Error("formal_run_binding_failed_creation_missing");
    this.store.formalRunRuntimeBindings.splice(index, 1);
  }

  getForRun(tenantId: string, runId: string): FormalRunRuntimeBinding | null {
    const binding = this.store.formalRunRuntimeBindings.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
    );

    return binding ? deepFreeze(clone(binding)) : null;
  }
}
