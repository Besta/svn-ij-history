import * as vscode from 'vscode';
import { SvnService } from '../utils/SvnService';

/**
 * Provides colored status letters (A, M, D) as badges for SVN file entries.
 * Handles both the custom 'svn-ij-history' UI and standard local workspace 'file' URIs.
 *
 * Color rules:
 *  - No active changelist: each file gets its own status color (added=green, modified=blue, etc.)
 *  - Active changelist set:
 *      • File IS in the active changelist  → status color per modification type
 *      • File is NOT in the active changelist → single "dimmed" color (ignoredResourceForeground)
 */
export class SvnFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    private statusCache = new Map<string, { status: string, changelist?: string }>();

    public activeChangelist: string = '<default>';

    constructor(private svnService: SvnService) { }

    /**
     * Updates the internal cache of workspace file statuses and triggers a UI update.
     */
    public async updateStatusCache(): Promise<void> {
        const oldKeys = Array.from(this.statusCache.keys());
        this.statusCache = await this.svnService.getWorkspaceStatus();
        const newKeys = Array.from(this.statusCache.keys());

        // Fire refresh for all affected URIs (both old - to clear - and new - to decorate)
        const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));
        const uris = allKeys.map(p => vscode.Uri.file(p));
        // Also fire undefined to catch any VS Code explorer refreshes
        this._onDidChangeFileDecorations.fire(undefined);
        if (uris.length > 0) {
            this._onDidChangeFileDecorations.fire(uris);
        }
    }

    provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
        if (uri.scheme === 'svn-ij-history') {
            return this.provideSvnHistoryDecoration(uri);
        } else if (uri.scheme === 'file') {
            return this.provideFileDecorationForUri(uri);
        }
        return undefined;
    }

    private provideFileDecorationForUri(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
        const statusInfo = this.statusCache.get(uri.fsPath);
        if (!statusInfo) { return undefined; }

        const active = this.activeChangelist;

        // When a changelist is active, files NOT belonging to it get a single dimmed color.
        const isInActiveChangelist = active
            ? (active === '<default>' ? statusInfo.changelist === undefined : statusInfo.changelist === active)
            : true; // no active changelist → treat every file as "in scope"

        if (!isInActiveChangelist) {
            return {
                badge: this.statusBadge(statusInfo.status),
                tooltip: `${this.statusLabel(statusInfo.status)} – not in active changelist`,
                color: new vscode.ThemeColor('disabledForeground')
            };
        }

        // File is in the active changelist (or no changelist is active): per-type colors.
        return this.decorationForStatus(statusInfo.status, statusInfo.changelist);
    }

    private statusBadge(status: string): string {
        switch (status) {
            case 'added':       return 'A';
            case 'modified':
            case 'replaced':    return 'M';
            case 'deleted':
            case 'missing':     return 'D';
            case 'unversioned': return 'U';
            default:            return '?';
        }
    }

    private statusLabel(status: string): string {
        switch (status) {
            case 'added':       return 'Added';
            case 'modified':    return 'Modified';
            case 'replaced':    return 'Replaced';
            case 'deleted':     return 'Deleted';
            case 'missing':     return 'Missing';
            case 'unversioned': return 'Unversioned';
            default:            return status;
        }
    }

    private decorationForStatus(status: string, changelist?: string): vscode.FileDecoration | undefined {
        const clSuffix = changelist ? ` (${changelist})` : '';

        if (status === 'added') {
            return {
                badge: 'A',
                tooltip: `Added${clSuffix} (SVN)`,
                color: new vscode.ThemeColor('gitDecoration.addedResourceForeground')
            };
        } else if (status === 'modified' || status === 'replaced') {
            return {
                badge: 'M',
                tooltip: `Modified${clSuffix} (SVN)`,
                color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
            };
        } else if (status === 'deleted' || status === 'missing') {
            return {
                badge: 'D',
                tooltip: `Deleted${clSuffix} (SVN)`,
                color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground')
            };
        } else if (status === 'unversioned') {
            return {
                badge: 'U',
                tooltip: 'Unversioned (SVN)',
                color: new vscode.ThemeColor('gitDecoration.untrackedResourceForeground')
            };
        }
        return undefined;
    }

    private provideSvnHistoryDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
        const query = new URLSearchParams(uri.query);
        const action = query.get('action');

        if (!action) {
            return undefined;
        }

        switch (action.toUpperCase()) {
            case 'A':
                return {
                    badge: 'A',
                    tooltip: 'Added',
                    color: new vscode.ThemeColor('gitDecoration.addedResourceForeground')
                };
            case 'M':
                return {
                    badge: 'M',
                    tooltip: 'Modified',
                    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
                };
            case 'D':
                return {
                    badge: 'D',
                    tooltip: 'Deleted',
                    color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground')
                };
            case 'R':
                return {
                    badge: 'R',
                    tooltip: 'Renamed',
                    color: new vscode.ThemeColor('gitDecoration.renamedResourceForeground')
                };
            default:
                return undefined;
        }
    }

    public refresh(uris?: vscode.Uri | vscode.Uri[]): void {
        this._onDidChangeFileDecorations.fire(uris);
    }

    public dispose(): void {
        this._onDidChangeFileDecorations.dispose();
    }
}
