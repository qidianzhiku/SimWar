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

  getForRun(tenantId: string, runId: string): FormalRunRuntimeBinding | null {
    const binding = this.store.formalRunRuntimeBindings.find(
      (candidate) => candidate.tenant_id === tenantId && candidate.run_id === runId
    );

    return binding ? deepFreeze(clone(binding)) : null;
  }
}
