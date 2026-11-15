// Lecture minimale d'une archive ZIP (un fichier .xlsx en est une), sans dépendance :
// on lit le répertoire central, puis on décompresse avec DecompressionStream (navigateur et Node récents).

export async function readZipEntry(buf: ArrayBuffer, name: string): Promise<Uint8Array | null> {
  const v = new DataView(buf);
  const bytes = new Uint8Array(buf);
  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Fichier ZIP illisible.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Répertoire ZIP invalide.');
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const localOffset = v.getUint32(p + 42, true);
    const entryName = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (entryName === name) {
      const lNameLen = v.getUint16(localOffset + 26, true);
      const lExtraLen = v.getUint16(localOffset + 28, true);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = bytes.slice(start, start + compSize);
      if (method === 0) return data;
      if (method !== 8) throw new Error('Compression ZIP non gérée.');
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
