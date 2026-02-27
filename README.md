# SVN IJ History

Bring the powerful **IntelliJ-style SVN History** experience to Visual Studio Code. This extension provides a professional, highly integrated timeline to navigate Subversion logs with a native look and feel.

---

## ✨ Key Features

### 📅 Smart Timeline
Commits are automatically grouped into intuitive time periods like **Today**, **Yesterday**, **Last Week**, or **Older**, with real-time counters showing exactly how many commits are in each group.

### 🎨 Professional Annotations (Annotate)
Get instant context on every line of code without leaving the editor.
- **IntelliJ-style Gutter**: Author names and revisions are displayed on the left side, with automatic author-based coloring.
- **Interactions**: Click any annotation to jump straight to its details in the history panel.
- **Gutter Context Menu**: Right-click the line number area to quickly toggle **Show/Hide Annotations**.

### 🖼️ Full Native Integration
Experience a seamless, high-performance UI built entirely on VS Code native components:
- **Native TreeViews**: Both the History and Details panels use native TreeViews for lightning-fast scanning and perfect theme integration.
- **Rich Iconography**: Integration with `@vscode/codicons` for file types and git-like actions (A/M/D).
- **Clipboard Power Actions**: Right-click any file or commit to copy **Revision Number**, **Filenames**, or **Normalized Paths** (Absolute or Relative).

### ⚡ Power User Actions
- **Single-Click Workflow**: Simply click a commit to view its details or load more logs instantly.
- **Quick Diff**: Double-click any file in the details list to open the native VS Code diff editor and compare revisions.
- **Get Version (Revert)**: Overwrite your local workspace file with a specific revision from history (includes a safety confirmation dialog).
- **Explorer & Editor Integration**: Right-click any file in the Explorer or Editor tab to view its SVN history.

### 🔍 Search & Filtering
- **Real-time Filter**: Search through hundreds of commits by **Author**, **Message**, or **Revision number**.
- **User Filtering**: Quickly filter history to show only commits from specific project contributors.
- **Fast Performance**: Uses incremental loading (50 commits per batch) to keep the UI snappy even in massive repositories.

### ⌨️ Keyboard Mastery
Stay in the flow with full keyboard support:
- Use **Up/Down** arrows to navigate the log.
- **Enter** to focus on details.
- **Escape** to quickly close the panel or clear filters.

---

## 🔒 Security & Performance
- **Built for Scale**: Repository root caching and debounced searching ensure minimal system impact.
- **Shell Injection Proof**: All SVN commands are executed via safe argument arrays, never raw strings.
- **XSS Prevention**: Strict Content Security Policy (CSP) and DOM-safe rendering (no `innerHTML` for data).
- **Cleanup**: Transparently tracks and removes temporary diff files from your system.

---

## 🚀 Getting Started

1. **Install** the extension from the VS Code Marketplace.
2. Open a workspace that contains an **SVN checkout**.
- ⚡ **Instant Diff**: Fast, native-feeling diff view for any revision.
- 🎨 **SVN Blame (Annotate)**: Professional inline annotations with author-based coloring and interactive links to commit details.
- 📂 **File History**: Deep dive into the history of a specific file directly from the context menu.
3. Locate the **SVN History** icon in the Source Control side-bar or use the context menu on any file.

### Requirements
- **SVN CLI**: The `svn` command-line tool must be installed and available in your `PATH`.
- A valid **SVN Repository** detected in the workspace.

---

**Developed with ❤️ by AI feat Simone Bestazza**