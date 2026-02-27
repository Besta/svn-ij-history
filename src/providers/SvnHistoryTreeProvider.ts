import * as vscode from 'vscode';
import { SvnService, SvnCommit } from '../utils/SvnService';
import { DateUtils } from '../utils/DateUtils';
import { SvnRepository } from '../utils/SvnRepository';

/**
 * Tree item representing either a date group or a single commit.
 */
export class SvnTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly commit?: SvnCommit,
        public readonly isLoadMore: boolean = false
    ) {
        super(label, collapsibleState);

        if (commit) {
            const dateStr = DateUtils.formatListDate(commit.date, commit.groupLabel);
            const fileCount = commit.files.length;
            this.description = `${commit.author} • ${dateStr} • ${fileCount} file${fileCount !== 1 ? 's' : ''}`;
            this.tooltip = `${commit.rev}: ${commit.msg}`;
            this.contextValue = 'commit-item';
            this.iconPath = new vscode.ThemeIcon('git-commit');
        } else if (isLoadMore) {
            this.contextValue = 'loadMore';
            this.iconPath = new vscode.ThemeIcon('add');
            this.tooltip = 'Click once to load 50 more commits';
        } else {
            this.contextValue = 'group';
        }
    }
}

export class SvnHistoryTreeProvider implements vscode.TreeDataProvider<SvnTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SvnTreeItem | undefined | null | void> = new vscode.EventEmitter<SvnTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SvnTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(public readonly repository: SvnRepository) {
        this.repository.onDidChangeData(() => this._onDidChangeTreeData.fire());
    }

    refresh(): void {
        this.repository.refresh().catch(() => vscode.window.showErrorMessage('Failed to refresh SVN history'));
    }

    get commitCount(): number { return this.repository.commits.length; }
    get filteredCount(): number {
        return this.repository.filteredCommits.length;
    }
    get isFiltered(): boolean { return this.repository.isFiltered; }
    get currentFilterDescription(): string {
        const parts: string[] = [];
        const fileFilter = this.repository.fileFilter;
        if (fileFilter) {
            const root = this.repository.svnService.workspaceRoot;
            parts.push(`file: ${fileFilter.startsWith(root) ? fileFilter.substring(root.length + 1) : fileFilter}`);
        }
        if (this.repository.searchValue) parts.push(`"${this.repository.searchValue}"`);
        return parts.join(', ');
    }

    getTreeItem(element: SvnTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SvnTreeItem): Promise<SvnTreeItem[]> {
        const filteredCommits = this.repository.filteredCommits;

        if (!element) {
            if (filteredCommits.length === 0 && !this.repository.isFiltered) {
                await this.repository.refresh();
            }

            const groups = new Map<string, SvnCommit[]>();
            this.repository.filteredCommits.forEach(c => {
                const group = c.groupLabel;
                if (!groups.has(group)) groups.set(group, []);
                groups.get(group)!.push(c);
            });

            const items: SvnTreeItem[] = Array.from(groups.keys()).map(label =>
                new SvnTreeItem(label, vscode.TreeItemCollapsibleState.Expanded)
            );

            items.push(new SvnTreeItem('Load 50 more...', vscode.TreeItemCollapsibleState.None, undefined, true));
            return items;
        }

        // Return commits for a group
        const groupLabel = element.label as string;
        const commitsInGroup = filteredCommits.filter(c => c.groupLabel === groupLabel);

        return commitsInGroup.map(c => {
            return new SvnTreeItem(
                `r${c.rev} - ${c.msg.split('\n')[0]}`,
                vscode.TreeItemCollapsibleState.None,
                c
            );
        });
    }
}
