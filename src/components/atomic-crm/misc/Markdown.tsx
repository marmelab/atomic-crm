import { cn } from "@/lib/utils";
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
    <div
      className={cn(
        // Paragraphs
        "[&_p]:leading-5 [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        // Headings
        "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4 [&_h1:first-child]:mt-0",
        "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-3 [&_h2:first-child]:mt-0",
        "[&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3:first-child]:mt-0",
        "[&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_h4:first-child]:mt-0",
        "[&_h5]:text-base [&_h5]:font-semibold [&_h5]:mt-3 [&_h5]:mb-2 [&_h5:first-child]:mt-0",
        "[&_h6]:text-sm [&_h6]:font-semibold [&_h6]:mt-3 [&_h6]:mb-2 [&_h6:first-child]:mt-0",
        // Blockquotes
        "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground",
        // Links
        "[&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline",
        // Lists
        "[&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-2",
        "[&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-2",
        "[&_li]:my-1",
        "[&_ul_ul]:my-0 [&_ol_ol]:my-0 [&_ul_ol]:my-0 [&_ol_ul]:my-0",
        // Code
        "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono",
        "[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:my-4",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        // Tables
        "[&_table]:w-full [&_table]:border-collapse [&_table]:my-4",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-4 [&_td]:py-2",
        "[&_tr:nth-child(even)]:bg-muted/50",
        // Horizontal rule
        "[&_hr]:border-t [&_hr]:border-border [&_hr]:my-4",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
