<p align="center">
  <img src="https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/icon.svg" width="88" height="88" alt="Jingjing Sticky Notes icon">
</p>

<h1 align="center">Jingjing Sticky Notes · dsh-jingjing-sticky-notes</h1>

<p align="center">
  <b>Pin what matters from a conversation as Markdown notes, ready when you need them.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-jingjing-sticky-notes"><img src="https://img.shields.io/npm/v/dsh-jingjing-sticky-notes.svg" alt="npm version"></a>
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes"><img src="https://img.shields.io/github/stars/tryqylz/dsh-jingjing-sticky-notes?style=social" alt="GitHub stars"></a>
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DSH-0.2.x-4D6BFE.svg" alt="DeepSeek Harness 0.2.x"></a>
</p>

<p align="center">
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes">GitHub</a> ·
  <a href="https://www.npmjs.com/package/dsh-jingjing-sticky-notes">npm</a> ·
  <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes/issues">Issues</a> ·
  English · <a href="https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/README.md">简体中文</a>
</p>

> **Code credit**: most of the code in this plugin was written by `deepseek-flash-v4.1-1017` (Jingjing).

---

Sticky Notes turns important replies, arbitrary text selections, or an entire conversation in
DeepSeek Harness into local Markdown notes. Notes live in the right sidebar, where you can reopen,
compare, rename, and insert them back into the composer — whole or by selection. Each note can also
open as a draggable, resizable in-app floating window, so several notes can be compared at once.

When a long conversation makes you scroll back for that table, checklist, or conclusion again and
again, this panel is your scratch pad.

## Installation

Requires DeepSeek Harness 0.2.x (desktop and Web; developed against `0.2.1-rc.2`). No extra runtime dependencies.

```sh
# desktop
dsh plugin --profile desktop add dsh-jingjing-sticky-notes

# Web (dsh web)
dsh plugin --profile web add dsh-jingjing-sticky-notes
```

Or use **Plugins → Add plugin** in the app and enter the package name `dsh-jingjing-sticky-notes`.

You can also install the same code from GitHub (for example to follow the latest commit, or when npm is unavailable):

```sh
dsh plugin --profile desktop add "git+https://github.com/tryqylz/dsh-jingjing-sticky-notes.git#main"
```

See [technical details](https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/docs/technical.en.md) for the local development setup, storage layout and configuration.

## Preview

![Animation: save a sticky note, browse the sidebar, compare notes in floating windows, and insert them back into the conversation](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/demo.gif)

*Save as a note → browse in the sidebar → compare in floating windows → insert back into the conversation.*

### Notes list beside the conversation

![Chat with the sticky notes list in the right sidebar](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/notes-panel.png)

*Conversation on the left, notes panel on the right: Workspace / Session / Global views, with favorite, float, insert, visibility and delete actions on every card.*

### Note detail

![Note detail with the insert action bar](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/note-detail.png)

*Edit the title and body, then use the action bar to insert the whole note or a selection, insert it as a file, copy it, switch its scope, or move it to the recycle bin.*

### Floating notes

![Two floating sticky notes above the conversation](https://raw.githubusercontent.com/tryqylz/dsh-jingjing-sticky-notes/main/docs/images/floating-notes.png)

*Open several floating notes to compare long content; they can be dragged, resized, and docked back into the sidebar.*

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

### Math (new)
- Standard LaTeX in a note body is typeset instead of shown verbatim: inline `$…$`, `\(…\)` and
  display `$$…$$`, `\[…\]`, including matrices, cases and `aligned`; dollar signs inside code spans
  and fenced code stay literal, and amounts such as `$5-$10` are not mistaken for formulas;
- An unclosed `$$` only affects its own line instead of swallowing the body that follows; a `$$…$$`
  glued to surrounding text still gets its own block; a single formula longer than 2000 characters is
  shown verbatim so a huge expression cannot stall the panel;
- The KaTeX runtime (`katex.min.js`) is inlined into `client.js`, while the layout styles and fonts
  come from the same copy the DSH host page already loads globally, so math renders offline and in
  both themes;
- The trade-off is about +270 KB on `client.js` (~140 KB → ~410 KB). The plugin still has zero runtime
  dependencies; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

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

## More documentation

- [Technical details](https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/docs/technical.en.md): storage layout, file format, configuration, development, compatibility and known limits

## Feedback

- Bugs and feature requests: <https://github.com/tryqylz/dsh-jingjing-sticky-notes/issues>
- If this plugin helps you, a Star is appreciated ⭐

## License

[MIT](https://github.com/tryqylz/dsh-jingjing-sticky-notes/blob/main/LICENSE) © 2026 tryqylz

Free to use, modify, distribute, and use commercially; keep the copyright notice and license text.
