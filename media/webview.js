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

    // Debounced search: avoids re-rendering on every single keystroke
    searchInput.addEventListener('input', () => {
        if (debounceTimer !== null) { clearTimeout(debounceTimer); }
        debounceTimer = setTimeout(() => {
            renderHistory();
            updateState();
        }, 150);
    });

    // Event delegation for file action links — avoids inline onclick / eval
    document.getElementById('det-files')?.addEventListener('click', (e) => {
        const link = /** @type {HTMLElement | null} */ (
            /** @type {HTMLElement} */ (e.target).closest('[data-command]')
        );
        if (!link?.dataset) { return; }
        const cmd = link.dataset.command;
        if (cmd === 'openDiff') {
            vscode.postMessage({ command: 'openDiff', path: link.dataset.path, rev: link.dataset.rev });
        } else if (cmd === 'openLocal') {
            vscode.postMessage({ command: 'openLocal', path: link.dataset.path, folder: link.dataset.folder === 'true' });
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
            searchValue: searchInput.value
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
        if (selectedRev === c.rev) { div.classList.add('selected'); }
        div.addEventListener('click', () => showDetails(c, div));

        const spanRev = makeEl('span', 'c-rev', 'r' + c.rev);
        const spanUser = makeEl('span', 'c-user', c.author);
        const spanMsg = makeEl('span', 'c-msg', c.msg);
        const spanDate = makeEl('span', 'c-date', c.displayDate);

        div.append(spanRev, spanUser, spanMsg, spanDate);
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

            // File path with action badge
            const filePath = document.createElement('span');
            filePath.className = 'file-path';
            const actionTag = document.createElement('span');
            // f.action is always A/M/D/R from SVN — safe for className
            actionTag.className = 'action-tag ' + f.action;
            actionTag.textContent = f.action;
            filePath.appendChild(actionTag);
            filePath.appendChild(document.createTextNode(f.path));

            // Action links via dataset — handled by the delegation listener above
            const fileLinks = document.createElement('div');
            fileLinks.className = 'file-links';

            // Distinguish file vs directory: files have a dot in the basename
            // and don't end with a trailing slash.
            const baseName = f.path.split('/').pop() || '';
            const isFile = !f.path.endsWith('/') && baseName.includes('.');

            if (isFile) {
                fileLinks.append(
                    makeLink('Diff', { command: 'openDiff', path: f.path, rev: commit.rev }),
                    makeLink('Open File', { command: 'openLocal', path: f.path, folder: 'false' })
                );
            } else {
                fileLinks.append(
                    makeLink('Open Folder', { command: 'openLocal', path: f.path, folder: 'true' })
                );
            }

            fileItem.append(filePath, fileLinks);
            filesContainer.appendChild(fileItem);
        });
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
