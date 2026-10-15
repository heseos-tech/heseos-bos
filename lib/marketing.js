// Marketing Studio — shared constants for the admin upload form and the Partner app gallery.
// Mirrors MARG's lib/marketing.js: an admin uploads posters that carry a blank band at the
// bottom; the Partner app writes "Heseos Partner : <partner name>" into that band and lets the
// partner share the finished image (with their own referral link as the caption).

export const CREATIVE_CATS = [
  { k: 'all', label: 'All' },
  { k: 'festive', label: 'Festive Offers' },
  { k: 'doorlock', label: 'Smart Door Lock' },
  { k: 'smarthome', label: 'Smart Home' },
  { k: 'offers', label: 'Offers & Deals' },
  { k: 'stories', label: 'Customer Stories' },
  { k: 'tips', label: 'Tips & Know-how' },
  { k: 'greetings', label: 'Greetings' },
];

// Categories an admin can file a creative under ("all" is only a gallery filter).
export const CREATIVE_CAT_KEYS = CREATIVE_CATS.filter((c) => c.k !== 'all').map((c) => c.k);

export function catLabel(k) {
  return CREATIVE_CATS.find((c) => c.k === k)?.label || 'Other';
}

export const BAND_MIN = 4;
export const BAND_MAX = 30;
export const BAND_DEFAULT = 8;
export const TEXT_LIGHT = '#ffffff';
export const TEXT_DARK = '#0A1628';
export const ACCENT = '#ff7a00'; // Heseos orange — the optional accent for the partner's name

// The band caption. Kept here so the admin preview and the Partner app agree on the wording.
export const BAND_LABEL = 'Heseos Partner :';
