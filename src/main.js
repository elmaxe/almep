import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { City } from './city.js';
import { Church } from './church.js';
import { StreetLights } from './lights.js';
import { Vehicles } from './vehicles.js';
import { People } from './people.js';
import { Snow } from './snow.js';
import { Player } from './player.js';
import { Hud } from './hud.js';
import { Ambience } from './audio.js';
import { TouchControls } from './touch.js';

const FOG = new THREE.Color(0x0e121b);
const COARSE = window.matchMedia('(pointer: coarse)').matches;

// --- renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// phones have very dense screens and weak GPUs; trade a little sharpness for frame rate
renderer.setPixelRatio(Math.min(window.devicePixelRatio, COARSE ? 1.25 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = FOG;
scene.fog = new THREE.FogExp2(FOG, 0.0105);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1500);

// keep a usable horizontal field of view on tall (portrait) screens
function fitCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const vfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) / aspect);
  camera.aspect = aspect;
  camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vfov), 70, 95);
  camera.updateProjectionMatrix();
}
fitCamera();

// night sky with a faint orange city glow at the horizon
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(1000, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(0x04060b) }, horizon: { value: new THREE.Color(0x2a2230) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float t = pow(clamp(vP.y,0.0,1.0),0.5); gl_FragColor = vec4(mix(horizon, top, t),1.0); }',
  }),
);
scene.add(sky);

scene.add(new THREE.HemisphereLight(0x4a5a80, 0x1a1614, 0.55));
const moon = new THREE.DirectionalLight(0x8fa3c8, 0.25);
moon.position.set(-60, 120, 40);
scene.add(moon);

// --- world --------------------------------------------------------------------
const world = {
  scene,
  colliders: [],
  footprints: [],
  lampSpecs: [],
  lamps: [],
  extraGlows: [],
  addCollider(x0, x1, z0, z1, maxY = Infinity) {
    this.colliders.push({ x0, x1, z0, z1, maxY });
  },
};

new City(world);
new Church(world);
const lights = new StreetLights(world);
const vehicles = new Vehicles(world);
const people = new People(world);
const snow = new Snow(scene);
const player = new Player(camera, world, renderer.domElement);
player.obstacles = () => people.obstacles();
const hud = new Hud(world);
const audio = new Ambience();
player.onStep = (run) => audio.step(run);

// --- post-processing ----------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.55, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  fitCamera();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

// --- menus / pointer lock / touch ----------------------------------------------
const overlay = document.getElementById('overlay');
const hudEl = document.getElementById('hud');
const startBtn = document.getElementById('start');
let started = false;
let touchMode = false;
let startPointer = null;

function setPlaying(playing) {
  player.enabled = playing;
  overlay.classList.toggle('hidden', playing);
  hudEl.classList.toggle('hidden', !started);
  audio.setPaused(!playing);
  if (!playing) touch.reset();
}

const touch = new TouchControls(player, { onPause: () => setPlaying(false) });

function lock() {
  renderer.domElement.requestPointerLock?.();
}
function goFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req || document.fullscreenElement || document.webkitFullscreenElement) return;
  try {
    req.call(el, { navigationUI: 'hide' })?.catch?.(() => {});
  } catch { /* iPhone Safari has no element fullscreen */ }
}

// remember how the start button was pressed so hybrid devices get the right controls
startBtn.addEventListener('pointerdown', (e) => { startPointer = e.pointerType; });
startBtn.addEventListener('click', () => {
  audio.start();
  touchMode = startPointer ? startPointer === 'touch' || startPointer === 'pen' : COARSE;
  startPointer = null;
  document.body.classList.toggle('touch', touchMode);
  if (!started) {
    started = true;
    startBtn.textContent = 'Resume';
  }
  if (touchMode) {
    goFullscreen();
    setPlaying(true);
  } else {
    lock();
  }
});
renderer.domElement.addEventListener('click', () => { if (started && !touchMode) lock(); });
document.addEventListener('pointerlockchange', () => {
  if (touchMode) return;
  setPlaying(document.pointerLockElement === renderer.domElement);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && touchMode && player.enabled) setPlaying(false);
});
// no pinch-zoom / double-tap zoom while playing (iOS ignores user-scalable=no)
for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

// --- loop ---------------------------------------------------------------------
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  player.update(dt);
  if (player.enabled || !started) {
    vehicles.update(dt, player.pos);
    people.update(dt, player.pos);
    if (started) hud.update(dt, player);
  }
  lights.update(dt, camera.position);
  snow.update(dt, camera.position);
  audio.update(dt, vehicles.nearestDistance(player.pos.x, player.pos.z));
  composer.render();
  requestAnimationFrame(frame);
}
player.update(0);
hud.update(0, player);
frame();

// debug hooks (handy in the console)
window.almep = { world, player, camera, renderer, scene };
