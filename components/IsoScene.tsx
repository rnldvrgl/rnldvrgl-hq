"use client";

import type { KeyboardEvent, ReactElement } from "react";
import { TEAM, type EmployeeId, type EmployeeMeta, type EmployeeView, type OfficeState } from "@/lib/team";
import { iconPath } from "@/components/Icons";
import { HQ } from "@/hq.config";

/* ---------- isometric projection: 2:1 tiles, x runs down-right, y runs down-left, z is up ---------- */
const TW = 88, TH = 44;            // tile width/height on screen
const OX = 380, OY = 150;          // screen position of floor corner (0,0)
const W = 10.6, D = 8.3;           // floor size in tiles
const WALL = 130;                  // wall height in px
const COS = 0.894, SIN = 0.447;    // unit vector along a floor axis on screen (2:1)

type Pt = [number, number];
const P = (x: number, y: number, z = 0): Pt => [OX + (x - y) * (TW / 2), OY + (x + y) * (TH / 2) - z];
const poly = (...pts: Pt[]) => pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");
/** SVG transform that lays a flat 2D drawing onto the back-right wall (plane y = const). */
const onRightWall = ([e, f]: Pt) => `matrix(${COS},${SIN},0,1,${e.toFixed(1)},${f.toFixed(1)})`;
/** ...and onto the back-left wall (plane x = const), reading left to right. */
const onLeftWall = ([e, f]: Pt) => `matrix(${COS},${-SIN},0,1,${e.toFixed(1)},${f.toFixed(1)})`;

const DESK_W = 1.7, DESK_D = 0.85, DESK_H = 30;

function Box({ x, y, w, d, h, top, left, right }: { x: number; y: number; w: number; d: number; h: number; top: string; left: string; right: string }) {
  return (
    <g>
      <polygon points={poly(P(x, y + d, h), P(x + w, y + d, h), P(x + w, y + d, 0), P(x, y + d, 0))} fill={left} />
      <polygon points={poly(P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d, 0), P(x + w, y, 0))} fill={right} />
      <polygon points={poly(P(x, y, h), P(x + w, y, h), P(x + w, y + d, h), P(x, y + d, h))} fill={top} />
    </g>
  );
}

function Floor() {
  const tiles: ReactElement[] = [];
  for (let i = 0; i < Math.ceil(W); i++) {
    for (let j = 0; j < Math.ceil(D); j++) {
      const w = Math.min(1, W - i), d = Math.min(1, D - j);
      tiles.push(
        <polygon key={`${i}-${j}`} points={poly(P(i, j), P(i + w, j), P(i + w, j + d), P(i, j + d))}
          fill={(i + j) % 2 ? "var(--floor-a)" : "var(--floor-b)"} stroke="var(--floor-line)" strokeWidth={0.6} />,
      );
    }
  }
  return <g>{tiles}</g>;
}

/** Plant leaves as [dx, dy, radius] offsets from the pot, in px. */
const LEAVES: readonly (readonly [number, number, number])[] = [[-10, -38, 13], [8, -44, 12], [0, -56, 13], [-4, -30, 10], [10, -30, 9]];

function Walls({ now, done, needsYou }: { now: Date; done: number; needsYou: number }) {
  const manila = new Date(now.getTime() + 8 * 3600_000);
  const h = manila.getUTCHours() % 12, m = manila.getUTCMinutes();
  const minuteAngle = (m / 60) * 360, hourAngle = ((h + m / 60) / 12) * 360;
  const win = (x1: number, x2: number) => (
    <g>
      <polygon points={poly(P(x1, 0, 48), P(x2, 0, 48), P(x2, 0, 112), P(x1, 0, 112))} fill="var(--window)" stroke="var(--wall-trim)" strokeWidth={3} />
      <line x1={P((x1 + x2) / 2, 0, 48)[0]} y1={P((x1 + x2) / 2, 0, 48)[1]} x2={P((x1 + x2) / 2, 0, 112)[0]} y2={P((x1 + x2) / 2, 0, 112)[1]} stroke="var(--wall-trim)" strokeWidth={2} />
    </g>
  );
  return (
    <g aria-hidden="true">
      <polygon points={poly(P(0, 0), P(0, D), P(0, D, WALL), P(0, 0, WALL))} fill="var(--wall-left)" />
      <polygon points={poly(P(0, 0), P(W, 0), P(W, 0, WALL), P(0, 0, WALL))} fill="var(--wall-right)" />
      <polyline points={poly(P(0, D, WALL), P(0, 0, WALL), P(W, 0, WALL))} fill="none" stroke="var(--wall-trim)" strokeWidth={4} />
      {win(1.2, 3.4)}
      {win(7.4, 9.6)}

      {/* whiteboard with today's tally */}
      <polygon points={poly(P(4.0, 0, 50), P(7.0, 0, 50), P(7.0, 0, 110), P(4.0, 0, 110))} fill="var(--board)" stroke="var(--wall-trim)" strokeWidth={3} />
      <g transform={onRightWall(P(4.25, 0, 96))} fontFamily="var(--font-plex)" fill="var(--board-ink)">
        <text x={0} y={0} fontSize={10.5} fontWeight={600}>TODAY</text>
        <text x={0} y={18} fontSize={11}>{done} reports done</text>
        <text x={0} y={34} fontSize={11} fill={needsYou ? "var(--st-needs)" : "var(--board-ink)"}>{needsYou} waiting for you</text>
      </g>

      {/* Manila wall clock */}
      <g transform={onLeftWall(P(0, 4.6, 98))}>
        <circle cx={0} cy={0} r={20} fill="var(--clock)" stroke="var(--wall-trim)" strokeWidth={3} />
        <line x1={0} y1={0} x2={0} y2={-10} stroke="var(--clock-ink)" strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${hourAngle})`} />
        <line x1={0} y1={0} x2={0} y2={-15} stroke="var(--clock-ink)" strokeWidth={1.5} strokeLinecap="round" transform={`rotate(${minuteAngle})`} />
        <text x={0} y={34} textAnchor="middle" fontSize={8} fontFamily="var(--font-plex)" fill="var(--ink-soft)">MNL</text>
      </g>

      {/* corner plant */}
      <Box x={0.25} y={0.3} w={0.45} d={0.45} h={22} top="var(--pot-top)" left="var(--pot-left)" right="var(--pot-right)" />
      {LEAVES.map(([dx, dy, r], i) => {
        const [cx, cy] = P(0.47, 0.52, 0);
        return <circle key={i} cx={cx + dx} cy={cy + dy} r={r} fill={i % 2 ? "var(--leaf-a)" : "var(--leaf-b)"} />;
      })}
    </g>
  );
}

function Desk({ meta, emp, selected, onSelect }: { meta: EmployeeMeta; emp: EmployeeView; selected: boolean; onSelect: (id: EmployeeId) => void }) {
  const { x, y } = meta.desk;
  const working = emp.status === "working";
  const off = !emp.enabled;
  const shirt = `var(--c${meta.color})`;

  // monitor, facing the viewer from the back of the desk
  const mx = x + DESK_W / 2, my = y + 0.28;
  const screenTL = P(mx - 0.38, my, DESK_H + 46);
  const screenColor =
    off ? "var(--screen-off)" :
    emp.status === "error" ? "var(--screen-error)" :
    working ? "var(--screen-on)" : "var(--screen-idle)";

  // person sits in front of the desk, back to us
  const [sx, sy] = P(x + DESK_W / 2, y + DESK_D + 0.5, 0);

  // name tag floats above the monitor
  const [tx, ty] = P(x + DESK_W / 2, y + 0.2, DESK_H + 72);
  const tagW = 58 + meta.name.length * 8.6;
  const lamp =
    off ? "var(--st-off)" :
    emp.status === "working" ? "var(--st-working)" :
    emp.status === "needs_you" ? "var(--st-needs)" :
    emp.status === "error" ? "var(--st-error)" : "var(--st-idle)";

  const label = `${meta.name}, ${meta.title}. ${off ? "Paused." : emp.status === "needs_you" ? "Needs you." : emp.status === "working" ? "Working." : emp.status === "error" ? "Hit an error." : "Idle."}`;
  const onKey = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(meta.id); } };

  return (
    <g className={`desk ${selected ? "is-selected" : ""} ${off ? "is-off" : ""}`} role="button" tabIndex={0}
      aria-label={label} aria-pressed={selected} onClick={() => onSelect(meta.id)} onKeyDown={onKey}>
      <polygon className="desk-pad" points={poly(P(x - 0.3, y - 0.25), P(x + DESK_W + 0.3, y - 0.25), P(x + DESK_W + 0.3, y + DESK_D + 1.05), P(x - 0.3, y + DESK_D + 1.05))} />

      <Box x={x} y={y} w={DESK_W} d={DESK_D} h={DESK_H} top="var(--desk-top)" left="var(--desk-left)" right="var(--desk-right)" />

      {/* monitor stand + bezel + screen */}
      <line x1={P(mx, my + 0.05, DESK_H)[0]} y1={P(mx, my + 0.05, DESK_H)[1]} x2={P(mx, my + 0.05, DESK_H + 12)[0]} y2={P(mx, my + 0.05, DESK_H + 12)[1]} stroke="var(--bezel)" strokeWidth={4} />
      <polygon points={poly(P(mx - 0.42, my, DESK_H + 10), P(mx + 0.42, my, DESK_H + 10), P(mx + 0.42, my, DESK_H + 50), P(mx - 0.42, my, DESK_H + 50))} fill="var(--bezel)" />
      <polygon className={working ? "screen-glow" : undefined} points={poly(P(mx - 0.38, my, DESK_H + 14), P(mx + 0.38, my, DESK_H + 14), P(mx + 0.38, my, DESK_H + 46), P(mx - 0.38, my, DESK_H + 46))} fill={screenColor} />
      {!off && (
        <g transform={onRightWall(screenTL)} className={working ? "typing" : undefined}>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={4} y={5 + i * 6.5} width={[24, 16, 28, 12][i]} height={2.6} rx={1.3}
              fill={working ? "var(--screen-line-on)" : "var(--screen-line)"} style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </g>
      )}

      {/* keyboard + mug for a lived-in desk */}
      <polygon points={poly(P(mx - 0.3, y + 0.55, DESK_H + 1), P(mx + 0.3, y + 0.55, DESK_H + 1), P(mx + 0.3, y + 0.72, DESK_H + 1), P(mx - 0.3, y + 0.72, DESK_H + 1))} fill="var(--bezel)" opacity={0.75} />
      <Box x={x + 1.35} y={y + 0.45} w={0.14} d={0.14} h={9} top={shirt} left={shirt} right={shirt} />

      {/* person (hidden when paused) + chair */}
      <g className={working ? "bob" : undefined}>
        {!off && (
          <>
            <rect x={sx - 17} y={sy - 58} width={34} height={36} rx={14} fill={shirt} />
            <rect x={sx - 4} y={sy - 66} width={8} height={8} fill="var(--skin)" />
            <circle cx={sx} cy={sy - 74} r={12} fill="var(--hair)" />
            <ellipse cx={sx - 12} cy={sy - 72} rx={2.5} ry={3.5} fill="var(--skin)" />
            <ellipse cx={sx + 12} cy={sy - 72} rx={2.5} ry={3.5} fill="var(--skin)" />
          </>
        )}
      </g>
      <rect x={sx - 19} y={sy - 44} width={38} height={30} rx={8} fill="var(--chair)" />
      <rect x={sx - 2} y={sy - 15} width={4} height={10} fill="var(--chair-leg)" />
      <ellipse cx={sx} cy={sy - 4} rx={16} ry={6} fill="none" stroke="var(--chair-leg)" strokeWidth={3} />

      {/* name tag: icon badge, name, status lamp */}
      <g className="tag">
        <rect x={tx - tagW / 2} y={ty - 15} width={tagW} height={30} rx={15} fill="var(--tag)" stroke={selected ? "var(--primary)" : "var(--tag-line)"} strokeWidth={selected ? 2 : 1} />
        <circle cx={tx - tagW / 2 + 15} cy={ty} r={11} fill={shirt} />
        <g transform={`translate(${tx - tagW / 2 + 15 - 7.2},${ty - 7.2}) scale(0.6)`}>
          <path d={iconPath(meta.icon)} fill="none" stroke="var(--tag-icon)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x={tx - tagW / 2 + 32} y={ty + 4.5} fontSize={13} fontWeight={600} fill="var(--ink)" fontFamily="var(--font-display)">{meta.name}</text>
        <circle className={emp.status === "working" ? "lamp-pulse" : undefined} cx={tx + tagW / 2 - 13} cy={ty} r={4.5} fill={lamp} />
      </g>
    </g>
  );
}

/** Stand-in for a desk the server hasn't reported on yet, so the scene never renders a missing employee. */
const idleEmployee = (id: EmployeeId): EmployeeView => ({ id, enabled: true, status: "idle", summary: null, last_run_at: null, runs: [] });

export function IsoScene({ state, selected, onSelect, now }: {
  state: OfficeState; selected: EmployeeId | null; onSelect: (id: EmployeeId) => void; now: Date;
}) {
  const byId = new Map(state.employees.map((e) => [e.id, e]));
  const desks = [...TEAM].sort((a, b) => a.desk.x + a.desk.y - (b.desk.x + b.desk.y));
  const todayKey = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
  const done = state.employees.flatMap((e) => e.runs)
    .filter((r) => r.status !== "error" && r.status !== "running" && new Date(new Date(r.started_at).getTime() + 8 * 3600_000).toISOString().slice(0, 10) === todayKey).length;
  const needsYou = state.employees.filter((e) => e.status === "needs_you").length;

  return (
    <svg className="scene" viewBox="0 0 870 600" role="group" aria-label={`${HQ.appName}. Select a desk to see that employee's work.`}>
      <Floor />
      <Walls now={now} done={done} needsYou={needsYou} />
      {desks.map((meta) => (
        <Desk key={meta.id} meta={meta} emp={byId.get(meta.id) ?? idleEmployee(meta.id)} selected={selected === meta.id} onSelect={onSelect} />
      ))}
    </svg>
  );
}
