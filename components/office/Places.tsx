"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { create } from "zustand";
import type { ThreeEvent } from "@react-three/fiber";
import { MapPin, ShoppingBag, X } from "lucide-react";
import { useOffice } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { cn } from "@/lib/utils";
import { HQ } from "@/hq.config";
import { EST, SIGN } from "./Neighbourhood";
import { ROOM } from "./palette";
import { BACK_STREETS, FAR_WALK, SIDE_STREETS } from "./world";
import { useSceneNow } from "./scene-clock-ui";

/**
 * Tap a building in town for a little card about it, like a sim game: what it is, its hours, whether it's open
 * at the scene's time, and for the sari-sari store a button that sends the boss there for a snack.
 * The buildings themselves are merged geometry, so each place gets an invisible box on top that takes the tap.
 */

type Hours = "24h" | "shop" | "day" | "home";
type Place = {
  id: string;
  name: string;
  sub?: string;
  blurb: string;
  hours: Hours;
  box: { x0: number; x1: number; z0: number; z1: number; h: number };
  errand?: "snack";
};

const BLURB: Partial<Record<keyof typeof SIGN, string>> = {
  sari: "Everything in tingi: one sachet of coffee, two eggs, a stick of Marlboro. Aling Nena knows everyone's utang by heart.",
  jollibee: "Chickenjoy with rice and gravy, a Yumburger, and peach mango pie. The bee waves at every kid who walks in.",
  mercury: "The pharmacy that never closes. Biogesic, vitamins, and a queue at 2 AM when someone has a fever.",
  labada: "Drop off a bag in the morning, pick it up folded and smelling of fabric softener by dinner.",
  seven: "Siopao, hotdog sandwiches, cold drinks and bills payment, all night long.",
  kapihan: "Strong kapeng barako in a small cup, with pandesal and the morning news.",
  panaderia: "Fresh pandesal from 5 AM, ensaymada and monay through the day. The vendors outside sell from here.",
  carinderia: "Lutong bahay in big pots: sinigang, adobo, menudo. Point at what you want, two viands with rice.",
  mcdo: "Fries, burgers, McFloat at the drive-thru. Busy at lunch and again late at night.",
  hardware: "Nails, paint, PVC pipe and a man who knows exactly what you need for that leaking faucet.",
  shell: "Fuel, air for the tyres, and a little convenience shop behind the pumps.",
  petron: "Fuel up before the drive to Clark. The pump attendant always asks how much.",
  toda: "The tricycle drivers' association terminal. Tell them where you're going and pay the fixed fare.",
  hall: "The barangay hall: clearances, the tanod's post, and the captain's office upstairs.",
};

const FAMILIES = ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Dizon", "Manalo", "Lansangan", "Pineda", "David", "Tolentino", "Gomez", "Mercado", "Yap", "Sison"];

const HOURS_LABEL: Record<Hours, string> = { "24h": "Open 24 hours", shop: "6:00 AM – 10:00 PM", day: "8:00 AM – 5:00 PM", home: "Private home" };
const isOpen = (h: Hours, min: number) => h === "24h" || (h === "shop" ? min >= 360 && min < 1320 : h === "day" ? min >= 480 && min < 1020 : false);

function buildPlaces(): Place[] {
  const out: Place[] = [];
  const FRONT = ROOM.D;
  EST.forEach((e, i) => {
    const s = SIGN[e.sign];
    out.push({
      id: `est-${i}`, name: s.text, sub: s.sub, blurb: BLURB[e.sign] ?? "",
      hours: e.allNight ? "24h" : "shop",
      box: { x0: e.x0, x1: e.x1, z0: FRONT - e.depth, z1: FRONT + 0.3, h: e.h + (e.floors === 2 ? 2.6 : 0.4) },
      errand: e.sign === "sari" ? "snack" : undefined,
    });
  });
  const z0 = FAR_WALK.z1 + 0.6;
  const across: [keyof typeof SIGN, number, number, number, number, number, Hours][] = [
    ["shell", -40, -29.5, z0, z0 + 9.8, 3.7, "24h"],
    ["petron", -17, -6.5, z0, z0 + 9.8, 3.7, "24h"],
    ["toda", -27.4, -20.4, z0, z0 + 7.6, 2.6, "shop"],
    ["hall", 44, 54, z0 + 2.4, z0 + 8.4, 5.8, "day"],
  ];
  for (const [sign, x0, x1, a, b, h, hours] of across) {
    const s = SIGN[sign];
    out.push({ id: sign, name: s.text, sub: s.sub || undefined, blurb: BLURB[sign] ?? "", hours, box: { x0, x1, z0: a, z1: b, h } });
  }
  out.push({
    id: "court", name: "Barangay court", sub: "basketball · zumba at 6 PM",
    blurb: "Pickup games after work, a liga every summer, and the barangay's fiestas and wakes under the lights.",
    hours: "shop", box: { x0: -3.6, x1: 11.8, z0: z0 + 0.8, z1: z0 + 8.6, h: 0.4 },
  });
  // the houses, laid out exactly as Neighbourhood's houses() does it
  let i = 0;
  BACK_STREETS.forEach((b, row) => {
    const gateZ = b.z0 - 0.45;
    for (let x = -46 + row * 3.4; x < 66; x += 7.6) {
      if (SIDE_STREETS.some((st) => x + 7 > st.x0 - 0.3 && x - 0.5 < st.x1 + 0.3)) continue;
      const sari = i === 4 || i === 13;
      const family = FAMILIES[i % FAMILIES.length];
      out.push({
        id: `house-${i}`,
        name: sari ? `${family} sari-sari` : `The ${family} family`,
        sub: sari ? "Coke · yelo · load, from the front window" : `Block ${row + 1}, Lot ${i + 1}`,
        blurb: sari
          ? "A window store in the front of the house. Knock and someone comes out from the sala."
          : "A family home behind its gate, with a water tank on the roof and laundry drying out back.",
        hours: sari ? "shop" : "home",
        box: { x0: x - 0.2, x1: x + 6.4, z0: gateZ - 7.4, z1: gateZ + 0.2, h: 5.5 },
      });
      i++;
    }
  });
  return out;
}

const usePlace = create<{ id: string | null; open: (id: string | null) => void }>((set) => ({ id: null, open: (id) => set({ id }) }));
/** Whether a place card is open (the floating music card steps aside for it). */
export const usePlaceOpen = (): boolean => usePlace((s) => s.id !== null);
let placesCache: Place[] | null = null;
const places = () => (placesCache ??= buildPlaces());

/** Invisible tap targets over every place in town. Mount inside the Canvas with the neighbourhood. */
export function PlaceHits() {
  const list = places();
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), []);
  const onClick = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    // a drag that pans the camera also ends in a click: only a real tap opens the card
    if (e.delta > 6) return;
    e.stopPropagation();
    usePlace.getState().open(id);
  };
  return (
    <group>
      {list.map((p) => {
        const { x0, x1, z0, z1, h } = p.box;
        return (
          <mesh
            key={p.id}
            geometry={geo}
            material={mat}
            position={[(x0 + x1) / 2, h / 2, (z0 + z1) / 2]}
            scale={[x1 - x0, h, z1 - z0]}
            onClick={onClick(p.id)}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = ""; }}
          />
        );
      })}
    </group>
  );
}

/** The card for the tapped place, over the bottom-left of the 3D view. Mount outside the Canvas. */
export function PlaceCard() {
  const id = usePlace((s) => s.id);
  const close = () => usePlace.getState().open(null);
  const sendBoss = useOffice((s) => s.sendBoss);
  const now = useSceneNow(30_000);
  const place = id ? places().find((p) => p.id === id) : undefined;
  if (!place) return null;
  const open = isOpen(place.hours, manilaMinutes(now));

  return (
    <div role="dialog" aria-label={place.name} className="glass absolute bottom-3 left-3 z-30 w-[min(20rem,calc(100%-5.5rem))] rounded-2xl bg-popover/90 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <MapPin className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{place.name}</h3>
          {place.sub && <p className="truncate text-xs text-muted-foreground">{place.sub}</p>}
        </div>
        <button type="button" onClick={close} aria-label="Close" className="-m-1 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {place.blurb && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{place.blurb}</p>}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{HOURS_LABEL[place.hours]}</span>
        {place.hours !== "home" && (
          <span className={cn("rounded-full px-2 py-0.5 font-medium", open ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
            {open ? "Open now" : "Closed"}
          </span>
        )}
      </div>
      {place.errand === "snack" && (
        <button
          type="button"
          disabled={!open}
          onClick={() => { sendBoss("snack"); close(); }}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <ShoppingBag className="size-4" aria-hidden />
          Send {HQ.owner.name} for a snack
        </button>
      )}
    </div>
  );
}
