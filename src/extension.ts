import * as vscode from 'vscode';
import { SvnContext } from './utils/SvnContext';
import { HistoryCommands } from './commands/HistoryCommands';
import { FileCommands } from './commands/FileCommands';
import { AnnotateCommands } from './commands/AnnotateCommands';

/**
 * This method is called when your extension is activated.
 */
export function activate(context: vscode.ExtensionContext): void {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Please open a workspace folder to use SVN History.');
        return;
    }

    // 1. Initialize Dependency Injection Container
    const svnContext = new SvnContext(context, workspaceRoot);

    // 2. Register Command Groups
    new HistoryCommands(svnContext).register(context);
    new FileCommands(svnContext).register(context);
    new AnnotateCommands(svnContext).register(context);

    // 3. UI Status Management
    const updateTreeViewDescription = () => {
        const filtered = svnContext.repository.isFiltered;
        vscode.commands.executeCommand('setContext', 'svn-ij-history:isFiltered', filtered);

        const total = svnContext.repository.commits.length;
        const count = svnContext.repository.filteredCommits.length;

        let desc = filtered ? `${count} of ${total} commits` : `${total} commits`;
        svnContext.historyView.description = desc;
    };

    svnContext.repository.onDidChangeData(() => updateTreeViewDescription());
    updateTreeViewDescription(); // Initial update

    // Initial state
    vscode.commands.executeCommand('setContext', 'svn-ij-history:hasCommitSelected', false);

    // Open details on selection change in history view
    svnContext.historyView.onDidChangeSelection(e => {
        if (e.selection.length > 0) {
            const item = e.selection[0];
            if (item.commit) {
                vscode.commands.executeCommand('svn-ij-history.openCommitDetails', item.commit.rev);
            }
        }
    });
}

export function deactivate(): void {
    // Cleanup is handled via context.subscriptions in SvnContext/Commands
}