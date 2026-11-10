import type { CSSProperties } from 'react'
const paths: Record<string, string> = {
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  moon: 'M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M12 19V5m-6 6 6-6 6 6',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4',
  file: 'M14 3H5v18h14V8l-5-5ZM14 3v6h5M8 13h8M8 17h6',
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l2.5-5A8.5 8.5 0 1 1 21 11.5Z',
  graph:
    'M9 5h6M6 8v8m12-8v8M9 19h6M8 7l8 10M16 7 8 17M9 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 19a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  search: 'm20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6',
  close: 'm6 6 12 12M6 18 18 6',
  folder: 'M3 6h7l2 3h9v12H3V6Z',
  refresh: 'M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  chevron: 'm9 5 7 7-7 7',
  book: 'M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2V3Z',
  stop: 'M6 6h12v12H6Z',
  check: 'm5 12 4 4L19 6',
  copy: 'M8 8h13v13H8V8ZM16 8V3H3v13h5',
  external: 'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
}
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: string
  size?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] || paths.file} />
    </svg>
  )
}
