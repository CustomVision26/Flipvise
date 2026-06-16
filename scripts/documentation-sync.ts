#!/usr/bin/env tsx
/**
 * Documentation sync CLI — keeps user (/docs) and admin (/admin/documentation) guides aligned with UI.
 *
 *   npm run docs:validate   — fail when structure is wrong or UI changed without doc updates
 *   npm run docs:baseline   — refresh documentation-sync-baseline.json after intentional doc edits
 *   npm run docs:stale      — list pages whose watched source files changed without doc updates
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildDocumentationBaseline,
  validateDocumentationSync,
} from "@/lib/documentation-sync/validate";

const rootDir = process.cwd();
const command = process.argv[2] ?? "validate";
const isCi = command === "validate-ci";

function printIssues(result: ReturnType<typeof validateDocumentationSync>): void {
  for (const issue of result.issues) {
    const prefix = issue.level === "error" ? "ERROR" : "WARN";
    const page = issue.pageId ? ` [${issue.pageId}]` : "";
    console.log(`${prefix}${page}: ${issue.message}`);
  }
}

switch (command) {
  case "validate":
  case "validate-ci": {
    const result = validateDocumentationSync({ rootDir, checkStale: !isCi });
    printIssues(result);
    if (!result.ok) {
      console.error(
        "\nDocumentation sync failed. Update guides under src/data/*-documentation* and run npm run docs:baseline.",
      );
      process.exit(1);
    }
    console.log("Documentation sync OK.");
    break;
  }

  case "baseline": {
    const baseline = buildDocumentationBaseline(rootDir);
    const outPath = resolve(rootDir, "documentation-sync-baseline.json");
    writeFileSync(outPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
    console.log(`Wrote ${outPath} (${Object.keys(baseline.pages).length} pages).`);
    break;
  }

  case "stale": {
    const result = validateDocumentationSync({ rootDir, checkStale: true });
    const stale = result.issues.filter((issue) => issue.code === "stale-documentation");
    if (stale.length === 0) {
      console.log("No stale documentation pages.");
      break;
    }
    console.log("Stale documentation pages:");
    for (const issue of stale) {
      console.log(`- ${issue.pageId} (${issue.audience})`);
    }
    process.exit(1);
  }

  default:
    console.error(
      `Unknown command: ${command}\nUsage: tsx scripts/documentation-sync.ts [validate|validate-ci|baseline|stale]`,
    );
    process.exit(1);
}
