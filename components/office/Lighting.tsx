"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { sceneNow, sceneWeather, type WeatherKind } from "@/lib/store";
import { manilaMinutes } from "@/lib/office-clock";
import { CENTER, ROOM } from "./palette";

/**
 * Daylight through the day, in Manila time: a warm sunrise, bright lunch, golden afternoon,
 * then the office lights at night. Values are keyframes blended by the minute.
 */
type Key = {
  at: number; // minute of the day
  ambient: number; ambientColor: string;
  hemi: number;
  sun: number; sunColor: string;
  skyTop: string; skyBottom: string;
  /** Office lights: 0 off … 1 fully on. */
  lamps: number;
  /** 0 day … 1 night: stars and the lit city. */
  night: number;
};

const K = (h: number, m: number, rest: Omit<Key, "at">): Key => ({ at: h * 60 + m, ...rest });
const NIGHT_KEY = { ambient: 0.16, ambientColor: "#7d8fcf", hemi: 0.12, sun: 0.28, sunColor: "#9db4ff", skyTop: "#050b18", skyBottom: "#16264a", lamps: 1, night: 1 };
/**
 * Morning: crisp and bright. Lunch: the brightest, neutral white. Afternoon: warm and golden with a lower sun.
 * Golden hour → dusk: amber, then purple, office lights on. Night: dark blue, lit by the office lamps.
 */
const KEYS: Key[] = [
  K(0, 0, NIGHT_KEY),
  K(5, 15, NIGHT_KEY),
  K(6, 15, { ambient: 0.36, ambientColor: "#ffc9a8", hemi: 0.26, sun: 0.75, sunColor: "#ff9e6a", skyTop: "#f29a78", skyBottom: "#ffd9a2", lamps: 0.6, night: 0.25 }),
  K(8, 0, { ambient: 0.6, ambientColor: "#f6f8ff", hemi: 0.42, sun: 1.3, sunColor: "#fff1d8", skyTop: "#79bdee", skyBottom: "#e4f3fc", lamps: 0.1, night: 0 }),
  K(11, 30, { ambient: 0.92, ambientColor: "#ffffff", hemi: 0.56, sun: 1.75, sunColor: "#fffdf6", skyTop: "#4fa9ea", skyBottom: "#d2ecff", lamps: 0, night: 0 }),
  K(13, 0, { ambient: 0.9, ambientColor: "#ffffff", hemi: 0.55, sun: 1.7, sunColor: "#fffaf0", skyTop: "#56abe8", skyBottom: "#d6ecfd", lamps: 0, night: 0 }),
  K(15, 0, { ambient: 0.62, ambientColor: "#ffe4c2", hemi: 0.42, sun: 1.45, sunColor: "#ffc983", skyTop: "#82b9e2", skyBottom: "#ffe0b3", lamps: 0.05, night: 0 }),
  K(17, 0, { ambient: 0.46, ambientColor: "#ffc69a", hemi: 0.32, sun: 1.2, sunColor: "#ff9548", skyTop: "#7a6fa8", skyBottom: "#ffa365", lamps: 0.45, night: 0.08 }),
  K(18, 15, { ambient: 0.28, ambientColor: "#a99ccf", hemi: 0.2, sun: 0.45, sunColor: "#ff7a4a", skyTop: "#252a5a", skyBottom: "#c45f78", lamps: 1, night: 0.6 }),
  K(19, 30, NIGHT_KEY),
  K(24, 0, NIGHT_KEY),
];

/** Live lighting values, written once per frame by <Lighting>, read by anything that glows. */
export const light = {
  min: 0,
  lamps: 0,
  night: 0,
  /** 0 clear … 1 heavy overcast, and 0–1 rain; eased toward the current weather. */
  cloud: 0,
  rain: 0,
  /** A lightning flash, 0–1 (storms). */
  flash: 0,
};

const WEATHER_TARGET: Record<WeatherKind, { cloud: number; rain: number }> = {
  clear: { cloud: 0, rain: 0 },
  cloudy: { cloud: 0.65, rain: 0 },
  rain: { cloud: 0.85, rain: 0.8 },
  storm: { cloud: 1, rain: 1 },
};

const tmpA = new THREE.Color(), tmpB = new THREE.Color();
function lerpColor(out: THREE.Color, a: string, b: string, k: number): THREE.Color {
  return out.copy(tmpA.set(a)).lerp(tmpB.set(b), k);
}

/** One sky for every window, coloured in world space so the skyline continues from window to window. */
export const skyUniforms = {
  uTop: { value: new THREE.Color("#7fbfeb") },
  uBottom: { value: new THREE.Color("#e3f2fb") },
  uNight: { value: 0 },
  uRain: { value: 0 },
  uTime: { value: 0 },
};

const SKY_VERTEX = /* glsl */ `
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uNight;
uniform float uRain;
uniform float uTime;
varying vec3 vW;
float h1(float n) { return fract(sin(n) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // distance along the wall: x on the back wall, z on the left wall
  float u = vW.x + vW.z * 1.0 + 40.0;
  float v = vW.y;
  vec3 col = mix(uBottom, uTop, smoothstep(0.8, 2.5, v));
  // stars
  float star = step(0.992, h2(floor(vec2(u, v) * 46.0))) * uNight * smoothstep(1.5, 2.3, v);
  col += vec3(star);
  // Mabalacat, Pampanga: Mount Arayat on the horizon, then low-rise town and a few mid-rise blocks
  float arayat = 1.05 + 0.85 * exp(-pow((u - 47.0) / 2.4, 2.0)) + 0.25 * exp(-pow((u - 44.5) / 1.6, 2.0));
  vec3 mountain = mix(mix(uBottom, vec3(0.42, 0.52, 0.5), 0.55), vec3(0.04, 0.06, 0.1), uNight);
  if (v < arayat) col = mix(col, mountain, 0.85);
  float far = floor(u * 1.7);
  float farTop = 0.95 + h1(far) * 0.35 + step(0.85, h1(far + 5.0)) * 0.3;
  float near = floor(u * 1.1 + 0.4);
  float nearTop = 0.82 + h1(near + 17.0) * 0.22;
  vec3 farDay = mix(uBottom, vec3(0.6, 0.63, 0.6), 0.5);
  vec3 nearDay = vec3(0.5, 0.52, 0.5);
  vec3 farCol = mix(farDay, vec3(0.05, 0.07, 0.12), uNight);
  vec3 nearCol = mix(nearDay, vec3(0.03, 0.04, 0.07), uNight);
  // windows in the buildings: faint by day, many lit at night
  vec2 wp = vec2(u * 16.0, v * 20.0);
  vec2 wf = fract(wp);
  float win = step(0.3, wf.x) * step(wf.x, 0.7) * step(0.3, wf.y) * step(wf.y, 0.75);
  float lit = step(1.0 - (0.08 + 0.42 * uNight), h2(floor(wp) + near));
  vec3 lamp = vec3(1.0, 0.82, 0.5);
  if (v < farTop) col = mix(farCol, lamp, win * lit * uNight * 0.55);
  if (v < nearTop) col = mix(nearCol, lamp, win * lit * uNight * 0.85) + win * (1.0 - uNight) * 0.05;
  // rain: grey haze, and streaks running down the glass
  col = mix(col, vec3(0.55, 0.6, 0.66) * (1.0 - 0.75 * uNight), uRain * 0.35);
  float lane = floor(u * 55.0);
  float drop = fract(v * 1.6 + uTime * (1.4 + h1(lane) * 1.2) + h1(lane + 3.0));
  float streak = step(0.6, h1(lane + 9.0)) * smoothstep(0.0, 0.05, drop) * (1.0 - smoothstep(0.05, 0.22, drop));
  col += vec3(0.75, 0.82, 0.9) * streak * uRain * 0.35;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function useSkyMaterial(): THREE.ShaderMaterial {
  return useMemo(() => new THREE.ShaderMaterial({ uniforms: skyUniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT }), []);
}

/** Soft radial glow, for pools of light on the floor at night. */
let glowTexture: THREE.CanvasTexture | null = null;
export function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.45, "rgba(255,255,255,0.45)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
  }
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/** Downlight pools on the floor: over each desk pair, the lanes, the pantry and the lounge. [x, z, radius] */
const POOLS: readonly (readonly [number, number, number])[] = [
  [3.0, 2.4, 2.2], [7.8, 2.4, 2.2], [3.0, 6.1, 2.2], [7.8, 6.1, 2.2], [13.0, 6.6, 1.8], [13.0, 1.8, 1.8],
  [2.2, 9.9, 1.8], [7.4, 9.8, 1.9], [12.9, 9.9, 1.9],
];

/** Ceiling lights that actually light things (kept to a few: each light costs on phones). */
const LAMP_LIGHTS: readonly (readonly [number, number])[] = [[3.0, 3.9], [7.8, 5.6], [12.8, 8.0]];

export function Lighting({ shadows }: { shadows: boolean }) {
  const ambient = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const lamps = useRef<(THREE.PointLight | null)[]>([]);
  const pools = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(CENTER.x, 0, CENTER.z);
    return o;
  }, []);
  const glow = useMemo(() => getGlowTexture(), []);

  useFrame(({ clock }, dt) => {
    const min = manilaMinutes(sceneNow());
    const target = WEATHER_TARGET[sceneWeather()];
    const ease = Math.min(1, dt * 0.8);
    light.cloud += (target.cloud - light.cloud) * ease;
    light.rain += (target.rain - light.rain) * ease;
    // storms: a double flash every 9 seconds or so
    const storm = sceneWeather() === "storm";
    const ph = clock.elapsedTime % 9.3;
    light.flash = storm && (ph < 0.08 || (ph > 0.2 && ph < 0.3)) ? 1 : 0;
    const overcast = light.cloud;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].at <= min) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = b.at > a.at ? Math.min(1, Math.max(0, (min - a.at) / (b.at - a.at))) : 0;
    // ease so the light settles at each keyframe instead of moving at a constant rate
    const e = k * k * (3 - 2 * k);
    const num = (x: number, y: number) => x + (y - x) * e;

    light.min = min;
    light.lamps = num(a.lamps, b.lamps);
    light.night = num(a.night, b.night);

    if (ambient.current) {
      ambient.current.intensity = num(a.ambient, b.ambient) * (1 - 0.3 * overcast) + light.flash * 1.6;
      lerpColor(ambient.current.color, a.ambientColor, b.ambientColor, e);
    }
    if (hemi.current) {
      hemi.current.intensity = num(a.hemi, b.hemi);
      lerpColor(hemi.current.color, a.skyTop, b.skyTop, e).lerp(tmpA.set("#ffffff"), 0.6);
    }
    if (sun.current) {
      sun.current.intensity = num(a.sun, b.sun) * (1 - 0.7 * overcast);
      lerpColor(sun.current.color, a.sunColor, b.sunColor, e);
      // the sun swings from the front-right in the morning to the front-left in the afternoon; the moon hangs high left
      const dayK = Math.min(1, Math.max(0, (min - 360) / (1110 - 360)));
      const angle = 0.35 + dayK * (Math.PI - 0.7);
      const isNight = light.night > 0.5;
      const x = isNight ? CENTER.x - 6 : CENTER.x + Math.cos(angle) * 11;
      const y = isNight ? 13 : 2.5 + Math.sin(angle) * 12.5;
      sun.current.position.set(x, y, CENTER.z + 7);
    }
    // on a dark rainy day the office lights come on too
    const lampLevel = Math.min(1, light.lamps + overcast * (1 - light.night) * 0.6);
    lamps.current.forEach((l) => { if (l) l.intensity = lampLevel * 5.5; });
    pools.current.forEach((m) => { if (m) m.opacity = lampLevel * 0.32; });

    lerpColor(skyUniforms.uTop.value, a.skyTop, b.skyTop, e).lerp(tmpA.set(light.night > 0.5 ? "#151b26" : "#8d98a4"), overcast * 0.75);
    lerpColor(skyUniforms.uBottom.value, a.skyBottom, b.skyBottom, e).lerp(tmpA.set(light.night > 0.5 ? "#232b38" : "#b6bec7"), overcast * 0.7);
    if (light.flash) { skyUniforms.uTop.value.set("#e8eefc"); skyUniforms.uBottom.value.set("#cfd8ee"); }
    skyUniforms.uNight.value = light.night;
    skyUniforms.uRain.value = light.rain;
    skyUniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.8} />
      <hemisphereLight ref={hemi} args={["#ffffff", "#b59a78", 0.4]} />
      <primitive object={target} />
      <directionalLight
        ref={sun}
        target={target}
        position={[CENTER.x + 6, 14, CENTER.z + 6]}
        intensity={1.2}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-far={60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {LAMP_LIGHTS.map(([x, z], i) => (
        <pointLight key={i} ref={(l) => { lamps.current[i] = l; }} position={[x, ROOM.H - 0.25, z]} color="#ffd9a8" intensity={0} distance={9} decay={1.6} />
      ))}
      {POOLS.map(([x, z, r], i) => (
        <mesh key={i} position={[x, 0.013, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[r * 2, r * 2]} />
          <meshBasicMaterial
            ref={(m) => { pools.current[i] = m; }}
            map={glow} color="#ffd59a" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

