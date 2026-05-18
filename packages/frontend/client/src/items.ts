export type Rarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

export interface Stats {
  damage: number;
  fireRate: number;
  range: number;
  accuracy: number;
}

export interface Effect {
  name: string;
  description: string;
}

export interface Item {
  id: number;
  name: string;
  priceEth: string;
  image: string;
  color: string;
  weaponType: string;
  rarity: Rarity;
  flavor: string;
  effect: Effect;
  stats: Stats;
}

/**
 * The 18-weapon catalogue — mirrors the original Paima payments template.
 * Prices span 0.013–0.021 ETH. Images are procedurally generated SVGs
 * (see client/scripts/gen-items.ts). Stats and flavor are hand-tuned.
 */
export const ITEMS: Item[] = [
  {
    id: 1,
    name: "Quantum Blaster",
    priceEth: "0.013",
    color: "#7c3aed",
    image: "/items/1.svg",
    weaponType: "Blaster",
    rarity: "Common",
    flavor:
      "Forged from quantum-stabilized alloy. The recoil hums at frequencies only physicists love.",
    effect: {
      name: "Tachyon Burst",
      description: "5% chance to fire a second projectile from a parallel state.",
    },
    stats: { damage: 48, fireRate: 82, range: 58, accuracy: 64 },
  },
  {
    id: 2,
    name: "Plasma Disruptor",
    priceEth: "0.014",
    color: "#f97316",
    image: "/items/2.svg",
    weaponType: "Disruptor",
    rarity: "Uncommon",
    flavor:
      "Ionizes shielding before liquefying it. Outlawed in three solar systems, including this one.",
    effect: {
      name: "Plasma Field",
      description: "Targets hit are slowed for 2.0s and take +15% energy damage.",
    },
    stats: { damage: 56, fireRate: 68, range: 52, accuracy: 62 },
  },
  {
    id: 3,
    name: "Photon Rifle",
    priceEth: "0.013",
    color: "#facc15",
    image: "/items/3.svg",
    weaponType: "Rifle",
    rarity: "Common",
    flavor:
      "Standard issue for Outer Belt patrols. Discontinued after Carcosa, then quietly re-issued in 2419.",
    effect: {
      name: "Photon Lens",
      description: "+20% damage when scoped from beyond 30m.",
    },
    stats: { damage: 58, fireRate: 50, range: 88, accuracy: 86 },
  },
  {
    id: 4,
    name: "Neutron Carbine",
    priceEth: "0.015",
    color: "#22c55e",
    image: "/items/4.svg",
    weaponType: "Carbine",
    rarity: "Uncommon",
    flavor:
      "Compact and mean. Fires neutron pulses that punch through unshielded armor like cardboard.",
    effect: {
      name: "Neutron Stack",
      description: "Consecutive hits on the same target build +5% damage per stack, up to 5 stacks.",
    },
    stats: { damage: 54, fireRate: 78, range: 68, accuracy: 72 },
  },
  {
    id: 5,
    name: "Ion Cannon",
    priceEth: "0.016",
    color: "#06b6d4",
    image: "/items/5.svg",
    weaponType: "Cannon",
    rarity: "Rare",
    flavor:
      "Mounted on capital ships originally. Someone bolted one to a shoulder rig and called it innovation.",
    effect: {
      name: "Ion Overcharge",
      description: "Charged shots deal +75% damage and disable shields for 3s.",
    },
    stats: { damage: 84, fireRate: 28, range: 70, accuracy: 56 },
  },
  {
    id: 6,
    name: "Tachyon Pistol",
    priceEth: "0.013",
    color: "#ec4899",
    image: "/items/6.svg",
    weaponType: "Pistol",
    rarity: "Common",
    flavor:
      "Fires faster-than-light particles. The flash arrives before the shot is loaded.",
    effect: {
      name: "Precognition",
      description: "First shot after holstering always crits.",
    },
    stats: { damage: 42, fireRate: 88, range: 44, accuracy: 76 },
  },
  {
    id: 7,
    name: "Graviton Hammer",
    priceEth: "0.019",
    color: "#8b5cf6",
    image: "/items/7.svg",
    weaponType: "Hammer",
    rarity: "Epic",
    flavor:
      "Each swing carries the gravitational mass of a small moon. Suit servos sold separately.",
    effect: {
      name: "Gravity Well",
      description: "Slams pull enemies within 4m toward the impact point and stun for 1.5s.",
    },
    stats: { damage: 92, fireRate: 24, range: 14, accuracy: 70 },
  },
  {
    id: 8,
    name: "Antimatter Lance",
    priceEth: "0.021",
    color: "#ef4444",
    image: "/items/8.svg",
    weaponType: "Lance",
    rarity: "Legendary",
    flavor:
      "Tip contains a contained antimatter cell. Contact with matter triggers brief, beautiful annihilation.",
    effect: {
      name: "Annihilation",
      description: "Killing blows release a 6m antimatter explosion. Damage scales with target HP.",
    },
    stats: { damage: 95, fireRate: 30, range: 60, accuracy: 82 },
  },
  {
    id: 9,
    name: "Phase Sword",
    priceEth: "0.017",
    color: "#3b82f6",
    image: "/items/9.svg",
    weaponType: "Sword",
    rarity: "Rare",
    flavor:
      "Blade exists across two adjacent dimensions. Armor never knows which one to stop.",
    effect: {
      name: "Phase Strike",
      description: "Attacks ignore 40% of target armor and cannot be parried.",
    },
    stats: { damage: 84, fireRate: 72, range: 18, accuracy: 80 },
  },
  {
    id: 10,
    name: "Pulse Cannon",
    priceEth: "0.018",
    color: "#10b981",
    image: "/items/10.svg",
    weaponType: "Cannon",
    rarity: "Epic",
    flavor:
      "Rapid-fire energy cannon developed for siege work. The sustained hum is heard on neighboring planets.",
    effect: {
      name: "Sustained Pulse",
      description: "Hold to charge a sweeping beam that deals area damage in a 45° arc.",
    },
    stats: { damage: 78, fireRate: 54, range: 72, accuracy: 68 },
  },
  {
    id: 11,
    name: "Cryo Beam",
    priceEth: "0.014",
    color: "#0ea5e9",
    image: "/items/11.svg",
    weaponType: "Beam",
    rarity: "Uncommon",
    flavor:
      "Coolant developed for fusion reactors, weaponized after a particularly icy divorce.",
    effect: {
      name: "Deep Freeze",
      description: "Continuous fire builds Frozen, immobilizing targets at 100 stacks for 2.5s.",
    },
    stats: { damage: 50, fireRate: 70, range: 76, accuracy: 84 },
  },
  {
    id: 12,
    name: "Singularity Pistol",
    priceEth: "0.020",
    color: "#a855f7",
    image: "/items/12.svg",
    weaponType: "Pistol",
    rarity: "Legendary",
    flavor:
      "Each shot is a stable micro-black-hole. Recoil exists only as a suggestion.",
    effect: {
      name: "Event Horizon",
      description: "Shots leave a 1.5m singularity for 2s that pulls and damages nearby enemies.",
    },
    stats: { damage: 70, fireRate: 80, range: 58, accuracy: 88 },
  },
  {
    id: 13,
    name: "Void Reaper",
    priceEth: "0.021",
    color: "#475569",
    image: "/items/13.svg",
    weaponType: "Reaper",
    rarity: "Legendary",
    flavor:
      "Forged in the gaps between things. Its edge cuts the concept of an enemy out of reality.",
    effect: {
      name: "Voidshear",
      description: "Crits remove the target's last 25% HP as true damage that ignores all defenses.",
    },
    stats: { damage: 88, fireRate: 36, range: 22, accuracy: 78 },
  },
  {
    id: 14,
    name: "Stasis Coil",
    priceEth: "0.015",
    color: "#14b8a6",
    image: "/items/14.svg",
    weaponType: "Coil",
    rarity: "Uncommon",
    flavor:
      "Wound by hand by monks on a station that has, technically, never moved.",
    effect: {
      name: "Stasis Lock",
      description: "Targets that take 3 hits within 1.5s are held in stasis for 1s and take +30% damage.",
    },
    stats: { damage: 52, fireRate: 74, range: 64, accuracy: 76 },
  },
  {
    id: 15,
    name: "Nebula Bow",
    priceEth: "0.016",
    color: "#d946ef",
    image: "/items/15.svg",
    weaponType: "Bow",
    rarity: "Rare",
    flavor:
      "Pulled string is a strand of nebular plasma. Loose it and the universe holds its breath.",
    effect: {
      name: "Stellar Drift",
      description: "Arrows accelerate over distance — gain +50% damage past 25m.",
    },
    stats: { damage: 70, fireRate: 46, range: 92, accuracy: 90 },
  },
  {
    id: 16,
    name: "Helix Lance",
    priceEth: "0.017",
    color: "#84cc16",
    image: "/items/16.svg",
    weaponType: "Lance",
    rarity: "Rare",
    flavor:
      "Twin counter-rotating tips drill through plating. Originally a mining tool, allegedly.",
    effect: {
      name: "Helix Pierce",
      description: "Thrusts pass through up to 3 targets, dealing -25% damage per pass.",
    },
    stats: { damage: 78, fireRate: 40, range: 38, accuracy: 80 },
  },
  {
    id: 17,
    name: "Eclipse Blade",
    priceEth: "0.019",
    color: "#64748b",
    image: "/items/17.svg",
    weaponType: "Blade",
    rarity: "Epic",
    flavor:
      "Forged during a five-minute total eclipse. The metal still remembers the cold.",
    effect: {
      name: "Penumbra",
      description: "Backstabs deal +120% damage and grant 1.5s of invisibility.",
    },
    stats: { damage: 86, fireRate: 64, range: 16, accuracy: 82 },
  },
  {
    id: 18,
    name: "Nova Striker",
    priceEth: "0.021",
    color: "#f59e0b",
    image: "/items/18.svg",
    weaponType: "Striker",
    rarity: "Legendary",
    flavor:
      "Kinetic mass-launcher with stellar payload. Each shot has the metabolic budget of a small star.",
    effect: {
      name: "Going Nova",
      description: "Charged shots detonate on impact with a 5m blast and ignite the area for 4s.",
    },
    stats: { damage: 90, fireRate: 38, range: 78, accuracy: 78 },
  },
];

export function getItem(id: number): Item | undefined {
  return ITEMS.find((it) => it.id === id);
}
