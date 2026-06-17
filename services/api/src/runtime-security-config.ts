export type RuntimeEnvironment = "development" | "production" | "staging" | "test";

export interface RuntimeSecurityConfig {
  environment: RuntimeEnvironment;
  internalServiceToken: string;
  jwtSecret: string;
}

export interface RuntimeSecurityConfigEnv {
  APP_ENV?: string;
  INTERNAL_SERVICE_TOKEN?: string;
  JWT_SECRET?: string;
  NODE_ENV?: string;
  SIMWAR_ENV?: string;
  [name: string]: string | undefined;
}

export class RuntimeConfigurationError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "RuntimeConfigurationError";
  }
}

const legacyInternalServiceToken = "service-kernel-token";
const legacyJwtSecret = "simwar-local-development-secret";

function trimmed(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeRuntimeEnvironment(
  raw: string | undefined,
  options: { unknownAsProduction: boolean }
): RuntimeEnvironment {
  const normalized = trimmed(raw)?.toLowerCase();

  if (!normalized) {
    return "development";
  }

  if (normalized === "test") {
    return "test";
  }

  if (normalized === "development" || normalized === "dev" || normalized === "local") {
    return "development";
  }

  if (normalized === "staging" || normalized === "stage" || normalized === "shared") {
    return "staging";
  }

  if (normalized === "production" || normalized === "prod") {
    return "production";
  }

  if (options.unknownAsProduction) {
    return "production";
  }

  throw new RuntimeConfigurationError("runtime_environment_invalid", "runtime_environment_invalid");
}

function resolveRuntimeEnvironment(env: RuntimeSecurityConfigEnv): RuntimeEnvironment {
  const raw = trimmed(env.SIMWAR_ENV) ?? trimmed(env.APP_ENV) ?? trimmed(env.NODE_ENV);
  return normalizeRuntimeEnvironment(raw, { unknownAsProduction: true });
}

function isSharedEnvironment(environment: RuntimeEnvironment): boolean {
  return environment === "production" || environment === "staging";
}

function requireSecret(value: string | undefined, code: string): string {
  const normalized = trimmed(value);

  if (!normalized) {
    throw new RuntimeConfigurationError(code, code);
  }

  return normalized;
}

export function validateRuntimeSecurityConfig(
  config: RuntimeSecurityConfig
): RuntimeSecurityConfig {
  const environment = normalizeRuntimeEnvironment(config.environment, {
    unknownAsProduction: false
  });
  const internalServiceToken = requireSecret(
    config.internalServiceToken,
    "runtime_internal_service_token_required"
  );
  const jwtSecret = requireSecret(config.jwtSecret, "runtime_jwt_secret_required");

  if (isSharedEnvironment(environment) && internalServiceToken === legacyInternalServiceToken) {
    throw new RuntimeConfigurationError(
      "runtime_internal_service_token_unsafe_default",
      "runtime_internal_service_token_unsafe_default"
    );
  }

  if (isSharedEnvironment(environment) && jwtSecret === legacyJwtSecret) {
    throw new RuntimeConfigurationError(
      "runtime_jwt_secret_unsafe_default",
      "runtime_jwt_secret_unsafe_default"
    );
  }

  return {
    environment,
    internalServiceToken,
    jwtSecret
  };
}

export function resolveRuntimeSecurityConfig(
  env: RuntimeSecurityConfigEnv = process.env
): RuntimeSecurityConfig {
  return validateRuntimeSecurityConfig({
    environment: resolveRuntimeEnvironment(env),
    internalServiceToken: env.INTERNAL_SERVICE_TOKEN ?? "",
    jwtSecret: env.JWT_SECRET ?? ""
  });
}
