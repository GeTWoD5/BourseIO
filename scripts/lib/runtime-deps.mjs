import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";

export function requireRuntimePackage(packageName) {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire(packageName);
  } catch {
    const runtimeModules = path.join(os.homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "node_modules");
    if (!existsSync(runtimeModules)) {
      throw new Error(`Package "${packageName}" is missing. Install it locally or run inside Codex with bundled dependencies.`);
    }
    return createRequire(path.join(runtimeModules, "package.json"))(packageName);
  }
}
