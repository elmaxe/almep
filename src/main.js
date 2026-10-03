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

const FOG = new THREE.Color(0x0e121b);

// --- renderer ---------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = FOG;
scene.fog = new THREE.FogExp2(FOG, 0.0105);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1500);

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
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

// --- menus / pointer lock -------------------------------------------------------
const overlay = document.getElementById('overlay');
const hudEl = document.getElementById('hud');
const startBtn = document.getElementById('start');
let started = false;

function lock() {
  renderer.domElement.requestPointerLock?.();
}
startBtn.addEventListener('click', () => {
  audio.start();
  lock();
  if (!started) {
    started = true;
    startBtn.textContent = 'Resume';
  }
});
renderer.domElement.addEventListener('click', () => { if (started) lock(); });
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  player.enabled = locked;
  overlay.classList.toggle('hidden', locked);
  hudEl.classList.toggle('hidden', !started);
  audio.setPaused(!locked);
});

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
