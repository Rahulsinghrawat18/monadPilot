"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils/cn";

export function MarkdownContent({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed [&>*+*]:mt-2",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        p: ({ children }) => (
          <p className="leading-relaxed text-foreground/95">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-6 space-y-1 my-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-6 space-y-1 my-2">{children}</ol>
        ),
        li: ({ children }) => <li className="text-foreground/95">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {children}
          </a>
        ),
        code: ({ className: cls, children, ...props }) => {
          const inline = !cls;
          if (inline) {
            return (
              <code
                className={cn(
                  "rounded bg-secondary px-1.5 py-0.5 text-[12px] font-mono text-foreground/90",
                  cls
                )}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              className={cn(
                "block rounded-lg bg-secondary px-3 py-2 font-mono text-[12px] text-foreground/90 overflow-x-auto",
                cls
              )}
              {...props}
            >
              {children}
            </code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-border bg-secondary px-3 py-2 text-left font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-border/60 px-3 py-2">{children}</td>
        ),
      }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
