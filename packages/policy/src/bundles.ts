import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import YAML from "yaml";
import { ConfigError, hashText, loadConfig, type PolicyBundle } from "../../core/src/index.js";

export async function exportPolicyBundle(input: {
  configPath?: string;
  bundleName: string;
  outputPath: string;
}): Promise<PolicyBundle> {
  const { path: resolvedConfigPath, config } = await loadConfig(input.configPath);
  if (!config.policy.file) {
    throw new ConfigError("Config does not define policy.file, so there is no policy file to bundle.");
  }

  const sourcePolicyPath = resolve(dirname(resolvedConfigPath), config.policy.file);
  const policyText = await readFile(sourcePolicyPath, "utf8");
  validatePolicyYaml(policyText);

  const bundle: PolicyBundle = {
    formatVersion: 1,
    bundleName: input.bundleName,
    exportedAt: new Date().toISOString(),
    policyFileName: basename(sourcePolicyPath),
    sourcePolicyPath,
    policyText,
    policySha256: hashText(policyText),
    metadata: {
      configPath: resolvedConfigPath,
    },
  };

  await mkdir(dirname(resolve(input.outputPath)), { recursive: true });
  await writeFile(resolve(input.outputPath), `${JSON.stringify(bundle, null, 2)}\n`);
  return bundle;
}

export async function importPolicyBundle(input: {
  bundlePath: string;
  outputPath?: string;
  configPath?: string;
}): Promise<{ bundle: PolicyBundle; installedPath: string }> {
  const bundle = await readPolicyBundle(input.bundlePath);
  verifyPolicyBundle(bundle);

  let installedPath: string;
  if (input.outputPath) {
    installedPath = resolve(input.outputPath);
  } else {
    const { path: resolvedConfigPath, config } = await loadConfig(input.configPath);
    if (!config.policy.file) {
      throw new ConfigError("Config does not define policy.file; provide --output to choose an install path.");
    }
    installedPath = resolve(dirname(resolvedConfigPath), config.policy.file);
  }

  await mkdir(dirname(installedPath), { recursive: true });
  await writeFile(installedPath, bundle.policyText);
  return { bundle, installedPath };
}

export async function readPolicyBundle(bundlePath: string): Promise<PolicyBundle> {
  const raw = await readFile(resolve(bundlePath), "utf8");
  const bundle = JSON.parse(raw) as PolicyBundle;
  if (bundle.formatVersion !== 1 || typeof bundle.policyText !== "string" || typeof bundle.policySha256 !== "string") {
    throw new ConfigError(`Invalid policy bundle at ${bundlePath}.`);
  }
  return bundle;
}

export function verifyPolicyBundle(bundle: PolicyBundle): { valid: boolean; expected: string; actual: string } {
  validatePolicyYaml(bundle.policyText);
  const actual = hashText(bundle.policyText);
  return {
    valid: actual === bundle.policySha256,
    expected: bundle.policySha256,
    actual,
  };
}

function validatePolicyYaml(text: string): void {
  try {
    YAML.parse(text);
  } catch (error) {
    throw new ConfigError(`Policy YAML is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
}
