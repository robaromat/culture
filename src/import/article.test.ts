import { describe, expect, it } from 'vitest';
import { categoryHint, extractTitles, siteName } from './article';

describe('titres cités dans un article', () => {
  it('lit les intertitres avec le titre entre guillemets (dernier passage cité)', () => {
    const md = `# Quinze séries comiques
Intro de l’article avec une “citation” au passage.
### Roi de l’impro: “Recalé”
Texte…
### Humour “green”: “Au fond du trou”
Texte…
### Y a-t-il un patron dans le bureau? “The Office”
### Bonbon acidulé: “Good Cop/ Bad Cop”`;
    expect(extractTitles(md).map((t) => t.title)).toEqual(['Recalé', 'Au fond du trou', 'The Office', 'Good Cop/ Bad Cop']);
  });

  it('lit les intertitres sans guillemets, avec une année', () => {
    const md = `## 1. Le Bureau des légendes (2015)
## 2. Dix pour cent
## 3. Baron noir (2016-2020)`;
    expect(extractTitles(md)).toMatchObject([
      { title: 'Le Bureau des légendes', year: 2015 },
      { title: 'Dix pour cent', year: null },
      { title: 'Baron noir', year: 2016 },
    ]);
  });

  it('texte collé (sans intertitres) : lignes courtes avec un titre cité', () => {
    const txt = `Quinze séries pour rire
Une longue introduction qui parle de beaucoup de choses et dont la ligne dépasse largement la longueur d’un intertitre, avec « un passage cité » au milieu pour tromper l’algorithme.
Roi de l’impro : « Recalé »
Justicier décérébré : “Peacemaker”
Un paragraphe.`;
    expect(extractTitles(txt).map((t) => t.title)).toEqual(['Recalé', 'Peacemaker']);
  });

  it('ignore les doublons', () => {
    expect(extractTitles('## “Fiasco”\n## “fiasco”\n## “Ted Lasso”').map((t) => t.title)).toEqual(['Fiasco', 'Ted Lasso']);
  });

  it('reconnaît le site et la rubrique', () => {
    const u = 'https://www.telerama.fr/series-tv/quinze-series-comiques-7033464.php';
    expect(siteName(u)).toBe('Télérama');
    expect(categoryHint(u)).toBe('serie');
    expect(categoryHint('https://www.telerama.fr/cinema/les-films-de-la-semaine')).toBe('film');
    expect(categoryHint('https://example.com/blog')).toBeNull();
  });
});
