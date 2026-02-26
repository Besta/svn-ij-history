# SVN IJ History

Bring the powerful **IntelliJ-style SVN History** experience to Visual Studio Code. This extension provides a dedicated side-bar view to navigate Subversion logs with a professional timeline and a side-by-side detail panel.



## Features

* **Smart Timeline**: Commits are automatically grouped by date (Today, Yesterday, Last Week, etc.).
* **Side-by-Side Details**: Inspect commit messages and changed files in a resizable side panel without losing your scroll position.
* **Integrated Diff**: Open the native VS Code diff editor with a single click to compare revisions.
* **Local File Navigation**: Jump directly from a commit to the file in your local workspace.
* **Fast Search**: Filter through hundreds of commits by author, message, or revision number in real-time.
* **Performance First**: Uses incremental loading (50 commits at a time) to handle large repositories smoothly.

## Requirements

* **SVN CLI**: You must have the `svn` command-line tool installed and available in your system PATH.
* **SVN Workspace**: The extension activates when it detects a valid SVN checkout in your open workspace.

## Extension Settings

This extension contributes the following settings:

* `svn-ij-history.view`: Provides the custom history view in the Source Control or Explorer side bar.

## Known Issues

* Initial load might take a few seconds on very large remote repositories over slow connections.

---

**Developed by Simone Bestazza**