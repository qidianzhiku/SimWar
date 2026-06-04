import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import type { ActorRole } from "@simwar/shared-contracts";

const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";

export interface TokenPayload {
  sub: string;
  tenant_id: string;
  roles: ActorRole[];
  session_id: string;
  iat: number;
  exp: number;
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  ).toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, encodedHash: string): boolean {
  const [scheme, iterationsRaw, salt, expectedHash] = encodedHash.split("$");

  if (scheme !== "pbkdf2" || !iterationsRaw || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number.parseInt(iterationsRaw, 10);
  const actual = pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST);
  const expected = Buffer.from(expectedHash, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function createSignedToken(payload: TokenPayload, secret: string): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`, secret);

  return `${header}.${body}.${signature}`;
}

export function verifySignedToken(
  token: string,
  secret: string,
  now = Date.now()
): TokenPayload | undefined {
  const [header, body, signature] = token.split(".");

  if (!header || !body || !signature) {
    return undefined;
  }

  const expected = sign(`${header}.${body}`, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return undefined;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;

  if (payload.exp * 1000 <= now) {
    return undefined;
  }

  return payload;
}

export function hashToken(token: string): string {
  return createHmac("sha256", "simwar-token-index").update(token).digest("hex");
}
