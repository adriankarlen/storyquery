// Wires the storyquery command tree and maps domain errors to process exit codes.
import { defineCommand, runCommand, showUsage } from "citty";
import { docsCommand } from "./commands/docs.js";
import { listCommand } from "./commands/list.js";
import { queryCommand } from "./commands/query.js";
import { showCommand } from "./commands/show.js";
import { NoUrlError } from "./config.js";
import { HttpStatusError } from "./fetch.js";
import { AmbiguousError, NotFoundError } from "./manifest/service.js";
import { VERSION } from "./version.js";

// Exit codes returned by the CLI.
const EXIT_OK = 0;
const EXIT_NO_MATCH = 1;
const EXIT_USAGE = 2;
const EXIT_NETWORK = 3;
const EXIT_ERROR = 1;

const main = defineCommand({
  meta: {
    name: "storyquery",
    version: VERSION,
    description:
      "storyquery fetches a Storybook instance's manifest files and answers agent-friendly queries about components and documentation.",
  },
  subCommands: {
    query: queryCommand,
    show: showCommand,
    list: listCommand,
    docs: docsCommand,
  },
});

function exitCode(err: unknown): number {
  if (err instanceof NotFoundError) return EXIT_NO_MATCH;
  if (err instanceof AmbiguousError) return EXIT_ERROR;
  if (err instanceof NoUrlError) return EXIT_USAGE;
  if (isNetwork(err)) return EXIT_NETWORK;
  return EXIT_ERROR;
}

function isNetwork(err: unknown): boolean {
  // Native fetch failures surface as TypeError with a cause, possibly wrapped by
  // our service layer ("fetch <label> manifest: ...").
  for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause) {
    if (e instanceof HttpStatusError) return true;
    if (e instanceof TypeError) return true;
    const name = (e as { name?: string }).name;
    if (name === "AbortError" || name === "FetchError") return true;
  }
  return false;
}

async function run(): Promise<number> {
  const rawArgs = process.argv.slice(2);

  // Top-level help / version (citty's runCommand handles per-subcommand help).
  if (rawArgs.length === 0 || rawArgs.includes("--help") || rawArgs.includes("-h")) {
    await showUsage(main);
    return EXIT_OK;
  }
  if (rawArgs.length === 1 && (rawArgs[0] === "--version" || rawArgs[0] === "-v")) {
    process.stdout.write(`${VERSION}\n`);
    return EXIT_OK;
  }

  try {
    await runCommand(main, { rawArgs });
    return EXIT_OK;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    return exitCode(err);
  }
}

run().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`error: ${message}\n`);
    process.exitCode = EXIT_ERROR;
  },
);
