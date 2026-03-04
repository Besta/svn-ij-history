import * as vscode from 'vscode';
import { SvnContext } from '../utils/SvnContext';

export class AnnotateCommands {
    constructor(private context: SvnContext) { }

    public register(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('svn-ij-history.toggleAnnotate', async () => {
                const editor = vscode.window.activeTextEditor;
                if (editor && editor.document.uri.scheme === 'file') {
                    await this.context.annotateDecorator.toggleAnnotate(editor.document.uri);
                    this.updateAnnotateContext(editor);
                } else {
                    vscode.window.showErrorMessage('Please focus a local file to use SVN Annotate.');
                }
            }),
            vscode.commands.registerCommand('svn-ij-history.showAnnotate', () => {
                return vscode.commands.executeCommand('svn-ij-history.toggleAnnotate');
            }),
            vscode.commands.registerCommand('svn-ij-history.hideAnnotate', () => {
                return vscode.commands.executeCommand('svn-ij-history.toggleAnnotate');
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

        // Initial update
        this.updateAnnotateContext(vscode.window.activeTextEditor);
    }

    private updateAnnotateContext(editor?: vscode.TextEditor) {
        const isActive = editor ? this.context.annotateDecorator.isEnabled(editor.document.uri) : false;
        vscode.commands.executeCommand('setContext', 'svn-ij-history:isAnnotateActive', isActive);
    }
}
