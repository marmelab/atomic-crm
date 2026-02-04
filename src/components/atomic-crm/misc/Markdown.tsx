import DOMPurify from "dompurify";
import { marked, type TokenizerExtension } from "marked";

// Extension to auto-link URLs (but not URLs already in markdown link/image syntax)
const urlExtension: TokenizerExtension = {
  name: "autolink",
  level: "inline",
  start(src) {
    // Don't match URLs that are inside markdown link/image syntax
    const match = src.match(/https?:\/\//);
    if (!match) return;
    // Check if this URL is preceded by ]( which indicates it's part of a link/image
    const beforeMatch = src.slice(0, match.index);
    if (beforeMatch.endsWith("](") || beforeMatch.endsWith("(")) {
      return;
    }
    return match.index;
  },
  tokenizer(src) {
    const match = src.match(/^https?:\/\/[^\s<>)[\]]+/);
    if (match) {
      return {
        type: "link",
        raw: match[0],
        href: match[0],
        text: match[0],
        tokens: [{ type: "text", raw: match[0], text: match[0] }],
      };
    }
  },
};

marked.use({
  extensions: [urlExtension],
  breaks: true, // Single newlines become <br> (useful for emails)
  hooks: {
    postprocess: (html) => DOMPurify.sanitize(html),
  },
});

type MarkdownProps = {
  children: string;
  className?: string;
};

export function Markdown({ children, className }: MarkdownProps) {
  const html = marked.parse(children) as string;

  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
