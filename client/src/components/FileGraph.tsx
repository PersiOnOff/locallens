import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import { api } from '../api'
import type { GraphData } from '../api'
import { Icon } from './Icon'
export function FileGraph({
  onDocument,
  revision,
  theme,
}: {
  theme: 'light' | 'dark'
  onDocument: (id: string) => void
  revision: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const cy = useRef<cytoscape.Core | null>(null)
  const [data, setData] = useState<GraphData>({ nodes: [], edges: [] })
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api<GraphData>('/graph')
      .then((d) => {
        if (active) {
          setData(d)
          setError('')
        }
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [revision])
  useEffect(() => {
    if (!container.current) return
    const palette = getComputedStyle(document.documentElement)
    const color = (name: string) => palette.getPropertyValue(name).trim()
    cy.current = cytoscape({
      container: container.current,
      elements: [
        ...data.nodes.map((n) => ({ data: { id: n.id, label: n.label, kind: n.kind } })),
        ...data.edges.map((e, i) => ({
          data: { id: `edge-${i}`, source: e.source, target: e.target },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'background-color': color('--graph-node'),
            color: color('--text'),
            'font-size': 11,
            'text-valign': 'bottom',
            'text-margin-y': 10,
            width: 30,
            height: 30,
            'border-width': 6,
            'border-color': color('--active'),
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': color('--graph-edge'),
            'target-arrow-color': color('--graph-edge'),
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: ':selected',
          style: { 'background-color': color('--sand-text'), 'border-color': color('--sand-bg') },
        },
      ],
      layout: { name: 'cose', animate: false, padding: 55, nodeRepulsion: () => 80000 },
      minZoom: 0.2,
      maxZoom: 3,
    })
    cy.current.on('tap', 'node', (event) => onDocument(event.target.id()))
    const observer = new ResizeObserver(() => cy.current?.resize())
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      cy.current?.destroy()
      cy.current = null
    }
  }, [data, onDocument, theme])
  return (
    <div className="graph-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EXPLORE YOUR LIBRARY</span>
          <h2>Every file has a context.</h2>
          <p>Follow relative imports and document links. Select a node to read its source.</p>
        </div>
        <button className="secondary" onClick={() => cy.current?.fit(undefined, 55)}>
          <Icon name="search" />
          Fit graph
        </button>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      <div className="graph-canvas" ref={container} aria-label="File relationship graph" />
      {data.nodes.length === 0 && (
        <div className="graph-empty">
          Upload documents or connect a repository to start exploring.
        </div>
      )}
      <div className="graph-legend">
        <span>
          <i />
          {data.nodes.length} files
        </span>
        <span>{data.edges.length} resolved links</span>
        <span>Scroll to zoom · Drag to explore</span>
      </div>
      <details className="graph-accessible">
        <summary>Browse files as a list</summary>
        {data.nodes.map((n) => (
          <button key={n.id} onClick={() => onDocument(n.id)}>
            {n.label}
          </button>
        ))}
      </details>
    </div>
  )
}
