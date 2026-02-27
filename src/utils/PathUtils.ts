import * as path from 'path';

/**
 * Utility class for SVN and filesystem path manipulation.
 * Centralizes regex logic for cleaning repo paths and converting them to FS paths.
 */
export class PathUtils {
    /**
     * Removes standard SVN prefixes like /trunk/, /branches/name/, or /tags/name/.
     * @param repoPath The full path from the SVN repository.
     * @returns The relative path within the project.
     */
    public static cleanRepoPath(repoPath: string): string {
        return repoPath.replace(/^\/(trunk|branches\/[^/]+|tags\/[^/]+)\//, '');
    }

    /**
     * Converts a repository path to an absolute filesystem path.
     * @param repoPath The full path from the SVN repository.
     * @param workspaceRoot The local workspace root.
     * @returns The corresponding absolute filesystem path.
     */
    public static toFsPath(repoPath: string, workspaceRoot: string): string {
        const relativePath = this.cleanRepoPath(repoPath);
        return path.join(workspaceRoot, path.normalize(relativePath));
    }

    /**
     * Gets the directory part of a cleaned repository path.
     * @param repoPath The full path from the SVN repository.
     * @returns The directory path, or an empty string if in root.
     */
    public static getDirPath(repoPath: string): string {
        const normalized = path.normalize(this.cleanRepoPath(repoPath));
        const lastSep = normalized.lastIndexOf(path.sep);
        return lastSep === -1 ? '' : normalized.substring(0, lastSep);
    }
}
