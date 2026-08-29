import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed font-sans text-stone-800 text-[14px]">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-stone-950">{children}</strong>,
  em: ({ children }) => <em className="italic text-stone-700">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0 text-stone-800 text-[14px]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0 text-stone-800 text-[14px]">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  h1: ({ children }) => (
    <h3 className="mb-2 mt-4 font-display text-lg font-normal text-stone-900 first:mt-0 tracking-tight">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="mb-2 mt-3 font-display text-base font-medium text-stone-900 first:mt-0 tracking-tight">{children}</h4>
  ),
  h3: ({ children }) => (
    <h4 className="mb-2 mt-3 font-mono text-xs font-semibold uppercase tracking-wider text-stone-700 first:mt-0 flex items-center gap-1.5">{children}</h4>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-stone-200/60 px-1.5 py-0.5 font-mono text-xs text-stone-800 break-words max-w-full inline-block">{children}</code>
  ),
  table: ({ children }) => (
    <div className="my-4 w-full max-w-full overflow-x-auto rounded-xl border border-stone-300/80 bg-white/70 shadow-xs">
      <table className="w-full text-left text-xs border-collapse font-sans">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-stone-200/50 border-b border-stone-300/80">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3.5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-stone-600 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-t border-stone-200 px-3.5 py-2.5 align-top text-stone-800 break-words">{children}</td>
  ),
  blockquote: ({ children }) => (
    <div className="my-3 rounded-xl border border-stone-300/80 bg-stone-200/40 p-4 text-stone-800 shadow-xs">
      {children}
    </div>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-teal-700 font-medium underline underline-offset-2 hover:text-teal-900">
      {children}
    </a>
  ),
};

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

