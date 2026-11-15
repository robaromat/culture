import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SyncBadge } from '../components/SyncBadge';
import { createTag, deleteTag, mergeTags, TAG_COLORS, updateTag } from '../model/ops';
import type { Tag } from '../model/types';
import { engine, mutate } from '../sync/store';
import { showToast } from '../state/ui';

export function Tags() {
  const data = engine.value?.data.value;
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ name: string; color: string } | null>(null);
  if (!data) return null;
  const count = (id: string) => data.items.filter((i) => i.tags.includes(id)).length;
  const sorted = [...data.tags].sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  function create() {
    if (!creating?.name.trim()) return;
    const c = creating;
    mutate((d) => createTag(d, c.name, c.color).data);
    setCreating(null);
  }

  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <h1 class="h-title">Tags</h1>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <p class="hint">Touche un tag pour le renommer, changer sa couleur, le fusionner avec un autre ou le supprimer.</p>
        <div class="tagrows">
          {sorted.map((t) => (
            <TagRow key={t.id} tag={t} n={count(t.id)} others={sorted.filter((o) => o.id !== t.id)} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} />
          ))}
          {creating ? (
            <div class="tagrow"><div class="edit">
              <div class="field">
                <label for="nt-new">Nouveau tag</label>
                <input class="input" id="nt-new" ref={(el) => el?.focus()} value={creating.name} placeholder="ex. à revoir" onInput={(e) => setCreating({ ...creating, name: e.currentTarget.value })} onKeyDown={(e) => e.key === 'Enter' && create()} />
              </div>
              <Swatches value={creating.color} onPick={(c) => setCreating({ ...creating, color: c })} />
              <div class="btnrow">
                <button class="btn small primary" onClick={create}>Créer</button>
                <button class="btn small ghost" onClick={() => setCreating(null)}>Annuler</button>
              </div>
            </div></div>
          ) : (
            <button class="btn small" onClick={() => setCreating({ name: '', color: TAG_COLORS[data.tags.length % TAG_COLORS.length]! })}>
              <Icon name="plus" />Nouveau tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div class="field">
      <span class="flabel">Couleur</span>
      <div class="swatches">
        {TAG_COLORS.map((c) => (
          <button key={c} type="button" class="sw" style={{ '--tc': c }} aria-pressed={value === c} aria-label={`Couleur ${c}`} onClick={() => onPick(c)} />
        ))}
      </div>
    </div>
  );
}

function TagRow({ tag, n, others, open, onToggle }: { tag: Tag; n: number; others: Tag[]; open: boolean; onToggle: () => void }) {
  const [name, setName] = useState(tag.name);
  const [mergeTo, setMergeTo] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const fiches = (k: number) => `${k} fiche${k > 1 ? 's' : ''}`;

  function rename() {
    const v = name.trim();
    if (!v) return setName(tag.name);
    if (v !== tag.name) mutate((d) => updateTag(d, tag.id, { name: v }));
  }

  function merge() {
    const into = others.find((o) => o.id === mergeTo);
    if (!into) return;
    mutate((d) => mergeTags(d, tag.id, into.id));
    showToast(`« ${tag.name} » fusionné dans « ${into.name} »`);
  }

  return (
    <div class="tagrow">
      <button class="top" aria-expanded={open} onClick={onToggle}>
        <span class="dot" style={{ '--tc': tag.color }} />
        <span class="nm">{tag.name}</span>
        <span class="ct">{fiches(n)}</span>
        <Icon name="down" />
      </button>
      {open && (
        <div class="edit">
          <div class="field">
            <label for={`tn-${tag.id}`}>Nom</label>
            <input class="input" id={`tn-${tag.id}`} value={name} onInput={(e) => setName(e.currentTarget.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
          </div>
          <Swatches value={tag.color} onPick={(c) => mutate((d) => updateTag(d, tag.id, { color: c }))} />
          {others.length > 0 && (
            <div class="field">
              <label for={`tm-${tag.id}`}>Fusionner dans</label>
              <div class="btnrow nowrap">
                <select class="input" id={`tm-${tag.id}`} value={mergeTo} onChange={(e) => setMergeTo(e.currentTarget.value)}>
                  <option value="">Choisir un tag…</option>
                  {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button class="btn small" disabled={!mergeTo} onClick={merge}><Icon name="merge" />Fusionner</button>
              </div>
            </div>
          )}
          {confirmDel ? (
            <div class="confirm">
              <b>Supprimer le tag « {tag.name} » ?</b>
              <span class="small">Il sera retiré de {fiches(n)}. Les fiches elles-mêmes sont conservées.</span>
              <div class="btnrow">
                <button class="btn small danger" onClick={() => { mutate((d) => deleteTag(d, tag.id)); showToast(`Tag « ${tag.name} » supprimé`); }}>Supprimer le tag</button>
                <button class="btn small ghost" onClick={() => setConfirmDel(false)}>Annuler</button>
              </div>
            </div>
          ) : (
            <div><button class="btn small danger ghost" onClick={() => setConfirmDel(true)}><Icon name="trash" />Supprimer ce tag</button></div>
          )}
        </div>
      )}
    </div>
  );
}
