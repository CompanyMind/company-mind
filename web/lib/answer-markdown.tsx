import type { ReactNode } from 'react'
import type { Components } from 'react-markdown'

/**
 * The markdown policy for answer text.
 *
 * An answer is written by a model that has just read customer documents, and
 * those documents are data, not instructions (engine/app/ask/answer.py). So the
 * renderer is deliberately narrower than "render markdown":
 *
 * - **No images.** `![](https://tracker/x.png)` in a document would make the
 *   reader's browser fetch an external URL the moment the answer renders —
 *   silently contradicting "Nothing leaves this server", the claim printed
 *   under every composer, and leaking that the document was read. There is no
 *   legitimate reason for an answer to embed a remote image.
 * - **Links only to http/https/mailto**, and never navigable from a bare model
 *   claim without the reader seeing where they are going: the href is shown
 *   next to the text. `javascript:` and `data:` are dropped to plain text.
 * - **No raw HTML.** react-markdown ignores it unless rehype-raw is added; it
 *   is not added, and must not be.
 */
const SAFE_PROTOCOL = /^(https?:|mailto:)/i

/** react-markdown calls this for every URL; returning '' drops the link. */
export function safeUrl(url: string): string {
  return SAFE_PROTOCOL.test(url.trim()) ? url : ''
}

/**
 * Split any string in a React tree on `[n]` and hand each marker to `render`.
 *
 * Markdown gives us a tree whose text is scattered across paragraphs, list
 * items, table cells and emphasis, so a citation marker can surface anywhere.
 * Walking the rendered children is what lets `**Tier 1 [2]**` produce a working
 * citation instead of a marker stranded inside a <strong>.
 */
export function withCitations(
  children: ReactNode,
  render: (marker: number, key: string) => ReactNode,
): ReactNode {
  const walk = (node: ReactNode, path: string): ReactNode => {
    if (typeof node === 'string') {
      const parts = node.split(/(\[\d+\])/g)
      if (parts.length === 1) return node
      return parts.map((p, i) => {
        const m = /^\[(\d+)\]$/.exec(p)
        return m ? render(Number(m[1]), `${path}-${i}`) : p
      })
    }
    if (Array.isArray(node)) return node.map((n, i) => walk(n, `${path}-${i}`))
    // A React element: recurse into its children, preserving everything else.
    if (node && typeof node === 'object' && 'props' in node) {
      const el = node as React.ReactElement<{ children?: ReactNode }>
      if (el.props?.children == null) return node
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Cloned = (el.type ?? 'span') as any
      return (
        <Cloned {...el.props} key={el.key ?? path}>
          {walk(el.props.children, path)}
        </Cloned>
      )
    }
    return node
  }
  return walk(children, 'c')
}

/**
 * Element overrides. Answers are prose about company policy, so the scale is
 * deliberately flat — a model that decides to emit `#` should not produce a
 * heading larger than the page's own title.
 */
export function answerComponents(
  wrap: (children: ReactNode) => ReactNode,
): Components {
  const P = (p: { children?: ReactNode }) => (
    <p className="my-3 first:mt-0 last:mb-0">{wrap(p.children)}</p>
  )
  return {
    p: P,
    h1: (p) => <p className="mb-1 mt-4 font-medium text-ink first:mt-0">{wrap(p.children)}</p>,
    h2: (p) => <p className="mb-1 mt-4 font-medium text-ink first:mt-0">{wrap(p.children)}</p>,
    h3: (p) => <p className="mb-1 mt-4 font-medium text-ink first:mt-0">{wrap(p.children)}</p>,
    h4: (p) => <p className="mb-1 mt-4 font-medium text-ink first:mt-0">{wrap(p.children)}</p>,
    h5: (p) => <p className="mb-1 mt-4 font-medium text-ink first:mt-0">{wrap(p.children)}</p>,
    h6: (p) => <p className="mb-1 mt-4 font-medium text-ink first:mt-0">{wrap(p.children)}</p>,
    strong: (p) => <strong className="font-semibold text-ink">{wrap(p.children)}</strong>,
    em: (p) => <em className="italic">{wrap(p.children)}</em>,
    ul: (p) => <ul className="my-3 list-disc space-y-1 pl-5 marker:text-ink-soft">{p.children}</ul>,
    ol: (p) => (
      <ol className="my-3 list-decimal space-y-1 pl-5 marker:text-ink-soft">{p.children}</ol>
    ),
    li: (p) => <li className="pl-0.5">{wrap(p.children)}</li>,
    blockquote: (p) => (
      <blockquote className="my-3 border-l-2 border-line pl-3 text-ink-soft">{p.children}</blockquote>
    ),
    code: (p) => (
      <code className="rounded bg-paper-sunk px-1 py-0.5 font-mono text-[0.85em] text-ink">
        {p.children}
      </code>
    ),
    pre: (p) => (
      <pre className="my-3 overflow-x-auto rounded-md bg-paper-sunk p-3 font-mono text-[0.8125rem] leading-[1.6] text-ink">
        {p.children}
      </pre>
    ),
    hr: () => <hr className="my-4 border-line" />,
    // Tables arrive whenever the corpus holds a matrix — response tiers by
    // minutes, retention by record type — which is exactly the shape a policy
    // question wants back. They scroll on their own so the pane never does.
    table: (p) => (
      <div className="my-3 overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">{p.children}</table>
      </div>
    ),
    thead: (p) => <thead className="border-b border-line">{p.children}</thead>,
    th: (p) => (
      <th className="px-2 py-1.5 text-left font-medium text-ink-soft">{wrap(p.children)}</th>
    ),
    td: (p) => <td className="border-b border-line px-2 py-1.5 align-top">{wrap(p.children)}</td>,
    img: () => null,
    a: (p) => {
      const href = typeof p.href === 'string' ? p.href : ''
      if (!href) return <span>{wrap(p.children)}</span>
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-brain-text underline underline-offset-2"
        >
          {wrap(p.children)}
        </a>
      )
    },
  }
}
