// Modèle de data.json (dépôt privé culture-data). Voir le brief, section 4, ajusté après les maquettes :
// deux statuts seulement, et supprimer une fiche l'efface (l'historique reste dans les commits GitHub).

export type Category = 'livre' | 'film' | 'serie' | 'musique' | 'podcast' | 'autre';
export type Status = 'a_decouvrir' | 'termine';
export type Provider = 'tmdb' | 'openlibrary' | 'spotify' | 'manual';
export type SpotifySubtype = 'album' | 'track' | 'artist' | 'show' | 'episode';

export interface Tag {
  id: string; // « t_… »
  name: string;
  color: string; // #RRGGBB
}

export interface Availability {
  /** Fournisseurs suivis où le titre est inclus dans l'abonnement en France (catégorie flatrate). */
  providers: string[];
  checkedAt: string; // ISO 8601
}

export interface Item {
  id: string; // « i_… »
  category: Category;
  title: string;
  creator: string;
  year: number | null;
  cover: string | null; // URL, jamais de fichier stocké
  status: Status;
  rating: number; // 0 à 5, 0 = non noté
  tags: string[]; // ids de Tag
  notes: string;
  link: string | null;
  source: { provider: Provider; id: string | null; subtype: SpotifySubtype | null };
  recommendedBy: string;
  availability?: Availability; // films et séries uniquement
  addedAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface DataFile {
  schemaVersion: 1;
  tags: Tag[];
  items: Item[];
}
