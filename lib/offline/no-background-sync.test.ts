// docs/tasks/08-offline-sync.md: "The Background Sync API does not exist on
// iOS — never architect around it." A static source scan, not a runtime
// check — the point is that nobody ever reaches for it again later, not
// just that this module avoids it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCAN_DIRS = ["app", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next"]);
const FORBIDDEN =
  /navigator\.sync|ServiceWorkerRegistration\.prototype\.sync|\bsync\.register\(/;

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    if (SKIP_DIRS.has(entry)) return [];
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    if (/\.(ts|tsx|js|jsx)$/.test(entry) && !entry.endsWith(".test.ts")) return [full];
    return [];
  });
}

describe("no Background Sync API usage", () => {
  it("no source file under app/ or lib/ references navigator.sync / Background Sync", () => {
    const root = join(__dirname, "..", "..");
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(root, dir))) {
        const content = readFileSync(file, "utf8");
        if (FORBIDDEN.test(content)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
