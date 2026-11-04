import "server-only";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { seedDatabase } from "./seed";

export type AcademyDb = LibSQLDatabase<typeof schema>;

type DbBundle = {
  db: AcademyDb;
  client: Client;
  /** Migration + reference seed. Every query awaits this first. */
  ready: Promise<void>;
};

const globalForDb = globalThis as unknown as {
  __leoAcademyDb?: DbBundle;
};

function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.NETLIFY ||
      process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
}

/**
 * LibSQL accepts `file:` URLs on every platform. Windows absolute paths must be
 * written with forward slashes so they are not mistaken for an authority.
 */
function fileUrl(filePath: string) {
  return `file:${filePath.replace(/\\/g, "/")}`;
}

const REMOTE_SCHEMES = ["libsql://", "https://", "http://"] as const;

function firstValue(...values: Array<string | undefined>) {
  return values.find((value): value is string => Boolean(value?.trim()))?.trim();
}

function looksLikeRemoteUrl(value: string | undefined): value is string {
  return Boolean(
    value &&
      REMOTE_SCHEMES.some((scheme) => value.toLowerCase().startsWith(scheme)),
  );
}

/**
 * Copy/pasting Turso's URL and token in the wrong order is a common deployment
 * mistake and used to leave the whole teacher panel read-only. Detect it here
 * instead of failing later with `URL_INVALID`.
 */
let warnedSwap = false;

/**
 * Resolves the database target:
 *  - `libsql://…` / `https://…` → remote Turso with an auth token;
 *  - `file:…` → an explicit local database file;
 *  - nothing configured → `.data/leo-academy.db` in development and
 *    `/tmp/leo-academy.db` on a serverless host (ephemeral but never fatal,
 *    because Dexie remains the offline-first store).
 */
function resolveTarget(): { url: string; authToken?: string } {
  let configured = firstValue(
    process.env.DATABASE_URL,
    process.env.TURSO_DATABASE_URL,
    process.env.LIBSQL_DATABASE_URL,
  );
  let token = firstValue(
    process.env.DATABASE_AUTH_TOKEN,
    process.env.TURSO_AUTH_TOKEN,
    process.env.LIBSQL_AUTH_TOKEN,
  );

  // Swapped values: the URL slot holds a JWT (or nothing) and the token slot
  // holds the actual URL. Exchange them instead of failing with URL_INVALID.
  const configuredIsFile = configured?.startsWith("file:") ?? false;
  if (
    !configuredIsFile &&
    looksLikeRemoteUrl(token) &&
    !looksLikeRemoteUrl(configured)
  ) {
    [configured, token] = [token, configured];
    if (!warnedSwap) {
      warnedSwap = true;
      console.warn(
        "[leo] DATABASE_URL y DATABASE_AUTH_TOKEN están intercambiados; " +
          "se corrigen al vuelo. Intercámbialos en tu panel de despliegue.",
      );
    }
  }

  if (configured?.startsWith("file:")) {
    const raw = configured.slice("file:".length);
    const filePath = path.isAbsolute(raw)
      ? raw
      : path.resolve(
          /*turbopackIgnore: true*/
          process.cwd(),
          raw.replace(/^\.\//, ""),
        );
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    return { url: fileUrl(filePath) };
  }

  if (configured && looksLikeRemoteUrl(configured)) {
    if (!token) {
      console.warn(
        "[leo] DATABASE_URL apunta a Turso pero falta DATABASE_AUTH_TOKEN.",
      );
    }
    return { url: configured, authToken: token || undefined };
  }

  if (configured) {
    console.error(
      "[leo] DATABASE_URL no es un destino válido (se esperaba libsql://, https:// o file:). " +
        "Se usará la base local.",
    );
  }

  const fallback = isServerlessRuntime()
    ? path.join("/tmp", "leo-academy.db")
    : path.resolve(process.cwd(), ".data", "leo-academy.db");

  fs.mkdirSync(path.dirname(fallback), { recursive: true });
  return { url: fileUrl(fallback) };
}

/** The migrations folder ships next to the app (see `outputFileTracingIncludes`). */
function resolveMigrationsFolder() {
  const candidates = [
    process.env.LEO_MIGRATIONS_DIR,
    path.resolve(process.cwd(), "drizzle"),
    path.resolve(process.cwd(), ".next", "standalone", "drizzle"),
    path.resolve(process.cwd(), "..", "drizzle"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "meta", "_journal.json"))) {
      return candidate;
    }
  }
  return null;
}

function createBundle(): DbBundle {
  const target = resolveTarget();
  const client = createClient({
    url: target.url,
    authToken: target.authToken,
  });
  const db = drizzle(client, { schema });

  const bundle: DbBundle = { db, client, ready: Promise.resolve() };

  bundle.ready = (async () => {
    const migrationsFolder = resolveMigrationsFolder();
    if (!migrationsFolder) {
      throw new Error(
        "[leo] No se encontró la carpeta `drizzle/` con las migraciones. " +
          "Inclúyela en el despliegue (outputFileTracingIncludes).",
      );
    }
    await migrate(db, { migrationsFolder });
    await seedDatabase(db);
  })().catch((error) => {
    // A failed cold start must not poison the process: drop the bundle so the
    // next request can retry with a clean client.
    if (globalForDb.__leoAcademyDb === bundle) {
      delete globalForDb.__leoAcademyDb;
    }
    throw error;
  });

  return bundle;
}

function getBundle(): DbBundle {
  globalForDb.__leoAcademyDb ??= createBundle();
  return globalForDb.__leoAcademyDb;
}

/**
 * Drizzle instance without waiting for migrations. Only use it as a type
 * source; real queries must go through `getReadyDb()`.
 */
export function getDb(): AcademyDb {
  return getBundle().db;
}

/**
 * Opens the database lazily, applies migrations once per process and seeds the
 * curriculum reference rows. All Server Actions and pages await this.
 */
export async function getReadyDb(): Promise<AcademyDb> {
  const bundle = getBundle();
  await bundle.ready;
  return bundle.db;
}

export { schema };
