import * as vscode from 'vscode';
import { SvnHistoryTreeProvider, SvnTreeItem } from './providers/SvnHistoryTreeProvider';
import { SvnDetailsTreeProvider, SvnDetailItem } from './providers/SvnDetailsTreeProvider';
import { SvnService } from './utils/SvnService';
import { AnnotateDecorator } from './decorators/AnnotateDecorator';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * This method is called when your extension is activated.
 * Your extension is activated the very first time a command is executed
 * or when the view container is opened.
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Please open a workspace folder to use SVN History.');
        return;
    }

    const svnService = new SvnService(workspaceRoot);
    const treeProvider = new SvnHistoryTreeProvider(svnService);
    const historyView = vscode.window.createTreeView('svn-ij-history.history-tree', { treeDataProvider: treeProvider });

    // Open details on single click (selection)
    historyView.onDidChangeSelection(e => {
        if (e.selection.length > 0) {
            const item = e.selection[0];
            if (item.commit) {
                vscode.commands.executeCommand('svn-ij-history.openCommitDetails', item.commit.rev);
            } else if (item.isLoadMore) {
                vscode.commands.executeCommand('svn-ij-history.loadMore');
            }
        }
    });

    const detailsProvider = new SvnDetailsTreeProvider(svnService);
    const detailsView = vscode.window.createTreeView('svn-ij-history.details-tree', { treeDataProvider: detailsProvider });

    const annotateDecorator = new AnnotateDecorator(svnService);

    const updateAnnotateContext = (editor?: vscode.TextEditor) => {
        const isActive = editor ? annotateDecorator.isEnabled(editor.document.uri) : false;
        vscode.commands.executeCommand('setContext', 'svn-ij-history:isAnnotateActive', isActive);
    };

    context.subscriptions.push(historyView, detailsView);

    const updateTreeViewDescription = () => {
        const filtered = treeProvider.isFiltered;
        vscode.commands.executeCommand('setContext', 'svn-ij-history:isFiltered', filtered);

        const total = treeProvider.commitCount;
        const count = treeProvider.filteredCount;

        let desc = filtered ? `${count} of ${total} commits` : `${total} commits`;

        if (filtered) {
            desc += ` (Filter: ${treeProvider.currentFilterDescription})`;
        }
        historyView.description = desc;
    };

    treeProvider.onDidChangeTreeData(() => updateTreeViewDescription());
    updateTreeViewDescription(); // Initial update
    vscode.commands.executeCommand('setContext', 'svn-ij-history:hasCommitSelected', false);

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.refresh', () => {
            treeProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.clearFilter', () => {
            treeProvider.clearFilters();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.clearDetails', () => {
            vscode.commands.executeCommand('setContext', 'svn-ij-history:hasCommitSelected', false);
            detailsProvider.clear();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.loadMore', () => {
            treeProvider.loadMore();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.search', async () => {
            const val = await vscode.window.showInputBox({
                placeHolder: 'Search by message, author, or revision...',
                prompt: 'Filter the current commit list'
            });
            if (val !== undefined) {
                treeProvider.setSearchValue(val);
            }
        })
    );

    /**
     * Command to show a QuickPick with unique authors and filter the view.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.filterUser', async () => {
            const users = await treeProvider.fetchRecentAuthors(200);
            if (users.length === 0) {
                vscode.window.showInformationMessage('No authors found in recent history.');
                return;
            }

            const selected = await vscode.window.showQuickPick(users, {
                placeHolder: 'Select an author from recent 200 commits'
            });

            if (selected) {
                treeProvider.setSearchValue(selected);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.showFileHistory', async (fileUri?: vscode.Uri) => {
            const targetUri = fileUri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri && targetUri.scheme === 'file') {
                await treeProvider.showFileHistory(targetUri.fsPath);
            } else {
                vscode.window.showErrorMessage('Please select a local file to show history.');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.toggleAnnotate', async (arg?: any) => {
            const editor = vscode.window.activeTextEditor;
            let targetUri: vscode.Uri | undefined;

            if (arg instanceof vscode.Uri) {
                targetUri = arg;
            } else if (arg && typeof arg === 'object' && arg.uri instanceof vscode.Uri) {
                targetUri = arg.uri;
            } else {
                targetUri = editor?.document.uri;
            }

            if (targetUri && targetUri.scheme === 'file') {
                await annotateDecorator.toggleAnnotate(targetUri);
                updateAnnotateContext(editor);
            } else {
                vscode.window.showErrorMessage('Please open a local file to use SVN Annotate.');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.showAnnotate', (uri?: vscode.Uri) => {
            return vscode.commands.executeCommand('svn-ij-history.toggleAnnotate', uri);
        }),
        vscode.commands.registerCommand('svn-ij-history.hideAnnotate', (uri?: vscode.Uri) => {
            return vscode.commands.executeCommand('svn-ij-history.toggleAnnotate', uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.openCommitDetails', async (rev: string) => {
            await vscode.commands.executeCommand('setContext', 'svn-ij-history:hasCommitSelected', true);
            const commit = await svnService.getCommit(rev);
            if (commit) {
                detailsProvider.setCommit(commit);
            }
        })
    );

    // --- File Action Commands ---

    const tmpFiles = new Set<string>();

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.openDiff', async (item: SvnDetailItem) => {
            if (!item.file) return;
            const { path: repoPath, rev } = item.file;
            const prevRev = (parseInt(rev) - 1).toString();
            const fileName = repoPath.split('/').pop() || 'file';
            try {
                const rootUrl = await svnService.getRepoRoot();
                const fullUrl = `${rootUrl}${repoPath}`;

                const [currContent, prevContent] = await Promise.all([
                    svnService.getFileContent(fullUrl, rev),
                    svnService.getFileContent(fullUrl, prevRev).catch(() => '')
                ]);

                const tmpDir = os.tmpdir();
                const pathPrev = path.join(tmpDir, `svn-ij-prev_${rev}_${fileName}`);
                const pathCurr = path.join(tmpDir, `svn-ij-curr_${rev}_${fileName}`);

                fs.writeFileSync(pathPrev, prevContent);
                fs.writeFileSync(pathCurr, currContent);

                tmpFiles.add(pathPrev);
                tmpFiles.add(pathCurr);

                await vscode.commands.executeCommand('vscode.diff',
                    vscode.Uri.file(pathPrev),
                    vscode.Uri.file(pathCurr),
                    `${fileName} (r${prevRev} ↔ r${rev})`
                );
            } catch (err: any) {
                vscode.window.showErrorMessage('Diff Error: ' + err.message);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.copyRevision', (item: SvnTreeItem | SvnDetailItem) => {
            let rev: string | undefined;
            if (item instanceof SvnTreeItem && item.commit) {
                rev = item.commit.rev;
            } else if (item instanceof SvnDetailItem && item.revNumber) {
                rev = item.revNumber;
            }

            if (rev) {
                vscode.env.clipboard.writeText(rev);
                vscode.window.showInformationMessage(`Revision ${rev} copied to clipboard.`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.copyRelPath', (item: SvnDetailItem) => {
            if (item.file) {
                const cleanRelPath = item.file.path.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
                vscode.env.clipboard.writeText(path.normalize(cleanRelPath));
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.copyAbsPath', (item: SvnDetailItem) => {
            if (item.file && item.resourceUri) {
                vscode.env.clipboard.writeText(item.resourceUri.fsPath);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.copyFileName', (item: SvnDetailItem) => {
            if (item.file) {
                vscode.env.clipboard.writeText(path.basename(item.file.path));
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.openLocal', async (item: SvnDetailItem) => {
            if (!item.file) return;
            const repoPath = item.file.path;
            const cleanRelPath = repoPath.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
            const absolutePath = path.join(workspaceRoot, cleanRelPath);

            if (fs.existsSync(absolutePath)) {
                const uri = vscode.Uri.file(absolutePath);
                await vscode.window.showTextDocument(uri);
            } else {
                const targetName = repoPath.split('/').pop();
                if (targetName) {
                    const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);
                    if (files.length > 0) {
                        await vscode.window.showTextDocument(files[0]);
                    } else {
                        vscode.window.showErrorMessage('Could not find the file in the local workspace.');
                    }
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.revertFile', async (item: SvnDetailItem) => {
            if (!item.file) return;
            const { path: repoPath, rev } = item.file;
            const choice = await vscode.window.showWarningMessage(
                `Are you sure you want to overwrite your local file with version r${rev}?`,
                { modal: true },
                'Overwrite'
            );

            if (choice !== 'Overwrite') return;

            try {
                const rootUrl = await svnService.getRepoRoot();
                const fullUrl = `${rootUrl}${repoPath}`;
                const content = await svnService.getFileContent(fullUrl, rev);

                const cleanRelPath = repoPath.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
                let absolutePath = path.join(workspaceRoot, cleanRelPath);

                if (!fs.existsSync(absolutePath)) {
                    const targetName = repoPath.split('/').pop();
                    if (targetName) {
                        const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);
                        if (files.length > 0) absolutePath = files[0].fsPath;
                    }
                }

                fs.writeFileSync(absolutePath, content);
                vscode.window.showInformationMessage(`Successfully reverted ${path.basename(absolutePath)} to r${rev}`);
            } catch (err: any) {
                vscode.window.showErrorMessage('Revert Error: ' + err.message);
            }
        })
    );

    // Update decorations and context when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (editor) => {
            updateAnnotateContext(editor);
            if (editor) {
                await annotateDecorator.updateDecorations(editor);
            }
        })
    );

    // Clean up temp diff files when the extension is deactivated
    context.subscriptions.push(annotateDecorator);
    context.subscriptions.push({
        dispose: () => {
            for (const f of tmpFiles) {
                try { fs.unlinkSync(f); } catch { }
            }
        }
    });
}

/**
 * This method is called when your extension is deactivated.
 * Temp file cleanup is handled via context.subscriptions above.
 */
export function deactivate(): void {
    // No additional cleanup required here
}