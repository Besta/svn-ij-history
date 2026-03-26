import * as vscode from 'vscode';
import { SvnService } from '../utils/SvnService';

/**
 * Provides colored status letters (A, M, D) as badges for SVN file entries.
 * Handles both the custom 'svn-ij-history' UI and standard local workspace 'file' URIs.
 */
export class SvnFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    private statusCache = new Map<string, { status: string, changelist?: string }>();

    constructor(private svnService: SvnService) { }

    /**
     * Updates the internal cache of workspace file statuses and triggers an UI update.
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
        if (!statusInfo) {return undefined;}

        if (statusInfo.status === 'added') {
            return {
                badge: 'A',
                tooltip: 'Added (SVN)',
                color: new vscode.ThemeColor('gitDecoration.addedResourceForeground')
            };
        } else if (statusInfo.status === 'modified' || statusInfo.status === 'replaced') {
            if (statusInfo.changelist) {
                return {
                    badge: 'M',
                    tooltip: `Modified (${statusInfo.changelist})`,
                    color: new vscode.ThemeColor('gitDecoration.stageDeletedResourceForeground')
                };
            } else {
                return {
                    badge: 'M',
                    tooltip: 'Modified (SVN)',
                    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
                };
            }
        } else if (statusInfo.status === 'deleted' || statusInfo.status === 'missing') {
            return {
                badge: 'D',
                tooltip: 'Deleted (SVN)',
                color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground')
            };
        } else if (statusInfo.status === 'unversioned') {
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
