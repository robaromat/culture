import type { Category } from '../model/types';
import { fold } from '../model/filter';

// « Ajouter depuis un article » : on lit la page (via un relais, car les sites de presse interdisent la lecture
// directe depuis un autre site) ou le texte collé, puis on repère les titres cités.
//
// Heuristique : dans les listes de type « 15 séries à voir », chaque œuvre a son intertitre, souvent avec le titre
// entre guillemets (« Roi de l'impro : “Recalé” »). On prend :
//   - les intertitres (## …) s'il y en a au moins 3, sinon les lignes courtes ;
//   - dans chaque ligne, le DERNIER passage entre guillemets, sinon ce qui suit les deux-points, sinon la ligne ;
//   - une année entre parenthèses éventuelle.

/** Relais public qui lit une page web et la renvoie en texte (avec en-tête CORS). Seule l'adresse de l'article lui est transmise. */
const RELAY = 'https://r.jina.ai/';

export interface ArticleText {
  title: string;
  source: string; // nom du site, ex. « Télérama »
  url: string | null;
  text: string;
}

const SITE_NAMES: Record<string, string> = {
  'telerama.fr': 'Télérama',
  'lemonde.fr': 'Le Monde',
  'liberation.fr': 'Libération',
  'lefigaro.fr': 'Le Figaro',
  'lesinrocks.com': 'Les Inrocks',
  'allocine.fr': 'AlloCiné',
  'premiere.fr': 'Première',
  'franceinter.fr': 'France Inter',
  'radiofrance.fr': 'Radio France',
  'lexpress.fr': "L'Express",
  'lepoint.fr': 'Le Point',
  'nouvelobs.com': "L'Obs",
  'numerama.com': 'Numerama',
  'senscritique.com': 'SensCritique',
  'babelio.com': 'Babelio',
};

export function siteName(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return SITE_NAMES[host] ?? host;
}

/** Catégorie suggérée par l'adresse (rubrique du site). */
export function categoryHint(url: string | null): Category | null {
  if (!url) return null;
  const p = fold(url);
  if (/series?[-_/]tv|\/series?\//.test(p)) return 'serie';
  if (/cinema|\/films?\//.test(p)) return 'film';
  if (/livres?|litterature|bd\//.test(p)) return 'livre';
  if (/podcast/.test(p)) return 'podcast';
  if (/musique|albums?\//.test(p)) return 'musique';
  return null;
}

export async function fetchArticle(url: string): Promise<ArticleText> {
  let res: Response;
  try {
    res = await fetch(RELAY + url);
  } catch {
    throw new Error('Le service de lecture des pages ne répond pas. Colle le texte de l’article à la place.');
  }
  if (res.status === 429) throw new Error('Trop de pages lues d’un coup : réessaie dans une minute, ou colle le texte de l’article.');
  if (!res.ok) throw new Error(`Page illisible (${res.status}). Colle le texte de l’article à la place.`);
  const raw = await res.text();
  const title = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const body = raw.split(/^Markdown Content:\s*$/m)[1] ?? raw;
  return { title, source: siteName(url), url, text: body };
}

export interface FoundTitle {
  title: string;
  year: number | null;
  /** La ligne d'origine, pour que tu comprennes d'où vient le titre. */
  context: string;
}

const QUOTED = /[“«"]\s*([^”»"]{1,90}?)\s*[”»"]/g;

function cleanLine(l: string): string {
  return l
    .replace(/^#{1,6}\s*/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // liens markdown
    .replace(/[*_`]+/g, '')
    .replace(/^\s*(\d{1,3}[.)/-]|[-•–])\s+/, '')
    .trim();
}

function titleFromLine(line: string): { title: string; year: number | null } | null {
  let year: number | null = null;
  const y = line.match(/\([^()]*?((?:19|20)\d{2})[^()]*\)/); // première année entre parenthèses : « (2016-2020) » → 2016
  if (y) year = Number(y[1]);
  const quotes = [...line.matchAll(QUOTED)].map((m) => m[1]!.trim()).filter(Boolean);
  let t = quotes.length ? quotes[quotes.length - 1]! : '';
  if (!t) {
    const afterColon = line.split(/\s?:\s/).pop() ?? line;
    t = afterColon.replace(/\((?:[^()]*)\)/g, '').trim();
  }
  t = t.replace(/[.,;!?\s]+$/, '').trim();
  if (t.length < 1 || t.length > 80) return null;
  return { title: t, year };
}

export function extractTitles(text: string): FoundTitle[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const headings = lines.filter((l) => /^#{2,4}\s/.test(l));
  let candidates: string[];
  if (headings.length >= 3) {
    candidates = headings;
  } else {
    // Texte collé : lignes courtes qui contiennent un titre entre guillemets, ou listes numérotées.
    candidates = lines.filter((l) => l.length <= 120 && (/[“«"][^”»"]+[”»"]/.test(l) || /^\d{1,3}[.)]\s+\S/.test(l)));
  }
  const seen = new Set<string>();
  const out: FoundTitle[] = [];
  for (const raw of candidates) {
    const context = cleanLine(raw);
    const r = titleFromLine(context);
    if (!r) continue;
    const key = fold(r.title);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, context });
  }
  return out;
}
