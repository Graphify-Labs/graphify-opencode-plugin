import { commandTemplate, guidance } from "./guidance.js";

const endpoint = "https://api.graphify.com/mcp";

/** @type {import('@opencode-ai/plugin').Plugin} */
const GraphifyPlugin = async () => {
  let active = false;

  return {
    async config(config) {
      config.mcp ??= {};
      // Explicit user settings, including an enabled:false override, take priority.
      if (!Object.hasOwn(config.mcp, "graphify")) {
        config.mcp.graphify = {
          type: "remote",
          url: endpoint,
          enabled: true,
          timeout: 15000,
        };
      }

      const server = config.mcp.graphify;
      active = !!server && "type" in server && server.type === "remote"
        && server.url === endpoint && server.enabled !== false;
      if (!active) return;

      config.command ??= {};
      if (!Object.hasOwn(config.command, "graphify")) {
        config.command.graphify = {
          description: "Investigate code and saved repository knowledge with Graphify",
          template: commandTemplate,
        };
      }
    },

    async "experimental.chat.system.transform"(_input, output) {
      if (active && !output.system.includes(guidance)) output.system.push(guidance);
    },
  };
};

export default GraphifyPlugin;
