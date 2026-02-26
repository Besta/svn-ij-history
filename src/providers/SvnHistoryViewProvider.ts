import * as vscode from 'vscode';
import { SvnService, SvnCommit } from '../utils/SvnService';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class SvnHistoryViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'svn-ij-history.view';
	private _view?: vscode.WebviewView;
	private _svnService: SvnService;
	private _currentLimit = 50;

	constructor(
		private readonly _extensionUri: vscode.Uri,
		workspaceRoot: string
	) {
		this._svnService = new SvnService(workspaceRoot);
	}

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
			vscode.window.showErrorMessage("Errore Diff: " + err.message);
		}
	}

	private async openLocalFile(repoPath: string, isFolderRequested: boolean = false) {
		const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
		if (!workspacePath) return;

		// Proviamo a mappare il percorso SVN sul disco locale
		// Rimuoviamo trunk/branches/tags per trovare il path relativo nel workspace
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
			// Fallback: ricerca per nome file se il path strutturato fallisce
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
				vscode.window.showErrorMessage("Impossibile trovare il file nel workspace locale.");
			}
		}
	}

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
					this._currentLimit = 50;
					await this.loadHistory();
					break;
				case 'loadMore':
					this._currentLimit += 50;
					await this.loadHistory();
					break;
				case 'openDiff':
					await this.showDiff(data.path, data.rev);
					break;
				case 'openLocal':
					// Passiamo correttamente il flag folder
					await this.openLocalFile(data.path, data.folder === true);
					break;
			}
		});

		this.loadHistory();
	}

	private async loadHistory() {
		if (!this._view) return;
		try {
			const commits = await this._svnService.getHistory(this._currentLimit);
			this._view.webview.postMessage({ command: 'updateCommits', commits });
		} catch (err: any) {
			vscode.window.showErrorMessage("Errore SVN: " + err.message);
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.min.js'));

		return `<!DOCTYPE html>
    <html lang="it">
    <head>
        <meta charset="UTF-8">
        <script type="module" src="${toolkitUri}"></script>
        <style>
            body { margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh; font-family: var(--vscode-font-family); color: var(--vscode-foreground); overflow: hidden; }
            #search-bar { padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); display: flex; gap: 8px; background: var(--vscode-panel-background); z-index: 30; }
            #main-content { display: flex; flex: 1; overflow: hidden; position: relative; width: 100%; }
            #commit-list { flex: 1; min-width: 0; overflow-y: auto; background: var(--vscode-sideBar-background); }
            #resizer { width: 5px; cursor: col-resize; background: var(--vscode-panel-border); display: none; z-index: 100; flex-shrink: 0; }
            #resizer:hover { background: var(--vscode-focusBorder); }
            #details-panel { width: 50%; min-width: 200px; display: none; flex-direction: column; background: var(--vscode-editor-background); flex-shrink: 0; }
            #details-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-panel-sectionHeader-background); }
            summary { padding: 8px 12px; cursor: pointer; font-weight: bold; font-size: 0.85em; background-color: var(--vscode-sideBarSectionHeader-background, var(--vscode-editor-background)); color: var(--vscode-sideBarSectionHeader-foreground);position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--vscode-panel-border);outline: none;user-select: none;}
			summary:hover {filter: brightness(1.1);}
			details {background-color: var(--vscode-sideBar-background)}
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
			#load-more-container {padding: 15px;display: flex;justify-content: center;}
			.load-more-btn {background: var(--vscode-button-secondaryBackground);color: var(--vscode-button-secondaryForeground);border: none;padding: 6px 12px;cursor: pointer;font-size: 0.9em;border-radius: 2px;}
			.load-more-btn:hover {background: var(--vscode-button-secondaryHoverBackground);}
        </style>
    </head>
    <body>
        <div id="search-bar">
            <vscode-text-field id="search-input" placeholder="Filtra..." style="flex:1"></vscode-text-field>
            <vscode-button appearance="icon" onclick="vscode.postMessage({command:'refresh'})">
                <span class="codicon codicon-refresh"></span>
            </vscode-button>
        </div>
        <div id="main-content">
            <div id="commit-list"><div id="list-container"></div></div>
            <div id="resizer"></div>
            <div id="details-panel">
                <div id="details-header">
                    <span style="font-weight:bold">Dettagli</span>
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
            const detailsPanel = document.getElementById('details-panel');
            const resizer = document.getElementById('resizer');
            let allCommits = [];
            let isResizing = false;

            resizer.addEventListener('mousedown', (e) => {
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

            window.addEventListener('message', event => {
                if (event.data.command === 'updateCommits') {
                    allCommits = event.data.commits;
                    renderHistory(allCommits);
                }
            });

            function renderHistory(commits) {
                const container = document.getElementById('list-container');
                container.innerHTML = '';
                const groups = new Map();
                commits.forEach(c => {
					if (!groups.has(c.groupLabel)) {
						groups.set(c.groupLabel, []);
					}
					groups.get(c.groupLabel).push(c);
				});
                groups.forEach((commitsInGroup, label) => {
					const details = document.createElement('details');
					details.open = true;
					details.innerHTML = \`<summary>\${label}</summary>\`;
					
					commitsInGroup.forEach(c => {
						const div = document.createElement('div');
						div.className = 'commit-row';
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
				if (commits.length > 0) {
					const loadMoreDiv = document.createElement('div');
					loadMoreDiv.id = 'load-more-container';
					loadMoreDiv.innerHTML = \`
						<button class="load-more-btn" onclick="this.innerText='Caricamento...'; vscode.postMessage({command:'loadMore'})">
							Carica altri 50 commit...
						</button>
					\`;
					container.appendChild(loadMoreDiv);
				}
            }

            function showDetails(commit, el) {
                document.querySelectorAll('.commit-row').forEach(r => r.classList.remove('selected'));
                el.classList.add('selected');
                detailsPanel.style.display = 'flex';
                resizer.style.display = 'block';
                document.getElementById('det-rev').innerText = 'Revisione ' + commit.rev;
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
                                <span class="text-link" onclick="vscode.postMessage({command:'openLocal', path:'\${f.path}', folder:false})">Vai al file</span>
                            \` : \`
                                <span class="text-link" onclick="vscode.postMessage({command:'openLocal', path:'\${f.path}', folder:true})">Vai alla cartella</span>
                            \`}
                        </div>
                    </div>\`;
                }).join('');
                document.getElementById('det-files').innerHTML = '<strong>File:</strong>' + filesHtml;
            }

            window.closeDetails = function() {
                detailsPanel.style.display = 'none';
                resizer.style.display = 'none';
                document.querySelectorAll('.commit-row').forEach(r => r.classList.remove('selected'));
            }

            document.getElementById('search-input').addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase();
                renderHistory(allCommits.filter(c => c.author.toLowerCase().includes(val) || c.msg.toLowerCase().includes(val)));
            });
        </script>
    </body>
    </html>`;
	}
}