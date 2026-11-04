"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { HQ } from "@/hq.config";

const ME = HQ.owner.handle;

/**
 * What's on Ronald's ultrawide: an original battle-royale match (no real game's art or logos) drawn on a canvas.
 * A dusk canyon with cliffs, a far-off relay tower and dropship, and an HUD: compass, minimap with the
 * closing ring, kill feed, squads left, three squad health/shield bars, weapon and ammo, crosshair.
 * Redrawn every second so the ring timer, ammo and squad count move.
 */

const W = 1200, H = 400;

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function draw(g: CanvasRenderingContext2D, tick: number) {
  // sky: dusk gradient and a low sun
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#2a1f4a");
  sky.addColorStop(0.45, "#c2554a");
  sky.addColorStop(0.7, "#f4a259");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255, 220, 150, 0.9)";
  g.beginPath(); g.arc(820, 230, 34, 0, Math.PI * 2); g.fill();

  // three layers of canyon cliffs
  const layer = (seed: number, base: number, amp: number, color: string) => {
    const r = rng(seed);
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) g.lineTo(x, base - r() * amp - (x % 160 === 0 ? amp * 0.4 : 0));
    g.lineTo(W, H); g.closePath(); g.fill();
  };
  layer(7, 270, 70, "#7a3b4a");
  // relay tower on the middle ridge, beacon blinking
  g.fillStyle = "#3b2233";
  g.fillRect(300, 150, 10, 110);
  g.fillRect(286, 150, 38, 8);
  g.fillStyle = tick % 2 ? "#ff5a3c" : "#7a2a22";
  g.beginPath(); g.arc(305, 146, 5, 0, Math.PI * 2); g.fill();
  layer(19, 310, 60, "#4e2638");
  layer(31, 360, 40, "#2b1724");
  // a dropship crossing the sky
  const sx = 120 + ((tick * 23) % 900);
  g.fillStyle = "#1d1426";
  g.beginPath(); g.moveTo(sx, 70); g.lineTo(sx + 70, 64); g.lineTo(sx + 86, 72); g.lineTo(sx + 70, 80); g.closePath(); g.fill();

  // HUD
  g.font = "bold 16px ui-monospace, monospace";
  g.textBaseline = "middle";
  // compass strip
  g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(450, 14, 300, 26);
  g.fillStyle = "#f8fafc";
  ["NW", "N", "NE", "E", "SE"].forEach((d, i) => g.fillText(d, 470 + i * 62 - ((tick * 6) % 62), 27));
  g.fillRect(598, 38, 4, 8);
  // minimap with the ring
  g.fillStyle = "rgba(15, 23, 42, 0.75)"; g.beginPath(); g.arc(78, 80, 60, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 2; g.stroke();
  g.strokeStyle = "#60a5fa"; g.lineWidth = 3;
  g.beginPath(); g.arc(92, 72, 40 - (tick % 30) * 0.6, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#facc15"; g.beginPath(); g.moveTo(78, 70); g.lineTo(84, 86); g.lineTo(72, 86); g.closePath(); g.fill();
  const left = 60 - (tick % 60);
  g.fillStyle = "#f8fafc"; g.font = "bold 14px ui-monospace, monospace";
  g.fillText(`RING CLOSING 0:${String(left).padStart(2, "0")}`, 20, 160);
  // squads left and kill feed (top right)
  g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(1010, 16, 170, 34);
  g.fillStyle = "#f8fafc"; g.font = "bold 18px ui-monospace, monospace";
  g.fillText(`SQUADS  ${Math.max(2, 9 - Math.floor(tick / 20) % 8)}`, 1024, 33);
  g.font = "13px ui-monospace, monospace";
  [[ME, "Dune_77"], ["Kite", "nova.exe"], [ME, "Pebble"]].forEach(([a, b], i) => {
    g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(960, 62 + i * 24, 220, 20);
    g.fillStyle = a === ME ? "#fbbf24" : "#e2e8f0";
    g.fillText(`${a}  ✕  ${b}`, 970, 72 + i * 24);
  });
  // squad (bottom left): name, shield (blue segments) and health (white)
  [ME, "Kite", "Mara"].forEach((n, i) => {
    const y = 290 + i * 34;
    g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(16, y - 4, 230, 30);
    g.fillStyle = "#f8fafc"; g.font = "bold 13px ui-monospace, monospace"; g.fillText(n, 24, y + 6);
    const shield = i === 1 ? 2 : 4;
    for (let k = 0; k < 4; k++) { g.fillStyle = k < shield ? "#60a5fa" : "rgba(255,255,255,0.15)"; g.fillRect(110 + k * 32, y, 28, 6); }
    g.fillStyle = "rgba(255,255,255,0.2)"; g.fillRect(110, y + 10, 124, 6);
    g.fillStyle = i === 2 ? "#f87171" : "#f8fafc"; g.fillRect(110, y + 10, i === 2 ? 50 : 124, 6);
  });
  // weapon and ammo (bottom right)
  g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(960, 320, 224, 62);
  g.fillStyle = "#f8fafc"; g.font = "bold 34px ui-monospace, monospace";
  g.fillText(String(28 - (tick % 29)).padStart(2, "0"), 976, 352);
  g.font = "bold 16px ui-monospace, monospace"; g.fillStyle = "#cbd5e1";
  g.fillText("/ 140", 1030, 356);
  g.fillText("SMG  ◆◆◇", 1094, 340);
  // crosshair
  g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(600, 186); g.lineTo(600, 196); g.moveTo(600, 204); g.lineTo(600, 214);
  g.moveTo(586, 200); g.lineTo(596, 200); g.moveTo(604, 200); g.lineTo(614, 200);
  g.stroke();
}

/** A live texture of the match, for the curved ultrawide (mirrored so it reads correctly from the chair). */
export function useGameScreen(): THREE.CanvasTexture {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    if (g) draw(g, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    // the screen is the inside of a cylinder, which flips u: mirror it back
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.x = -1;
    return t;
  }, []);
  useEffect(() => {
    const c = tex.image;
    if (!(c instanceof HTMLCanvasElement)) return;
    const g = c.getContext("2d");
    if (!g) return;
    let tick = 0;
    const id = setInterval(() => { tick += 1; draw(g, tick); tex.needsUpdate = true; }, 1000);
    return () => { clearInterval(id); tex.dispose(); };
  }, [tex]);
  return tex;
}
