import * as vscode from 'vscode';
import { SvnHistoryViewProvider } from './providers/SvnHistoryViewProvider';

/**
 * This method is called when your extension is activated.
 * Your extension is activated the very first time a command is executed
 * or when the view container is opened.
 * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Please open a workspace folder to use SVN History.');
        return;
    }

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
                vscode.window.showInformationMessage('No authors found in recent history.');
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

    /**
     * New Command: Show SVN History for a specific file.
     * Triggered from context menus or command palette.
     */
    context.subscriptions.push(
        vscode.commands.registerCommand('svn-ij-history.showFileHistory', async (fileUri?: vscode.Uri) => {
            const targetUri = fileUri || vscode.window.activeTextEditor?.document.uri;
            if (targetUri && targetUri.scheme === 'file') {
                await provider.showFileHistory(targetUri.fsPath);
            } else {
                vscode.window.showErrorMessage('Please select a local file to show history.');
            }
        })
    );

    // Clean up temp diff files when the extension is deactivated
    context.subscriptions.push({
        dispose: () => provider.cleanupTmpFiles()
    });
}

/**
 * This method is called when your extension is deactivated.
 * Temp file cleanup is handled via context.subscriptions above.
 */
export function deactivate(): void {
    // No additional cleanup required here
}