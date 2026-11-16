import { Fragment, type ReactNode } from 'react';
import { parseSafeText, type InlineNode } from '@commons/shared';

function renderInline(nodes: InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}.${i}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.text}</Fragment>;
      case 'bold':
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case 'italic':
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case 'link':
        // The formatter only ever produces https links. The check is repeated here on purpose.
        if (!node.href.startsWith('https://')) return <Fragment key={key}>{node.text}</Fragment>;
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {node.text}
          </a>
        );
    }
  });
}

/**
 * Renders text someone typed. It is never treated as HTML: the text is parsed
 * into plain nodes and each node becomes a React element, so React escapes
 * everything. Supported formatting: paragraphs, *italic*, **bold**, https links.
 */
export function SafeText({ text, className }: { text: string; className?: string }) {
  const paragraphs = parseSafeText(text);
  return (
    <div className={className}>
      {paragraphs.map((paragraph, p) => (
        <p key={p}>
          {paragraph.lines.map((line, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {renderInline(line, `${p}.${l}`)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}
