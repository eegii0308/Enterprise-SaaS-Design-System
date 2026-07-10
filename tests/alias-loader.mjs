import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const candidateSuffixes = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const basePath = path.join(projectRoot, specifier.slice(2));

  for (const suffix of candidateSuffixes) {
    const candidate = basePath + suffix;
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context);
    }
  }

  return nextResolve(specifier, context);
}

// TS's `resolveJsonModule` allows bare `import x from "./y.json"`, but
// Node's native loader requires an explicit `type: "json"` import
// attribute. Short-circuit the load so source doesn't need to change.
export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = await readFile(fileURLToPath(url), "utf8");
    return { format: "json", source, shortCircuit: true };
  }

  return nextLoad(url, context);
}
