import * as vscode from 'vscode';
import * as path from 'path';
import { execFile, ExecException } from 'child_process';
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
    SvnAnnotateEntryXml,
    SvnStatusXml,
    SvnChangelistXml,
    SvnStatusEntryXml,
    SvnListXml,
    SvnListEntryXml,
    SvnListEntry
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
    private async executeSvn(args: string[], signal?: AbortSignal): Promise<string> {
        try {
            const { stdout } = await execFileAsync('svn', args, { cwd: this.workspaceRoot, signal });
            return stdout;
        } catch (err: unknown) {
            const error = err as ExecException & { stderr?: string };
            if (error.name === 'AbortError') {
                throw error;
            }
            const message = error.stderr || error.message || '';
            if (message.includes('is not a working copy')) {
                vscode.window.showWarningMessage('The current folder is not an SVN working copy.');
            } else {
                vscode.window.showErrorMessage(`SVN Error: ${message}`);
            }
            throw error;
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
     * Applies a patch file to the repository.
     * @param patchFilePath The absolute path to the patch file.
     */
    public async applyPatch(patchFilePath: string): Promise<string> {
        return this.executeSvn(['patch', patchFilePath]);
    }

    /**
     * Gets the current SVN status of the workspace, including changelists.
     * Returns a Map of File AbsolutePath -> { status: string, changelist?: string }
     */
    public async getWorkspaceStatus(): Promise<Map<string, { status: string, changelist?: string }>> {
        const statusMap = new Map<string, { status: string, changelist?: string }>();
        try {
            const stdout = await this.executeSvn(['status', '--xml']);
            const jsonObj = this._parser.parse(stdout) as SvnStatusXml;
            const target = jsonObj?.status?.target;
            const statusChangelists = jsonObj?.status?.changelist;
            
            if (!target && !statusChangelists) {return statusMap;}

            const processEntries = (entries: SvnStatusEntryXml | SvnStatusEntryXml[] | undefined, changelistName?: string): void => {
                if (!entries) {return;}
                const entryList = Array.isArray(entries) ? entries : [entries];
                for (const entry of entryList) {
                    const absPath = path.resolve(this.workspaceRoot, entry.path);
                    statusMap.set(absPath, {
                        status: entry['wc-status']?.item || 'none',
                        changelist: changelistName
                    });
                }
            };

            const processChangelistList = (cl: SvnChangelistXml | SvnChangelistXml[]): void => {
                const clList = Array.isArray(cl) ? cl : [cl];
                for (const changelist of clList) {
                    processEntries(changelist.entry, changelist.name);
                }
            };

            // 1. Process entries in target
            if (target?.entry) {
                processEntries(target.entry);
            }

            // 2. Process changelists in target (older SVN?)
            if (target?.changelist) {
                processChangelistList(target.changelist);
            }

            // 3. Process changelists in status (newer SVN - seen in user logs)
            if (statusChangelists) {
                processChangelistList(statusChangelists);
            }
        } catch (err: unknown) {
            console.error('Error fetching SVN status', err);
        }
        return statusMap;
    }

    /**
     * Lists the contents of a remote SVN directory.
     * @param url The SVN URL to list.
     */
    public async listRemoteDirectories(url: string): Promise<SvnListEntry[]> {
        // Use non-interactive and trust server certs to avoid hanging on self-signed certs
        const args = ['ls', '--xml', '--non-interactive', '--trust-server-cert', url];
        const stdout = await this.executeSvn(args);
        return this.parseListXml(stdout);
    }

    /**
     * Checks out an SVN repository.
     * @param url The SVN URL to checkout.
     * @param destination The local folder to checkout into.
     * @param signal AbortSignal to cancel the checkout.
     */
    public async checkout(url: string, destination: string, signal?: AbortSignal): Promise<void> {
        await this.executeSvn(['checkout', url, destination, '--non-interactive', '--trust-server-cert'], signal);
    }

    /**
     * Adds a file or directory to a changelist in SVN.
     * @param changelist The name of the changelist.
     * @param absoluteFilePath The absolute path of the file to add.
     */
    public async addToChangelist(changelist: string, absoluteFilePath: string): Promise<void> {
        await this.executeSvn(['changelist', changelist, absoluteFilePath]);
    }

    /**
     * Removes a file or directory from an SVN changelist.
     * @param absoluteFilePath The absolute path of the file to remove.
     */
    public async removeFromChangelist(absoluteFilePath: string): Promise<void> {
        await this.executeSvn(['changelist', '--remove', absoluteFilePath]);
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

    /**
     * Parses SVN XML list output.
     */
    private parseListXml(xml: string): SvnListEntry[] {
        const jsonObj = this._parser.parse(xml) as SvnListXml;
        const entries = jsonObj?.lists?.list?.entry;
        if (!entries) { return []; }

        const entryList = Array.isArray(entries) ? entries : [entries];

        return entryList.map((entry: SvnListEntryXml) => {
            const dateStr = entry.commit?.date;
            return {
                kind: entry.kind as 'dir' | 'file',
                name: entry.name,
                revision: entry.commit?.revision?.toString(),
                author: entry.commit?.author,
                date: dateStr ? new Date(dateStr) : undefined
            };
        });
    }
}