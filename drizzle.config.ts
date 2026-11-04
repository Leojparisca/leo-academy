import { defineConfig } from "drizzle-kit";

const configured = process.env.DATABASE_URL?.trim();

/**
 * `drizzle-kit generate` only needs the schema; the URL lets `studio` open the
 * local file. A remote `libsql://` URL is used by the app at runtime and is not
 * required to author migrations.
 */
const url = configured?.startsWith("file:")
  ? configured.slice("file:".length)
  : (configured ?? "./.data/leo-academy.db");

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
