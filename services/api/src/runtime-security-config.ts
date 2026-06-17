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

function resolveRuntimeEnvironment(env: RuntimeSecurityConfigEnv): RuntimeEnvironment {
  const raw = trimmed(env.SIMWAR_ENV) ?? trimmed(env.APP_ENV) ?? trimmed(env.NODE_ENV);
  const normalized = raw?.toLowerCase();

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

  return "production";
}

function isSharedEnvironment(environment: RuntimeEnvironment): boolean {
  return environment === "production" || environment === "staging";
}

function requireSecret(
  env: RuntimeSecurityConfigEnv,
  name: "INTERNAL_SERVICE_TOKEN" | "JWT_SECRET",
  code: string
): string {
  const value = trimmed(env[name]);

  if (!value) {
    throw new RuntimeConfigurationError(code, code);
  }

  return value;
}

export function resolveRuntimeSecurityConfig(
  env: RuntimeSecurityConfigEnv = process.env
): RuntimeSecurityConfig {
  const environment = resolveRuntimeEnvironment(env);
  const internalServiceToken = requireSecret(
    env,
    "INTERNAL_SERVICE_TOKEN",
    "runtime_internal_service_token_required"
  );
  const jwtSecret = requireSecret(env, "JWT_SECRET", "runtime_jwt_secret_required");

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
