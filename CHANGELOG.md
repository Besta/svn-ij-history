# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-02-27

### Changed
- **Architectural Modernization (Phase 1 & 2)**:
  - **Robust XML Parsing**: Integrated `fast-xml-parser` for reliable SVN log processing, replacing fragile regex-based parsing.
  - **Repository Pattern**: Introduced `SvnRepository` to centralize state management (commits, filters, pagination).
  - **Dependency Injection**: Implemented a central `SvnContext` to manage service lifecycles and decoupling.
  - **Command Pattern**: Extracted UI actions into dedicated command modules (`HistoryCommands`, `FileCommands`, `AnnotateCommands`).
  - **Simplified Entry Point**: Refactored `extension.ts` to reduce complexity and improve maintainability.
  - **Centralized Path Logic**: Created `PathUtils` to handle consistent SVN-to-FS path conversions and prefix cleaning.

## [1.2.0] - 2026-02-27

### Added
- **Native UI Migration**: Replaced all Webview-based components (History and Details) with native VS Code `TreeView` for a faster and more integrated experience.
- **Commit Details Refinement**:
  - Consolidated revision and message into a single header line.
  - Redesigned changed files list with native icons and secondary path display.
  - OS-specific path normalization for all displays.
- **Clipboard Power Actions**: New right-click context menu options to copy:
  - **Revision Number** (from history or details).
  - **Path Relative** and **Path Absolute** (auto-normalized per OS).
  - **File Name**.
- **Enhanced SVN Annotate**:
  - Renamed "Blame" to **"Annotate"** across the entire extension.
  - Added "Annotate" to the editor gutter context menu (line number area).
  - Dynamic menu labels: "Show Annotations" / "Hide Annotations" based on active status.
- **UI/UX Polishing**:
  - One-click interaction to view commit details or load more logs.
  - Double-click/Click-to-open logic for comparing files (Diff).
  - Added file count to commit items in the history list.

### Fixed
- **Gutter Annotate Command**: Resolved an issue where triggering Annotate from the gutter context menu wouldn't correctly identify the target file.

## [1.1.0] - 2026-02-26

### Added
- **SVN Blame (Annotate)**: Added professional IntelliJ-style inline annotations.
  - **Author Coloring**: Automatic HSL coloring based on author name for quick visual scanning.
  - **Interactive Links**: Click on an annotation to instantly view commit details in the history panel.
  - **Per-file Scoping**: Annotations are toggled per file and don't interfere with other open editors.
  - **External Fetching**: View details even for old commits not currently loaded in the history list.

## [1.0.5] - 2026-02-26

### Added
- **UI Redesign**: Redesigned the changed files list in the details panel to match VS Code's Source Control view with a single-row layout and path splitting.
- **Improved Iconography**: Integrated `@vscode/codicons` for professional action icons and implemented color-mapped text badges for file extensions.
- **File Tab History**: Added "Show SVN History" to the editor tab context menu.
- **File Count**: The commit list now shows the number of modified files for each revision (e.g., `[5 files]`).
- **Get version**: Added a "Get this version" action to overwrite the local file with a specific revision from history, including a safety confirmation dialog.

### Changed
- **Time Format**: Commit times are now always displayed in 24-hour format (e.g., 15:30) for improved readability and consistency.

## [1.0.4] - 2026-02-26

### Added
- **File History**: Added "Show SVN History" command to explorer and editor context menus. Allows viewing commits for a specific file with a dedicated filter banner in the webview.
- **Keyboard Navigation**: Full keyboard support in the webview. Use `Up`/`Down` arrows to navigate commits, `Enter` to select/focus, and `Esc` to close details or blur search. Includes smooth auto-scrolling.

### Security
- **XSS Prevention**: All commit data (author, message, file paths) is now injected into the webview via `textContent` and `dataset` attributes instead of `innerHTML`, eliminating cross-site scripting vectors.
- **Content Security Policy**: Added a per-load CSP `<meta>` tag with a cryptographic nonce, blocking any unauthorized script execution in the webview.
- **Shell Injection Prevention**: Replaced `child_process.exec()` (string interpolation) with `execFile()` (argument array) for all SVN CLI calls, eliminating shell injection risk.
- **Inline onclick Removal**: File action links now use `data-*` attributes with a single delegated event listener, removing the last XSS-injectable surface.

### Changed
- **Webview Architecture**: Extracted the 370-line HTML/CSS/JS template literal from `SvnHistoryViewProvider.ts` into three dedicated files under `media/` (`webview.html`, `webview.css`, `webview.js`). The provider now reads and serves these files at runtime, reducing its webpack bundle size by ~73% (38.5 KiB → 10.1 KiB).
- **SVN XML Parser**: Switched from `split('</logentry>')` to a `/<logentry...>...<\/logentry>/g` regex, preventing parse failures caused by commit messages containing that literal string.
- **Repository Root Caching**: `getRepoRoot()` now caches its result, avoiding a redundant SVN CLI invocation on every diff open.

### Fixed
- **Temp File Leak**: Diff temp files written to `os.tmpdir()` are now tracked and deleted when the webview panel is closed or the extension is deactivated.
- **Search Debounce**: Added a 150 ms debounce to the search input, preventing unnecessary re-renders on every keystroke.
- **isFile Detection**: Path-to-file detection now also checks for a trailing `/` to avoid misclassifying dot-named directories (e.g. `.github`) as files.

### Removed
- **Dead code**: Removed unused `getAllAuthors()` method from `SvnService`.

---

## [1.0.3] - 2026-02-26

### Fixed
- **Search Bar Reliability**: Replaced the `vscode-text-field` webview component with a native HTML input styled for VS Code. This resolves an issue where the search bar was not visible when the extension was installed from the Marketplace due to toolkit loading dependencies.
- **UI Layout Stability**: Added CSS constraints to the search container to prevent it from being hidden or collapsed when the commit list contains many entries.

---

## [1.0.2] - 2026-02-26

### Added
- **User Filtering**: Added a new "Filter by User" button in the view title bar using the `$(account)` icon.
- **Author Autocomplete**: Integrated with VS Code's native QuickPick to show unique authors from the last 200 commits for quick search pre-filling.
- **Localization**: Fully translated the user interface, logs, and documentation to English for global availability.
- **Code Quality**: Implemented JSDoc documentation across all main classes (`SvnService`, `SvnHistoryViewProvider`, `DateUtils`, `extension`) to improve maintainability.

### Changed
- **Project Metadata**: Optimized `package.json` with relevant keywords and refined categories for better visibility on the VS Code Marketplace.

---

## [1.0.1] - 2026-02-26

### Fixed
- **Compatibility**: Aligned development dependencies (`@types/vscode`) with VS Code engine requirements.
- **Build Process**: Resolved `ETARGET` errors during npm installation by correcting package references.

---

## [1.0.0] - 2026-02-26

### 🚀 Initial Release
- **Timeline Interface**: Smart commit visualization grouped by time periods (Today, Yesterday, Last Week, etc.).
- **Side-by-Side Detail Panel**: Resizable area to inspect commit details and changed files simultaneously.
- **Native Diff Integration**: Compare file revisions using the built-in VS Code diff editor.
- **Workspace Navigation**: Quick access to local files and folders directly from SVN commits.
- **State Persistence**: Remembers search filters and selection state across view changes.