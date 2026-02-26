import * as vscode from 'vscode';
import { SvnService, BlameLine } from '../utils/SvnService';

/**
 * Manages SVN Blame (Annotate) decorations in the editor gutter.
 * Displays author name and revision on the left side of the code.
 */
export class BlameDecorator {
    private _authorDecorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private _enabledFiles: Set<string> = new Set();
    private _cache: Map<string, BlameLine[]> = new Map();

    constructor(private _svnService: SvnService) { }

    /**
     * Toggles the blame annotations for a specific file.
     */
    public async toggleBlame(uri: vscode.Uri): Promise<void> {
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
        if (!editor) { return; }

        const uri = editor.document.uri;
        const fsPath = uri.fsPath;

        if (!this._enabledFiles.has(fsPath)) {
            this.clearDecorations(editor);
            return;
        }

        try {
            let blameData = this._cache.get(fsPath);
            if (!blameData) {
                blameData = await this._svnService.getFileAnnotate(fsPath);
                this._cache.set(fsPath, blameData);
            }

            // Organize decorations by author to apply specific colors
            const decorationsByAuthor: Map<string, vscode.DecorationOptions[]> = new Map();

            blameData.forEach((b) => {
                const lineIndex = b.line - 1;
                if (lineIndex >= editor.document.lineCount) { return; }

                const range = new vscode.Range(lineIndex, 0, lineIndex, 0);

                // Format Date: dd/mm/yy
                const d = b.date;
                const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).substring(2)}`;

                // Format: 123 Author dd/mm/yy
                const contentText = `${b.rev} ${b.author} ${dateStr}`;

                if (!decorationsByAuthor.has(b.author)) {
                    decorationsByAuthor.set(b.author, []);
                }

                const hover = new vscode.MarkdownString(`### r${b.rev}\n\n**Author:** ${b.author}\n\n**Date:** ${b.date.toLocaleString()}\n\n[➜ Show Details in History Panel](command:svn-ij-history.openCommitDetails?${encodeURIComponent(JSON.stringify([b.rev]))})`);
                hover.isTrusted = true;
                hover.supportHtml = true;

                decorationsByAuthor.get(b.author)!.push({
                    range,
                    hoverMessage: hover,
                    renderOptions: {
                        before: {
                            contentText: contentText
                        }
                    }
                });
            });

            // Apply decorations for each author
            decorationsByAuthor.forEach((decs, author) => {
                const decType = this.getAuthorDecorationType(author);
                editor.setDecorations(decType, decs);
            });
        } catch (err) {
            console.error('Blame Error:', err);
        }
    }

    /**
     * Gets or creates a decoration type for a specific author with a unique color.
     */
    private getAuthorDecorationType(author: string): vscode.TextEditorDecorationType {
        if (this._authorDecorationTypes.has(author)) {
            return this._authorDecorationTypes.get(author)!;
        }

        // Generate a consistent color based on author name hash
        const hash = this.getHash(author);
        const hue = hash % 360;
        // Saturation 45%, Lightness 50% for good contrast
        const color = `hsl(${hue}, 45%, 50%)`;

        const decType = vscode.window.createTextEditorDecorationType({
            before: {
                margin: '0 1.5em 0 0',
                color: color,
                fontWeight: 'normal'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
        });

        this._authorDecorationTypes.set(author, decType);
        return decType;
    }

    private getHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    }

    /**
     * Removes all blame decorations from an editor.
     */
    public clearDecorations(editor?: vscode.TextEditor): void {
        if (editor) {
            this._authorDecorationTypes.forEach(decType => {
                editor.setDecorations(decType, []);
            });
        }
    }

    public dispose(): void {
        this._authorDecorationTypes.forEach(decType => decType.dispose());
        this._authorDecorationTypes.clear();
    }
}
