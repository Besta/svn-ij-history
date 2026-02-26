import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { DateUtils } from './DateUtils';

const execAsync = promisify(exec);

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
 * Service class to handle Subversion (SVN) CLI operations and XML parsing.
 */
export class SvnService {
    /**
     * @param workspaceRoot The local file system path to the SVN workspace.
     */
    constructor(private workspaceRoot: string) {}

    /**
     * Fetches the SVN log history using the command line.
     * @param limit Maximum number of log entries to retrieve.
     * @returns A promise resolving to an array of SvnCommit objects.
     */
    public async getHistory(limit: number = 50): Promise<SvnCommit[]> {
        // We use --xml and --verbose to get both structured data and the list of changed files
        const { stdout } = await execAsync(`svn log --limit ${limit} --xml --verbose`, { 
            cwd: this.workspaceRoot 
        });
        return this.parseXml(stdout);
    }

    /**
     * Retrieves the text content of a specific file at a specific revision.
     * @param repoUrl The full SVN URL of the file.
     * @param rev The revision number.
     * @returns The raw string content of the file.
     */
    public async getFileContent(repoUrl: string, rev: string): Promise<string> {
        // Using @rev syntax to handle files that might have been moved or deleted in HEAD
        const { stdout } = await execAsync(`svn cat "${repoUrl}@${rev}"`, { cwd: this.workspaceRoot });
        return stdout;
    }

    /**
     * Retrieves the repository root URL.
     * @returns The base URL of the SVN repository.
     */
    public async getRepoRoot(): Promise<string> {
        const { stdout } = await execAsync(`svn info --xml`, { cwd: this.workspaceRoot });
        const match = stdout.match(/<root>(.*?)<\/root>/);
        return match ? match[1] : "";
    }

    /**
     * Fetches all unique authors from the SVN history.
     * @returns A promise resolving to a sorted array of unique usernames.
     */
    public async getAllAuthors(): Promise<string[]> {
        try {
            // Eseguiamo un log senza --verbose per ottenere solo i metadati base (più veloce)
            const { stdout } = await execAsync(`svn log --xml`, { cwd: this.workspaceRoot });
            const authors = new Set<string>();
            const authorRegex = /<author>(.*?)<\/author>/g;
            
            let match;
            while ((match = authorRegex.exec(stdout)) !== null) {
                if (match[1]) {
                    authors.add(match[1]);
                }
            }
            return Array.from(authors).sort();
        } catch (error) {
            console.error('Error fetching SVN authors:', error);
            return [];
        }
    }

    /**
     * Manually parses the SVN XML output into SvnCommit objects.
     * Note: Manual regex parsing is used here for performance and to avoid heavy XML dependencies.
     * @param xml The raw XML string from SVN CLI.
     * @private
     */
    private parseXml(xml: string): SvnCommit[] {
        const commits: SvnCommit[] = [];
        const blocks = xml.split('</logentry>');

        for (const block of blocks) {
            if (!block.includes('<logentry')) continue;

            const rev = block.match(/revision="(\d+)"/)?.[1] || "";
            const author = block.match(/<author>(.*?)<\/author>/)?.[1] || "No author";
            const dateStr = block.match(/<date>(.*?)<\/date>/)?.[1] || "";
            const msg = block.match(/<msg>([\s\S]*?)<\/msg>/)?.[1] || "<no comment>";
            
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
}