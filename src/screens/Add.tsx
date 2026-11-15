import { useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { SyncBadge } from '../components/SyncBadge';
import { CAT_ICON, CATEGORY_ORDER } from '../components/catIcon';
import { CATEGORIES } from '../model/labels';
import type { Category } from '../model/types';
import { hrefOf } from '../router';
import { fCategory } from '../state/ui';

// Étape 3 : choix de la catégorie puis saisie à la main.
// La recherche (Open Library, TMDB, Spotify) et les liens collés arrivent à l'étape 4, à cet endroit.
export function Add() {
  const [cat, setCat] = useState<Category>(fCategory.value === 'all' ? 'film' : fCategory.value);
  return (
    <div class="page">
      <div class="page-in">
        <header class="head">
          <h1 class="h-title">Ajouter</h1>
          <span class="spacer" />
          <SyncBadge />
        </header>
        <div class="chips wrap" role="group" aria-label="Catégorie">
          {CATEGORY_ORDER.map((c) => (
            <button key={c} class="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
              <Icon name={CAT_ICON[c]} />
              {CATEGORIES[c].label}
            </button>
          ))}
        </div>
        <div class="manual">
          <span>
            {cat === 'autre'
              ? 'Une expo, une pièce, un restaurant, un jeu… Tu saisis la fiche à la main, avec un lien si tu veux.'
              : 'La recherche automatique (titre, auteur, année, couverture) arrive bientôt. En attendant, saisis la fiche à la main.'}
          </span>
          <a class="btn primary small" href={hrefOf({ name: 'addForm', category: cat })}>
            <Icon name="edit" />
            Créer la fiche
          </a>
        </div>
      </div>
    </div>
  );
}
