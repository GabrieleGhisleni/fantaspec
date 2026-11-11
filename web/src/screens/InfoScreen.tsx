import type { ReactNode } from "react";

function Item({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Static help: what the screens show and how to read the numbers. */
export function InfoScreen() {
  return (
    <section className="info" id="info">
      <h1 className="page-title">Come leggere i dati</h1>
      <p className="muted">
        Fantacalcio Serie A, modalità Classic con bonus standard. Per ogni giocatore della rosa: voti, disponibilità e
        statistiche del suo club e del prossimo avversario.
      </p>

      <h2 className="group-title">Riga del giocatore</h2>
      <dl className="glossary">
        <Item term="P · D · C · A">Ruolo: portiere, difensore, centrocampista, attaccante.</Item>
        <Item term="tit. 85%">
          Probabilità di giocare titolare secondo le probabili formazioni. Verde da 75% in su, rossa sotto 50%.
          Compare solo quando le formazioni sono state pubblicate (di solito a metà settimana).
        </Item>
        <Item term="Etichetta di stato">
          Infortunato, squalificato, in dubbio o diffidato (un giallo dalla squalifica). Toccando la riga trovi il
          dettaglio e la data di rientro, se nota.
        </Item>
        <Item term="Prossima partita">
          Il club del giocatore con posizione in classifica e punti, poi il prossimo avversario con la stessa
          informazione. «in casa contro» se il club gioca in casa, «in trasferta a» se gioca fuori.
        </Item>
        <Item term="Forma">
          Gli ultimi risultati del club del giocatore e di quello avversario (V vittoria, N pareggio, P sconfitta,
          dalla più vecchia alla più recente).
        </Item>
        <Item term="Gol a partita (fatti / subiti)">
          Medie stagionali per partita dei due club: quanti gol segnano e quanti ne subiscono. Il primo numero di ogni
          coppia sono i gol segnati, il secondo quelli subiti.
        </Item>
        <Item term="Gol · Assist · Presenze">
          Gol e assist del giocatore nella stagione, e le partite con voto. Per i portieri compaiono i gol subiti (in
          rosso, valgono come malus).
        </Item>
        <Item term="FV">
          Fantavoto mediano della stagione, cioè il voto con i bonus e malus. Si usa la mediana e non la media perché
          un singolo 9 o un 3 non la sposta. «–» se il giocatore non ha ancora voti.
        </Item>
        <Item term="avv. segna / avv. subisce">
          La sfida. Per portieri e difensori: gol segnati a partita dall'avversario (meno sono, meglio è). Per
          centrocampisti e attaccanti: gol subiti a partita dall'avversario (più sono, meglio è). Il colore confronta
          l'avversario con tutte le 20 squadre: verde il terzo più favorevole, rosso il meno favorevole.
        </Item>
      </dl>

      <h2 className="group-title">Schermata</h2>
      <dl className="glossary">
        <Item term="Filtri e ordine">
          I pulsanti P D C A filtrano per ruolo. «Ordina» sceglie fra ruolo, titolarità, FV mediana e avversario favorevole (il più favorevole prima).
        </Item>
        <Item term="Partite della giornata">
          Le partite delle squadre dei tuoi giocatori, una scheda per partita. Ogni scheda confronta i due club: la
          stagione, poi solo questa partita (gol in casa e in trasferta) e i precedenti.
        </Item>
        <Item term="Rose">Crei e modifichi le rose, le condividi con un link e importi quelle degli amici. Restano su questo dispositivo.</Item>
      </dl>

      <h2 className="group-title">Da dove arrivano i dati</h2>
      <p>
        Voti, formazioni e indisponibili vengono da fantacalcio.it; calendario, risultati e classifica da ESPN. Il
        sito si aggiorna da solo: più volte nei giorni di partita, una volta al giorno nel resto della settimana.
        «Aggiornato» in alto indica l'ultima volta in cui i dati sono cambiati; se l'ultimo tentativo è fallito compare
        un avviso rosso e restano i dati precedenti.
      </p>
      <p className="muted">Dati non ufficiali: possono essere incompleti o in ritardo. Decidi sempre con le notizie dell'ultima ora.</p>
    </section>
  );
}
