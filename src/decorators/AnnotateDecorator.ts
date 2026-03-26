import * as vscode from 'vscode';
import { SvnService } from '../utils/SvnService';
import { AnnotateLine } from '../utils/SvnInterfaces';

interface AnnotateState {
    originalData: AnnotateLine[];
    originalLinesText: string[];
    lineMapping: number[];
}

/**
 * Manages SVN Annotate decorations in the editor gutter.
 * Displays author name and revision on the left side of the code.
 */
export class AnnotateDecorator {
    private _authorDecorationTypes: Map<string, vscode.TextEditorDecorationType> = new Map();
    private _enabledFiles: Set<string> = new Set();
    private _state: Map<string, AnnotateState> = new Map();

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
        if (!editor) { return; }

        const uri = editor.document.uri;
        const fsPath = uri.fsPath;

        if (!this._enabledFiles.has(fsPath)) {
            return;
        }

        try {
            let state = this._state.get(fsPath);
            if (!state) {
                const annotateData = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "SVN History: Fetching Annotations...",
                    cancellable: false
                }, async () => {
                    return await this._svnService.getFileAnnotate(fsPath);
                });
                state = {
                    originalData: annotateData,
                    originalLinesText: editor.document.getText().split(/\r?\n/),
                    lineMapping: Array.from({length: editor.document.lineCount}, (_, i) => i)
                };
                this._state.set(fsPath, state);
            }

            // Organize decorations by revision to apply specific colors based on date rank
            const revisions = Array.from(new Set(state.originalData.map(b => b.rev))).sort((a, b) => {
                const dateA = state!.originalData.find(d => d.rev === a)?.date.getTime() || 0;
                const dateB = state!.originalData.find(d => d.rev === b)?.date.getTime() || 0;
                return dateA - dateB; // Oldest first
            });

            const revCount = revisions.length;
            const revToDecType: Map<string, vscode.TextEditorDecorationType> = new Map();
            const revToDecorations: Map<string, vscode.DecorationOptions[]> = new Map();

            // Calculate max lengths for fixed-width formatting
            let maxRevLen = 0;
            let maxAuthorLen = 0;
            state.originalData.forEach(b => {
                const rev = (b.rev === '0' || !b.rev) ? '' : b.rev;
                const author = (b.rev === '0' || !b.rev) ? '' : b.author;
                if (rev.length > maxRevLen) {maxRevLen = rev.length;}
                if (author.length > maxAuthorLen) {maxAuthorLen = author.length;}
            });

            const originalMap = new Map<number, AnnotateLine>();
            state.originalData.forEach(b => originalMap.set(b.line - 1, b));

            for (let lineIndex = 0; lineIndex < editor.document.lineCount; lineIndex++) {
                const origIndex = state.lineMapping[lineIndex];
                let b: AnnotateLine;
                if (origIndex !== undefined && origIndex !== -1 && origIndex < state.originalLinesText.length) {
                    if (editor.document.lineAt(lineIndex).text === state.originalLinesText[origIndex]) {
                        b = originalMap.get(origIndex) || { rev: '0', author: '', date: new Date(0), line: lineIndex + 1 };
                    } else {
                        b = { rev: '0', author: '', date: new Date(0), line: lineIndex + 1 };
                    }
                } else {
                    b = { rev: '0', author: '', date: new Date(0), line: lineIndex + 1 };
                }
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

                if (isUncommitted) {opacity = 0.5;} // Neutral for uncommitted

                if (!revToDecType.has(b.rev)) {
                    let decType = this._authorDecorationTypes.get(`rev-${b.rev}`);
                    if (!decType) {
                        const scheme = vscode.workspace.getConfiguration('svn-ij-history').get<string>('annotateColorScheme') || 'blue';
                        let color: string;
                        if (isUncommitted) {
                            color = 'var(--vscode-editorCodeLens-foreground)';
                        } else if (scheme === 'rainbow') {
                            const hue = Math.floor((revIndex / (revCount > 1 ? revCount - 1 : 1)) * 360);
                            color = `hsla(${hue}, 70%, 50%, ${opacity.toFixed(2)})`;
                        } else if (scheme === 'heatmap') {
                            // Cold (blue) to Hot (red)
                            const hue = Math.floor(240 - ((revIndex / (revCount > 1 ? revCount - 1 : 1)) * 240));
                            color = `hsla(${hue}, 80%, 50%, ${opacity.toFixed(2)})`;
                        } else {
                            color = `rgba(0, 122, 204, ${opacity.toFixed(2)})`;
                        }
                        
                        decType = vscode.window.createTextEditorDecorationType({
                            before: {
                                margin: '0 1.5em 0 0',
                                color: color,
                                fontWeight: 'normal'
                            },
                            rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen
                        });
                        this._authorDecorationTypes.set(`rev-${b.rev}`, decType);
                    }
                    revToDecType.set(b.rev, decType);
                    revToDecorations.set(b.rev, []);
                }

                const hover = isUncommitted ? new vscode.MarkdownString('**Uncommitted Change**') :
                    new vscode.MarkdownString(`### r${b.rev}\n\n**Author:** ${b.author}\n\n**Date:** ${b.date.toLocaleString()}\n\n[➜ Show Details in History Panel](command:svn-ij-history.openCommitDetails?${encodeURIComponent(JSON.stringify([b.rev, true]))})`);
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
            }

            // Apply decorations once per revision
            this._authorDecorationTypes.forEach((decType, revKey) => {
                const rev = revKey.replace('rev-', '');
                const decs = revToDecorations.get(rev) || [];
                editor.setDecorations(decType, decs);
            });
        } catch (err) {
            console.error('Annotate Error:', err);
        }
    }

    /**
     * Handles text document changes to shift or clear annotations on edited lines.
     */
    public handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        const fsPath = event.document.uri.fsPath;
        if (!this._enabledFiles.has(fsPath)) {return;}

        let state = this._state.get(fsPath);
        if (!state) {return;}

        for (const change of event.contentChanges) {
            const startLine = change.range.start.line;
            const endLine = change.range.end.line;
            const linesDeleted = endLine - startLine;
            const linesAdded = change.text.split('\n').length - 1;

            if (linesDeleted === 0 && linesAdded === 0) {
                // Modified on a single line
                continue;
            }

            state.lineMapping.splice(startLine, linesDeleted);
            for (let k = 0; k < linesAdded; k++) {
                state.lineMapping.splice(startLine + k, 0, -1);
            }
        }

        // Heal -1 mappings logically just in case of simple Undos that the text diff can fix
        let i = 0;
        while (i < state.lineMapping.length) {
            if (state.lineMapping[i] === -1) {
                let j = i;
                while (j < state.lineMapping.length && state.lineMapping[j] === -1) {
                    j++;
                }
                const L = j - i;
                const prevOrig = i > 0 ? state.lineMapping[i - 1] : -1;
                const nextOrig = j < state.lineMapping.length ? state.lineMapping[j] : state.originalLinesText.length;

                // Try forward heal
                let forwardMatch = true;
                if (prevOrig !== -1 && prevOrig + L < nextOrig) {
                    for (let k = 0; k < L; k++) {
                        if (event.document.lineAt(i + k).text !== state.originalLinesText[prevOrig + 1 + k]) {
                            forwardMatch = false; break;
                        }
                    }
                    if (forwardMatch) {
                        for (let k = 0; k < L; k++) {state.lineMapping[i + k] = prevOrig + 1 + k;}
                    }
                } else {
                    forwardMatch = false;
                }

                // Try backward heal if forward didn't match
                if (!forwardMatch && nextOrig !== state.originalLinesText.length && nextOrig - L > prevOrig) {
                    let backwardMatch = true;
                    for (let k = 0; k < L; k++) {
                        if (event.document.lineAt(i + k).text !== state.originalLinesText[nextOrig - L + k]) {
                            backwardMatch = false; break;
                        }
                    }
                    if (backwardMatch) {
                        for (let k = 0; k < L; k++) {state.lineMapping[i + k] = nextOrig - L + k;}
                    }
                }
                i = j;
            } else {
                i++;
            }
        }

        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === event.document) {
            this.updateDecorations(editor);
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
