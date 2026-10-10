import type { Plugin } from "@opencode-ai/plugin";
type Cleanup = () => Promise<void> | void;
declare const GraphifyPlugin: {
  readonly id: "graphify.opencode";
  readonly setup: (context: unknown) => Promise<Cleanup | void> | Cleanup | void;
  readonly server: Plugin;
};
export default GraphifyPlugin;
