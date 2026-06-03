import { ContextGate } from "../../../packages/sdk/src/index.js";
import { startDaemon } from "../../../apps/daemon/src/server.js";

const prompt = "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix";
const configPath = process.env.CONTEXTGATE_CONFIG;
const existingBaseUrl = process.env.CONTEXTGATE_BASE_URL;

const daemon = existingBaseUrl
  ? undefined
  : await startDaemon({
      configPath,
      host: "127.0.0.1",
      port: 3737,
    });

try {
  const gate = new ContextGate({
    baseUrl: existingBaseUrl ?? daemon?.url ?? "http://127.0.0.1:3737",
  });
  const selection = await gate.selectTools({
    prompt,
    projectId: "sample-agent",
  });

  if (!selection.capabilityId) {
    throw new Error("Expected a capability id from non-dry-run tool selection.");
  }

  console.log(`Selected ${selection.selected.length} tools from ${selection.totalTools}.`);
  console.log(`Task: ${selection.taskId}`);
  console.log(`Capability: ${selection.capabilityId}`);

  const allowed = await gate.callTool({
    taskId: selection.taskId,
    capabilityId: selection.capabilityId,
    toolId: "jira.get_issue",
    arguments: {
      key: "PROJ-123",
    },
  });

  console.log("Allowed call:");
  console.log(JSON.stringify(allowed, null, 2));

  const blocked = await gate.callTool({
    taskId: selection.taskId,
    capabilityId: selection.capabilityId,
    toolId: "github.delete_repository",
    arguments: {
      repo: "ash/contextgate",
    },
  });

  console.log("Guessed dangerous call:");
  console.log(JSON.stringify(blocked, null, 2));

  const explanation = await gate.explainTask(selection.taskId);
  console.log(`Explained task with ${explanation.selected.length} selected tools.`);
} finally {
  await daemon?.close();
}
