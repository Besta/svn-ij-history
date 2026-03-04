import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DateUtils } from './DateUtils';
import { XMLParser } from 'fast-xml-parser';
import {
    SvnCommit,
    SvnCommitFile,
    AnnotateLine,
    SvnLogXml,
    SvnLogEntryXml,
    SvnPathXml,
    SvnInfoXml,
    SvnAnnotateXml,
    SvnAnnotateEntryXml
} from './SvnInterfaces';

const execFileAsync = promisify(execFile);

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
     * Executes an SVN command and handles errors.
     */
    private async executeSvn(args: string[]): Promise<string> {
        try {
            const { stdout } = await execFileAsync('svn', args, { cwd: this.workspaceRoot });
            return stdout;
        } catch (err: any) {
            const message = err.stderr || err.message || '';
            if (message.includes('is not a working copy')) {
                vscode.window.showWarningMessage('The current folder is not an SVN working copy.');
            } else {
                vscode.window.showErrorMessage(`SVN Error: ${message}`);
            }
            throw err;
        }
    }

    /**
     * Fetches the SVN log history using the command line.
     * @param limit Maximum number of log entries to retrieve.
     * @returns A promise resolving to an array of SvnCommit objects.
     */
    public async getHistory(limit: number = 50, revisionRange?: string): Promise<SvnCommit[]> {
        const args = ['log', '--limit', String(limit), '--xml', '--verbose'];
        if (revisionRange) {
            args.push('-r', revisionRange);
        }
        const stdout = await this.executeSvn(args);
        return this.parseXml(stdout);
    }

    /**
     * Fetches the SVN log history for a single file.
     * @param absoluteFilePath The absolute path of the file on disk.
     * @param limit Maximum number of log entries to retrieve.
     */
    public async getFileHistory(absoluteFilePath: string, limit: number = 50, revisionRange?: string): Promise<SvnCommit[]> {
        const args = ['log', '--limit', String(limit), '--xml', '--verbose'];
        if (revisionRange) {
            args.push('-r', revisionRange);
        }
        args.push(absoluteFilePath);
        const stdout = await this.executeSvn(args);
        return this.parseXml(stdout);
    }

    /**
     * Fetches details for a specific revision.
     */
    public async getCommit(rev: string): Promise<SvnCommit | undefined> {
        const stdout = await this.executeSvn(['log', '-r', rev, '--xml', '--verbose']);
        const commits = this.parseXml(stdout);
        return commits.length > 0 ? commits[0] : undefined;
    }

    /**
     * Retrieves the text content of a specific file at a specific revision.
     */
    public async getFileContent(repoUrl: string, rev: string): Promise<string> {
        return this.executeSvn(['cat', `${repoUrl}@${rev}`]);
    }

    /**
     * Retrieves the repository root URL.
     */
    public async getRepoRoot(): Promise<string> {
        if (this._repoRootCache !== undefined) {
            return this._repoRootCache;
        }
        const stdout = await this.executeSvn(['info', '--xml']);
        const jsonObj = this._parser.parse(stdout) as SvnInfoXml;
        this._repoRootCache = jsonObj?.info?.entry?.repository?.root || '';
        return this._repoRootCache || '';
    }

    /**
     * Fetches the annotate information for a file.
     */
    public async getFileAnnotate(absoluteFilePath: string): Promise<AnnotateLine[]> {
        const stdout = await this.executeSvn(['annotate', '--xml', absoluteFilePath]);
        return this.parseAnnotateXml(stdout);
    }

    /**
     * Parses SVN XML log output into SvnCommit objects.
     */
    private parseXml(xml: string): SvnCommit[] {
        const jsonObj = this._parser.parse(xml) as SvnLogXml;
        const logentries = jsonObj?.log?.logentry;
        if (!logentries) { return []; }

        const entries = Array.isArray(logentries) ? logentries : [logentries];

        return entries.map((entry: SvnLogEntryXml) => {
            const rev = String(entry.revision);
            const author = entry.author || 'No author';
            const dateStr = entry.date || '';
            const msg = entry.msg || '<no comment>';
            const date = new Date(dateStr);

            const paths = entry.paths?.path;
            const files: SvnCommitFile[] = [];

            if (paths) {
                const pathList = Array.isArray(paths) ? paths : [paths];
                pathList.forEach((p: SvnPathXml) => {
                    files.push({
                        action: p.action,
                        path: p['#text'] || p.toString(),
                        kind: p.kind
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
        const jsonObj = this._parser.parse(xml) as SvnAnnotateXml;
        const entries = jsonObj?.blame?.target?.entry;
        if (!entries) { return []; }

        const entryList = Array.isArray(entries) ? entries : [entries];

        return entryList.map((entry: SvnAnnotateEntryXml) => {
            const commit = entry.commit;
            const rev = commit?.revision ? String(commit.revision) : '0';
            const author = commit?.author || (rev === '0' ? '' : 'No author');
            const dateStr = commit?.date;
            const date = dateStr ? new Date(dateStr) : new Date(0);

            return {
                line: Number(entry['line-number']),
                rev,
                author,
                date
            };
        });
    }
}