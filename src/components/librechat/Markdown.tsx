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
          // react-markdown v10 removed the `inline` prop on `code`. Detect
          // fenced (block) code by the `className` containing `language-` OR
          // the text containing a newline. Anything else is inline code.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code(props: any) {
            const { className, children, node, ...rest } = props;
            const text = String(children ?? '');
            // A fenced code block has either a `language-xxx` className (from
            // a ```lang fence) OR is wrapped in a <pre> (node.position.start
            // line differs from end line) OR contains a newline.
            const isBlock =
              (typeof className === 'string' && /language-/.test(className)) ||
              (node?.position && node.position.start.line !== node.position.end.line) ||
              text.includes('\n');
            if (isBlock) {
              const langMatch = /language-(\w+)/.exec(className || '');
              return <CodeBlock code={text.replace(/\n$/, '')} language={langMatch?.[1]} />;
            }
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
