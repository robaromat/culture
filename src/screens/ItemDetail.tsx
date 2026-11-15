import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { Cover } from '../components/Cover';
import { ProviderBadges, Stars, TagChip } from '../components/bits';
import { CAT_ICON } from '../components/catIcon';
import { CATEGORIES, statusesFor, statusLabel } from '../model/labels';
import { deleteItem, setStatus } from '../model/ops';
import type { Item, Status, Tag } from '../model/types';
import { mutate } from '../sync/store';
import { back, hrefOf, navigate } from '../router';
import { openLabel, safeHttpUrl } from '../lib/url';
import { formatDate, relativeTime } from '../lib/time';
import { settings } from '../settings/settings';
import { showToast } from '../state/ui';
import { checkAvailabilityNow } from '../sync/availabilityRefresh';

const SUBTYPE: Record<string, string> = { album: 'Album', track: 'Titre', artist: 'Artiste', show: 'Émission', episode: 'Épisode' };
const SOURCE: Record<string, string> = { tmdb: 'TMDB', openlibrary: 'Open Library', spotify: 'Spotify', manual: 'Saisie manuelle' };

export function ItemDetail({ item, tags }: { item: Item; tags: Tag[] }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => setConfirmDel(false), [item.id]);

  async function checkNow() {
    setChecking(true);
    try {
      await checkAvailabilityNow(item);
      showToast('Disponibilité vérifiée');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Vérification impossible');
    } finally {
      setChecking(false);
    }
  }

  const c = CATEGORIES[item.category];
  const link = item.category === 'livre' ? null : safeHttpUrl(item.link);
  const isAV = item.category === 'film' || item.category === 'serie';
  const itemTags = item.tags.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t);
  const trackedNames = settings.value.providers.filter((p) => p.enabled).map((p) => p.name).join(', ');

  function changeStatus(s: Status) {
    if (s === item.status) return;
    mutate((d) => setStatus(d, item.id, s));
  }

  function remove() {
    const title = item.title;
    mutate((d) => deleteItem(d, item.id));
    navigate({ name: 'library' }, { replace: true });
    showToast(`« ${title} » supprimé`);
  }

  return (
    <article class="detail">
      <div class="dtop">
        <button class="iconbtn back" aria-label="Retour à la liste" onClick={() => back({ name: 'library' })}>
          <Icon name="back" />
        </button>
        <span class="spacer" />
        <a class="iconbtn" href={hrefOf({ name: 'edit', id: item.id })} aria-label="Modifier">
          <Icon name="edit" />
        </a>
        <button class="iconbtn" aria-label="Supprimer" onClick={() => setConfirmDel(true)}>
          <Icon name="trash" />
        </button>
      </div>
      <div class="dhero">
        <div class="cv"><Cover category={item.category} title={item.title} creator={item.creator} cover={item.cover} /></div>
        <div class="dhead">
          <div class="eyebrow">
            <Icon name={CAT_ICON[item.category]} />
            {c.label}
            {item.source.subtype ? ` · ${SUBTYPE[item.source.subtype]}` : ''}
          </div>
          <h1 class="d-title">{item.title}</h1>
          <div class="d-meta">{[item.creator, item.year].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
      <div class="dbody">
        {confirmDel && (
          <div class="confirm" role="alertdialog" aria-label="Confirmer la suppression">
            <b>Supprimer « {item.title} » ?</b>
            <span class="small">La fiche disparaît de tous tes appareils. Elle reste récupérable dans l'historique du dépôt GitHub.</span>
            <div class="btnrow">
              <button class="btn small danger" onClick={remove}><Icon name="trash" />Supprimer</button>
              <button class="btn small ghost" onClick={() => setConfirmDel(false)}>Annuler</button>
            </div>
          </div>
        )}
        <div class="seg" role="group" aria-label="Statut">
          {statusesFor(item.category).map((s) => (
            <button key={s} aria-pressed={item.status === s} onClick={() => changeStatus(s)}>
              {statusLabel(s, item.category)}
            </button>
          ))}
        </div>
        {link && (
          <a class="btn primary block" href={link} target="_blank" rel="noopener noreferrer">
            <Icon name={item.category === 'musique' || item.category === 'podcast' ? 'play' : 'ext'} />
            {openLabel(link)}
          </a>
        )}
        {isAV && item.availability && (
          <div class="avail">
            <div class="provs">
              {item.availability.providers.length ? (
                <>
                  <ProviderBadges item={item} />
                  <span class="small">inclus dans l'abonnement, France</span>
                </>
              ) : (
                <span class="small">Pas sur tes abonnements ({trackedNames}) en France.</span>
              )}
            </div>
            <div class="small">
              Vérifié {relativeTime(item.availability.checkedAt)} ·{' '}
              <button class="linkbtn" disabled={checking} onClick={checkNow}>
                <Icon name="refresh" />
                {checking ? 'Vérification…' : 'Vérifier maintenant'}
              </button>
            </div>
            <div class="small">Données de disponibilité : JustWatch</div>
          </div>
        )}
        <div class="sect">
          <h3>Tags</h3>
          <div class="r-line flat">
            {itemTags.length ? itemTags.map((t) => <TagChip key={t.id} tag={t} />) : <span class="small">Aucun tag</span>}
            <a class="linkbtn" href={hrefOf({ name: 'edit', id: item.id })}><Icon name="plus" />{itemTags.length ? 'Modifier' : 'Ajouter'}</a>
          </div>
        </div>
        {item.rating > 0 && (
          <div class="sect"><h3>Ma note</h3><Stars value={item.rating} /></div>
        )}
        {item.notes && (
          <div class="sect"><h3>Notes</h3><p class="notes">{item.notes}</p></div>
        )}
        <dl class="dl">
          {item.recommendedBy && (<><dt>Recommandé par</dt><dd>{item.recommendedBy}</dd></>)}
          <dt>Ajouté le</dt><dd>{formatDate(item.addedAt)}</dd>
          {item.status === 'termine' && item.finishedAt && (<><dt>{statusLabel('termine', item.category)} le</dt><dd>{formatDate(item.finishedAt)}</dd></>)}
          <dt>Source</dt><dd>{SOURCE[item.source.provider]}</dd>
        </dl>
      </div>
    </article>
  );
}
