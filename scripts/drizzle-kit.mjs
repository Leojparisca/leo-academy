import { spawn } from "node:child_process";
import process from "node:process";

/**
 * `server-only` intentionally throws outside React Server Components.
 * drizzle-kit only needs the table definitions, so we load Node with the
 * `react-server` condition, which resolves the package to its empty stub.
 */
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--conditions=react-server"]
    .filter(Boolean)
    .join(" "),
};

const [, , command = "generate", ...rest] = process.argv;

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["drizzle-kit", command, ...rest],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

child.on("exit", (code) => process.exit(code ?? 0));
