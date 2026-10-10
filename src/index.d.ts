import type { Plugin } from "@opencode/plugin";
declare const GraphifyPlugin: Plugin.Plugin & {
  readonly id: "graphify.opencode";
  readonly server: import("@opencode-ai/plugin").Plugin;
};
export default GraphifyPlugin;
