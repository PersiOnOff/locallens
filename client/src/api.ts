export interface DocumentInfo {
  id: string
  name: string
  kind: string
  groupName: string
  relativePath: string
  status: 'pending' | 'indexing' | 'ready' | 'failed'
  error: string | null
  progress: number
  chunkCount: number
  size: number
  model: string
  needsReindex?: boolean
  content?: string
  pagesJson?: string
}
export interface Evidence {
  number: number
  chunkId: string
  documentId: string
  name: string
  text: string
  startLine: number
  endLine: number
  page: number | null
  score: number
}
export interface Health {
  ollama: {
    connected: boolean
    ready: boolean
    chatModel: string
    embeddingModel: string
    error: string | null
  }
  repositoryRootConfigured: boolean
}
export interface GraphData {
  nodes: { id: string; label: string; kind: string; group: string; status: string }[]
  edges: { source: string; target: string }[]
}
export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: Evidence[]
  error?: string
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(
      data.error ||
        (response.status === 429
          ? 'A request is already running. Please try again shortly.'
          : `Request failed (${response.status}).`),
    )
  }
  return response.status === 204 || response.headers.get('content-length') === '0'
    ? (undefined as T)
    : response.json()
}
export const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
export async function streamChat(
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: string, data: unknown) => void,
) {
  const response = await fetch('/api/chat', { ...post(body), signal })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(
      data.error ||
        (response.status === 429
          ? 'Another answer is being generated. Try again shortly.'
          : `Chat failed (${response.status}).`),
    )
  }
  if (!response.body) throw new Error('Streaming is unavailable in this browser.')
  const reader = response.body.getReader(),
    decoder = new TextDecoder()
  let buffer = '',
    terminal = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')
      let index: number
      while ((index = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        const event = frame
          .split('\n')
          .find((l) => l.startsWith('event: '))
          ?.slice(7)
        const data = frame
          .split('\n')
          .filter((l) => l.startsWith('data: '))
          .map((l) => l.slice(6))
          .join('\n')
        if (event && data) {
          onEvent(event, JSON.parse(data))
          if (event === 'done' || event === 'error') terminal = true
        }
      }
      if (done) break
    }
    if (!terminal)
      throw new Error('The connection ended before the answer finished. Please try again.')
  } finally {
    reader.releaseLock()
  }
}
