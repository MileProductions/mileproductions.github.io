import Konva from 'konva';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Ellipse, Group, Image as KImage, Layer, Line, Path, Rect, Stage, Text, Transformer } from 'react-konva';
import {
  BLEED, FOLD_LINES, FRONT, FRONT_CENTER, FRONT_HEXAGON, FULL_H, FULL_W, NET_H, NET_W, PANELS,
} from '../config/template';
import { safeRect } from '../lib/checks';
import { fitTextHeight } from '../lib/factory';
import { fontsReady } from '../lib/render';
import { angleDelta, applyPinch, pinchMetrics } from '../lib/gestures';

// zdarzenia dotyku działają także w trakcie przeciągania (potrzebne do gestu dwoma palcami)
Konva.hitOnDragEnabled = true;
import { PREVIEW_MAX, processedCanvas } from '../lib/images';
import { clipHexagon, HEART_PATH, imageAttrs, producerAttrs, shapeAttrs, textAttrs } from '../lib/nodes';
import type { El, ImageEl, ShapeEl } from '../lib/types';
import { useStore } from '../state/store';

interface Props {
  width: number;
  height: number;
  onRequestUpload: (targetId: string | null) => void;
  onRequestCrop: (id: string) => void;
  onEditText: (id: string) => void;
}

const SNAP = 0.8;

export function Editor({ width, height, onRequestUpload, onRequestCrop, onEditText }: Props) {
  const design = useStore((s) => s.design);
  const assets = useStore((s) => s.assets);
  const selectedId = useStore((s) => s.selectedId);
  const mode = useStore((s) => s.mode);
  const showGrid = useStore((s) => s.showGrid);
  const zoom = useStore((s) => s.zoom);
  const select = useStore((s) => s.select);
  const updateEl = useStore((s) => s.updateEl);
  const nodes = useRef<Record<string, Konva.Node>>({});
  const tr = useRef<Konva.Transformer>(null);
  const anchor = useRef<string | null>(null);
  const [guides, setGuides] = useState<{ v?: boolean; h?: boolean }>({});
  const [, setFontTick] = useState(0);
  const pinch = useRef<{ dist: number; angle: number } | null>(null);

  const fit = Math.max(1, Math.min(width / FULL_W, height / FULL_H));
  const scale = fit * zoom;
  const sw = Math.max(width, FULL_W * scale), sh = Math.max(height, FULL_H * scale);
  const ox = (sw - FULL_W * scale) / 2, oy = (sh - FULL_H * scale) / 2;

  const selected = design.elements.find((e) => e.id === selectedId);

  useEffect(() => {
    const t = tr.current;
    if (!t) return;
    const n = selectedId ? nodes.current[selectedId] : undefined;
    t.nodes(n && selected && !selected.locked ? [n] : []);
    t.getLayer()?.batchDraw();
  }, [selectedId, design, selected]);

  // canvas nie pobiera fontów sam – wczytaj użyte i przerysuj
  useEffect(() => { fontsReady(design).then(() => setFontTick((x) => x + 1)); }, [design]);
  useEffect(() => {
    const f = () => setFontTick((x) => x + 1);
    document.fonts?.addEventListener?.('loadingdone', f);
    return () => document.fonts?.removeEventListener?.('loadingdone', f);
  }, []);

  // gest dwoma palcami: na zaznaczonym elemencie powiększa i obraca, na pustym polu przybliża widok
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2) { pinch.current = null; return; }
    e.evt.preventDefault();
    const m = pinchMetrics({ x1: t[0].clientX, y1: t[0].clientY, x2: t[1].clientX, y2: t[1].clientY });
    const prev = pinch.current;
    pinch.current = { dist: m.dist, angle: m.angle };
    if (!prev || prev.dist < 1) return;
    const k = m.dist / prev.dist, dRot = angleDelta(prev.angle, m.angle);
    const st = useStore.getState();
    const el = st.design.elements.find((x) => x.id === st.selectedId);
    if (el && !el.locked) {
      nodes.current[el.id]?.stopDrag();
      st.updateEl(el.id, applyPinch(el, k, dRot), 'pinch:' + el.id);
    } else {
      st.set({ zoom: Math.min(4, Math.max(1, st.zoom * k)) });
    }
  };
  const onTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => { if (e.evt.touches.length < 2) pinch.current = null; };

  const ref = (id: string) => (n: Konva.Node | null) => { if (n) nodes.current[id] = n; else delete nodes.current[id]; };

  const onDragMove = (el: El) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const n = e.target;
    let x = n.x(), y = n.y();
    const g: { v?: boolean; h?: boolean } = {};
    if (Math.abs(x - FRONT_CENTER.x) < SNAP) { x = FRONT_CENTER.x; g.v = true; }
    if (Math.abs(y - FRONT_CENTER.y) < SNAP) { y = FRONT_CENTER.y; g.h = true; }
    if (el.type === 'text') {
      // tekst trzyma się formatu netto z marginesem 2 mm
      const hw = el.w / 2, hh = el.h / 2;
      x = Math.min(Math.max(x, BLEED + 2 + hw), BLEED + NET_W - 2 - hw);
      y = Math.min(Math.max(y, BLEED + 2 + hh), BLEED + NET_H - 2 - hh);
    } else {
      x = Math.min(Math.max(x, -el.w / 2 + 3), FULL_W + el.w / 2 - 3);
      y = Math.min(Math.max(y, -el.h / 2 + 3), FULL_H + el.h / 2 - 3);
    }
    n.position({ x, y });
    setGuides(g);
  };
  const onDragEnd = (el: El) => (e: Konva.KonvaEventObject<DragEvent>) => {
    setGuides({});
    updateEl(el.id, { cx: e.target.x(), cy: e.target.y() }, 'drag:' + el.id + Date.now());
  };

  const onTransformEnd = (el: El) => (e: Konva.KonvaEventObject<Event>) => {
    const n = e.target;
    const sx = Math.abs(n.scaleX()), sy = Math.abs(n.scaleY());
    const base = { cx: n.x(), cy: n.y(), rotation: Math.round(n.rotation() * 10) / 10 };
    if (el.type === 'text') {
      const widthOnly = anchor.current === 'middle-left' || anchor.current === 'middle-right';
      n.scale({ x: 1, y: 1 });
      const next = fitTextHeight({ ...el, ...base, w: Math.max(4, el.w * sx), fontSize: widthOnly ? el.fontSize : Math.max(0.8, el.fontSize * sy) });
      updateEl(el.id, next, 'tr' + Date.now());
      return;
    }
    if (el.type === 'image') n.scale({ x: el.flipX ? -1 : 1, y: el.flipY ? -1 : 1 });
    else if (el.type === 'shape' && el.shape === 'heart') n.scale({ x: el.w / 100, y: el.h / 92 });
    else n.scale({ x: 1, y: 1 });
    const fx = el.type === 'shape' && el.shape === 'heart' ? sx / (el.w / 100) : sx;
    const fy = el.type === 'shape' && el.shape === 'heart' ? sy / (el.h / 92) : sy;
    updateEl(el.id, { ...base, w: Math.max(1, el.w * fx), h: Math.max(1, el.h * fy) }, 'tr' + Date.now());
  };

  const common = (el: El) => ({
    draggable: !el.locked,
    listening: !el.hidden,
    visible: !el.hidden,
    onMouseDown: () => select(el.id),
    onTouchStart: () => select(el.id),
    onDragStart: () => select(el.id),
    onDragMove: onDragMove(el),
    onDragEnd: onDragEnd(el),
    onTransformStart: () => { anchor.current = tr.current?.getActiveAnchor() ?? null; },
    onTransformEnd: onTransformEnd(el),
  });

  return (
    <Stage width={sw} height={sh} style={{ touchAction: 'none' }} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onMouseDown={(e) => { if (e.target === e.target.getStage()) select(null); }} onTouchStart={(e) => { if (e.target === e.target.getStage()) select(null); }}>
      <Layer x={ox} y={oy} scaleX={scale} scaleY={scale}>
        <Rect x={0} y={0} width={FULL_W} height={FULL_H} fill={design.bg} onMouseDown={() => select(null)} onTouchStart={() => select(null)} />
        {design.elements.map((el) => {
          if (el.type === 'text') return <Text key={el.id} ref={ref(el.id)} {...textAttrs(el)} {...common(el)} onDblClick={() => onEditText(el.id)} onDblTap={() => onEditText(el.id)} />;
          if (el.type === 'shape') return <ShapeNode key={el.id} el={el} nodeRef={ref(el.id)} extra={common(el)} />;
          return (
            <ImageNode key={el.id} el={el} asset={el.assetId ? assets[el.assetId] : undefined} nodeRef={ref(el.id)} extra={common(el)}
              onPlaceholder={() => { select(el.id); onRequestUpload(el.id); }}
              onDbl={() => (el.assetId ? onRequestCrop(el.id) : onRequestUpload(el.id))} />
          );
        })}
        <Text {...producerAttrs(design.bg)} />
      </Layer>

      {/* warstwa pomocnicza – nie trafia do druku */}
      <Layer x={ox} y={oy} scaleX={scale} scaleY={scale} listening={false}>
        <Path data={`M0 0 H${FULL_W} V${FULL_H} H0 Z M${BLEED} ${BLEED} V${BLEED + NET_H} H${BLEED + NET_W} V${BLEED} Z`} fill="rgba(40,40,40,0.45)" />
        <Line points={FRONT_HEXAGON.flat()} closed stroke="#b26935" strokeWidth={1.4 / scale} dash={[4 / scale, 3 / scale]} opacity={0.8} />
        <Text x={FRONT.x} y={FRONT.y - 2.6} width={FRONT.w} align="center" text="PRZÓD CUKIERKA" fontSize={1.8} fontFamily="Lato" fill="#b26935" opacity={0.75} />
        {(showGrid || mode === 'advanced') && (
          <>
            {FOLD_LINES.map((l, i) => <Line key={i} points={l} stroke="#00a8b0" strokeWidth={1 / scale} dash={[3 / scale, 2 / scale]} />)}
            {PANELS.filter((p) => p.textOk).map((p) => { const r = safeRect(p); return <Rect key={p.id} x={r.x} y={r.y} width={r.w} height={r.h} stroke="#4caf50" strokeWidth={0.8 / scale} dash={[1.5 / scale, 2 / scale]} />; })}
            {PANELS.filter((p) => !p.textOk).map((p) => <Text key={p.id} x={p.rect.x} y={p.rect.y + p.rect.h - 6} width={p.rect.w} align="center" text={'zawinięty\nkoniec'} fontSize={1.6} fill="#00838f" />)}
          </>
        )}
        <Text x={0} y={FULL_H - BLEED + 0.5} width={FULL_W} align="center" text="szare pole zostanie odcięte" fontSize={1.6} fill="#ffffff" />
        {guides.v && <Line points={[FRONT_CENTER.x, 0, FRONT_CENTER.x, FULL_H]} stroke="#ff9800" strokeWidth={1 / scale} />}
        {guides.h && <Line points={[0, FRONT_CENTER.y, FULL_W, FRONT_CENTER.y]} stroke="#ff9800" strokeWidth={1 / scale} />}
      </Layer>

      <Layer x={ox} y={oy} scaleX={scale} scaleY={scale}>
        <Transformer
          ref={tr}
          rotationSnaps={[0, 90, 180, 270]}
          keepRatio={selected?.type !== 'shape'}
          enabledAnchors={selected?.type === 'text'
            ? ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right']
            : selected?.type === 'shape' ? undefined : ['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          anchorSize={14}
          anchorCornerRadius={7}
          borderStroke="#b26935"
          anchorStroke="#b26935"
          ignoreStroke
          boundBoxFunc={(o, n) => (Math.abs(n.width) < 8 || Math.abs(n.height) < 4 ? o : n)}
        />
      </Layer>
    </Stage>
  );
}

function ShapeNode({ el, nodeRef, extra }: { el: ShapeEl; nodeRef: (n: Konva.Node | null) => void; extra: object }) {
  if (el.shape === 'rect') return <Rect ref={nodeRef} {...shapeAttrs(el)} width={el.w} height={el.h} cornerRadius={el.cornerRadius} {...extra} />;
  if (el.shape === 'ellipse') return <Ellipse ref={nodeRef} {...shapeAttrs(el)} offsetX={0} offsetY={0} radiusX={el.w / 2} radiusY={el.h / 2} {...extra} />;
  return <Path ref={nodeRef} {...shapeAttrs(el)} data={HEART_PATH} scaleX={el.w / 100} scaleY={el.h / 92} offsetX={50} offsetY={46} {...extra} />;
}

function ImageNode({ el, asset, nodeRef, extra, onPlaceholder, onDbl }: {
  el: ImageEl; asset?: import('../lib/types').Asset; nodeRef: (n: Konva.Node | null) => void; extra: object;
  onPlaceholder: () => void; onDbl: () => void;
}) {
  const canvas = useMemo(() => (asset ? processedCanvas(asset, el, PREVIEW_MAX) : null), [asset, el.crop, el.adjust]); // eslint-disable-line
  if (!canvas) {
    return (
      <Group ref={nodeRef} x={el.cx} y={el.cy} offsetX={el.w / 2} offsetY={el.h / 2} rotation={el.rotation} {...extra} onClick={onPlaceholder} onTap={onPlaceholder}>
        <Rect width={el.w} height={el.h} fill="rgba(178,105,53,0.08)" stroke="#b26935" strokeWidth={0.3} dash={[1, 0.8]} cornerRadius={1} />
        <Text width={el.w} height={el.h} align="center" verticalAlign="middle" text={'+\n' + (el.placeholderLabel ?? 'Dodaj zdjęcie')} fontSize={Math.min(2.4, el.h / 4)} fontFamily="Lato" fill="#671e08" />
      </Group>
    );
  }
  const img = <KImage ref={el.clipFront ? undefined : nodeRef} image={canvas} {...imageAttrs(el)} {...(el.clipFront ? {} : extra)} onDblClick={onDbl} onDblTap={onDbl} />;
  if (!el.clipFront) return img;
  return (
    <Group clipFunc={clipHexagon as never}>
      <KImage ref={nodeRef} image={canvas} {...imageAttrs(el)} {...extra} onDblClick={onDbl} onDblTap={onDbl} />
    </Group>
  );
}
