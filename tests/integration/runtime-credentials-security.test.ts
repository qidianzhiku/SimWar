import { once } from "node:events";
import type { Server } from "node:http";
import { describe, expect, it } from "vitest";
import type { ApiEnvelope, AuthSession } from "../../packages/shared-contracts/src";
import { createApiServer } from "../../services/api/src/server";
import type { RuntimeSecurityConfig } from "../../services/api/src/runtime-security-config";
import { createP1Store } from "../../services/api/src/store";

const TEST_INTERNAL_SERVICE_TOKEN = "test-internal-service-token";
const TEST_JWT_SECRET = "test-jwt-secret-with-sufficient-length";
const TEST_SECURITY_CONFIG: RuntimeSecurityConfig = {
  environment: "test",
  internalServiceToken: TEST_INTERNAL_SERVICE_TOKEN,
  jwtSecret: TEST_JWT_SECRET
};

async function startServer(
  securityConfig: RuntimeSecurityConfig = TEST_SECURITY_CONFIG
): Promise<{ baseUrl: string; server: Server }> {
  const server = createApiServer(createP1Store(), { securityConfig });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server
  };
}

async function stopServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function request<TData>(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    token?: string;
    tenantId?: string;
    servicePrincipal?: string;
    body?: unknown;
  } = {}
): Promise<{ status: number; body: ApiEnvelope<TData> }> {
  const headers = new Headers({
    "content-type": "application/json",
    "x-tenant-id": options.tenantId ?? "tenant_demo"
  });

  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  if (options.servicePrincipal) {
    headers.set("x-service-principal", options.servicePrincipal);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  return {
    status: response.status,
    body: (await response.json()) as ApiEnvelope<TData>
  };
}

async function login(baseUrl: string): Promise<string> {
  const response = await request<AuthSession>(baseUrl, "/api/v1/auth/login", {
    method: "POST",
    body: {
      username: "admin",
      password: "admin"
    }
  });

  expect(response.status).toBe(200);
  return response.body.data.access_token;
}

describe("runtime credential fail-closed behavior", () => {
  it("fails API runtime creation when production is missing the internal service token", () => {
    expect(() =>
      createApiServer(createP1Store(), {
        env: {
          APP_ENV: "production",
          JWT_SECRET: TEST_JWT_SECRET
        }
      })
    ).toThrow("runtime_internal_service_token_required");
  });

  it("fails API runtime creation when production is missing the JWT secret", () => {
    expect(() =>
      createApiServer(createP1Store(), {
        env: {
          APP_ENV: "production",
          INTERNAL_SERVICE_TOKEN: TEST_INTERNAL_SERVICE_TOKEN
        }
      })
    ).toThrow("runtime_jwt_secret_required");
  });

  it("fails API runtime creation when staging receives blank credentials", () => {
    expect(() =>
      createApiServer(createP1Store(), {
        env: {
          APP_ENV: "staging",
          INTERNAL_SERVICE_TOKEN: " ",
          JWT_SECRET: TEST_JWT_SECRET
        }
      })
    ).toThrow("runtime_internal_service_token_required");

    expect(() =>
      createApiServer(createP1Store(), {
        env: {
          APP_ENV: "staging",
          INTERNAL_SERVICE_TOKEN: TEST_INTERNAL_SERVICE_TOKEN,
          JWT_SECRET: "\t"
        }
      })
    ).toThrow("runtime_jwt_secret_required");
  });

  it("validates directly injected production legacy credentials before API runtime creation", () => {
    expect(() =>
      createApiServer(createP1Store(), {
        securityConfig: {
          environment: "production",
          internalServiceToken: "service-kernel-token",
          jwtSecret: TEST_JWT_SECRET
        }
      })
    ).toThrow("runtime_internal_service_token_unsafe_default");

    expect(() =>
      createApiServer(createP1Store(), {
        securityConfig: {
          environment: "production",
          internalServiceToken: TEST_INTERNAL_SERVICE_TOKEN,
          jwtSecret: "simwar-local-development-secret"
        }
      })
    ).toThrow("runtime_jwt_secret_unsafe_default");
  });

  it("validates directly injected staging legacy credentials before API runtime creation", () => {
    expect(() =>
      createApiServer(createP1Store(), {
        securityConfig: {
          environment: "staging",
          internalServiceToken: "service-kernel-token",
          jwtSecret: TEST_JWT_SECRET
        }
      })
    ).toThrow("runtime_internal_service_token_unsafe_default");

    expect(() =>
      createApiServer(createP1Store(), {
        securityConfig: {
          environment: "staging",
          internalServiceToken: TEST_INTERNAL_SERVICE_TOKEN,
          jwtSecret: "simwar-local-development-secret"
        }
      })
    ).toThrow("runtime_jwt_secret_unsafe_default");
  });

  it.each(["", " ", "\t"])(
    "validates directly injected blank internal service tokens before API runtime creation: %j",
    (blank) => {
      expect(() =>
        createApiServer(createP1Store(), {
          securityConfig: {
            environment: "production",
            internalServiceToken: blank,
            jwtSecret: TEST_JWT_SECRET
          }
        })
      ).toThrow("runtime_internal_service_token_required");
    }
  );

  it.each(["", " ", "\r\n"])(
    "validates directly injected blank JWT secrets before API runtime creation: %j",
    (blank) => {
      expect(() =>
        createApiServer(createP1Store(), {
          securityConfig: {
            environment: "production",
            internalServiceToken: TEST_INTERNAL_SERVICE_TOKEN,
            jwtSecret: blank
          }
        })
      ).toThrow("runtime_jwt_secret_required");
    }
  );

  it("rejects incorrect service-kernel bearer token or principal", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const wrongToken = await request<unknown>(
        baseUrl,
        "/internal/v1/runs/run_missing/rounds/1/settle",
        {
          method: "POST",
          token: "wrong-internal-token",
          servicePrincipal: "service_kernel"
        }
      );
      expect(wrongToken.status).toBe(403);
      expect(wrongToken.body.code).toBe("AUTHZ-403-002");

      const wrongPrincipal = await request<unknown>(
        baseUrl,
        "/internal/v1/runs/run_missing/rounds/1/settle",
        {
          method: "POST",
          token: TEST_INTERNAL_SERVICE_TOKEN,
          servicePrincipal: "wrong_service"
        }
      );
      expect(wrongPrincipal.status).toBe(403);
      expect(wrongPrincipal.body.code).toBe("AUTHZ-403-002");

      const missingPrincipal = await request<unknown>(
        baseUrl,
        "/internal/v1/runs/run_missing/rounds/1/settle",
        {
          method: "POST",
          token: TEST_INTERNAL_SERVICE_TOKEN
        }
      );
      expect(missingPrincipal.status).toBe(403);
      expect(missingPrincipal.body.code).toBe("AUTHZ-403-002");

      const studentToken = await login(baseUrl, "student", "student");
      const studentAttempt = await request<unknown>(
        baseUrl,
        "/internal/v1/runs/run_missing/rounds/1/settle",
        {
          method: "POST",
          token: studentToken,
          servicePrincipal: "service_kernel"
        }
      );
      expect(studentAttempt.status).toBe(403);
      expect(studentAttempt.body.code).toBe("AUTHZ-403-002");
      expect(JSON.stringify(studentAttempt.body)).not.toContain("token");
      expect(JSON.stringify(studentAttempt.body)).not.toContain("stack");

      const correctCredential = await request<unknown>(
        baseUrl,
        "/internal/v1/runs/run_missing/rounds/1/settle",
        {
          method: "POST",
          token: TEST_INTERNAL_SERVICE_TOKEN,
          servicePrincipal: "service_kernel"
        }
      );
      expect(correctCredential.status).toBe(404);
      expect(correctCredential.body.code).toBe("RUN-404-001");
    } finally {
      await stopServer(server);
    }
  });

  it("uses trimmed directly injected fixture credentials without mutating the input object", async () => {
    const securityConfig: RuntimeSecurityConfig = {
      environment: "test",
      internalServiceToken: ` ${TEST_INTERNAL_SERVICE_TOKEN} `,
      jwtSecret: `\t${TEST_JWT_SECRET}\n`
    };
    const { baseUrl, server } = await startServer(securityConfig);

    try {
      expect(securityConfig).toEqual({
        environment: "test",
        internalServiceToken: ` ${TEST_INTERNAL_SERVICE_TOKEN} `,
        jwtSecret: `\t${TEST_JWT_SECRET}\n`
      });

      const accessToken = await login(baseUrl);
      const me = await request(baseUrl, "/api/v1/auth/me", {
        token: accessToken
      });
      expect(me.status).toBe(200);

      const correctCredential = await request<unknown>(
        baseUrl,
        "/internal/v1/runs/run_missing/rounds/1/settle",
        {
          method: "POST",
          token: TEST_INTERNAL_SERVICE_TOKEN,
          servicePrincipal: "service_kernel"
        }
      );
      expect(correctCredential.status).toBe(404);
      expect(correctCredential.body.code).toBe("RUN-404-001");

      const spacedToken = await request<unknown>(
        baseUrl,
        "/internal/v1/runs/run_missing/rounds/1/settle",
        {
          method: "POST",
          token: ` ${TEST_INTERNAL_SERVICE_TOKEN} `,
          servicePrincipal: "service_kernel"
        }
      );
      expect(spacedToken.status).toBe(403);
      expect(spacedToken.body.code).toBe("AUTHZ-403-002");
    } finally {
      await stopServer(server);
    }
  });

  it("signs and verifies JWT sessions only with the configured fixture secret", async () => {
    const { baseUrl, server } = await startServer();

    try {
      const accessToken = await login(baseUrl);
      const me = await request(baseUrl, "/api/v1/auth/me", {
        token: accessToken
      });
      expect(me.status).toBe(200);

      const badToken = await request(baseUrl, "/api/v1/auth/me", {
        token: "not-a-valid-session-token"
      });
      expect(badToken.status).toBe(401);
      expect(badToken.body.code).toBe("AUTH-401-001");
    } finally {
      await stopServer(server);
    }
  });
});
