import * as vscode from 'vscode';
import { SvnService } from './SvnService';
import { SvnRepository } from './SvnRepository';
import { AnnotateDecorator } from '../decorators/AnnotateDecorator';
import { SvnHistoryTreeProvider } from '../providers/SvnHistoryTreeProvider';
import { SvnDetailsTreeProvider } from '../providers/SvnDetailsTreeProvider';

/**
 * Dependency Injection container for the extension.
 * Manages the lifecycle and access to services and providers.
 */
export class SvnContext implements vscode.Disposable {
    public readonly svnService: SvnService;
    public readonly repository: SvnRepository;
    public readonly annotateDecorator: AnnotateDecorator;
    public readonly historyProvider: SvnHistoryTreeProvider;
    public readonly detailsProvider: SvnDetailsTreeProvider;
    public readonly historyView: vscode.TreeView<any>;
    public readonly detailsView: vscode.TreeView<any>;

    constructor(
        public readonly extensionContext: vscode.ExtensionContext,
        public readonly workspaceRoot: string
    ) {
        this.svnService = new SvnService(workspaceRoot);
        this.repository = new SvnRepository(this.svnService);
        this.annotateDecorator = new AnnotateDecorator(this.svnService);
        this.historyProvider = new SvnHistoryTreeProvider(this.repository);
        this.detailsProvider = new SvnDetailsTreeProvider(this.svnService);

        this.historyView = vscode.window.createTreeView('svn-ij-history.history-tree', {
            treeDataProvider: this.historyProvider
        });
        this.detailsView = vscode.window.createTreeView('svn-ij-history.details-tree', {
            treeDataProvider: this.detailsProvider
        });

        extensionContext.subscriptions.push(this);
    }

    public dispose() {
        this.historyView.dispose();
        this.detailsView.dispose();
        this.annotateDecorator.dispose();
    }
}
