# SVN IJ History

Bring the powerful **IntelliJ-style SVN History** experience to Visual Studio Code. This extension provides a professional, highly integrated timeline to navigate Subversion logs with a native look and feel.

---

## ✨ Key Features

### 📅 Smart Timeline
Commits are automatically grouped into intuitive time periods like **Today**, **Yesterday**, **Last Week**, or **Older**, with real-time counters showing exactly how many commits are in each group.

### 🎨 Native File Coloring
Instantly identify your SVN changes in the **Explorer** and **Editor Tabs**.
- **Themed Colors**: Automatically matches your active VS Code theme using standard `gitDecoration` variables.
- **Active vs. Inactive**: Smartly distinguishes between files in the active changelist and those in other/specific changelists.

### 🎨 Professional Annotations (Annotate)
Get instant context on every line of code without leaving the editor.
- **IntelliJ-style Gutter**: Author names and revisions are displayed on the left side, with automatic author-based coloring.
- **Interactions**: Click any annotation to jump straight to its details in the history panel.
- **Gutter Context Menu**: Right-click the line number area to quickly toggle **Show/Hide Annotations**.

### 🖼️ Full Native Integration
Experience a seamless, high-performance UI built entirely on VS Code native components:
- **Native TreeViews**: Both the History and Details panels use native TreeViews for lightning-fast scanning and perfect theme integration.
- **Rich Iconography**: Integration with `@vscode/codicons` for file types and git-like actions (A/M/D).
- **Clipboard Power Actions**: Right-click any file or commit to copy **Revision Number**, **Commit Message**, **Filenames**, or **Normalized Paths** (Absolute or Relative).
- **Smart Commit Display**: Long commit messages or multi-line messages are automatically chunked and beautifully rendered as collapsible items in the details tree.

### ⚡ Power User Actions
- **Single-Click Workflow**: Simply click a commit to view its details or load more logs instantly.
- **Quick Diff**: Double-click any file in the details list to open the native VS Code diff editor and compare it with its previous version.
- **Compare with Local/Clipboard**: Right-click any file to compare its SVN state directly with your current local checkout or clipboard contents.
- **Get Version (Revert)**: Overwrite your local workspace file with a specific revision from history (includes a safety confirmation dialog).
- **Apply Patch**: Apply local `.patch` or `.diff` files directly to your SVN workspace using the new button in the Source Control panel.
- **Explorer & Editor Integration**: Right-click any file in the Explorer or Editor tab to view its SVN history.
- **Interactive Checkout**: Use the Command Palette to navigate subdirectories of a remote SVN repository, quickly access past URLs, and checkout directly into your workspace.

### 💡 Smart Assistance
- **Dependency Detection**: Automatically detects changes to `package.json` dependencies and prompts you to quickly run `npm install` directly from a status notification.

### 🔍 Search & Filtering
- **Real-time Filter**: Search through hundreds of commits by **Author**, **Message**, or **Revision number**.
- **User Filtering**: Quickly filter history to show only commits from specific project contributors.
- **Go to Revision**: Prompt-based jumping to a specific SVN revision by typing its number.
- **Fast Performance**: Uses incremental loading to keep the UI snappy even in massive repositories.

### ⚙️ Full Customizability
Tailor the extension to your exact needs via VS Code settings (`svn-ij-history.*`):
- `defaultLimit`: Adjust initial commit fetch count (default 200).
- `dateFormat`: Control the date format displayed in the history tree.
- `annotateColorScheme`: Choose between 'blue', 'rainbow', or 'heatmap' for SVN annotate decorations.
- `autoRefreshOnSave`: Toggle auto-refresh behavior when saving files.

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