export class DateUtils {
    public static getGroupLabel(date: Date): string {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Oggi";
        if (diffDays === 1) return "Ieri";
        if (diffDays < 7) return "Ultima Settimana";
        if (diffDays < 30) return "Ultimo Mese";
        
        return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    }

    public static formatDateTime(date: Date): string {
        return date.toLocaleString('it-IT', { 
            day: '2-digit', month: '2-digit', year: '2-digit', 
            hour: '2-digit', minute: '2-digit' 
        });
    }
}