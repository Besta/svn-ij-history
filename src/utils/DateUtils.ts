/**
 * Utility class for date manipulation and formatting within the SVN history view.
 */
export class DateUtils {
    /**
     * Determines a human-readable group label based on the proximity of the date to today.
     * @param date The date to categorize.
     * @returns A string label such as "Today", "Yesterday", or "Last Month".
     */
    public static getGroupLabel(date: Date): string {
        const now = new Date();

        // Create "clean" dates (year, month, day only) at midnight for accurate day-diff calculation
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const commitDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        // Calculate the difference in solar days
        const diffTime = today.getTime() - commitDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) { return "Today"; }
        if (diffDays === 1) { return "Yesterday"; }
        if (diffDays < 7) { return "Last Week"; }
        if (diffDays < 30) { return "Last Month"; }

        // Fallback for older dates: e.g., "01/01/2026"
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    /**
     * Formats a date for the commit list, showing only time for today/yesterday.
     * @param date The date to format.
     * @param groupLabel The group label (e.g., "Today").
     */
    public static formatListDate(date: Date, groupLabel: string): string {
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (groupLabel === 'Today' || groupLabel === 'Yesterday') {
            return time;
        }
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}, ${time}`;
    }

    /**
     * Formats a date object into a concise string for the commit list.
     * @param date The date to format.
     * @returns A formatted string (e.g., "02/26/26, 10:21 AM").
     */
    public static formatDateTime(date: Date): string {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        return `${d}/${m}/${y}, ${time}`;
    }
}