/**
 * The 3D tabletop (web-spec §4.5): the printed sea map lying flat on a table, ships as miniatures standing on it,
 * overlays drawn like translucent markings. Gentle perspective, limited orbit.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { hexKey, type Direction, type Hex } from '@msb/hex';
import type { SailLevel, TreasureKind } from '@msb/msb-rules';
import { setTreasureEnvironment, treasurePiece } from './treasure-models';
import { makeDie, restingHeight, restingRotation } from './dice';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { hexToOffset, offsetToHex } from './game';

export interface MapInfo {
  width: number;
  height: number;
  size: number;
  originX: number;
  originY: number;
  hexes: [number, number][];
}

const PX = 100; // map pixels per world unit
const SHIP_SCALE = 2.0;

export interface ShipView {
  id: string;
  colour: string;
  hex: Hex;
  heading: Direction;
  sail: SailLevel;
  selected: boolean;
  /** The treasure piece in her hold, if any (rules §3.7). */
  cargo?: TreasureKind;
}

interface ShipObj {
  root: THREE.Group;
  sails: THREE.Object3D[];
  label: HTMLElement;
  cargo?: THREE.Object3D | undefined;
}

export class Table {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private map!: MapInfo;
  private board = new THREE.Group();
  private shipTemplate: THREE.Group | null = null;
  private ships = new Map<string, ShipObj>();
  private ghosts = new THREE.Group();
  private overlay = new THREE.Group();
  private fx = new THREE.Group();
  private labels: { el: HTMLElement; pos: THREE.Vector3 }[] = [];
  private raycaster = new THREE.Raycaster();
  private hexGeo!: THREE.CircleGeometry;
  private home = { target: new THREE.Vector3(), pos: new THREE.Vector3() };
  onShipClick: (id: string | null) => void = () => {};
  /** Mouse over the board (not touch): the hex under the pointer, or null off the board. */
  onHover: (h: Hex | null, clientX: number, clientY: number) => void = () => {};
  private hoverMesh: THREE.Mesh | null = null;
  private arcs = new THREE.Group();
  private treasureGroup = new THREE.Group();
  private env: THREE.Texture | null = null;
  /** The ship model's size once scaled, for placing cargo in her hold. */
  private shipBox = new THREE.Box3();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05);

  constructor(private host: HTMLElement, private labelLayer: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = false;
    this.controls.minPolarAngle = 0.15; // ~10° from vertical
    this.controls.maxPolarAngle = 1.0; // ~57°
    this.controls.minAzimuthAngle = -0.6;
    this.controls.maxAzimuthAngle = 0.6;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 90;
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };

    this.scene.background = new THREE.Color('#2b211b');
    this.scene.add(new THREE.HemisphereLight('#fff6e8', '#4a3626', 1.6));
    const sun = new THREE.DirectionalLight('#fff1dc', 2.2);
    sun.position.set(-14, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(this.board, this.ghosts, this.overlay, this.fx, this.arcs, this.treasureGroup);
    this.addTableTop();
    this.env = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    setTreasureEnvironment(this.env);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    let down: { x: number; y: number } | null = null;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) this.pick(e);
      down = null;
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !this.map) return;
      const h = e.buttons ? null : this.hexAt(e.clientX, e.clientY);
      this.showHover(h);
      this.onHover(h, e.clientX, e.clientY);
    });
    el.addEventListener('pointerleave', () => (this.showHover(null), this.onHover(null, 0, 0)));
    const tick = () => {
      // Loose treasure turns slowly and bobs, so it catches the eye.
      const t = performance.now() / 1000;
      for (const piece of this.treasureGroup.children) {
        if (!piece.userData.loose) continue;
        piece.rotation.y = t * 0.8 + piece.userData.phase;
        piece.position.y = piece.userData.y + Math.sin(t * 2 + piece.userData.phase) * 0.06;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.placeLabels();
      requestAnimationFrame(tick);
    };
    tick();
  }

  private addTableTop() {
    // Procedural wood: warm planks with soft grain (placeholder for a table texture).
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 1024;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      const hue = 24 + ((i * 37) % 7);
      g.fillStyle = `hsl(${hue} 38% ${26 + ((i * 13) % 6)}%)`;
      g.fillRect(0, i * 128, 1024, 128);
      for (let k = 0; k < 60; k++) {
        g.strokeStyle = `hsla(${hue} 40% ${18 + Math.random() * 14}% / 0.35)`;
        g.lineWidth = 1 + Math.random() * 2;
        const y = i * 128 + Math.random() * 128;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(300, y + Math.random() * 10 - 5, 700, y + Math.random() * 10 - 5, 1024, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(0, i * 128, 1024, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    tex.anisotropy = 8;
    const table = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.02;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  async loadMap(id: string): Promise<MapInfo> {
    const map: MapInfo = await (await fetch(`art/maps/${id}.json`)).json();
    const tex = await new THREE.TextureLoader().loadAsync(`art/maps/${id}.webp`);
    this.showBoard(map, tex);
    return map;
  }

  /** A board drawn on a canvas (board-art.ts), for maps with no printed art. */
  loadBoard(map: MapInfo, canvas: HTMLCanvasElement): MapInfo {
    this.showBoard(map, new THREE.CanvasTexture(canvas));
    return map;
  }

  private showBoard(map: MapInfo, tex: THREE.Texture) {
    this.map = map;
    this.board.clear();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const w = map.width / PX, h = map.height / PX;
    const geo = new THREE.PlaneGeometry(w, h);
    const sheet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.6 }));
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.y = 0.04;
    sheet.receiveShadow = true;
    // The printed tiles have a little thickness: a dark copy just below, slightly offset, reads as the board's edge.
    const edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#000000', map: tex, transparent: true, opacity: 0.6, alphaTest: 0.5 }));
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0.05, 0.01, 0.07);
    this.board.add(edge, sheet);
    this.hexGeo = new THREE.CircleGeometry((map.size / PX) * 0.94, 6);
    this.hexGeo.rotateX(-Math.PI / 2);
    // Default view: whole board, north up, gentle tilt.
    const dist = ((h * 0.5) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.0;
    const tilt = THREE.MathUtils.degToRad(30);
    this.home.target.set(0, 0, 0.9);
    this.home.pos.set(0, Math.cos(tilt) * dist, 0.9 + Math.sin(tilt) * dist);
    this.resetView();
  }

  async loadShip(lowDetail: boolean) {
    const gltf = await new GLTFLoader().loadAsync(lowDetail ? 'models/ship-lod.glb' : 'models/ship.glb');
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.shipTemplate = gltf.scene;
    this.shipBox = new THREE.Box3().setFromObject(gltf.scene);
    this.shipBox.min.multiplyScalar(SHIP_SCALE);
    this.shipBox.max.multiplyScalar(SHIP_SCALE);
  }

  /** Hex centre in world space. */
  hexToWorld(h: Hex, y = 0.05): THREE.Vector3 {
    const [col, row] = hexToOffset(h);
    const m = this.map, s = m.size, hh = Math.sqrt(3) * s;
    const px = m.originX + 1.5 * s * col;
    const py = m.originY + hh * (row + 0.5 * (col & 1));
    return new THREE.Vector3((px - m.width / 2) / PX, y, (py - m.height / 2) / PX);
  }

  /** The board hex under a screen point, or null. */
  hexAt(clientX: number, clientY: number): Hex | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return null;
    const m = this.map, hh = Math.sqrt(3) * m.size;
    const px = p.x * PX + m.width / 2, py = p.z * PX + m.height / 2;
    let best: [number, number] | null = null, bestD = Infinity;
    for (const [col, row] of m.hexes) {
      const d = Math.hypot(m.originX + 1.5 * m.size * col - px, m.originY + hh * (row + 0.5 * (col & 1)) - py);
      if (d < bestD) (bestD = d), (best = [col, row]);
    }
    return best && bestD < m.size ? offsetToHex(best[0], best[1]) : null;
  }

  private showHover(h: Hex | null) {
    if (!this.hoverMesh) {
      const r = (this.map.size / PX) * 0.98;
      const ring = new THREE.RingGeometry(r * 0.86, r, 6, 1);
      ring.rotateX(-Math.PI / 2);
      this.hoverMesh = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: '#ffe680', transparent: true, opacity: 0.9, depthTest: false }));
      this.hoverMesh.renderOrder = 10;
      this.scene.add(this.hoverMesh);
    }
    this.hoverMesh.visible = !!h;
    if (h) this.hoverMesh.position.copy(this.hexToWorld(h, 0.14));
  }

  /** A point's position on screen, relative to the table's top-left corner. */
  toScreen(p: THREE.Vector3): { x: number; y: number } {
    const r = this.host.getBoundingClientRect();
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
  }

  /** The camera's tilt from straight down and its turn, in radians (for drawing the weather card at the board's angle). */
  viewAngles(): { tilt: number; turn: number } {
    return { tilt: this.controls.getPolarAngle(), turn: this.controls.getAzimuthalAngle() };
  }

  /** Where a ship model stands (or undefined if she isn't on the table). */
  shipPosition(id: string): THREE.Vector3 | undefined {
    return this.ships.get(id)?.root.position.clone();
  }

  /**
   * An arcing arrow from one point to another (cannon fire, a ram, a knock), drawn out over `ms`.
   * Stays until clearArcs() unless `fade` is set.
   */
  arc(from: THREE.Vector3, to: THREE.Vector3, colour = '#ff7a2f', ms = 600, fade = false): Promise<void> {
    const a = from.clone().setY(0.9), b = to.clone().setY(0.9);
    const mid = a.clone().lerp(b, 0.5).setY(0.9 + Math.max(1.2, a.distanceTo(b) * 0.35));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.95, depthTest: false });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.09, 8, false), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 12), mat);
    tube.renderOrder = head.renderOrder = 11;
    const g = new THREE.Group();
    g.add(tube, head);
    this.arcs.add(g);
    const total = (tube.geometry.index as THREE.BufferAttribute).count;
    const t0 = performance.now();
    return new Promise((res) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        tube.geometry.setDrawRange(0, Math.floor((total * t) / 6) * 6);
        const p = curve.getPoint(Math.max(t, 0.02)), d = curve.getTangent(Math.max(t, 0.02));
        head.position.copy(p);
        head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        if (t < 1) return void requestAnimationFrame(step);
        res();
        if (fade) setTimeout(() => this.arcs.remove(g), 900);
      };
      step();
    });
  }

  /** A flat arrow drawn on the board from one hex to the next, fading out: the track a ship just moved along. */
  trail(from: Hex, to: Hex, colour: string, ms = 1600) {
    const a = this.hexToWorld(from, 0.1), b = this.hexToWorld(to, 0.1);
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-3) return;
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthWrite: false });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.22, len * 0.62), mat);
    shaft.rotation.x = -Math.PI / 2;
    const head = new THREE.Mesh(new THREE.CircleGeometry(0.32, 3), mat);
    head.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(shaft, head);
    shaft.position.set(0, 0, -len * 0.06);
    head.position.set(0, 0, -len * 0.4);
    head.rotation.z = Math.PI / 2;
    g.position.copy(a.clone().lerp(b, 0.5));
    g.rotation.y = Math.atan2(-dir.x, -dir.z);
    this.fx.add(g);
    const t0 = performance.now();
    const f = () => {
      const t = (performance.now() - t0) / ms;
      mat.opacity = 0.85 * Math.max(0, 1 - t);
      if (t < 1) requestAnimationFrame(f);
      else this.fx.remove(g);
    };
    f();
  }

  /** A ring pulsing under a ship while she acts, so the eye knows which one to follow. */
  pulse(id: string, colour = '#fff', ms = 900) {
    const p = this.ships.get(id)?.root.position;
    if (!p) return;
    const r = (this.map.size / PX) * 0.9;
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 6), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(p).setY(0.1);
    this.fx.add(ring);
    const t0 = performance.now();
    const f = () => {
      const t = (performance.now() - t0) / ms;
      ring.scale.setScalar(1 + t * 0.35);
      mat.opacity = 0.9 * Math.max(0, 1 - t);
      if (t < 1) requestAnimationFrame(f);
      else this.fx.remove(ring);
    };
    f();
  }

  /** Swallow a ship into a whirlpool or cave and bring her up at the other end: shrink and spin, jump, grow. */
  async teleport(id: string, to: Hex, heading: Direction, ms: number): Promise<void> {
    const obj = this.ships.get(id);
    if (!obj) return;
    const spin = (from: number, toS: number, turns: number) =>
      new Promise<void>((res) => {
        const t0 = performance.now(), a0 = obj.root.rotation.y;
        const f = () => {
          const t = Math.min(1, (performance.now() - t0) / (ms / 2));
          obj.root.scale.setScalar(from + (toS - from) * t);
          obj.root.rotation.y = a0 + turns * Math.PI * 2 * t;
          if (t < 1) requestAnimationFrame(f);
          else res();
        };
        f();
      });
    await spin(1, 0.05, 1);
    obj.root.position.copy(this.hexToWorld(to));
    obj.root.rotation.y = Table.headingAngle(heading) - Math.PI * 2;
    await spin(0.05, 1, 1);
    obj.root.scale.setScalar(1);
    obj.root.rotation.y = Table.headingAngle(heading);
  }

  /** Sink a ship: she tilts and goes down, then disappears. */
  sink(id: string, ms: number): Promise<void> {
    const obj = this.ships.get(id);
    if (!obj) return Promise.resolve();
    const t0 = performance.now(), y0 = obj.root.position.y;
    return new Promise((res) => {
      const f = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        obj.root.position.y = y0 - t * 1.6;
        obj.root.rotation.z = t * 0.6;
        if (t < 1) requestAnimationFrame(f);
        else (obj.root.rotation.z = 0), res();
      };
      f();
    });
  }

  /**
   * Roll damage dice onto the board next to a point (rules §7.2): one d12 per value, tumbling in and landing with that number on
   * top. Resolves when they've landed; they stay a moment, then sink away.
   */
  rollDice(at: THREE.Vector3, values: readonly number[], ms = 1100, hold = 1400): Promise<void> {
    const rest = restingHeight();
    const toCamera = this.camera.position.clone().sub(at).setY(0).normalize();
    const side = new THREE.Vector3(-toCamera.z, 0, toCamera.x);
    const dice = values.map((value, i) => {
      const die = makeDie(this.env);
      // Land in a row beside the ship, on the side nearest the viewer.
      const offset = ((values.length - 1) / 2 - i) * 1.25;
      const end = at.clone().add(toCamera.clone().multiplyScalar(1.25)).add(side.clone().multiplyScalar(offset)).setY(rest + 0.05);
      const start = end.clone().add(side.clone().multiplyScalar(-2.5 + Math.random())).add(toCamera.clone().multiplyScalar(1.5)).setY(3.2);
      const from = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      const to = restingRotation(value, Math.random() * Math.PI * 2);
      const spinAxis = new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize();
      die.position.copy(start);
      die.quaternion.copy(from);
      this.fx.add(die);
      return { die, start, end, from, to, spinAxis, delay: i * 90 };
    });
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        let done = true;
        for (const d of dice) {
          const t = Math.min(1, Math.max(0, (performance.now() - t0 - d.delay) / ms));
          if (t < 1) done = false;
          // Fall and two small bounces; slide sideways while slowing.
          const ease = 1 - (1 - t) ** 3;
          d.die.position.lerpVectors(d.start, d.end, ease);
          const fall = t < 0.5 ? 1 - (t / 0.5) ** 2 : t < 0.78 ? 0.18 * Math.sin(((t - 0.5) / 0.28) * Math.PI) : 0.05 * Math.sin(((t - 0.78) / 0.22) * Math.PI);
          d.die.position.y = d.end.y + Math.max(0, fall) * (d.start.y - d.end.y);
          // Tumble, settling onto the face that was rolled.
          const tumble = new THREE.Quaternion().setFromAxisAngle(d.spinAxis, (1 - ease) * 9);
          d.die.quaternion.slerpQuaternions(d.from, d.to, Math.min(1, ease * 1.15)).premultiply(tumble);
        }
        if (!done) return void requestAnimationFrame(step);
        for (const d of dice) d.die.quaternion.copy(d.to);
        resolve();
        setTimeout(() => {
          const s0 = performance.now();
          const fade = () => {
            const k = Math.min(1, (performance.now() - s0) / 400);
            for (const d of dice) d.die.scale.setScalar(1 - k);
            if (k < 1) requestAnimationFrame(fade);
            else for (const d of dice) this.fx.remove(d.die);
          };
          fade();
        }, hold);
      };
      step();
    });
  }

  clearArcs() {
    this.clearGroup(this.arcs);
  }

  static headingAngle(d: Direction): number {
    return (-d * Math.PI) / 3;
  }

  private makeShip(colour: string): ShipObj {
    const root = this.shipTemplate!.clone(true);
    const sails: THREE.Object3D[] = [];
    const sailMat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && (mesh.material as THREE.Material).name === 'sail') mesh.material = sailMat;
      if (o.name.startsWith('sail_')) sails.push(o);
    });
    root.scale.setScalar(SHIP_SCALE);
    const group = new THREE.Group();
    group.add(root);
    const label = document.createElement('div');
    label.className = 'ship-label';
    this.labelLayer.appendChild(label);
    return { root: group, sails, label };
  }

  /** Sails as set (rules §6.1): Full, Half (reefed), or No Sail = furled on the yards, still there like on the model ship. */
  private static applySail(obj: ShipObj, sail: SailLevel) {
    for (const s of obj.sails) {
      s.visible = true;
      s.scale.y = sail === 'full' ? 1 : sail === 'half' ? 0.55 : 0.14;
    }
  }

  setShips(views: (ShipView & { name: string })[]) {
    if (!this.shipTemplate) return;
    for (const v of views) {
      let obj = this.ships.get(v.id);
      if (!obj) {
        obj = this.makeShip(v.colour);
        this.ships.set(v.id, obj);
        this.scene.add(obj.root);
        obj.root.userData.shipId = v.id;
      }
      obj.root.position.copy(this.hexToWorld(v.hex));
      obj.root.rotation.y = Table.headingAngle(v.heading);
      Table.applySail(obj, v.sail);
      obj.label.textContent = v.name;
      if (obj.cargo?.userData.kind !== v.cargo) {
        if (obj.cargo) obj.root.remove(obj.cargo);
        obj.cargo = undefined;
        if (v.cargo) {
          // In the back of the ship (the stern is +z when she faces north), on deck, like the physical pieces.
          const piece = treasurePiece(v.cargo);
          const b = this.shipBox;
          piece.position.set((b.min.x + b.max.x) / 2, b.min.y + (b.max.y - b.min.y) * 0.22, b.min.z + (b.max.z - b.min.z) * 0.8);
          piece.scale.setScalar(1.3);
          obj.cargo = piece;
          obj.root.add(piece);
        }
      }
      obj.label.classList.toggle('selected', v.selected);
      obj.label.style.setProperty('--c', v.colour);
    }
    for (const [id, obj] of this.ships)
      if (!views.some((v) => v.id === id)) {
        this.scene.remove(obj.root);
        obj.label.remove();
        this.ships.delete(id);
      }
  }

  /**
   * Treasure on the table (rules §3.7): loose pieces on their hexes (bigger, turning, on a glowing disc), and each port's pieces
   * brought home, set out round the port.
   */
  setTreasures(loose: { hex: Hex; kind: TreasureKind }[], holds: { hex: Hex; kinds: readonly TreasureKind[] }[]) {
    this.treasureGroup.clear();
    const glow = new THREE.MeshBasicMaterial({ color: '#ffe48a', transparent: true, opacity: 0.45, depthWrite: false });
    loose.forEach(({ hex: h, kind }, i) => {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), glow);
      disc.rotation.x = -Math.PI / 2;
      disc.position.copy(this.hexToWorld(h, 0.07));
      const piece = treasurePiece(kind);
      piece.scale.setScalar(1.7);
      piece.position.copy(this.hexToWorld(h, 0.12));
      Object.assign(piece.userData, { loose: true, y: 0.12, phase: i * 1.3 });
      this.treasureGroup.add(disc, piece);
    });
    for (const { hex: h, kinds } of holds) {
      const c = this.hexToWorld(h, 0.06);
      const r = (this.map.size / PX) * 0.62;
      kinds.forEach((kind, i) => {
        const a = Math.PI * 0.75 + (i * Math.PI) / 3.5;
        const piece = treasurePiece(kind);
        piece.scale.setScalar(1.1);
        piece.position.set(c.x + Math.cos(a) * r, 0.06, c.z + Math.sin(a) * r);
        this.treasureGroup.add(piece);
      });
    }
  }

  /** Ghost preview: translucent ships at the end of each Part, and a dashed path. */
  setGhost(colour: string, path: Hex[], ends: { hex: Hex; heading: Direction; sail: SailLevel; label: string }[]) {
    this.clearGroup(this.ghosts);
    if (!this.shipTemplate || ends.length === 0) return;
    const pts = path.map((h) => this.hexToWorld(h, 0.12));
    if (pts.length > 1) {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(pts.length * 12)),
        new THREE.LineDashedMaterial({ color: '#fffbe8', dashSize: 0.35, gapSize: 0.2, linewidth: 2 }),
      );
      line.computeLineDistances();
      this.ghosts.add(line);
    }
    const strong = new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: 0.55, depthWrite: false, emissive: colour, emissiveIntensity: 0.5 });
    const faint = strong.clone();
    faint.opacity = 0.28;
    ends.forEach((e, i) => {
      // The last Part's ghost is the strongest; earlier ones are fainter.
      const mat = i === ends.length - 1 ? strong : faint;
      const g = this.shipTemplate!.clone(true);
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          m.material = mat;
          m.castShadow = false;
        }
        if (o.name.startsWith('sail_')) {
          o.visible = e.sail !== 'none';
          o.scale.y = e.sail === 'half' ? 0.55 : 1;
        }
      });
      g.scale.setScalar(SHIP_SCALE * 0.92);
      g.position.copy(this.hexToWorld(e.hex, 0.06));
      g.rotation.y = Table.headingAngle(e.heading);
      this.ghosts.add(g);
      const ring = new THREE.Mesh(this.hexGeo, new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.22, depthWrite: false }));
      ring.position.copy(this.hexToWorld(e.hex, 0.07));
      this.ghosts.add(ring);
    });
    this.setLabels('ghost', ends.map((e) => ({ text: e.label, pos: this.hexToWorld(e.hex, 0.1), cls: 'ghost-label' })));
  }

  /** Translucent hex markings, e.g. broadside arcs. */
  setOverlay(hexes: Hex[], colour = '#e0402a', opacity = 0.32) {
    this.clearGroup(this.overlay);
    const onBoard = new Set(this.map.hexes.map(([c, r]) => `${c},${r}`));
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false });
    const seen = new Set<string>();
    for (const h of hexes) {
      const k = hexKey(h);
      if (seen.has(k) || !onBoard.has(hexToOffset(h).join(','))) continue;
      seen.add(k);
      const m = new THREE.Mesh(this.hexGeo, mat);
      m.position.copy(this.hexToWorld(h, 0.08));
      this.overlay.add(m);
    }
  }

  private labelSets = new Map<string, HTMLElement[]>();
  setLabels(set: string, items: { text: string; pos: THREE.Vector3; cls: string }[]) {
    for (const el of this.labelSets.get(set) ?? []) {
      el.remove();
      this.labels = this.labels.filter((l) => l.el !== el);
    }
    const els = items.map((it) => {
      const el = document.createElement('div');
      el.className = it.cls;
      el.textContent = it.text;
      this.labelLayer.appendChild(el);
      this.labels.push({ el, pos: it.pos });
      return el;
    });
    this.labelSets.set(set, els);
  }

  private placeLabels() {
    const r = this.host.getBoundingClientRect();
    const v = new THREE.Vector3();
    const place = (el: HTMLElement, p: THREE.Vector3) => {
      v.copy(p).project(this.camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px)`;
      el.style.display = v.z < 1 ? '' : 'none';
    };
    for (const [, s] of this.ships) place(s.label, s.root.position.clone().setY(2.6));
    for (const l of this.labels) place(l.el, l.pos);
  }

  /** Animate one ship along a path and/or to a new heading. */
  animateShip(id: string, path: Hex[], heading: Direction, sail: SailLevel, ms: number): Promise<void> {
    const obj = this.ships.get(id);
    if (!obj) return Promise.resolve();
    Table.applySail(obj, sail);
    const start = obj.root.position.clone();
    const pts = [start, ...path.map((h) => this.hexToWorld(h))];
    const a0 = obj.root.rotation.y;
    let a1 = Table.headingAngle(heading);
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
    while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    if (pts.length === 1 && Math.abs(a1 - a0) < 1e-3) return Promise.resolve();
    const t0 = performance.now();
    return new Promise((res) => {
      const step = () => {
        const t = Math.min(1, (performance.now() - t0) / ms);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        if (pts.length > 1) {
          const f = e * (pts.length - 1);
          const i = Math.min(Math.floor(f), pts.length - 2);
          obj.root.position.lerpVectors(pts[i]!, pts[i + 1]!, f - i);
        }
        obj.root.rotation.y = a0 + (a1 - a0) * e;
        if (t < 1) requestAnimationFrame(step);
        else res();
      };
      step();
    });
  }

  /** Broadside: a puff of smoke beside the firing ship and a flash on the target. */
  broadside(fromId: string, toId: string) {
    const a = this.ships.get(fromId)?.root.position, b = this.ships.get(toId)?.root.position;
    if (!a || !b) return;
    const puff = (p: THREE.Vector3, colour: string, size: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 8), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.85, depthWrite: false }));
      m.position.copy(p).setY(0.8);
      this.fx.add(m);
      const t0 = performance.now();
      const f = () => {
        const t = (performance.now() - t0) / 900;
        m.scale.setScalar(1 + t * 2.2);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t);
        if (t < 1) requestAnimationFrame(f);
        else this.fx.remove(m);
      };
      f();
    };
    puff(a.clone().lerp(b, 0.12), '#f4efe6', 0.35);
    setTimeout(() => puff(b, '#ff8a3c', 0.3), 280);
  }

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hits = this.raycaster.intersectObjects([...this.ships.values()].map((s) => s.root), true);
    let o: THREE.Object3D | null = hits[0]?.object ?? null;
    while (o && !o.userData.shipId) o = o.parent;
    this.onShipClick((o?.userData.shipId as string) ?? null);
  }

  focus(h: Hex) {
    const p = this.hexToWorld(h, 0);
    const offset = this.camera.position.clone().sub(this.controls.target).setLength(26);
    this.tween(p, p.clone().add(offset));
  }
  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.tween(this.controls.target.clone(), this.controls.target.clone().add(offset.setLength(len)));
  }
  resetView() {
    this.tween(this.home.target.clone(), this.home.pos.clone(), this.camera.position.lengthSq() === 0 ? 0 : 500);
  }
  private tween(target: THREE.Vector3, pos: THREE.Vector3, ms = 500) {
    const t0 = performance.now(), ft = this.controls.target.clone(), fp = this.camera.position.clone();
    const f = () => {
      const t = ms ? Math.min(1, (performance.now() - t0) / ms) : 1;
      const e = 1 - (1 - t) ** 3;
      this.controls.target.lerpVectors(ft, target, e);
      this.camera.position.lerpVectors(fp, pos, e);
      if (t < 1) requestAnimationFrame(f);
    };
    f();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private clearGroup(g: THREE.Group) {
    g.clear();
    if (g === this.ghosts) this.setLabels('ghost', []);
  }
}
