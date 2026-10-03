# ALMEP

A 3D browser game built with [three.js](https://threejs.org/), set on Sveavägen in Stockholm on the night of Friday 28 February 1986.

The game is a reenactment of the assassination of Olof Palme. You play as the murderer and earn points for how creative your approach is. It's being built in chapters: **Chapter 1 is the setting itself**, a walkable night-time reconstruction of Sveavägen, and **Chapter 2 is the walk home**: the couple and the revolver.

## What's in Chapter 1

- **Sveavägen** between Kungsgatan and the area north of Biografen Grand: a wide boulevard with a central reservation, parked 80s cars, traffic, snowbanks, and lamps hung on wires across the street, Stockholm style.
- **Biografen Grand** (Sveavägen 45), showing *Bröderna Mozart*, with its canopy and marquee.
- **The corner of Tunnelgatan** and the Dekorima shop.
- **Tunnelgatan** and **the stairs** up the Brunkeberg ridge to **Malmskillnadsgatan**.
- **Adolf Fredriks kyrka** and its snowy churchyard with gravestones and bare trees.
- **Adolf Fredriks kyrkogata**, **Kungsgatan** and the **Hötorget T-bana** entrance.
- Falling snow, a running clock that starts at 23:12, a minimap, pedestrians, procedural ambient sound and footsteps.

The layout is a free interpretation, not a survey: distances and building facades are approximate and procedurally generated.

## What's in Chapter 2

- **The couple.** At 23:14 on the in-game clock they leave Biografen Grand and walk south on the east pavement, cross Sveavägen on the zebra crossing at Adolf Fredriks kyrkogata, stop for a while at Dekorima's display window, pass the corner of Tunnelgatan and carry on to Hötorget T-bana. They show as a yellow dot on the minimap. If they reach the T-bana, they get away.
- **The revolver.** Six rounds, double action, hitscan from the crosshair. Buildings, parked cars and the ground stop bullets. Muzzle flash, recoil, a gunshot with an echo down the street, and a reload.
- **Reactions.** A missed shot, or a drawn gun they can see within a few metres, makes the couple hurry on towards the T-bana. Pedestrians who hear a shot hurry away from it. If he is hit, he falls and she kneels beside him.
- **Score**, shown when the chapter ends:

  | | |
  | --- | --- |
  | Target down | +1000 |
  | At the corner of Tunnelgatan | +500 |
  | Point blank (under 3 m) | +200 |
  | Long shot (over 25 m) | +20 per metre, up to +500 |
  | One or two shots | +300 |
  | They never saw it coming | +250 |
  | She was hit too | −250 |

  After that you can keep walking around (Chapter 3, the escape, comes next) or start again.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | move |
| Mouse | look (click to capture the pointer) |
| Shift | run |
| C | crouch |
| Space | jump |
| F / 1 | draw / holster the revolver |
| Left click | fire (draws the revolver if it's holstered) |
| R | reload |
| M | toggle large map |
| Esc | pause |

On phones and tablets the game switches to touch controls automatically: drag with the left thumb to walk (push the stick to the edge to run), drag anywhere else to look around, and use the on-screen buttons to fire, draw the gun, jump, crouch and pause. The Fire button shows the rounds left and reloads automatically when the cylinder is empty. Tap the minimap to enlarge it. Both portrait and landscape work; landscape gives the widest view.

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
| `src/vehicles.js` | parked cars and traffic (stops for people on the road) |
| `src/people.js` | pedestrians |
| `src/couple.js` | the couple: their route, walking, reactions |
| `src/weapon.js` | the revolver: viewmodel, firing, hit detection |
| `src/mission.js` | chapter 2 flow: departure time, reactions to shots, scoring |
| `src/player.js` | first-person controller and collisions |
| `src/hud.js` | clock, place name, objective, ammo, captions, minimap |
| `src/textures.js` | procedural canvas textures (facades, asphalt, snow, signs) |

## Deployment

`.github/workflows/deploy.yml` builds the game and publishes it to GitHub Pages on every push to `main` (and the current development branch). Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**.
