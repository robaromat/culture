# Culture

Application web personnelle pour noter les livres, films, séries, musiques et podcasts à découvrir, avec des tags libres. Installable sur le téléphone, consultable hors connexion, synchronisée entre appareils.

**En ligne :** https://robaromat.github.io/culture/

## Principe

- Site statique (Vite + TypeScript + Preact) publié sur GitHub Pages à chaque push sur `main` (les tests passent d'abord).
- Les données vivent dans un **dépôt privé séparé** (`culture-data`, un seul fichier `data.json`), lu et écrit via l'API GitHub. Chaque modification est un commit : historique complet et sauvegarde gratuits.
- **Aucun secret dans ce dépôt.** Jeton GitHub, clé TMDB, Client ID et connexion Spotify restent dans le stockage local de chaque appareil.
- Conflits entre appareils : écriture avec le `sha` du fichier ; en cas de refus, fusion à trois (dernière version connue / ici / GitHub) fiche par fiche, puis nouvel essai (`src/sync/merge.ts`).
- Hors connexion : copie locale dans IndexedDB, modifications en file d'attente, service worker pour la coquille de l'app et les couvertures.

## Utilisation

| Besoin | Où |
|---|---|
| Premier lancement sur un appareil | Coller le jeton GitHub (fine-grained, dépôt `culture-data` seul, Contents : Read and write, avec expiration) |
| Films et séries (recherche, affiches, Netflix / Prime Video / Canal+) | Réglages → clé TMDB |
| Recherche Spotify intégrée | Réglages → Client ID → « Se connecter à Spotify » (redirection déclarée : `https://robaromat.github.io/culture/`, compte ajouté dans User Management) |
| Musique sans compte développeur | Coller un lien « Partager » Spotify dans l'écran + |
| Importer une Watchlist IMDb | Réglages → Importer une liste IMDb (.csv ou .xlsx), revue avant import |
| Installer l'app | Réglages → Application, ou menu de Chrome → Installer l'application |
| Sauvegarde manuelle | Réglages → Exporter / Importer `data.json` |
| Jeton expiré | Bandeau dans la bibliothèque → Réglages → nouveau jeton |

## Structure

```
.github/workflows/deploy.yml   tests + build + déploiement Pages
maquettes/                     prototypes cliquables validés (données d'exemple)
public/                        icônes, manifeste
scripts/icons.mjs              génération des icônes PNG
sw/sw.js                       service worker (complété au build par vite.config.ts)
src/
  model/       types de data.json, opérations, filtres et tri, libellés
  sync/        API GitHub, fusion, moteur de synchro, IndexedDB, disponibilité
  providers/   Open Library, TMDB (+ disponibilité JustWatch), Spotify (oEmbed + PKCE), liens collés
  import/      lecture CSV / XLSX, export IMDb, complément TMDB
  screens/     Bibliothèque, Fiche, Ajouter, Formulaire, Tags, Réglages, Import IMDb, Premier lancement
  components/  navigation, couvertures, badges, panneaux
```

## Développement

```bash
npm install
npm run dev       # http://localhost:5173/culture/
npm test          # fusion, synchro, filtres, liens, import IMDb
npm run build     # vérification des types + build dans dist/
```

## Avancement (v1.0.0)

1. ✅ Projet initialisé, déploiement automatique
2. ✅ Réglages, stockage GitHub, synchro hors ligne
3. ✅ Fiches et tags, bibliothèque avec filtres
4. ✅ Remplissage automatique (Open Library, TMDB + disponibilité, Spotify)
5. ✅ App installable et hors connexion
6. ✅ Finitions (revue des trois formats, clair / sombre, alerte jeton expiré)

Ajouts en cours de route : statut « En cours » pour les séries, import IMDb, recherche « Tout ».

v1.1 : ajout du titre tapé quand la recherche ne trouve rien ; « Depuis un article » (lien lu via le relais public r.jina.ai, ou texte collé) : titres repérés, retrouvés dans TMDB / Open Library / Spotify, à cocher.

Hors périmètre v1 : partage, statistiques, import Goodreads / Letterboxd, ajout depuis le menu « Partager » du téléphone.

Données de disponibilité : JustWatch (via TMDB).
