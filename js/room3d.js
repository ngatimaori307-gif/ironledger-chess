/* 1.16.0 — Iron Ledger's room3d.js (v8.26, by the developer of Iron Ledger), unchanged but for the three.js path and the table's
   height (this site's board is 0.35 squares thick, so the table sits at its foot). */
/* v8.26 (his word 22 Nov 20:34: "id also like for the 3d setting to have backgrounds the board and pieces sit in so it feels more alive";
   20:42: "with the room look in 3d do u get what i mean"): the 3D board stands in a room. Everything is drawn in code — no downloads —
   with unlit materials, so the room adds no lights, no shadows and no new lit shaders to the phone's work: the board and pieces are lit
   exactly as before. The window always faces the camera's far side (where the board's varnish highlight already comes from), turned
   with the camera. "Alive": dust drifting in the window's light (Study), the lamp's light breathing (Night), at ROOM.fps, only while the
   board is on screen and nothing else is moving it; off in safe graphics and with reduced motion.
   Kinds: "study" — a wooden table by a daylight window; "night" — the table under a warm lamp, the window dark with stars. */
import * as THREE from "../vendor/three/three.module.min.js";

export const ROOM = {
  kinds: ["off", "study", "night"],
  tableY: -0.36,                    // the table's top, at the foot of the board (FRAME.depth 0.35 in board3d.js)
  table: 26, tableRepeat: 7,        // the table top's size (squares) and how often the walnut photo repeats on it
  walls: { half: 9.5, floor: -7, ceiling: 11 },
  window: { w: 13, h: 6, y: 1.9 },   // low and wide, just behind the far edge: the part of the room his camera sees (first try 9 × 7.5 at 3.6 sat above the picture)
  fps: 15,                          // the life's frames a second (the board is drawn only as often as this, and only while it shows) — 15, not 24: each step redraws the whole board on his phone (heat, battery)
  motes: { count: 140, size: 0.05, speed: 0.06, box: [7, 6, 6] },
  look: {
    study: { wallTop: "#A88E74", wallBottom: "#6B5442", panel: "#3A281C", sky: ["#FFF8EA", "#CFE0EE"], table: 0xC9A688, pool: 0.30, shaft: 0.10, motes: 0.55, stars: 0, breathe: 0 },
    night: { wallTop: "#2A2330", wallBottom: "#141018", panel: "#1A120D", sky: ["#13203F", "#060A18"], table: 0x6E5646, pool: 0.78, shaft: 0, motes: 0.25, stars: 90, breathe: 0.05 },
  },
};

function canvasTexture(w, h, paint) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function wallTexture(lk) {                                    // plaster above, a dark wooden panel below, a rail between
  return canvasTexture(512, 512, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, lk.wallTop); v.addColorStop(1, lk.wallBottom); g.fillStyle = v; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }   // plaster grain
    const p = h * 0.62; g.fillStyle = lk.panel; g.fillRect(0, p, w, h - p);
    g.fillStyle = "rgba(255,230,190,0.10)"; g.fillRect(0, p, w, 6); g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(0, p + 6, w, 3);
    for (let x = 0; x < w; x += 128) { g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 3; g.strokeRect(x + 14, p + 26, 100, h - p - 46); }   // panels
  });
}
function windowTexture(lk) {                                  // panes of sky in a dark wooden frame; at night, stars
  return canvasTexture(512, 512, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, lk.sky[0]); s.addColorStop(1, lk.sky[1]); g.fillStyle = s; g.fillRect(0, 0, w, h);
    for (let i = 0; i < lk.stars; i++) { g.fillStyle = `rgba(255,255,240,${0.4 + Math.random() * 0.6})`; const r = Math.random() * 1.6 + 0.4; g.beginPath(); g.arc(Math.random() * w, Math.random() * h * 0.8, r, 0, 7); g.fill(); }
    if (lk.stars) { g.fillStyle = "#F4EEDC"; g.beginPath(); g.arc(w * 0.72, h * 0.24, 28, 0, 7); g.fill(); }
    g.strokeStyle = lk.panel; g.lineWidth = 26; g.strokeRect(13, 13, w - 26, h - 26);
    g.lineWidth = 14; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  });
}
function poolTexture() {                                      // the light's pool on the table: clear in the middle, dark at the edges
  return canvasTexture(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, w * 0.16, w / 2, h / 2, w * 0.5); r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(0,0,0,1)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
}
function shaftTexture() {                                     // a soft band of light, brightest in its middle
  return canvasTexture(64, 256, (g, w, h) => {
    const x = g.createLinearGradient(0, 0, w, 0); x.addColorStop(0, "rgba(255,240,210,0)"); x.addColorStop(0.5, "rgba(255,240,210,1)"); x.addColorStop(1, "rgba(255,240,210,0)");
    g.fillStyle = x; g.fillRect(0, 0, w, h);
    const y = g.createLinearGradient(0, 0, 0, h); y.addColorStop(0, "rgba(0,0,0,0)"); y.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = y; g.fillRect(0, 0, w, h);
  });
}
function moteTexture() {
  return canvasTexture(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, "rgba(255,245,225,1)"); r.addColorStop(1, "rgba(255,245,225,0)"); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
}

/* Builds the room. tableMap: the walnut photo (or null — then a plain colour). alive: dust and breathing light wanted.
   Returns { group, kind, alive, tick(now) → true when something moved, turn(az), dispose() }. */
export function makeRoom(kind, tableMap, alive) {
  const lk = ROOM.look[kind]; if (!lk) return null;
  const group = new THREE.Group(); group.name = "room"; const own = [];
  const basic = (o) => { const m = new THREE.MeshBasicMaterial({ toneMapped: false, ...o }); own.push(m); return m; };
  const add = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); own.push(geo); f(m); m.renderOrder = -2; m.frustumCulled = true; group.add(m); return m; };
  const W = ROOM.walls;
  // the table top
  const tmap = tableMap || null; if (tmap) { tmap.repeat.set(ROOM.tableRepeat, ROOM.tableRepeat); own.push(tmap); }   // the room owns the photo
  add(new THREE.PlaneGeometry(ROOM.table, ROOM.table), basic({ map: tmap, color: lk.table }), (m) => { m.rotation.x = -Math.PI / 2; m.position.y = ROOM.tableY; });
  const poolTex = poolTexture(); own.push(poolTex);
  const pool = add(new THREE.PlaneGeometry(ROOM.table, ROOM.table), basic({ map: poolTex, transparent: true, opacity: lk.pool, depthWrite: false }), (m) => { m.rotation.x = -Math.PI / 2; m.position.y = ROOM.tableY + 0.002; });
  // the walls (the inside of a box; the window wall is the far one, -z before the turn)
  const wallTex = wallTexture(lk); own.push(wallTex); wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(3, 1);
  const wallMat = basic({ map: wallTex, side: THREE.BackSide });
  add(new THREE.BoxGeometry(2 * W.half, W.ceiling - W.floor, 2 * W.half), wallMat, (m) => { m.position.y = (W.ceiling + W.floor) / 2; });
  const winTex = windowTexture(lk); own.push(winTex);
  add(new THREE.PlaneGeometry(ROOM.window.w, ROOM.window.h), basic({ map: winTex }), (m) => { m.position.set(0, ROOM.window.y, -W.half + 0.05); });
  // the light coming in (Study): a soft shaft from the window down to the board
  let shaft = null;
  if (lk.shaft) { const st = shaftTexture(); own.push(st);
    shaft = add(new THREE.PlaneGeometry(ROOM.window.w * 0.8, 15), basic({ map: st, transparent: true, opacity: lk.shaft, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
      (m) => { m.position.set(0, 2.2, -5.2); m.rotation.x = -0.75; }); shaft.renderOrder = 5; }
  // dust in the light
  let motes = null, seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (alive && lk.motes) {
    const n = ROOM.motes.count, [bx, by, bz] = ROOM.motes.box, p = new Float32Array(n * 3), drift = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[3 * i] = (rnd() - .5) * bx; p[3 * i + 1] = rnd() * by; p[3 * i + 2] = -rnd() * bz; drift[3 * i] = (rnd() - .5); drift[3 * i + 1] = (rnd() - .5) * .6; drift[3 * i + 2] = (rnd() - .5); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(p, 3)); own.push(geo);
    const mt = moteTexture(); own.push(mt);
    motes = new THREE.Points(geo, new THREE.PointsMaterial({ size: ROOM.motes.size, map: mt, transparent: true, opacity: lk.motes, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    own.push(motes.material); motes.renderOrder = 6; motes.userData.drift = drift; group.add(motes);
  }
  let last = 0;
  return {
    group, kind, alive: !!(alive && (motes || lk.breathe)),
    turn(az) { group.rotation.y = az; },                     // the window kept on the camera's far side
    tick(now) {                                              // one step of the room's life; true when something moved
      const dt = last ? Math.min(0.2, (now - last) / 1000) : 0; last = now; let moved = false;
      if (motes) {
        const a = motes.geometry.attributes.position, p = a.array, d = motes.userData.drift, [bx, by, bz] = ROOM.motes.box, v = ROOM.motes.speed * dt;
        for (let i = 0; i < p.length; i += 3) {
          p[i] += d[i] * v + Math.sin(now / 2300 + i) * v * 0.4; p[i + 1] += d[i + 1] * v - v * 0.15; p[i + 2] += d[i + 2] * v;
          if (p[i + 1] < 0) p[i + 1] += by; if (p[i] > bx / 2) p[i] -= bx; if (p[i] < -bx / 2) p[i] += bx; if (p[i + 2] > 0) p[i + 2] -= bz; if (p[i + 2] < -bz) p[i + 2] += bz;
        }
        a.needsUpdate = true; moved = true;
      }
      if (lk.breathe) { pool.material.opacity = lk.pool * (1 - lk.breathe * (0.5 + 0.5 * Math.sin(now / 900) * Math.sin(now / 370))); moved = true; }
      return moved;
    },
    dispose() { for (const o of own) if (o && o.dispose) o.dispose(); },
  };
}
