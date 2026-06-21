#!/usr/bin/env node
import { argv } from "node:process"
import { pathToFileURL } from "node:url"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  createSession,
  type Session,
  type SessionState,
  listDevices,
  getCurrentDevice,
  findDevice,
  setCurrentDevice,
  KEYS,
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Session ───

// One warm connection is kept for the life of the server: the first tool call
// connects, the rest reuse it. This removes the per-call TLS handshake AND keeps
// `state` live, so actions can report the TV's reaction back to the model.
let session: Session | null = null

const CONNECT_TIMEOUT_MS = 8000

const awaitReady = (s: Session): Promise<void> =>
  new Promise((resolve, reject) => {
    if (s.state.connected) return resolve()
    if (s.state.error) return reject(new Error(s.state.error))
    const done = (fn: () => void) => {
      clearTimeout(timer)
      s.off("change", onChange)
      fn()
    }
    const onChange = (state: SessionState) => {
      if (state.connected) done(resolve)
      else if (state.error) done(() => reject(new Error(state.error!)))
    }
    const timer = setTimeout(
      () => done(() => reject(new Error("Timed out connecting to the TV."))),
      CONNECT_TIMEOUT_MS,
    )
    s.on("change", onChange)
  })

const hasTelemetry = (state: SessionState) =>
  state.powered !== null || state.volume !== null || state.currentApp !== null

// `ready` fires on the first message (remoteConfigure); the TV then pushes
// powered/volume/current_app as a burst of separate messages over the next few
// hundred ms. Wait for that burst to settle — debounce on `change`, capped — so
// the first state read isn't all nulls.
const settleTelemetry = (s: Session): Promise<void> =>
  new Promise((resolve) => {
    const QUIET_MS = 350
    const MAX_MS = 2000
    let quiet: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      clearTimeout(hard)
      if (quiet) clearTimeout(quiet)
      s.off("change", onChange)
      resolve()
    }
    // Only start the quiet countdown once telemetry has begun, and reset it on
    // each further field — so a gap between burst messages can't end the wait
    // early. If no telemetry ever arrives, the hard cap releases it.
    const arm = () => {
      if (quiet) clearTimeout(quiet)
      quiet = setTimeout(finish, QUIET_MS)
    }
    const onChange = (state: SessionState) => {
      if (hasTelemetry(state)) arm()
    }
    const hard = setTimeout(finish, MAX_MS)
    s.on("change", onChange)
    if (hasTelemetry(s.state)) arm()
  })

const ensureSession = async (): Promise<Session> => {
  if (session?.state.connected) return session
  if (!session || session.state.error) {
    session?.stop()
    session = createSession()
  }
  await awaitReady(session)
  await settleTelemetry(session)
  return session
}

// Resolves once the state matches, or null on timeout — lets an action wait for
// the TV to actually react (e.g. the foreground app changing) before replying.
const waitForChange = (
  s: Session,
  matches: (state: SessionState) => boolean,
  timeoutMs: number,
): Promise<SessionState | null> =>
  new Promise((resolve) => {
    if (matches(s.state)) return resolve(s.state)
    const finish = (value: SessionState | null) => {
      clearTimeout(timer)
      s.off("change", onChange)
      resolve(value)
    }
    const onChange = (state: SessionState) => {
      if (matches(state)) finish(state)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    s.on("change", onChange)
  })

const appNameForPackage = (pkg: string | null) =>
  pkg ? (listApps().find((a) => a.packageName === pkg)?.name ?? null) : null

// The feedback payload returned by every action — the "pong" the model reads.
const snapshot = (s: Session) => ({
  connected: s.state.connected,
  powered: s.state.powered,
  currentApp: s.state.currentApp
    ? {
        package: s.state.currentApp,
        name: appNameForPackage(s.state.currentApp),
      }
    : null,
  volume: s.state.volume,
})

// ─── Devices ───

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
  // Drop the warm session so the next call reconnects to the new device.
  session?.stop()
  session = null
  return ok({ current: match.host, name: match.name ?? null })
}

// ─── State ───

export const getGtvState = async () => {
  try {
    const s = await ensureSession()
    return ok({ tvName: s.state.tvName, host: s.state.host, ...snapshot(s) })
  } catch (e) {
    return err(reason(e))
  }
}

// ─── Control ───

const keyNames = Object.keys(KEYS) as [string, ...string[]]

// Keys whose effect the TV echoes back as a state change — for these we wait for
// the confirmation rather than guessing with a static delay. Nav/media keys
// produce no reliable state echo, so they fall back to a short settle.
const VOLUME_KEYS = new Set(["vol-up", "vol-down", "mute"])

export const sendGtvKey = async ({ key }: { key: string }) => {
  const code = KEYS[key]
  if (code === undefined)
    return err(`Unknown key "${key}". Valid keys: ${keyNames.join(", ")}`)
  try {
    const s = await ensureSession()
    if (key === "power") {
      const before = s.state.powered
      s.sendKey(code)
      await waitForChange(s, (st) => st.powered !== before, 2500)
    } else if (VOLUME_KEYS.has(key)) {
      const before = JSON.stringify(s.state.volume)
      s.sendKey(code)
      await waitForChange(s, (st) => JSON.stringify(st.volume) !== before, 1500)
    } else {
      s.sendKey(code)
      await delay(150)
    }
    return ok({ sent: key, ...snapshot(s) })
  } catch (e) {
    return err(reason(e))
  }
}

export const typeGtvText = async ({ text }: { text: string }) => {
  try {
    const s = await ensureSession()
    s.typeText(text)
    await delay(250)
    return ok({ typed: text, ...snapshot(s) })
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
    const s = await ensureSession()
    const before = s.state.currentApp
    s.launchApp(deeplink)
    // Wait for the TV to report the new foreground app, so we can confirm it.
    await waitForChange(s, (state) => state.currentApp !== before, 5000)
    return ok({ launched: app, deeplink, ...snapshot(s) })
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
  "gtv_get_state",
  {
    description:
      "Read the current device's live state: connected, powered, foreground app (package + friendly name), and volume. Use this to check what's on the TV before or after acting.",
    inputSchema: {},
  },
  getGtvState,
)

server.registerTool(
  "gtv_send_key",
  {
    description:
      "Send a single remote key press to the current device (navigation, media, volume, power…). Returns the resulting TV state.",
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
      "Type arbitrary text into the focused field on the current device via IME (no keycode mapping). Returns the resulting TV state.",
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
      "Launch an app on the current device by catalog name/id (e.g. netflix, youtube) or a raw deep-link URI. Waits for and returns the new foreground app so you can confirm it launched.",
    inputSchema: {
      app: z.string().describe("App catalog name/id or a deep-link URI"),
    },
  },
  launchGtvApp,
)

const main = async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  const shutdown = () => {
    session?.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
  console.error("mcp-gtv running")
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  main().catch((e) => {
    console.error("Fatal:", e)
    process.exit(1)
  })
}
