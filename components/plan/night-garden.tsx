"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type GardenDay = { day: string; done: number; total: number };

type Props = { days: GardenDay[]; today: string; streak: number; startDay: string };

/**
 * A bioluminescent garden: one plant per day of the current plan week. Completed tasks grow the
 * stem, a fully completed day blooms, and the streak summons fireflies. Missed days dim but never die.
 */

const vertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aKind;   // 0 stem/leaf, 1 bloom, 2 firefly, 3 ground
  attribute float aPhase;
  uniform float uTime;
  uniform float uGrow;
  uniform float uPixel;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    if (aKind < 1.5) {
      p.y *= uGrow;
      p.x += sin(uTime * 0.9 + aPhase) * 0.045 * max(p.y, 0.0);
    }
    if (aKind > 1.5 && aKind < 2.5) {
      p += vec3(sin(uTime * 0.5 + aPhase * 7.0) * 0.5, sin(uTime * 0.7 + aPhase * 3.0) * 0.35, cos(uTime * 0.4 + aPhase * 5.0) * 0.3);
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = aKind > 1.5 && aKind < 2.5 ? 0.4 + 0.6 * abs(sin(uTime * 1.7 + aPhase * 11.0)) : 0.85 + 0.15 * sin(uTime * 2.0 + aPhase * 9.0);
    gl_PointSize = uPixel * aSize * (6.0 / -mv.z) * tw;
    vColor = aColor;
    vAlpha = tw;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(smoothstep(0.5, 0.0, d), 1.6);
    gl_FragColor = vec4(vColor + a * 0.25, a * vAlpha);
  }
`;

const MINT = new THREE.Color("#8ef5d4");
const SKY = new THREE.Color("#6aa6ff");
const LILAC = new THREE.Color("#b79dff");
const LIME = new THREE.Color("#c8ff6e");
const DIM = new THREE.Color("#3a4a6a");
const GOLD = new THREE.Color("#ffe9a8");

function build(days: GardenDay[], today: string, streak: number, startDay: string) {
  const pos: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const kind: number[] = [];
  const phase: number[] = [];
  const add = (x: number, y: number, z: number, c: THREE.Color, s: number, k: number, ph: number) => {
    pos.push(x, y, z);
    col.push(c.r, c.g, c.b);
    size.push(s);
    kind.push(k);
    phase.push(ph);
  };

  const byDay = new Map(days.map((d) => [d.day, d]));
  for (let i = 0; i < 7; i++) {
    const date = new Date(`${startDay}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    const d = byDay.get(key);
    const ratio = d && d.total ? d.done / d.total : 0;
    const future = key > today;
    const isToday = key === today;
    const x0 = (i - 3) * 1.15;
    const ph = i * 1.7;
    const base = future ? DIM : ratio === 0 && !isToday ? DIM : MINT;

    // Seed / sprout mound
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.22;
      add(x0 + Math.cos(a) * r, -1.2 + Math.random() * 0.08, Math.sin(a) * r * 0.5, isToday ? LIME : base, 0.9, 0, ph);
    }
    if (future) continue;

    const h = 0.25 + ratio * 2.3;
    const stemN = Math.round(60 + ratio * 260);
    for (let k = 0; k < stemN; k++) {
      const t = k / stemN;
      const y = -1.2 + t * h;
      const bend = Math.sin(t * 3 + i) * 0.12 * t;
      const c = base.clone().lerp(SKY, 1 - t).lerp(LILAC, 0.15);
      add(x0 + bend + (Math.random() - 0.5) * 0.04, y, (Math.random() - 0.5) * 0.04, c, 1 + Math.random() * 0.6, 0, ph);
    }
    // Leaves: one pair per completed task
    const leaves = d?.done ?? 0;
    for (let l = 0; l < leaves; l++) {
      const t = (l + 1) / (leaves + 1);
      const y = -1.2 + t * h * 0.9;
      const side = l % 2 ? 1 : -1;
      for (let k = 0; k < 38; k++) {
        const u = k / 38;
        const w = Math.sin(u * Math.PI) * 0.09;
        add(
          x0 + Math.sin(t * 3 + i) * 0.12 * t + side * (u * 0.42),
          y + u * 0.18 + (Math.random() - 0.5) * w,
          (Math.random() - 0.5) * w,
          MINT.clone().lerp(LIME, u * 0.5),
          1.1,
          0,
          ph,
        );
      }
    }
    // Bloom on complete days, a bud otherwise
    const top = { x: x0 + Math.sin(3 + i) * 0.12, y: -1.2 + h };
    const complete = d && d.total > 0 && d.done === d.total;
    const petals = complete ? 420 : ratio > 0 ? 60 : 0;
    for (let k = 0; k < petals; k++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar((complete ? 0.34 : 0.1) * Math.cbrt(Math.random()));
      add(top.x + v.x, top.y + v.y, v.z, complete ? (k % 3 ? LIME : GOLD) : LILAC, complete ? 1.4 : 1, 1, ph);
    }
  }

  // Fireflies: more with a longer streak
  const flies = 12 + Math.min(streak, 30) * 8;
  for (let k = 0; k < flies; k++) {
    add((Math.random() - 0.5) * 8.5, -0.8 + Math.random() * 3, (Math.random() - 0.5) * 2, k % 4 ? GOLD : LIME, 1.6 + Math.random(), 2, Math.random() * 10);
  }
  // Ground mist
  for (let k = 0; k < 900; k++) {
    add((Math.random() - 0.5) * 10, -1.25 - Math.random() * 0.25, (Math.random() - 0.5) * 3, SKY.clone().lerp(LILAC, Math.random()), 0.7, 3, Math.random() * 10);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute("aKind", new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(phase, 1));
  return geo;
}

export function NightGarden({ days, today, streak, startDay }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{ points: THREE.Points; uniforms: { uGrow: { value: number } } } | null>(null);
  const key = JSON.stringify([days, today, streak, startDay]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    } catch {
      return;
    }
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 50);
    camera.position.set(0, 0.35, 6.4);
    camera.lookAt(0, 0, 0);

    const uniforms = { uTime: { value: 0 }, uGrow: { value: 0 }, uPixel: { value: dpr * 1.6 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(new THREE.BufferGeometry(), mat);
    scene.add(points);
    stateRef.current = { points, uniforms };

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.position.z = camera.aspect < 1 ? 9.5 : 6.4;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    onResize();
    window.addEventListener("resize", onResize);

    let raf = 0;
    let last = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      uniforms.uTime.value += reduced ? 0 : dt;
      uniforms.uGrow.value += (1 - uniforms.uGrow.value) * Math.min(1, dt * (reduced ? 100 : 1.6));
      points.rotation.y = Math.sin(uniforms.uTime.value * 0.08) * 0.12;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      points.geometry.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, []);

  // Rebuild the garden whenever progress changes, and replay the grow-in.
  useEffect(() => {
    const s = stateRef.current;
    if (!s) return;
    const [d, t, st, sd] = JSON.parse(key) as [GardenDay[], string, number, string];
    const old = s.points.geometry;
    s.points.geometry = build(d, t, st, sd);
    old.dispose();
    s.uniforms.uGrow.value = Math.min(s.uniforms.uGrow.value, 0.75);
  }, [key]);

  return <div ref={mountRef} className="h-[300px] w-full sm:h-[340px]" aria-label="Your night garden grows as you complete your plan" role="img" />;
}
