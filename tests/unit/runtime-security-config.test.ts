import { describe, expect, it } from "vitest";
import {
  RuntimeConfigurationError,
  resolveRuntimeSecurityConfig
} from "../../services/api/src/runtime-security-config";

const VALID_INTERNAL_SERVICE_TOKEN = "test-internal-service-token";
const VALID_JWT_SECRET = "test-jwt-secret-with-sufficient-length";
const LEGACY_INTERNAL_SERVICE_TOKEN = "service-kernel-token";
const LEGACY_JWT_SECRET = "simwar-local-development-secret";

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return {
    ...overrides
  };
}

function expectConfigurationError(
  action: () => unknown,
  code: string,
  leakedValues: string[] = []
): void {
  try {
    action();
    throw new Error("expected runtime configuration error");
  } catch (error) {
    expect(error).toBeInstanceOf(RuntimeConfigurationError);
    expect((error as RuntimeConfigurationError).code).toBe(code);
    const serialized = JSON.stringify(error);
    for (const value of leakedValues) {
      expect(serialized).not.toContain(value);
    }
  }
}

describe("runtime security configuration", () => {
  it("fails closed in production when the internal service token is missing", () => {
    expectConfigurationError(
      () =>
        resolveRuntimeSecurityConfig(
          env({
            APP_ENV: "production",
            JWT_SECRET: VALID_JWT_SECRET
          })
        ),
      "runtime_internal_service_token_required",
      [VALID_JWT_SECRET]
    );
  });

  it("fails closed in production when the JWT secret is missing", () => {
    expectConfigurationError(
      () =>
        resolveRuntimeSecurityConfig(
          env({
            APP_ENV: "production",
            INTERNAL_SERVICE_TOKEN: VALID_INTERNAL_SERVICE_TOKEN
          })
        ),
      "runtime_jwt_secret_required",
      [VALID_INTERNAL_SERVICE_TOKEN]
    );
  });

  it.each(["", " ", "\t"])("treats blank credentials as missing: %j", (blank) => {
    expectConfigurationError(
      () =>
        resolveRuntimeSecurityConfig(
          env({
            APP_ENV: "production",
            INTERNAL_SERVICE_TOKEN: blank,
            JWT_SECRET: VALID_JWT_SECRET
          })
        ),
      "runtime_internal_service_token_required",
      [VALID_JWT_SECRET]
    );

    expectConfigurationError(
      () =>
        resolveRuntimeSecurityConfig(
          env({
            APP_ENV: "production",
            INTERNAL_SERVICE_TOKEN: VALID_INTERNAL_SERVICE_TOKEN,
            JWT_SECRET: blank
          })
        ),
      "runtime_jwt_secret_required",
      [VALID_INTERNAL_SERVICE_TOKEN]
    );
  });

  it("rejects the legacy internal service token in production and staging", () => {
    for (const appEnv of ["production", "staging"]) {
      expectConfigurationError(
        () =>
          resolveRuntimeSecurityConfig(
            env({
              APP_ENV: appEnv,
              INTERNAL_SERVICE_TOKEN: LEGACY_INTERNAL_SERVICE_TOKEN,
              JWT_SECRET: VALID_JWT_SECRET
            })
          ),
        "runtime_internal_service_token_unsafe_default",
        [LEGACY_INTERNAL_SERVICE_TOKEN, VALID_JWT_SECRET]
      );
    }
  });

  it("rejects the legacy development JWT secret in production and staging", () => {
    for (const appEnv of ["production", "staging"]) {
      expectConfigurationError(
        () =>
          resolveRuntimeSecurityConfig(
            env({
              APP_ENV: appEnv,
              INTERNAL_SERVICE_TOKEN: VALID_INTERNAL_SERVICE_TOKEN,
              JWT_SECRET: LEGACY_JWT_SECRET
            })
          ),
        "runtime_jwt_secret_unsafe_default",
        [VALID_INTERNAL_SERVICE_TOKEN, LEGACY_JWT_SECRET]
      );
    }
  });

  it("requires explicit test fixture credentials", () => {
    expectConfigurationError(
      () =>
        resolveRuntimeSecurityConfig(
          env({
            APP_ENV: "test"
          })
        ),
      "runtime_internal_service_token_required"
    );

    expect(
      resolveRuntimeSecurityConfig(
        env({
          APP_ENV: "test",
          INTERNAL_SERVICE_TOKEN: VALID_INTERNAL_SERVICE_TOKEN,
          JWT_SECRET: VALID_JWT_SECRET
        })
      )
    ).toEqual({
      environment: "test",
      internalServiceToken: VALID_INTERNAL_SERVICE_TOKEN,
      jwtSecret: VALID_JWT_SECRET
    });
  });

  it("requires explicit development credentials", () => {
    expectConfigurationError(
      () =>
        resolveRuntimeSecurityConfig(
          env({
            APP_ENV: "development"
          })
        ),
      "runtime_internal_service_token_required"
    );

    expect(
      resolveRuntimeSecurityConfig(
        env({
          APP_ENV: "development",
          INTERNAL_SERVICE_TOKEN: "local-internal-service-token",
          JWT_SECRET: "local-jwt-secret-with-sufficient-length"
        })
      )
    ).toEqual({
      environment: "development",
      internalServiceToken: "local-internal-service-token",
      jwtSecret: "local-jwt-secret-with-sufficient-length"
    });
  });
});
