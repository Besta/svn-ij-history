import { execFile } from 'child_process';
import { promisify } from 'util';
import { DateUtils } from './DateUtils';

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

    /**
     * @param workspaceRoot The local file system path to the SVN workspace.
     */
    constructor(public workspaceRoot: string) { }

    /**
     * Fetches the SVN log history using the command line.
     * @param limit Maximum number of log entries to retrieve.
     * @returns A promise resolving to an array of SvnCommit objects.
     */
    public async getHistory(limit: number = 50): Promise<SvnCommit[]> {
        // Use --xml and --verbose to get both structured data and the list of changed files.
        // execFile is used instead of exec to prevent shell injection.
        const { stdout } = await execFileAsync(
            'svn',
            ['log', '--limit', String(limit), '--xml', '--verbose'],
            { cwd: this.workspaceRoot }
        );
        return this.parseXml(stdout);
    }

    /**
     * Fetches the SVN log history for a single file.
     * Only commits that touched the given file are returned.
     * @param absoluteFilePath The absolute path of the file on disk.
     * @param limit Maximum number of log entries to retrieve.
     * @returns A promise resolving to an array of SvnCommit objects.
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
     * @param rev The revision number.
     * @returns A promise resolving to an SvnCommit object or undefined.
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
     * @param repoUrl The full SVN URL of the file.
     * @param rev The revision number.
     * @returns The raw string content of the file.
     */
    public async getFileContent(repoUrl: string, rev: string): Promise<string> {
        // Using @rev syntax to handle files that might have been moved or deleted in HEAD.
        const { stdout } = await execFileAsync(
            'svn',
            ['cat', `${repoUrl}@${rev}`],
            { cwd: this.workspaceRoot }
        );
        return stdout;
    }

    /**
     * Retrieves the repository root URL.
     * The result is cached after the first call since it never changes during a session.
     * @returns The base URL of the SVN repository.
     */
    public async getRepoRoot(): Promise<string> {
        if (this._repoRootCache !== undefined) {
            return this._repoRootCache;
        }
        const { stdout } = await execFileAsync('svn', ['info', '--xml'], { cwd: this.workspaceRoot });
        const match = stdout.match(/<root>(.*?)<\/root>/);
        this._repoRootCache = match ? match[1] : '';
        return this._repoRootCache;
    }

    /**
     * Fetches the annotate information for a file.
     * @param absoluteFilePath The absolute path of the file.
     * @returns A promise resolving to an array of AnnotateLine objects.
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
     * Matches complete <logentry> blocks with a regex to avoid breakage from
     * messages containing "</logentry>" literally (safer than split-based approach).
     * @param xml The raw XML string from SVN CLI.
     * @private
     */
    private parseXml(xml: string): SvnCommit[] {
        const commits: SvnCommit[] = [];
        const blockRegex = /<logentry[\s\S]*?<\/logentry>/g;
        let blockMatch;

        while ((blockMatch = blockRegex.exec(xml)) !== null) {
            const block = blockMatch[0];

            const rev = block.match(/revision="(\d+)"/)?.[1] ?? '';
            const author = block.match(/<author>(.*?)<\/author>/)?.[1] ?? 'No author';
            const dateStr = block.match(/<date>(.*?)<\/date>/)?.[1] ?? '';
            const msg = block.match(/<msg>([\s\S]*?)<\/msg>/)?.[1] ?? '<no comment>';

            const date = new Date(dateStr);
            const files: { action: string; path: string }[] = [];
            const pathRegex = /<path[^>]*?action="(.*?)"[^>]*?>([\s\S]*?)<\/path>/g;

            let m;
            while ((m = pathRegex.exec(block)) !== null) {
                files.push({ action: m[1], path: m[2].trim() });
            }

            commits.push({
                rev,
                author,
                date,
                displayDate: DateUtils.formatDateTime(date),
                msg: msg.trim(),
                groupLabel: DateUtils.getGroupLabel(date),
                files
            });
        }
        return commits;
    }

    /**
     * Parses SVN XML annotate output.
     * @param xml The raw XML string from SVN CLI.
     */
    private parseAnnotateXml(xml: string): AnnotateLine[] {
        const lines: AnnotateLine[] = [];
        // Matches <entry line-number="X">...<commit revision="Y"><author>Z</author><date>T</date></commit>...</entry>
        const entryRegex = /<entry\s+line-number="(\d+)">[\s\S]*?<commit\s+revision="(\d+)">[\s\S]*?<author>(.*?)<\/author>[\s\S]*?<date>(.*?)<\/date>[\s\S]*?<\/commit>[\s\S]*?<\/entry>/g;

        let m;
        while ((m = entryRegex.exec(xml)) !== null) {
            lines.push({
                line: parseInt(m[1]),
                rev: m[2],
                author: m[3],
                date: new Date(m[4])
            });
        }
        return lines;
    }
}