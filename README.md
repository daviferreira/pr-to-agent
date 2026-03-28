# pr-to-agent

<img src="icons/icon128.png" width="64" alt="pr-to-agent icon">

A Chrome extension that injects a **"Copy as prompt"** button into GitHub PR comments. One click collects the PR title, description, diff hunk, and comment text into a structured prompt and copies it to your clipboard — ready to paste into Claude, ChatGPT, or any other agent.

## Installation

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the repo folder

## Usage

Open any GitHub pull request. A **"Copy as prompt"** button will appear on each review comment. Click it to copy the full context as a prompt.

## How it works

- Captures the PR title and description automatically
- Extracts the relevant diff hunk for inline review comments (supports both GitHub's React and classic diff viewers)
- Works on the Conversation tab and the Files Changed tab
- Follows GitHub SPA navigation (turbo/pjax)

## Development

```sh
npm install   # installs prettier
```

Format with `npx prettier --write .`.
