import * as vscode from 'vscode';
import { SvnHistoryViewProvider } from './providers/SvnHistoryViewProvider';

export function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (workspaceRoot) {
        const provider = new SvnHistoryViewProvider(context.extensionUri, workspaceRoot);
        
        // Registriamo il provider della Webview
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(SvnHistoryViewProvider.viewType, provider)
        );

        // Comando di refresh manuale
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.refresh', () => {
                // Il refresh viene gestito internamente dal provider
            })
        );
    } else {
        vscode.window.showErrorMessage("Apri una cartella (workspace) per usare SVN History.");
    }
}

export function deactivate() {}