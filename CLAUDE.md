# mcp-gtv

MCP server exposing Google TV control to MCP clients. Thin wrapper over
[`@kud/gtv`](https://github.com/kud/gtv) — part of the ecosystem
`@kud/androidtv-remote ← @kud/gtv ← (mcp-gtv | gtv-cli)`.

## How it connects

No API, no token. It reads already-paired devices from the shared config store
at `~/.config/gtv/config.json` (devices are paired via the `gtv` CLI). All
control tools act on the _current_ device; `gtv_set_device` switches it.

A single warm `createSession` is held for the life of the server (connect once,
reuse). This removes the per-call TLS handshake and keeps `state` live, so every
control tool returns the TV's resulting state (powered, foreground app, volume)
as feedback for the model.

## Tools

- `gtv_list_devices` — list paired devices, marking the current one
- `gtv_set_device` — select the current device by host or name (resets the session)
- `gtv_get_state` — read live state: connected, powered, foreground app, volume
- `gtv_send_key` — send a remote key (names from `@kud/gtv`'s `KEYS`); returns state
- `gtv_type_text` — type text via IME into the focused field; returns state
- `gtv_launch_app` — launch an app by catalog name/id or URI; waits for + returns the new app

## Conventions

ESM-only, functional (no classes), exact version pins, tsup build, stdio
transport. Releases are tag-driven via OIDC (`git tag vX.Y.Z && git push --tags`)
— never `npm publish` by hand.
