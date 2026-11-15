import { describe, expect, it } from 'vitest';
import { GitHubError, readDataFile, writeDataFile } from './github';
import type { DataFile } from '../model/types';

// Test ponctuel contre le vrai dépôt, sur un fichier jetable (pas data.json). Lancé seulement si CULTURE_IT_TOKEN est défini.
const token = process.env.CULTURE_IT_TOKEN;
const ref = { token: token ?? '', owner: 'robaromat', repo: 'culture-data', path: 'test-sync.json' };
const sample: DataFile = {
  schemaVersion: 1,
  tags: [{ id: 't_x', name: 'à voir absolument', color: '#74303A' }],
  items: [],
};

describe.runIf(!!token)('GitHub (intégration)', () => {
  it('crée, relit (UTF-8), met à jour avec sha, et refuse un sha périmé', async () => {
    const sha1 = await writeDataFile(ref, sample, null, 'test: création');
    const r1 = await readDataFile(ref);
    expect(r1.sha).toBe(sha1);
    expect(r1.data.tags[0]?.name).toBe('à voir absolument');

    const next: DataFile = { ...sample, tags: [{ id: 't_y', name: 'Shōgun ✓ « test »', color: '#000000' }] };
    const sha2 = await writeDataFile(ref, next, sha1, 'test: mise à jour');
    expect(sha2).not.toBe(sha1);
    expect((await readDataFile(ref)).data.tags[0]?.name).toBe('Shōgun ✓ « test »');

    await expect(writeDataFile(ref, sample, sha1, 'test: sha périmé')).rejects.toMatchObject({ kind: 'conflict' });
    await expect(readDataFile({ ...ref, token: 'jeton_invalide' })).rejects.toBeInstanceOf(GitHubError);
  }, 30_000);
});
