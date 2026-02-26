// This script runs inside the VS Code Webview — it has NO access to Node.js APIs.
// All communication with the extension host happens via vscode.postMessage().
// NOTE: acquireVsCodeApi() is injected by VS Code at runtime — not a Node.js or browser API.

(function () {
    const vscode = acquireVsCodeApi();

    const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('search-input'));
    const statusBar = /** @type {HTMLElement}      */ (document.getElementById('status-bar'));
    const loadMoreContainer = /** @type {HTMLElement}   */ (document.getElementById('load-more-container'));
    const btnLoadMore = /** @type {HTMLButtonElement} */ (document.getElementById('btn-load-more'));
    const detailsPanel = /** @type {HTMLElement}      */ (document.getElementById('details-panel'));
    const resizer = /** @type {HTMLElement}      */ (document.getElementById('resizer'));

    /** @type {any[]} */
    let allCommits = [];
    /** @type {string | null} */
    let selectedRev = null;
    let isResizing = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let debounceTimer = null;

    /** @type {Record<string, string>} */
    const COLOR_MAP = {
        'js': '#f1e05a',
        'mjs': '#f1e05a',
        'ts': '#3178c6',
        'css': '#563d7c',
        'html': '#e34c26',
        'json': '#cbcb41',
        'md': '#007acc',
        'txt': '#cccccc',
        'xml': '#e34c26',
        'yml': '#cb171e',
        'yaml': '#cb171e',
        'png': '#61dafb',
        'jpg': '#61dafb',
        'svg': '#ffb13b',
        'java': '#b07219',
        'jsp': '#b07219',
        'jsx': '#61dafb',
        'vm': '#e34c26',
        'class': '#9b6a22',
        'properties': '#cbcb41',
        'py': '#3572a5',
        'go': '#00add8'
    };

    // ── Restore persisted state (survives panel hide/show) ────────────────────

    const previousState = vscode.getState();
    if (previousState) {
        allCommits = previousState.commits || [];
        selectedRev = previousState.selectedRev || null;
        searchInput.value = previousState.searchValue || '';
        if (allCommits.length > 0) { renderHistory(); }
    }

    // ── Event listeners ───────────────────────────────────────────────────────

    btnLoadMore.addEventListener('click', () => {
        btnLoadMore.textContent = 'Loading...';
        vscode.postMessage({ command: 'loadMore' });
    });

    document.getElementById('btn-close-details')?.addEventListener('click', closeDetails);
    document.getElementById('btn-clear-file')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'clearFileFilter' });
    });

    window.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement) {
            if (e.key === 'Escape') {
                e.target.blur();
                return;
            }
            if (e.key === 'Enter') {
                e.target.blur();
                return;
            }
            return; // Don't intercept typing in search box
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectAdjacentCommit(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectAdjacentCommit(-1);
        } else if (e.key === 'Escape') {
            closeDetails();
        } else if (e.key === 'Enter') {
            const selected = /** @type {HTMLElement} */ (document.querySelector('.commit-row.selected'));
            if (selected) {
                // Details are already shown by the selection logic, but we can ensure focus
                selected.focus();
            }
        }
    });

    /** @param {number} direction 1 for next, -1 for previous */
    function selectAdjacentCommit(direction) {
        const rows = Array.from(document.querySelectorAll('.commit-row'));
        if (rows.length === 0) { return; }

        let currentIndex = rows.findIndex(r => r.classList.contains('selected'));
        let nextIndex = currentIndex + direction;

        if (currentIndex === -1) {
            nextIndex = direction === 1 ? 0 : rows.length - 1;
        } else if (nextIndex < 0) {
            nextIndex = 0;
        } else if (nextIndex >= rows.length) {
            nextIndex = rows.length - 1;
        }

        const nextRow = /** @type {HTMLElement} */ (rows[nextIndex]);
        const rev = nextRow.dataset.rev;
        const commit = allCommits.find(c => c.rev === rev);

        if (commit) {
            showDetails(commit, nextRow);
            nextRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // Debounced search: avoids re-rendering on every single keystroke
    searchInput.addEventListener('input', () => {
        if (debounceTimer !== null) { clearTimeout(debounceTimer); }
        debounceTimer = setTimeout(() => {
            renderHistory();
            updateState();
        }, 150);
    });

    // Event delegation for file action links — avoids inline onclick / eval
    // Event delegation for file rows and action links
    document.getElementById('det-files')?.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);

        // Check if an action button was clicked
        const actionBtn = /** @type {HTMLElement | null} */ (target.closest('[data-command]'));
        if (actionBtn?.dataset) {
            const cmd = actionBtn.dataset.command;
            if (cmd === 'openDiff') {
                vscode.postMessage({ command: 'openDiff', path: actionBtn.dataset.path, rev: actionBtn.dataset.rev });
            } else if (cmd === 'openLocal') {
                vscode.postMessage({ command: 'openLocal', path: actionBtn.dataset.path, folder: actionBtn.dataset.folder === 'true' });
            }
            return;
        }

        // Check if the file info area was clicked -> trigger diff
        const fileInfo = /** @type {HTMLElement | null} */ (target.closest('.file-info'));
        if (fileInfo?.dataset) {
            vscode.postMessage({
                command: 'openDiff',
                path: fileInfo.dataset.path,
                rev: fileInfo.dataset.rev
            });
        }
    });

    resizer.addEventListener('mousedown', () => {
        isResizing = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', () => {
            isResizing = false;
            document.removeEventListener('mousemove', handleMouseMove);
        }, { once: true });
    });

    window.addEventListener('message', (event) => {
        const data = event.data;
        if (data.command === 'updateCommits') {
            allCommits = data.commits;
            btnLoadMore.textContent = 'Load 50 more commits...';

            // Show/hide file history banner
            const fileHeader = document.getElementById('file-header');
            const fileTitle = document.getElementById('file-history-title');
            if (fileHeader && fileTitle) {
                if (data.fileTitle) {
                    fileHeader.style.display = 'flex';
                    fileTitle.textContent = 'File: ' + data.fileTitle;
                } else {
                    fileHeader.style.display = 'none';
                }
            }

            renderHistory();
            updateState();
        } else if (data.command === 'clearSearch') {
            searchInput.value = '';
            updateState();
            renderHistory();
        } else if (data.command === 'setSearch') {
            searchInput.value = data.value;
            updateState();
            renderHistory();
        }
    });

    // ── State ─────────────────────────────────────────────────────────────────

    function updateState() {
        vscode.setState({
            commits: allCommits,
            selectedRev: selectedRev,
            searchValue: searchInput.value,
            fileTitle: document.getElementById('file-history-title')?.textContent?.replace('File: ', '') || null
        });
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    /**
     * Renders the full commit list grouped by date label.
     * Uses DOM APIs exclusively — no innerHTML with untrusted data.
     */
    function renderHistory() {
        const container = /** @type {HTMLElement} */ (document.getElementById('list-container'));
        container.innerHTML = ''; // safe: clearing, no user data involved

        const filter = searchInput.value.toLowerCase();
        const filtered = allCommits.filter((c) =>
            c.author.toLowerCase().includes(filter) ||
            c.msg.toLowerCase().includes(filter) ||
            c.rev.toString().includes(filter)
        );

        if (allCommits.length === 0) {
            statusBar.textContent = 'No commits loaded.';
        } else if (filter) {
            statusBar.textContent = `Showing ${filtered.length} of ${allCommits.length} loaded commits`;
        } else {
            statusBar.textContent = `Total loaded commits: ${allCommits.length}`;
        }

        // Group commits by their groupLabel
        /** @type {Map<string, any[]>} */
        const groups = new Map();
        filtered.forEach((c) => {
            if (!groups.has(c.groupLabel)) { groups.set(c.groupLabel, []); }
            groups.get(c.groupLabel)?.push(c);
        });

        groups.forEach((commitsInGroup, label) => {
            const details = document.createElement('details');
            details.open = true;

            const summary = document.createElement('summary');
            summary.textContent = label; // textContent — safe against XSS
            details.appendChild(summary);

            commitsInGroup.forEach((c) => details.appendChild(createCommitRow(c)));
            container.appendChild(details);
        });

        loadMoreContainer.style.display = allCommits.length > 0 ? 'flex' : 'none';
    }

    /**
     * Creates a single commit row element using DOM APIs.
     * All user-supplied strings go through textContent — never innerHTML.
     * @param {any} c
     * @returns {HTMLElement}
     */
    function createCommitRow(c) {
        const div = document.createElement('div');
        div.className = 'commit-row';
        div.dataset.rev = c.rev; // Added for selection lookup
        if (selectedRev === c.rev) { div.classList.add('selected'); }
        div.addEventListener('click', () => showDetails(c, div));

        const spanRev = makeEl('span', 'c-rev', 'r' + c.rev);
        const fileCount = c.files.length;
        const fileLabel = fileCount === 1 ? 'file' : 'files';
        const spanFiles = makeEl('span', 'c-files', `[${fileCount} ${fileLabel}]`);
        const spanUser = makeEl('span', 'c-user', c.author);
        const spanMsg = makeEl('span', 'c-msg', c.msg);
        const spanDate = makeEl('span', 'c-date', c.displayDate);

        div.append(spanRev, spanFiles, spanUser, spanMsg, spanDate);
        return div;
    }

    /**
     * Populates the details panel for a selected commit.
     * File links use data-* attributes + event delegation (no inline onclick).
     * @param {any} commit
     * @param {HTMLElement} el
     */
    function showDetails(commit, el) {
        document.querySelectorAll('.commit-row').forEach((r) => r.classList.remove('selected'));
        el.classList.add('selected');
        detailsPanel.style.display = 'flex';
        resizer.style.display = 'block';

        selectedRev = commit.rev;
        updateState();

        /** @type {HTMLElement} */ (document.getElementById('det-rev')).textContent = 'Revision ' + commit.rev;
        /** @type {HTMLElement} */ (document.getElementById('det-msg')).textContent = commit.msg;

        const filesContainer = /** @type {HTMLElement} */ (document.getElementById('det-files'));
        filesContainer.innerHTML = ''; // safe: clearing

        const title = document.createElement('strong');
        title.textContent = 'Changed Files:';
        filesContainer.appendChild(title);

        commit.files.forEach((/** @type {any} */ f) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            // Split path into filename and directory
            const lastSlashIndex = f.path.lastIndexOf('/');
            const fileName = lastSlashIndex === -1 ? f.path : f.path.substring(lastSlashIndex + 1);
            const dirPath = lastSlashIndex === -1 ? '' : f.path.substring(0, lastSlashIndex);

            // File Info Area (clickable for diff)
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.dataset.command = 'openDiff';
            fileInfo.dataset.path = f.path;
            fileInfo.dataset.rev = commit.rev;

            // File type icon (simple mapping)
            const icon = document.createElement('span');
            icon.className = 'file-icon';
            icon.innerHTML = getFileIcon(fileName);
            fileInfo.appendChild(icon);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'file-name';
            nameSpan.textContent = fileName;
            fileInfo.appendChild(nameSpan);

            if (dirPath) {
                const dirSpan = document.createElement('span');
                dirSpan.className = 'file-dir';
                dirSpan.textContent = dirPath;
                fileInfo.appendChild(dirSpan);
            }

            // Action links (hover)
            const fileActions = document.createElement('div');
            fileActions.className = 'file-actions';

            const isFile = !f.path.endsWith('/') && fileName.includes('.');

            if (isFile) {
                fileActions.append(
                    makeIconButton('Open File', 'openLocal', { path: f.path, folder: 'false' })
                );
            } else {
                fileActions.append(
                    makeIconButton('Open Folder', 'openLocal', { path: f.path, folder: 'true' })
                );
            }

            // SVN Action Tag (A, M, D)
            const actionTag = document.createElement('span');
            actionTag.className = 'action-tag ' + f.action;
            actionTag.textContent = f.action;

            fileItem.append(fileInfo, fileActions, actionTag);
            filesContainer.appendChild(fileItem);
        });
    }

    /**
     * Returns a colored text-based icons (extension) for the file.
     * @param {string} fileName 
     */
    function getFileIcon(fileName) {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const color = COLOR_MAP[ext] || '#888888';
        const displayExt = ext.substring(0, 4).toUpperCase();

        return `<span class="text-icon" style="color: ${color}">${displayExt || 'FILE'}</span>`;
    }

    /**
     * Creates an icon button for file actions.
     * @param {string} title 
     * @param {string} command 
     * @param {Record<string, string>} dataset 
     */
    function makeIconButton(title, command, dataset) {
        const btn = document.createElement('span');
        btn.className = 'icon-button';
        btn.title = title;
        Object.assign(btn.dataset, dataset, { command });

        // Use standard Codicon class
        const icon = document.createElement('i');
        icon.className = 'codicon codicon-go-to-file';
        btn.appendChild(icon);
        return btn;
    }

    function closeDetails() {
        detailsPanel.style.display = 'none';
        resizer.style.display = 'none';
        document.querySelectorAll('.commit-row').forEach((r) => r.classList.remove('selected'));
        selectedRev = null;
        updateState();
    }

    /** @param {MouseEvent} e */
    function handleMouseMove(e) {
        if (!isResizing) { return; }
        const offsetRight = document.body.offsetWidth - e.clientX;
        if (offsetRight > 150 && offsetRight < document.body.offsetWidth * 0.8) {
            detailsPanel.style.width = offsetRight + 'px';
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Creates a span with a className and textContent.
     * @param {string} tag
     * @param {string} cls
     * @param {string} text
     * @returns {HTMLElement}
     */
    function makeEl(tag, cls, text) {
        const el = document.createElement(tag);
        el.className = cls;
        el.textContent = text;
        return el;
    }

    /**
     * Creates a clickable link whose action is stored in data-* attributes.
     * Avoids inline onclick handlers that would require 'unsafe-inline' in the CSP.
     * @param {string} label
     * @param {Record<string, string>} dataset
     * @returns {HTMLElement}
     */
    function makeLink(label, dataset) {
        const span = document.createElement('span');
        span.className = 'text-link';
        span.textContent = label;
        Object.assign(span.dataset, dataset);
        return span;
    }
}());
