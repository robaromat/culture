import { readZipEntry } from './zip';

// Lecture d'un tableau : CSV (export IMDb d'origine) ou Excel .xlsx (le même fichier retouché dans Excel).
// Renvoie des lignes de cellules texte ; la première ligne est l'en-tête.

/** CSV selon la RFC 4180 : guillemets, guillemets doublés, retours à la ligne dans une cellule. Séparateur , ou ; détecté. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.indexOf('\n') >>> 0);
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const unescapeXml = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    if (k === 'amp') return '&';
    return String.fromCodePoint(k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  });

const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1]!)).join('');

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.match(/^[A-Z]+/)![0]) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

/** Première feuille d'un .xlsx. Les dates Excel restent des nombres (jours depuis 1899-12-30). */
export async function parseXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const dec = new TextDecoder();
  const sheetBytes = await readZipEntry(buf, 'xl/worksheets/sheet1.xml');
  if (!sheetBytes) throw new Error('Pas de feuille de calcul dans ce fichier.');
  const ssBytes = await readZipEntry(buf, 'xl/sharedStrings.xml');
  const shared = ssBytes ? [...dec.decode(ssBytes).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!)) : [];
  const rows: string[][] = [];
  for (const rm of dec.decode(sheetBytes).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]!;
      const body = cm[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val = '';
      if (type === 's' && v !== undefined) val = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') val = textOf(body);
      else if (v !== undefined) val = unescapeXml(v);
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push('');
      row[idx] = val;
    }
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

// Accents abîmés (« SÃ©rie tÃ©lÃ©visÃ©e ») : un CSV UTF-8 ouvert dans Excel comme du Windows-1252.
// On refait le chemin inverse : caractères → octets Windows-1252 → texte UTF-8.
const CP1252: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88,
  0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93,
  0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
const MOJIBAKE = /[ÃÂâÅÆ][\u0080-¿Œ-™]/;

export function repairMojibake(s: string): string {
  if (!MOJIBAKE.test(s)) return s;
  const bytes: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const b = c < 0x100 ? c : CP1252[c];
    if (b === undefined) return s; // pas du Windows-1252 : on n'y touche pas
    bytes.push(b);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    return s;
  }
}

export async function readSheetFile(file: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const isZip = new Uint8Array(buf.slice(0, 2))[0] === 0x50 && new Uint8Array(buf.slice(0, 2))[1] === 0x4b; // « PK »
  const rows = isZip || /\.xlsx$/i.test(file.name) ? await parseXlsx(buf) : parseCsv(new TextDecoder().decode(buf));
  return rows.map((r) => r.map(repairMojibake));
}
