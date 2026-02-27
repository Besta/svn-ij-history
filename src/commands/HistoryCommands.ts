import * as vscode from 'vscode';
import { SvnContext } from '../utils/SvnContext';

export class HistoryCommands {
    constructor(private context: SvnContext) { }

    public register(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.refresh', () => {
                this.context.historyProvider.refresh();
            }),
            vscode.commands.registerCommand('svn-ij-history.clearFilter', () => {
                this.context.repository.clearFilters();
            }),
            vscode.commands.registerCommand('svn-ij-history.loadMore', () => {
                this.context.repository.loadMore();
            }),
            vscode.commands.registerCommand('svn-ij-history.search', async () => {
                const val = await vscode.window.showInputBox({
                    placeHolder: 'Search by message, author, or revision...',
                    prompt: 'Filter the current commit list'
                });
                if (val !== undefined) {
                    this.context.repository.setSearchValue(val);
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.filterUser', async () => {
                const users = await this.context.repository.fetchRecentAuthors(200);
                if (users.length === 0) {
                    vscode.window.showInformationMessage('No authors found in recent history.');
                    return;
                }

                const selected = await vscode.window.showQuickPick(users, {
                    placeHolder: 'Select an author from recent 200 commits'
                });

                if (selected) {
                    this.context.repository.setSearchValue(selected);
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.showFileHistory', async (fileUri?: vscode.Uri) => {
                const targetUri = fileUri || vscode.window.activeTextEditor?.document.uri;
                if (targetUri && targetUri.scheme === 'file') {
                    await this.context.repository.showFileHistory(targetUri.fsPath);
                } else {
                    vscode.window.showErrorMessage('Please select a local file to show history.');
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.openCommitDetails', async (rev: string) => {
                await vscode.commands.executeCommand('setContext', 'svn-ij-history:hasCommitSelected', true);
                const commit = await this.context.svnService.getCommit(rev);
                if (commit) {
                    this.context.detailsProvider.setCommit(commit);
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.clearDetails', () => {
                vscode.commands.executeCommand('setContext', 'svn-ij-history:hasCommitSelected', false);
                this.context.detailsProvider.clear();
            })
        );
    }
}
