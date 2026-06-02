import type { Command } from "commander";
import { startDaemon } from "../../../daemon/src/server.js";

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start the local ContextGate HTTP daemon.")
    .option("-c, --config <path>", "Path to contextgate.yaml.", "contextgate.yaml")
    .option("-p, --port <port>", "Port to listen on.", "3737")
    .action(async (options: { config: string; port: string }) => {
      const { url } = await startDaemon({
        configPath: options.config,
        port: Number(options.port),
      });
      console.log(`ContextGate daemon listening on ${url}`);
    });
}
