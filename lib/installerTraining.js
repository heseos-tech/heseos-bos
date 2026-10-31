// Training videos shown in the Installer app (Profile → Training Videos, and the Home shortcut).
// Plain data, client-safe. Each video is a YouTube video id — the player and thumbnail URLs are
// built from it in components/installer/TrainingScreen.jsx. To add a product or a video, add it
// here; no other file needs to change.
export const TRAINING = [
  {
    key: 'touch-panel',
    product: 'Touch Panel',
    videos: [
      { kind: 'Installation', id: 'uosHJIDu628' },
      { kind: 'Setup', id: '7N6LONJh3mo' },
    ],
  },
  {
    key: 'smart-plug',
    product: 'Smart Plug',
    videos: [
      { kind: 'Installation', id: 'Guv7IORO-7o' },
      { kind: 'Setup', id: '7nHVt4-_dJU' },
    ],
  },
  {
    key: 'ir-blaster',
    product: 'IR Blaster',
    videos: [
      { kind: 'Installation', id: 'F8lwZY_nY4I' },
      { kind: 'Setup', id: '3tokEwMBDKs' },
    ],
  },
  {
    key: 'smart-door-lock',
    product: 'Smart Door Lock',
    videos: [
      { kind: 'Installation', id: 'acdnhngtsjY' },
      { kind: 'Setup', id: 'DfCcomYFZOE' },
    ],
  },
];
