import type { DataFile, Item, Tag } from '../model/types';

// Fusion « à trois » quand les deux appareils ont modifié data.json en même temps.
//   base   = la dernière version que CET appareil a lue/écrite sur GitHub
//   local  = ce que cet appareil veut enregistrer
//   remote = ce qui est sur GitHub maintenant
// Comparer à la base permet de savoir qui a changé quoi, et donc de distinguer
// « supprimé ici » de « ajouté là-bas » (une simple fusion local/remote ferait réapparaître les suppressions).
//
// Règles, fiche par fiche (même chose pour les tags) :
//   - modifiée d'un seul côté → on garde cette modification ;
//   - modifiée des deux côtés → la plus récente (updatedAt) gagne ; pour les tags, sans date, le local gagne ;
//   - supprimée d'un côté et inchangée de l'autre → supprimée ;
//   - supprimée d'un côté mais modifiée de l'autre → on garde la version modifiée (rien ne se perd en silence).

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function mergeEntities<T extends { id: string }>(
  base: readonly T[],
  local: readonly T[],
  remote: readonly T[],
  resolveBoth: (l: T, r: T) => T,
): T[] {
  const B = new Map(base.map((x) => [x.id, x]));
  const L = new Map(local.map((x) => [x.id, x]));
  const R = new Map(remote.map((x) => [x.id, x]));
  const ids = [...new Set([...remote.map((x) => x.id), ...local.map((x) => x.id)])];
  const out: T[] = [];
  for (const id of ids) {
    const l = L.get(id);
    const r = R.get(id);
    const b = B.get(id);
    if (l && r) {
      if (same(l, r)) out.push(l);
      else if (b && same(l, b)) out.push(r);
      else if (b && same(r, b)) out.push(l);
      else out.push(resolveBoth(l, r));
    } else if (l) {
      // Absente du distant : nouvelle ici, ou supprimée là-bas.
      if (!b || !same(l, b)) out.push(l);
    } else if (r) {
      // Absente du local : nouvelle là-bas, ou supprimée ici.
      if (!b || !same(r, b)) out.push(r);
    }
  }
  return out;
}

export function mergeData(base: DataFile | null, local: DataFile, remote: DataFile): DataFile {
  const tags = mergeEntities<Tag>(base?.tags ?? [], local.tags, remote.tags, (l) => l);
  const items = mergeEntities<Item>(base?.items ?? [], local.items, remote.items, (l, r) =>
    l.updatedAt >= r.updatedAt ? l : r,
  );
  // Un tag supprimé (ou fusionné) d'un côté ne doit plus être référencé par les fiches.
  const tagIds = new Set(tags.map((t) => t.id));
  const cleaned = items.map((i) =>
    i.tags.every((t) => tagIds.has(t)) ? i : { ...i, tags: i.tags.filter((t) => tagIds.has(t)) },
  );
  return { schemaVersion: 1, tags, items: cleaned };
}
