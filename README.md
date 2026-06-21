<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/npm/v/@kud/mcp-gtv?style=flat-square&color=CB3837)
![Experimental](https://img.shields.io/badge/status-proof%20of%20concept-orange?style=flat-square)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**MCP server for Google TV — control paired devices (keys, text, app launch) via @kud/gtv.**

[Features](#-features) • [Quick Start](#-quick-start) • [MCP Client Setup](#-mcp-client-setup) • [Tools Reference](#-tools-reference) • [Development](#-development)

</div>

> **Proof of concept — experimental and unfinished.**
> This package is not yet published to npm. The API, tool names, and behaviour may change or break at any time. Run it from source (see [Development](#-development)). Do not use in production.

`@kud/mcp-gtv` exposes Google TV control to any MCP client, letting an assistant open apps, control playback, type into search fields, and read back what's currently on the TV.

## 🌟 Features

- 🔌 **Zero credentials** — reads paired devices from `~/.config/gtv/config.json`; no API key, no token, no extra setup
- 📺 **Device switching** — list all paired TVs and switch the active target at any time during a session
- 🎮 **Full remote control** — send any key from navigation and media to volume, power, and input
- ⌨️ **IME text input** — type arbitrary text into the focused field directly, without keycode mapping
- 🚀 **App launcher** — launch Netflix, YouTube, Prime Video, Spotify, and more by name, or pass any raw deep-link URI
- 📡 **State feedback** — every control tool returns the TV's resulting state (power, volume, foreground app) so the model can confirm its action landed
- 🤖 **Broad MCP client support** — stdio transport works with Claude Desktop, Claude Code, Cursor, and any MCP-compatible client

## 🚀 Quick Start

### 1. Pair your TV first

Pairing is handled by `@kud/gtv-cli`, not this server. If you have not paired a device yet:

```sh
npx @kud/gtv-cli pair
```

Follow the PIN prompt on the TV. The paired device is written to `~/.config/gtv/config.json` — the shared config store that `mcp-gtv` reads automatically. You only need to do this once per device.

### 2. Run the server from source

The package is not yet on npm. Clone the repo and run with `tsx`:

```sh
git clone https://github.com/kud/mcp-gtv.git
cd mcp-gtv
npm install
npm run dev
```

### 3. Ask naturally

Once an MCP client has the server connected:

> "What's playing on the TV right now?"
> "Open Netflix"
> "Turn up the volume"
> "Go back to the home screen"
> "Type 'Blade Runner' into the search field"

### What it's good at

This server works well for discrete, confirmable actions: opening apps, controlling playback, adjusting volume, typing into search, and checking what's currently on screen. It is **not** suited to navigating menus or lists inside an app — see [Known Limitations](#-known-limitations).

## 🔧 MCP Client Setup

The server uses **stdio transport** and requires no environment variables.

> **Not yet on npm.** The `npx @kud/mcp-gtv` form shown below will not work until the first publish. For now, use the local dev config instead.

### Local development (current)

Add to `.mcp.json` in your project root, pointing at your local clone:

```json
{
  "mcpServers": {
    "mcp-gtv": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp-gtv/src/index.ts"]
    }
  }
}
```

The repo also ships a `.mcp.json` at the root — open the repo in Claude Code and it will be picked up automatically.

### Claude Desktop / Claude Code (once published)

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

### Cursor / other MCP clients

Use the same `npx -y @kud/mcp-gtv` command with stdio transport once published. Consult your client's documentation for the exact config location.

## 🛠 Tools Reference

Every control tool returns the TV's resulting state (connected, powered, foreground app, volume) so the model can confirm its action landed.

| Tool               | Description                                                                                                         | Arguments        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `gtv_list_devices` | List all paired devices, marking the current one                                                                    | —                |
| `gtv_set_device`   | Switch the active device by host (IP) or name                                                                       | `device: string` |
| `gtv_get_state`    | Read live state: connected, powered, foreground app (package + friendly name), volume                               | —                |
| `gtv_send_key`     | Send a remote key press; power and volume keys wait for the state echo                                              | `key: string`    |
| `gtv_type_text`    | Type text into the focused field via IME                                                                            | `text: string`   |
| `gtv_launch_app`   | Launch an app by catalog name/id or deep-link URI; waits for and returns the foreground app with a `confirmed` flag | `app: string`    |

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

You can also pass any raw deep-link URI directly (e.g. `intent://...` or `market://launch?id=com.example.app`).

## ⚠️ Known Limitations

- **No screen awareness.** The Android TV Remote protocol only streams power state, volume, and foreground app package — never screen contents, focus position, or menu structure. The server can launch apps, control playback, type into search, and confirm those actions landed. It **cannot** see the screen, so navigating menus, folders, or lists inside an app is not reliably possible. Deep in-app navigation would require an ADB or computer-vision channel; that is deliberately out of scope.

- **Store-mediated app launching.** App launch uses `market://launch?id=<package>`, which the Play Store may auto-launch OR simply display as a store listing (showing an "Open" button) even when the app is installed. Reliable direct launch is not available over the remote protocol. When the store page opens instead, send `select` to open the app.

- **Current device only.** All tools act on the device selected by `gtv_set_device` (or the default from the config). Interactive pairing over MCP is not implemented — pair first with `npx @kud/gtv-cli pair`.

- **First-call latency.** The first tool call in a session opens a TLS connection and waits for the TV's telemetry burst to settle (~350 ms quiet, capped at 2 s). Subsequent calls reuse the warm session and are near-instant.

## 🔧 Development

### Project layout

```
mcp-gtv/
├── src/
│   └── index.ts        # MCP server — session management, all tool handlers
├── test/
│   └── tools.test.ts   # Unit tests (Node built-in test runner)
├── dist/               # Compiled output (tsup, gitignored)
├── .mcp.json           # Local MCP client config for dev (auto-loaded by Claude Code)
├── TESTING.md          # Manual test plan — run against a real TV before publishing
└── tsup.config.ts
```

### Scripts

| Script                | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Run source directly with `tsx`                  |
| `npm run build`       | Compile to `dist/` via tsup                     |
| `npm run build:watch` | Watch mode                                      |
| `npm run test`        | Run test suite (Node built-in runner)           |
| `npm run typecheck`   | TypeScript type check only                      |
| `npm run inspect`     | Open MCP Inspector for interactive tool testing |

### Clone and run

```sh
git clone https://github.com/kud/mcp-gtv.git
cd mcp-gtv
npm install
npm run dev
```

Use `npm run inspect` to open the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) and exercise all tools interactively without a full MCP client.

### Testing

A manual test plan that covers every tool against a real TV lives in [`TESTING.md`](TESTING.md). Run through it before any publish.

### Releasing

Releases are tag-driven via GitHub Actions with OIDC Trusted Publishers — no manual `npm publish` needed. The first publish has not happened yet; once the initial OTP bootstrap is done, subsequent releases will follow the tag workflow:

```sh
git tag v0.2.0
git push origin v0.2.0
```

## 🏗 Tech Stack

| Package                                                                               | Role                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`@kud/gtv`](https://github.com/kud/gtv)                                              | Google TV domain library — device store, key codes, app catalogue, remote connection |
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

This server is the MCP client surface of the ecosystem. [`@kud/gtv-cli`](https://github.com/kud/gtv-cli) is the interactive terminal counterpart — and the tool you use to pair devices before this server can control them.

---

MIT © [kud](https://github.com/kud) — Made with ❤️
