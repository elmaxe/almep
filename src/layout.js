// World layout, in metres. +x = east, -z = north, y = up.
// Sveavägen runs north–south along the z axis. Tunnelgatan leaves it to the
// west at z = 0 and ends at the stairs up the Brunkeberg ridge to
// Malmskillnadsgatan. Adolf Fredriks kyrka sits in its churchyard on the
// east side. The layout is an approximation, not a survey.

export const L = {
  roadHalf: 11, // Sveavägen kerb-to-kerb half width
  front: 16, // building line on both sides
  zNorth: -280,
  zSouth: 200,
  sidewalkH: 0.12,
  plateauH: 11,

  tunnel: { x0: -72, x1: -16, z0: -6, z1: 6, road: 3.5 },
  stairs: { x0: -88, x1: -72, z0: -2.6, z1: 2.6, steps: 30 },
  malm: { x0: -100, x1: -88, z0: -68, z1: 68 },
  kyrkogata: { x0: 16, x1: 110, z0: -96, z1: -84, road0: -94, road1: -86 },
  churchyard: { x0: 16, x1: 110, z0: -84, z1: 40 },
  church: { x: 63, z: -22 },
  kungsgatan: { x0: -70, x1: 70, z0: 148, z1: 168, road0: 152, road1: 164 },
  grand: { z0: -172, z1: -128 },
  murderCorner: { x: -14.5, z: -7 },
};

// Rectangles the player can stand on that are raised to kerb height.
export const SIDEWALKS = [
  // Sveavägen west
  [-16, -11, L.zNorth, -3.5],
  [-16, -11, 3.5, L.kungsgatan.road0],
  [-16, -11, L.kungsgatan.road1, L.zSouth],
  // Sveavägen east
  [11, 16, L.zNorth, L.kyrkogata.road0],
  [11, 16, L.kyrkogata.road1, L.kungsgatan.road0],
  [11, 16, L.kungsgatan.road1, L.zSouth],
  // Tunnelgatan
  [L.tunnel.x0, -16, L.tunnel.z0, -3.5],
  [L.tunnel.x0, -16, 3.5, L.tunnel.z1],
  // Adolf Fredriks kyrkogata
  [16, L.kyrkogata.x1, L.kyrkogata.z0, L.kyrkogata.road0],
  [16, L.kyrkogata.x1, L.kyrkogata.road1, L.kyrkogata.z1],
  // Kungsgatan
  [L.kungsgatan.x0, -11, L.kungsgatan.z0, L.kungsgatan.road0],
  [L.kungsgatan.x0, -11, L.kungsgatan.road1, L.kungsgatan.z1],
  [11, L.kungsgatan.x1, L.kungsgatan.z0, L.kungsgatan.road0],
  [11, L.kungsgatan.x1, L.kungsgatan.road1, L.kungsgatan.z1],
  // churchyard ground (snow)
  [L.churchyard.x0, L.churchyard.x1, L.churchyard.z0, L.churchyard.z1],
];

const inRect = (x, z, r) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];

/** Ground height under (x, z): plateau, stairs, kerb or road. */
export function groundHeight(x, z) {
  if (x <= L.stairs.x0) return L.plateauH;
  const s = L.stairs;
  if (x < s.x1 && z > s.z0 - 0.5 && z < s.z1 + 0.5) {
    const t = (s.x1 - x) / (s.x1 - s.x0);
    const step = Math.min(s.steps, Math.ceil(t * s.steps));
    return (step * L.plateauH) / s.steps;
  }
  for (const r of SIDEWALKS) if (inRect(x, z, r)) return L.sidewalkH;
  return 0;
}

/** Name of the street/place at (x, z), for the HUD. */
export function placeName(x, z, y) {
  if (y > L.plateauH - 1 && x < L.stairs.x0 + 1) return 'Malmskillnadsgatan';
  if (x < L.stairs.x1 && x > L.stairs.x0) return 'Tunnelgatans trappor';
  if (x < -16 && z > L.tunnel.z0 - 1 && z < L.tunnel.z1 + 1) return 'Tunnelgatan';
  if (x > 16 && z >= L.churchyard.z0 && z <= L.churchyard.z1) return 'Adolf Fredriks kyrkogård';
  if (x > 16 && z >= L.kyrkogata.z0 && z < L.kyrkogata.z1) return 'Adolf Fredriks kyrkogata';
  if (Math.abs(x) > 16 && z > L.kungsgatan.z0 && z < L.kungsgatan.z1) return 'Kungsgatan';
  return 'Sveavägen';
}

// Points of interest: shown as a caption when the player is close.
export const POIS = [
  { x: 14, z: -150, r: 14, title: 'Biografen Grand', text: 'Sveavägen 45. Tonight: “Bröderna Mozart” (Suzanne Osten, 1986).' },
  { x: -14, z: -8, r: 7, title: 'Sveavägen / Tunnelgatan', text: 'The corner by the Dekorima art shop. 23:21, Friday 28 February 1986.' },
  { x: -74, z: 0, r: 6, title: 'Tunnelgatans trappor', text: 'The stairs up the Brunkeberg ridge to Malmskillnadsgatan.' },
  { x: -94, z: 0, r: 8, title: 'Malmskillnadsgatan', text: 'The street along the top of the Brunkeberg ridge.' },
  { x: 20, z: -22, r: 9, title: 'Adolf Fredriks kyrka', text: 'Church and churchyard on the east side of Sveavägen.' },
  { x: -13, z: 140, r: 8, title: 'Hötorget T-bana', text: 'Entrance to the underground at Sveavägen / Kungsgatan.' },
  { x: 13, z: -90, r: 6, title: 'Adolf Fredriks kyrkogata', text: 'Cross street on the east side, north of the churchyard.' },
];

// For the minimap: [x0, x1, z0, z1, label?]
export const ROADS = [
  [-L.roadHalf, L.roadHalf, L.zNorth, L.zSouth, 'Sveavägen'],
  [L.tunnel.x0, -16, -L.tunnel.road, L.tunnel.road, 'Tunnelgatan'],
  [16, L.kyrkogata.x1, L.kyrkogata.road0, L.kyrkogata.road1, 'Adolf Fredriks kyrkog.'],
  [L.kungsgatan.x0, L.kungsgatan.x1, L.kungsgatan.road0, L.kungsgatan.road1, 'Kungsgatan'],
  [-98, -90, L.malm.z0, L.malm.z1, 'Malmskillnadsg.'],
];
