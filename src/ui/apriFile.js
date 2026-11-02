import { toast } from '../stato.js';
import { linkFile } from '../lib/dati.js';

export async function apriFile(doc) {
  // la finestra si apre subito (iPhone blocca le aperture dopo un'attesa), poi riceve il link
  const finestra = window.open('', '_blank');
  try {
    const url = await linkFile(doc.percorso);
    if (finestra) finestra.location = url; else location.href = url;
  } catch (e) {
    finestra?.close();
    toast(`Errore: ${e.message}`, 'ko');
  }
}
