# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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