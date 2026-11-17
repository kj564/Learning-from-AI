'use client';

/**
 * Markdown renderer faithful to LibreChat's content rendering:
 *   - Paragraphs whitespace-pre-wrap
 *   - Multi-line fenced code → CodeBlock (with copy + download)
 *   - Inline code → plain <code>
 *   - GFM tables, lists, links
 *   - Streaming-aware: a blinking caret on the final block while streaming
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

interface MarkdownProps {
  content: string;
  streaming?: boolean;
}

export default function Markdown({ content, streaming }: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code(props: any) {
            const { inline, className, children, ...rest } = props;
            const text = String(children ?? '');
            // Multi-line code block (fenced) → use CodeBlock
            if (!inline && text.includes('\n')) {
              const langMatch = /language-(\w+)/.exec(className || '');
              return <CodeBlock code={text.replace(/\n$/, '')} language={langMatch?.[1]} />;
            }
            // Inline code (single line, even if fenced with no newlines)
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
          a(props) {
            const { href, children } = props as React.AnchorHTMLAttributes<HTMLAnchorElement>;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && (
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-text-primary align-text-bottom" aria-hidden />
      )}
    </div>
  );
}
