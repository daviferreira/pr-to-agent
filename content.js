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
    // document.title is always: "PR title · Pull Request #N · owner/repo · GitHub"
    const parts = document.title.split(" · ");
    if (parts.length >= 2 && parts[1].startsWith("Pull Request")) {
      return parts[0].trim();
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
    // Walk up through the React component tree to find the diff table.
    // In GitHub's current DOM, inline review comments live inside a tr
    // within a .diff-table.
    const diffTable = commentBodyEl.closest(".diff-table");
    if (!diffTable) return "";

    const commentRow = commentBodyEl.closest("tr");
    const lines = [];

    for (const row of diffTable.querySelectorAll("tr")) {
      if (row === commentRow) break;
      if (row.classList.contains("inline-comments")) continue;

      const codeCell = row.querySelector("td.blob-code");
      if (!codeCell) continue;

      const inner = codeCell.querySelector(".blob-code-inner");
      if (!inner) continue;

      let prefix = " ";
      if (codeCell.classList.contains("blob-code-addition")) prefix = "+";
      else if (codeCell.classList.contains("blob-code-deletion")) prefix = "-";

      lines.push(prefix + inner.textContent);
    }

    return lines.slice(-30).join("\n");
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
    commentBodyEl.setAttribute(PROCESSED_ATTR, "1");

    const btn = createButton(commentBodyEl);
    const wrap = document.createElement("span");
    wrap.className = WRAP_CLASS;
    wrap.appendChild(btn);

    // New GitHub React UI: reactions toolbar sits in a sibling/cousin div.
    // Walk up to the BodyHTMLContainer then look for the reactions toolbar.
    const bodyContainer = commentBodyEl.parentElement;
    const reactionsToolbar = bodyContainer
      ? bodyContainer.querySelector('div[role="toolbar"][aria-label="Reactions"]')
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

  function injectAll() {
    // New GitHub React UI: comment bodies carry a [comment-testid] attribute
    document
      .querySelectorAll(`[comment-testid]:not([${PROCESSED_ATTR}])`)
      .forEach(tryInject);

    // Legacy GitHub: .comment-body class
    document
      .querySelectorAll(`.comment-body:not([${PROCESSED_ATTR}])`)
      .forEach(tryInject);
  }

  // ── Init & SPA handling ───────────────────────────────────────────────────

  let pending = false;
  function scheduleInject() {
    if (pending) return;
    pending = true;
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 50)))(() => {
      injectAll();
      pending = false;
    });
  }

  function init() {
    injectStyles();
    injectAll();

    const observer = new MutationObserver(scheduleInject);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("turbo:load", init);
  document.addEventListener("turbo:render", injectAll);
  document.addEventListener("pjax:end", init);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
