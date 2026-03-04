import * as vscode from 'vscode';
import { SvnService } from '../utils/SvnService';
import { SvnCommit, SvnCommitFile } from '../utils/SvnInterfaces';
import { PathUtils } from '../utils/PathUtils';
import * as path from 'path';

export class SvnDetailItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        private readonly workspaceRoot: string,
        public readonly file?: { action: string; path: string; rev: string; kind?: string },
        public readonly revNumber?: string
    ) {
        super(label, collapsibleState);

        if (file) {
            const dirPath = PathUtils.getDirPath(file.path);
            this.description = dirPath;
            this.tooltip = path.normalize(PathUtils.cleanRepoPath(file.path));

            // Construct absolute path for native icons
            const absolutePath = PathUtils.toFsPath(file.path, this.workspaceRoot);

            // Use custom scheme for decorations, while keeping the file path for icons
            this.resourceUri = vscode.Uri.file(absolutePath).with({
                scheme: 'svn-ij-history',
                query: `action=${file.action}`
            });

            this.contextValue = file.kind === 'dir' ? 'dir-item' : 'file-item';

            if (this.contextValue === 'file-item') {
                this.command = {
                    command: 'svn-ij-history.openDiff',
                    title: 'Open Diff',
                    arguments: [this]
                };
            } else if (this.contextValue === 'dir-item') {
                this.command = {
                    command: 'svn-ij-history.openLocal',
                    title: 'Open Directory',
                    arguments: [this]
                };
            }
        }
    }
}

export class SvnDetailsTreeProvider implements vscode.TreeDataProvider<SvnDetailItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SvnDetailItem | undefined | null | void> = new vscode.EventEmitter<SvnDetailItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SvnDetailItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private _commit?: SvnCommit;

    constructor(public readonly svnService: SvnService) { }

    public setCommit(commit: SvnCommit): void {
        this._commit = commit;
        this._onDidChangeTreeData.fire();
    }

    public clear(): void {
        this._commit = undefined;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SvnDetailItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SvnDetailItem): Promise<SvnDetailItem[]> {
        if (!this._commit) {
            return [];
        }

        if (!element) {
            // Root items: Consolidated Header + Files Header
            const msgLabel = this._commit.msg.split('\n')[0];
            const headerLabel = `r${this._commit.rev} - ${msgLabel}`;
            const items: SvnDetailItem[] = [
                new SvnDetailItem(
                    headerLabel.length > 60 ? headerLabel.substring(0, 57) + '...' : headerLabel,
                    vscode.TreeItemCollapsibleState.None,
                    'commit-header',
                    this.svnService.workspaceRoot,
                    undefined,
                    this._commit.rev
                ),
                new SvnDetailItem(
                    `Changed Files (${this._commit.files.length})`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'files-header',
                    this.svnService.workspaceRoot
                )
            ];
            // Tooltip for full message
            items[0].tooltip = `Revision ${this._commit.rev}\n\n${this._commit.msg}`;
            return items;
        }

        if (element.contextValue === 'files-header') {
            return this._commit.files.map((f: SvnCommitFile) => {
                const fileName = path.basename(f.path);
                return new SvnDetailItem(
                    fileName,
                    vscode.TreeItemCollapsibleState.None,
                    'file-item', // This is overridden in constructor if file info is present
                    this.svnService.workspaceRoot,
                    { ...f, rev: this._commit!.rev }
                );
            });
        }

        return [];
    }
}
