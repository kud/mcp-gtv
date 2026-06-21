#!/usr/bin/env node
import { argv } from "node:process"
import { pathToFileURL } from "node:url"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  listDevices,
  getCurrentDevice,
  findDevice,
  setCurrentDevice,
  KEYS,
  sendKey as sendKeyCommand,
  launchApp as launchAppCommand,
  withRemote,
  findApp,
  listApps,
  appLink,
} from "@kud/gtv"

export const ok = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    },
  ],
})

export const err = (message: string) => ({
  content: [{ type: "text" as const, text: `Error: ${message}` }],
  isError: true,
})

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

// ─── Devices ───

// All control tools act on the *current* device — the one last selected by the
// gtv CLI or by gtv_set_device. Pairing is intentionally left to the CLI; this
// server only consumes already-paired devices from ~/.config/gtv.
export const listGtvDevices = async () => {
  const current = getCurrentDevice()
  const devices = listDevices().map((device) => ({
    host: device.host,
    name: device.name ?? null,
    paired: Boolean(device.cert),
    current: device.host === current?.host,
  }))
  return devices.length === 0
    ? err("No paired devices. Pair one with `gtv pair` in the CLI first.")
    : ok(devices)
}

export const setGtvDevice = async ({ device }: { device: string }) => {
  const match = findDevice(device)
  if (!match)
    return err(
      `No paired device matching "${device}". Use gtv_list_devices to see options.`,
    )
  setCurrentDevice(match.host)
  return ok({ current: match.host, name: match.name ?? null })
}

// ─── Control ───

const keyNames = Object.keys(KEYS) as [string, ...string[]]

export const sendGtvKey = async ({ key }: { key: string }) => {
  const code = KEYS[key]
  if (code === undefined)
    return err(`Unknown key "${key}". Valid keys: ${keyNames.join(", ")}`)
  try {
    await sendKeyCommand(code)
    return ok({ sent: key })
  } catch (e) {
    return err(reason(e))
  }
}

export const typeGtvText = async ({ text }: { text: string }) => {
  try {
    await withRemote((remote) => {
      remote.sendText(text)
    })
    return ok({ typed: text })
  } catch (e) {
    return err(reason(e))
  }
}

export const launchGtvApp = async ({ app }: { app: string }) => {
  const deeplink = app.includes("://") ? app : resolveAppLink(app)
  if (!deeplink)
    return err(
      `Unknown app "${app}". Known apps: ${listApps()
        .map((a) => a.id)
        .join(", ")}. You can also pass a raw deep-link URI.`,
    )
  try {
    await launchAppCommand(deeplink)
    return ok({ launched: app, deeplink })
  } catch (e) {
    return err(reason(e))
  }
}

const resolveAppLink = (query: string): string | null => {
  const entry = findApp(query)
  return entry ? appLink(entry) : null
}

// ─── Server ───

const server = new McpServer({ name: "gtv", version: "0.1.0" })

server.registerTool(
  "gtv_list_devices",
  {
    description:
      "List Google TV devices already paired via the gtv CLI, marking the current one.",
    inputSchema: {},
  },
  listGtvDevices,
)

server.registerTool(
  "gtv_set_device",
  {
    description:
      "Select which paired device subsequent commands target, by host (e.g. 192.168.1.42) or name.",
    inputSchema: {
      device: z.string().describe("Device host (IP) or name"),
    },
  },
  setGtvDevice,
)

server.registerTool(
  "gtv_send_key",
  {
    description:
      "Send a single remote key press to the current device (navigation, media, volume, power…).",
    inputSchema: {
      key: z.enum(keyNames).describe("Remote key name, e.g. home, up, play"),
    },
  },
  sendGtvKey,
)

server.registerTool(
  "gtv_type_text",
  {
    description:
      "Type arbitrary text into the focused field on the current device via IME (no keycode mapping).",
    inputSchema: {
      text: z.string().describe("Text to type into the focused field"),
    },
  },
  typeGtvText,
)

server.registerTool(
  "gtv_launch_app",
  {
    description:
      "Launch an app on the current device by catalog name/id (e.g. netflix, youtube) or a raw deep-link URI.",
    inputSchema: {
      app: z.string().describe("App catalog name/id or a deep-link URI"),
    },
  },
  launchGtvApp,
)

const main = async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-gtv running")
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main().catch((e) => {
    console.error("Fatal:", e)
    process.exit(1)
  })
}
