import * as vscode from 'vscode';
import { SvnService, SvnCommit } from '../utils/SvnService';
import { DateUtils } from '../utils/DateUtils';

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

    private _commits: SvnCommit[] = [];
    private _limit: number = 50;
    private _fileFilter?: string;
    private _searchValue: string = '';

    constructor(private svnService: SvnService) { }

    refresh(): void {
        this._limit = 50;
        this.loadCommits();
    }

    async loadMore(): Promise<void> {
        this._limit += 50;
        await this.loadCommits();
    }

    async showFileHistory(absoluteFilePath: string): Promise<void> {
        this._fileFilter = absoluteFilePath;
        this._limit = 50;
        await this.loadCommits();
    }

    setSearchValue(value: string): void {
        this._searchValue = value.toLowerCase();
        this._onDidChangeTreeData.fire();
    }

    async fetchRecentAuthors(limit: number): Promise<string[]> {
        const history = await this.svnService.getHistory(limit);
        return Array.from(new Set(history.map(c => c.author))).sort();
    }

    get commitCount(): number { return this._commits.length; }
    get filteredCount(): number {
        return this.getFilteredCommits().length;
    }
    get isFiltered(): boolean { return !!this._fileFilter || !!this._searchValue; }
    get currentFilterDescription(): string {
        const parts: string[] = [];
        if (this._fileFilter) parts.push(`file: ${this.svnService.workspaceRoot.length < this._fileFilter.length ? this._fileFilter.substring(this.svnService.workspaceRoot.length + 1) : this._fileFilter}`);
        if (this._searchValue) parts.push(`"${this._searchValue}"`);
        return parts.join(', ');
    }

    clearFilters(): void {
        this._fileFilter = undefined;
        this._searchValue = '';
        this._limit = 50;
        this.loadCommits();
    }

    private getFilteredCommits(): SvnCommit[] {
        return this._commits.filter(c =>
            c.msg.toLowerCase().includes(this._searchValue) ||
            c.author.toLowerCase().includes(this._searchValue) ||
            c.rev.includes(this._searchValue)
        );
    }

    private async loadCommits(): Promise<void> {
        try {
            this._commits = this._fileFilter
                ? await this.svnService.getFileHistory(this._fileFilter, this._limit)
                : await this.svnService.getHistory(this._limit);
            this._onDidChangeTreeData.fire();
        } catch (err) {
            vscode.window.showErrorMessage('Failed to load SVN history');
        }
    }

    getTreeItem(element: SvnTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SvnTreeItem): Promise<SvnTreeItem[]> {
        if (!element) {
            if (this._commits.length === 0) {
                await this.loadCommits();
            }

            const filteredCommits = this.getFilteredCommits();

            const groups = new Map<string, SvnCommit[]>();
            filteredCommits.forEach(c => {
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
        const filteredCommits = this.getFilteredCommits().filter(c => c.groupLabel === groupLabel);

        return filteredCommits.map(c => {
            return new SvnTreeItem(
                `r${c.rev} - ${c.msg.split('\n')[0]}`,
                vscode.TreeItemCollapsibleState.None,
                c
            );
        });
    }
}
