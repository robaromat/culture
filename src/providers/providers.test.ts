import { describe, expect, it } from 'vitest';
import { trackedAvailability, isStale } from './availability';
import { parseSpotifyUrl } from './spotify';
import { guessCategory, looksLikeLink } from './links';
import { DEFAULT_PROVIDERS } from '../settings/settings';

describe('disponibilité', () => {
  const wp = (flatrate: { provider_id: number; provider_name: string }[], region = 'FR') => ({ results: { [region]: { flatrate } } });
  it('reconnaît Netflix, Prime Video (avec pub) et Canal+ par id', () => {
    expect(trackedAvailability(wp([{ provider_id: 8, provider_name: 'Netflix' }, { provider_id: 2100, provider_name: 'Amazon Prime Video with Ads' }, { provider_id: 381, provider_name: 'Canal+' }]), DEFAULT_PROVIDERS)).toEqual(['netflix', 'prime', 'canal']);
  });
  it('ignore les chaînes vendues via Prime (Amazon Channel)', () => {
    expect(trackedAvailability(wp([{ provider_id: 9999, provider_name: 'Canal+ Amazon Channel' }]), DEFAULT_PROVIDERS)).toEqual([]);
  });
  it('se rabat sur le nom si l’id a changé', () => {
    expect(trackedAvailability(wp([{ provider_id: 12345, provider_name: 'Netflix Standard with Ads' }]), DEFAULT_PROVIDERS)).toEqual(['netflix']);
  });
  it('ne regarde que la France', () => {
    expect(trackedAvailability(wp([{ provider_id: 8, provider_name: 'Netflix' }], 'US'), DEFAULT_PROVIDERS)).toEqual([]);
  });
  it('revérifie après 7 jours', () => {
    const now = Date.parse('2026-11-15T00:00:00Z');
    expect(isStale('2026-11-10T00:00:00Z', now)).toBe(false);
    expect(isStale('2026-11-01T00:00:00Z', now)).toBe(true);
    expect(isStale(undefined, now)).toBe(true);
  });
});

describe('liens collés', () => {
  it('lit les liens Spotify (avec ou sans intl-fr, avec ?si=)', () => {
    expect(parseSpotifyUrl('https://open.spotify.com/intl-fr/album/4m2880jivSbbyEGAKfITCa?si=abc')).toMatchObject({ type: 'album', id: '4m2880jivSbbyEGAKfITCa' });
    expect(parseSpotifyUrl('spotify:show:5CnDmMUG0S5bSSw612fs8C')).toMatchObject({ type: 'show' });
    expect(parseSpotifyUrl('https://example.com/album/x')).toBeNull();
  });
  it('devine la catégorie', () => {
    expect(guessCategory('https://open.spotify.com/episode/abc')).toBe('podcast');
    expect(guessCategory('https://open.spotify.com/track/abc')).toBe('musique');
    expect(guessCategory('https://www.themoviedb.org/tv/1396-breaking-bad')).toBe('serie');
    expect(guessCategory('https://www.imdb.com/fr/title/tt0111161/')).toBe('film');
    expect(guessCategory('https://openlibrary.org/works/OL22594933W')).toBe('livre');
    expect(looksLikeLink('  https://x.y')).toBe(true);
    expect(looksLikeLink('Dune')).toBe(false);
  });
});
