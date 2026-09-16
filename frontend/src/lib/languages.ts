// GitHub Linguist language colours. These are the real colours GitHub uses for
// language swatches, so a StackLens language bar reads the same way a GitHub
// repository page does. Values taken from github/linguist (languages.yml).
const LINGUIST_COLORS: Record<string, string> = {
  'C': '#555555',
  'C#': '#178600',
  'C++': '#F34B7D',
  'CSS': '#663399',
  'Clojure': '#DB5855',
  'Dart': '#00B4AB',
  'Elixir': '#6E4A7E',
  'Go': '#00ADD8',
  'Haskell': '#5E5086',
  'HTML': '#E34C26',
  'Java': '#B07219',
  'JavaScript': '#F1E05A',
  'Jupyter Notebook': '#DA5B0B',
  'Kotlin': '#A97BFF',
  'Lua': '#000080',
  'MDX': '#FCB32C',
  'Nix': '#7E7EFF',
  'Objective-C': '#438EFF',
  'OCaml': '#3BE133',
  'OpenSCAD': '#E5CD45',
  'PHP': '#4F5D95',
  'Python': '#3572A5',
  'R': '#198CE7',
  'Ruby': '#701516',
  'Rust': '#DEA584',
  'SCSS': '#C6538C',
  'Shell': '#89E051',
  'Solidity': '#AA6746',
  'Svelte': '#FF3E00',
  'Swift': '#F05138',
  'TypeScript': '#3178C6',
  'Vim Script': '#199F4B',
  'Vue': '#41B883',
  'Zig': '#EC915C',
};

// Unclassified repositories ("Other") and any language GitHub has no colour
// for fall back to GitHub's neutral swatch.
const FALLBACK_COLOR = '#6E7681';

export function languageColor(language: string | null | undefined): string {
  if (!language) return FALLBACK_COLOR;
  return LINGUIST_COLORS[language] ?? FALLBACK_COLOR;
}
