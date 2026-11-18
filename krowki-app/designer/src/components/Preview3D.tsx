import { useEffect, useRef, useState } from 'react';
import type * as THREE_NS from 'three';
import { BLEED, FRONT, FULL_H, FULL_W } from '../config/template';
import { buildCandy, endFoldTriangles, HALF_T } from '../lib/candyGeometry';
import { renderDesign } from '../lib/render';
import { useStore } from '../state/store';

const PX = 14; // px na mm tekstury 3D

export interface PreviewData { canvas: HTMLCanvasElement; flat: string; rev: number }

/** Tekstura do 3D: projekt + delikatne zagięcia papieru na końcach (cieniowanie wg trójkątów siatki). */
function decorate(src: HTMLCanvasElement) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.save();
  ctx.scale(PX, PX);
  for (const [side, foldX] of [[-1, FRONT.x], [1, FRONT.x + FRONT.w]] as const) {
    // część końca poza trójkątną zakładką leży pod nią – lekko ciemniejsza
    ctx.beginPath();
    ctx.rect(side < 0 ? 0 : foldX, 0, side < 0 ? foldX : FULL_W - foldX, FULL_H);
    const tri = endFoldTriangles()[side < 0 ? 0 : 1];
    ctx.moveTo(tri[0][0], tri[0][1]); ctx.lineTo(tri[1][0], tri[1][1]); ctx.lineTo(tri[2][0], tri[2][1]); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fill('evenodd');
    // linie zagięć
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(tri[0][0], tri[0][1]); ctx.lineTo(tri[1][0], tri[1][1]); ctx.lineTo(tri[2][0], tri[2][1]);
    ctx.stroke();
  }
  ctx.restore();
  void BLEED;
  return c;
}

let rev = 0;
export function usePreviewTextures(active = true) {
  const design = useStore((s) => s.design);
  const [data, setData] = useState<PreviewData | null>(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    const t = setTimeout(async () => {
      const { design: d, assets } = useStore.getState();
      const src = await renderDesign(d, assets, PX);
      if (alive) setData({ canvas: decorate(src), flat: src.toDataURL('image/jpeg', 0.9), rev: ++rev });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [design, active]);
  return data;
}

type View = 'front' | 'back' | 'side' | 'angle';
const VIEWS: Record<View, [number, number, number]> = {
  angle: [-44, -68, 70], front: [0, -8, 105], back: [0, 8, -105], side: [-88, -30, 34],
};

interface Props {
  data: PreviewData;
  height: number;
  interactive?: boolean;
  view?: View;
  pile?: boolean;
  autoRotate?: boolean;
}

/** Realistyczny podgląd krówki w papierku (Three.js, ładowany dopiero przy pierwszym użyciu). */
export function Candy3D({ data, height, interactive = true, view = 'angle', pile = false, autoRotate = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setTexture: (c: HTMLCanvasElement) => void; setView: (v: View) => void; dispose: () => void } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');
        if (disposed || !host.current) return;
        api.current = createScene(THREE, OrbitControls, RoomEnvironment, host.current, { interactive, pile, autoRotate });
        api.current.setTexture(data.canvas);
        api.current.setView(view);
      } catch (e) {
        console.warn('3D niedostępne', e);
        setFailed(true);
      }
    })();
    return () => { disposed = true; api.current?.dispose(); api.current = null; };
  }, [interactive, pile, autoRotate]); // eslint-disable-line

  useEffect(() => { api.current?.setTexture(data.canvas); }, [data.rev]); // eslint-disable-line
  useEffect(() => { api.current?.setView(view); }, [view]);

  if (failed) return <img src={data.flat} alt="Papierek" style={{ height, maxWidth: '100%' }} />;
  return <div ref={host} className="kd-3d" style={{ height, touchAction: interactive ? 'none' : 'auto' }} />;
}

type T = typeof THREE_NS;

function createScene(
  THREE: T,
  OrbitControls: typeof import('three/examples/jsm/controls/OrbitControls.js').OrbitControls,
  RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment,
  el: HTMLDivElement,
  opts: { interactive: boolean; pile: boolean; autoRotate: boolean },
) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(opts.pile ? 32 : 30, 1, 1, 1000);
  camera.up.set(0, 0, 1);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-40, -60, 90);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -130;
  key.shadow.camera.right = key.shadow.camera.top = 130;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  const fill = new THREE.DirectionalLight(0xfff4ea, 1.0);
  fill.position.set(50, 70, -60); // od tyłu/spodu, żeby tył cukierka nie był szary
  scene.add(key, fill, new THREE.HemisphereLight(0xfff8f0, 0xd9cbbd, 0.35));

  const { body, caps } = buildCandy();
  const toGeo = (g: typeof body, computeNormals: boolean) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.position, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setIndex(g.index);
    if (computeNormals) geo.computeVertexNormals();
    else geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.normal, 3));
    return geo;
  };
  const geos = [toGeo(body, true), toGeo(caps, true)];

  const makeTexture = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  let texture = makeTexture(document.createElement('canvas'));
  // woskowany papier: lekki połysk, delikatna faktura
  const mat = new THREE.MeshPhysicalMaterial({
    map: texture, roughness: 0.48, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.45, side: THREE.FrontSide,
    bumpMap: paperGrain(THREE), bumpScale: 0.6,
  });

  const capMat = mat.clone();
  capMat.side = THREE.DoubleSide;
  const group = new THREE.Group();
  const placements = opts.pile
    ? [
        [-72, 34, 0, 8, false], [0, 40, 0, -6, false], [72, 30, 0, 12, true],
        [-76, -4, 0, -10, false], [-2, 2, 0, 4, true], [74, -6, 0, -14, false],
        [-70, -40, 0, 14, false], [4, -36, 0, -8, false], [76, -42, 0, 6, false],
      ] as [number, number, number, number, boolean][]
    : [[0, 0, 0, 0, false]] as [number, number, number, number, boolean][];
  for (const [x, y, z, rot, flip] of placements) {
    const m = new THREE.Group();
    for (const [i, gg] of geos.entries()) {
      const part = new THREE.Mesh(gg, i ? capMat : mat);
      part.castShadow = true;
      part.receiveShadow = true;
      m.add(part);
    }
    m.position.set(x, y, HALF_T + z + (flip ? 0 : 0.3));
    m.rotation.z = (rot * Math.PI) / 180;
    if (flip) m.rotation.x = Math.PI; // leży tyłem do góry
    // każdy cukierek trochę inny – jak prawdziwe krówki
    m.rotation.y = ((x * 7 + y * 3) % 5) * 0.006;
    group.add(m);
  }
  scene.add(group);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.receiveShadow = true;
  scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = opts.pile ? 110 : 55;
  controls.maxDistance = opts.pile ? 400 : 220;
  controls.enabled = opts.interactive;
  controls.autoRotate = opts.autoRotate;
  controls.autoRotateSpeed = 1.2;
  controls.target.set(0, 0, opts.pile ? 0 : HALF_T);

  let tween: { from: THREE_NS.Vector3; to: THREE_NS.Vector3; t: number } | null = null;
  const setView = (v: View) => {
    const [x, y, z] = opts.pile ? [0, -160, 230] : VIEWS[v];
    const to = new THREE.Vector3(x, y, z).add(controls.target);
    if (!camera.position.lengthSq()) camera.position.copy(to);
    else tween = { from: camera.position.clone(), to, t: 0 };
  };

  const resize = () => {
    const w = el.clientWidth || 300, h = el.clientHeight || 200;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();

  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (tween) {
      tween.t = Math.min(1, tween.t + 0.06);
      const e = 1 - Math.pow(1 - tween.t, 3);
      camera.position.lerpVectors(tween.from, tween.to, e);
      if (tween.t >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
  };
  loop();

  return {
    setTexture(c: HTMLCanvasElement) {
      // nowa tekstura – WebGL2 nie pozwala zmienić rozmiaru już wgranej
      const old = texture;
      texture = makeTexture(c);
      mat.map = texture; capMat.map = texture;
      mat.needsUpdate = true; capMat.needsUpdate = true;
      old.dispose();
    },
    setView,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      geos.forEach((x) => x.dispose()); mat.dispose(); capMat.dispose(); texture.dispose(); pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    },
  };
}

function paperGrain(THREE: T) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(256, 256);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + rnd() * 30;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}
