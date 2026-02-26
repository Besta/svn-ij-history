import * as vscode from 'vscode';
import { SvnHistoryViewProvider } from './providers/SvnHistoryViewProvider';

/**
 * This method is called when your extension is activated.
 * Your extension is activated the very first time a command is executed 
 * or when the view container is opened.
 * * @param context The extension context provided by VS Code.
 */
export function activate(context: vscode.ExtensionContext) {
    // Attempt to get the first workspace folder path
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (workspaceRoot) {
        // Initialize the Webview provider with the workspace root and extension URI
        const provider = new SvnHistoryViewProvider(context.extensionUri, workspaceRoot);
        
        // Register the Webview View Provider
        // This links the ID in package.json to the logic in SvnHistoryViewProvider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(SvnHistoryViewProvider.viewType, provider)
        );

        /**
         * Register the manual refresh command.
         * This can be triggered from the command palette or UI buttons.
         */
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.refresh', () => {
                provider.refresh();
            })
        );
    } else {
        // Fallback for when no folder is open in VS Code
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