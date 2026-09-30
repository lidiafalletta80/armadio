// Foto: si riducono sul telefono prima di salvarle o di mandarle a Claude (più veloce, meno spazio).

/** Ridimensiona una foto (il lato lungo diventa `lato` pixel al massimo) e la ritorna come JPEG. */
export async function riduci(file, { lato = 1024, qualita = 0.82 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error('immagine-non-leggibile'));
      i.src = url;
    });
    const scala = Math.min(1, lato / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scala));
    c.height = Math.max(1, Math.round(img.naturalHeight * scala));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; // i PNG trasparenti diventano bianchi, non neri
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('immagine-non-leggibile'))), 'image/jpeg', qualita));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Una foto in base64 (senza il prefisso data:), pronta per la richiesta a Claude. */
export function blobADati(blob) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => no(r.error);
    r.readAsDataURL(blob);
  });
}

/** Il contrario: dal base64 di un backup si torna alla foto. */
export function daDati(base64, tipo = 'image/jpeg') {
  const bin = atob(base64);
  const byte = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) byte[i] = bin.charCodeAt(i);
  return new Blob([byte], { type: tipo });
}
