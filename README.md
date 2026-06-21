<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/mcp-gtv?style=flat-square&color=CB3837)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**MCP server for Google TV — control paired devices (keys, text, app launch) via @kud/gtv.**

[Features](#-features) • [Quick Start](#-quick-start) • [MCP Client Setup](#-mcp-client-setup) • [Tools Reference](#-tools-reference) • [Development](#-development)

</div>

## 🌟 Features

- 🔌 **Zero credentials** — reads paired devices from `~/.config/gtv/config.json`; no API key, no token, no extra setup
- 📺 **Device switching** — list all paired TVs and switch the active target at any time during a session
- 🎮 **Full remote control** — send any key from navigation and media to volume, power, and input
- ⌨️ **IME text input** — type arbitrary text into the focused field directly, without keycode mapping
- 🚀 **App launcher** — launch Netflix, YouTube, Prime Video, Spotify, and more by name, or pass any raw deep-link URI
- 🤖 **Works everywhere** — stdio transport is compatible with Claude Desktop, Claude Code, Cursor, and any MCP client

## 🚀 Quick Start

### 1. Pair your TV first

Pairing is handled by the `gtv` CLI, not this server. If you have not paired yet:

```sh
npx @kud/gtv-cli pair
```

Follow the PIN prompt on the TV. The paired device is stored in `~/.config/gtv/config.json` and shared automatically with this server.

### 2. Add the server to your MCP client

See [MCP Client Setup](#-mcp-client-setup) below.

### 3. Ask Claude

Once the server is running, ask naturally:

> "Turn up the volume on my TV"
> "Open Netflix"
> "Go back to the home screen"
> "Type 'Blade Runner' into the search field"

## 🔧 MCP Client Setup

The server uses **stdio transport** and requires no environment variables.

### Claude Desktop / Claude Code

Add the following to your `mcpServers` configuration:

```json
{
  "mcpServers": {
    "mcp-gtv": {
      "command": "npx",
      "args": ["-y", "@kud/mcp-gtv"]
    }
  }
}
```

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`.

**Claude Code** — add to `.mcp.json` in your project root, or to `~/.claude/mcp.json` for global availability.

### Local development

```json
{
  "mcpServers": {
    "mcp-gtv": {
      "command": "npx",
      "args": ["tsx", "src/index.ts"]
    }
  }
}
```

### Cursor / other MCP clients

Use the same `npx -y @kud/mcp-gtv` command with stdio transport. Consult your client's documentation for the exact config location.

## 🛠 Tools Reference

Every control tool returns the TV's resulting state (connected, powered, foreground app, volume) so the model can confirm its action landed.

| Tool               | Description                                                    | Arguments        |
| ------------------ | -------------------------------------------------------------- | ---------------- |
| `gtv_list_devices` | List all paired devices, marking the current one               | —                |
| `gtv_set_device`   | Switch the active device by host (IP) or name                  | `device: string` |
| `gtv_get_state`    | Read live state: connected, powered, foreground app, volume    | —                |
| `gtv_send_key`     | Send a remote key press; returns resulting state               | `key: string`    |
| `gtv_type_text`    | Type text into the focused field via IME; returns state        | `text: string`   |
| `gtv_launch_app`   | Launch an app by name/id or URI; waits for and returns the app | `app: string`    |

### Valid keys for `gtv_send_key`

```
home  back  power  up  down  left  right  select
play  stop  next   prev  fwd  rwd
vol-up  vol-down  mute
menu  search  sleep  wakeup  input  enter
channel-up  channel-down  info  guide  settings
```

### App catalogue for `gtv_launch_app`

| ID           | App         |
| ------------ | ----------- |
| `netflix`    | Netflix     |
| `youtube`    | YouTube     |
| `primevideo` | Prime Video |
| `plex`       | Plex        |
| `putio`      | Put.io      |
| `arte`       | Arte        |
| `disney`     | Disney+     |
| `spotify`    | Spotify     |
| `twitch`     | Twitch      |
| `max`        | Max         |

You can also pass any raw deep-link URI directly (e.g. `intent://...`).

## 🔧 Development

### Project layout

```
mcp-gtv/
├── src/
│   └── index.ts       # MCP server, all tool handlers
├── test/
│   └── tools.test.ts  # Unit tests (Node built-in test runner)
├── dist/              # Compiled output (tsup)
├── .mcp.json          # Local MCP client config for dev
└── tsup.config.ts
```

### Scripts

| Script                | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `npm run build`       | Compile to `dist/` via tsup                     |
| `npm run build:watch` | Watch mode                                      |
| `npm run dev`         | Run source directly with tsx                    |
| `npm run test`        | Run test suite                                  |
| `npm run typecheck`   | TypeScript type check only                      |
| `npm run inspect`     | Open MCP Inspector for interactive tool testing |

### Clone and run

```sh
git clone https://github.com/kud/mcp-gtv.git
cd mcp-gtv
npm install
npm run dev
```

Use `npm run inspect` to open the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) and exercise the tools interactively without a full client.

### Releasing

Releases are tag-driven via GitHub Actions with OIDC Trusted Publishers — no manual `npm publish` needed:

```sh
git tag v0.2.0
git push origin v0.2.0
```

## 🏗 Tech Stack

| Package                                                                               | Role                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@kud/gtv`](https://github.com/kud/gtv)                                              | Google TV domain library (device store, key codes, app catalogue, remote connection) |
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | MCP server primitives (`McpServer`, `StdioServerTransport`)                          |
| [`zod`](https://github.com/colinhacks/zod)                                            | Tool input schema validation                                                         |
| [`tsup`](https://github.com/egoist/tsup)                                              | ESM bundler / compiler                                                               |
| [`tsx`](https://github.com/privatenumber/tsx)                                         | TypeScript execution for dev and tests                                               |

### Ecosystem

```
@kud/androidtv-remote   ← low-level pairing & remote protocol
       ↑
  @kud/gtv              ← domain library (devices, keys, apps)
       ↑
  ┌────┴────┐
  │         │
mcp-gtv   gtv-cli       ← MCP surface / terminal surface
```

This server is the MCP client surface. [`@kud/gtv-cli`](https://github.com/kud/gtv-cli) is the interactive terminal counterpart — and the tool you use to pair devices before this server can control them.

---

MIT © [kud](https://github.com/kud) — Made with ❤️
