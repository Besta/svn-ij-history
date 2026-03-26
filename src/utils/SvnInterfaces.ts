/**
 * Represents a single SVN commit entry with its metadata and affected files.
 */
export interface SvnCommit {
    /** Revision number (e.g., "1234") */
    rev: string;
    /** The username of the committer */
    author: string;
    /** Original Date object of the commit */
    date: Date;
    /** Formatted date string for UI display */
    displayDate: string;
    /** The commit message */
    msg: string;
    /** Categorization label (e.g., "Today", "Last Week") */
    groupLabel: string;
    /** List of files modified, added, or deleted in this revision */
    files: SvnCommitFile[];
}

export interface SvnCommitFile {
    action: string;
    path: string;
    kind?: string;
}

/**
 * Represents a single line in the SVN annotate output.
 */
export interface AnnotateLine {
    line: number;
    rev: string;
    author: string;
    date: Date;
}

/**
 * Strict typing for SVN Log XML output (fast-xml-parser)
 */
export interface SvnLogXml {
    log: {
        logentry: SvnLogEntryXml | SvnLogEntryXml[];
    };
}

export interface SvnLogEntryXml {
    revision: string | number;
    author?: string;
    date?: string;
    msg?: string;
    paths?: {
        path: SvnPathXml | SvnPathXml[];
    };
}

export interface SvnPathXml {
    action: string;
    kind?: string;
    '#text': string;
}

/**
 * Strict typing for SVN Info XML output
 */
export interface SvnInfoXml {
    info: {
        entry: {
            repository: {
                root: string;
            };
        };
    };
}

/**
 * Strict typing for SVN Annotate XML output
 */
export interface SvnAnnotateXml {
    blame: {
        target: {
            entry: SvnAnnotateEntryXml | SvnAnnotateEntryXml[];
        };
    };
}

export interface SvnAnnotateEntryXml {
    'line-number': string | number;
    commit: {
        revision: string | number;
        author?: string;
        date: string;
    };
}

/**
 * Strict typing for SVN Status XML output
 */
export interface SvnStatusXml {
    status?: {
        target?: {
            entry?: SvnStatusEntryXml | SvnStatusEntryXml[];
            changelist?: SvnChangelistXml | SvnChangelistXml[];
        };
        changelist?: SvnChangelistXml | SvnChangelistXml[];
    };
}

export interface SvnChangelistXml {
    name: string;
    entry: SvnStatusEntryXml | SvnStatusEntryXml[];
}

export interface SvnStatusEntryXml {
    path: string;
    'wc-status'?: {
        item: string;
    };
}

/**
 * Strict typing for SVN List XML output
 */
export interface SvnListXml {
    lists: {
        list: {
            entry?: SvnListEntryXml | SvnListEntryXml[];
        };
    };
}

export interface SvnListEntryXml {
    kind: string; // "dir" or "file"
    name: string;
    commit?: {
        revision: string | number;
        author?: string;
        date?: string;
    };
}

export interface SvnListEntry {
    kind: 'dir' | 'file';
    name: string;
    revision?: string;
    author?: string;
    date?: Date;
}
