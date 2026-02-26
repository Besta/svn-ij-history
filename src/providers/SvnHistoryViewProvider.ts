import * as vscode from 'vscode';
import { SvnService, SvnCommit } from '../utils/SvnService';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Provider for the SVN History Webview View.
 * Handles SVN data fetching, webview messaging, and local file interactions.
 */
export class SvnHistoryViewProvider implements vscode.WebviewViewProvider {
    /** Unique identifier for the view as defined in package.json */
    public static readonly viewType = 'svn-ij-history.view';
    
    private _view?: vscode.WebviewView;
    private _svnService: SvnService;
    private _currentLimit = 50;
    private _lastCommits: SvnCommit[] = [];

    /**
     * @param _extensionUri The URI of the directory containing the extension.
     * @param workspaceRoot The absolute path to the current workspace root.
     */
    constructor(
        private readonly _extensionUri: vscode.Uri,
        workspaceRoot: string
    ) {
        this._svnService = new SvnService(workspaceRoot);
    }

    /**
     * Resets the view to the initial state and reloads the history.
     */
    public async refresh() {
        this._currentLimit = 50;
        this._view?.webview.postMessage({ command: 'clearSearch' });
        await this.loadHistory();
    }

    /**
     * Fetches unique authors from a specific number of recent commits.
     * @param limit The number of recent commits to analyze for authors.
     * @returns A sorted array of unique author names.
     */
    public async fetchRecentAuthors(limit: number): Promise<string[]> {
        try {
            const recentCommits = await this._svnService.getHistory(limit);
            const authors = new Set(recentCommits.map(c => c.author));
            return Array.from(authors).sort();
        } catch (err) {
            return [];
        }
    }

    /**
     * Sends a message to the webview to set the search input value.
     * @param value The string to set in the search bar.
     */
    public setSearchValue(value: string) {
        this._view?.webview.postMessage({ command: 'setSearch', value });
    }

    /**
     * Generates a diff between the selected revision and its predecessor.
     * @param repoPath Relative path of the file in the repository.
     * @param rev The revision number to compare.
     */
    private async showDiff(repoPath: string, rev: string) {
        const prevRev = (parseInt(rev) - 1).toString();
        const fileName = repoPath.split('/').pop() || "file";
        try {
            const rootUrl = await this._svnService.getRepoRoot();
            const fullUrl = `${rootUrl}${repoPath}`;

            const [currContent, prevContent] = await Promise.all([
                this._svnService.getFileContent(fullUrl, rev),
                this._svnService.getFileContent(fullUrl, prevRev).catch(() => "")
            ]);

            const tmpDir = os.tmpdir();
            const pathPrev = path.join(tmpDir, `prev_${rev}_${fileName}`);
            const pathCurr = path.join(tmpDir, `curr_${rev}_${fileName}`);

            fs.writeFileSync(pathPrev, prevContent);
            fs.writeFileSync(pathCurr, currContent);

            await vscode.commands.executeCommand('vscode.diff',
                vscode.Uri.file(pathPrev),
                vscode.Uri.file(pathCurr),
                `${fileName} (r${prevRev} ↔ r${rev})`
            );
        } catch (err: any) {
            vscode.window.showErrorMessage("Diff Error: " + err.message);
        }
    }

    /**
     * Attempts to open the file or folder in the local workspace.
     * @param repoPath Relative path from the SVN repository.
     * @param isFolderRequested Whether to reveal in explorer instead of opening a document.
     */
    private async openLocalFile(repoPath: string, isFolderRequested: boolean = false) {
        const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
        if (!workspacePath) return;

        const cleanRelPath = repoPath.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
        const absolutePath = path.join(workspacePath, cleanRelPath);

        if (fs.existsSync(absolutePath)) {
            const uri = vscode.Uri.file(absolutePath);
            if (isFolderRequested) {
                await vscode.commands.executeCommand('revealInExplorer', uri);
            } else {
                await vscode.window.showTextDocument(uri);
            }
        } else {
            const targetName = repoPath.split('/').pop();
            if (!targetName) return;
            const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);

            if (files.length > 0) {
                if (isFolderRequested) {
                    await vscode.commands.executeCommand('revealInExplorer', files[0]);
                } else {
                    await vscode.window.showTextDocument(files[0]);
                }
            } else {
                vscode.window.showErrorMessage("Could not find the file in the local workspace.");
            }
        }
    }

    /**
     * VS Code entry point for initializing the Webview.
     * @param webviewView The webview view instance to resolve.
     */
    public resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.command) {
                case 'refresh':
                    await this.refresh();
                    break;
                case 'loadMore':
                    this._currentLimit += 50;
                    await this.loadHistory();
                    break;
                case 'openDiff':
                    await this.showDiff(data.path, data.rev);
                    break;
                case 'openLocal':
                    await this.openLocalFile(data.path, data.folder === true);
                    break;
            }
        });

        this.loadHistory();
    }

    /**
     * Fetches SVN logs and pushes them to the Webview.
     */
    private async loadHistory() {
        if (!this._view) return;
        try {
            this._lastCommits = await this._svnService.getHistory(this._currentLimit);
            this._view.webview.postMessage({ command: 'updateCommits', commits: this._lastCommits });
        } catch (err: any) {
            vscode.window.showErrorMessage("SVN Error: " + err.message);
        }
    }

    /**
     * Generates the HTML content for the Webview.
     * @param webview The webview instance.
     * @returns Full HTML string.
     */
    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh; font-family: var(--vscode-font-family); color: var(--vscode-foreground); overflow: hidden; background-color: var(--vscode-sideBar-background); }
            
            /* Search Container with absolute visibility */
            #search-bar-container { 
                padding: 10px 12px 6px 12px; 
                flex-shrink: 0; 
                background: var(--vscode-sideBar-background);
                z-index: 100;
            }

            .native-input {
                width: 100%;
                box-sizing: border-box;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                padding: 5px 8px;
                outline: none;
                font-family: inherit;
                font-size: 13px;
            }

            .native-input:focus {
                border: 1px solid var(--vscode-focusBorder);
            }

            #status-bar { padding: 0 12px 8px 12px; font-size: 0.75em; opacity: 0.7; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); flex-shrink: 0; }
            #main-content { display: flex; flex: 1; overflow: hidden; position: relative; width: 100%; }
            #commit-list { flex: 1; min-width: 0; overflow-y: auto; background: var(--vscode-sideBar-background); display: flex; flex-direction: column; }
            #list-container { flex: 1; }
            #resizer { width: 5px; cursor: col-resize; background: var(--vscode-panel-border); display: none; z-index: 100; flex-shrink: 0; }
            #resizer:hover { background: var(--vscode-focusBorder); }
            #details-panel { width: 50%; min-width: 200px; display: none; flex-direction: column; background: var(--vscode-editor-background); flex-shrink: 0; border-left: 1px solid var(--vscode-panel-border); }
            #details-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-panel-sectionHeader-background); }
            
            summary { padding: 8px 12px; cursor: pointer; font-weight: bold; font-size: 0.85em; background-color: var(--vscode-sideBarSectionHeader-background); position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--vscode-panel-border); outline: none; user-select: none; }
            summary:hover { filter: brightness(1.1); }

            .commit-row { display: flex; align-items: center; padding: 4px 12px; gap: 12px; cursor: pointer; border-bottom: 1px solid var(--vscode-panel-border); font-size: 0.85em; white-space: nowrap; overflow: hidden; }
            .commit-row:hover { background: var(--vscode-list-hoverBackground); }
            .commit-row.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
            
            .c-rev { color: var(--vscode-textLink-foreground); font-family: var(--vscode-editor-font-family); width: 60px; flex-shrink: 0; }
            .c-user { font-weight: bold; width: 100px; flex-shrink: 0; text-overflow: ellipsis; overflow: hidden; }
            .c-msg { flex: 1; overflow: hidden; text-overflow: ellipsis; }
            .c-date { opacity: 0.5; width: 110px; text-align: right; flex-shrink: 0; }

            .file-item { padding: 6px 12px; border-bottom: 1px solid var(--vscode-panel-border); font-size: 0.85em; }
            .file-path { display: block; margin-bottom: 4px; font-family: var(--vscode-editor-font-family); word-break: break-all; white-space: normal; }
            .file-links { display: flex; gap: 12px; font-size: 0.9em; }
            .text-link { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: none; }
            .text-link:hover { text-decoration: underline; }
            .action-tag { font-weight: bold; margin-right: 6px; }
            .A { color: #73c991; } .M { color: #e2c08d; } .D { color: #f85149; }
            
            .close-btn { cursor: pointer; opacity: 0.7; font-size: 1.2em; }
            .close-btn:hover { opacity: 1; }

            #load-more-container { padding: 15px; display: none; justify-content: center; }
            .load-more-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; cursor: pointer; font-size: 0.9em; border-radius: 2px; width: 100%; }
            .load-more-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
        </style>
    </head>
    <body>
        <div id="search-bar-container">
            <input type="text" id="search-input" class="native-input" placeholder="Filter by message, author, or revision...">
        </div>
        <div id="status-bar">
            Loading history...
        </div>
        
        <div id="main-content">
            <div id="commit-list">
                <div id="list-container"></div>
                <div id="load-more-container">
                    <button id="btn-load-more" class="load-more-btn">Load 50 more commits...</button>
                </div>
            </div>
            <div id="resizer"></div>
            <div id="details-panel">
                <div id="details-header">
                    <span style="font-weight:bold">Details</span>
                    <span class="close-btn" onclick="closeDetails()">×</span>
                </div>
                <div id="detail-body" style="padding:12px; overflow-y:auto; flex:1">
                    <h3 id="det-rev" style="margin:0 0 8px 0"></h3>
                    <div id="det-msg" style="background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; font-size:0.9em; margin-bottom:12px"></div>
                    <div id="det-files"></div>
                </div>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const searchInput = document.getElementById('search-input');
            const statusBar = document.getElementById('status-bar');
            const loadMoreContainer = document.getElementById('load-more-container');
            const btnLoadMore = document.getElementById('btn-load-more');
            const detailsPanel = document.getElementById('details-panel');
            const resizer = document.getElementById('resizer');
            
            let allCommits = [];
            let selectedRev = null;
            let isResizing = false;

            const previousState = vscode.getState();
            if (previousState) {
                allCommits = previousState.commits || [];
                selectedRev = previousState.selectedRev || null;
                searchInput.value = previousState.searchValue || '';
                if (allCommits.length > 0) renderHistory();
            }

            btnLoadMore.onclick = () => {
                btnLoadMore.innerText = 'Loading...';
                vscode.postMessage({ command: 'loadMore' });
            };

            window.addEventListener('message', event => {
                const data = event.data;
                if (data.command === 'updateCommits') {
                    allCommits = data.commits;
                    btnLoadMore.innerText = 'Load 50 more commits...';
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

            function updateState() {
                vscode.setState({ 
                    commits: allCommits, 
                    selectedRev: selectedRev,
                    searchValue: searchInput.value 
                });
            }

            function renderHistory() {
                const container = document.getElementById('list-container');
                container.innerHTML = '';
                
                const filter = searchInput.value.toLowerCase();
                const filtered = allCommits.filter(c => 
                    c.author.toLowerCase().includes(filter) || 
                    c.msg.toLowerCase().includes(filter) ||
                    c.rev.toString().includes(filter)
                );

                if (allCommits.length === 0) {
                    statusBar.innerText = "No commits loaded.";
                } else if (filter) {
                    statusBar.innerText = \`Showing \${filtered.length} of \${allCommits.length} loaded commits\`;
                } else {
                    statusBar.innerText = \`Total loaded commits: \${allCommits.length}\`;
                }

                const groups = new Map();
                filtered.forEach(c => {
                    if (!groups.has(c.groupLabel)) groups.set(c.groupLabel, []);
                    groups.get(c.groupLabel).push(c);
                });

                groups.forEach((commitsInGroup, label) => {
                    const details = document.createElement('details');
                    details.open = true;
                    details.innerHTML = \`<summary>\${label}</summary>\`;
                    
                    commitsInGroup.forEach(c => {
                        const div = document.createElement('div');
                        div.className = 'commit-row';
                        if (selectedRev === c.rev) div.classList.add('selected');
                        div.onclick = () => showDetails(c, div);
                        div.innerHTML = \`
                            <span class="c-rev">r\${c.rev}</span>
                            <span class="c-user">\${c.author}</span>
                            <span class="c-msg">\${c.msg}</span>
                            <span class="c-date">\${c.displayDate}</span>
                        \`;
                        details.appendChild(div);
                    });
                    container.appendChild(details);
                });

                loadMoreContainer.style.display = allCommits.length > 0 ? 'flex' : 'none';
            }

            function showDetails(commit, el, isRestoring = false) {
                document.querySelectorAll('.commit-row').forEach(r => r.classList.remove('selected'));
                el.classList.add('selected');
                detailsPanel.style.display = 'flex';
                resizer.style.display = 'block';

                selectedRev = commit.rev;
                if (!isRestoring) updateState();

                document.getElementById('det-rev').innerText = 'Revision ' + commit.rev;
                document.getElementById('det-msg').innerText = commit.msg;

                const filesHtml = commit.files.map(f => {
                    const fileName = f.path.split('/').pop() || "";
                    const isFile = fileName.includes('.');
                    return \`
                    <div class="file-item">
                        <span class="file-path"><span class="action-tag \${f.action}">\${f.action}</span>\${f.path}</span>
                        <div class="file-links">
                            \${isFile ? \`
                                <span class="text-link" onclick="vscode.postMessage({command:'openDiff', path:'\${f.path}', rev:'\${commit.rev}'})">Diff</span>
                                <span class="text-link" onclick="vscode.postMessage({command:'openLocal', path:'\${f.path}', folder:false})">Open File</span>
                            \` : \`
                                <span class="text-link" onclick="vscode.postMessage({command:'openLocal', path:'\${f.path}', folder:true})">Open Folder</span>
                            \`}
                        </div>
                    </div>\`;
                }).join('');
                document.getElementById('det-files').innerHTML = '<strong>Changed Files:</strong>' + filesHtml;
            }

            window.closeDetails = function() {
                detailsPanel.style.display = 'none';
                resizer.style.display = 'none';
                document.querySelectorAll('.commit-row').forEach(r => r.classList.remove('selected'));
                selectedRev = null;
                updateState();
            }

            searchInput.addEventListener('input', () => {
                renderHistory();
                updateState();
            });

            resizer.addEventListener('mousedown', () => {
                isResizing = true;
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', handleMouseMove);
                });
            });

            function handleMouseMove(e) {
                if (!isResizing) return;
                const offsetRight = document.body.offsetWidth - e.clientX;
                if (offsetRight > 150 && offsetRight < (document.body.offsetWidth * 0.8)) {
                    detailsPanel.style.width = offsetRight + 'px';
                }
            }
        </script>
    </body>
    </html>`;
    }
}