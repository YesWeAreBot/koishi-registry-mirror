import minimist from "minimist";

export type Mode = "server" | "generate";

export interface AppConfig {
  // common
  mode: Mode;
  sources: string[];
  timeoutMs: number;
  // server
  port: number;
  host: string;
  cacheSeconds: number;
  corsOrigin: string;
  // generate
  outputFile: string;
  rawUrl: string | null;
}

const DEFAULT_SOURCES = [
  "https://koishi-registry.yumetsuki.moe/index.json",
  "https://kp.itzdrli.cc/index.json",
  "https://registry.koishi.t4wefan.pub/index.json",
  "https://cdn.jsdelivr.net/gh/YesWeAreBot/koishi-registry-mirror@pages/index.json",
  "https://gh-proxy.com/https://raw.githubusercontent.com/YesWeAreBot/koishi-registry-mirror/refs/heads/pages/index.json",
];

export function loadConfig(argv: string[] = Bun.argv.slice(2)): AppConfig {
  const args = minimist(argv, {
    string: [
      "mode",
      "sources",
      "host",
      "cors",
      "cors-origin",
      "output",
      "port",
      "timeout",
      "cache",
      "cache-time",
    ],
    alias: {
      p: "port",
      h: "host",
      c: "cache",
      s: "sources",
      t: "timeout",
    },
    default: {},
  });

  // positional command support, e.g. `bun run src/cli.ts server` or `generate`
  const positional =
    Array.isArray(args._) && args._.length > 0 ? String(args._[0]) : undefined;
  const modeEnv = (process.env.MODE || "").toLowerCase();
  const modeArg = String(args.mode || positional || "server").toLowerCase();
  const mode: Mode =
    modeArg === "generate" || modeEnv === "generate" ? "generate" : "server";

  // sources from CLI/env/default
  const sourcesStr =
    (typeof args.sources === "string" && args.sources) ||
    process.env.SOURCES ||
    process.env.REGISTRY_SOURCES ||
    "";
  const sources = sourcesStr
    ? sourcesStr
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_SOURCES.slice();

  // numbers
  const port = toInt(args.port, toInt(process.env.PORT, 3000));
  const timeoutMs = toInt(args.timeout, toInt(process.env.TIMEOUT_MS, 15000));
  const cacheSeconds = toInt(
    args["cache-time"] ?? args.cache,
    toInt(process.env.CACHE_SECONDS ?? process.env.CACHE_TIME, 300)
  );

  // others
  const host = String(args.host || process.env.HOST || "0.0.0.0");
  const corsOrigin = String(
    args["cors-origin"] || args.cors || process.env.CORS_ORIGIN || "*"
  );

  // output and raw url (generate mode)
  const outputFile = String(
    args.output || process.env.OUTPUT_FILE || "index.json"
  );
  const repo = process.env.GITHUB_REPOSITORY; // e.g. owner/repo
  const rawUrl = repo
    ? `https://raw.githubusercontent.com/${repo}/pages/${outputFile}`
    : null;

  return {
    mode,
    sources,
    timeoutMs,
    port,
    host,
    cacheSeconds,
    corsOrigin,
    outputFile,
    rawUrl,
  };
}

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export const DEFAULT_SOURCES_LIST = DEFAULT_SOURCES;
