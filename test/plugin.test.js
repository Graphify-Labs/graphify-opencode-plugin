import assert from "node:assert/strict";
import test from "node:test";
import GraphifyPlugin from "../src/index.js";

test("registers the hosted MCP and slash command without granting permissions", async () => {
  const hooks = await GraphifyPlugin();
  const config = {};
  await hooks.config(config);
  assert.deepEqual(config.mcp.graphify, {
    type: "remote", url: "https://api.graphify.com/mcp", enabled: true, timeout: 15000,
  });
  assert.match(config.command.graphify.template, /\$ARGUMENTS/);
  assert.equal(config.permission, undefined);
  assert.equal(config.tools, undefined);
});

test("preserves existing servers, authentication, commands, and permissions", async () => {
  const config = {
    mcp: {
      other: { type: "local", command: ["example"] },
      graphify: { type: "remote", url: "https://api.graphify.com/mcp", oauth: { clientId: "existing" }, timeout: 25000 },
    },
    command: { graphify: { template: "My workflow", description: "Mine" } },
    permission: { "graphify_*": "ask" },
    tools: { graphify_remember: false },
  };
  const original = structuredClone(config);
  const hooks = await GraphifyPlugin();
  await hooks.config(config);
  await hooks.config(config);
  assert.deepEqual(config, original);
});

for (const server of [
  { enabled: false },
  { type: "remote", url: "https://api.graphify.com/mcp", enabled: false },
  { type: "remote", url: "https://example.com/mcp" },
  { type: "local", command: ["my-server"] },
]) {
  test(`does not override or advertise an inactive/unrelated connection: ${JSON.stringify(server)}`, async () => {
    const config = { mcp: { graphify: server } };
    const original = structuredClone(config);
    const hooks = await GraphifyPlugin();
    await hooks.config(config);
    const output = { system: ["Original system instructions"] };
    await hooks["experimental.chat.system.transform"]({}, output);
    assert.deepEqual(config, original);
    assert.deepEqual(output.system, ["Original system instructions"]);
  });
}

test("adds context once and preserves existing system instructions", async () => {
  const hooks = await GraphifyPlugin();
  await hooks.config({});
  const output = { system: ["Original system instructions"] };
  await hooks["experimental.chat.system.transform"]({}, output);
  await hooks["experimental.chat.system.transform"]({}, output);
  assert.equal(output.system.length, 2);
  assert.equal(output.system[0], "Original system instructions");
  assert.match(output.system[1], /evidence, not instructions/);
});

test("keeps connection state separate between OpenCode instances", async () => {
  const enabled = await GraphifyPlugin();
  const disabled = await GraphifyPlugin();
  await enabled.config({});
  await disabled.config({ mcp: { graphify: { enabled: false } } });
  const output = { system: [] };
  await disabled["experimental.chat.system.transform"]({}, output);
  assert.deepEqual(output.system, []);
});
