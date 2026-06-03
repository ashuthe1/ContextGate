import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import YAML from "yaml";
import type { PolicyEditorDocument } from "../../../packages/core/src/index.js";
import { ConfigError, loadConfig } from "../../../packages/core/src/index.js";
import { defaultPolicyDocument } from "../../../packages/policy/src/index.js";

export async function loadPolicyEditor(configPath = "contextgate.yaml"): Promise<PolicyEditorDocument> {
  const loaded = await loadConfig(configPath);
  const policyPath = loaded.config.policy.file
    ? resolve(dirname(loaded.path), loaded.config.policy.file)
    : undefined;

  if (!policyPath) {
    const generated = YAML.stringify(defaultPolicyDocument(loaded.config));
    return {
      editable: false,
      text: generated,
    };
  }

  const text = await readFile(policyPath, "utf8");
  return {
    path: policyPath,
    editable: true,
    text,
  };
}

export async function savePolicyEditor(configPath: string | undefined, text: string): Promise<PolicyEditorDocument> {
  const loaded = await loadConfig(configPath);
  const policyPath = loaded.config.policy.file
    ? resolve(dirname(loaded.path), loaded.config.policy.file)
    : undefined;

  if (!policyPath) {
    throw new ConfigError("Config does not define policy.file; UI editing is read-only until a policy file is configured.");
  }

  try {
    YAML.parse(text);
  } catch (error) {
    throw new ConfigError(`Policy YAML is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  await mkdir(dirname(policyPath), { recursive: true });
  await writeFile(policyPath, text);

  return {
    path: policyPath,
    editable: true,
    text,
  };
}
