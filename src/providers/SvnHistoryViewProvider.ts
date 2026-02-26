import * as vscode from 'vscode';
import { SvnService, SvnCommit } from '../utils/SvnService';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Generates a cryptographically-safe nonce string for use in the Content Security Policy.
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

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
    /** When set, history is scoped to this absolute file path instead of the whole repo. */
    private _fileFilter?: string;
    /** Tracks temp files written for diffs so they can be cleaned up on deactivation. */
    private _tmpFiles: Set<string> = new Set();

    /**
     * @param _extensionUri The URI of the directory containing the extension.
     * @param _workspaceRoot The absolute path to the current workspace root.
     */
    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _workspaceRoot: string
    ) {
        this._svnService = new SvnService(_workspaceRoot);
    }

    /**
     * Deletes all temp files created for diffs. Called on extension deactivation.
     */
    public cleanupTmpFiles(): void {
        for (const f of this._tmpFiles) {
            try { fs.unlinkSync(f); } catch { /* file may already be gone */ }
        }
        this._tmpFiles.clear();
    }

    /**
     * Resets the view to the initial state and reloads the history.
     * If a file filter is active it is preserved; call clearFileFilter() first to go back to repo history.
     */
    public async refresh(): Promise<void> {
        this._currentLimit = 50;
        this._view?.webview.postMessage({ command: 'clearSearch' });
        await this.loadHistory();
    }

    /**
     * Scope the history view to a single file.
     * @param absoluteFilePath The absolute path of the file to inspect.
     */
    public async showFileHistory(absoluteFilePath: string): Promise<void> {
        this._fileFilter = absoluteFilePath;
        this._currentLimit = 50;
        this._view?.webview.postMessage({ command: 'clearSearch' });
        // Reveal the panel if it is not currently visible
        if (this._view) { this._view.show(true); }
        await this.loadHistory();
    }

    /**
     * Removes the file scope and goes back to full repository history.
     */
    public async clearFileFilter(): Promise<void> {
        this._fileFilter = undefined;
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
        } catch {
            return [];
        }
    }

    /**
     * Sends a message to the webview to set the search input value.
     * @param value The string to set in the search bar.
     */
    public setSearchValue(value: string): void {
        this._view?.webview.postMessage({ command: 'setSearch', value });
    }

    /**
     * Generates a diff between the selected revision and its predecessor.
     * Writes two temp files and opens VS Code's built-in diff editor.
     * @param repoPath Relative path of the file in the repository.
     * @param rev The revision number to compare.
     */
    private async showDiff(repoPath: string, rev: string): Promise<void> {
        const prevRev = (parseInt(rev) - 1).toString();
        const fileName = repoPath.split('/').pop() || 'file';
        try {
            const rootUrl = await this._svnService.getRepoRoot();
            const fullUrl = `${rootUrl}${repoPath}`;

            const [currContent, prevContent] = await Promise.all([
                this._svnService.getFileContent(fullUrl, rev),
                this._svnService.getFileContent(fullUrl, prevRev).catch(() => '')
            ]);

            const tmpDir = os.tmpdir();
            const pathPrev = path.join(tmpDir, `svn-ij-prev_${rev}_${fileName}`);
            const pathCurr = path.join(tmpDir, `svn-ij-curr_${rev}_${fileName}`);

            fs.writeFileSync(pathPrev, prevContent);
            fs.writeFileSync(pathCurr, currContent);

            // Track for cleanup on deactivation
            this._tmpFiles.add(pathPrev);
            this._tmpFiles.add(pathCurr);

            await vscode.commands.executeCommand('vscode.diff',
                vscode.Uri.file(pathPrev),
                vscode.Uri.file(pathCurr),
                `${fileName} (r${prevRev} ↔ r${rev})`
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage('Diff Error: ' + msg);
        }
    }

    /**
     * Attempts to open the file or folder in the local workspace.
     * Uses the stored workspace root instead of re-reading workspaceFolders each time.
     * @param repoPath Relative path from the SVN repository.
     * @param isFolderRequested Whether to reveal in explorer instead of opening a document.
     */
    private async openLocalFile(repoPath: string, isFolderRequested: boolean = false): Promise<void> {
        const cleanRelPath = repoPath.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
        const absolutePath = path.join(this._workspaceRoot, cleanRelPath);

        if (fs.existsSync(absolutePath)) {
            const uri = vscode.Uri.file(absolutePath);
            if (isFolderRequested) {
                await vscode.commands.executeCommand('revealInExplorer', uri);
            } else {
                await vscode.window.showTextDocument(uri);
            }
        } else {
            const targetName = repoPath.split('/').pop();
            if (!targetName) { return; }
            const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);

            if (files.length > 0) {
                if (isFolderRequested) {
                    await vscode.commands.executeCommand('revealInExplorer', files[0]);
                } else {
                    await vscode.window.showTextDocument(files[0]);
                }
            } else {
                vscode.window.showErrorMessage('Could not find the file in the local workspace.');
            }
        }
    }

    /**
     * Overwrites the local file with content from a specific SVN revision.
     * Shows a confirmation warning because it destroys local uncommitted changes.
     * @param repoPath Relative path of the file in the repository.
     * @param rev The revision number to fetch.
     */
    private async revertFile(repoPath: string, rev: string): Promise<void> {
        const choice = await vscode.window.showWarningMessage(
            `Are you sure you want to overwrite your local file with version r${rev}? Any uncommitted local changes will be lost.`,
            { modal: true },
            'Overwrite'
        );

        if (choice !== 'Overwrite') { return; }

        try {
            const rootUrl = await this._svnService.getRepoRoot();
            const fullUrl = `${rootUrl}${repoPath}`;
            const content = await this._svnService.getFileContent(fullUrl, rev);

            // Resolve local path (same logic as openLocalFile)
            const cleanRelPath = repoPath.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
            let absolutePath = path.join(this._workspaceRoot, cleanRelPath);

            // If not directly found, try to locate by filename
            if (!fs.existsSync(absolutePath)) {
                const targetName = repoPath.split('/').pop();
                if (targetName) {
                    const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);
                    if (files.length > 0) {
                        absolutePath = files[0].fsPath;
                    } else {
                        throw new Error('Could not find the target file in the local workspace to overwrite.');
                    }
                }
            }

            fs.writeFileSync(absolutePath, content);
            vscode.window.showInformationMessage(`Successfully reverted ${path.basename(absolutePath)} to r${rev}`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage('Revert Error: ' + msg);
        }
    }

    /**
     * VS Code entry point for initializing the Webview.
     * @param webviewView The webview view instance to resolve.
     */
    public resolveWebviewView(webviewView: vscode.WebviewView): void {
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
                case 'revertFile':
                    await this.revertFile(data.path, data.rev);
                    break;
                case 'clearFileFilter':
                    await this.clearFileFilter();
                    break;
            }
        });

        // Clean up temp files when the panel is closed
        webviewView.onDidDispose(() => this.cleanupTmpFiles());

        this.loadHistory();
    }

    /**
     * Fetches SVN logs and pushes them to the Webview.
     * Calls getFileHistory() when a file filter is active, getHistory() otherwise.
     */
    private async loadHistory(): Promise<void> {
        if (!this._view) { return; }
        try {
            const commits = this._fileFilter
                ? await this._svnService.getFileHistory(this._fileFilter, this._currentLimit)
                : await this._svnService.getHistory(this._currentLimit);

            const title = this._fileFilter
                ? path.basename(this._fileFilter)
                : undefined;

            this._view.webview.postMessage({ command: 'updateCommits', commits, fileTitle: title });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage('SVN Error: ' + msg);
        }
    }

    /**
     * Loads the webview HTML from media/webview.html and injects runtime values
     * (CSP nonce, cspSource, CSS URI, script URI) via simple string replacement.
     * This keeps all HTML/CSS/JS in their own dedicated files under media/.
     * @param webview The webview instance used to generate resource URIs.
     * @returns Full HTML string ready to be assigned to webview.html.
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'codicons.css'));
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.html');

        return fs.readFileSync(htmlPath.fsPath, 'utf-8')
            .replace(/\{\{nonce\}\}/g, nonce)
            .replace(/\{\{cspSource\}\}/g, webview.cspSource)
            .replace(/\{\{cssUri\}\}/g, cssUri.toString())
            .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
            .replace(/\{\{codiconsUri\}\}/g, codiconsUri.toString());
    }
}