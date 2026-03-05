import * as vscode from 'vscode';
import { SvnService } from '../utils/SvnService';
import { AnnotateLine } from '../utils/SvnInterfaces';

/**
 * Manages SVN Annotate decorations in the editor gutter.
 * Displays author name and revision on the left side of the code.
 */
export class AnnotateDecorator {
    private _authorDecorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private _enabledFiles: Set<string> = new Set();
    private _cache: Map<string, AnnotateLine[]> = new Map();

    constructor(private _svnService: SvnService) { }

    /**
     * Checks if annotations are enabled for a specific URI.
     */
    public isEnabled(uri: vscode.Uri): boolean {
        return this._enabledFiles.has(uri.fsPath);
    }

    /**
     * Toggles the annotate annotations for a specific file.
     */
    public async toggleAnnotate(uri: vscode.Uri): Promise<void> {
        const fsPath = uri.fsPath;
        if (this._enabledFiles.has(fsPath)) {
            this._enabledFiles.delete(fsPath);
            this.clearDecorations(vscode.window.activeTextEditor);
        } else {
            this._enabledFiles.add(fsPath);
            await this.updateDecorations(vscode.window.activeTextEditor);
        }
    }

    /**
     * Refreshes decorations if the active editor changes or visibility is toggled.
     * @param editor The target text editor.
     */
    public async updateDecorations(editor?: vscode.TextEditor): Promise<void> {
        // Always dispose previous decoration types to avoid memory leaks
        this._authorDecorationTypes.forEach(decType => decType.dispose());
        this._authorDecorationTypes.clear();

        if (!editor) { return; }

        const uri = editor.document.uri;
        const fsPath = uri.fsPath;

        if (!this._enabledFiles.has(fsPath)) {
            return;
        }

        try {
            let annotateData = this._cache.get(fsPath);
            if (!annotateData) {
                annotateData = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "SVN History: Fetching Annotations...",
                    cancellable: false
                }, async () => {
                    return await this._svnService.getFileAnnotate(fsPath);
                });
                this._cache.set(fsPath, annotateData);
            }

            // Organize decorations by revision to apply specific colors based on date rank
            const revisions = Array.from(new Set(annotateData.map(b => b.rev))).sort((a, b) => {
                const dateA = annotateData.find(d => d.rev === a)?.date.getTime() || 0;
                const dateB = annotateData.find(d => d.rev === b)?.date.getTime() || 0;
                return dateA - dateB; // Oldest first
            });

            const revCount = revisions.length;
            const revToDecType: Map<string, vscode.TextEditorDecorationType> = new Map();
            const revToDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

            // Calculate max lengths for fixed-width formatting
            let maxRevLen = 0;
            let maxAuthorLen = 0;
            annotateData.forEach(b => {
                const rev = (b.rev === '0' || !b.rev) ? '' : b.rev;
                const author = (b.rev === '0' || !b.rev) ? '' : b.author;
                if (rev.length > maxRevLen) maxRevLen = rev.length;
                if (author.length > maxAuthorLen) maxAuthorLen = author.length;
            });

            annotateData.forEach((b) => {
                const lineIndex = b.line - 1;
                if (lineIndex >= editor.document.lineCount) { return; }

                const range = new vscode.Range(lineIndex, 0, lineIndex, 0);

                const isUncommitted = b.rev === '0' || !b.rev;

                // Format Date: dd/mm/yy or 8 non-breaking spaces for uncommitted
                let dateStr = '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0';
                if (!isUncommitted && b.date.getTime() > 0) {
                    const d = b.date;
                    dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).substring(2)}`;
                }

                const revText = (isUncommitted ? ''.padEnd(maxRevLen, '\u00a0') : b.rev).padEnd(maxRevLen + 1, '\u00a0');
                const authorText = (isUncommitted ? ''.padEnd(maxAuthorLen, '\u00a0') : b.author).padEnd(maxAuthorLen + 1, '\u00a0');

                // Format: 123 Author dd/mm/yy (with fixed padding)
                const contentText = `${revText}${authorText}${dateStr}`;

                const revIndex = revisions.indexOf(b.rev);
                let opacity = 1.0;
                if (revCount > 1) {
                    // Linear scale from 0.2 to 1.0 (refined from 0.1)
                    opacity = 0.2 + (0.8 * (revIndex / (revCount - 1)));
                }

                if (isUncommitted) opacity = 0.5; // Neutral for uncommitted

                if (!revToDecType.has(b.rev)) {
                    // VS Code Blue: #007acc is a good approximation of the classic blue
                    const color = isUncommitted ? 'var(--vscode-editorCodeLens-foreground)' : `rgba(0, 122, 204, ${opacity.toFixed(2)})`;
                    const decType = vscode.window.createTextEditorDecorationType({
                        before: {
                            margin: '0 1.5em 0 0',
                            color: color,
                            fontWeight: 'normal'
                        },
                        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
                    });
                    revToDecType.set(b.rev, decType);
                    revToDecorations.set(b.rev, []);
                    this._authorDecorationTypes.set(`rev-${b.rev}`, decType); // Repurpose existing map for cleanup
                }

                const hover = isUncommitted ? new vscode.MarkdownString('**Uncommitted Change**') :
                    new vscode.MarkdownString(`### r${b.rev}\n\n**Author:** ${b.author}\n\n**Date:** ${b.date.toLocaleString()}\n\n[➜ Show Details in History Panel](command:svn-ij-history.openCommitDetails?${encodeURIComponent(JSON.stringify([b.rev]))})`);
                hover.isTrusted = true;
                hover.supportHtml = true;

                revToDecorations.get(b.rev)!.push({
                    range,
                    hoverMessage: hover,
                    renderOptions: {
                        before: {
                            contentText: contentText
                        }
                    }
                });
            });

            // Apply decorations once per revision
            revToDecorations.forEach((decs, rev) => {
                const decType = revToDecType.get(rev);
                if (decType) {
                    editor.setDecorations(decType, decs);
                }
            });
        } catch (err) {
            console.error('Annotate Error:', err);
        }
    }

    /**
     * Removes all blame decorations from an editor and disposes decoration types.
     */
    public clearDecorations(editor?: vscode.TextEditor): void {
        this._authorDecorationTypes.forEach(decType => {
            if (editor) {
                editor.setDecorations(decType, []);
            }
            decType.dispose();
        });
        this._authorDecorationTypes.clear();
    }

    public dispose(): void {
        this._authorDecorationTypes.forEach(decType => decType.dispose());
        this._authorDecorationTypes.clear();
    }
}
