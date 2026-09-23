"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Full-screen WebGL point cloud that morphs between shapes as the page scrolls.
 * Sections mark themselves with `data-shape="<index>"`; the field blends toward
 * whichever section sits at the viewport centre.
 */

const SHAPES = 6; // galaxy, breathing sphere, ocean, helix, moon, wordmark

function galaxy(n: number, out: Float32Array) {
  for (let i = 0; i < n; i++) {
    const arm = i % 3;
    const r = Math.pow(Math.random(), 0.6) * 3.4;
    const a = r * 1.35 + (arm * Math.PI * 2) / 3 + (Math.random() - 0.5) * 0.55;
    const spread = (Math.random() - 0.5) * 0.35 * (1 + r * 0.3);
    out[i * 3] = Math.cos(a) * r + spread;
    out[i * 3 + 1] = (Math.random() - 0.5) * 0.22 * (3.6 - r) * 0.5;
    out[i * 3 + 2] = Math.sin(a) * r + spread;
  }
}

function sphere(n: number, out: Float32Array) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const t = golden * i;
    const r = 1.75 * (0.96 + Math.random() * 0.08);
    out[i * 3] = Math.cos(t) * rad * r;
    out[i * 3 + 1] = y * r;
    out[i * 3 + 2] = Math.sin(t) * rad * r;
  }
}

function ocean(n: number, out: Float32Array) {
  const side = Math.ceil(Math.sqrt(n));
  for (let i = 0; i < n; i++) {
    const gx = (i % side) / side - 0.5;
    const gz = Math.floor(i / side) / side - 0.5;
    out[i * 3] = gx * 9 + (Math.random() - 0.5) * 0.04;
    out[i * 3 + 1] = -0.6;
    out[i * 3 + 2] = gz * 6;
  }
}

function helix(n: number, out: Float32Array) {
  for (let i = 0; i < n; i++) {
    const strand = i % 2;
    const t = (i / n) * Math.PI * 7;
    const y = (i / n) * 6.4 - 3.2;
    const jitter = () => (Math.random() - 0.5) * 0.16;
    if (i % 9 === 0) {
      // rungs between the strands
      const k = Math.random() * 2 - 1;
      out[i * 3] = Math.cos(t) * 1.1 * k;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = Math.sin(t) * 1.1 * k;
    } else {
      const a = t + strand * Math.PI;
      out[i * 3] = Math.cos(a) * 1.1 + jitter();
      out[i * 3 + 1] = y + jitter();
      out[i * 3 + 2] = Math.sin(a) * 1.1 + jitter();
    }
  }
}

function moon(n: number, out: Float32Array) {
  let i = 0;
  while (i < n) {
    const x = (Math.random() * 2 - 1) * 1.9;
    const y = (Math.random() * 2 - 1) * 1.9;
    const inMoon = x * x + y * y < 1.9 * 1.9;
    const inShadow = (x - 0.85) * (x - 0.85) + (y - 0.35) * (y - 0.35) < 1.55 * 1.55;
    if (i > n * 0.9) {
      // scattered stars
      out[i * 3] = (Math.random() - 0.5) * 11;
      out[i * 3 + 1] = (Math.random() - 0.5) * 6;
      out[i * 3 + 2] = -1 - Math.random() * 2;
      i++;
      continue;
    }
    if (inMoon && !inShadow) {
      out[i * 3] = x - 0.4;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
      i++;
    }
  }
}

function wordmark(n: number, out: Float32Array, fontFamily: string) {
  const c = document.createElement("canvas");
  const W = 1200;
  const H = 360;
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `italic 900 300px ${fontFamily}, sans-serif`;
  ctx.fillText("lull", W / 2, H / 2 + 10);
  const data = ctx.getImageData(0, 0, W, H).data;
  const pts: number[] = [];
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      if (data[(y * W + x) * 4 + 3] > 128) pts.push(x, y);
    }
  }
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * (pts.length / 2)) * 2;
    const x = pts[k] ?? W / 2;
    const y = pts[k + 1] ?? H / 2;
    out[i * 3] = ((x - W / 2) / W) * 7.6 + (Math.random() - 0.5) * 0.02;
    out[i * 3 + 1] = (-(y - H / 2) / H) * 2.3 + 1.05 + (Math.random() - 0.5) * 0.02;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
  }
}

const vertex = /* glsl */ `
  attribute vec3 s0; attribute vec3 s1; attribute vec3 s2; attribute vec3 s3; attribute vec3 s4; attribute vec3 s5;
  attribute float aRand;
  attribute vec3 aDir;
  uniform float uP;
  uniform float uTime;
  uniform float uPixel;
  varying float vRand;
  varying float vDepth;
  varying float vGlow;

  float w(float i) { return max(0.0, 1.0 - abs(uP - i)); }

  void main() {
    float w0 = w(0.0), w1 = w(1.0), w2 = w(2.0), w3 = w(3.0), w4 = w(4.0), w5 = w(5.0);
    vec3 pos = s0 * w0 + s1 * w1 + s2 * w2 + s3 * w3 + s4 * w4 + s5 * w5;

    // Breathing: the whole field swells on a 11s cycle (5.5 breaths per minute).
    float breath = sin(uTime * 6.2831 / 11.0);
    pos *= 1.0 + 0.035 * breath + 0.09 * breath * w1;

    // Ocean swell.
    pos.y += (sin(pos.x * 1.3 + uTime * 0.9) * 0.28 + cos(pos.z * 1.7 + uTime * 0.6) * 0.18 + sin((pos.x + pos.z) * 2.3 + uTime * 1.3) * 0.06) * w2;

    // Galaxy slow spin.
    float a = uTime * 0.05 * w0;
    pos.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * pos.xz;

    // Helix twist.
    float h = uTime * 0.25 * w3;
    pos.xz = mat2(cos(h), -sin(h), sin(h), cos(h)) * pos.xz;

    // Scatter outwards while morphing between shapes.
    float tr = 1.0 - abs(fract(uP) - 0.5) * 2.0;
    tr = (uP - floor(uP) < 0.001) ? 0.0 : tr;
    pos += aDir * tr * tr * 1.4;

    // Ambient drift.
    pos += vec3(sin(uTime * 0.37 + aRand * 40.0), cos(uTime * 0.29 + aRand * 23.0), sin(uTime * 0.23 + aRand * 11.0)) * 0.025;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + aRand * 3.0) + aRand * 50.0);
    gl_PointSize = uPixel * (0.9 + aRand * 1.9) * twinkle * (5.2 / -mv.z);
    vRand = aRand;
    vDepth = clamp((-mv.z - 3.0) / 6.0, 0.0, 1.0);
    vGlow = twinkle;
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uP;
  varying float vRand;
  varying float vDepth;
  varying float vGlow;
  uniform vec3 cA; uniform vec3 cB; uniform vec3 cC; uniform vec3 cD;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    float alpha = pow(core, 1.8);
    vec3 col = mix(cA, cB, smoothstep(0.0, 0.55, vRand));
    col = mix(col, cC, smoothstep(0.55, 1.0, vRand));
    // Warmer palette for sleep, lime tint for the wordmark.
    float moonW = max(0.0, 1.0 - abs(uP - 4.0));
    float wordW = max(0.0, 1.0 - abs(uP - 5.0));
    col = mix(col, vec3(1.0, 0.93, 0.8), moonW * 0.6);
    col = mix(col, cD, wordW * 0.55);
    col += core * core * 0.35;
    gl_FragColor = vec4(col, alpha * (0.9 - vDepth * 0.55) * vGlow);
  }
`;

export function ParticleField() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.innerWidth < 768;
    const N = mobile ? 7000 : 15000;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the CSS gradients behind still look fine
    }
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 0.2, 7);

    const geo = new THREE.BufferGeometry();
    const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
    const builders = [galaxy, sphere, ocean, helix, moon];
    for (let s = 0; s < SHAPES; s++) {
      const arr = new Float32Array(N * 3);
      if (s < 5) builders[s](N, arr);
      else wordmark(N, arr, fontFamily);
      geo.setAttribute(`s${s}`, new THREE.BufferAttribute(arr, 3));
    }
    geo.setAttribute("position", geo.getAttribute("s0"));
    const rand = new Float32Array(N);
    const dir = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      rand[i] = Math.random();
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.4 + Math.random());
      dir.set([v.x, v.y, v.z], i * 3);
    }
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    geo.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

    // Rebuild the wordmark once the display font has loaded.
    document.fonts?.ready.then(() => {
      const attr = geo.getAttribute("s5") as THREE.BufferAttribute;
      wordmark(N, attr.array as Float32Array, fontFamily);
      attr.needsUpdate = true;
    });

    const uniforms = {
      uP: { value: 0 },
      uTime: { value: 0 },
      uPixel: { value: dpr * (mobile ? 2.0 : 2.5) },
      cA: { value: new THREE.Color("#8ef5d4") },
      cB: { value: new THREE.Color("#6aa6ff") },
      cC: { value: new THREE.Color("#b79dff") },
      cD: { value: new THREE.Color("#c8ff6e") },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.rotation.x = 0.35;
    scene.add(points);

    let target = 0;
    const measure = () => {
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-shape]"));
      const mid = window.innerHeight / 2;
      const anchors = els
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { i: Number(el.dataset.shape), c: r.top + r.height / 2 };
        })
        .sort((a, b) => a.c - b.c);
      if (!anchors.length) return;
      if (mid <= anchors[0].c) target = anchors[0].i;
      else if (mid >= anchors[anchors.length - 1].c) target = anchors[anchors.length - 1].i;
      else {
        for (let k = 0; k < anchors.length - 1; k++) {
          const a = anchors[k];
          const b = anchors[k + 1];
          if (mid >= a.c && mid <= b.c) {
            const t = (mid - a.c) / (b.c - a.c);
            // Ease so shapes hold while their section is centred and morph in between.
            const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            target = a.i + (b.i - a.i) * e;
          }
        }
      }
    };

    const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", measure, { passive: true });
    measure();
    uniforms.uP.value = target;

    let last = performance.now();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      uniforms.uTime.value += reduced ? 0 : dt;
      uniforms.uP.value += (target - uniforms.uP.value) * Math.min(1, dt * 3.2);
      mouse.sx += (mouse.x - mouse.sx) * dt * 2;
      mouse.sy += (mouse.y - mouse.sy) * dt * 2;
      const oceanW = Math.max(0, 1 - Math.abs(uniforms.uP.value - 2));
      points.rotation.y = mouse.sx * 0.25;
      points.rotation.x = 0.35 * (1 - oceanW) + 0.12 * oceanW - Math.max(0, 1 - Math.abs(uniforms.uP.value - 5)) * 0.35 + mouse.sy * 0.12;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", measure);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(60,90,200,0.22),transparent_60%),radial-gradient(ellipse_60%_50%_at_80%_100%,rgba(120,80,220,0.14),transparent_60%)]" />
      <div ref={mountRef} className="absolute inset-0" />
    </div>
  );
}
