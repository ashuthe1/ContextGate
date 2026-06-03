import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { exportPolicyBundle, importPolicyBundle, readPolicyBundle, verifyPolicyBundle } from "./bundles.js";

describe("policy bundles", () => {
  it("exports, verifies, and imports a policy bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "contextgate-policy-bundle-"));
    const configPath = join(root, "contextgate.yaml");
    const policyPath = join(root, "team-policy.yaml");
    const bundlePath = join(root, "team-policy.bundle.json");
    const installPath = join(root, "installed-policy.yaml");

    await writeFile(
      policyPath,
      ["version: 1", "defaults:", "  unknownToolMode: ask", ""].join("\n"),
    );
    await writeFile(
      configPath,
      ["version: 1", "servers:", "  jira:", "    transport: mock", "policy:", "  file: team-policy.yaml", ""].join("\n"),
    );

    const bundle = await exportPolicyBundle({
      configPath,
      bundleName: "team-safe",
      outputPath: bundlePath,
    });

    expect(bundle.bundleName).toBe("team-safe");
    const persisted = await readPolicyBundle(bundlePath);
    expect(verifyPolicyBundle(persisted).valid).toBe(true);

    const imported = await importPolicyBundle({
      bundlePath,
      outputPath: installPath,
    });
    expect(imported.installedPath).toBe(installPath);
    expect(await readFile(installPath, "utf8")).toContain("unknownToolMode: ask");
  });
});
