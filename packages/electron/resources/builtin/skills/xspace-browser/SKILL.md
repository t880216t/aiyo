---
name: xspace-browser
description: AI-powered browser automation using the xspace-browser Chrome Extension via MCP bridge. Use this skill when the agent needs to control a Chrome browser — navigating pages, clicking elements, filling forms, capturing screenshots, managing tabs, downloading content, or switching the network proxy — by connecting to the xspace-browser MCP bridge.
version: 1.0.0
metadata:
  openclaw:
    requires:
      bins:
        - npx
    emoji: "🌐"
    homepage: https://xspace-browser.ai
    os: [macos, linux, windows]
---

# xspace-browser Browser Control

xspace-browser is a Chrome extension that exposes 30+ browser automation tools over the Model Context Protocol (MCP). Once connected, the agent can control any Chrome tab using natural language — clicking, typing, navigating, capturing screenshots, downloading content, and more.

**Architecture:**
```
Agent (MCP client) ──stdio──▶ xspace-browser-mcp-bridge ──WebSocket──▶ xspace-browser Chrome Extension ──▶ Browser APIs
```

---

## When to Use This Skill

Use this skill when the user wants to:

- Navigate to URLs, click links, fill forms, or interact with any web page
- Automate multi-step browser workflows
- Extract or download data from web pages
- Capture screenshots of browser tabs
- Manage multiple tabs across browser windows
- Perform browser-assisted testing (accessibility, UX, regression)

---

## Prerequisites

- **xspace-browser Chrome extension** installed (available on the Chrome Web Store or via developer build)
- **Node.js >= 18** installed on the local machine

The user is assumed to have xspace-browser installed. The agent only needs to complete the two connection steps below.

---

## Step 1: Register the MCP Server

Add the following to the agent's MCP configuration. No manual installation is needed — `npx` downloads and runs `xspace-browser-mcp-bridge` automatically.

### Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "xspace-browser": {
      "command": "npx",
      "args": ["-y", "xspace-browser-mcp-bridge"]
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "xspace-browser": {
      "command": "npx",
      "args": ["-y", "xspace-browser-mcp-bridge"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add xspace-browser -- npx -y xspace-browser-mcp-bridge
```

### VS Code Copilot (`.vscode/mcp.json`)

```json
{
  "servers": {
    "xspace-browser": {
      "command": "npx",
      "args": ["-y", "xspace-browser-mcp-bridge"]
    }
  }
}
```

### Windsurf (`mcp_config.json`)

```json
{
  "mcpServers": {
    "xspace-browser": {
      "command": "npx",
      "args": ["-y", "xspace-browser-mcp-bridge"]
    }
  }
}
```

### Custom port (optional)

The bridge listens on `localhost:9223` by default. To use a different port:

```json
{
  "mcpServers": {
    "xspace-browser": {
      "command": "npx",
      "args": ["-y", "xspace-browser-mcp-bridge", "--port", "9224"]
    }
  }
}
```

Then use `ws://localhost:9224` in Step 2.

### After registering

Confirm the `claude mcp add` (or config edit) actually succeeded — exit code 0, no "already exists" or network/npx error — **before** telling the user anything is ready; otherwise they act on a registration that never happened.

**The new MCP tools load only when the agent session starts — they will NOT appear mid-session.** After registering, tell the user to **restart the session (or open a new one)**, then continue. Warn them they'll likely also need Step 2 (extension connected) after the restart, so they aren't interrupted twice.

---

## Step 2: Connect the xspace-browser Extension to the Bridge

After the MCP server is registered and running:

**Fresh installs auto-connect** to `ws://localhost:9223` — no clicking needed. If the connection check below shows it's already connected, skip the rest of this step.

If it is not connected:

1. Open Chrome and click the **xspace-browser** extension icon
2. Go to **Options** (or right-click the icon → "Extension options")
3. Find the **WebSocket Connection** section
4. Enter: `ws://localhost:9223` (a connection **Name** is auto-generated if left blank)
5. Click **Connect**

The bridge and extension will handshake, and all browser tools will become available to the agent.

**Verifying the connection (preflight before any browser action):**
- **No xspace-browser tools present at all** → the bridge isn't registered. Do not try to call them — go to Step 1, then restart the session.
- **Only a connection-check tool (`list_browsers`) is visible, or it returns an empty list** → the extension isn't connected. Do Step 2, then reload the MCP server in agent settings.
- **`list_browsers` returns 2+ browsers** → call `select_browser(name)` before any tool, or calls will fail.

---

## Tool Usage Strategy (IMPORTANT)

Always follow this priority order to minimize token cost and latency:

### Priority 1 — `search_elements` (always try first)

Query the page's accessibility tree to find elements and get their UIDs. Fast, cheap, requires no screenshot.

```
search_elements(tabId, "{button,input,textarea,select,a}*")
```

### Priority 2 — UID-based interaction (preferred)

Use UIDs returned by `search_elements` to interact directly:

- `click(tabId, uid)` — click any element
- `fill_element_by_uid(tabId, uid, value)` — type into inputs
- `hover_element_by_uid(tabId, uid)` — reveal menus or tooltips

### Priority 3 — `capture_screenshot` + `computer` (high-cost fallback only)

Use only when `search_elements` fails after two different query attempts, or when pixel-level interaction is required (canvas, drag-and-drop, sliders).

1. `capture_screenshot(sendToLLM=true)` — see the page
2. `computer(action, coordinate)` — click/type at pixel coordinates

### Standard Workflow

```
get_current_tab()                 # page already open  (get_all_tabs to pick another; create_new_tab for a fresh one)
  → search_elements(tabId, "<pattern>")
  → click(tabId, uid)  OR  fill_element_by_uid(tabId, uid, value)
  → re-run search_elements after the DOM changes — UIDs are per-snapshot and a stale one may have vanished
  → verify the result: get_current_tab (URL change), get_page_metadata, or capture_screenshot(sendToLLM=true)
```

Fill several fields from **one** snapshot in a single call — `fill_form(tabId, [{uid, value}, …])` — then re-snapshot for the submit button and `click` it. There is no `submit_form`; submitting = clicking the submit/login button (or `computer` Enter if the form has none).

---

## Available Tool Categories

| Category | Tools | Description |
|---|---|---|
| Tab Management | 8 tools | Open, close, switch, pin, group tabs |
| UI Interaction | 7 tools | Click, fill, hover, keyboard, coordinate-based |
| Page Content | 4 tools | Metadata, scroll, highlight elements/text |
| Screenshots | 2 tools | Capture visible tab or specific tab |
| Downloads | 3 tools | Save text as markdown, download images |
| Human Intervention | 4 tools | Request user input mid-automation |
| Proxy | 2 tools | List proxy profiles, switch the active proxy |
| Multi-browser | 2 tools | List connected browsers, select the target |

**Key tools by category:**

| Category | Key Tools |
|---|---|
| Tab | `get_all_tabs`, `switch_to_tab`, `create_new_tab`, `close_tab` |
| UI | `search_elements`, `click`, `fill_element_by_uid`, `computer` |
| Page | `get_page_metadata`, `scroll_to_element`, `highlight_element` |
| Screenshot | `capture_screenshot`, `capture_tab_screenshot` |
| Download | `download_text_as_markdown`, `download_image` |
| Intervention | `request_intervention`, `list_interventions` |
| Proxy | `get_proxy_list`, `set_proxy` |
| Multi-browser | `list_browsers`, `select_browser` |

To load complete parameter schemas and examples for every tool:

```
read_skill_reference("xspace-browser", "references/tools-reference.md")
```

---

## Common Patterns

### Navigate to a URL and click a button

```
create_new_tab("https://example.com")
→ search_elements(tabId, "*[Ss]ubmit*")
→ click(tabId, uid)
```

### Fill a login form

```
get_all_tabs()
→ search_elements(tabId, "{input,textbox}*")
→ fill_element_by_uid(tabId, emailUid, "user@example.com")
→ fill_element_by_uid(tabId, passwordUid, "secret")
→ search_elements(tabId, "*[Ll]ogin*")
→ click(tabId, uid)
```

### Extract page content to markdown

```
get_page_metadata()
→ download_text_as_markdown(content, "page-extract")
```

### Switch the network proxy

```
get_proxy_list()                       # find the target profile's profileID (never guess it)
→ set_proxy(profileID)                 # applies immediately to all subsequent requests
```

### Visual verification

```
capture_screenshot(sendToLLM=true)
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Only a connection-check tool visible | Extension not connected to bridge | Open xspace-browser Options → set WebSocket URL → Connect |
| Port 9223 already in use | Port conflict on machine | Use `--port 9224` in MCP config and `ws://localhost:9224` in extension |
| `search_elements` returns 0 results | Page uses canvas or non-semantic HTML | Fall back to `capture_screenshot(sendToLLM=true)` + `computer` tool |
| Connection drops frequently | Service worker sleep cycle | xspace-browser uses keepalive pings; reconnect extension from Options if needed |
| Tools appear but calls time out | Bridge not receiving WebSocket messages | Restart bridge: reload MCP server in agent settings |
| Extension connects then is dropped after a few seconds | Bridge and extension **major versions don't match** (named-connection handshake) | Update the extension to the release matching the bridge (`npx -y` pulls the latest bridge) |
| New tools missing right after `claude mcp add` | MCP tools load only at session start | Restart the agent session / open a new one |
