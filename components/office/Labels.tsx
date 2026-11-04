"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { create } from "zustand";

/**
 * Screen-space labels for the 3D office (status bubbles, the stand-up brief).
 *
 * drei's <Html> gives every label its own React root inside the canvas, and unmounting those roots
 * races React's render (React 19: "Attempted to synchronously unmount a root while React was already
 * rendering", plus `removeChild` errors). Here the 3D tree only places invisible anchors; one ordinary
 * DOM layer above the canvas renders every label, and a frame loop moves each one to its anchor.
 */

/** What a label shows. `render` is called in the DOM layer, so it can use any DOM/React UI. */
export type LabelSpec = { render: () => ReactNode; /** Higher wins overlaps (before depth). */ layer?: number; interactive?: boolean };

const useLabels = create<{ specs: Record<string, LabelSpec> }>(() => ({ specs: {} }));
const anchors = new Map<string, THREE.Object3D>();
const elements = new Map<string, HTMLElement>();

/** Place a label in the 3D scene. Its DOM content is rendered by <LabelLayer> outside the canvas. */
export function Label({ id, position, spec }: { id: string; position: [number, number, number]; spec: LabelSpec }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const g = ref.current;
    if (g) anchors.set(id, g);
    return () => { anchors.delete(id); };
  }, [id]);
  useEffect(() => {
    useLabels.setState((s) => ({ specs: { ...s.specs, [id]: spec } }));
  }, [id, spec]);
  useEffect(() => () => {
    useLabels.setState((s) => {
      const specs = { ...s.specs };
      delete specs[id];
      return { specs };
    });
  }, [id]);
  return <group ref={ref} position={position} />;
}

const v = new THREE.Vector3();

/** Mount once inside the Canvas: moves every label to its anchor's screen position each frame. */
export function LabelProjector() {
  useFrame(({ camera, size }) => {
    for (const [id, obj] of anchors) {
      const el = elements.get(id);
      if (!el) continue;
      // hidden with its 3D parent (e.g. the janitor off shift, someone gone home)
      let visible = true;
      for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (!o.visible) { visible = false; break; }
      obj.updateWorldMatrix(true, false);
      v.setFromMatrixPosition(obj.matrixWorld).project(camera);
      if (!visible || v.z > 1 || v.z < -1) { el.style.visibility = "hidden"; continue; }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      // "" (inherit), never "visible": a visible child shows through a hidden parent, so the bubbles would
      // float over the Team and Reminders tabs on phones, where the office view is only hidden, not unmounted
      el.style.visibility = "";
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      // nearer the camera = on top, within its layer
      const layer = Number(el.dataset.layer ?? 0);
      el.style.zIndex = String(layer * 1000 + Math.round((1 - v.z) * 400));
    }
  });
  return null;
}

/** Mount once next to the Canvas (same positioned parent): renders all labels. */
export function LabelLayer() {
  const specs = useLabels((s) => s.specs);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-live="off">
      {Object.entries(specs).map(([id, spec]) => (
        <div
          key={id}
          ref={(el) => {
            if (el) elements.set(id, el);
            else elements.delete(id);
          }}
          data-layer={spec.layer ?? 0}
          className="absolute top-0 left-0"
          style={{ visibility: "hidden" }}
        >
          <div className={spec.interactive ? "pointer-events-auto" : undefined} style={{ transform: "translate(-50%, -100%)" }}>
            {spec.render()}
          </div>
        </div>
      ))}
    </div>
  );
}
