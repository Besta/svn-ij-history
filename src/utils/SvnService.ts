import { execFile } from 'child_process';
import { promisify } from 'util';
import { DateUtils } from './DateUtils';
import { XMLParser } from 'fast-xml-parser';

const execFileAsync = promisify(execFile);

/**
 * Represents a single SVN commit entry with its metadata and affected files.
 */
export interface SvnCommit {
    /** Revision number (e.g., "1234") */
    rev: string;
    /** The username of the committer */
    author: string;
    /** Original Date object of the commit */
    date: Date;
    /** Formatted date string for UI display */
    displayDate: string;
    /** The commit message */
    msg: string;
    /** Categorization label (e.g., "Today", "Last Week") */
    groupLabel: string;
    /** List of files modified, added, or deleted in this revision */
    files: { action: string; path: string }[];
}

/**
 * Represents a single line in the SVN annotate output.
 */
export interface AnnotateLine {
    line: number;
    rev: string;
    author: string;
    date: Date;
}

/**
 * Service class to handle Subversion (SVN) CLI operations and XML parsing.
 * Uses execFile (not exec) to avoid shell injection vulnerabilities.
 */
export class SvnService {
    /** Cached repository root URL — fetched once and reused. */
    private _repoRootCache?: string;
    private _parser: XMLParser;

    /**
     * @param workspaceRoot The local file system path to the SVN workspace.
     */
    constructor(public workspaceRoot: string) {
        this._parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '',
            parseAttributeValue: true
        });
    }

    /**
     * Fetches the SVN log history using the command line.
     * @param limit Maximum number of log entries to retrieve.
     * @returns A promise resolving to an array of SvnCommit objects.
     */
    public async getHistory(limit: number = 50): Promise<SvnCommit[]> {
        const { stdout } = await execFileAsync(
            'svn',
            ['log', '--limit', String(limit), '--xml', '--verbose'],
            { cwd: this.workspaceRoot }
        );
        return this.parseXml(stdout);
    }

    /**
     * Fetches the SVN log history for a single file.
     * @param absoluteFilePath The absolute path of the file on disk.
     * @param limit Maximum number of log entries to retrieve.
     */
    public async getFileHistory(absoluteFilePath: string, limit: number = 50): Promise<SvnCommit[]> {
        const { stdout } = await execFileAsync(
            'svn',
            ['log', '--limit', String(limit), '--xml', '--verbose', absoluteFilePath],
            { cwd: this.workspaceRoot }
        );
        return this.parseXml(stdout);
    }

    /**
     * Fetches details for a specific revision.
     */
    public async getCommit(rev: string): Promise<SvnCommit | undefined> {
        const { stdout } = await execFileAsync(
            'svn',
            ['log', '-r', rev, '--xml', '--verbose'],
            { cwd: this.workspaceRoot }
        );
        const commits = this.parseXml(stdout);
        return commits.length > 0 ? commits[0] : undefined;
    }

    /**
     * Retrieves the text content of a specific file at a specific revision.
     */
    public async getFileContent(repoUrl: string, rev: string): Promise<string> {
        const { stdout } = await execFileAsync(
            'svn',
            ['cat', `${repoUrl}@${rev}`],
            { cwd: this.workspaceRoot }
        );
        return stdout;
    }

    /**
     * Retrieves the repository root URL.
     */
    public async getRepoRoot(): Promise<string> {
        if (this._repoRootCache !== undefined) {
            return this._repoRootCache;
        }
        const { stdout } = await execFileAsync('svn', ['info', '--xml'], { cwd: this.workspaceRoot });
        const jsonObj = this._parser.parse(stdout);
        this._repoRootCache = jsonObj?.info?.entry?.repository?.root || '';
        return this._repoRootCache || '';
    }

    /**
     * Fetches the annotate information for a file.
     */
    public async getFileAnnotate(absoluteFilePath: string): Promise<AnnotateLine[]> {
        const { stdout } = await execFileAsync(
            'svn',
            ['annotate', '--xml', absoluteFilePath],
            { cwd: this.workspaceRoot }
        );
        return this.parseAnnotateXml(stdout);
    }

    /**
     * Parses SVN XML log output into SvnCommit objects.
     */
    private parseXml(xml: string): SvnCommit[] {
        const jsonObj = this._parser.parse(xml);
        const logentries = jsonObj?.log?.logentry;
        if (!logentries) { return []; }

        const entries = Array.isArray(logentries) ? logentries : [logentries];

        return entries.map((entry: any) => {
            const rev = String(entry.revision);
            const author = entry.author || 'No author';
            const dateStr = entry.date || '';
            const msg = entry.msg || '<no comment>';
            const date = new Date(dateStr);

            const paths = entry.paths?.path;
            const files: { action: string; path: string }[] = [];

            if (paths) {
                const pathList = Array.isArray(paths) ? paths : [paths];
                pathList.forEach((p: any) => {
                    files.push({
                        action: p.action,
                        path: p['#text'] || p.toString()
                    });
                });
            }

            return {
                rev,
                author,
                date,
                displayDate: DateUtils.formatDateTime(date),
                msg: msg.trim(),
                groupLabel: DateUtils.getGroupLabel(date),
                files
            };
        });
    }

    /**
     * Parses SVN XML annotate output.
     */
    private parseAnnotateXml(xml: string): AnnotateLine[] {
        const jsonObj = this._parser.parse(xml);
        const entries = jsonObj?.blame?.target?.entry;
        if (!entries) { return []; }

        const entryList = Array.isArray(entries) ? entries : [entries];

        return entryList.map((entry: any) => {
            return {
                line: parseInt(entry['line-number']),
                rev: String(entry.commit?.revision),
                author: entry.commit?.author || 'No author',
                date: new Date(entry.commit?.date)
            };
        });
    }
}