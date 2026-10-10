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

async function registerV2GuidanceHook(ctx, isActive) {
  const addGuidance = (event) => {
    if (!isActive() || !Array.isArray(event.system)) return;
    addV2Guidance(event.system);
  };

  try {
    await ctx.session.hook("context", addGuidance);
  } catch (error) {
    await ctx.session.hook("request", addGuidance);
  }
}

function updateV2Command(commands) {
  if (typeof commands.get === "function" && commands.get("graphify")) return;

  if (typeof commands.update === "function") {
    commands.update("graphify", (command) => {
      command.description ??= commandDescription;
      command.template ??= commandTemplate;
    });
    return;
  }

  if (typeof commands.add === "function") {
    commands.add({
      name: "graphify",
      description: commandDescription,
      async execute() {
        throw new Error("The Graphify command requires OpenCode's template command API.");
      },
    });
  }
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

  if (active) {
    await ctx.command.transform(updateV2Command);
  }

  await registerV2GuidanceHook(ctx, () => active);
}

const GraphifyPlugin = {
  id: "graphify.opencode",
  setup: setupV2,
  server: createV1Server,
};

export default GraphifyPlugin;
