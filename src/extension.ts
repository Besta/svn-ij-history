import * as vscode from 'vscode';
import { SvnHistoryViewProvider } from './providers/SvnHistoryViewProvider';

/**
 * This method is called when your extension is activated.
 * Your extension is activated the very first time a command is executed 
 * or when the view container is opened.
 * * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (workspaceRoot) {
        const provider = new SvnHistoryViewProvider(context.extensionUri, workspaceRoot);
        
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(SvnHistoryViewProvider.viewType, provider)
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.refresh', () => {
                provider.refresh();
            })
        );

        /**
         * Command to show a QuickPick with unique authors and filter the view.
         */
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.filterUser', async () => {
                const users = await provider.fetchRecentAuthors(200);
                if (users.length === 0) {
                    vscode.window.showInformationMessage("No authors found in recent history.");
                    return;
                }

                const selected = await vscode.window.showQuickPick(users, {
                    placeHolder: 'Select an author from recent 200 commits'
                });

                if (selected) {
                    provider.setSearchValue(selected);
                }
            })
        );
    } else {
        vscode.window.showErrorMessage("Please open a workspace folder to use SVN History.");
    }
}

/**
 * This method is called when your extension is deactivated.
 * Use this for cleanup (closing sockets, temp files, etc.).
 */
export function deactivate() {
    // Currently no cleanup required for SVN IJ History
}