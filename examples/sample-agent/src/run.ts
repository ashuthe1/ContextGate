import { LocalExecutionGateway, selectTools } from "../../../packages/gateway/src/index.js";

const prompt = "Read Jira ticket PROJ-123, inspect the repo, and open a PR with a fix";

const { result } = await selectTools({ prompt });
if (!result.capabilityId) {
  throw new Error("Expected a capability id from non-dry-run tool selection.");
}

console.log(`Selected ${result.selected.length} tools from ${result.totalTools}.`);
console.log(`Task: ${result.taskId}`);
console.log(`Capability: ${result.capabilityId}`);

const gateway = new LocalExecutionGateway();

const allowed = await gateway.callTool({
  taskId: result.taskId,
  capabilityId: result.capabilityId,
  toolId: "jira.get_issue",
  arguments: {
    key: "PROJ-123",
  },
});

console.log("Allowed call:");
console.log(JSON.stringify(allowed, null, 2));

const blocked = await gateway.callTool({
  taskId: result.taskId,
  capabilityId: result.capabilityId,
  toolId: "github.delete_repository",
  arguments: {
    repo: "ash/contextgate",
  },
});

console.log("Guessed dangerous call:");
console.log(JSON.stringify(blocked, null, 2));
