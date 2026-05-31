/**
 * 3D 厂区导航场景（Three.js）。
 * 负责渲染：地面 / 道路 / 库房 / 库位标记 / 提货路线 / 高亮与镜头聚焦。
 * 说明：采用相对路径导入本地内置的 Three.js，无需 import map，兼容性更好。
 */
import * as THREE from './vendor/three/three.module.js';
import { OrbitControls } from './vendor/three/addons/controls/OrbitControls.js';
import { PARK, ROADS } from './mockErp.js';

// 提货顺序配色（区分不同提单，叠加序号，色盲友好）
const SEQ_COLORS = [0x2f80ed, 0xf2994a, 0x27ae60, 0x9b51e0, 0x00b8d9, 0xeb5757];
const HIGHLIGHT = 0xff3b30;

function makeTextSprite(text, { fontSize = 48, bg = 'rgba(20,28,40,0.85)', color = '#fff', pad = 16 } = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  const w = ctx.measureText(text).width + pad * 2;
  canvas.width = w; canvas.height = fontSize + pad * 2;
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 14); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(canvas.width / 6, canvas.height / 6, 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 库位编码 → 世界坐标（结合库房位置与库内网格） */
export function locationToWorld(wh, code) {
  const g = PARK.grid;
  const [zone, rowStr, colStr] = code.split('-');
  const zi = Math.max(0, g.zones.indexOf(zone));
  const row = parseInt(rowStr, 10) || 1;
  const col = parseInt(colStr, 10) || 1;
  const zoneW = wh.width / g.zones.length;
  const cellW = zoneW / g.colsPerRow;
  const cellD = wh.depth / g.rowsPerZone;
  const x = wh.x - wh.width / 2 + zi * zoneW + (col - 0.5) * cellW;
  const z = wh.z - wh.depth / 2 + (row - 0.5) * cellD;
  return { x, z };
}

/** 检测 WebGL 是否可用 */
export function isWebGLAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

export class Warehouse3D {
  constructor(container) {
    this.container = container;
    this.markers = new Map(); // billNo -> { group, baseColor }
    this.routeGroup = null;
    this.tween = null;
    this._initScene();
    this._buildPark();
    this._animate();
    window.addEventListener('resize', () => this._onResize());
  }

  _initScene() {
    const { clientWidth: w, clientHeight: h } = this.container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1726);
    this.scene.fog = new THREE.Fog(0x0e1726, 350, 750);

    this.camera = new THREE.PerspectiveCamera(50, (w || 1) / (h || 1), 0.1, 2000);
    this.camera.position.set(0, 260, 300);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w || 800, h || 600);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.target.set(0, 0, 10);

    this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x223044, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(120, 220, 160);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -250; dir.shadow.camera.right = 250;
    dir.shadow.camera.top = 250; dir.shadow.camera.bottom = -250;
    this.scene.add(dir);
  }

  _buildPark() {
    const { width, depth } = PARK.parkSize;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ color: 0x1b2a3d })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 道路
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x33425a });
    const ROAD_W = 14;
    ROADS.horizontals.forEach((r) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(r.x1 - r.x0, ROAD_W), roadMat);
      m.rotation.x = -Math.PI / 2; m.position.set((r.x0 + r.x1) / 2, 0.05, r.z);
      this.scene.add(m);
    });
    ROADS.verticals.forEach((r) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, r.z1 - r.z0), roadMat);
      m.rotation.x = -Math.PI / 2; m.position.set(r.x, 0.05, (r.z0 + r.z1) / 2);
      this.scene.add(m);
    });

    // 库房
    PARK.warehouses.forEach((wh) => this._buildWarehouse(wh));

    // 大门
    this._buildGate(PARK.gate, '🚪 大门 · 磅房', 0x27ae60);
    this._buildGate(PARK.exit, '出门口', 0xeb5757);
  }

  _buildWarehouse(wh) {
    const group = new THREE.Group();
    const wallH = 16;
    // 地坪
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(wh.width, wh.depth),
      new THREE.MeshStandardMaterial({ color: 0x223850 })
    );
    floor.rotation.x = -Math.PI / 2; floor.position.set(wh.x, 0.1, wh.z);
    floor.receiveShadow = true;
    group.add(floor);

    // 半透明墙体（便于看到库内库位）
    const wallMat = new THREE.MeshStandardMaterial({ color: wh.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const box = new THREE.Mesh(new THREE.BoxGeometry(wh.width, wallH, wh.depth), wallMat);
    box.position.set(wh.x, wallH / 2, wh.z);
    group.add(box);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(wh.width, wallH, wh.depth)),
      new THREE.LineBasicMaterial({ color: 0x6f8db0 })
    );
    edges.position.copy(box.position);
    group.add(edges);

    // 库内网格线
    this._buildGrid(group, wh);

    // 名称牌
    const label = makeTextSprite(wh.name, { fontSize: 56, bg: 'rgba(20,40,70,0.92)' });
    label.position.set(wh.x, wallH + 16, wh.z);
    group.add(label);

    // 入口标记
    const ent = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 8, 4),
      new THREE.MeshStandardMaterial({ color: 0x27ae60 })
    );
    ent.rotation.x = Math.PI; ent.position.set(wh.entrance.x, 6, wh.entrance.z);
    group.add(ent);

    this.scene.add(group);
  }

  _buildGrid(group, wh) {
    const g = PARK.grid;
    const mat = new THREE.LineBasicMaterial({ color: 0x35506e, transparent: true, opacity: 0.5 });
    const pts = [];
    const x0 = wh.x - wh.width / 2, z0 = wh.z - wh.depth / 2;
    // 列线
    for (let i = 0; i <= g.zones.length * g.colsPerRow; i++) {
      const x = x0 + (i * (wh.width / (g.zones.length * g.colsPerRow)));
      pts.push(new THREE.Vector3(x, 0.2, z0), new THREE.Vector3(x, 0.2, z0 + wh.depth));
    }
    // 行线
    for (let j = 0; j <= g.rowsPerZone; j++) {
      const z = z0 + (j * (wh.depth / g.rowsPerZone));
      pts.push(new THREE.Vector3(x0, 0.2, z), new THREE.Vector3(x0 + wh.width, 0.2, z));
    }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }

  _buildGate(g, text, color) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(10, 12, 10),
      new THREE.MeshStandardMaterial({ color })
    );
    post.position.set(g.x, 6, g.z);
    post.castShadow = true;
    this.scene.add(post);
    const label = makeTextSprite(text, { fontSize: 44, bg: 'rgba(20,40,40,0.9)' });
    label.position.set(g.x, 26, g.z);
    this.scene.add(label);
  }

  // ===== 提单库位标记 =====
  setOrders(orders) {
    this.clearMarkers();
    orders.forEach((o, idx) => {
      const wh = PARK.warehouses.find((w) => w.id === o.warehouseId);
      if (!wh) return;
      const pos = locationToWorld(wh, o.locationCode);
      const color = SEQ_COLORS[idx % SEQ_COLORS.length];
      const group = new THREE.Group();

      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 0.9, 24, 12),
        new THREE.MeshStandardMaterial({ color })
      );
      pin.position.set(pos.x, 12, pos.z);
      pin.castShadow = true;
      group.add(pin);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(3.4, 18, 18),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
      );
      head.position.set(pos.x, 26, pos.z);
      group.add(head);

      const tag = makeTextSprite(`${o.billNo.slice(-3)} · ${o.locationCode}`, { fontSize: 34, bg: `#${color.toString(16).padStart(6, '0')}` });
      tag.position.set(pos.x, 38, pos.z);
      group.add(tag);

      this.scene.add(group);
      this.markers.set(o.billNo, { group, head, pin, tag, baseColor: color, pos });
    });
  }

  clearMarkers() {
    this.markers.forEach((m) => this.scene.remove(m.group));
    this.markers.clear();
  }

  highlight(billNo) {
    this.markers.forEach((m, id) => {
      const on = id === billNo;
      const c = on ? HIGHLIGHT : m.baseColor;
      m.head.material.color.setHex(c);
      m.head.material.emissive.setHex(c);
      m.pin.material.color.setHex(c);
      m.group.scale.setScalar(on ? 1.6 : 1);
      const dim = on ? 1 : 0.28;
      m.head.material.opacity = dim; m.head.material.transparent = !on;
      m.pin.material.opacity = dim; m.pin.material.transparent = !on;
      m.tag.material.opacity = on ? 1 : 0.3;
      m._blink = on;
    });
    const m = this.markers.get(billNo);
    if (m) this._focus(m.pos);
  }

  showAll() {
    this.markers.forEach((m) => {
      m.head.material.color.setHex(m.baseColor);
      m.head.material.emissive.setHex(m.baseColor);
      m.pin.material.color.setHex(m.baseColor);
      m.group.scale.setScalar(1);
      m.head.material.opacity = 1; m.head.material.transparent = false;
      m.pin.material.opacity = 1; m.pin.material.transparent = false;
      m.tag.material.opacity = 1;
      m._blink = false;
    });
    this.resetView();
  }

  // ===== 路线 =====
  setRoute(plan) {
    if (this.routeGroup) this.scene.remove(this.routeGroup);
    this.routeGroup = new THREE.Group();

    const pts = [];
    plan.legs.forEach((leg) => leg.path.forEach((p) => pts.push(new THREE.Vector3(p.x, 1.2, p.z))));
    if (pts.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(20, pts.length * 4), 1.6, 8, false),
        new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffaa00, emissiveIntensity: 0.4 })
      );
      this.routeGroup.add(tube);
      // 方向箭头
      const arrowCount = Math.min(40, Math.floor(curve.getLength() / 22));
      for (let i = 1; i <= arrowCount; i++) {
        const t = i / (arrowCount + 1);
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const arrow = new THREE.Mesh(
          new THREE.ConeGeometry(2.4, 6, 12),
          new THREE.MeshStandardMaterial({ color: 0xffd166 })
        );
        arrow.position.copy(p); arrow.position.y = 3;
        arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().normalize());
        this.routeGroup.add(arrow);
      }
    }

    // 序号牌
    plan.order.forEach((o, i) => {
      const num = makeTextSprite(`${i + 1}`, { fontSize: 60, bg: 'rgba(235,87,87,0.95)', pad: 24 });
      num.position.set(o.entrance.x, 46, o.entrance.z);
      num.scale.multiplyScalar(1.2);
      this.routeGroup.add(num);
    });

    this.scene.add(this.routeGroup);
  }

  // ===== 镜头 =====
  _focus(pos) {
    const target = new THREE.Vector3(pos.x, 8, pos.z);
    const camPos = new THREE.Vector3(pos.x + 60, 120, pos.z + 110);
    this._startTween(camPos, target);
  }

  resetView() {
    this._startTween(new THREE.Vector3(0, 260, 300), new THREE.Vector3(0, 0, 10));
  }

  topView() {
    this._startTween(new THREE.Vector3(0, 380, 12), new THREE.Vector3(0, 0, 10));
  }

  _startTween(camPos, target) {
    this.tween = {
      from: this.camera.position.clone(),
      to: camPos,
      tFrom: this.controls.target.clone(),
      tTo: target,
      t: 0
    };
  }

  _onResize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    if (this.tween) {
      this.tween.t = Math.min(1, this.tween.t + 0.06);
      const e = 1 - Math.pow(1 - this.tween.t, 3);
      this.camera.position.lerpVectors(this.tween.from, this.tween.to, e);
      this.controls.target.lerpVectors(this.tween.tFrom, this.tween.tTo, e);
      if (this.tween.t >= 1) this.tween = null;
    }
    const time = performance.now() * 0.005;
    this.markers.forEach((m) => {
      if (m._blink) m.head.scale.setScalar(1 + Math.sin(time) * 0.25);
      else m.head.scale.setScalar(1);
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
