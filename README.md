# SVN IJ History for VS Code

Porta la potenza e la chiarezza della visualizzazione cronologia di IntelliJ direttamente dentro Visual Studio Code. Questa estensione ti permette di navigare nei commit SVN con un'interfaccia fluida, raggruppata per date e con un pannello dettagli contestuale.



## 🚀 Caratteristiche principali

* **Timeline Intelligente**: Commit raggruppati automaticamente per "Oggi", "Ieri", "Settimana scorsa", ecc.
* **Filtro Istantaneo**: Cerca rapidamente tra i commit per messaggio, autore o numero di revisione.
* **Pannello Dettagli Side-by-Side**: Visualizza i file modificati in un pannello laterale ridimensionabile senza perdere il segno nella lista.
* **Integrazione Nativa Diff**: Confronta le versioni dei file con un solo click utilizzando lo strumento di diff integrato di VS Code.
* **Navigazione Locale**: Salta direttamente al file nel tuo workspace partendo dalla cronologia SVN.
* **Caricamento Incrementale**: Gestisci repository enormi caricando 50 commit alla volta per massime performance.

## 🛠 Come si usa

1.  Apri la **barra laterale** o il **pannello inferiore** (a seconda di dove hai configurato la vista).
2.  Clicca sull'icona **SVN History**.
3.  Usa la **barra di ricerca** per filtrare i commit in tempo reale.
4.  Clicca su un commit per vedere i dettagli e i file modificati.
5.  Usa il tasto **Refresh** (↻) nella barra del titolo per cercare nuovi commit e resettare la vista.

## ⚙️ Requisiti

* **SVN CLI**: L'estensione richiede che il comando `svn` sia installato e configurato nel tuo `PATH`.
* **Workspace SVN**: L'estensione si attiva automaticamente se rileva un repository Subversion nel workspace aperto.

## 📦 Installazione

1.  Scarica il file `.vsix` dalle release (o installa dal Marketplace).
2.  In VS Code, vai nel pannello Estensioni (`Ctrl+Shift+X`).
3.  Clicca sui tre puntini (`...`) in alto a destra e seleziona **Install from VSIX...**.

---

### Sviluppato con ❤️ per chi non vuole rinunciare alla comodità di IntelliJ in VS Code.