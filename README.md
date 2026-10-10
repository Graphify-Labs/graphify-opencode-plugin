# Graphify for OpenCode

Bring Graphify's indexed code intelligence and repository memory into OpenCode.
Find symbols, investigate dependencies and change impact, and retrieve saved
repository knowledge through [Graphify MCP](https://graphify.com/mcp).

This plugin connects `https://api.graphify.com/mcp`, adds the `/graphify` command,
and gives the assistant guidance for using repository evidence. OpenCode manages
MCP transport, browser OAuth, and credentials. There are no runtime dependencies,
bundled API keys, or install scripts.

## Install

Requires OpenCode's v1 plugin API; tested with **OpenCode 1.18.35**. OpenCode v2
has a different plugin API and has not been validated with this release.
You also need a Graphify account with an accessible indexed repository and a
working model provider in OpenCode. Graphify sign-in is separate from model-provider sign-in.

Add this entry to your existing `opencode.json` (project) or
`~/.config/opencode/opencode.json` (global), keeping any existing plugin entries:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["graphify-opencode@1.0.0"]
}
```

OpenCode installs npm plugins at startup. From the configured project, sign in:

```sh
opencode mcp auth graphify
opencode mcp list
opencode
```

Complete Graphify sign-in in the browser while the terminal remains running.
In OpenCode, try:

```text
/graphify Explain how authentication works in my repository, with file and symbol references.
/graphify What callers and tests might be affected by changing the payment handler?
/graphify Find saved knowledge relevant to the indexing pipeline.
```

The server supplies the current tool names and schemas. The plugin does not
require a fixed tool list or run Graphify locally.

## Existing settings

The plugin adds a `graphify` MCP entry in memory only when one is absent. It does
not rewrite your configuration file or replace an existing connection. It also
preserves an existing `/graphify` command and your tool and permission settings.
Plugin-specific guidance is active only for an enabled remote `graphify` entry
whose URL is exactly `https://api.graphify.com/mcp`.

To disable Graphify, add this to your configuration and restart OpenCode:

```json
{
  "mcp": {
    "graphify": { "enabled": false }
  }
}
```

You can use the hosted MCP without this plugin, or configure it explicitly if
your OpenCode build does not expose plugin-added servers to its MCP commands:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "graphify": {
      "type": "remote",
      "url": "https://api.graphify.com/mcp",
      "enabled": true,
      "timeout": 15000
    }
  }
}
```

## Data and permissions

When the assistant uses a Graphify tool, its arguments are sent to Graphify's
hosted service. Results can become context for your selected model provider.
The plugin itself does not scan or upload local files, store credentials, or
automatically save memories. Graphify processes requests under your account's
repository access and billing.

Some server tools save memory or change workspace settings, including the
account's default workspace. When trail capture is enabled, some search and
recall tools may also record query context. Review tool descriptions and configure
[OpenCode permissions](https://opencode.ai/docs/permissions/) for your needs.
Plugin guidance is advisory; OpenCode's permissions remain the enforcement layer.

Graph results describe an indexed snapshot. Verify them against current local
code before editing. Graphify's suggested tests are recommendations, not test runs.
See [Privacy](https://graphify.com/privacy) and [Terms](https://graphify.com/terms).

## Troubleshooting

- **Server needs authentication:** run `opencode mcp auth graphify` from the
  configured project and complete the new browser flow.
- **Browser cannot reach localhost:** keep the initiating terminal alive and
  use the same machine for the browser and CLI. Restart authentication if the
  callback listener has stopped; do not reuse an old callback URL. WSL, SSH, and
  containers may need loopback forwarding appropriate to your environment.
- **Server not found:** confirm the plugin loaded, restart OpenCode, and use the
  explicit MCP configuration above if needed.
- **Connection trouble:** run `opencode mcp debug graphify`. Remove credentials,
  authorization URLs, and private repository details before sharing diagnostics.
- **Wrong or missing repository:** verify repository indexing and workspace
  access in Graphify. Do not assume the local folder has already been indexed.
- **Sign out:** run `opencode mcp logout graphify`.
- **Uninstall:** remove this plugin entry and any explicit `mcp.graphify` entry,
  then restart OpenCode. Sign out first if you also want to remove stored credentials.

## Development

```sh
npm ci
npm test
npm run check
npm pack --dry-run
```

The package exports one v1 plugin function. Unit tests exercise registration,
configuration preservation, disabled connections, and isolated guidance.

[Website](https://graphify.com) · [Documentation](https://docs.graphify.com) ·
[Support](mailto:founders@graphify.com) ·
[OpenCode plugins](https://opencode.ai/docs/plugins/)
