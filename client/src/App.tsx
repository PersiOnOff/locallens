import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, DragEvent } from 'react'
import { api, post, streamChat } from './api'
import type { DocumentInfo, Evidence, Health, Message } from './api'
import { Icon } from './components/Icon'
import { Answer } from './components/Answer'
import { focusableElements, nextFocusIndex } from './focusTrap'
const FileGraph = lazy(() =>
  import('./components/FileGraph').then((m) => ({ default: m.FileGraph })),
)
import './App.css'

function sizeLabel(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
const suggestions = [
  'Give me an overview of these documents',
  'What are the key decisions and why?',
  'Find the steps I need to follow',
]
function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('locallens-theme', theme)
    } catch {
      /* Storage can be disabled in private browsers. */
    }
  }, [theme])
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    setTheme(next)
  }
  const [documents, setDocuments] = useState<DocumentInfo[]>([]),
    [health, setHealth] = useState<Health | null>(null)
  const [view, setView] = useState<'chat' | 'graph'>('chat'),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<string[]>([]),
    [messages, setMessages] = useState<Message[]>([])
  const [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState(''),
    [error, setError] = useState(''),
    [preview, setPreview] = useState<DocumentInfo | null>(null)
  const [activeEvidence, setActiveEvidence] = useState<Evidence | null>(null),
    [showImport, setShowImport] = useState(false),
    [repoPath, setRepoPath] = useState('.')
  const [importing, setImporting] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null),
    controller = useRef<AbortController | null>(null),
    bottom = useRef<HTMLDivElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null),
    importButton = useRef<HTMLButtonElement>(null),
    importDialog = useRef<HTMLElement>(null),
    importWasOpen = useRef(false)
  const refresh = useCallback(async () => {
    const docs = await api<DocumentInfo[]>('/documents')
    setDocuments(docs)
    setSelected((ids) => ids.filter((id) => docs.some((d) => d.id === id)))
  }, [])
  useEffect(() => {
    let live = true
    const load = () =>
      refresh().catch((e) => {
        if (live) setError(e.message)
      })
    const status = () =>
      api<Health>('/health')
        .then((h) => {
          if (live) setHealth(h)
        })
        .catch(() => {
          if (live) setHealth(null)
        })
    void load()
    void status()
    const a = setInterval(load, 2500),
      b = setInterval(status, 15000)
    return () => {
      live = false
      clearInterval(a)
      clearInterval(b)
      controller.current?.abort()
    }
  }, [refresh])
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])
  useEffect(() => {
    const dialog = importDialog.current
    if (!showImport || !dialog) return
    const firstInput = dialog.querySelector<HTMLElement>('input, textarea, select')
    ;(firstInput ?? focusableElements(dialog)[0])?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (!dialog) return
      if (event.key === 'Escape') {
        if (importing) return
        event.preventDefault()
        setShowImport(false)
        return
      }
      if (event.key !== 'Tab') return
      const items = focusableElements(dialog)
      const index = nextFocusIndex(
        items.indexOf(document.activeElement as HTMLElement),
        items.length,
        event.shiftKey,
      )
      if (index < 0) return
      event.preventDefault()
      items[index]?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showImport, importing])
  useEffect(() => {
    if (importWasOpen.current && !showImport) importButton.current?.focus()
    importWasOpen.current = showImport
  }, [showImport])
  const openDocument = useCallback(async (id: string) => {
    try {
      const doc = await api<DocumentInfo>(`/documents/${id}`)
      setPreview(doc)
      setActiveEvidence(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])
  function showEvidence(source: Evidence) {
    setActiveEvidence(source)
    setPreview(null)
  }
  async function upload(files: FileList | File[]) {
    if (uploading) return
    setUploading(true)
    setError('')
    setNotice('')
    let count = 0
    const errors: string[] = []
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) {
        errors.push(`${file.name}: exceeds 20 MB.`)
        continue
      }
      try {
        const data = new FormData()
        data.append('file', file)
        await api('/documents', { method: 'POST', body: data })
        count++
      } catch (e) {
        errors.push(`${file.name}: ${(e as Error).message}`)
      }
    }
    if (count)
      setNotice(
        `${count} ${count === 1 ? 'document added' : 'documents added'}. Indexing runs locally in the background.`,
      )
    if (errors.length) setError(errors.join(' '))
    setUploading(false)
    if (fileInput.current) fileInput.current.value = ''
    await refresh().catch(() => {})
  }
  async function action(id: string, kind: 'retry' | 'delete') {
    if (kind === 'delete' && !window.confirm('Delete this document and its indexed passages?'))
      return
    try {
      await api(`/documents/${id}${kind === 'retry' ? '/retry' : ''}`, {
        method: kind === 'retry' ? 'POST' : 'DELETE',
      })
      if (preview?.id === id) setPreview(null)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function importRepository(event: FormEvent) {
    event.preventDefault()
    setImporting(true)
    setError('')
    try {
      const result = await api<{
        added: number
        skipped: number
        errors: { name: string; error: string }[]
      }>('/repositories', post({ path: repoPath }))
      setNotice(
        `${result.added} files added; ${result.skipped} skipped.${
          result.errors.length
            ? ' ' +
              result.errors
                .slice(0, 3)
                .map((e) => `${e.name}: ${e.error}`)
                .join(' ')
            : ''
        }`,
      )
      setShowImport(false)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setImporting(false)
    }
  }
  async function ask(event?: FormEvent, suggestion?: string) {
    event?.preventDefault()
    const question = (suggestion || query).trim()
    if (!question || busy) return
    setView('chat')
    setQuery('')
    setError('')
    setBusy(true)
    const id = crypto.randomUUID(),
      history = messages
        .filter((m) => !m.error && m.content)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: question, sources: [] },
      { id, role: 'assistant', content: '', sources: [] },
    ])
    const update = (fn: (m: Message) => Message) =>
      setMessages((current) => current.map((m) => (m.id === id ? fn(m) : m)))
    controller.current = new AbortController()
    try {
      await streamChat(
        { question, documentIds: selected, history },
        controller.current.signal,
        (event, data) => {
          if (event === 'sources') update((m) => ({ ...m, sources: data as Evidence[] }))
          if (event === 'token')
            update((m) => ({ ...m, content: m.content + (data as { text: string }).text }))
          if (event === 'error')
            update((m) => ({ ...m, error: (data as { message: string }).message }))
        },
      )
    } catch (e) {
      update((m) => ({
        ...m,
        error: (e as Error).name === 'AbortError' ? 'Generation stopped.' : (e as Error).message,
      }))
    } finally {
      setBusy(false)
      controller.current = null
      textarea.current?.focus()
    }
  }
  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files.length) void upload(event.dataTransfer.files)
  }
  const ready = documents.filter((d) => d.status === 'ready' && !d.needsReindex).length
  const working = documents.filter((d) => d.status === 'indexing' || d.status === 'pending').length
  const visibleDocs = documents.filter((d) =>
    `${d.name} ${d.groupName}`.toLowerCase().includes(filter.toLowerCase()),
  )
  const latestSources = [...messages].reverse().find((m) => m.sources.length)?.sources || []
  const detail = activeEvidence || preview
  return (
    <div
      className="workspace"
      onDragOver={(e) => {
        e.preventDefault()
        if (e.dataTransfer.types.includes('Files')) setDragging(true)
      }}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="drop-overlay" onDragLeave={() => setDragging(false)}>
          <Icon name="upload" size={40} />
          <h2>Drop your documents here</h2>
          <p>PDF, Markdown, text & source code · Up to 20 MB each</p>
        </div>
      )}
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <a className="brand" href="/" aria-label="LocalLens home">
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          LocalLens<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">P</span>
          <div>
            Personal workspace<small>On your machine</small>
          </div>
          <Icon name="chevron" size={14} />
        </div>
        <button
          className="new-chat"
          disabled={busy}
          onClick={() => {
            setMessages([])
            setView('chat')
            setActiveEvidence(null)
            setPreview(null)
            setSidebarOpen(false)
          }}
        >
          <Icon name="plus" />
          New conversation<span>↗</span>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace views">
          <button
            className={view === 'chat' ? 'active' : ''}
            onClick={() => {
              setView('chat')
              setSidebarOpen(false)
            }}
          >
            <Icon name="chat" />
            Ask your library
          </button>
          <button
            className={view === 'graph' ? 'active' : ''}
            onClick={() => {
              setView('graph')
              setSidebarOpen(false)
            }}
          >
            <Icon name="graph" />
            File connections<span className="nav-count">{documents.length}</span>
          </button>
        </nav>
        <div className="library-heading">
          <span className="nav-label">YOUR LIBRARY</span>
          <span className="count-badge">{documents.length}</span>
          <button
            className="icon-button"
            title="Add documents"
            aria-label="Add documents"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <label className="library-search">
          <Icon name="search" size={15} />
          <input
            aria-label="Search documents"
            placeholder="Find a document…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        {selected.length > 0 && (
          <button className="clear-selection" onClick={() => setSelected([])}>
            Searching {selected.length} selected · Clear
          </button>
        )}
        <div className="document-list">
          {visibleDocs.map((doc) => (
            <div key={doc.id} className={`document-row ${preview?.id === doc.id ? 'chosen' : ''}`}>
              <input
                type="checkbox"
                aria-label={`Use ${doc.name} in chat`}
                checked={selected.includes(doc.id)}
                onChange={() =>
                  setSelected((ids) =>
                    ids.includes(doc.id) ? ids.filter((id) => id !== doc.id) : [...ids, doc.id],
                  )
                }
              />
              <button
                className="document-open"
                onClick={() => void openDocument(doc.id)}
                title={doc.relativePath}
              >
                <span className={`file-type ${doc.kind === 'pdf' ? 'pdf' : ''}`}>
                  {doc.kind.slice(0, 3)}
                </span>
                <span className="document-name">
                  {doc.name}
                  <small
                    className={doc.status === 'failed' || doc.needsReindex ? 'status-error' : ''}
                  >
                    {doc.needsReindex
                      ? 'Reindex for current model'
                      : doc.status === 'indexing'
                        ? `Indexing ${doc.progress}%`
                        : doc.status === 'pending'
                          ? 'Waiting to index'
                          : doc.status === 'failed'
                            ? 'Indexing failed'
                            : `${doc.chunkCount} passages · ${sizeLabel(doc.size)}`}
                  </small>
                </span>
              </button>
              <span className={`status-dot ${doc.status}`} title={doc.status} />
            </div>
          ))}
          {visibleDocs.length === 0 && (
            <div className="library-empty">
              <Icon name="book" size={24} />
              <p>{filter ? 'No matching documents' : 'A little knowledge goes a long way.'}</p>
              <small>{filter ? 'Try another search.' : 'Add your first document below.'}</small>
            </div>
          )}
        </div>
        <button
          className="upload-button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="upload" />
          {uploading ? 'Adding documents…' : 'Add documents'}
          <span>+</span>
        </button>
        <button ref={importButton} className="connect-button" onClick={() => setShowImport(true)}>
          <Icon name="folder" size={16} />
          Connect a local repository
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="sr-only"
          accept=".pdf,.md,.txt,.cs,.tsx,.ts,.js,.jsx,.py,.java,.go,.rs,.html,.css,.sql,.json,.yaml,.yml,.xml,.sh,.csproj"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            if (e.target.files) void upload(e.target.files)
          }}
        />
        <div className="privacy-card">
          <Icon name="shield" size={18} />
          <div>
            Private by design<small>Local storage. Local inference.</small>
          </div>
          <span className="status-dot ready" />
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-toggle icon-button"
              aria-label="Toggle library"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Icon name="book" />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{view === 'chat' ? 'Ask your library' : 'File connections'}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="theme-toggle"
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              title={theme === 'light' ? 'Dark theme' : 'Light theme'}
              onClick={toggleTheme}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
              <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
            </button>
            <div
              className={`model-pill ${health?.ollama.ready ? 'online' : ''}`}
              title={
                health?.ollama.error || health?.ollama.embeddingModel || 'Checking local inference'
              }
            >
              <span className={`status-dot ${health?.ollama.ready ? 'ready' : 'pending'}`} />
              {health?.ollama.chatModel || 'Connecting to API'}
              <span className="local-label">LOCAL</span>
            </div>
          </div>
        </header>
        {(error || notice) && (
          <div
            className={error ? 'error-banner' : 'notice-banner'}
            role={error ? 'alert' : 'status'}
          >
            <span>{error || notice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => {
                setError('')
                setNotice('')
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {health && !health.ollama.ready && (
          <div className="setup-banner">
            <Icon name="refresh" size={16} />
            <span>
              {health.ollama.connected
                ? 'Ollama is running. Download the configured models to begin.'
                : 'Waiting for Ollama. Start the local model service to index and chat.'}{' '}
              <code>docker compose logs -f models</code>
            </span>
          </div>
        )}
        {view === 'graph' ? (
          <Suspense fallback={<div className="graph-empty">Loading file connections…</div>}>
            <FileGraph
              theme={theme}
              onDocument={openDocument}
              revision={documents.map((d) => d.id + d.status).join(',')}
            />
          </Suspense>
        ) : (
          <>
            <div className={`conversation ${messages.length ? 'has-messages' : ''}`}>
              {messages.length === 0 ? (
                <div className="welcome">
                  <div className="welcome-kicker">
                    <span className="tiny-spark">✳</span> YOUR KNOWLEDGE. YOUR MACHINE.
                  </div>
                  <h1>
                    Your knowledge,
                    <br />a little more connected<span>.</span>
                  </h1>
                  <p>
                    For the notes you kept. The ideas you almost forgot.
                    <br />
                    Bring them together — and find the thread.
                  </p>
                  <div className="welcome-cards">
                    <button onClick={() => fileInput.current?.click()}>
                      <span className="welcome-icon">
                        <Icon name="upload" size={21} />
                      </span>
                      <strong>Start with a document</strong>
                      <span>Drop in a PDF, a guide, or your notes.</span>
                      <span className="card-arrow">↗</span>
                    </button>
                    <button onClick={() => setShowImport(true)}>
                      <span className="welcome-icon sand">
                        <Icon name="folder" size={21} />
                      </span>
                      <strong>See the bigger picture</strong>
                      <span>Connect code. Explore the connections.</span>
                      <span className="card-arrow">↗</span>
                    </button>
                  </div>
                  <div className="getting-started">
                    <span className={documents.length ? 'step completed' : 'step'}>
                      <b>{documents.length ? '✓' : '1'}</b>Add documents
                    </span>
                    <i />
                    <span className={ready ? 'step completed' : 'step'}>
                      <b>{ready ? '✓' : '2'}</b>Index locally
                    </span>
                    <i />
                    <span className="step">
                      <b>3</b>Ask anything
                    </span>
                  </div>
                </div>
              ) : (
                <div className="message-list">
                  {messages.map((message) => (
                    <article key={message.id} className={`message ${message.role}`}>
                      <span className={`message-avatar ${message.role}`}>
                        {message.role === 'user' ? 'Y' : <span className="mini-lens">L</span>}
                      </span>
                      <div className="message-body">
                        <div className="message-author">
                          {message.role === 'user' ? 'You' : 'LocalLens'}
                          {message.role === 'assistant' && <span>LOCAL ANSWER</span>}
                        </div>
                        {message.role === 'user' ? (
                          <p className="user-question">{message.content}</p>
                        ) : (
                          <div className="markdown">
                            {!message.content && !message.error ? (
                              <div className="thinking">
                                <span />
                                <span />
                                <span />
                                <small>Finding the right passages…</small>
                              </div>
                            ) : (
                              <Answer
                                theme={theme}
                                text={message.content}
                                sources={message.sources}
                                onSource={showEvidence}
                              />
                            )}
                            {message.error && (
                              <p className="message-error" role="alert">
                                {message.error}
                              </p>
                            )}
                            {message.sources.length > 0 && (
                              <div className="answer-sources">
                                {message.sources.map((s) => (
                                  <button key={s.chunkId} onClick={() => showEvidence(s)}>
                                    <span>{s.number}</span>
                                    <Icon name="file" size={13} />
                                    {s.name}
                                    {s.page && <small>p. {s.page}</small>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                  <div ref={bottom} />
                </div>
              )}
            </div>
            <div className="composer-area">
              {messages.length === 0 && ready > 0 && (
                <div className="suggestions">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => void ask(undefined, s)}>
                      {s}
                      <span>↗</span>
                    </button>
                  ))}
                </div>
              )}
              <form className="composer" onSubmit={ask}>
                <textarea
                  ref={textarea}
                  aria-label="Ask your documents"
                  placeholder={
                    ready
                      ? 'What would you like to understand?'
                      : 'Add a document, then ask your first question…'
                  }
                  value={query}
                  maxLength={4000}
                  rows={2}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      void ask()
                    }
                  }}
                />
                <div className="composer-bottom">
                  <span>
                    <Icon name="book" size={14} />
                    {selected.length ? `${selected.length} selected sources` : 'All documents'}
                    <span className="composer-divider">·</span>
                    {working ? `${working} indexing` : `${ready} ready`}
                  </span>
                  {busy ? (
                    <button
                      type="button"
                      className="send-button"
                      aria-label="Stop generating"
                      onClick={() => controller.current?.abort()}
                    >
                      <Icon name="stop" size={16} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="send-button"
                      disabled={!query.trim() || !ready}
                      aria-label="Send question"
                    >
                      <Icon name="arrow" size={18} />
                    </button>
                  )}
                </div>
              </form>
              <div className="composer-note">
                <Icon name="shield" size={12} />
                <span>Processed locally. Answers can be imperfect — check the sources.</span>
                <span className="keyboard-hint">↵ to send</span>
              </div>
            </div>
          </>
        )}
        <footer className="workspace-footer">
          <span>
            <span className="status-dot ready" />
            Local workspace
          </span>
          <span>
            {documents.length} documents<span className="footer-separator">/</span>
            {documents.reduce((n, d) => n + d.chunkCount, 0)} passages
          </span>
          <span>LOCAL-FIRST KNOWLEDGE</span>
        </footer>
      </main>
      <aside className={`source-panel ${detail ? 'with-detail' : ''}`}>
        <div className="source-panel-heading">
          <Icon name="file" size={17} />
          <strong>{detail ? 'Source preview' : 'Behind the answer'}</strong>
          {detail && (
            <button
              className="icon-button"
              aria-label="Close source preview"
              onClick={() => {
                setPreview(null)
                setActiveEvidence(null)
              }}
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        {activeEvidence ? (
          <div className="source-detail">
            <span className="eyebrow">RETRIEVED PASSAGE [{activeEvidence.number}]</span>
            <h3>{activeEvidence.name}</h3>
            <div className="source-meta">
              {activeEvidence.page
                ? `Page ${activeEvidence.page}`
                : `Lines ${activeEvidence.startLine}–${activeEvidence.endLine}`}
              <span>Similarity {Math.round(activeEvidence.score * 100)}%</span>
            </div>
            <pre className="passage">{activeEvidence.text}</pre>
            <p className="small-note">
              Retrieval similarity is not a confidence score. Compare this passage with the answer.
            </p>
            <button
              className="secondary full-width"
              onClick={() => void openDocument(activeEvidence.documentId)}
            >
              <Icon name="book" size={15} />
              Read full document
            </button>
          </div>
        ) : preview ? (
          <div className="source-detail">
            <span className="eyebrow">
              {preview.kind.toUpperCase()} · {sizeLabel(preview.size)}
            </span>
            <h3>{preview.name}</h3>
            <p className="source-path">
              {preview.groupName} / {preview.relativePath}
            </p>
            <div className="source-actions">
              <button
                className="secondary"
                disabled={preview.status === 'pending' || preview.status === 'indexing'}
                onClick={() => void action(preview.id, 'retry')}
              >
                <Icon name="refresh" size={14} />
                Reindex
              </button>
              <button
                className="icon-button danger"
                aria-label={`Delete ${preview.name}`}
                onClick={() => void action(preview.id, 'delete')}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
            {preview.error && <p className="message-error">{preview.error}</p>}
            <pre className="passage full-document">{preview.content}</pre>
          </div>
        ) : latestSources.length ? (
          <div className="source-detail">
            <span className="eyebrow">LATEST RETRIEVED SOURCES</span>
            <p className="small-note">
              Open a passage to inspect the evidence used for the latest answer.
            </p>
            {latestSources.map((s) => (
              <button key={s.chunkId} className="evidence-card" onClick={() => showEvidence(s)}>
                <span className="evidence-number">{s.number}</span>
                <strong>{s.name}</strong>
                <p>{s.text.slice(0, 130)}…</p>
                <small>
                  {s.page ? `Page ${s.page}` : `Lines ${s.startLine}–${s.endLine}`}
                  <Icon name="chevron" size={13} />
                </small>
              </button>
            ))}
          </div>
        ) : (
          <div className="source-placeholder">
            <div className="source-illustration">
              <span />
              <span />
              <span />
              <Icon name="search" size={25} />
            </div>
            <h3>Good answers have roots.</h3>
            <p>
              When you ask a question, the relevant passages appear here. Follow any citation to see
              the context.
            </p>
            <div className="source-principles">
              <span>
                <Icon name="check" size={14} />
                Grounded in your documents
              </span>
              <span>
                <Icon name="check" size={14} />
                Linked to the original passage
              </span>
              <span>
                <Icon name="check" size={14} />
                Always within reach
              </span>
            </div>
          </div>
        )}
        <div className="source-panel-bottom">
          <span className="tiny-spark">✳</span> A little context changes everything.
        </div>
      </aside>
      {showImport && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !importing) setShowImport(false)
          }}
        >
          <section
            ref={importDialog}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <button
              className="icon-button modal-close"
              aria-label="Close repository import"
              disabled={importing}
              onClick={() => setShowImport(false)}
            >
              <Icon name="close" />
            </button>
            <span className="welcome-icon">
              <Icon name="folder" size={25} />
            </span>
            <h2 id="import-title">Connect a local repository</h2>
            <p>
              Import documents and source files from the configured read-only repository folder.
            </p>
            <form onSubmit={importRepository}>
              <label htmlFor="repository-path">Path within the repository root</label>
              <input
                id="repository-path"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder=". or project-folder"
                required
              />
              <p className="small-note">
                Use <code>.</code> for the root. Build folders, symlinks, dotfiles and common secret
                files are skipped. Review the folder first: other files may contain private data.
              </p>
              {health && !health.repositoryRootConfigured && (
                <p className="message-error">
                  Repository root is not configured. Set REPOSITORIES_PATH for Docker or
                  Lens__RepositoryRoot for local development.
                </p>
              )}
              <button className="primary" disabled={importing}>
                {importing ? 'Importing…' : 'Import files'}
                <Icon name="arrow" size={16} />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
export default App
