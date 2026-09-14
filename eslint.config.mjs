/**
 * Flat config, because ESLint 9 no longer reads .eslintrc.
 *
 * `next/core-web-vitals` is the same rule set as before; eslint-config-next 16
 * ships it as a flat array, so it is imported rather than translated.
 *
 * The ignore list is read from .gitignore rather than retyped. Flat config does
 * not honour .gitignore on its own, and the files that matter here — the 1.25 MB
 * generated standalone, the verify shims, the built book — are exactly the ones
 * already listed there. Two lists would drift, and the way you find out is a
 * lint run that takes a minute and reports a parse error in a generated file.
 */
import { readFileSync } from "node:fs";
import next from "eslint-config-next/core-web-vitals";

const gitignored = readFileSync(new URL(".gitignore", import.meta.url), "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => (line.endsWith("/") ? `${line}**` : line));

const config = [
  { ignores: [...gitignored, "coverage/**", "data/**"] },
  ...next
];

export default config;
