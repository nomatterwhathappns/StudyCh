function appendInline(parent: HTMLElement, value: string) {
  for (const token of value.split(/(\*\*[^*]+\*\*)/g)) {
    const bold = token.match(/^\*\*(.+)\*\*$/);
    if (bold) { const strong = document.createElement("strong"); strong.textContent = bold[1] ?? ""; parent.append(strong); }
    else parent.append(document.createTextNode(token));
  }
}

export function renderChatMarkdown(target: HTMLElement, markdown: string) {
  target.replaceChildren();
  const lines = markdown.replace(/\r/g, "").split("\n");
  let list: HTMLUListElement | HTMLOListElement | null = null;
  let listKind: "ul" | "ol" | null = null;
  const flushList = () => { list = null; listKind = null; };
  for (const line of lines) {
    if (/^\s*---+\s*$/.test(line)) { const rule = document.createElement("hr"); target.append(rule); flushList(); continue; }
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const kind = ordered ? "ol" : "ul";
      if (!list || listKind !== kind) { list = document.createElement(kind); target.append(list); listKind = kind; }
      const item = document.createElement("li"); appendInline(item, (unordered?.[1] ?? ordered?.[1] ?? "").trim()); list.append(item); continue;
    }
    flushList();
    if (!line.trim()) continue;
    const paragraph = document.createElement("p"); appendInline(paragraph, line.trim()); target.append(paragraph);
  }
}
