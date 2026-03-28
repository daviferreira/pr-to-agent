(function () {
  "use strict";

  const BUTTON_CLASS = "pta-btn";
  const WRAP_CLASS = "pta-wrap";
  const PROCESSED_ATTR = "data-pta-processed";
  const STYLES_ID = "pta-styles";

  // ── Styles ────────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLES_ID)) return;
    const style = document.createElement("style");
    style.id = STYLES_ID;
    style.textContent = `
      .${BUTTON_CLASS} {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-weight: 500;
        line-height: 20px;
        border-radius: 4px;
        border: 1px solid;
        cursor: pointer;
        transition: opacity 0.15s ease;
        white-space: nowrap;
        vertical-align: middle;
        user-select: none;
      }
      .${BUTTON_CLASS}:hover:not(:disabled) { opacity: 0.75; }
      .${BUTTON_CLASS}:focus-visible {
        outline: 2px solid #0969da;
        outline-offset: 2px;
      }
      .${BUTTON_CLASS}[data-theme="light"] {
        background-color: #f6f8fa;
        color: #24292f;
        border-color: rgba(27, 31, 36, 0.15);
      }
      .${BUTTON_CLASS}[data-theme="dark"] {
        background-color: #21262d;
        color: #c9d1d9;
        border-color: rgba(240, 246, 252, 0.1);
      }
      .${BUTTON_CLASS}:disabled {
        opacity: 0.55;
        cursor: default;
      }
      .${WRAP_CLASS} {
        display: inline-block;
        margin-left: 6px;
        vertical-align: middle;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  function getTheme() {
    const mode = document.documentElement.getAttribute("data-color-mode");
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  // ── Context extraction ────────────────────────────────────────────────────

  function getPRTitle() {
    // document.title format: "PR title by author · Pull Request #N · owner/repo · GitHub"
    const firstSegment = document.title.split(" · ")[0] || "";
    if (firstSegment) {
      // Strip trailing " by {github-username}" (usernames: alphanumeric + hyphens)
      return firstSegment.replace(/ by [a-zA-Z0-9-]{1,39}$/, "").trim();
    }
    // Fallback for legacy page structure
    const el =
      document.querySelector("h1.gh-header-title .js-issue-title") ||
      document.querySelector("h1.gh-header-title");
    return el ? el.textContent.trim() : document.title;
  }

  function getPRDescription() {
    // In GitHub's React UI, comment-testid values are prefixed by type:
    //   IC_   = Issue Comment (PR description + general thread comments)
    //   PRRC_ = Pull Request Review Comment (inline diff comments)
    // The PR body is always the first IC_ comment on the page.
    const el =
      document.querySelector('[comment-testid*="IC_"]') ||
      // Legacy GitHub fallback
      document.querySelector(".js-comment-container .comment-body") ||
      document.querySelector(".timeline-comment .comment-body");
    return el ? el.innerText.trim() : "";
  }

  function getDiffHunk(commentBodyEl) {
    let table = commentBodyEl.closest("table");

    // Conversation tab: diff table is a sibling cousin, not an ancestor.
    // Walk up to the thread container and search downward.
    if (!table) {
      const threadContainer = commentBodyEl.closest(
        "details, .review-thread-component, .js-resolvable-timeline-thread-container",
      );
      table =
        threadContainer?.querySelector(
          'table[aria-label^="Diff for:"], table.diff-table',
        ) || null;
    }

    if (!table) return "";

    // ── React (new) diff: table[aria-label="Diff for: <file>"] ───────────
    // Rows are tr.diff-line-row; inline comment lives inside the same td
    // as the commented line.
    if (table.getAttribute("aria-label")?.startsWith("Diff for: ")) {
      const fileName = table
        .getAttribute("aria-label")
        .slice("Diff for: ".length)
        .trim();
      const commentRow = commentBodyEl.closest("tr");
      const lines = [];

      for (const row of table.querySelectorAll("tr.diff-line-row")) {
        if (row.querySelector("td.diff-hunk-cell")) continue;
        const codeEl = row.querySelector("code.diff-text:not(.hunk)");
        if (!codeEl) continue;
        const inner = codeEl.querySelector(".diff-text-inner");
        if (!inner) continue;
        let prefix = " ";
        if (codeEl.classList.contains("addition")) prefix = "+";
        else if (codeEl.classList.contains("deletion")) prefix = "-";
        lines.push(prefix + inner.textContent);
        if (row === commentRow || row.contains(commentBodyEl)) break;
      }

      const code = lines.slice(-30).join("\n");
      return fileName ? `File: ${fileName}\n${code}` : code;
    }

    // ── Classic diff: table.diff-table ────────────────────────────────────
    // Rows are plain tr; inline comments are in a separate tr.inline-comments.
    // Code cells: td.blob-code-addition/deletion/context + span.blob-code-inner.
    if (table.classList.contains("diff-table")) {
      const threadContainer = commentBodyEl.closest(
        "details, .review-thread-component, .js-resolvable-timeline-thread-container",
      );
      const fileName =
        table.closest(".file")?.getAttribute("data-tagsearch-path") ||
        threadContainer?.querySelector("summary a")?.textContent.trim() ||
        "";
      const commentRow = commentBodyEl.closest("tr.inline-comments");
      const lines = [];

      for (const row of table.querySelectorAll("tr")) {
        if (row === commentRow) break;
        if (row.querySelector("td.blob-code-hunk")) continue;

        const codeCell = row.querySelector(
          "td.blob-code:not(.blob-code-hunk):not(.blob-code-empty):not(.empty-cell)",
        );
        if (!codeCell) continue;

        const inner = codeCell.querySelector(".blob-code-inner");
        if (!inner) continue;

        let prefix = " ";
        if (codeCell.classList.contains("blob-code-addition")) prefix = "+";
        else if (codeCell.classList.contains("blob-code-deletion"))
          prefix = "-";

        lines.push(prefix + inner.textContent.trim());
      }

      const code = lines.slice(-30).join("\n");
      return fileName ? `File: ${fileName}\n${code}` : code;
    }

    return "";
  }

  // ── Prompt formatting ─────────────────────────────────────────────────────

  function buildPrompt(title, description, diff, comment) {
    const parts = [`PR Title: ${title}`];
    if (description) {
      parts.push(`PR Description:\n${description}`);
    }
    if (diff) {
      parts.push(`Code Diff:\n${diff}`);
    }
    parts.push(`Review Comment:\n${comment}`);
    parts.push("Please help me address this review comment.");
    return parts.join("\n\n");
  }

  // ── Button ────────────────────────────────────────────────────────────────

  function createButton(commentBodyEl) {
    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.setAttribute("data-theme", getTheme());
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Copy PR comment context to clipboard");
    btn.textContent = "Copy as prompt";

    btn.addEventListener("click", () => {
      const comment = commentBodyEl.innerText.trim();
      const diff = getDiffHunk(commentBodyEl);
      const prompt = buildPrompt(
        getPRTitle(),
        getPRDescription(),
        diff,
        comment,
      );

      navigator.clipboard
        .writeText(prompt)
        .then(() => {
          btn.textContent = "Copied!";
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = "Copy as prompt";
            btn.disabled = false;
          }, 2000);
        })
        .catch((err) => {
          console.warn("[pr-to-agent] Clipboard write failed:", err);
        });
    });

    return btn;
  }

  // ── Injection ─────────────────────────────────────────────────────────────

  function tryInject(commentBodyEl) {
    if (commentBodyEl.hasAttribute(PROCESSED_ATTR)) return;

    // Skip the PR description — it's the source, not a review comment.
    // Legacy: lives inside div#pullrequest-{id}
    if (commentBodyEl.closest('[id^="pullrequest-"]')) return;
    // React: the PR body is the first [comment-testid*="IC_"] on the page
    if (
      commentBodyEl.getAttribute("comment-testid")?.includes("IC_") &&
      commentBodyEl === document.querySelector('[comment-testid*="IC_"]')
    )
      return;

    commentBodyEl.setAttribute(PROCESSED_ATTR, "1");

    const btn = createButton(commentBodyEl);
    const wrap = document.createElement("span");
    wrap.className = WRAP_CLASS;
    wrap.appendChild(btn);

    // New GitHub React UI: reactions toolbar sits in a sibling/cousin div.
    // Walk up to the BodyHTMLContainer then look for the reactions toolbar.
    const bodyContainer = commentBodyEl.parentElement;
    const reactionsToolbar = bodyContainer
      ? bodyContainer.querySelector(
          'div[role="toolbar"][aria-label="Reactions"]',
        )
      : null;

    if (reactionsToolbar) {
      reactionsToolbar.appendChild(wrap);
      return;
    }

    // Legacy GitHub: comment-reactions bar
    const legacyReactions = commentBodyEl
      .closest(".js-comment, .review-comment, .timeline-comment, .comment")
      ?.querySelector(".comment-reactions, .comment-header-actions");

    if (legacyReactions) {
      legacyReactions.appendChild(wrap);
      return;
    }

    // Ultimate fallback: insert directly after the comment body element
    commentBodyEl.insertAdjacentElement("afterend", wrap);
  }

  function isPRPage() {
    return /\/pull\/\d+/.test(location.pathname);
  }

  function injectAll() {
    if (!isPRPage()) return;
    // New GitHub React UI: comment bodies carry a [comment-testid] attribute
    document
      .querySelectorAll(`[comment-testid]:not([${PROCESSED_ATTR}])`)
      .forEach(tryInject);

    // Legacy GitHub: .comment-body class
    // Exclude .js-preview-body (the "Nothing to preview" pane in reply forms)
    document
      .querySelectorAll(
        `.comment-body:not(.js-preview-body):not([${PROCESSED_ATTR}])`,
      )
      .forEach(tryInject);
  }

  // ── Init & SPA handling ───────────────────────────────────────────────────

  let pending = false;
  function scheduleInject() {
    if (pending) return;
    pending = true;
    // Use setTimeout(0) rather than requestIdleCallback — rIC can be delayed
    // for seconds when the browser is busy rendering after SPA navigation.
    setTimeout(() => {
      injectAll();
      pending = false;
    }, 0);
  }

  // Run injectAll immediately, then retry at increasing intervals to catch
  // comments loaded lazily via <include-fragment> after turbo navigation.
  function injectWithRetries() {
    injectAll();
    [200, 500, 1000, 2500].forEach((delay) => setTimeout(injectAll, delay));
  }

  // Create the observer once — never re-create it on SPA navigation.
  const observer = new MutationObserver(scheduleInject);

  function init() {
    injectStyles();
    injectWithRetries();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("turbo:load", injectWithRetries);
  document.addEventListener("turbo:render", injectWithRetries);
  document.addEventListener("turbo:morph", injectWithRetries);
  document.addEventListener("pjax:end", injectWithRetries);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
