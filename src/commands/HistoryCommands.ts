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
            vscode.commands.registerCommand('svn-ij-history.filterDate', async () => {
                const options = [
                    { label: 'Select Date...', description: 'Show history for a single day (DD/MM/YYYY)' },
                    { label: 'Select Range...', description: 'Show history between two dates' },
                    { label: 'Clear Date Filter', description: 'Show all history' }
                ];

                const selected = await vscode.window.showQuickPick(options, {
                    placeHolder: 'Filter commits by date'
                });

                if (!selected) return;

                if (selected.label === 'Clear Date Filter') {
                    this.context.repository.setDateFilter(undefined, undefined);
                    return;
                }

                if (selected.label === 'Select Date...') {
                    const parseDate = (s: string) => {
                        const [d, m, y] = s.split('/').map(Number);
                        return new Date(y, m - 1, d);
                    };

                    const dateStr = await vscode.window.showInputBox({
                        placeHolder: 'DD/MM/YYYY',
                        prompt: 'Enter date to filter history',
                        validateInput: (val) => {
                            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return 'Invalid format. Use DD/MM/YYYY';
                            const [d, m, y] = val.split('/').map(Number);
                            const date = new Date(y, m - 1, d);
                            return isNaN(date.getTime()) ? 'Invalid date' : null;
                        }
                    });
                    if (dateStr) {
                        const date = parseDate(dateStr);
                        this.context.repository.setDateFilter(date, date);
                    }
                } else if (selected.label === 'Select Range...') {
                    const parseDate = (s: string) => {
                        const [d, m, y] = s.split('/').map(Number);
                        return new Date(y, m - 1, d);
                    };

                    const startStr = await vscode.window.showInputBox({
                        placeHolder: 'DD/MM/YYYY',
                        prompt: 'Enter START date (DD/MM/YYYY)',
                        validateInput: (val) => {
                            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return 'Invalid format. Use DD/MM/YYYY';
                            const [d, m, y] = val.split('/').map(Number);
                            const date = new Date(y, m - 1, d);
                            return isNaN(date.getTime()) ? 'Invalid date' : null;
                        }
                    });
                    if (!startStr) return;

                    const endStr = await vscode.window.showInputBox({
                        placeHolder: 'DD/MM/YYYY',
                        prompt: 'Enter END date (DD/MM/YYYY)',
                        validateInput: (val) => {
                            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return 'Invalid format. Use DD/MM/YYYY';
                            const [d, m, y] = val.split('/').map(Number);
                            const endDate = new Date(y, m - 1, d);
                            if (isNaN(endDate.getTime())) return 'Invalid date';
                            if (endDate < parseDate(startStr)) return 'End date must be after start date';
                            return null;
                        }
                    });
                    if (endStr) {
                        this.context.repository.setDateFilter(parseDate(startStr), parseDate(endStr));
                    }
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
