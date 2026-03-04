import * as vscode from 'vscode';
import * as path from 'path';
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

    // 2.5 Register Decoration Provider
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(svnContext.decorationProvider));

    // 3. UI Status Management
    const updateTreeViewDescription = () => {
        const total = svnContext.repository.commits.length;
        const count = svnContext.repository.filteredCommits.length;
        const filtered = svnContext.repository.isFiltered;
        const fileFilter = svnContext.repository.fileFilter;
        const startDate = svnContext.repository.startDate;
        const endDate = svnContext.repository.endDate;

        vscode.commands.executeCommand('setContext', 'svn-ij-history:isFiltered', filtered);

        svnContext.historyView.title = 'History';
        const commitInfo = filtered ? `${count} of ${total} commits` : `${total} commits`;
        const fileName = fileFilter ? path.basename(fileFilter) : '';

        // Date info
        let dateInfo = '';
        if (startDate) {
            const formatDate = (d: Date) => {
                const day = d.getDate().toString().padStart(2, '0');
                const month = (d.getMonth() + 1).toString().padStart(2, '0');
                const year = d.getFullYear();
                return `${day}/${month}/${year}`;
            };
            dateInfo = (startDate.getTime() === endDate?.getTime())
                ? `[${formatDate(startDate)}]`
                : `[${formatDate(startDate)} to ${endDate ? formatDate(endDate) : 'HEAD'}]`;
        }

        let description = fileName ? `${fileName} • ${commitInfo}` : commitInfo;
        if (dateInfo) {
            description = `${dateInfo} ${description}`;
        }
        svnContext.historyView.description = description;
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
            } else if (item.isLoadMore) {
                vscode.commands.executeCommand('svn-ij-history.loadMore');
                // Clear selection to allow immediate repeat clicks
                setTimeout(() => {
                    (svnContext.historyView as any).selection = [];
                }, 100);
            }
        }
    });
}

export function deactivate(): void {
    // Cleanup is handled via context.subscriptions in SvnContext/Commands
}