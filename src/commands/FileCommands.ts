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

    public register(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.openDiff', async (item: SvnDetailItem) => {
                if (!item.file) return;
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
                } catch (err: any) {
                    vscode.window.showErrorMessage('Diff Error: ' + err.message);
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
                if (!item.file) return;
                const absolutePath = PathUtils.toFsPath(item.file.path, this.context.workspaceRoot);

                if (fs.existsSync(absolutePath)) {
                    const uri = vscode.Uri.file(absolutePath);
                    await vscode.window.showTextDocument(uri);
                } else {
                    const targetName = item.file.path.split('/').pop();
                    if (targetName) {
                        const files = await vscode.workspace.findFiles(`**/${targetName}`, '**/node_modules/**', 1);
                        if (files.length > 0) {
                            await vscode.window.showTextDocument(files[0]);
                        } else {
                            vscode.window.showErrorMessage('Could not find the file in the local workspace.');
                        }
                    }
                }
            }),
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
                    const rootUrl = await this.context.svnService.getRepoRoot();
                    const fullUrl = `${rootUrl}${repoPath}`;
                    const content = await this.context.svnService.getFileContent(fullUrl, rev);

                    let absolutePath = PathUtils.toFsPath(repoPath, this.context.workspaceRoot);

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
    }
}
