import Markdown from 'react-markdown'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Evidence } from '../api'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import csharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
for (const [name, language] of Object.entries({
  typescript,
  ts: typescript,
  javascript,
  js: javascript,
  csharp,
  cs: csharp,
  python,
  py: python,
  json,
  bash,
  sh: bash,
  css,
  html: markup,
  xml: markup,
  sql,
}))
  SyntaxHighlighter.registerLanguage(name, language)
export function Answer({
  text,
  sources,
  onSource,
  theme,
}: {
  theme: 'light' | 'dark'
  text: string
  sources: Evidence[]
  onSource: (source: Evidence) => void
}) {
  const markdown = text
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => (i % 2 ? part : part.replace(/\[(\d+)\](?!\()/g, '[$1](#source-$1)')))
    .join('')
  return (
    <Markdown
      components={{
        a({ href, children }) {
          if (href?.startsWith('#source-')) {
            const source = sources.find((s) => s.number === Number(href.slice(8)))
            return source ? (
              <button
                className="inline-citation"
                onClick={() => onSource(source)}
                title={`View ${source.name}`}
              >
                {children}
              </button>
            ) : (
              <span>{children}</span>
            )
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          )
        },
        img() {
          return <span className="muted">[External image omitted]</span>
        },
        code({ className, children, ...props }) {
          const language = /language-(\w+)/.exec(className || '')?.[1]
          return language ? (
            <SyntaxHighlighter
              style={theme === 'dark' ? oneDark : oneLight}
              language={language}
              PreTag="div"
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          )
        },
      }}
    >
      {markdown}
    </Markdown>
  )
}
