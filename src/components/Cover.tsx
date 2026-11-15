import { useState } from 'preact/hooks';
import type { Category } from '../model/types';
import { safeHttpUrl } from '../lib/url';

// Couverture : l'image (Open Library, TMDB, Spotify) si on en a une, sinon une couverture dessinée
// dont la forme dit la catégorie (livre relié, affiche, pochette avec disque, podcast, billet).

const PALETTE: [string, string][] = [
  ['#74303A', '#F3E3D3'], ['#2F4A3E', '#EADFC8'], ['#C9A15A', '#2A1F14'], ['#3B4A6B', '#EDE3D1'],
  ['#E4D3B5', '#4A3420'], ['#1F2A2E', '#D9C9A8'], ['#8A6A9B', '#F5ECE0'], ['#D8B7A0', '#3A2418'],
  ['#4E5D3A', '#F0E6CF'], ['#A44A3F', '#F7E9DA'], ['#232020', '#E8C77A'],
];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

interface Props {
  category: Category;
  title: string;
  creator?: string;
  cover?: string | null;
}

export function Cover({ category, title, creator, cover }: Props) {
  const [failed, setFailed] = useState(false);
  const src = safeHttpUrl(cover);
  const [c1, c2] = PALETTE[Math.abs(hash(title || '?')) % PALETTE.length]!;
  const poster = category === 'film' || category === 'serie';
  if (src && !failed) {
    return (
      <div class={`cover k-${category} has-img`} aria-hidden="true">
        <img src={src} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onError={() => setFailed(true)} />
      </div>
    );
  }
  return (
    <div class={`cover k-${category}`} style={{ '--c1': c1, '--c2': c2 }} aria-hidden="true">
      {category === 'serie' && <span class="ribbon">SÉRIE</span>}
      <div class="ci">
        {poster ? (
          <>
            <span class="cc">{creator}</span>
            <span>
              <span class="ct">{title}</span>
              <span class="credits" />
            </span>
          </>
        ) : (
          <>
            <span class="ct">{title}</span>
            <span class="cc">{creator}</span>
          </>
        )}
      </div>
    </div>
  );
}
