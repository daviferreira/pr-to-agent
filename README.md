# pr-to-agent

<img src="icons/icon128.png" width="64" alt="pr-to-agent icon">

A Chrome extension that injects a **"Copy as prompt"** button into GitHub PR comments.

![Screenshot](screenshot.png) One click collects the PR title, description, diff hunk, and comment text into a structured prompt and copies it to your clipboard — ready to paste into Claude, Cursor, or any other agent.

## Installation

### Load unpacked (development / personal use)

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the repo folder

### Chrome Web Store

Coming soon.

### Pack locally (.crx)

1. Go to `chrome://extensions` and enable **Developer mode**
2. Click **Pack extension** and select the repo folder
3. Chrome produces a `.crx` file and a `.pem` key — keep the `.pem` safe, you'll need it to sign future updates

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
