/**
 * Treasure pieces as small 3D objects (rules §3.7): a barrel of rum, a diamond, a ruby, a pearl and gold bars. All are worth the
 * same; they only look different, like the physical replicas that sit in the back of the ship model. Built from simple shapes, so
 * there are no model files to load.
 */
import * as THREE from 'three';
import type { TreasureKind } from '@msb/msb-rules';

const cache = new Map<TreasureKind, THREE.Group>();
let envMap: THREE.Texture | null = null;

/** Something for gold and gems to reflect (set once by the table); without it metal looks brown. */
export function setTreasureEnvironment(tex: THREE.Texture) {
  envMap = tex;
  cache.clear();
}

/** A brilliant cut: a flat table, a short crown and a deep pointed pavilion. Flat-shaded so the facets catch the light. */
function gem(colour: string, size: number, emissive: string): THREE.Object3D {
  const mat = new THREE.MeshPhysicalMaterial({
    color: colour,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.35,
    ior: 2.2,
    thickness: 0.4,
    clearcoat: 1,
    emissive,
    emissiveIntensity: 0.25,
    flatShading: true,
  });
  const g = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.62, size, size * 0.38, 8, 1), mat);
  crown.position.y = size * 0.19;
  const pavilion = new THREE.Mesh(new THREE.ConeGeometry(size, size * 1.05, 8, 1), mat);
  pavilion.rotation.x = Math.PI;
  pavilion.position.y = -size * 0.52;
  g.add(crown, pavilion);
  g.position.y = size * 1.05;
  return g;
}

function barrel(): THREE.Object3D {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5326', roughness: 0.7 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2d2a28', metalness: 0.7, roughness: 0.4 });
  // Bulging staves: a lathe of a curved profile.
  const pts = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return new THREE.Vector2(0.17 + 0.05 * Math.sin(Math.PI * t), t * 0.46);
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), wood);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.17, 18), wood);
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = 0.46;
  g.add(body, lid);
  for (const y of [0.07, 0.39]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 24), iron);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    g.add(hoop);
  }
  // Lying on its side, as cargo does.
  g.rotation.z = Math.PI / 2;
  g.position.set(0.23, 0.2, 0);
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}

function goldBars(): THREE.Object3D {
  const mat = new THREE.MeshStandardMaterial({ color: '#d99a1e', metalness: 1, roughness: 0.28 });
  // An ingot: a trapezoid prism (narrower on top).
  const shape = new THREE.Shape([new THREE.Vector2(-0.2, 0), new THREE.Vector2(0.2, 0), new THREE.Vector2(0.15, 0.1), new THREE.Vector2(-0.15, 0.1)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
  geo.translate(0, 0, -0.06);
  const g = new THREE.Group();
  for (const [x, y, z, r] of [[-0.11, 0, -0.08, 0], [0.11, 0, -0.08, 0], [0, 0, 0.09, 0], [0, 0.1, 0, Math.PI / 2]] as const) {
    const bar = new THREE.Mesh(geo, mat);
    bar.userData.gold = true;
    bar.position.set(x, y, z);
    bar.rotation.y = r;
    g.add(bar);
  }
  return g;
}

function pearl(): THREE.Object3D {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: '#d9c8b4', roughness: 0.6, side: THREE.DoubleSide });
  // An open oyster shell, a shallow bowl, with the pearl sitting in it.
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.26, 18, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), shellMat);
  shell.scale.set(1, 0.55, 0.8);
  shell.position.y = 0.15;
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: '#fbf6ee', roughness: 0.15, sheen: 1, sheenColor: '#ffd6f0', iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }),
  );
  ball.position.y = 0.16;
  g.add(shell, ball);
  return g;
}

function build(kind: TreasureKind): THREE.Group {
  const g = new THREE.Group();
  g.add(
    kind === 'rum' ? barrel()
    : kind === 'gold' ? goldBars()
    : kind === 'pearl' ? pearl()
    : kind === 'diamond' ? gem('#e9f7ff', 0.2, '#6fb8ff')
    : gem('#a8001c', 0.2, '#3a0008'),
  );
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (envMap) {
      mat.envMap = envMap;
      mat.envMapIntensity = mesh.userData.gold ? 1.1 : 0.7;
    }
  });
  return g;
}

/** A new copy of a treasure piece, about 0.5 world units across, standing on y = 0. */
export function treasurePiece(kind: TreasureKind): THREE.Group {
  let model = cache.get(kind);
  if (!model) {
    model = build(kind);
    cache.set(kind, model);
  }
  const copy = model.clone(true);
  copy.userData.kind = kind;
  return copy;
}

export const TREASURE_NAME: Record<TreasureKind, string> = {
  rum: 'a barrel of rum',
  diamond: 'a diamond',
  ruby: 'a ruby',
  pearl: 'a pearl',
  gold: 'gold bars',
};
