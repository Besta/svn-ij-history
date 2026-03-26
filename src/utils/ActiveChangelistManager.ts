import * as vscode from 'vscode';
import { SvnService } from './SvnService';
import * as path from 'path';

/**
 * Manages the Active Changelist feature for SVN.
 * Automatically adds saved files to the currently active changelist.
 */
export class ActiveChangelistManager {
    private _activeChangelist: string = '<default>';
    private _statusBarItem: vscode.StatusBarItem;
    private _disposables: vscode.Disposable[] = [];
    private _onRefresh?: () => void;

    constructor(private svnService: SvnService, private context: vscode.ExtensionContext, onRefresh?: () => void) {
        this._onRefresh = onRefresh;
        
        // Read configuration and persisted state
        const config = vscode.workspace.getConfiguration('svn-ij-history');
        if (config.get<boolean>('rememberActiveChangelist', true)) {
            this._activeChangelist = this.context.workspaceState.get<string>('activeChangelist', '<default>');
        }

        // Create a status bar item
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this._statusBarItem.command = 'svn-ij-history.clearActiveChangelist';
        this._statusBarItem.tooltip = 'Click to reset Active Changelist to Default Changelist';
        this._disposables.push(this._statusBarItem);

        // Listen for file saves
        vscode.workspace.onDidSaveTextDocument((doc) => this.onDidSaveTextDocument(doc), this, this._disposables);

        // Also update immediately in case one was loaded
        this.updateStatusBar();
    }

    /**
     * Gets the currently active changelist name, if any.
     */
    public get activeChangelist(): string {
        return this._activeChangelist;
    }

    /**
     * Sets a changelist as active.
     */
    public setActiveChangelist(name: string) {
        this._activeChangelist = name;
        
        const config = vscode.workspace.getConfiguration('svn-ij-history');
        if (config.get<boolean>('rememberActiveChangelist', true)) {
            this.context.workspaceState.update('activeChangelist', name);
        }

        this.updateStatusBar();
        const displayName = name === '<default>' ? 'Changes' : name;
        vscode.window.showInformationMessage(`Active Changelist set to: ${displayName}`);
        this._onRefresh?.();
    }

    /**
     * Clears the active changelist.
     */
    public clearActiveChangelist() {
        if (this._activeChangelist === '<default>') {
            vscode.window.showInformationMessage('Active Changelist is already the Default Changelist.');
            return;
        }
        this._activeChangelist = '<default>';
        
        const config = vscode.workspace.getConfiguration('svn-ij-history');
        if (config.get<boolean>('rememberActiveChangelist', true)) {
            this.context.workspaceState.update('activeChangelist', '<default>');
        }

        this.updateStatusBar();
        vscode.window.showInformationMessage('Active Changelist reset to Default Changelist.');
        this._onRefresh?.();
    }

    private updateStatusBar() {
        if (this._activeChangelist) {
            const displayName = this._activeChangelist === '<default>' ? 'Changes' : this._activeChangelist;
            this._statusBarItem.text = `$(list-tree) Changelist: ${displayName}`;
            this._statusBarItem.show();
        } else {
            this._statusBarItem.hide();
        }
    }

    private async onDidSaveTextDocument(document: vscode.TextDocument) {
        if (!this._activeChangelist) {
            return;
        }

        // Only process files in our workspace
        const filePath = document.uri.fsPath;
        if (!filePath.startsWith(this.svnService.workspaceRoot)) {
            return;
        }

        // Add this file to the active changelist, then notify the decoration provider
        try {
            if (this._activeChangelist === '<default>') {
                // To move a file to the default changelist, we remove it from any existing changelist
                await this.svnService.removeFromChangelist(filePath);
            } else {
                await this.svnService.addToChangelist(this._activeChangelist, filePath);
            }
            // Notify after the SVN command completes so the cache reflects the new state
            this._onRefresh?.();
        } catch (e) {
            console.error('Failed to add file to active changelist', e);
        }
    }

    public dispose() {
        this._disposables.forEach(d => d.dispose());
    }
}
