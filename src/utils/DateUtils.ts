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

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return "Last Week";
        if (diffDays < 30) return "Last Month";
        
        // Fallback for older dates: e.g., "January 2026"
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    /**
     * Formats a date object into a concise string for the commit list.
     * @param date The date to format.
     * @returns A formatted string (e.g., "02/26/26, 10:21 AM").
     */
    public static formatDateTime(date: Date): string {
        return date.toLocaleString('en-US', { 
            day: '2-digit', 
            month: '2-digit', 
            year: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
    }
}