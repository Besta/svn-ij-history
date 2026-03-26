import * as vscode from 'vscode';
import { SvnContext } from '../utils/SvnContext';

export class CheckoutCommands {
    constructor(private svnContext: SvnContext) {}

    public register(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.checkout', () => this.interactiveCheckout())
        );
    }

    private async interactiveCheckout(): Promise<void> {
        const historyKey = 'svnCheckoutHistory';
        let history: string[] = this.svnContext.extensionContext.globalState.get(historyKey, []);

        const quickPickItemsInit: vscode.QuickPickItem[] = [
            { label: '$(add) Enter new SVN URL...', alwaysShow: true }
        ];

        history.forEach(url => {
            quickPickItemsInit.push({ label: `$(repo) ${url}`, description: 'Saved URL' });
        });

        const selectedInit = await vscode.window.showQuickPick(quickPickItemsInit, {
            placeHolder: 'Select a saved SVN URL or enter a new one',
            ignoreFocusOut: true
        });

        if (!selectedInit) {
            return;
        }

        let currentUrl: string | undefined;

        if (selectedInit.label === '$(add) Enter new SVN URL...') {
            currentUrl = await vscode.window.showInputBox({
                prompt: 'Enter SVN Repository URL to checkout',
                placeHolder: 'e.g. https://svn.example.com/repo/trunk',
                ignoreFocusOut: true
            });
        } else {
            currentUrl = selectedInit.label.replace('$(repo) ', '');
        }

        if (!currentUrl) {
            return; // Cancelled
        }

        const initialUrl = currentUrl;
        let hasSavedHistory = false;

        while (true) {
            try {
                // Fetch the list of subdirectories
                const entries = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Fetching SVN directory: ${currentUrl}`,
                    cancellable: false
                }, async () => {
                    return await this.svnContext.svnService.listRemoteDirectories(currentUrl!);
                });

                if (!hasSavedHistory) {
                    // Save the initial URL to history on first successful connection
                    history = history.filter(u => u !== initialUrl);
                    history.unshift(initialUrl);
                    if (history.length > 15) {history.pop();}
                    await this.svnContext.extensionContext.globalState.update(historyKey, history);
                    hasSavedHistory = true;
                }

                const quickPickItems: vscode.QuickPickItem[] = [];

                // 1. Action: Checkout the current directory
                quickPickItems.push({
                    label: '$(root-folder) [ Checkout this directory ]',
                    description: currentUrl,
                    detail: 'Proceed to select a local destination folder',
                    alwaysShow: true
                });

                // 2. Action: Go Up (if possible, rudimentary check)
                if (currentUrl.includes('/') && currentUrl.length > 10) {
                    quickPickItems.push({
                        label: '$(arrow-up) ..',
                        description: 'Go to parent directory',
                        alwaysShow: true
                    });
                }

                // 3. Subdirectories
                const dirs = entries.filter(e => e.kind === 'dir');
                for (const dir of dirs) {
                    quickPickItems.push({
                        label: `$(folder) ${dir.name}`,
                        description: dir.author ? `(Last modified by ${dir.author})` : ''
                    });
                }

                if (dirs.length === 0) {
                    quickPickItems.push({
                        label: '$(info) (No subdirectories found)'
                    });
                }

                const selected: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: `Select a folder to navigate or checkout: ${currentUrl}`,
                    ignoreFocusOut: true
                });

                if (!selected) {
                    return; // Cancelled
                }

                if (selected.label.includes('[ Checkout this directory ]')) {
                    // Chosen to checkout
                    break;
                } else if (selected.label.includes('$(arrow-up) ..')) {
                    // Navigate up
                    currentUrl = currentUrl.replace(/\/([^\/]*)\/?$/, '');
                } else if (selected.label.includes('$(folder)')) {
                    // Navigate down
                    const folderName: string = selected.label.replace('$(folder) ', '');
                    currentUrl = currentUrl.endsWith('/') ? `${currentUrl}${folderName}` : `${currentUrl}/${folderName}`;
                } else {
                    // e.g. "No subdirectories found"
                    // continue loop
                }
            } catch (err: unknown) {
                vscode.window.showErrorMessage(`SVN List Error: ${err instanceof Error ? err.message : err}`);
                return;
            }
        }

        // 4. Prompt for local destination
        const destinationUris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Checkout Destination',
            title: 'Select an empty folder for SVN checkout'
        });

        if (!destinationUris || destinationUris.length === 0) {
            return; // Cancelled
        }

        const destinationPathBase = destinationUris[0].fsPath;

        const checkoutFolderName = currentUrl!.split('/').filter(Boolean).pop() || 'svn-checkout';
        const optionDirect = `Checkout directly into selected folder`;
        const optionCreate = `Create subfolder '${checkoutFolderName}'`;

        const choiceFolder = await vscode.window.showQuickPick(
            [ { label: optionCreate }, { label: optionDirect } ],
            { placeHolder: 'How would you like to checkout?', ignoreFocusOut: true }
        );

        if (!choiceFolder) {
            return; // Cancelled
        }

        const finalDestinationUri = choiceFolder.label === optionCreate
            ? vscode.Uri.joinPath(destinationUris[0], checkoutFolderName)
            : destinationUris[0];
            
        const destinationPath = finalDestinationUri.fsPath;

        // 5. Perform checkout
        try {
            let isCancelled = false;
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Checking out SVN repository to ${destinationPath}...`,
                cancellable: true
            }, async (_, token) => {
                const controller = new AbortController();
                token.onCancellationRequested(() => {
                    isCancelled = true;
                    controller.abort();
                });
                try {
                    await this.svnContext.svnService.checkout(currentUrl!, destinationPath, controller.signal);
                } catch (err: unknown) {
                    if (err instanceof Error && err.name === 'AbortError' || isCancelled) {
                        return; // Handle silently for cancellation
                    }
                    throw err;
                }
            });

            if (isCancelled) {
                vscode.window.showWarningMessage('Checkout was cancelled.');
                return;
            }

            const choice = await vscode.window.showInformationMessage(
                'Checkout complete. Would you like to open the newly checked out folder?',
                'Open folder'
            );

            if (choice === 'Open folder') {
                vscode.commands.executeCommand('vscode.openFolder', finalDestinationUri, true);
            }
        } catch (err: unknown) {
             vscode.window.showErrorMessage(`SVN Checkout Error: ${err instanceof Error ? err.message : err}`);
        }
    }
}
