/**
 * Minimal, allowlist-based Markdown renderer.
 *
 * Deliberately hand-written rather than pulling in a Markdown library:
 *
 *  1. Guide text lives in the repository today, but content moves — into a
 *     CMS, a spreadsheet, a contractor's pull request — and the renderer
 *     should not become unsafe when it does. It ESCAPES first and only then
 *     emits a fixed set of tags, so there is no path from input to raw HTML.
 *  2. It supports exactly what the guides need: headings, paragraphs, lists,
 *     tables, bold, italic, inline code and links. Anything else renders as
 *     text, which is the safe failure mode.
 *
 * If richer authoring is needed later, swap this for a real parser plus a
 * sanitiser — but keep the escape-then-emit ordering.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline formatting, applied to ALREADY-ESCAPED text. */
function renderInline(escaped: string): string {
  return (
    escaped
      // `code`
      .replace(/`([^`]+)`/g, '<code class="rounded bg-steel-100 px-1 py-0.5 text-[0.9em]">$1</code>')
      // **bold**
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // *italic*
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      // [text](href) — only http(s) and site-relative hrefs are allowed, so a
      // javascript: or data: URL in an article body cannot become a live link.
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text: string, href: string) => {
        const safe = /^(https?:\/\/|\/)[^\s"']*$/.test(href);
        if (!safe) return text;
        const external = href.startsWith("http");
        return `<a href="${href}" class="underline underline-offset-2"${
          external ? ' rel="noopener nofollow" target="_blank"' : ""
        }>${text}</a>`;
      })
  );
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let inList = false;
  let inTable = false;
  let tableHeaderDone = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table></div>");
      inTable = false;
      tableHeaderDone = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const escaped = escapeHtml(line.trim());

    if (line.trim() === "") {
      closeList();
      closeTable();
      continue;
    }

    // --- Tables (| a | b |) ------------------------------------------------
    if (line.trim().startsWith("|")) {
      const cells = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());

      // The |---|---| separator row.
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;

      if (!inTable) {
        closeList();
        // Wide tables scroll inside themselves; the page body never scrolls
        // sideways on a phone.
        out.push(
          '<div class="my-5 overflow-x-auto"><table class="w-full min-w-[24rem] border-collapse text-sm">',
        );
        out.push("<thead><tr>");
        for (const cell of cells) {
          out.push(
            `<th scope="col" class="border-b border-steel-300 px-3 py-2 text-start font-semibold text-steel-800">${renderInline(escapeHtml(cell))}</th>`,
          );
        }
        out.push("</tr></thead><tbody>");
        inTable = true;
        tableHeaderDone = true;
        continue;
      }

      if (tableHeaderDone) {
        out.push("<tr>");
        for (const cell of cells) {
          out.push(
            `<td class="border-b border-steel-200 px-3 py-2 text-steel-700">${renderInline(escapeHtml(cell))}</td>`,
          );
        }
        out.push("</tr>");
        continue;
      }
    } else {
      closeTable();
    }

    // --- Headings ----------------------------------------------------------
    const heading = /^(#{1,4})\s+(.*)$/.exec(line.trim());
    if (heading) {
      closeList();
      const level = Math.min(heading[1]!.length + 1, 5); // h1 is the page title
      const classes =
        level === 2
          ? "mt-8 mb-3 text-xl font-bold text-steel-950"
          : level === 3
            ? "mt-6 mb-2 text-lg font-bold text-steel-950"
            : "mt-5 mb-2 text-base font-semibold text-steel-900";
      out.push(
        `<h${level} class="${classes}">${renderInline(escapeHtml(heading[2]!))}</h${level}>`,
      );
      continue;
    }

    // --- Unordered list ----------------------------------------------------
    const listItem = /^[-*]\s+(.*)$/.exec(line.trim());
    if (listItem) {
      if (!inList) {
        out.push('<ul class="my-4 space-y-1.5 ps-5 [list-style:disc]">');
        inList = true;
      }
      out.push(`<li class="text-steel-700">${renderInline(escapeHtml(listItem[1]!))}</li>`);
      continue;
    }
    closeList();

    // --- Paragraph ---------------------------------------------------------
    out.push(`<p class="my-4 leading-relaxed text-steel-700">${renderInline(escaped)}</p>`);
  }

  closeList();
  closeTable();

  return out.join("\n");
}
