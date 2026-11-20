/**
 * Damage dice in 3D (rules §7.2): ivory d12s (dodecahedra) numbered 1–12 that tumble onto the board and land showing the roll the
 * rules engine made. The engine decides the number; the animation only shows it.
 */
import * as THREE from 'three';

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
    const key = n.toArray().map((v) => v.toFixed(2)).join(',');
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

function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.font = "900 76px Georgia, serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = n === 12 ? '#c8102e' : '#3b1d0e';
  g.fillText(String(n), 64, 68);
  if (n === 6 || n === 9) g.fillRect(40, 104, 48, 7); // underline 6 and 9 so they can't be confused
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
      new THREE.PlaneGeometry(RADIUS * 0.78, RADIUS * 0.78),
      new THREE.MeshBasicMaterial({ map: numberTexture(i + 1), transparent: true, depthWrite: false }),
    );
    label.position.copy(f.centre).multiplyScalar(1.01);
    label.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.normal);
    group.add(label);
  });
  return group;
}

function allFaces(): Face[] {
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
