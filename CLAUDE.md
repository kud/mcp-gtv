# mcp-gtv

MCP server exposing Google TV control to MCP clients. Thin wrapper over
[`@kud/gtv`](https://github.com/kud/gtv) — part of the ecosystem
`@kud/androidtv-remote ← @kud/gtv ← (mcp-gtv | gtv-cli)`.

## How it connects

No API, no token. It reads already-paired devices from the shared config store
at `~/.config/gtv/config.json` (devices are paired via the `gtv` CLI). All
control tools act on the _current_ device; `gtv_set_device` switches it.

## Tools

- `gtv_list_devices` — list paired devices, marking the current one
- `gtv_set_device` — select the current device by host or name
- `gtv_send_key` — send a remote key (names from `@kud/gtv`'s `KEYS`)
- `gtv_type_text` — type text via IME into the focused field
- `gtv_launch_app` — launch an app by catalog name/id or deep-link URI

## Conventions

ESM-only, functional (no classes), exact version pins, tsup build, stdio
transport. Releases are tag-driven via OIDC (`git tag vX.Y.Z && git push --tags`)
— never `npm publish` by hand.
