import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class NpmInstallCheck {
    private static checkingFiles = new Set<string>();
    private static packageHashes = new Map<string, string>();

    public static activate(context: vscode.ExtensionContext): void {
        // Run once on startup
        this.checkNpmInstall();

        // Watch for external package.json changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/package.json');
        context.subscriptions.push(watcher);
        watcher.onDidChange(uri => this.checkFile(uri.fsPath));
    }

    private static async checkNpmInstall(): Promise<void> {
        // Find all package.json files in the workspace, excluding node_modules
        const files = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');
        for (const file of files) {
            this.checkFile(file.fsPath);
        }
    }

    private static checkFile(packageJsonPath: string): void {
        if (this.checkingFiles.has(packageJsonPath)) {
            return;
        }
        
        const dir = path.dirname(packageJsonPath);
        const nmLockPath = path.join(dir, 'node_modules', '.package-lock.json');
        const pkgLockPath = path.join(dir, 'package-lock.json');
        const nmPath = path.join(dir, 'node_modules');
        
        try {
            
            const pkgStat = fs.statSync(packageJsonPath);
            let needsInstall = false;
            let comparisonTarget = 'none';
            let targetMtime = 0;

            if (fs.existsSync(nmLockPath)) {
                // Typical npm 7+ behavior: node_modules/.package-lock.json is written at the end of every install
                const lockStat = fs.statSync(nmLockPath);
                comparisonTarget = 'node_modules/.package-lock.json';
                targetMtime = lockStat.mtimeMs;
            } else if (fs.existsSync(pkgLockPath) || fs.existsSync(packageJsonPath)) {
                // Fallback checks
                if (!fs.existsSync(nmPath)) {
                    // No node_modules folder at all = skip notification
                    comparisonTarget = 'missing node_modules';
                    needsInstall = false;
                } else {
                    const nmStat = fs.statSync(nmPath);
                    comparisonTarget = 'node_modules directory';
                    targetMtime = nmStat.mtimeMs;
                }
            }

            if (targetMtime > 0 && pkgStat.mtimeMs > targetMtime) {
                needsInstall = true;
            }

            // --- Dependency Hash Check ---
            const fileContent = fs.readFileSync(packageJsonPath, 'utf8');
            let depsString = '';
            try {
                const pkg = JSON.parse(fileContent);
                const depsInfo = {
                    dep: pkg.dependencies || {},
                    dev: pkg.devDependencies || {},
                    peer: pkg.peerDependencies || {},
                    opt: pkg.optionalDependencies || {}
                };
                depsString = JSON.stringify(depsInfo);
            } catch {
                // Invalid JSON fallback
                depsString = fileContent;
            }

            const currentHash = crypto.createHash('md5').update(depsString).digest('hex');
            const previousHash = this.packageHashes.get(packageJsonPath);

            if (previousHash && currentHash === previousHash) {
                needsInstall = false;
            }
            this.packageHashes.set(packageJsonPath, currentHash);
            // -----------------------------

            if (needsInstall) {
                this.checkingFiles.add(packageJsonPath);
                
                const message = path.dirname(packageJsonPath) === vscode.workspace.workspaceFolders?.[0].uri.fsPath 
                    ? 'The package.json in your workspace has been updated. Do you want to run npm install?'
                    : `The package.json in ${path.basename(dir)} has been updated. Do you want to run npm install?`;

                vscode.window.showInformationMessage(
                    message,
                    'Run npm install',
                    'Open package.json'
                ).then(selection => {
                    this.checkingFiles.delete(packageJsonPath);
                    if (selection === 'Run npm install') {
                        const terminalName = path.dirname(packageJsonPath) === vscode.workspace.workspaceFolders?.[0].uri.fsPath 
                            ? 'npm install'
                            : `npm install (${path.basename(dir)})`;
                            
                        const terminal = vscode.window.createTerminal(terminalName);
                        terminal.show();
                        terminal.sendText(`cd "${dir}" && npm install`);
                    } else if (selection === 'Open package.json') {
                        vscode.workspace.openTextDocument(packageJsonPath).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
            }
        } catch (err) {
            this.checkingFiles.delete(packageJsonPath);
            console.error('SVN-IJ History: Error checking npm install status:', err);
        }
    }
}
