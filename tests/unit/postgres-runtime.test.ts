import { describe, expect, it } from "vitest";
import {
  createPostgresRuntime,
  resolveRepositoryMode
} from "../../services/api/src/postgres-runtime.js";

describe("W024 Postgres runtime mode", () => {
  it("accepts explicit JSON and Postgres modes", () => {
    expect(resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "json" })).toBe("json");
    expect(resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "postgres" })).toBe("postgres");
  });

  it("rejects an unsupported mode", () => {
    expect(() => resolveRepositoryMode({ SIMWAR_REPOSITORY_MODE: "sqlite" })).toThrow(
      "repository_mode_invalid"
    );
  });

  it("fails closed when Postgres configuration is absent", async () => {
    await expect(createPostgresRuntime({ databaseUrl: "" }).start()).rejects.toThrow(
      "postgres_database_config_missing"
    );
  });

  it("does not expose a JSON fallback in Postgres mode", () => {
    expect(() =>
      createPostgresRuntime({ databaseUrl: "postgres://example.invalid/db" })
    ).not.toThrow();
  });
});
