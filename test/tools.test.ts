import { test } from "node:test"
import assert from "node:assert/strict"
import { ok, err, sendGtvKey, launchGtvApp } from "../src/index.ts"

// These exercise the validation paths only — they return before any TLS
// connection, so no real TV is needed. The happy paths (which connect) are
// covered by manual/real-device testing.

test("ok formats objects as pretty JSON", () => {
  const result = ok({ a: 1 })
  assert.equal(result.content[0]!.text, '{\n  "a": 1\n}')
})

test("ok passes strings through verbatim", () => {
  assert.equal(ok("hello").content[0]!.text, "hello")
})

test("err marks the result and prefixes the message", () => {
  const result = err("boom")
  assert.equal(result.isError, true)
  assert.equal(result.content[0]!.text, "Error: boom")
})

test("sendGtvKey rejects an unknown key without connecting", async () => {
  const result = await sendGtvKey({ key: "nope" })
  assert.equal(result.isError, true)
  assert.match(result.content[0]!.text, /Unknown key "nope"/)
  assert.match(result.content[0]!.text, /home/)
})

test("launchGtvApp rejects an unknown app without connecting", async () => {
  const result = await launchGtvApp({ app: "totally-not-an-app" })
  assert.equal(result.isError, true)
  assert.match(result.content[0]!.text, /Unknown app/)
  assert.match(result.content[0]!.text, /netflix/)
})
