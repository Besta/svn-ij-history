import * as vscode from 'vscode';
import { SvnService } from './SvnService';
import { SvnCommit } from './SvnInterfaces';


/**
 * Manages the state of SVN history, including the loaded commits,
 * current filters, and pagination.
 */
export class SvnRepository implements vscode.Disposable {
    private _commits: SvnCommit[] = [];
    private _limit: number = vscode.workspace.getConfiguration('svn-ij-history').get<number>('defaultLimit') ?? 200;
    private _fileFilter?: string;
    private _searchValue: string = '';
    private _startDate?: Date;
    private _endDate?: Date;
    private _loadPromise?: Promise<void>;

    private _onDidChangeData = new vscode.EventEmitter<void>();
    public readonly onDidChangeData = this._onDidChangeData.event;

    constructor(public readonly svnService: SvnService) { }

    public get commits(): SvnCommit[] { return this._commits; }
    public get limit(): number { return this._limit; }
    public get fileFilter(): string | undefined { return this._fileFilter; }
    public get searchValue(): string { return this._searchValue; }
    public get startDate(): Date | undefined { return this._startDate; }
    public get endDate(): Date | undefined { return this._endDate; }

    public get isFiltered(): boolean {
        return !!this._fileFilter || !!this._searchValue || !!this._startDate || !!this._endDate;
    }

    public get filteredCommits(): SvnCommit[] {
        const search = this._searchValue.toLowerCase();
        if (!search) {return this._commits;}

        return this._commits.filter(c =>
            c.msg.toLowerCase().includes(search) ||
            c.author.toLowerCase().includes(search) ||
            c.rev.includes(search)
        );
    }

    public async refresh(): Promise<void> {
        this._limit = vscode.workspace.getConfiguration('svn-ij-history').get<number>('defaultLimit') ?? 200;
        await this.loadCommits();
    }

    public async loadMore(): Promise<void> {
        this._limit += 50;
        await this.loadCommits();
    }

    public async showFileHistory(absoluteFilePath: string): Promise<void> {
        this._fileFilter = absoluteFilePath;
        this._limit = vscode.workspace.getConfiguration('svn-ij-history').get<number>('defaultLimit') ?? 200;
        await this.loadCommits();
    }

    public setSearchValue(value: string): void {
        this._searchValue = value;
        this._onDidChangeData.fire();
    }

    public async setDateFilter(start?: Date, end?: Date): Promise<void> {
        this._startDate = start;
        this._endDate = end;
        this._limit = vscode.workspace.getConfiguration('svn-ij-history').get<number>('defaultLimit') ?? 200;
        await this.loadCommits();
    }

    public async clearFilters(): Promise<void> {
        this._fileFilter = undefined;
        this._searchValue = '';
        this._startDate = undefined;
        this._endDate = undefined;
        this._limit = vscode.workspace.getConfiguration('svn-ij-history').get<number>('defaultLimit') ?? 200;
        await this.loadCommits();
    }

    private async loadCommits(): Promise<void> {
        // Guard against concurrent loads — return existing promise if already loading
        if (this._loadPromise) {
            return this._loadPromise;
        }
        this._loadPromise = this.doLoadCommits();
        try {
            await this._loadPromise;
        } finally {
            this._loadPromise = undefined;
        }
    }

    private async doLoadCommits(): Promise<void> {
        try {
            let revisionRange: string | undefined;
            if (this._startDate) {
                const formatDate = (d: Date): string => {
                    const year = d.getFullYear();
                    const month = (d.getMonth() + 1).toString().padStart(2, '0');
                    const day = d.getDate().toString().padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };
                if (this._endDate) {
                    const nextDay = new Date(this._endDate);
                    nextDay.setDate(nextDay.getDate() + 1);
                    revisionRange = `{${formatDate(nextDay)}}:{${formatDate(this._startDate)}}`;
                } else {
                    // From HEAD to startDate
                    revisionRange = `HEAD:{${formatDate(this._startDate)}}`;
                }
            }

            this._commits = this._fileFilter
                ? await this.svnService.getFileHistory(this._fileFilter, this._limit, revisionRange)
                : await this.svnService.getHistory(this._limit, revisionRange);
            this._onDidChangeData.fire();
        } catch (err) {
            console.error('Failed to load SVN history', err);
            throw err;
        }
    }

    public dispose(): void {
        this._onDidChangeData.dispose();
    }

    public async fetchRecentAuthors(limit: number): Promise<string[]> {
        const history = await this.svnService.getHistory(limit);
        return Array.from(new Set(history.map(c => c.author))).sort();
    }
}
