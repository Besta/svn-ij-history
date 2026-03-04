import * as vscode from 'vscode';

/**
 * Provides colored status letters (A, M, D) as badges for SVN file entries.
 * Triggered by the 'svn-ij-history' URI scheme.
 */
export class SvnFileDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined> = this._onDidChangeFileDecorations.event;

    constructor() { }

    provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
        if (uri.scheme !== 'svn-ij-history') {
            return undefined;
        }

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
}
