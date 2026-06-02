#!/usr/bin/env node
import { startDaemon } from "./server.js";

const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const configArg = process.argv.find((arg) => arg.startsWith("--config="));

const { url } = await startDaemon({
  port: portArg ? Number(portArg.slice("--port=".length)) : undefined,
  configPath: configArg ? configArg.slice("--config=".length) : undefined,
});

console.log(`ContextGate daemon listening on ${url}`);
