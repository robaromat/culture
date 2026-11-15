# Culture

Application web personnelle pour noter les livres, films, séries, musiques et podcasts à découvrir, avec des tags libres. Installable sur le téléphone (PWA), synchronisée entre appareils.

**En ligne :** https://robaromat.github.io/culture/

## Principe

- Site statique (Vite + TypeScript + Preact) publié sur GitHub Pages à chaque push sur `main`.
- Les données vivent dans un **dépôt privé séparé** (`culture-data`, un seul fichier `data.json`), lu et écrit via l'API GitHub.
- **Aucun secret dans ce dépôt.** Le jeton GitHub, la clé TMDB et le Client ID Spotify sont saisis dans l'écran Réglages et restent dans le stockage local de chaque appareil.

## Structure

```
.github/workflows/deploy.yml   déploiement GitHub Pages
maquettes/                     prototypes cliquables validés (données d'exemple)
public/                        icônes, manifeste
src/
  model/       types de data.json, libellés (statuts adaptés à la catégorie)
  styles/      palette et base (thème clair/sombre automatique)
  screens/     écrans (à venir)
  components/  composants partagés (à venir)
  sync/        API GitHub, fusion des conflits, cache IndexedDB, file hors ligne (à venir)
  providers/   Open Library, TMDB, Spotify, reconnaissance des liens (à venir)
```

## Développement

```bash
npm install
npm run dev       # http://localhost:5173/culture/
npm run build     # vérification des types + build dans dist/
```

## Avancement

1. ✅ Projet initialisé, déploiement automatique
2. ✅ Réglages + stockage GitHub + cache local (synchro testée : `npm test`)
3. ✅ Fiches et tags, liste avec filtres
4. ✅ Remplissage automatique (Open Library, TMDB + disponibilité, Spotify lien collé et recherche)
5. PWA hors connexion
6. Finitions et tests sur téléphone
