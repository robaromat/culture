// Icônes au trait (24×24), reprises des maquettes.
const PATHS = {
  book: '<path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v12H8.5A3.5 3.5 0 0 1 5 16.5z"/><path d="M5 16.5A3.5 3.5 0 0 1 8.5 13H19"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21"/>',
  tv: '<rect x="3" y="6.5" width="18" height="13" rx="2"/><path d="M8.5 3l3.5 3.5L15.5 3"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  spark: '<path d="M12 3.5l1.9 5.2 5.6.3-4.4 3.5 1.5 5.4L12 14.8 7.4 17.9l1.5-5.4L4.5 9l5.6-.3z"/>',
  shelf: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM15.5 5.2l3.8-1 3.2 14.6-3.8 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  tag: '<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-7.3 7.3a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  refresh: '<path d="M20 11.5A8 8 0 1 1 17.7 6M20 4v5h-5"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5"/>',
  cloud: '<path d="M7 18h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.6 1.5A3.3 3.3 0 0 0 7 18z"/>',
  logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  star: '<path d="M12 3.3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8l-5.4 3 1.2-6L3.3 9.6l6.1-.7z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><rect x="3.5" y="4.5" width="3" height="3" rx=".5"/><rect x="3.5" y="10.5" width="3" height="3" rx=".5"/><rect x="3.5" y="16.5" width="3" height="3" rx=".5"/>',
  sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  merge: '<path d="M6 4v5a4 4 0 0 0 4 4h8M14 9l4 4-4 4M6 20v-4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, class: cls }: { name: IconName; class?: string }) {
  return <svg class={`i ${cls ?? ''}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PATHS[name] }} />;
}
