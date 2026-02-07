/**
 * Font configuration for dynamic poem typography.
 * Each font is normalized for consistent rendering on the glassmorphic poem overlay.
 */

export interface FontConfig {
  family: string;       // CSS font-family value
  size: string;         // CSS font-size
  weight: number;       // CSS font-weight
  letterSpacing: string; // CSS letter-spacing
  googleFamily: string; // Google Fonts family parameter (URL-encoded)
}

export const FONT_CONFIG: Record<string, FontConfig> = {
  // European / Classical
  'Playfair Display': { family: '"Playfair Display"', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Playfair+Display' },
  'Cormorant Garamond': { family: '"Cormorant Garamond"', size: '1.25rem', weight: 400, letterSpacing: '0.01em', googleFamily: 'Cormorant+Garamond' },
  'EB Garamond': { family: '"EB Garamond"', size: '1.25rem', weight: 400, letterSpacing: '0.01em', googleFamily: 'EB+Garamond' },
  'Libre Baskerville': { family: '"Libre Baskerville"', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Libre+Baskerville' },
  'Vollkorn': { family: 'Vollkorn', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Vollkorn' },
  'Cardo': { family: 'Cardo', size: '1.25rem', weight: 400, letterSpacing: '0.005em', googleFamily: 'Cardo' },

  // Mediterranean / Latin
  'Crimson Pro': { family: '"Crimson Pro"', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Crimson+Pro' },
  'Alegreya': { family: 'Alegreya', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Alegreya' },
  'Bitter': { family: 'Bitter', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Bitter' },

  // Modern / Minimal
  'Source Serif 4': { family: '"Source Serif 4"', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Source+Serif+4' },
  'IBM Plex Serif': { family: '"IBM Plex Serif"', size: '1.125rem', weight: 400, letterSpacing: '0.01em', googleFamily: 'IBM+Plex+Serif' },
  'Spectral': { family: 'Spectral', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Spectral' },
  'Newsreader': { family: 'Newsreader', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Newsreader' },

  // Warm / Literary
  'Lora': { family: 'Lora', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Lora' },
  'Merriweather': { family: 'Merriweather', size: '1.0625rem', weight: 300, letterSpacing: 'normal', googleFamily: 'Merriweather:wght@300' },
  'Literata': { family: 'Literata', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Literata' },

  // Regional / Cultural
  'Noto Serif': { family: '"Noto Serif"', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Noto+Serif' },
  'Amiri': { family: 'Amiri', size: '1.25rem', weight: 400, letterSpacing: '0.01em', googleFamily: 'Amiri' },
  'Fraunces': { family: 'Fraunces', size: '1.125rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Fraunces:opsz@9..144' },
  'Zilla Slab': { family: '"Zilla Slab"', size: '1.0625rem', weight: 400, letterSpacing: 'normal', googleFamily: 'Zilla+Slab' },
};

export const VALID_FONTS = Object.keys(FONT_CONFIG);

const DEFAULT_FONT = 'Lora';

export function validateFont(name: unknown): string {
  if (typeof name === 'string' && VALID_FONTS.includes(name)) {
    return name;
  }
  return DEFAULT_FONT;
}

export function getGoogleFontsUrl(fontFamily: string): string {
  const config = FONT_CONFIG[fontFamily];
  if (!config) return '';
  return `https://fonts.googleapis.com/css2?family=${config.googleFamily}&display=swap`;
}
