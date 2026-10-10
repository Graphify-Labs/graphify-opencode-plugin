# Changelog

## 1.1.0

- Add an OpenCode v2 `setup(ctx)` entrypoint while keeping OpenCode v1 support through `server()`.
- Register Graphify under OpenCode v2 MCP servers and add `/graphify` through the v2 command transform API.
- Inject Graphify guidance through OpenCode v2 session hooks.
- Document OpenCode v1 and v2 configuration examples.

## 1.0.0

- Connect Graphify's hosted MCP using OpenCode's native OAuth support.
- Add `/graphify` and guidance for repository search, dependencies, impact, and saved knowledge.
- Preserve existing MCP, command, tool, and permission settings.
