import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsv, readSheetFile, repairMojibake } from './sheets';
import { candidateToDraft, categoryFromType, parseDate, parseImdbRows, statusFromCell } from './imdb';
import type { Item } from '../model/types';

const CSV = `Position,Const,Created,Modified,Description,Title,Original Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt14317880,2022-05-21,2022-05-21,,"Coupez !",Coupez!,https://www.imdb.com/title/tt14317880/,Movie,6.3,112,2022,"Comedy, Horror",5863,2022-05-17,Michel Hazanavicius,,
2,tt7908628,2023-01-02,2023-01-02,,"Only Murders in the Building",,https://www.imdb.com/title/tt7908628/,TV Series,8.1,30,2021,"Comedy, Crime",100,2021-08-31,,8,2023-02-01
3,tt14317880,2022-05-21,2022-05-21,,"Coupez !",Coupez!,https://www.imdb.com/title/tt14317880/,Movie,6.3,112,2022,Comedy,5863,2022-05-17,Michel Hazanavicius,,
`;

describe('accents abîmés par Excel', () => {
  it('répare « SÃ©rie tÃ©lÃ©visÃ©e » et l’apostrophe typographique', () => {
    expect(repairMojibake('SÃ©rie tÃ©lÃ©visÃ©e')).toBe('Série télévisée');
    expect(repairMojibake('Lâ€™Ã‰tranger')).toBe('L’Étranger');
    expect(repairMojibake('Déjà correct')).toBe('Déjà correct');
  });
});

describe('lecture CSV', () => {
  it('gère guillemets, virgules dans une cellule et lignes vides', () => {
    const rows = parseCsv('a,b\n"x, y","il dit ""oui"""\n\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'il dit "oui"']]);
  });
  it('détecte le point-virgule (Excel français)', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('export IMDb', () => {
  it('reconnaît films et séries, en anglais comme en français', () => {
    expect(categoryFromType('Movie')).toBe('film');
    expect(categoryFromType('TV Mini Series')).toBe('serie');
    expect(categoryFromType('Série télévisée')).toBe('serie');
    expect(categoryFromType('Mini-série télévisée')).toBe('serie');
    expect(categoryFromType('Téléfilm')).toBe('film');
  });
  it('lit la colonne de statut ajoutée à la main', () => {
    expect(statusFromCell('EN COURs', 'serie')).toBe('en_cours');
    expect(statusFromCell('en cours', 'film')).toBe('a_decouvrir'); // « en cours » réservé aux séries
    expect(statusFromCell('', 'film')).toBe('a_decouvrir');
    expect(statusFromCell('Vu', 'film')).toBe('termine');
  });
  it('convertit les dates Excel', () => {
    expect(parseDate('44562')?.slice(0, 10)).toBe('2022-01-01');
    expect(parseDate('44703')?.slice(0, 10)).toBe('2022-05-22');
    expect(parseDate('2022-05-21')?.slice(0, 10)).toBe('2022-05-21');
  });
  it('transforme les lignes, ignore les doublons du fichier, repère ceux déjà dans Culture', () => {
    const existing = [{ id: 'i_1', category: 'serie', title: 'Only Murders in the Building', year: 2021, source: { provider: 'manual', id: null, subtype: null } }] as unknown as Item[];
    const r = parseImdbRows(parseCsv(CSV), existing);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates).toHaveLength(2);
    expect(r.skipped).toBe(1);
    const [film, serie] = r.candidates;
    expect(film).toMatchObject({ imdbId: 'tt14317880', category: 'film', year: 2022, directors: 'Michel Hazanavicius', duplicateOf: null });
    expect(serie).toMatchObject({ category: 'serie', rating: 4, duplicateOf: 'i_1' });
    const draft = candidateToDraft(film!, [], [{ id: 't_c', name: 'comédie', color: '#000' }], true);
    expect(draft.tags).toEqual([]); // « Comedy » (anglais) ≠ « comédie »
    expect(draft.source).toMatchObject({ provider: 'imdb', imdbId: 'tt14317880' });
    expect(draft.addedAt?.slice(0, 10)).toBe('2022-05-21');
  });
  it('refuse un fichier qui n’est pas un export IMDb', () => {
    expect(parseImdbRows([['Nom', 'Prénom'], ['a', 'b']], [])).toMatchObject({ ok: false });
  });
});

// Test sur le vrai fichier de Robin s'il est présent sur la machine (jamais versionné).
const real = process.env.CULTURE_IMDB_FILE;
describe.runIf(!!real && existsSync(real))('fichier IMDb réel (.xlsx)', () => {
  it('lit toutes les lignes', async () => {
    const buf = readFileSync(real!);
    const rows = await readSheetFile({ name: real!, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
    const r = parseImdbRows(rows, []);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cands = r.candidates;
    const count = (f: (c: (typeof cands)[number]) => boolean) => cands.filter(f).length;
    console.log(`${r.candidates.length} titres · films ${count((c) => c.category === 'film')} · séries ${count((c) => c.category === 'serie')} · en cours ${count((c) => c.status === 'en_cours')} · ignorés ${r.skipped}`);
    console.log('exemple :', JSON.stringify(r.candidates.find((c) => c.status === 'en_cours')));
    expect(count((c) => c.category === 'serie')).toBe(50);
    expect(count((c) => c.status === 'en_cours')).toBe(5);
    expect(r.candidates.length).toBeGreaterThan(200);
  });
});
