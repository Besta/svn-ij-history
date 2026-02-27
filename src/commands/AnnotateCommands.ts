import * as vscode from 'vscode';
import { SvnContext } from '../utils/SvnContext';

export class AnnotateCommands {
    constructor(private context: SvnContext) { }

    public register(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.toggleAnnotate', async (arg?: any) => {
                const editor = vscode.window.activeTextEditor;
                let targetUri: vscode.Uri | undefined;

                if (arg instanceof vscode.Uri) {
                    targetUri = arg;
                } else if (arg && typeof arg === 'object' && arg.uri instanceof vscode.Uri) {
                    targetUri = arg.uri;
                } else {
                    targetUri = editor?.document.uri;
                }

                if (targetUri && targetUri.scheme === 'file') {
                    await this.context.annotateDecorator.toggleAnnotate(targetUri);
                    this.updateAnnotateContext(editor);
                } else {
                    vscode.window.showErrorMessage('Please open a local file to use SVN Annotate.');
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.showAnnotate', (uri?: vscode.Uri) => {
                return vscode.commands.executeCommand('svn-ij-history.toggleAnnotate', uri);
            }),
            vscode.commands.registerCommand('svn-ij-history.hideAnnotate', (uri?: vscode.Uri) => {
                return vscode.commands.executeCommand('svn-ij-history.toggleAnnotate', uri);
            })
        );

        // Update decorations and context when active editor changes
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(async (editor) => {
                this.updateAnnotateContext(editor);
                if (editor) {
                    await this.context.annotateDecorator.updateDecorations(editor);
                }
            })
        );
    }

    private updateAnnotateContext(editor?: vscode.TextEditor) {
        const isActive = editor ? this.context.annotateDecorator.isEnabled(editor.document.uri) : false;
        vscode.commands.executeCommand('setContext', 'svn-ij-history:isAnnotateActive', isActive);
    }
}
