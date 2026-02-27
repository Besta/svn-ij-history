import * as vscode from 'vscode';
import { SvnService, SvnCommit } from './SvnService';

/**
 * Manages the state of SVN history, including the loaded commits,
 * current filters, and pagination.
 */
export class SvnRepository {
    private _commits: SvnCommit[] = [];
    private _limit: number = 50;
    private _fileFilter?: string;
    private _searchValue: string = '';

    private _onDidChangeData = new vscode.EventEmitter<void>();
    public readonly onDidChangeData = this._onDidChangeData.event;

    constructor(public readonly svnService: SvnService) { }

    public get commits(): SvnCommit[] { return this._commits; }
    public get limit(): number { return this._limit; }
    public get fileFilter(): string | undefined { return this._fileFilter; }
    public get searchValue(): string { return this._searchValue; }

    public get isFiltered(): boolean {
        return !!this._fileFilter || !!this._searchValue;
    }

    public get filteredCommits(): SvnCommit[] {
        const search = this._searchValue.toLowerCase();
        if (!search) return this._commits;

        return this._commits.filter(c =>
            c.msg.toLowerCase().includes(search) ||
            c.author.toLowerCase().includes(search) ||
            c.rev.includes(search)
        );
    }

    public async refresh(): Promise<void> {
        this._limit = 50;
        await this.loadCommits();
    }

    public async loadMore(): Promise<void> {
        this._limit += 50;
        await this.loadCommits();
    }

    public async showFileHistory(absoluteFilePath: string): Promise<void> {
        this._fileFilter = absoluteFilePath;
        this._limit = 50;
        await this.loadCommits();
    }

    public setSearchValue(value: string): void {
        this._searchValue = value;
        this._onDidChangeData.fire();
    }

    public clearFilters(): void {
        this._fileFilter = undefined;
        this._searchValue = '';
        this._limit = 50;
        this.loadCommits();
    }

    private async loadCommits(): Promise<void> {
        try {
            this._commits = this._fileFilter
                ? await this.svnService.getFileHistory(this._fileFilter, this._limit)
                : await this.svnService.getHistory(this._limit);
            this._onDidChangeData.fire();
        } catch (err) {
            console.error('Failed to load SVN history', err);
            throw err;
        }
    }

    public async fetchRecentAuthors(limit: number): Promise<string[]> {
        const history = await this.svnService.getHistory(limit);
        return Array.from(new Set(history.map(c => c.author))).sort();
    }
}
