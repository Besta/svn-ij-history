import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { DateUtils } from './DateUtils';

const execAsync = promisify(exec);

export interface SvnCommit {
    rev: string;
    author: string;
    date: Date;
    displayDate: string;
    msg: string;
    groupLabel: string;
    files: { action: string; path: string }[];
}

export class SvnService {
    constructor(private workspaceRoot: string) {}

    public async getHistory(limit: number = 50, searchPath?: string): Promise<SvnCommit[]> {
        const target = searchPath || this.workspaceRoot;
        // Chiediamo a SVN i log in formato XML per un parsing robusto
        const { stdout } = await execAsync(`svn log --limit ${limit} --xml --verbose "${target}"`, { 
            cwd: this.workspaceRoot 
        });
        return this.parseXml(stdout);
    }

    public async getFileContent(repoUrl: string, rev: string): Promise<string> {
        const { stdout } = await execAsync(`svn cat "${repoUrl}@${rev}"`, { cwd: this.workspaceRoot });
        return stdout;
    }

    public async getRepoRoot(): Promise<string> {
        const { stdout } = await execAsync(`svn info --xml`, { cwd: this.workspaceRoot });
        const match = stdout.match(/<root>(.*?)<\/root>/);
        return match ? match[1] : "";
    }

    private parseXml(xml: string): SvnCommit[] {
        const commits: SvnCommit[] = [];
        const blocks = xml.split('</logentry>');

        for (const block of blocks) {
            if (!block.includes('<logentry')) continue;

            const rev = block.match(/revision="(\d+)"/)?.[1] || "";
            const author = block.match(/<author>(.*?)<\/author>/)?.[1] || "Nessun autore";
            const dateStr = block.match(/<date>(.*?)<\/date>/)?.[1] || "";
            const msg = block.match(/<msg>([\s\S]*?)<\/msg>/)?.[1] || "<nessun commento>";
            
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