import { commandTemplate, guidance } from "./guidance.js";

const endpoint = "https://api.graphify.com/mcp";
const commandDescription = "Investigate code and saved repository knowledge with Graphify";

/** @type {{ type: "remote"; url: string; enabled: true; timeout: number }} */
const v1ServerConfig = {
  type: "remote",
  url: endpoint,
  enabled: true,
  timeout: 15000,
};

/** @type {import('@opencode/plugin').Mcp.RemoteConfig} */
const v2ServerConfig = {
  type: "remote",
  url: endpoint,
  disabled: false,
  timeout: {
    startup: 15000,
    catalog: 15000,
    execution: 15000,
  },
};

function isGraphifyRemote(server) {
  return !!server && "type" in server && server.type === "remote" && server.url === endpoint;
}

function isV1Active(server) {
  return isGraphifyRemote(server) && server.enabled !== false;
}

function isV2Active(server) {
  return isGraphifyRemote(server) && server.disabled !== true;
}

function hasGuidancePart(system) {
  return system.some((part) => {
    if (part === guidance) return true;
    return !!part && typeof part === "object" && part.type === "text" && part.text === guidance;
  });
}

function addV2Guidance(system) {
  if (hasGuidancePart(system)) return;
  system.push({ type: "text", text: guidance });
}

/** @type {import('@opencode-ai/plugin').Plugin} */
const createV1Server = async () => {
  let active = false;

  return {
    async config(config) {
      config.mcp ??= {};
      // Explicit user settings, including an enabled:false override, take priority.
      if (!Object.hasOwn(config.mcp, "graphify")) {
        config.mcp.graphify = { ...v1ServerConfig };
      }

      const server = config.mcp.graphify;
      active = isV1Active(server);
      if (!active) return;

      config.command ??= {};
      if (!Object.hasOwn(config.command, "graphify")) {
        config.command.graphify = {
          description: commandDescription,
          template: commandTemplate,
        };
      }
    },

    async "experimental.chat.system.transform"(_input, output) {
      if (active && !output.system.includes(guidance)) output.system.push(guidance);
    },
  };
};

/** @type {import('@opencode/plugin').Plugin.Plugin['setup']} */
async function setupV2(ctx) {
  let active = false;

  await ctx.mcp.transform((mcp) => {
    const server = mcp.get("graphify");
    if (!server) {
      mcp.set("graphify", v2ServerConfig);
      active = true;
      return;
    }

    active = isV2Active(server);
  });

  // MCP transforms reconcile after setup; register the command independently.
  const commands = await ctx.command.list();
  if (!commands.data.some((command) => command.name === "graphify")) {
    await ctx.command.transform((editor) => {
      editor.add({
        name: "graphify",
        description: commandDescription,
        async execute({ sessionID, prompt, delivery }) {
          if (!active) {
            throw new Error("Graphify MCP is not enabled at https://api.graphify.com/mcp. Check your MCP configuration and restart OpenCode.");
          }
          await ctx.session.prompt({
            ...prompt,
            sessionID,
            text: commandTemplate.replace("$ARGUMENTS", () => prompt.text),
            delivery,
          });
        },
      });
    });
  }

  await ctx.session.hook("context", (event) => {
    if (active) addV2Guidance(event.system);
  });
}

const GraphifyPlugin = {
  id: "graphify.opencode",
  setup: setupV2,
  server: createV1Server,
};

export default GraphifyPlugin;
