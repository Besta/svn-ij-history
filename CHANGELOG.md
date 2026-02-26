# Changelog

Tutti i cambiamenti significativi a questo progetto saranno documentati in questo file.

## [1.0.1] - 2026-02-26

### Fixed
- **Compatibility**: Allineate le dipendenze di sviluppo (`@types/vscode`) con i requisiti del motore di VS Code (`engines`).
- **Build Process**: Corretti i riferimenti nel `package.json` per risolvere l'errore `ETARGET` durante l'installazione dei moduli npm.
- **Publisher Identity**: Ottimizzato l'ID del publisher per la conformità con il Marketplace di Visual Studio.

---

## [1.0.0] - 2026-02-26

### 🚀 Release Iniziale
Siamo lieti di annunciare la prima versione ufficiale di **SVN IJ History**! Questa estensione nasce per colmare il divario tra l'esperienza di navigazione della cronologia di IntelliJ e Visual Studio Code.

#### Caratteristiche principali:
- **Interfaccia Timeline**: Visualizzazione dei commit raggruppati in modo intelligente per periodi temporali (Oggi, Ieri, Settimana scorsa, ecc.).
- **Pannello Dettagli Side-by-Side**: Un'area dedicata e ridimensionabile per ispezionare i dettagli del commit e la lista dei file modificati senza perdere la posizione nell'elenco principale.
- **Integrazione Diff Nativa**: Possibilità di confrontare le revisioni dei file con un solo click utilizzando l'editor diff integrato di VS Code.
- **Filtro Avanzato**: Barra di ricerca rapida per filtrare istantaneamente i commit per autore, messaggio o numero di revisione.
- **Navigazione nel Workspace**: Comandi rapidi per aprire i file nel workspace locale o rivelarli nell'esplora risorse partendo da un commit SVN.
- **Gestione Performance**: Caricamento incrementale (50 commit alla volta) per garantire fluidità anche su repository con cronologie molto lunghe.
- **Persistenza dello Stato**: L'estensione ricorda i tuoi dati, la selezione e il filtro di ricerca anche se cambi pannello laterale o chiudi temporaneamente la vista.