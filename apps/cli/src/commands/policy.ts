import type { Command } from "commander";
import {
  assertPolicyTestThresholds,
  createPolicyBundle,
  formatPolicyTestJson,
  formatSelectionResult,
  installPolicyBundle,
  runPolicyCheckSuite,
  selectTools,
  verifyBundleFileWithKey,
  verifyBundleFile,
  writePolicyReport,
} from "../workflows.js";

export function registerPolicyCommands(program: Command): void {
  const policy = program.command("policy").description("Policy utilities.");

  policy
    .command("test")
    .description("Dry-run tool selection without creating a task capability.")
    .argument("<prompt>", "User task prompt.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--max-tools <count>", "Override max selected tools.")
    .option("--json", "Print the full selection result as JSON.")
    .option("--report <path>", "Write the selection result to a JSON report file.")
    .option("--fail-on-blocked", "Exit non-zero if any tools are blocked by policy.")
    .option("--fail-on-hidden", "Exit non-zero if any tools are hidden by policy.")
    .option("--fail-on-empty", "Exit non-zero if no tools are selected.")
    .action(
      async (
        prompt: string,
        options: {
          config: string;
          maxTools?: string;
          json?: boolean;
          report?: string;
          failOnBlocked?: boolean;
          failOnHidden?: boolean;
          failOnEmpty?: boolean;
        },
      ) => {
        const maxTools = options.maxTools ? Number(options.maxTools) : undefined;
        const { result, indexed } = await selectTools({
          prompt,
          configPath: options.config,
          maxTools,
          dryRun: true,
        });

        process.stdout.write(options.json ? formatPolicyTestJson(result) : `${formatSelectionResult(result, { indexed })}\n`);
        if (options.report) {
          await writePolicyReport(options.report, result);
        }
        assertPolicyTestThresholds(result, options);
      },
    );

  policy
    .command("bundle-export")
    .description("Export the configured policy file as a portable shared bundle.")
    .requiredOption("--name <bundleName>", "Bundle name.")
    .requiredOption("--output <path>", "Where to write the bundle JSON.")
    .option("--signing-key-env <envName>", "Read an HMAC signing key from this environment variable.")
    .option("--signing-key-id <keyId>", "Logical key id stored in the bundle signature metadata.")
    .option("--owner <owner>", "Bundle owner/team metadata.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .action(
      async (options: {
        name: string;
        output: string;
        config: string;
        signingKeyEnv?: string;
        signingKeyId?: string;
        owner?: string;
      }) => {
        const signingKey = options.signingKeyEnv ? process.env[options.signingKeyEnv] : undefined;
      const bundle = await createPolicyBundle({
        configPath: options.config,
        bundleName: options.name,
        outputPath: options.output,
        metadata: options.owner ? { owner: options.owner } : undefined,
        signingKey,
        signingKeyId: options.signingKeyId,
      });
      console.log(`exported bundle ${bundle.bundleName}`);
      console.log(`sha256 ${bundle.policySha256}`);
      if (bundle.signature) {
        console.log(`signature ${bundle.signature.algorithm} key=${bundle.signature.keyId}`);
      }
    });

  policy
    .command("bundle-import")
    .description("Install a shared policy bundle into this project or a chosen file path.")
    .argument("<bundlePath>", "Path to a policy bundle JSON file.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--output <path>", "Explicit install path for the policy YAML.")
    .action(async (bundlePath: string, options: { config: string; output?: string }) => {
      const result = await installPolicyBundle({
        bundlePath,
        configPath: options.config,
        outputPath: options.output,
      });
      console.log(`installed bundle ${result.bundle.bundleName}`);
      console.log(`policy path ${result.installedPath}`);
    });

  policy
    .command("bundle-verify")
    .description("Verify the embedded SHA256 digest for a policy bundle.")
    .argument("<bundlePath>", "Path to a policy bundle JSON file.")
    .option("--signing-key-env <envName>", "Read an HMAC signing key from this environment variable for signature verification.")
    .action(async (bundlePath: string, options: { signingKeyEnv?: string }) => {
      const signingKey = options.signingKeyEnv ? process.env[options.signingKeyEnv] : undefined;
      const result = signingKey ? await verifyBundleFileWithKey(bundlePath, signingKey) : await verifyBundleFile(bundlePath);
      console.log(`bundle ${result.bundle.bundleName}`);
      console.log(`expected ${result.expected}`);
      console.log(`actual   ${result.actual}`);
      if (!result.valid) {
        throw new Error("Policy bundle verification failed.");
      }
      if (result.signature.present) {
        console.log(`signature key=${result.signature.keyId ?? "unknown"}`);
        if (!result.signature.valid) {
          throw new Error("Policy bundle signature verification failed.");
        }
      }
      console.log("verification ok");
    });

  policy
    .command("test-file")
    .description("Run a checked-in JSON policy regression suite for CI or team review.")
    .argument("<suitePath>", "Path to a JSON policy check suite.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--json", "Print the full suite result as JSON.")
    .option("--report <path>", "Write the suite result to a JSON report file.")
    .action(async (suitePath: string, options: { config: string; json?: boolean; report?: string }) => {
      const summary = await runPolicyCheckSuite({
        suitePath,
        configPath: options.config,
      });

      const failed = summary.cases.filter((item) => !item.passed);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      } else {
        console.log(`suite cases: ${summary.cases.length}`);
        console.log(`failed: ${failed.length}`);
        for (const item of summary.cases) {
          console.log(`${item.passed ? "pass" : "fail"} ${item.name}${item.error ? ` - ${item.error}` : ""}`);
        }
      }
      if (options.report) {
        await writePolicyReport(options.report, summary);
      }

      if (failed.length > 0) {
        throw new Error(`Policy check suite failed: ${failed.length} case(s) failed.`);
      }
    });

  program
    .command("policy-test")
    .description("Alias for `policy test`.")
    .argument("<prompt>", "User task prompt.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("--max-tools <count>", "Override max selected tools.")
    .option("--json", "Print the full selection result as JSON.")
    .option("--report <path>", "Write the selection result to a JSON report file.")
    .option("--fail-on-blocked", "Exit non-zero if any tools are blocked by policy.")
    .option("--fail-on-hidden", "Exit non-zero if any tools are hidden by policy.")
    .option("--fail-on-empty", "Exit non-zero if no tools are selected.")
    .action(
      async (
        prompt: string,
        options: {
          config: string;
          maxTools?: string;
          json?: boolean;
          report?: string;
          failOnBlocked?: boolean;
          failOnHidden?: boolean;
          failOnEmpty?: boolean;
        },
      ) => {
        const maxTools = options.maxTools ? Number(options.maxTools) : undefined;
        const { result, indexed } = await selectTools({
          prompt,
          configPath: options.config,
          maxTools,
          dryRun: true,
        });

        process.stdout.write(options.json ? formatPolicyTestJson(result) : `${formatSelectionResult(result, { indexed })}\n`);
        if (options.report) {
          await writePolicyReport(options.report, result);
        }
        assertPolicyTestThresholds(result, options);
      },
    );
}
