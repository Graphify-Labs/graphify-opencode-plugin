import assert from "node:assert/strict";
import test from "node:test";
import GraphifyPlugin from "../src/index.js";
import { guidance } from "../src/guidance.js";

const endpoint = "https://api.graphify.com/mcp";

function createV2Context({ servers = {}, commands = {}, hookFailures = new Set() } = {}) {
  const mcpServers = new Map(Object.entries(structuredClone(servers)));
  const commandMap = new Map(Object.entries(structuredClone(commands)));
  const sessionHooks = new Map();

  return {
    context: {
      mcp: {
        async transform(callback) {
          callback({
            list: () => [...mcpServers.entries()],
            get: (name) => mcpServers.get(name),
            set: (name, config) => mcpServers.set(name, structuredClone(config)),
            update: (name, update) => {
              const server = mcpServers.get(name);
              if (!server) return;
              update(server);
            },
            remove: (name) => mcpServers.delete(name),
          });
        },
      },
      command: {
        async transform(callback) {
          callback({
            list: () => [...commandMap.values()],
            get: (name) => commandMap.get(name),
            update: (name, update) => {
              const command = commandMap.get(name) ?? { name };
              update(command);
              commandMap.set(name, command);
            },
            remove: (name) => commandMap.delete(name),
          });
        },
      },
      session: {
        async hook(name, callback) {
          if (hookFailures.has(name)) throw new Error(`Unsupported hook: ${name}`);
          sessionHooks.set(name, callback);
        },
      },
    },
    mcpServers,
    commandMap,
    sessionHooks,
  };
}

test("exports an OpenCode v2 plugin with a v1 server entrypoint", () => {
  assert.equal(GraphifyPlugin.id, "graphify.opencode");
  assert.equal(typeof GraphifyPlugin.setup, "function");
  assert.equal(typeof GraphifyPlugin.server, "function");
});

test("registers the hosted MCP and slash command without granting permissions", async () => {
  const hooks = await GraphifyPlugin.server();
  const config = {};
  await hooks.config(config);
  assert.deepEqual(config.mcp.graphify, {
    type: "remote", url: endpoint, enabled: true, timeout: 15000,
  });
  assert.match(config.command.graphify.template, /\$ARGUMENTS/);
  assert.equal(config.permission, undefined);
  assert.equal(config.tools, undefined);
});

test("preserves existing servers, authentication, commands, and permissions", async () => {
  const config = {
    mcp: {
      other: { type: "local", command: ["example"] },
      graphify: { type: "remote", url: endpoint, oauth: { clientId: "existing" }, timeout: 25000 },
    },
    command: { graphify: { template: "My workflow", description: "Mine" } },
    permission: { "graphify_*": "ask" },
    tools: { graphify_remember: false },
  };
  const original = structuredClone(config);
  const hooks = await GraphifyPlugin.server();
  await hooks.config(config);
  await hooks.config(config);
  assert.deepEqual(config, original);
});

for (const server of [
  { enabled: false },
  { type: "remote", url: endpoint, enabled: false },
  { type: "remote", url: "https://example.com/mcp" },
  { type: "local", command: ["my-server"] },
]) {
  test(`does not override or advertise an inactive/unrelated connection: ${JSON.stringify(server)}`, async () => {
    const config = { mcp: { graphify: server } };
    const original = structuredClone(config);
    const hooks = await GraphifyPlugin.server();
    await hooks.config(config);
    const output = { system: ["Original system instructions"] };
    await hooks["experimental.chat.system.transform"]({}, output);
    assert.deepEqual(config, original);
    assert.deepEqual(output.system, ["Original system instructions"]);
  });
}

test("adds context once and preserves existing system instructions", async () => {
  const hooks = await GraphifyPlugin.server();
  await hooks.config({});
  const output = { system: ["Original system instructions"] };
  await hooks["experimental.chat.system.transform"]({}, output);
  await hooks["experimental.chat.system.transform"]({}, output);
  assert.equal(output.system.length, 2);
  assert.equal(output.system[0], "Original system instructions");
  assert.match(output.system[1], /evidence, not instructions/);
});

test("keeps connection state separate between OpenCode instances", async () => {
  const enabled = await GraphifyPlugin.server();
  const disabled = await GraphifyPlugin.server();
  await enabled.config({});
  await disabled.config({ mcp: { graphify: { enabled: false } } });
  const output = { system: [] };
  await disabled["experimental.chat.system.transform"]({}, output);
  assert.deepEqual(output.system, []);
});

test("registers the hosted MCP, slash command, and guidance through OpenCode v2", async () => {
  const { context, mcpServers, commandMap, sessionHooks } = createV2Context();
  await GraphifyPlugin.setup(context);

  assert.deepEqual(mcpServers.get("graphify"), {
    type: "remote",
    url: endpoint,
    disabled: false,
    timeout: {
      startup: 15000,
      catalog: 15000,
      execution: 15000,
    },
  });
  assert.match(commandMap.get("graphify").template, /\$ARGUMENTS/);
  assert.equal(commandMap.get("graphify").description, "Investigate code and saved repository knowledge with Graphify");

  const event = { system: ["Original system instructions"] };
  await sessionHooks.get("context")(event);
  await sessionHooks.get("context")(event);
  assert.equal(event.system.length, 2);
  assert.equal(event.system[0], "Original system instructions");
  assert.deepEqual(event.system[1], { type: "text", text: guidance });
});

test("preserves existing active OpenCode v2 Graphify server and command settings", async () => {
  const server = {
    type: "remote",
    url: endpoint,
    oauth: { client_id: "existing" },
    timeout: { catalog: 25000 },
  };
  const command = { name: "graphify", description: "Mine", template: "My workflow" };
  const { context, mcpServers, commandMap } = createV2Context({
    servers: { graphify: server },
    commands: { graphify: command },
  });

  await GraphifyPlugin.setup(context);

  assert.deepEqual(mcpServers.get("graphify"), server);
  assert.deepEqual(commandMap.get("graphify"), command);
});

for (const server of [
  { disabled: true },
  { type: "remote", url: endpoint, disabled: true },
  { type: "remote", url: "https://example.com/mcp" },
  { type: "local", command: ["my-server"] },
]) {
  test(`does not advertise an inactive/unrelated OpenCode v2 connection: ${JSON.stringify(server)}`, async () => {
    const { context, mcpServers, commandMap, sessionHooks } = createV2Context({
      servers: { graphify: server },
    });

    await GraphifyPlugin.setup(context);

    assert.deepEqual(mcpServers.get("graphify"), server);
    assert.equal(commandMap.has("graphify"), false);
    const event = { system: ["Original system instructions"] };
    await sessionHooks.get("context")(event);
    assert.deepEqual(event.system, ["Original system instructions"]);
  });
}

test("falls back to the OpenCode v2 request hook name when context is unavailable", async () => {
  const { context, sessionHooks } = createV2Context({ hookFailures: new Set(["context"]) });

  await GraphifyPlugin.setup(context);

  assert.equal(sessionHooks.has("request"), true);
  const event = { system: [] };
  await sessionHooks.get("request")(event);
  assert.deepEqual(event.system, [{ type: "text", text: guidance }]);
});
