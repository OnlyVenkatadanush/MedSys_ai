import React from "react";

interface FormattedTextProps {
  text: string;
  className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ text, className = "" }) => {
  if (!text) return null;

  // Split into lines to handle headers, lists, and paragraphs
  const lines = text.split("\n");

  const parseInline = (content: string) => {
    // Replace **bold** with <strong>
    const parts = content.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} className="font-bold text-ink font-sans">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={index} className="rounded bg-teal-deep/10 px-1 py-0.5 font-mono text-[11px] font-semibold text-teal-deep">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className={`space-y-1.5 leading-relaxed text-xs ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} className="h-1" />;

        // Header 3 (###)
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={lineIdx} className="font-display font-bold text-sm text-ink pt-1 pb-0.5">
              {parseInline(trimmed.slice(4))}
            </h4>
          );
        }

        // Bullet point (- or *)
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2">
              <span className="text-teal-deep font-bold text-xs shrink-0">•</span>
              <span className="flex-1">{parseInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list (1. 2.)
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s*(.*)/);
          if (match) {
            return (
              <div key={lineIdx} className="flex items-start gap-2 pl-2">
                <span className="font-mono font-bold text-teal-deep text-xs shrink-0">{match[1]}</span>
                <span className="flex-1">{parseInline(match[2])}</span>
              </div>
            );
          }
        }

        // Regular line
        return <p key={lineIdx}>{parseInline(line)}</p>;
      })}
    </div>
  );
};
