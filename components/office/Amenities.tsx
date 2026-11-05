"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";
import { sceneNow } from "@/lib/store";
import { manilaMinutes, TRASH_AT, hm } from "@/lib/office-clock";
import type { EmployeeId } from "@/lib/team";
import { DEN, DUMPSTER, ENTRANCE, OFFICE, OUTSIDE, ROOM, SCENE_FONT, type Palette } from "./palette";

import { actWindows, trashRoute } from "./routes";
import { Dining, FrontZone } from "./FrontZone";
import { TrashBins } from "./Trash";
import { Rain } from "./Weather";
import { Car } from "./Car";
import { StreetLamp } from "./StreetLamp";
import { VapeArea } from "./Vape";
import { Carport } from "./Carport";
import { HQ } from "@/hq.config";

type Common = { pal: Palette; shadows: boolean };

/* ------------------------------------------------------------------ split-type air conditioners */

/**
 * Wall-mounted split AC (indoor unit), front facing local +z. When it's on, the louver opens,
 * the LED is green and cool air ripples down out of it.
 */
export function AirCon({ pal, shadows, position, rotY = 0, on }: Common & {
    position: [number, number, number]; rotY?: number; on: (min: number) => boolean;
}) {
    const louver = useRef<THREE.Group>(null);
    const led = useRef<THREE.MeshBasicMaterial>(null);
    const flows = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
    const ledOn = useMemo(() => new THREE.Color(pal.acLed), [pal.acLed]);
    const ledOff = useMemo(() => new THREE.Color("#7a8288"), []);

    useFrame(({ clock }, dt) => {
        const isOn = on(manilaMinutes(sceneNow()));
        if (louver.current) {
            const target = isOn ? 0.75 + Math.sin(clock.elapsedTime * 0.4) * 0.12 : 0;
            louver.current.rotation.x += (target - louver.current.rotation.x) * Math.min(1, dt * 2);
        }
        led.current?.color.copy(isOn ? ledOn : ledOff);
        flows.current.forEach((m, i) => {
            if (!m) return;
            const wave = (Math.sin(clock.elapsedTime * 1.8 - i * 1.1) + 1) / 2;
            m.opacity = isOn ? 0.1 + wave * 0.16 : 0;
        });
    });

    return (
        <group position={position} rotation={[0, rotY, 0]}>
            <RoundedBox args={[0.98, 0.3, 0.22]} radius={0.06} smoothness={3} castShadow={shadows}>
                <meshStandardMaterial color={pal.ac} roughness={0.35} />
            </RoundedBox>
            {/* front panel line, and the air outlet */}
            <mesh position={[0, 0.05, 0.111]}>
                <planeGeometry args={[0.88, 0.006]} />
                <meshBasicMaterial color={pal.acVent} />
            </mesh>
            <mesh position={[0, -0.1, 0.07]}>
                <boxGeometry args={[0.82, 0.05, 0.1]} />
                <meshStandardMaterial color="#2b3238" />
            </mesh>
            <group ref={louver} position={[0, -0.125, 0.115]}>
                <mesh position={[0, -0.03, 0]}>
                    <boxGeometry args={[0.8, 0.06, 0.012]} />
                    <meshStandardMaterial color={pal.ac} />
                </mesh>
            </group>
            <mesh position={[0.36, -0.02, 0.112]}>
                <circleGeometry args={[0.012, 10]} />
                <meshBasicMaterial ref={led} color={pal.acLed} toneMapped={false} />
            </mesh>
            {/* cool air: three translucent ribbons fanning down and out */}
            {[0, 1, 2].map((i) => (
                <mesh key={i} position={[0, -0.32 - i * 0.16, 0.22 + i * 0.14]} rotation={[-0.9, 0, 0]}>
                    <planeGeometry args={[0.76 - i * 0.08, 0.16]} />
                    <meshBasicMaterial
                        ref={(m) => { flows.current[i] = m; }}
                        color="#cfeefc" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false}
                    />
                </mesh>
            ))}
        </group>
    );
}

/** Outdoor condenser: a box with a spinning fan, front facing local +z. */
function Condenser({ pal, shadows, position, on }: Common & { position: [number, number, number]; on: (min: number) => boolean }) {
    const fan = useRef<THREE.Group>(null);
    useFrame((_, dt) => {
        if (fan.current && on(manilaMinutes(sceneNow()))) fan.current.rotation.z -= dt * 9;
    });
    return (
        <group position={position}>
            <RoundedBox args={[0.78, 0.58, 0.32]} radius={0.02} smoothness={2} position={[0, 0.33, 0]} castShadow={shadows}>
                <meshStandardMaterial color={pal.condenser} />
            </RoundedBox>
            <mesh position={[-0.1, 0.33, 0.162]}>
                <circleGeometry args={[0.22, 24]} />
                <meshStandardMaterial color="#2a3036" />
            </mesh>
            <group ref={fan} position={[-0.1, 0.33, 0.166]}>
                {[0, 1, 2].map((i) => (
                    <mesh key={i} rotation={[0, 0, (i / 3) * Math.PI * 2]} position={[0, 0, 0]}>
                        <boxGeometry args={[0.05, 0.38, 0.005]} />
                        <meshStandardMaterial color={pal.fan} />
                    </mesh>
                ))}
            </group>
            <mesh position={[-0.1, 0.33, 0.17]}>
                <ringGeometry args={[0.2, 0.225, 24]} />
                <meshStandardMaterial color={pal.condenser} />
            </mesh>
            {[-1, 1].map((s) => (
                <mesh key={s} position={[s * 0.3, 0.02, 0]}>
                    <boxGeometry args={[0.06, 0.04, 0.34]} />
                    <meshStandardMaterial color="#6b7378" />
                </mesh>
            ))}
        </group>
    );
}

/** The team's ACs run during office hours, Ronald's from early to late. */
export const floorAcOn = (min: number): boolean => min >= hm("08:00") && min < hm("19:00");
export const officeAcOn = (min: number): boolean => min >= hm("07:30") && min < hm("22:30");

/* ------------------------------------------------------------------ pantry, lounge, entrance */

/** Kitchenette along the front of the owner's glass: cabinets, coffee machine, sink, kettle, fruit. */
function Pantry({ pal, shadows }: Common) {
    const x0 = 12.3, x1 = ROOM.W - 0.08, z = OFFICE.z1 + 0.42, depth = 0.6, h = 0.9;
    const len = x1 - x0, cx = (x0 + x1) / 2;
    return (
        <group>
            <mesh position={[cx, h / 2 - 0.02, z]} castShadow={shadows} receiveShadow={shadows}>
                <boxGeometry args={[len, h - 0.04, depth]} />
                <meshStandardMaterial color={pal.counterSide} />
            </mesh>
            {/* cabinet doors */}
            {Array.from({ length: Math.round(len / 0.6) }, (_, i) => (
                <mesh key={i} position={[x0 + 0.3 + i * (len / Math.round(len / 0.6)), h / 2 - 0.04, z + depth / 2 + 0.003]}>
                    <planeGeometry args={[len / Math.round(len / 0.6) - 0.03, h - 0.14]} />
                    <meshStandardMaterial color="#3b4854" />
                </mesh>
            ))}
            <mesh position={[cx, h, z]} castShadow={shadows} receiveShadow={shadows}>
                <boxGeometry args={[len + 0.04, 0.04, depth + 0.04]} />
                <meshStandardMaterial color={pal.counter} roughness={0.3} />
            </mesh>
            {/* coffee machine */}
            <group position={[13.45, h + 0.02, z - 0.08]}>
                <RoundedBox args={[0.32, 0.4, 0.3]} radius={0.03} smoothness={2} position={[0, 0.2, 0]} castShadow={shadows}>
                    <meshStandardMaterial color="#20262c" />
                </RoundedBox>
                <mesh position={[0, 0.3, 0.152]}>
                    <planeGeometry args={[0.2, 0.08]} />
                    <meshStandardMaterial color={pal.steel} metalness={0.7} roughness={0.25} />
                </mesh>
                <mesh position={[0, 0.06, 0.12]}>
                    <cylinderGeometry args={[0.035, 0.03, 0.08, 12]} />
                    <meshStandardMaterial color="#ffffff" />
                </mesh>
            </group>
            {/* kettle and fruit bowl */}
            <mesh position={[13.95, h + 0.12, z - 0.05]} castShadow={shadows}>
                <cylinderGeometry args={[0.07, 0.09, 0.2, 14]} />
                <meshStandardMaterial color={pal.steel} metalness={0.6} roughness={0.3} />
            </mesh>
            <group position={[12.75, h + 0.05, z]}>
                <mesh>
                    <sphereGeometry args={[0.14, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
                    <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
                </mesh>
                {[["#f59e0b", 0.04, 0.02], ["#ef4444", -0.05, 0.0], ["#84cc16", 0.0, -0.05]].map(([c, x, zz]) => (
                    <mesh key={String(c)} position={[Number(x), 0.02, Number(zz)]}>
                        <sphereGeometry args={[0.045, 10, 8]} />
                        <meshStandardMaterial color={String(c)} />
                    </mesh>
                ))}
            </group>
            {/* sink with a tall faucet */}
            <mesh position={[14.6, h + 0.022, z]}>
                <boxGeometry args={[0.5, 0.01, 0.36]} />
                <meshStandardMaterial color="#9aa5ae" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[14.6, h + 0.16, z - 0.2]}>
                <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
                <meshStandardMaterial color={pal.steel} metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[14.6, h + 0.3, z - 0.12]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.013, 0.013, 0.16, 8]} />
                <meshStandardMaterial color={pal.steel} metalness={0.8} roughness={0.2} />
            </mesh>
        </group>
    );
}

/** Glass storefront on the right wall with the open sliding doors, a doormat, and the "HQ" decal. */
function Entrance({ pal }: { pal: Palette }) {
    const x = ROOM.W, H = ROOM.H;
    const doorZ0 = ENTRANCE.z - ENTRANCE.w / 2, doorZ1 = ENTRANCE.z + ENTRANCE.w / 2;
    const panes: [number, number][] = [[OFFICE.z1, doorZ0], [doorZ1, ROOM.D]];
    const glass = (
        <meshStandardMaterial color={pal.glass} transparent opacity={pal.glassOpacity + 0.04} side={THREE.DoubleSide} depthWrite={false} />
    );
    return (
        <group>
            {panes.map(([a, b]) => (
                <group key={a}>
                    <mesh position={[x, H / 2, (a + b) / 2]} rotation={[0, Math.PI / 2, 0]}>
                        <planeGeometry args={[b - a, H]} />
                        {glass}
                    </mesh>
                    {[a, b].map((zz) => (
                        <mesh key={zz} position={[x, H / 2, zz]}>
                            <boxGeometry args={[0.06, H, 0.06]} />
                            <meshStandardMaterial color={pal.glassFrame} />
                        </mesh>
                    ))}
                </group>
            ))}
            {/* sliding leaves, parked open behind the fixed panes */}
            {[[doorZ0 - 0.32, 0.6], [doorZ1 + 0.32, 0.6]].map(([zz, w]) => (
                <mesh key={zz} position={[x - 0.06, (H - 0.3) / 2, zz]} rotation={[0, Math.PI / 2, 0]}>
                    <planeGeometry args={[w, H - 0.3]} />
                    {glass}
                </mesh>
            ))}
            {/* header, top and bottom rails */}
            <mesh position={[x, H - 0.15, ENTRANCE.z]}>
                <boxGeometry args={[0.1, 0.3, ENTRANCE.w]} />
                <meshStandardMaterial color={pal.glassFrame} />
            </mesh>
            <mesh position={[x, H + 0.025, (OFFICE.z1 + ROOM.D) / 2]}>
                <boxGeometry args={[0.1, 0.05, ROOM.D - OFFICE.z1]} />
                <meshStandardMaterial color={pal.trim} />
            </mesh>
            <Suspense fallback={null}>
                <Text font={SCENE_FONT} position={[x + 0.055, H - 0.15, ENTRANCE.z]} rotation={[0, Math.PI / 2, 0]} fontSize={0.12} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.1}>
                    {`${HQ.owner.handle} ${HQ.shortName}`}
                </Text>
            </Suspense>
            <mesh position={[x - 0.5, 0.008, ENTRANCE.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.75, 1.1]} />
                <meshStandardMaterial color="#2b3238" roughness={1} />
            </mesh>
        </group>
    );
}

/* ------------------------------------------------------------------ outside: pavement, dumpster, condensers, street lamp (the carport and the vape gazebo have their own files) */

function Outside({ pal, shadows, assignee }: Common & { assignee: EmployeeId | null }) {
    const { x0, x1, z0, z1 } = OUTSIDE;
    const w = x1 - x0, d = z1 - z0;
    const lid = useRef<THREE.Group>(null);
    const bags = useRef<THREE.Group>(null);
    const toss = useMemo(() => (assignee ? actWindows(trashRoute(assignee), "toss")[0] ?? null : null), [assignee]);

    useFrame((_, dt) => {
        const min = manilaMinutes(sceneNow());
        const t = (min - TRASH_AT) * 60;
        const open = toss !== null && t >= toss[0] - 0.6 && t <= toss[1] + 0.3;
        if (lid.current) {
            const target = open ? -1.25 : 0;
            lid.current.rotation.x += (target - lid.current.rotation.x) * Math.min(1, dt * 6);
        }
        // today's bags sit in the bin from the trash run until the garbage truck at 6 AM
        if (bags.current) bags.current.visible = (toss !== null && t >= toss[0] + 1) || min < hm("06:00");
    });

    return (
        <group>
            {/* pavement slab with expansion joints, grass verge at the edge */}
            <mesh position={[x0 + w / 2, -0.05, z0 + d / 2]} receiveShadow={shadows}>
                <boxGeometry args={[w, 0.1, d]} />
                <meshStandardMaterial color={pal.concrete} roughness={0.95} />
            </mesh>
            {[1, 2, 3, 4].map((i) => (
                <mesh key={i} position={[x0 + w / 2 - 0.2, 0.002, z0 + (i * d) / 5]}>
                    <boxGeometry args={[w - 0.4, 0.002, 0.02]} />
                    <meshBasicMaterial color={pal.concreteSeam} />
                </mesh>
            ))}
            <mesh position={[x1 - 0.2, -0.03, z0 + d / 2]} receiveShadow={shadows}>
                <boxGeometry args={[0.4, 0.08, d]} />
                <meshStandardMaterial color={pal.grass} roughness={1} />
            </mesh>
            {[5.6, 7.9, 10.4].map((z) => (
                <mesh key={z} position={[x1 - 0.2, 0.18, z]} castShadow={shadows}>
                    <sphereGeometry args={[0.2, 10, 8]} />
                    <meshStandardMaterial color={pal.leafC} flatShading />
                </mesh>
            ))}

            {/* the big dumpster: body, wheels, hinged lid (opens when the bag goes in) */}
            <group position={[DUMPSTER.x, 0, DUMPSTER.z]}>
                <RoundedBox args={[1.5, 0.95, 0.92]} radius={0.04} smoothness={2} position={[0, 0.56, 0]} castShadow={shadows}>
                    <meshStandardMaterial color={pal.dumpster} roughness={0.7} />
                </RoundedBox>
                {[-0.75, 0.75].map((x) => (
                    <mesh key={x} position={[x, 0.86, 0]}>
                        <boxGeometry args={[0.04, 0.06, 0.96]} />
                        <meshStandardMaterial color={pal.dumpsterLid} />
                    </mesh>
                ))}
                {[[-0.6, -0.36], [0.6, -0.36], [-0.6, 0.36], [0.6, 0.36]].map(([x, z]) => (
                    <mesh key={`${x}${z}`} position={[x, 0.07, z]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.07, 0.07, 0.06, 12]} />
                        <meshStandardMaterial color="#1c2228" />
                    </mesh>
                ))}
                {/* bags sit just under the lid: you see them while it's open */}
                <group ref={bags} position={[0, 0.86, 0]} visible={false}>
                    {[[-0.3, 0.05], [0.15, -0.1], [0.4, 0.15]].map(([x, z], i) => (
                        <mesh key={i} position={[x, 0, z]} scale={[1, 0.7, 1]}>
                            <sphereGeometry args={[0.2, 10, 8]} />
                            <meshStandardMaterial color={pal.bag} roughness={0.4} />
                        </mesh>
                    ))}
                </group>
                <group ref={lid} position={[0, 1.04, -0.46]}>
                    <mesh position={[0, 0.02, 0.47]} castShadow={shadows}>
                        <boxGeometry args={[1.54, 0.05, 0.96]} />
                        <meshStandardMaterial color={pal.dumpsterLid} />
                    </mesh>
                </group>
                <Suspense fallback={null}>
                    <Text font={SCENE_FONT} position={[0, 0.6, 0.465]} fontSize={0.11} color="#e8f5ee" anchorX="center" anchorY="middle" letterSpacing={0.12}>
                        HQ WASTE
                    </Text>
                </Suspense>
            </group>
            {/* recycling bin beside it */}
            <group position={[DUMPSTER.x + 1.12, 0, DUMPSTER.z + 0.05]}>
                <RoundedBox args={[0.5, 0.82, 0.52]} radius={0.03} smoothness={2} position={[0, 0.41, 0]} castShadow={shadows}>
                    <meshStandardMaterial color="#2563a8" />
                </RoundedBox>
                <mesh position={[0, 0.84, 0]}>
                    <boxGeometry args={[0.54, 0.04, 0.56]} />
                    <meshStandardMaterial color="#1e4f87" />
                </mesh>
            </group>

            {/* AC condensers on the wall outside */}
            <Condenser pal={pal} shadows={shadows} position={[ROOM.W + 0.55, 0, OUTSIDE.z0 + 0.25]} on={officeAcOn} />
            <Condenser pal={pal} shadows={shadows} position={[ROOM.W + 1.45, 0, OUTSIDE.z0 + 0.25]} on={floorAcOn} />

            {/* street lamp in the far corner of the pavement, clear of the parked car */}
            <StreetLamp position={[x1 - 0.35, 0, z0 + 0.35]} rotY={-Math.PI / 2} />
        </group>
    );
}

/** Everything around the desks: pantry, lounge, the entrance, outside, the ACs and the bins. */
export function Amenities({ pal, shadows, assignee }: Common & { assignee: EmployeeId | null }) {
    return (
        <group>
            <Pantry pal={pal} shadows={shadows} />
            <FrontZone pal={pal} shadows={shadows} />
            <Dining pal={pal} shadows={shadows} />
            <Entrance pal={pal} />
            <Outside pal={pal} shadows={shadows} assignee={assignee} />
            <TrashBins pal={pal} shadows={shadows} assignee={assignee} />
            <Rain />
            <Car shadows={shadows} />
            <Carport shadows={shadows} />
            <VapeArea pal={pal} shadows={shadows} />
            {/* split ACs high on the Den's outer wall (blowing across it and the team), one in the meeting room */}
            <AirCon pal={pal} shadows={shadows} position={[DEN.x0 + 0.12, 2.3, 2.1]} rotY={Math.PI / 2} on={floorAcOn} />
            <AirCon pal={pal} shadows={shadows} position={[DEN.x0 + 0.12, 2.3, 9.4]} rotY={Math.PI / 2} on={floorAcOn} />
            <AirCon pal={pal} shadows={shadows} position={[0.12, 2.3, 9.9]} rotY={Math.PI / 2} on={floorAcOn} />
        </group>
    );
}
