# ALMEP

A 3D browser game built with [three.js](https://threejs.org/), set on Sveavägen in Stockholm on the night of Friday 28 February 1986.

The game is a reenactment of the assassination of Olof Palme. You play as the murderer and earn points for how creative your approach is. It's being built in chapters, and **Chapter 1 is the setting itself**: a walkable night-time reconstruction of Sveavägen.

## What's in Chapter 1

- **Sveavägen** between Kungsgatan and the area north of Biografen Grand: a wide boulevard with a central reservation, parked 80s cars, traffic, snowbanks, and lamps hung on wires across the street, Stockholm style.
- **Biografen Grand** (Sveavägen 45), showing *Bröderna Mozart*, with its canopy and marquee.
- **The corner of Tunnelgatan** and the Dekorima shop.
- **Tunnelgatan** and **the stairs** up the Brunkeberg ridge to **Malmskillnadsgatan**.
- **Adolf Fredriks kyrka** and its snowy churchyard with gravestones and bare trees.
- **Adolf Fredriks kyrkogata**, **Kungsgatan** and the **Hötorget T-bana** entrance.
- Falling snow, a running clock that starts at 23:12, a minimap, pedestrians, procedural ambient sound and footsteps.

The layout is a free interpretation, not a survey: distances and building facades are approximate and procedurally generated.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | move |
| Mouse | look (click to capture the pointer) |
| Shift | run |
| C | crouch |
| Space | jump |
| M | toggle large map |
| Esc | pause |

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Everything is generated in code (geometry, canvas textures, audio), so there are no binary assets.

| File | Contents |
| --- | --- |
| `src/layout.js` | street plan, ground heights, points of interest |
| `src/city.js` | ground, buildings, the ridge and stairs, Grand, Dekorima, signs |
| `src/church.js` | Adolf Fredriks kyrka, churchyard, trees, fences |
| `src/lights.js` | wire-hung street lamps, light pools, the dynamic point-light pool |
| `src/vehicles.js` | parked cars and traffic |
| `src/people.js` | pedestrians |
| `src/player.js` | first-person controller and collisions |
| `src/hud.js` | clock, place name, captions, minimap |
| `src/textures.js` | procedural canvas textures (facades, asphalt, snow, signs) |

## Deployment

`.github/workflows/deploy.yml` builds the game and publishes it to GitHub Pages on every push to `main` (and the current development branch). Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.
