import * as vscode from 'vscode';
import { SvnService, SvnCommit } from '../utils/SvnService';
import * as path from 'path';

export class SvnDetailItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly contextValue: string,
        private readonly workspaceRoot: string,
        public readonly file?: { action: string; path: string; rev: string },
        public readonly revNumber?: string
    ) {
        super(label, collapsibleState);

        if (file) {
            // Description: Action and relative path (gray text on the right)
            const cleanRelPath = file.path.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
            const normalizedRelPath = path.normalize(cleanRelPath);
            const lastSep = normalizedRelPath.lastIndexOf(path.sep);
            const dirPath = lastSep === -1 ? '' : normalizedRelPath.substring(0, lastSep);

            this.description = [file.action, dirPath].filter(Boolean).join(' • ');
            this.tooltip = normalizedRelPath;

            // Construct absolute path for native icons
            const absolutePath = path.join(this.workspaceRoot, cleanRelPath);
            this.resourceUri = vscode.Uri.file(absolutePath);

            this.contextValue = `file-item`;
            this.command = {
                command: 'svn-ij-history.openDiff',
                title: 'Open Diff',
                arguments: [this]
            };
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
            return this._commit.files.map(f => {
                const fileName = path.basename(f.path);
                return new SvnDetailItem(
                    fileName,
                    vscode.TreeItemCollapsibleState.None,
                    'file-item',
                    this.svnService.workspaceRoot,
                    { ...f, rev: this._commit!.rev }
                );
            });
        }

        return [];
    }
}
