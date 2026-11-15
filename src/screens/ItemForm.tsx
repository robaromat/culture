import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Cover } from '../components/Cover';
import { CAT_ICON, CATEGORY_ORDER } from '../components/catIcon';
import { CATEGORIES, statusLabel } from '../model/labels';
import { addItem, createTag, TAG_COLORS, updateItem, type ItemDraft } from '../model/ops';
import type { Category, DataFile, Item, Status } from '../model/types';
import { engine, mutate } from '../sync/store';
import { back, navigate } from '../router';
import { safeHttpUrl } from '../lib/url';
import { showToast } from '../state/ui';

const CREATOR_LABEL: Record<Category, string> = {
  livre: 'Auteur', film: 'Réalisation', serie: 'Création', musique: 'Artiste', podcast: 'Animation', autre: 'Créateur',
};

interface NewTag { tempId: string; name: string; color: string }

type Props = { mode: 'add'; category: Category; initial?: Partial<ItemDraft> } | { mode: 'edit'; item: Item };

function blankDraft(category: Category, initial: Partial<ItemDraft> = {}): ItemDraft {
  return {
    category, title: '', creator: '', year: null, cover: null, status: 'a_decouvrir', rating: 0, tags: [], notes: '',
    link: null, source: { provider: 'manual', id: null, subtype: null }, recommendedBy: '', ...initial,
  };
}

export function ItemForm(props: Props) {
  const data = engine.value?.data.value;
  const editing = props.mode === 'edit';
  const [d, setD] = useState<ItemDraft>(() => (props.mode === 'edit' ? { ...props.item } : blankDraft(props.category, props.initial)));
  const [yearText, setYearText] = useState(d.year ? String(d.year) : '');
  const [newTags, setNewTags] = useState<NewTag[]>([]);
  const [tagEditor, setTagEditor] = useState<{ name: string; color: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [moreOpen, setMoreOpen] = useState(editing && (d.rating > 0 || !!d.notes || !!d.link || !!d.cover));

  if (!data) return null;
  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggleTag = (id: string) => set('tags', d.tags.includes(id) ? d.tags.filter((x) => x !== id) : [...d.tags, id]);
  const allTags = [...data.tags.map((t) => ({ id: t.id, name: t.name, color: t.color })), ...newTags.map((t) => ({ id: t.tempId, name: t.name, color: t.color }))];

  function addNewTag() {
    if (!tagEditor) return;
    const name = tagEditor.name.trim();
    if (!name) return;
    const existing = allTags.find((t) => t.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'));
    if (existing) {
      if (!d.tags.includes(existing.id)) toggleTag(existing.id);
    } else {
      const tempId = `new_${newTags.length}`;
      setNewTags([...newTags, { tempId, name, color: tagEditor.color }]);
      set('tags', [...d.tags, tempId]);
    }
    setTagEditor(null);
  }

  function save(ev: Event) {
    ev.preventDefault();
    const errs: Record<string, string> = {};
    const title = d.title.trim();
    if (!title) errs.title = 'Il faut au moins un titre.';
    let year: number | null = null;
    if (yearText.trim()) {
      year = Number(yearText.trim());
      if (!Number.isInteger(year) || year < 0 || year > 2100) errs.year = 'Année sur 4 chiffres, ex. 2023.';
    }
    const link = d.link?.trim() ? safeHttpUrl(d.link) : null;
    if (d.link?.trim() && !link) errs.link = 'Le lien doit commencer par https://';
    const cover = d.cover?.trim() ? safeHttpUrl(d.cover) : null;
    if (d.cover?.trim() && !cover) errs.cover = "L'adresse de l'image doit commencer par https://";
    setErrors(errs);
    if (Object.keys(errs).length) {
      if (errs.link || errs.cover) setMoreOpen(true);
      return;
    }

    const clean: ItemDraft = { ...d, title, creator: d.creator.trim(), recommendedBy: d.recommendedBy.trim(), notes: d.notes.trim(), year, link, cover };
    let newId = '';
    mutate((data0: DataFile) => {
      let next = data0;
      const idMap = new Map<string, string>();
      for (const nt of newTags) {
        if (!clean.tags.includes(nt.tempId)) continue;
        const r = createTag(next, nt.name, nt.color);
        next = r.data;
        idMap.set(nt.tempId, r.tag.id);
      }
      const tags = [...new Set(clean.tags.map((t) => idMap.get(t) ?? t))].filter((t) => next.tags.some((x) => x.id === t));
      if (props.mode === 'edit') return updateItem(next, props.item.id, { ...clean, tags });
      const r = addItem(next, { ...clean, tags });
      newId = r.id;
      return r.data;
    });
    if (props.mode === 'edit') {
      showToast('Fiche enregistrée');
      back({ name: 'item', id: props.item.id });
    } else {
      showToast(`Ajouté : ${title}`);
      navigate({ name: 'item', id: newId }, { replace: true });
    }
  }

  const c = CATEGORIES[d.category];
  return (
    <div class="page form-page">
      <form class="page-in" onSubmit={save} noValidate>
        <header class="head">
          <button type="button" class="iconbtn" aria-label="Retour" onClick={() => back(props.mode === 'edit' ? { name: 'item', id: props.item.id } : { name: 'add' })}>
            <Icon name="back" />
          </button>
          <h1 class="h-title">{editing ? 'Modifier la fiche' : 'Nouvelle fiche'}</h1>
        </header>
        <div class="form">
          <div class="eyebrow">
            <Icon name={CAT_ICON[d.category]} />
            {c.label}
            {d.source.provider === 'manual' ? ' · saisie manuelle' : ''}
          </div>
          <div class="fhero">
            <div><Cover category={d.category} title={d.title || 'Titre'} creator={d.creator} cover={safeHttpUrl(d.cover)} /></div>
            <div class="fhero-fields">
              <div class="field">
                <label for="f-title">Titre</label>
                <input class="input title" id="f-title" value={d.title} required aria-invalid={!!errors.title} onInput={(e) => set('title', e.currentTarget.value)} />
                {errors.title && <span class="ferr">{errors.title}</span>}
              </div>
              <div class="fgrid-year">
                <div class="field">
                  <label for="f-creator">{CREATOR_LABEL[d.category]}</label>
                  <input class="input" id="f-creator" value={d.creator} onInput={(e) => set('creator', e.currentTarget.value)} />
                </div>
                <div class="field">
                  <label for="f-year">Année</label>
                  <input class="input" id="f-year" inputmode="numeric" maxLength={4} value={yearText} aria-invalid={!!errors.year} onInput={(e) => setYearText(e.currentTarget.value)} />
                </div>
              </div>
              {errors.year && <span class="ferr">{errors.year}</span>}
            </div>
          </div>

          <div class="field">
            <span class="flabel">Tags</span>
            <div class="tagpick">
              {allTags.map((t) => (
                <button type="button" key={t.id} class="tag" style={{ '--tc': t.color }} aria-pressed={d.tags.includes(t.id)} onClick={() => toggleTag(t.id)}>
                  {t.name}
                </button>
              ))}
              {!tagEditor && (
                <button type="button" class="newtagbtn" onClick={() => setTagEditor({ name: '', color: TAG_COLORS[allTags.length % TAG_COLORS.length]! })}>
                  + Nouveau tag
                </button>
              )}
            </div>
            {tagEditor && (
              <div class="newtag">
                <input
                  class="input"
                  id="nt-name"
                  placeholder="Nom du tag, ex. à revoir"
                  value={tagEditor.name}
                  ref={(el) => el?.focus()}
                  onInput={(e) => setTagEditor({ ...tagEditor, name: e.currentTarget.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addNewTag(); }
                    if (e.key === 'Escape') setTagEditor(null);
                  }}
                />
                <div class="swatches">
                  {TAG_COLORS.map((col) => (
                    <button type="button" key={col} class="sw" style={{ '--tc': col }} aria-pressed={tagEditor.color === col} aria-label={`Couleur ${col}`} onClick={() => setTagEditor({ ...tagEditor, color: col })} />
                  ))}
                </div>
                <div class="btnrow">
                  <button type="button" class="btn small primary" onClick={addNewTag}>Créer et ajouter</button>
                  <button type="button" class="btn small ghost" onClick={() => setTagEditor(null)}>Annuler</button>
                </div>
              </div>
            )}
          </div>

          <div class="field">
            <label for="f-rec">Recommandé par</label>
            <input class="input" id="f-rec" placeholder="Optionnel" value={d.recommendedBy} onInput={(e) => set('recommendedBy', e.currentTarget.value)} />
          </div>

          <div class="field">
            <span class="flabel">Statut</span>
            <div class="seg" role="group" aria-label="Statut">
              {(['a_decouvrir', 'termine'] as Status[]).map((s) => (
                <button type="button" key={s} aria-pressed={d.status === s} onClick={() => set('status', s)}>
                  {statusLabel(s, d.category)}
                </button>
              ))}
            </div>
          </div>

          <details class="more" open={moreOpen} onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary>Note, commentaire, lien et image <Icon name="down" /></summary>
            <div class="inner">
              <div class="field">
                <span class="flabel">Ma note</span>
                <div class="starpick">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} class={n <= d.rating ? 'on' : ''} aria-label={`${n} sur 5`} aria-pressed={n === d.rating} onClick={() => set('rating', d.rating === n ? 0 : n)}>
                      <Icon name="star" />
                    </button>
                  ))}
                </div>
              </div>
              <div class="field">
                <label for="f-notes">Notes</label>
                <textarea class="input" id="f-notes" placeholder="Ce qui t'a donné envie, ce que tu en as pensé…" value={d.notes} onInput={(e) => set('notes', e.currentTarget.value)} />
              </div>
              <div class="field">
                <label for="f-link">Lien</label>
                <input class="input" id="f-link" type="url" inputmode="url" placeholder="https://…" value={d.link ?? ''} aria-invalid={!!errors.link} onInput={(e) => set('link', e.currentTarget.value)} />
                {errors.link && <span class="ferr">{errors.link}</span>}
              </div>
              <div class="field">
                <label for="f-cover">Image (adresse)</label>
                <input class="input" id="f-cover" type="url" inputmode="url" placeholder="https://… (sinon une couverture est dessinée)" value={d.cover ?? ''} aria-invalid={!!errors.cover} onInput={(e) => set('cover', e.currentTarget.value)} />
                {errors.cover && <span class="ferr">{errors.cover}</span>}
              </div>
              <div class="field">
                <label for="f-cat">Catégorie</label>
                <select class="input" id="f-cat" value={d.category} onChange={(e) => set('category', e.currentTarget.value as Category)}>
                  {CATEGORY_ORDER.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
                </select>
              </div>
            </div>
          </details>
        </div>
        <div class="savebar">
          <button type="submit" class="btn primary">
            <Icon name="check" />
            {editing ? 'Enregistrer' : 'Ajouter à ma liste'}
          </button>
        </div>
      </form>
    </div>
  );
}
