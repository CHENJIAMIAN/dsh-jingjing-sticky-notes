# Sticky Notes · dsh-sticky-notes

<p align="center"><img src="icon.svg" width="88" height="88" alt="dsh-sticky-notes"></p>

<p align="center">
  <b>Pin what matters from a conversation as Markdown notes, ready when you need them.</b>
</p>

<p align="center">
  English · <a href="README.md">简体中文</a>
</p>

---

Sticky Notes turns important replies, arbitrary text selections, or an entire conversation in
DeepSeek Harness into local Markdown notes. Notes live in the right sidebar, where you can reopen,
compare, rename, and insert them back into the composer — whole or by selection.

When a long conversation makes you scroll back for that table, checklist, or conclusion again and
again, this panel is your scratch pad.

## Features

### Capturing
- **Capture a reply**: the note icon under every assistant reply. The Host reads the original text
  from the session log instead of scraping the DOM, so Markdown is preserved exactly;
- **Capture a selection**: select text in the conversation, then click "Pin note" in the floating
  button;
- **Capture the whole chat**: one click in the notes toolbar folds the visible user/assistant text
  into a single excerpt note.

### Notes panel (right sidebar)
- Shows **this chat** by default; switch to **Global** to see every global note. Search and a note
  count are included;
- Each note is a capsule card: title + one-line snippet + chat/time on the left, a 2×2 action grid on
  the right, separated by a single dashed vertical rule;
- **Inline actions**: favorite, insert into chat, toggle visibility, delete (two clicks, resets
  after 3 seconds) — no need to open the detail view;
- **Favorites first**: favorited notes are pinned to the top; the rest follow by last modified time.

### Detail view
- The action bar sits at the top: insert whole note, insert selection, insert as file, copy,
  make global/private, delete;
- Edit title and body with a Markdown preview, and switch visibility.

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
┌─────────────────────────┊────────────┐
│ Note title               ┊  ☆     ↓   │
│ One-line snippet         ┊            │
│ [Chat] 14:20            ┊  ⊕     🗑   │
└─────────────────────────┴────────────┘
   ⊙ favorite (pin to top)
   ↓ insert into the composer
   ⊕ switch global / chat-only
   🗑 delete (two-step confirmation)
```

## Installation

Requires DeepSeek Harness desktop 0.2.x (developed against `0.2.1-rc.2`). No extra dependencies.

### Plugin manager (recommended)

Install this directory from the in-app plugin manager, then **fully restart the client**.

### Command line

```sh
dsh plugin --profile desktop add link:/absolute/path/to/dsh-sticky-notes
```

> On Windows write the path as `link:D:/path/to/dsh-sticky-notes`.
> If the desktop app has not added `dsh` to PATH, installing through the plugin manager has the same
> effect.

After installation, the Host half needs a full client restart; the Client half only needs a page
reload.

## Usage

1. Open the notes panel: click the note icon next to the chat title, or the "Sticky Notes" tab in the
   right sidebar;
2. Capture content: the reply icon / the floating button after selecting text / "Save whole chat" in
   the toolbar;
3. Act directly in the list, or open a card to read the full Markdown;
4. Insert it back with "Insert whole note", "Insert selection", or "Insert as file".

## Storage

Notes live in two places:

| Kind | Location | Notes |
|---|---|---|
| Chat note (`scope: session`) | `<session working directory>/.dsh-notes/` | Travels with the project; can be backed up or versioned |
| Global note (`scope: global`) | `~/.dsh/sticky-notes/notes/` | Shared across every project |

The session working directory comes from `SessionHeader.cwd` (the workspace path the session was
created in). The list shows the current project's chat notes plus all global notes; toggling
"global / chat" moves the file between the two directories.

```
D:\Projects\some-project\.dsh-notes\          # project notes (directory name configurable)
└── 2026-10-21-issue-list-7f3a9c1d2e4b.md

C:\Users\<you>\.dsh\sticky-notes\notes\        # global notes
└── 2026-10-21-shared-conventions-9a1c2b3d4e5f.md
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
---

Body (the Markdown, saved as-is)
```

- `scope`: `session` | `global`;
- `favorite`: when `true` the note sorts first; older files without the key are read as `false`;
- `sessionId`: the source chat, kept for provenance — retained even after switching to `global`;
- Hand edits to frontmatter take effect on the next list refresh; broken files are skipped without
  hiding other notes;
- Older versions also stored chat notes in the global directory. Those notes still show by
  `sessionId`, and move to the project directory once edited or when visibility is toggled;
- Consider adding `.dsh-notes/` to the project's `.gitignore` (skip that if you want notes versioned).

### Configuration

Override the row in the profile's `cordis.patch.yml` (a patch replaces the whole `config`, so restate
every key):

```yaml
- id: sticky-notes
  config:
    directory: ''                    # global note directory; empty = $DSH_HOME/sticky-notes/notes
    projectDirectory: '.dsh-notes'   # chat note directory, relative to the session working dir
    maxNotes: 2000
```

| Key | Default | Description |
|---|---|---|
| `directory` | `''` | Global notes directory; empty means `$DSH_HOME/sticky-notes/notes` |
| `projectDirectory` | `.dsh-notes` | Chat notes directory, relative to the session working directory |
| `maxNotes` | `2000` | Note count limit (checked on write) |

An absolute `projectDirectory` or one containing `..` falls back to the default `.dsh-notes`.

## Development

This directory is the source repository; the profile installs it through a `link:`, so editing files
here edits the running plugin.

| File | Purpose |
|---|---|
| `index.js` | Host half: note service (9 Typert Remote endpoints), project directory resolution, session log capture |
| `client.js` | Client half: sidebar panel, capture affordances, Markdown renderer, insert-back, styles and copy |
| `lib/store.js` | Markdown store: frontmatter parse/serialize, ordering, directory I/O |
| `lib/schemas.js` | Hand-written dependency-free request validators (no zod: a missing module there would take the Host down) |
| `lib/typert.host.js` | Host-side Typert manifest |
| `cordis.patch.yml` | Bundle declaration: plugin row and default config |
| `locale/*.json` | Localized plugin metadata (title / description) |
| `test/*.mjs` | Unit tests and client smoke tests |

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

- The notes panel expands in place inside the right sidebar; it is not a standalone floating window.
  The sidebar's own float/split buttons can drag the whole tab out;
- Different chats in the same project share the on-disk `.dsh-notes/` directory, but the list filters
  by `sessionId`, so chat notes stay private unless made global;
- If the session working directory is not writable (read-only mount, permissions), writes fail with
  an error; when the working directory is missing or the session header cannot be read, chat notes
  fall back to the global directory instead of being lost;
- Capture relies on the host's `sessionPersistence`; a very new chat that has not been flushed may not
  expose the reply text yet — send one message and capture again;
- "Save whole chat" joins the visible user/assistant text into one note and skips reasoning, tool
  calls, and tool output;
- Note contents are never translated when the UI language changes — existing files stay as written.

## License

[MIT](LICENSE) © 2026 tryqylz

Free to use, modify, distribute, and use commercially; keep the copyright notice and license text.
