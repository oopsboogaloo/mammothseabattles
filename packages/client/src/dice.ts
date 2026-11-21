/**
 * Damage dice in 3D (rules §7.2): ivory d12s (dodecahedra) that tumble onto the board and land showing the roll the rules engine
 * made. Each face shows what it does, from the rules' own die table: a brown ship per Ship damage, a green stick figure per Crew
 * damage, a red cross for a Critical hit, blank for a miss. The engine decides the roll; the animation only shows it.
 */
import * as THREE from 'three';
import { DEFAULT_CONFIG, isCritical, type DamageFace } from '@msb/msb-rules';

interface Face {
  normal: THREE.Vector3;
  centre: THREE.Vector3;
}

const RADIUS = 0.56;
let faces: Face[] | null = null;
let template: THREE.Group | null = null;

/** The 12 pentagonal faces of the dodecahedron: Three builds each from 3 triangles, so group triangles by normal. */
function findFaces(geo: THREE.BufferGeometry): Face[] {
  const pos = geo.getAttribute('position');
  const groups = new Map<string, { normal: THREE.Vector3; points: THREE.Vector3[] }>();
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, i);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    // Round to group a face's triangles (|| 0 turns -0 into 0: "-0.00" and "0.00" split faces in two, giving 17 instead of 12).
    const key = n.toArray().map((v) => Math.round(v * 100) || 0).join(',');
    const g = groups.get(key) ?? { normal: n, points: [] };
    g.points.push(a, b, c);
    groups.set(key, g);
  }
  // Each pentagon's corners appear in several of its triangles: average the distinct corners only.
  return [...groups.values()].map((g) => {
    const corners = new Map(g.points.map((p) => [p.toArray().map((v) => v.toFixed(4)).join(','), p]));
    const centre = [...corners.values()].reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(corners.size);
    return { normal: g.normal, centre };
  });
}

const SHIP_BROWN = '#7a4a1f';
const CREW_GREEN = '#2a9d4b';
const CRITICAL_RED = '#c8102e';

/** A little brown ship (hull, mast, sail), centred on (x, y), `s` across. */
function drawShip(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = SHIP_BROWN;
  g.beginPath(); // hull
  g.moveTo(x - s / 2, y + s * 0.12);
  g.lineTo(x + s / 2, y + s * 0.12);
  g.lineTo(x + s * 0.32, y + s * 0.42);
  g.lineTo(x - s * 0.32, y + s * 0.42);
  g.closePath();
  g.fill();
  g.fillRect(x - s * 0.035, y - s * 0.45, s * 0.07, s * 0.58); // mast
  g.beginPath(); // sail
  g.moveTo(x + s * 0.06, y - s * 0.4);
  g.quadraticCurveTo(x + s * 0.46, y - s * 0.12, x + s * 0.06, y + s * 0.06);
  g.closePath();
  g.fill();
}

/** A green stick figure, centred on (x, y), `s` tall. */
function drawCrew(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.strokeStyle = g.fillStyle = CREW_GREEN;
  g.lineWidth = s * 0.11;
  g.lineCap = 'round';
  g.beginPath();
  g.arc(x, y - s * 0.32, s * 0.14, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x, y - s * 0.16); // body
  g.lineTo(x, y + s * 0.14);
  g.moveTo(x - s * 0.24, y - s * 0.06); // arms
  g.lineTo(x + s * 0.24, y - s * 0.06);
  g.moveTo(x, y + s * 0.14); // legs
  g.lineTo(x - s * 0.18, y + s * 0.44);
  g.moveTo(x, y + s * 0.14);
  g.lineTo(x + s * 0.18, y + s * 0.44);
  g.stroke();
}

/** A bold red cross (an X: a plus would look like Heal). */
function drawCritical(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.strokeStyle = CRITICAL_RED;
  g.lineWidth = s * 0.22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s / 2, y - s / 2);
  g.lineTo(x + s / 2, y + s / 2);
  g.moveTo(x + s / 2, y - s / 2);
  g.lineTo(x - s / 2, y + s / 2);
  g.stroke();
}

/** The picture on a die face: one symbol per point of damage (up to 3), side by side, or a cross, or nothing. */
export function faceTexture(face: DamageFace): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  if (isCritical(face)) drawCritical(g, 64, 64, 74);
  else {
    const symbols = [...Array<'ship'>(face.ship).fill('ship'), ...Array<'crew'>(face.crew).fill('crew')];
    // Kept inside the pentagon: one in the middle, two side by side, three as a triangle (two over one).
    const spots: Record<number, [number, number][]> = { 1: [[64, 66]], 2: [[36, 66], [92, 66]], 3: [[40, 44], [88, 44], [64, 94]] };
    const size = [0, 84, 52, 44][symbols.length] as number;
    symbols.forEach((sym, i) => {
      const [x, y] = (spots[symbols.length] as [number, number][])[i] as [number, number];
      (sym === 'ship' ? drawShip : drawCrew)(g, x, y, size);
    });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function build(env: THREE.Texture | null): THREE.Group {
  const geo = new THREE.DodecahedronGeometry(RADIUS);
  faces = allFaces();
  const body = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#f3ead6', roughness: 0.35, metalness: 0, flatShading: true, envMap: env, envMapIntensity: 0.6 }),
  );
  body.castShadow = true;
  const group = new THREE.Group();
  group.add(body);
  faces.forEach((f, i) => {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(RADIUS * 0.96, RADIUS * 0.96),
      new THREE.MeshBasicMaterial({ map: faceTexture(DEFAULT_CONFIG.damageDie[i] as DamageFace), transparent: true, depthWrite: false }),
    );
    label.position.copy(f.centre).multiplyScalar(1.01);
    label.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
    group.add(label);
  });
  return group;
}

export function allFaces(): Face[] {
  faces ??= findFaces(new THREE.DodecahedronGeometry(RADIUS));
  return faces;
}

/** A new die, showing nothing in particular. */
export function makeDie(env: THREE.Texture | null): THREE.Group {
  if (!template) template = build(env);
  return template.clone(true);
}

/** The die's rotation that puts face `value` (1–12) on top, turned `spin` radians about the vertical. */
export function restingRotation(value: number, spin: number): THREE.Quaternion {
  const face = allFaces()[value - 1] as Face;
  const up = new THREE.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin).multiply(up);
}

/** How high the die's centre sits when it rests flat on a face. */
export function restingHeight(): number {
  return (allFaces()[0] as Face).centre.length();
}
