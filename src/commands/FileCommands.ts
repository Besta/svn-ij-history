import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SvnContext } from '../utils/SvnContext';
import { SvnDetailItem } from '../providers/SvnDetailsTreeProvider';
import { SvnTreeItem } from '../providers/SvnHistoryTreeProvider';
import { PathUtils } from '../utils/PathUtils';

export class FileCommands {
    private tmpFiles = new Set<string>();

    constructor(private context: SvnContext) {
        context.extensionContext.subscriptions.push({
            dispose: () => {
                for (const f of this.tmpFiles) {
                    try { fs.unlinkSync(f); } catch { }
                }
            }
        });
    }

    public register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.openDiff', async (item: SvnDetailItem) => {
                if (!item.file) {return;}
                const { path: repoPath, rev } = item.file;
                const prevRev = (parseInt(rev) - 1).toString();
                const fileName = repoPath.split('/').pop() || 'file';
                try {
                    const rootUrl = await this.context.svnService.getRepoRoot();
                    const fullUrl = `${rootUrl}${repoPath}`;

                    const [currContent, prevContent] = await Promise.all([
                        this.context.svnService.getFileContent(fullUrl, rev),
                        this.context.svnService.getFileContent(fullUrl, prevRev).catch(() => '')
                    ]);

                    const tmpDir = os.tmpdir();
                    const pathPrev = path.join(tmpDir, `svn-ij-prev_${rev}_${fileName}`);
                    const pathCurr = path.join(tmpDir, `svn-ij-curr_${rev}_${fileName}`);

                    fs.writeFileSync(pathPrev, prevContent);
                    fs.writeFileSync(pathCurr, currContent);

                    this.tmpFiles.add(pathPrev);
                    this.tmpFiles.add(pathCurr);

                    await vscode.commands.executeCommand('vscode.diff',
                        vscode.Uri.file(pathPrev),
                        vscode.Uri.file(pathCurr),
                        `${fileName} (r${prevRev} ↔ r${rev})`
                    );
                } catch {
                    // SvnService already handled the UI notification
                }
            }),
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
            }),
            vscode.commands.registerCommand('svn-ij-history.copyCommitMessage', (item: SvnTreeItem | SvnDetailItem) => {
                let msg: string | undefined;
                if (item instanceof SvnTreeItem && item.commit) {
                    msg = item.commit.msg;
                } else if (item instanceof SvnDetailItem && item.fullMessage) {
                    msg = item.fullMessage;
                }

                if (msg) {
                    vscode.env.clipboard.writeText(msg);
                    vscode.window.showInformationMessage('Commit message copied to clipboard.');
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.copyRelPath', (item: SvnDetailItem) => {
                if (item.file) {
                    vscode.env.clipboard.writeText(path.normalize(PathUtils.cleanRepoPath(item.file.path)));
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.copyAbsPath', (item: SvnDetailItem) => {
                if (item.file && item.resourceUri) {
                    vscode.env.clipboard.writeText(item.resourceUri.fsPath);
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.copyFileName', (item: SvnDetailItem) => {
                if (item.file) {
                    vscode.env.clipboard.writeText(path.basename(item.file.path));
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.openLocal', async (item: SvnDetailItem) => {
                if (!item.file) {return;}
                let absolutePath = PathUtils.toFsPath(item.file.path, this.context.workspaceRoot);

                if (!fs.existsSync(absolutePath)) {
                    const targetName = item.file.path.split('/').pop();
                    if (targetName) {
                        const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);
                        if (files.length > 0) {
                            absolutePath = files[0].fsPath;
                        } else {
                            vscode.window.showErrorMessage('Could not find the file/directory in the local workspace.');
                            return;
                        }
                    }
                }

                if (fs.existsSync(absolutePath)) {
                    const uri = vscode.Uri.file(absolutePath);
                    const isDir = fs.statSync(absolutePath).isDirectory();
                    if (isDir) {
                        await vscode.commands.executeCommand('revealInExplorer', uri);
                    } else {
                        await vscode.window.showTextDocument(uri);
                    }
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.compareLocal', async (item: SvnDetailItem) => {
                if (!item.file) {return;}
                const { path: repoPath, rev } = item.file;
                const fileName = path.basename(repoPath);

                let absolutePath = PathUtils.toFsPath(repoPath, this.context.workspaceRoot);

                if (!fs.existsSync(absolutePath)) {
                    const targetName = repoPath.split('/').pop();
                    if (targetName) {
                        const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);
                        if (files.length > 0) {absolutePath = files[0].fsPath;}
                    }
                }

                if (!fs.existsSync(absolutePath)) {
                    vscode.window.showErrorMessage('Could not find the local file to compare with.');
                    return;
                }

                try {
                    const rootUrl = await this.context.svnService.getRepoRoot();
                    const fullUrl = `${rootUrl}${repoPath}`;
                    const content = await this.context.svnService.getFileContent(fullUrl, rev);

                    const tmpDir = os.tmpdir();
                    const pathRev = path.join(tmpDir, `svn-ij-r${rev}_${fileName}`);
                    fs.writeFileSync(pathRev, content);
                    this.tmpFiles.add(pathRev);

                    await vscode.commands.executeCommand('vscode.diff',
                        vscode.Uri.file(pathRev),
                        vscode.Uri.file(absolutePath),
                        `${fileName} (r${rev} ↔ Local File)`
                    );
                } catch {
                    // SvnService handled notification
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.compareClipboard', async (item: SvnDetailItem) => {
                if (!item.file) {return;}
                const { path: repoPath, rev } = item.file;
                const fileName = path.basename(repoPath);

                try {
                    const clipboardText = await vscode.env.clipboard.readText();
                    
                    const rootUrl = await this.context.svnService.getRepoRoot();
                    const fullUrl = `${rootUrl}${repoPath}`;
                    const content = await this.context.svnService.getFileContent(fullUrl, rev);

                    const tmpDir = os.tmpdir();
                    const pathRev = path.join(tmpDir, `svn-ij-r${rev}_${fileName}`);
                    const pathClipboard = path.join(tmpDir, `clipboard_${fileName}`);
                    
                    fs.writeFileSync(pathRev, content);
                    fs.writeFileSync(pathClipboard, clipboardText);
                    
                    this.tmpFiles.add(pathRev);
                    this.tmpFiles.add(pathClipboard);

                    await vscode.commands.executeCommand('vscode.diff',
                        vscode.Uri.file(pathRev),
                        vscode.Uri.file(pathClipboard),
                        `${fileName} (r${rev} ↔ Clipboard)`
                    );
                } catch {
                    // Handled
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.revertFile', async (item: SvnDetailItem) => {
                if (!item.file) {return;}
                const { path: repoPath, rev } = item.file;
                const choice = await vscode.window.showWarningMessage(
                    `Are you sure you want to overwrite your local file with version r${rev}?`,
                    { modal: true },
                    'Overwrite'
                );

                if (choice !== 'Overwrite') {return;}

                try {
                    const rootUrl = await this.context.svnService.getRepoRoot();
                    const fullUrl = `${rootUrl}${repoPath}`;
                    const content = await this.context.svnService.getFileContent(fullUrl, rev);

                    let absolutePath = PathUtils.toFsPath(repoPath, this.context.workspaceRoot);

                    if (!fs.existsSync(absolutePath)) {
                        const targetName = repoPath.split('/').pop();
                        if (targetName) {
                            const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);
                            if (files.length > 0) {absolutePath = files[0].fsPath;}
                        }
                    }

                    fs.writeFileSync(absolutePath, content);
                    vscode.window.showInformationMessage(`Successfully reverted ${path.basename(absolutePath)} to r${rev}`);
                } catch {
                    // SvnService already handled the UI notification
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.compareRevisions', async (_item: SvnTreeItem, items: SvnTreeItem[]) => {
                if (!items || items.length !== 2) {
                    vscode.window.showInformationMessage('Please select exactly two revisions to compare.');
                    return;
                }
                const fileFilter = this.context.repository.fileFilter;
                if (!fileFilter) {return;}

                const commit1 = items[0].commit;
                const commit2 = items[1].commit;
                if (!commit1 || !commit2) {return;}

                // Sort by revision to have rLow < rHigh
                const [c1, c2] = [commit1, commit2].sort((a, b) => parseInt(a.rev) - parseInt(b.rev));
                const revLow = c1.rev;
                const revHigh = c2.rev;
                const fileName = path.basename(fileFilter);

                try {
                    const [contentLow, contentHigh] = await Promise.all([
                        this.context.svnService.getFileContent(fileFilter, revLow),
                        this.context.svnService.getFileContent(fileFilter, revHigh)
                    ]);

                    const tmpDir = os.tmpdir();
                    const pathLow = path.join(tmpDir, `svn-ij-r${revLow}_${fileName}`);
                    const pathHigh = path.join(tmpDir, `svn-ij-r${revHigh}_${fileName}`);

                    fs.writeFileSync(pathLow, contentLow);
                    fs.writeFileSync(pathHigh, contentHigh);

                    this.tmpFiles.add(pathLow);
                    this.tmpFiles.add(pathHigh);

                    await vscode.commands.executeCommand('vscode.diff',
                        vscode.Uri.file(pathLow),
                        vscode.Uri.file(pathHigh),
                        `${fileName} (r${revLow} ↔ r${revHigh})`
                    );
                } catch {
                    // SvnService already handled the UI notification
                }
            })
        );
    }
}
