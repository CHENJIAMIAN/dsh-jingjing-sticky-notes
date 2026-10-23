# Jingjing Sticky Notes · dsh-jingjing-sticky-notes

<p align="center"><img src="icon.svg" width="88" height="88" alt="dsh-jingjing-sticky-notes"></p>

<p align="center">
  <b>Pin what matters from a conversation as Markdown notes, ready when you need them.</b>
</p>

<p align="center">
  English · <a href="README.md">简体中文</a>
</p>

---

Sticky Notes turns important replies, arbitrary text selections, or an entire conversation in
DeepSeek Harness into local Markdown notes. Notes live in the right sidebar, where you can reopen,
compare, rename, and insert them back into the composer — whole or by selection. Each note can also
open as a draggable, resizable in-app floating window, so several notes can be compared at once.

When a long conversation makes you scroll back for that table, checklist, or conclusion again and
again, this panel is your scratch pad.

## Features

### Capturing
- **Capture a reply**: the note icon under every assistant reply. The Host reads the original text
  from the session log instead of scraping the DOM, so Markdown is preserved exactly;
- **Capture a selection**: select text in the conversation, then click "Pin note" in the floating
  button. Inside the chat transcript the fragment is rebuilt as Markdown from the rendered DOM
  (headings, lists, task checkboxes, code fences, tables, quotes, links and inline formatting);
  for the exact source capture a whole reply instead;
- **Capture the whole chat**: one click in the notes toolbar folds the visible user/assistant text
  into a single excerpt note.

### Notes panel (right sidebar)
- Three views: **Workspace** (the default — every note collected in the workspace, grouped by
  source chat), **Chat** (only the current chat), and **Global** (across chats and workspaces).
  Search and a note count are included;
- In the workspace view, groups whose source chat is archived sink to the bottom and carry an
  "Archived" chip; a banner above the list moves those notes to the recycle bin in one action;
- Each note is a capsule card: title + one-line snippet + time on the left, a 3×2 action grid on the
  right, separated by a single dashed vertical rule;
- **Inline actions**: favorite, open in a floating window, insert into chat, toggle visibility, move
  to the recycle bin (two clicks, resets after 3 seconds) — no need to open the detail view;
- **Favorites first**: favorited notes are pinned to the top inside their group; groups follow by
  the newest note, with archived groups last;
- A "Recycle bin" entry sits at the end of every list.

### Detail view
- The action bar sits at the top: insert whole note, insert selection, insert as file, copy,
  make global / move to workspace, move to the recycle bin;
- Edit title and body with a Markdown preview, and switch visibility;
- The "Open in floating window" button in the title row turns this note into a floating window.

### Floating notes (new)
- The "Open in floating window" action on a card or in the detail view opens the note as its own tab
  and floats it above the conversation; dragging a note tab out of the right sidebar floats it too;
- Drag the title bar to move it, drag the bottom-right corner to resize, use the dock button to put
  it back into the right sidebar, or the close button to remove it. DSH saves the rectangle per
  session and restores it after a reload/restart;
- Several note windows can be open at once for comparison. Floating notes are **read-only**: copy,
  insert whole note, and insert selection still work, but edit in the detail view;
- The notes toolbar has a "Close all floating notes" button that closes every note float of the
  current session at once — the recovery path when a window was dragged off screen;
- Floats belong to the current session; they hide when you switch chats or open a global page such as
  Settings, and come back with the chat.

### Recycle bin
- Deleting a note moves it into the recycle bin first: workspace notes go to that workspace's
  `.trash/`, global notes to the global `.trash/`; each note can be restored;
- "Empty" permanently deletes the notes in that bin. The confirmation states that files are really
  removed and cannot be recovered — it is the only irreversible notes action.

### Inserting back into the conversation
- **Insert whole note**: appends `## Title` plus the body to the composer;
- **Insert selection**: appends only the fragment selected in the detail view;
- **Insert as file**: appends the absolute path of the note file so the model can read it.

### More
- Every note is a local `.md` file with frontmatter — editable in any editor, friendly to Git;
- Markdown rendering: headings, lists, task checkboxes, tables, code fences, quotes, links, bold and
  italic. Content is escaped before rendering; links are limited to `http(s)://`, `mailto:`, `#`,
  and `/`;
- **Multilingual**: the UI follows DSH's language switch (Settings → General → Language) between
  Chinese and English live, with no reload; error messages and generated "whole chat" content follow
  the active language too;
- **Keyboard and a11y**: Tab focus, `aria-label` / `aria-pressed`, visible focus rings, and
  `prefers-reduced-motion` support.

## Preview

```
┌─────────────────────────┊──────────────┐
│ Note title               ┊  ☆    ⧉    ↓   │
│ One-line snippet         ┊  ⊕    🗑        │
│ [Workspace] 14:20       ┊                │
└─────────────────────────┴──────────────┘
   ☆ favorite (pinned inside its group)
   ⧉ open in a floating window (move / resize)
   ↓ insert into the composer
   ⊕ switch global / workspace
   🗑 move to the recycle bin (two-step confirmation)
```

## Installation

Requires DeepSeek Harness desktop 0.2.x (developed against `0.2.1-rc.2`). No extra dependencies.

### Plugin manager (recommended)

Install this directory from the in-app plugin manager, then **fully restart the client**.

### Command line

```sh
dsh plugin --profile desktop add link:/absolute/path/to/dsh-jingjing-sticky-notes
```

> On Windows write the path as `link:D:/path/to/dsh-jingjing-sticky-notes`.
> If the desktop app has not added `dsh` to PATH, installing through the plugin manager has the same
> effect.

After installation, the Host half needs a full client restart; the Client half only needs a page
reload.

## Usage

1. Open the notes panel: click the note icon next to the chat title, or the "Sticky Notes" tab in the
   right sidebar;
2. Capture content: the reply icon / the floating button after selecting text / "Save whole chat" in
   the toolbar;
3. Act directly in the list, or open a card to read the full Markdown; the workspace view groups
   notes by source chat, and archived chats carry an "Archived" chip;
4. Insert it back with "Insert whole note", "Insert selection", or "Insert as file";
5. To see several notes at once, click "Open in floating window" on a card; floats can be moved,
   resized, and docked back into the sidebar;
6. If a floating window was moved out of sight, return to the notes panel and click "Close all
   floating notes" in the toolbar;
7. Deleted notes wait in the recycle bin at the end of the list — restore them one by one, or empty
   the bin after the warning.

## Storage

Notes live in two places, and each store has its own recycle bin:

| Kind | Location | Notes |
|---|---|---|
| Workspace note (`scope: session`) | `<session working directory>/.dsh-notes/` | Shared by the whole workspace; can be backed up or versioned |
| Global note (`scope: global`) | `~/.dsh/sticky-notes/notes/` | Shared across every project |
| Workspace recycle bin | `<session working directory>/.dsh-notes/.trash/` | Notes deleted in this workspace; visible only here |
| Global recycle bin | `~/.dsh/sticky-notes/notes/.trash/` | Notes deleted globally; visible from every project |

> The package was renamed to `dsh-jingjing-sticky-notes` in 1.7.0; the storage paths above and the
> plugin's internal ids are unchanged, so notes already on disk keep working.

The session working directory comes from `SessionHeader.cwd` (the workspace path the session was
created in).

- **Workspace view**: every chat note in the current workspace directory (no longer filtered by
  `sessionId`), plus legacy chat notes stored in the global directory whose source chat resolves to
  this workspace;
- **Chat view**: narrows that set to the current `sessionId`;
- **Global view**: only `scope: global` notes;
- "Make global / Move to workspace" moves the file between the two directories. The archived mark
  comes from the DSH workspace registry's `archivedSessionIds`; when that is unavailable the mark and
  the bulk cleanup are hidden.

```
D:\Projects\some-project\.dsh-notes\          # workspace notes (directory name configurable)
├── 2026-10-21-issue-list-7f3a9c1d2e4b.md
└── .trash\                                  # workspace recycle bin
    └── 2026-10-20-old-note-4c2e1a9b8d7f.md

C:\Users\<you>\.dsh\sticky-notes\notes\        # global notes
├── 2026-10-21-shared-conventions-9a1c2b3d4e5f.md
└── .trash\                                  # global recycle bin
```

### File format

```markdown
---
id: "7f3a9c1d2e4b"
title: "Issue list"
scope: session
favorite: false
sessionId: "session-...."
sessionTitle: null
createdAt: 1761000000000
updatedAt: 1761000000000
trashedAt: 1761000009999
---

Body (the Markdown, saved as-is)
```

- `scope`: `session` (visible to the whole workspace) | `global` (visible everywhere);
- `favorite`: when `true` the note sorts first inside its group; older files without the key are
  read as `false`;
- `sessionId`: the source chat, used for grouping and the archived mark — retained even after
  switching to `global`;
- `trashedAt`: present only on notes inside a recycle bin; removed again on restore;
- Hand edits to frontmatter take effect on the next list refresh; broken files are skipped without
  hiding other notes;
- Older versions also stored workspace notes in the global directory. They still show up (visible
  from their own chat, and merged into the workspace view once the workspace resolves), and move to
  the project directory once edited or when visibility is toggled;
- Consider adding `.dsh-notes/` to the project's `.gitignore` (skip that if you want notes versioned;
  the recycle bin lives inside it too).

### Configuration

Override the row in the profile's `cordis.patch.yml` (a patch replaces the whole `config`, so restate
every key):

```yaml
- id: sticky-notes
  config:
    directory: ''                    # global note directory; empty = $DSH_HOME/sticky-notes/notes
    projectDirectory: '.dsh-notes'   # workspace note directory (scope: session), relative to the session working dir
    maxNotes: 2000
```

| Key | Default | Description |
|---|---|---|
| `directory` | `''` | Global notes directory; empty means `$DSH_HOME/sticky-notes/notes` |
| `projectDirectory` | `.dsh-notes` | Workspace notes directory (`scope: session`), relative to the session working directory |
| `maxNotes` | `2000` | Note count limit (checked on write) |

An absolute `projectDirectory` or one containing `..` falls back to the default `.dsh-notes`.

## Development

This directory is the source repository; the profile installs it through a `link:`, so editing files
here edits the running plugin.

| File | Purpose |
|---|---|
| `index.js` | Host half: note service (13 Typert Remote endpoints), project directory resolution, session log capture, recycle bin and archived cleanup |
| `client.js` | Client half: sidebar panel (workspace groups / recycle bin), floating note tabs, capture affordances, Markdown renderer and selection rebuild, insert-back, styles and copy |
| `lib/store.js` | Markdown store: frontmatter parse/serialize, ordering, store and recycle bin I/O |
| `lib/schemas.js` | Hand-written dependency-free request validators (no zod: a missing module there would take the Host down) |
| `lib/typert.host.js` | Host-side Typert manifest |
| `cordis.patch.yml` | Bundle declaration: plugin row and default config |
| `locale/*.json` | Localized plugin metadata (title / description) |
| `test/*.mjs` | Unit tests, Host/Client contract tests, and client smoke tests |

- **Host half** (`index.js`, `lib/*.js`, `cordis.patch.yml`, `package.json`) requires a **full client
  restart**;
- **Client half** (`client.js`) only needs a page reload; if an in-window reload does not re-run the
  plugin, reopen the chat page;
- No build step: the Client half is plain JavaScript served to the page as-is;
- Run tests: `node --test` (or `pnpm test`). Only Node's built-in `node:test` is used; no install
  required.

## Compatibility

- Targets DeepSeek Harness desktop 0.2.x (developed against `0.2.1-rc.2`);
- The Host uses only Node built-ins plus host-provided peer dependencies (`@deepseek-ai/cordis`,
  `dsh-session`, `dsh-typert-protocol`);
- The Client depends only on the host-injected `react` and bundles nothing extra.

## Known limits

- A note float is an in-app DSH floating pane, not an operating-system window: it cannot leave the
  DSH window, appear in Alt-Tab, or move to another display;
- Floats are saved per session: they hide when you switch chats or open a global page such as
  Settings, and return with the chat;
- Floating notes are read-only and never write note files; edits made in the list/detail view are
  re-read and shown automatically, and the refresh button in the float's toolbar re-reads manually;
- "Close all floating notes" closes the current session's note floats only; it never closes the notes
  manager tab itself;
- Floats come from DSH's right-sidebar docking layout (dockkit). When the host does not expose
  `openResource` / `float`, the float buttons hide and the list/detail views keep working;
- **Workspace view** shows notes from every chat in the same workspace — a visibility change from
  older versions, where chats stayed private. Use **Chat** when you only want the current chat;
- The archived mark and the workspace-view "Move to bin" bulk action only apply to the workspace
  view; global notes are never part of that bulk action and are deleted one at a time;
- The archived state comes from the DSH workspace registry. When it is unavailable (a host without
  the workspace feature), the mark is hidden and the bulk cleanup reports an error;
- Archiving is reversible at any time, but a note moved to the recycle bin is only recoverable until
  the bin is emptied; "Empty" really unlinks the files and cannot be undone;
- The workspace recycle bin lives in the project directory and is visible only there; the global
  recycle bin is visible from every workspace;
- If the session working directory is not writable (read-only mount, permissions), writes fail with
  an error; when the working directory is missing or the session header cannot be read, chat notes
  fall back to the global directory instead of being lost;
- Capture relies on the host's `sessionPersistence`; a very new chat that has not been flushed may not
  expose the reply text yet — send one message and capture again;
- "Save whole chat" joins the visible user/assistant text into one note and skips reasoning, tool
  calls, and tool output;
- "Pin note" rebuilds Markdown from the rendered DOM: headings, lists, code fences and tables survive,
  but the original markers (`*` vs `_`, reference links, footnotes, raw HTML) are normalized or lost,
  and a half-selected first/last block gets the marker of its heading / list / quote / code block.
  Use the reply capture button when the exact source matters;
- Note contents are never translated when the UI language changes — existing files stay as written.

## License

[MIT](LICENSE) © 2026 tryqylz

Free to use, modify, distribute, and use commercially; keep the copyright notice and license text.
