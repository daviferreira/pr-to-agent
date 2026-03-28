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
        text-decoration: none;
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
      }
    `;
    document.head.appendChild(style);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  function getTheme() {
    const mode = document.documentElement.getAttribute("data-color-mode");
    if (mode === "dark") return "dark";
    if (mode === "light") return "light";
    // 'auto' — defer to OS preference
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  // ── Context extraction ────────────────────────────────────────────────────

  function getPRTitle() {
    const el =
      document.querySelector("h1.gh-header-title .js-issue-title") ||
      document.querySelector("h1.gh-header-title");
    return el ? el.textContent.trim() : document.title;
  }

  function getPRDescription() {
    // The PR description is always the first .comment-body in the timeline.
    const el = document.querySelector(".timeline-comment .comment-body");
    return el ? el.innerText.trim() : "";
  }

  function getDiffHunk(commentContainerEl) {
    // Walk up to the nearest diff table — only present for inline diff comments.
    const diffTable = commentContainerEl.closest(".diff-table");
    if (!diffTable) return "";

    // The comment lives in a tr; collect code rows that precede it.
    const commentRow = commentContainerEl.closest("tr");
    const lines = [];

    for (const row of diffTable.querySelectorAll("tr")) {
      if (row === commentRow) break;
      // Skip inline-comment rows (they contain review threads, not code).
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

    // Return at most the last 30 lines for brevity.
    return lines.slice(-30).join("\n");
  }

  // ── Prompt formatting ─────────────────────────────────────────────────────

  function buildPrompt(title, description, diff, comment) {
    return (
      "You are reviewing a GitHub Pull Request.\n\n" +
      `PR Title: ${title}\n\n` +
      "PR Description:\n" +
      `${description}\n\n` +
      "Code Diff:\n" +
      `${diff || "(no diff context available)"}\n\n` +
      "Review Comment:\n" +
      `${comment}\n\n` +
      "Please help me address this review comment."
    );
  }

  // ── Button ────────────────────────────────────────────────────────────────

  function createButton(commentEl) {
    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.setAttribute("data-theme", getTheme());
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Copy PR comment context to clipboard");
    btn.textContent = "Send to Agent";

    btn.addEventListener("click", () => {
      const bodyEl = commentEl.querySelector(".comment-body");
      const comment = bodyEl ? bodyEl.innerText.trim() : "";
      const diff = getDiffHunk(commentEl);
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
            btn.textContent = "Send to Agent";
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

  // Selectors for comment containers that should receive the button.
  // Order matters: more specific first so `.closest()` finds the right level.
  const COMMENT_SELECTORS = [
    ".review-comment", // inline diff review comments
    ".timeline-comment", // PR description + general thread comments
    ".inline-comment-form-container", // inline diff comment forms
    ".js-inline-comments .comment", // comments inside js-inline-comments wrapper
  ].join(", ");

  function tryInject(el) {
    if (el.hasAttribute(PROCESSED_ATTR)) return;

    const commentBody = el.querySelector(".comment-body");
    if (!commentBody) return;

    // Mark before any async work so repeated observer fires are no-ops.
    el.setAttribute(PROCESSED_ATTR, "1");

    const btn = createButton(el);
    const wrap = document.createElement("span");
    wrap.className = WRAP_CLASS;
    wrap.appendChild(btn);

    // Prefer attaching next to existing reaction/action buttons when present.
    const toolbar =
      el.querySelector(".comment-reactions") ||
      el.querySelector(".comment-header-actions");

    if (toolbar) {
      toolbar.appendChild(wrap);
    } else {
      // Fallback: insert immediately after the comment body.
      commentBody.insertAdjacentElement("afterend", wrap);
    }
  }

  function injectAll() {
    document.querySelectorAll(COMMENT_SELECTORS).forEach(tryInject);
  }

  // ── Init & SPA handling ───────────────────────────────────────────────────

  // Debounce MutationObserver callbacks — GitHub emits many mutations at once.
  let pending = false;
  function scheduleInject() {
    if (pending) return;
    pending = true;
    // Use requestIdleCallback when available, otherwise a short setTimeout.
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

  // GitHub uses Turbo (formerly pjax) for SPA navigation.
  document.addEventListener("turbo:load", init);
  document.addEventListener("turbo:render", injectAll);
  document.addEventListener("pjax:end", init);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
