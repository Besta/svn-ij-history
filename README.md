# SVN IJ History

Bring the powerful **IntelliJ-style SVN History** experience to Visual Studio Code. This extension provides a professional, highly integrated timeline to navigate Subversion logs with a native look and feel.

---

## ✨ Key Features

### 📅 Smart Timeline
Navigation made easy. Commits are automatically grouped into intuitive time periods like **Today**, **Yesterday**, **Last Week**, or **Older**, allowing you to scan your project history at a glance.

### 🖼️ Professional Detail Panel
A side-by-side interface that lets you inspect commit details without losing context:
- **VS Code Native UI**: A redesigned file list that perfectly matches the built-in Source Control view.
- **Rich Iconography**: Integration with `@vscode/codicons` and color-coded file extension badges for instant recognition.
- **Path Splitting**: Clearly see the filename and its parent directory in a clean, single-row layout.

### ⚡ Power User Actions
- **One-Click Diff**: Click any file to open the native VS Code diff editor and compare revisions instantly.
- **Get Version (Revert)**: Directly overwrite your local workspace file with a specific revision from history (includes a safety confirmation dialog).
- **Explorer & Editor Integration**: Right-click any file in the Explorer or any open Editor tab to jump straight to its SVN history.

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
3. Locate the **SVN History** icon in the Source Control side-bar or use the context menu on any file.

### Requirements
- **SVN CLI**: The `svn` command-line tool must be installed and available in your `PATH`.
- A valid **SVN Repository** detected in the workspace.

---

**Developed with ❤️ by AI feat Simone Bestazza**