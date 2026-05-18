/**
 * Generates 18 SVG weapon images into client/public/items/.
 * Shape is chosen by the item's weapon type (sword, rifle, lance, ...);
 * colors come from a per-prefix palette (Quantum, Plasma, Ion, ...).
 * Runs before `vite build`. Avoids committing binary PNG assets.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
}

const PREFIX_PALETTES: Record<string, Palette> = {
  Quantum:     { primary: "#7c3aed", secondary: "#c4b5fd", accent: "#a78bfa", bg: "#1e1b3a" },
  Plasma:      { primary: "#f97316", secondary: "#fde68a", accent: "#fb923c", bg: "#3a1a0a" },
  Photon:      { primary: "#facc15", secondary: "#fff7c2", accent: "#fde047", bg: "#2a230a" },
  Neutron:     { primary: "#22c55e", secondary: "#bbf7d0", accent: "#4ade80", bg: "#0a2a18" },
  Ion:         { primary: "#06b6d4", secondary: "#a5f3fc", accent: "#22d3ee", bg: "#0a2a33" },
  Tachyon:     { primary: "#ec4899", secondary: "#fbcfe8", accent: "#f472b6", bg: "#33102a" },
  Graviton:    { primary: "#8b5cf6", secondary: "#ddd6fe", accent: "#a78bfa", bg: "#211a3a" },
  Antimatter:  { primary: "#ef4444", secondary: "#fecaca", accent: "#f87171", bg: "#330d0d" },
  Phase:       { primary: "#3b82f6", secondary: "#bfdbfe", accent: "#60a5fa", bg: "#0d1d3d" },
  Pulse:       { primary: "#10b981", secondary: "#a7f3d0", accent: "#34d399", bg: "#082a23" },
  Cryo:        { primary: "#0ea5e9", secondary: "#e0f2fe", accent: "#38bdf8", bg: "#0a2236" },
  Singularity: { primary: "#a855f7", secondary: "#e9d5ff", accent: "#c084fc", bg: "#1f0d3a" },
  Void:        { primary: "#475569", secondary: "#94a3b8", accent: "#6366f1", bg: "#0a0e1a" },
  Stasis:      { primary: "#14b8a6", secondary: "#99f6e4", accent: "#2dd4bf", bg: "#0a2a2a" },
  Nebula:      { primary: "#d946ef", secondary: "#f5d0fe", accent: "#e879f9", bg: "#2a0d33" },
  Helix:       { primary: "#84cc16", secondary: "#d9f99d", accent: "#a3e635", bg: "#1e2a08" },
  Eclipse:     { primary: "#64748b", secondary: "#cbd5e1", accent: "#f59e0b", bg: "#0d1118" },
  Nova:        { primary: "#f59e0b", secondary: "#fef3c7", accent: "#fbbf24", bg: "#33210a" },
};

type ShapeFn = (p: Palette) => string;

/**
 * Each shape draws horizontally facing right inside the 200x200 viewBox.
 * The composition function wraps every shape in a -18deg rotation so weapons
 * read as diagonal silhouettes in the card grid.
 */
const WEAPON_SHAPES: Record<string, ShapeFn> = {
  Blaster: (p) => `
    <rect x="60" y="92" width="65" height="24" rx="3" fill="${p.primary}" />
    <rect x="60" y="92" width="65" height="6" rx="2" fill="${p.secondary}" opacity="0.85" />
    <rect x="70" y="116" width="22" height="30" rx="3" fill="${p.primary}" />
    <path d="M 72 146 Q 110 152 110 130" fill="none" stroke="${p.primary}" stroke-width="4" />
    <rect x="125" y="86" width="22" height="36" rx="3" fill="${p.primary}" />
    <rect x="147" y="92" width="6" height="24" fill="${p.secondary}" />
    <circle cx="95" cy="104" r="7" fill="${p.accent}" />
    <circle cx="95" cy="104" r="3" fill="${p.secondary}" />`,

  Disruptor: (p) => `
    <rect x="55" y="94" width="58" height="22" rx="3" fill="${p.primary}" />
    <rect x="64" y="116" width="20" height="28" rx="3" fill="${p.primary}" />
    <polygon points="113,90 158,72 152,86 113,100" fill="${p.primary}" />
    <polygon points="113,116 158,134 152,120 113,108" fill="${p.primary}" />
    <polyline points="120,103 135,98 130,108 145,103" fill="none" stroke="${p.accent}" stroke-width="3" stroke-linecap="round" />
    <circle cx="80" cy="105" r="4" fill="${p.accent}" />`,

  Rifle: (p) => `
    <polygon points="32,98 32,128 72,124 75,104" fill="${p.primary}" />
    <rect x="72" y="94" width="40" height="24" rx="2" fill="${p.primary}" />
    <rect x="110" y="100" width="62" height="10" fill="${p.primary}" />
    <rect x="166" y="96" width="8" height="18" fill="${p.secondary}" />
    <rect x="85" y="82" width="22" height="10" rx="1" fill="${p.secondary}" />
    <rect x="92" y="78" width="8" height="6" fill="${p.accent}" />
    <path d="M 92 118 Q 100 130 108 118" fill="none" stroke="${p.primary}" stroke-width="3" />`,

  Carbine: (p) => `
    <rect x="40" y="98" width="26" height="20" rx="2" fill="${p.primary}" />
    <rect x="66" y="92" width="38" height="28" rx="2" fill="${p.primary}" />
    <rect x="76" y="84" width="14" height="8" fill="${p.secondary}" />
    <rect x="104" y="98" width="50" height="14" fill="${p.primary}" />
    <rect x="110" y="100" width="3" height="10" fill="${p.bg}" />
    <rect x="118" y="100" width="3" height="10" fill="${p.bg}" />
    <rect x="126" y="100" width="3" height="10" fill="${p.bg}" />
    <rect x="134" y="100" width="3" height="10" fill="${p.bg}" />
    <rect x="154" y="96" width="8" height="18" fill="${p.secondary}" />
    <path d="M 82 120 Q 92 132 102 120" fill="none" stroke="${p.primary}" stroke-width="3" />`,

  Cannon: (p) => `
    <rect x="35" y="84" width="30" height="42" rx="3" fill="${p.primary}" />
    <rect x="65" y="76" width="92" height="58" rx="6" fill="${p.primary}" />
    <rect x="82" y="74" width="5" height="62" fill="${p.bg}" opacity="0.5" />
    <rect x="104" y="74" width="5" height="62" fill="${p.bg}" opacity="0.5" />
    <rect x="126" y="74" width="5" height="62" fill="${p.bg}" opacity="0.5" />
    <circle cx="157" cy="105" r="14" fill="${p.accent}" />
    <circle cx="157" cy="105" r="7" fill="${p.secondary}" />`,

  Pistol: (p) => `
    <rect x="58" y="84" width="82" height="22" rx="3" fill="${p.primary}" />
    <rect x="58" y="84" width="82" height="6" rx="2" fill="${p.secondary}" opacity="0.85" />
    <rect x="130" y="80" width="4" height="6" fill="${p.secondary}" />
    <polygon points="76,106 100,106 112,150 84,150" fill="${p.primary}" />
    <path d="M 100 106 Q 112 116 112 128 L 104 128 Q 104 118 96 116 Z" fill="${p.primary}" />
    <rect x="86" y="118" width="14" height="3" fill="${p.bg}" opacity="0.6" />
    <rect x="86" y="125" width="14" height="3" fill="${p.bg}" opacity="0.6" />
    <rect x="135" y="92" width="5" height="8" fill="${p.accent}" />`,

  Hammer: (p) => `
    <rect x="40" y="100" width="90" height="10" rx="2" fill="${p.secondary}" />
    <rect x="44" y="98" width="3" height="14" fill="${p.bg}" />
    <rect x="52" y="98" width="3" height="14" fill="${p.bg}" />
    <rect x="60" y="98" width="3" height="14" fill="${p.bg}" />
    <rect x="125" y="68" width="48" height="74" rx="4" fill="${p.primary}" />
    <rect x="120" y="78" width="6" height="54" fill="${p.primary}" />
    <rect x="172" y="78" width="6" height="54" fill="${p.primary}" />
    <rect x="146" y="74" width="6" height="62" fill="${p.accent}" opacity="0.85" />`,

  Lance: (p) => `
    <rect x="30" y="100" width="115" height="8" rx="2" fill="${p.secondary}" />
    <rect x="36" y="98" width="4" height="12" fill="${p.bg}" />
    <rect x="44" y="98" width="4" height="12" fill="${p.bg}" />
    <rect x="52" y="98" width="4" height="12" fill="${p.bg}" />
    <polygon points="145,80 180,104 145,128" fill="${p.primary}" />
    <polygon points="148,92 170,104 148,116" fill="${p.accent}" />
    <line x1="160" y1="104" x2="178" y2="104" stroke="${p.secondary}" stroke-width="2" />`,

  Sword: (p) => `
    <circle cx="42" cy="104" r="8" fill="${p.secondary}" />
    <rect x="50" y="98" width="22" height="12" rx="2" fill="${p.secondary}" />
    <rect x="68" y="84" width="10" height="40" rx="2" fill="${p.primary}" />
    <polygon points="78,96 168,96 180,104 168,112 78,112" fill="${p.primary}" />
    <line x1="82" y1="104" x2="170" y2="104" stroke="${p.accent}" stroke-width="2" />`,

  Beam: (p) => `
    <rect x="40" y="86" width="52" height="36" rx="5" fill="${p.primary}" />
    <rect x="40" y="86" width="52" height="8" rx="2" fill="${p.secondary}" opacity="0.8" />
    <rect x="50" y="98" width="3" height="14" fill="${p.bg}" />
    <rect x="58" y="98" width="3" height="14" fill="${p.bg}" />
    <rect x="66" y="98" width="3" height="14" fill="${p.bg}" />
    <circle cx="96" cy="104" r="10" fill="${p.accent}" />
    <polygon points="100,98 175,90 175,118 100,110" fill="${p.accent}" opacity="0.55" />
    <polygon points="105,100 175,96 175,112 105,108" fill="${p.secondary}" opacity="0.65" />`,

  Coil: (p) => `
    <rect x="35" y="102" width="130" height="6" rx="2" fill="${p.secondary}" />
    <path d="M 50 105 Q 60 88 70 105 Q 80 122 90 105 Q 100 88 110 105 Q 120 122 130 105 Q 140 88 150 105"
          fill="none" stroke="${p.primary}" stroke-width="6" stroke-linecap="round" />
    <path d="M 50 105 Q 60 88 70 105 Q 80 122 90 105 Q 100 88 110 105 Q 120 122 130 105 Q 140 88 150 105"
          fill="none" stroke="${p.accent}" stroke-width="2" stroke-linecap="round" opacity="0.85" />
    <circle cx="168" cy="105" r="9" fill="${p.accent}" />
    <circle cx="168" cy="105" r="4" fill="${p.secondary}" />`,

  Bow: (p) => `
    <path d="M 70 42 Q 168 105 70 158" fill="none" stroke="${p.primary}" stroke-width="9" stroke-linecap="round" />
    <path d="M 70 42 Q 158 105 70 158" fill="none" stroke="${p.secondary}" stroke-width="3" stroke-linecap="round" opacity="0.7" />
    <line x1="70" y1="42" x2="70" y2="158" stroke="${p.accent}" stroke-width="2" />
    <rect x="62" y="92" width="16" height="24" rx="2" fill="${p.bg}" opacity="0.75" />
    <circle cx="70" cy="100" r="4" fill="${p.accent}" />`,

  Reaper: (p) => `
    <line x1="35" y1="165" x2="145" y2="65" stroke="${p.secondary}" stroke-width="8" stroke-linecap="round" />
    <line x1="48" y1="148" x2="55" y2="155" stroke="${p.bg}" stroke-width="3" />
    <line x1="58" y1="138" x2="65" y2="145" stroke="${p.bg}" stroke-width="3" />
    <line x1="68" y1="128" x2="75" y2="135" stroke="${p.bg}" stroke-width="3" />
    <path d="M 145 65 C 175 60 180 30 178 20 C 168 42 155 58 142 65 Z" fill="${p.primary}" />
    <path d="M 148 65 C 168 60 174 36 172 26 C 165 44 154 58 145 64 Z" fill="${p.accent}" opacity="0.75" />`,

  Blade: (p) => `
    <circle cx="42" cy="116" r="7" fill="${p.secondary}" />
    <rect x="48" y="110" width="20" height="14" rx="2" fill="${p.secondary}" />
    <path d="M 66 108 Q 64 124 72 124 L 80 124 Q 72 110 72 108 Z" fill="${p.primary}" />
    <path d="M 70 108 C 110 85 145 68 175 52 L 178 60 C 150 78 110 100 76 118 Z" fill="${p.primary}" />
    <path d="M 75 110 C 110 88 145 72 173 58 L 174 62 C 145 78 110 96 80 116 Z" fill="${p.accent}" opacity="0.55" />`,

  Striker: (p) => `
    <rect x="34" y="102" width="120" height="6" rx="2" fill="${p.secondary}" />
    <polygon points="154,80 180,105 154,130" fill="${p.primary}" />
    <polygon points="154,80 165,72 168,90 158,92" fill="${p.primary}" />
    <polygon points="154,130 165,138 168,120 158,118" fill="${p.primary}" />
    <polygon points="158,94 170,105 158,116" fill="${p.accent}" />
    <rect x="138" y="100" width="16" height="10" fill="${p.bg}" opacity="0.55" />
    <line x1="142" y1="98" x2="142" y2="112" stroke="${p.accent}" stroke-width="1.5" />
    <line x1="148" y1="98" x2="148" y2="112" stroke="${p.accent}" stroke-width="1.5" />`,
};

const ITEMS = [
  { id: 1,  name: "Quantum Blaster",    prefix: "Quantum",     weapon: "Blaster" },
  { id: 2,  name: "Plasma Disruptor",   prefix: "Plasma",      weapon: "Disruptor" },
  { id: 3,  name: "Photon Rifle",       prefix: "Photon",      weapon: "Rifle" },
  { id: 4,  name: "Neutron Carbine",    prefix: "Neutron",     weapon: "Carbine" },
  { id: 5,  name: "Ion Cannon",         prefix: "Ion",         weapon: "Cannon" },
  { id: 6,  name: "Tachyon Pistol",     prefix: "Tachyon",     weapon: "Pistol" },
  { id: 7,  name: "Graviton Hammer",    prefix: "Graviton",    weapon: "Hammer" },
  { id: 8,  name: "Antimatter Lance",   prefix: "Antimatter",  weapon: "Lance" },
  { id: 9,  name: "Phase Sword",        prefix: "Phase",       weapon: "Sword" },
  { id: 10, name: "Pulse Cannon",       prefix: "Pulse",       weapon: "Cannon" },
  { id: 11, name: "Cryo Beam",          prefix: "Cryo",        weapon: "Beam" },
  { id: 12, name: "Singularity Pistol", prefix: "Singularity", weapon: "Pistol" },
  { id: 13, name: "Void Reaper",        prefix: "Void",        weapon: "Reaper" },
  { id: 14, name: "Stasis Coil",        prefix: "Stasis",      weapon: "Coil" },
  { id: 15, name: "Nebula Bow",         prefix: "Nebula",      weapon: "Bow" },
  { id: 16, name: "Helix Lance",        prefix: "Helix",       weapon: "Lance" },
  { id: 17, name: "Eclipse Blade",      prefix: "Eclipse",     weapon: "Blade" },
  { id: 18, name: "Nova Striker",       prefix: "Nova",        weapon: "Striker" },
] as const;

function svg(weapon: string, p: Palette, id: number): string {
  const shape = WEAPON_SHAPES[weapon];
  if (!shape) throw new Error(`No shape for weapon: ${weapon}`);
  // Float bob: a few units up and down, slow pause at peaks via spline easing.
  // Per-item duration and phase variation so the catalogue doesn't pulse in unison.
  const dur = (2.6 + ((id * 0.17) % 1.2)).toFixed(2);
  const offset = (-((id * 0.41) % parseFloat(dur))).toFixed(2);
  const amp = 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${p.primary}" stop-opacity="0.4" />
      <stop offset="100%" stop-color="${p.bg}" stop-opacity="1" />
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.55">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.45" />
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="14" fill="url(#bg)" />
  <rect width="200" height="200" rx="14" fill="url(#glow)" />
  <g>
    <animateTransform attributeName="transform" attributeType="XML" type="translate"
      values="0 -${amp}; 0 ${amp}; 0 -${amp}" keyTimes="0;0.5;1"
      calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"
      dur="${dur}s" begin="${offset}s" repeatCount="indefinite" />
    <g transform="rotate(-18 100 100)">${shape(p)}
    </g>
  </g>
</svg>`;
}

const outDir = resolve(import.meta.dirname!, "..", "public", "items");
mkdirSync(outDir, { recursive: true });
for (const item of ITEMS) {
  const palette = PREFIX_PALETTES[item.prefix];
  if (!palette) throw new Error(`No palette for prefix: ${item.prefix}`);
  const file = join(outDir, `${item.id}.svg`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg(item.weapon, palette, item.id), "utf8");
}
console.log(`Generated ${ITEMS.length} weapon SVGs into ${outDir}`);
