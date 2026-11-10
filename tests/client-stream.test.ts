import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamChat } from '../client/src/api.ts'

test('SSE parser preserves split UTF-8 tokens and source events', async () => {
  const previous = globalThis.fetch
  const content = 'event: sources\ndata: [{"number":1,"name":"Policy"}]\n\nevent: token\ndata: {"text":"Ответ ✓"}\n\nevent: done\ndata: {}\n\n'
  const bytes = new TextEncoder().encode(content)
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3)); c.close() } }), { headers: { 'Content-Type': 'text/event-stream' } })
  try {
    const events: [string, unknown][] = []
    await streamChat({}, new AbortController().signal, (event, data) => events.push([event, data]))
    assert.deepEqual(events, [['sources', [{ number: 1, name: 'Policy' }]], ['token', { text: 'Ответ ✓' }], ['done', {}]])
  } finally { globalThis.fetch = previous }
})
test('SSE parser reports truncated streams instead of a successful answer', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response('event: token\ndata: {"text":"partial"}\n\n')
  try { await assert.rejects(streamChat({}, new AbortController().signal, () => {}), /before the answer finished/) }
  finally { globalThis.fetch = previous }
})
test('chat reports server-side validation errors', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response('{"error":"Question too long"}', { status: 400 })
  try { await assert.rejects(streamChat({}, new AbortController().signal, () => {}), /Question too long/) }
  finally { globalThis.fetch = previous }
})
