# Manual test plan — mcp-gtv

A hands-on checklist for driving a real Google TV through `mcp-gtv` from an MCP
client (Claude Code/Desktop) before publishing. Each item is a natural-language
prompt that should trigger one tool — try it, then watch the TV.

## Prerequisites

- [ ] TV powered on and on the same network
- [ ] TV already paired (`npx @kud/gtv-cli pair` if not) — e.g. `192.168.1.112` "kud · tv"
- [ ] Claude session running **in this repo**, with `mcp-gtv` approved (`/mcp` shows it connected)

> Every control tool returns the TV's resulting state (connected, powered, foreground app, volume) — so the AI can confirm its action landed. Check that the returned state looks right as you go.

## 1. `gtv_list_devices` — read-only sanity check

- [ ] _"list my Google TV devices"_ → shows the paired device, `paired: true`, `current: true`

## 1b. `gtv_get_state` — the feedback channel

- [ ] _"what's on the TV right now?"_ → returns `connected: true`, `powered`, `currentApp` (package + friendly name), `volume`
- [ ] Launch an app (below), then ask again → `currentApp` reflects the new app

## 2. `gtv_send_key` — watch the TV react

- [ ] _"press home on the TV"_ → jumps to home screen
- [ ] _"go down"_ then _"go right"_ → cursor moves down, then right
- [ ] _"press OK"_ / _"select"_ → activates the focused item
- [ ] _"go back"_ → backs out one level
- [ ] _"mute the TV"_ → _"volume up"_ → mutes, then volume rises
- [ ] _"pause"_ / _"play"_ (while something plays) → toggles playback
- [ ] **Edge:** _"press the wibble key"_ → clean error listing valid keys, no TV action

## 3. `gtv_type_text` — needs a focused text field first

- [ ] _"press search on the TV"_ (or open any search box), then _"type hello world"_ → text appears in the field
- [ ] **Edge:** type with nothing focused → returns cleanly, no hang

## 4. `gtv_launch_app`

- [ ] _"launch Netflix on the TV"_ → Netflix opens (or its Play Store page if not installed)
- [ ] _"open YouTube"_ → YouTube opens
- [ ] _"launch put.io"_ → Put.io opens
- [ ] **Edge:** _"launch flibbertigibbet"_ → error listing known app ids
- [ ] **Raw deeplink:** _"launch market://launch?id=com.netflix.ninja"_ → passes the URI straight through

## 5. `gtv_set_device` — device targeting

- [ ] _"set the current TV to kud · tv"_ (or the IP) → confirms current device
- [ ] Note: with one TV this is effectively a no-op; it persists to `~/.config/gtv`, so it also changes the **CLI's** current device (shared store)

## What to actually judge

- [ ] **Controls the real TV** — keys / app-launch / text visibly land (the whole point)
- [ ] **Errors are graceful** — TV off/unreachable returns a clean timeout (~8s), does **not** hang the tool
- [ ] **Latency acceptable** — first call connects (one TLS handshake), the rest reuse the warm session and should feel instant
- [ ] **Feedback is useful** — the state returned after each action (esp. `currentApp` after a launch) actually helps the AI know what happened
- [ ] **Permission prompts reasonable** — first use of each tool prompts (`mcp__mcp-gtv__…`)
- [ ] **Nothing missing** — note any tool you wish existed (`gtv_power`, `gtv_current_app`, volume-by-level, …)

## Known limitations (by design, for this PoC)

- No interactive pairing over MCP — pair with the `gtv` CLI first
- Acts on the **current** device only; switch with `gtv_set_device`
- Feedback is limited to what the protocol streams: power, volume, foreground app. There is **no** screen/focus/menu awareness — the AI can confirm an app launched but can't "see" the screen to navigate menus (that would need an ADB/vision channel, deliberately out of scope)

---

When everything above passes, the server is ready for the publish bootstrap
(first manual OTP publish → npm Trusted Publisher → tag-driven releases).
