// CompBrain swarm engine — Canvas 2D, artifact sprites, scroll-driven scenes.
const COL = {
  paper: '#F3EEE3', raised: '#FBF8F1', sunk: '#E8E1D2', ink: '#1C1B18',
  soft: '#6B665C', line: '#D8D0BE', brain: '#0F8A7E', query: '#E07B39', sov: '#D8315B'
};
const TYPES = ['chat', 'doc', 'image', 'audio', 'pdf', 'email', 'sheet', 'slack'];
const LABELS = {
  chat: ['ops-chat: "can you resend that?"', 'tg: "final numbers attached" ✓✓'],
  doc: ['Q3_board_notes_FINAL_v4.docx', 'onboarding_playbook (copy).docx'],
  image: ['whiteboard_2026-03-11.jpg', 'IMG_4471_scan.png'],
  audio: ['voice_memo_0912.m4a', 'standup_recording_44min.mp3'],
  pdf: ['Meridian_MSA_signed.pdf', 'SOC2_report_2025.pdf'],
  email: ['re: contract renewal — 217 replies', 'fwd: fwd: pricing approval??'],
  sheet: ['pipeline_forecast_v12.xlsx', 'headcount_plan_REAL_final.xlsx'],
  slack: ['#eng: "where does this config live?"', '#legal: "who owns this doc?"']
};
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---- sprite prerender (each artifact drawn once, blitted every frame) ----
const SIZES = { chat: [46, 28], doc: [34, 42], image: [44, 32], audio: [48, 18], pdf: [34, 42], email: [48, 26], sheet: [40, 32], slack: [46, 26] };
function makeSprite(type, S) {
  const [w, h] = SIZES[type], pad = 10;
  const c = document.createElement('canvas');
  c.width = (w + pad * 2) * S; c.height = (h + pad * 2) * S;
  const x = c.getContext('2d'); x.scale(S, S); x.translate(pad, pad);
  x.shadowColor = 'rgba(96,78,48,0.32)'; x.shadowBlur = 5; x.shadowOffsetY = 2.5;
  x.fillStyle = '#FFFFFF'; rr(x, 0, 0, w, h, type === 'audio' ? h / 2 : 4); x.fill();
  x.shadowColor = 'transparent';
  x.strokeStyle = 'rgba(28,27,24,0.10)'; x.lineWidth = .75; rr(x, 0, 0, w, h, type === 'audio' ? h / 2 : 4); x.stroke();
  const line = (x1, y1, x2, col, lw) => { x.strokeStyle = col; x.lineWidth = lw || 2; x.lineCap = 'round'; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y1); x.stroke(); };
  if (type === 'chat') {
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(4, h - 1); x.lineTo(-3, h + 4); x.lineTo(11, h - 1); x.closePath(); x.fill();
    x.fillStyle = '#3B9BE0'; x.beginPath(); x.moveTo(4, h - 2); x.lineTo(-2, h + 3); x.lineTo(9, h - 2); x.closePath(); x.fill();
    line(6, 9, 32, '#C9C4B8'); line(6, 15, 24, '#C9C4B8');
    x.strokeStyle = '#3B9BE0'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(33, 21); x.lineTo(35, 23); x.lineTo(39, 19); x.moveTo(37, 23); x.lineTo(41, 19); x.stroke();
  } else if (type === 'doc') {
    x.fillStyle = '#4A7FE0'; x.fillRect(0, 0, w, 7); x.fillStyle = '#fff'; x.fillRect(0, 5, w, 2);
    for (let i = 0; i < 4; i++) line(5, 14 + i * 6.5, 5 + (i === 3 ? 14 : 24), '#C9C4B8', 1.8);
  } else if (type === 'image') {
    x.fillStyle = '#DCE9E1'; rr(x, 4, 4, w - 8, h - 8, 3); x.fill();
    x.fillStyle = '#9DBFAE'; x.beginPath(); x.moveTo(8, h - 7); x.lineTo(18, 12); x.lineTo(26, h - 7); x.closePath(); x.fill();
    x.fillStyle = '#7FAF9A'; x.beginPath(); x.moveTo(20, h - 7); x.lineTo(30, 15); x.lineTo(38, h - 7); x.closePath(); x.fill();
    x.fillStyle = '#E5B95C'; x.beginPath(); x.arc(33, 11, 3, 0, 7); x.fill();
  } else if (type === 'audio') {
    x.fillStyle = COL.ink; x.beginPath(); x.moveTo(8, 5.5); x.lineTo(8, 12.5); x.lineTo(14.5, 9); x.closePath(); x.fill();
    x.strokeStyle = COL.brain; x.lineWidth = 1.8; x.lineCap = 'round';
    [5, 9, 6, 11, 4, 8, 5].forEach((bh, i) => { const bx = 20 + i * 3.6; x.beginPath(); x.moveTo(bx, 9 - bh / 2); x.lineTo(bx, 9 + bh / 2); x.stroke(); });
  } else if (type === 'pdf') {
    for (let i = 0; i < 4; i++) line(5, 17 + i * 6, 5 + (i === 3 ? 12 : 24), '#C9C4B8', 1.8);
    x.fillStyle = '#D93B3B'; rr(x, 4, 3, 20, 9, 2); x.fill();
    x.fillStyle = '#fff'; x.font = 'bold 6px monospace'; x.fillText('PDF', 7, 9.8);
  } else if (type === 'email') {
    x.fillStyle = '#E8D8BE'; x.beginPath(); x.arc(10, h / 2, 6, 0, 7); x.fill();
    x.fillStyle = '#B08D4A'; x.font = 'bold 7px sans-serif'; x.fillText('A', 7.6, h / 2 + 2.5);
    line(20, 9, 40, '#8A857A', 2); line(20, 16, 44, '#C9C4B8', 1.8);
  } else if (type === 'sheet') {
    x.fillStyle = '#2E9E63'; x.fillRect(0, 0, w, 7);
    x.strokeStyle = '#CFE5D6'; x.lineWidth = 1;
    for (let i = 1; i < 3; i++) { x.beginPath(); x.moveTo(0, 7 + i * 8.3); x.lineTo(w, 7 + i * 8.3); x.stroke(); }
    for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(i * 10, 7); x.lineTo(i * 10, h); x.stroke(); }
  } else if (type === 'slack') {
    x.fillStyle = '#E0A23B'; rr(x, 5, 6, 13, 13, 3.5); x.fill();
    line(23, 9, 37, '#8A857A', 2); line(23, 16, 41, '#C9C4B8', 1.8);
  }
  return { c, w: w + pad * 2, h: h + pad * 2, iw: w, ih: h };
}

export function createEngine(cfg) {
  const canvas = cfg.canvas, ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let vw = 0, vh = 0, dpr = 1, raf = 0, dead = false, t0 = performance.now();
  let edgeOpacity = cfg.edgeOpacity ?? 0.7;
  const M = () => (vw < 760 ? 14 : 26); // perimeter margin
  const el = id => document.getElementById(id);
  const scenes = {}; ['hero', 'problem', 'turn', 'ask', 'sovereign', 'features', 'proof', 'cta'].forEach(n => scenes[n] = document.querySelector('[data-scene="' + n + '"]'));
  const tlIdx = el('tl-idx'), tlQ = el('tl-q'), tlSec = el('tl-sec'), tip = el('swarm-tip');
  const cites = [1, 2, 3].map(i => el('cite-' + i));
  const cards = [1, 2, 3, 4].map(i => el('feat-' + i));
  const counters = Array.from(document.querySelectorAll('[data-count]'));

  // ---- artifacts ----
  const rnd = mulberry(1234);
  let arts = [], edges = [], N = 0;
  function build(count) {
    N = count;
    arts = []; const S = Math.min(2.5, (window.devicePixelRatio || 1) * 1.6);
    for (let i = 0; i < N; i++) {
      const type = TYPES[i % TYPES.length];
      arts.push({
        type, sprite: makeSprite(type, S), seed: rnd() * 1000,
        x: 0, y: 0, vx: 0, vy: 0, rot: (rnd() - .5) * .7, homeRot: (rnd() - .5) * .55,
        hx: 0, hy: 0, nx: 0, ny: 0, alpha: 1, scale: .85 + rnd() * .3,
        lost: rnd() < .12, buried: rnd() < .14, dupOf: -1, flyer: -1,
        label: LABELS[type][i % 2]
      });
    }
    // duplicate pairs: last ~12% mirror an earlier artifact
    for (let i = N - Math.floor(N * .13); i < N; i++) { arts[i].dupOf = Math.floor(rnd() * (N / 2)); arts[i].type = arts[arts[i].dupOf].type; arts[i].sprite = arts[arts[i].dupOf].sprite; arts[i].lost = false; arts[i].buried = false; }
    // feature flyers: 12 artifacts (3 per card)
    let f = 0; for (let i = 3; i < N && f < 12; i += 4) { if (arts[i].dupOf < 0) { arts[i].flyer = Math.floor(f / 3); f++; } }
    layout();
  }
  function layout() {
    const m = M(), r0 = mulberry(77);
    // chaos homes
    for (const a of arts) {
      a.hx = m + 30 + r0() * (vw - m * 2 - 60);
      a.hy = m + 60 + r0() * (vh - m * 2 - 100);
      if (a.dupOf >= 0) { a.hx = arts[a.dupOf].hx + (r0() - .5) * 120; a.hy = arts[a.dupOf].hy + (r0() - .5) * 120; }
      if (a.x === 0 && a.y === 0) { a.x = a.hx; a.y = a.hy; }
    }
    // brain nodes: phyllotaxis, unit coords
    const real = arts.filter(a => a.dupOf < 0), K = real.length;
    real.forEach((a, i) => {
      const rr2 = Math.sqrt((i + .6) / K), an = i * 2.39996;
      a.nx = rr2 * Math.cos(an); a.ny = rr2 * Math.sin(an) * .82;
    });
    arts.forEach(a => { if (a.dupOf >= 0) { a.nx = arts[a.dupOf].nx; a.ny = arts[a.dupOf].ny; } });
    // edges: k-nearest (2) among real
    edges = [];
    for (let i = 0; i < K; i++) {
      const ds = [];
      for (let j = 0; j < K; j++) if (j !== i) { const dx = real[i].nx - real[j].nx, dy = real[i].ny - real[j].ny; ds.push([dx * dx + dy * dy, j]); }
      ds.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < 2; k++) { const j = ds[k][1]; if (i < j) edges.push([arts.indexOf(real[i]), arts.indexOf(real[j])]); }
    }
    // citation source nodes: one pdf, one email, one chat — nearest to right side
    citeNodes = ['pdf', 'email', 'chat'].map(tp => {
      let best = null, bd = -1e9;
      for (const a of arts) if (a.type === tp && a.dupOf < 0 && a.flyer < 0) { if (a.nx > bd) { bd = a.nx; best = a; } }
      return best || arts[0];
    });
  }
  let citeNodes = [];

  function resize() {
    vw = innerWidth; vh = innerHeight; dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = vw * dpr; canvas.height = vh * dpr;
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    if (arts.length) layout();
  }
  resize();
  build(cfg.count || (vw < 760 ? 26 : 64));

  // ---- scroll progress ----
  function prog(name) {
    const s = scenes[name]; if (!s) return 0;
    const r = s.getBoundingClientRect(), span = r.height - vh;
    if (span > 40) return clamp(-r.top / span, 0, 1);
    return clamp((vh * .85 - r.top) / (vh * .7), 0, 1);
  }
  function activeScene() {
    let act = 'hero';
    for (const n in scenes) { const r = scenes[n].getBoundingClientRect(); if (r.top <= vh * .5 && r.bottom >= vh * .5) act = n; }
    return act;
  }

  // ---- cursor ----
  let mx = -1e4, my = -1e4;
  const onMove = e => { mx = e.clientX; my = e.clientY; };
  addEventListener('mousemove', onMove, { passive: true });

  // ---- state flags ----
  let sovPulse = 0, turnPulsed = false, counted = false, queried = false;
  let idxShown = -1, lastSec = '';

  function brainCfg(sec, P) {
    const base = { cx: vw * .5, cy: vh * .46, r: Math.min(vw, vh) * .30 };
    if (sec === 'ask') return { cx: vw < 900 ? vw * .5 : vw * .30, cy: vh * .5, r: Math.min(vw, vh) * .26 };
    if (sec === 'sovereign') return { cx: vw * .5, cy: vh * .52, r: Math.min(vw, vh) * .17 };
    if (sec === 'features') return { cx: vw * .5, cy: vh * .2, r: Math.min(vw, vh) * .10 };
    if (sec === 'proof') return { cx: vw * .5, cy: vh * .5, r: Math.min(vw, vh) * .13 };
    if (sec === 'cta') return { cx: vw * .5, cy: vh * .66, r: Math.min(vw, vh) * .15 };
    return base;
  }

  function drawPerimeter(pulse, emph) {
    const m = M();
    const base = 'rgba(107,102,92,' + (0.5 + emph * 0.3) + ')';
    ctx.lineWidth = 1.2 + emph * 0.8 + pulse * 0.8;
    ctx.strokeStyle = base; ctx.strokeRect(m, m, vw - m * 2, vh - m * 2);
    if (pulse > 0.01) { ctx.strokeStyle = 'rgba(216,49,91,' + (pulse * .9) + ')'; ctx.strokeRect(m, m, vw - m * 2, vh - m * 2); }
    // corner ticks
    ctx.strokeStyle = 'rgba(28,27,24,' + (0.55 + pulse * .4) + ')'; ctx.lineWidth = 1.6;
    const T = 11;
    [[m, m, 1, 1], [vw - m, m, -1, 1], [m, vh - m, 1, -1], [vw - m, vh - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(x + sx * T, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * T); ctx.stroke();
    });
    ctx.font = '500 9px "IBM Plex Mono", monospace'; ctx.fillStyle = pulse > .2 ? COL.sov : COL.soft;
    ctx.fillText('SECURE PERIMETER — ON-PREM', m + 16, m - 4 + 0);
    ctx.textAlign = 'right'; ctx.fillText('EGRESS: 0 B', vw - m - 4, vh - m + 12); ctx.textAlign = 'left';
  }

  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000;
    const P = { hero: prog('hero'), problem: prog('problem'), turn: prog('turn'), ask: prog('ask'), sovereign: prog('sovereign'), features: prog('features'), proof: prog('proof'), cta: prog('cta') };
    const sec = activeScene();
    const morph = reduced ? 1 : (sec === 'hero' || sec === 'problem') ? 0 : sec === 'turn' ? ease(P.turn) : 1;
    const bc = brainCfg(sec, P);
    if (sec === 'cta' && mx > 0) { bc.cx += (mx - vw / 2) * .05; bc.cy += (my - vh / 2) * .05; }
    const m = M();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    // ---- targets + physics ----
    const chaos = sec === 'problem' ? P.problem : 0;
    let hoverA = null, hoverD = 1e9;
    for (let i = 0; i < arts.length; i++) {
      const a = arts[i];
      let tx, ty, ta = 1, tr = 0;
      if (a.flyer >= 0 && (sec === 'features' || (sec === 'proof' && P.features > .9))) {
        const cr = cards[a.flyer] && cards[a.flyer].getBoundingClientRect();
        if (cr) { const cp = clamp((vh * .88 - cr.top) / (vh * .35), 0, 1); tx = cr.left + 20 + (i % 3) * 30; ty = cr.top + 8; ta = 1 - cp; }
        else { tx = a.hx; ty = a.hy; }
        tr = 0;
      } else if (morph < 1 || sec === 'hero' || sec === 'problem') {
        // chaos home, drifting; buried sink, lost fade with problem progress
        const j = reduced ? 0 : 14 + chaos * 26;
        tx = a.hx + Math.sin(t * .5 + a.seed) * j;
        ty = a.hy + Math.cos(t * .43 + a.seed * 1.7) * j;
        if (a.buried) ty = lerp(ty, vh - m - 20, chaos);
        ta = a.lost ? lerp(.4, .12, chaos) : a.buried ? lerp(1, .18, chaos) : 1;
        tr = a.homeRot * (1 + chaos * .6);
        if (a.dupOf >= 0) { tx += Math.sin(a.seed) * chaos * 90; ta = lerp(.85, 1, chaos); }
        if (morph > 0) { // blend into node during turn scrub, staggered
          const d = (a.seed % 1) * .45, lp = ease(clamp((morph - d) / .55, 0, 1));
          tx = lerp(tx, bc.cx + a.nx * bc.r, lp); ty = lerp(ty, bc.cy + a.ny * bc.r, lp);
          ta = lerp(ta, a.dupOf >= 0 ? clamp(1 - lp * 1.6, 0, 1) : 1, lp); tr = lerp(tr, 0, lp);
        }
      } else {
        tx = bc.cx + a.nx * bc.r + (reduced ? 0 : Math.sin(t * .6 + a.seed) * 3);
        ty = bc.cy + a.ny * bc.r + (reduced ? 0 : Math.cos(t * .5 + a.seed) * 3);
        ta = a.dupOf >= 0 ? 0 : (sec === 'features' ? .45 : 1);
        tr = 0;
      }
      // cursor repulsion
      const dxm = a.x - mx, dym = a.y - my, dm2 = dxm * dxm + dym * dym;
      if (dm2 < 8100 && !reduced) { const f = (1 - Math.sqrt(dm2) / 90) * 1.1; a.vx += dxm / 90 * f; a.vy += dym / 90 * f; }
      a.vx += (tx - a.x) * .028; a.vy += (ty - a.y) * .028;
      a.vx *= .86; a.vy *= .86;
      a.x += a.vx; a.y += a.vy;
      // walls
      if (a.x < m + 14) { a.x = m + 14; a.vx = Math.abs(a.vx) * .6; }
      if (a.x > vw - m - 14) { a.x = vw - m - 14; a.vx = -Math.abs(a.vx) * .6; }
      if (a.y < m + 12) { a.y = m + 12; a.vy = Math.abs(a.vy) * .6; }
      if (a.y > vh - m - 12) { a.y = vh - m - 12; a.vy = -Math.abs(a.vy) * .6; }
      a.rot += (tr - a.rot) * .08;
      a.alpha += (ta - a.alpha) * .08;
      if (a.alpha > .3) { const dd = dm2; if (dd < 900 && dd < hoverD) { hoverD = dd; hoverA = a; } }
    }

    // ---- edges ----
    const edgeBase = sec === 'turn' ? clamp((morph - .55) / .35, 0, 1) : (morph >= 1 ? 1 : 0);
    const citeHold = sec === 'ask' ? clamp((P.ask - .3) / .15, 0, 1) : 0;
    if (edgeBase > 0) {
      ctx.strokeStyle = COL.brain; ctx.lineWidth = .8;
      ctx.globalAlpha = edgeBase * edgeOpacity * (sec === 'features' ? .35 : 1) * (1 - citeHold * .65) * .55;
      ctx.beginPath();
      for (const [i, j] of edges) { ctx.moveTo(arts[i].x, arts[i].y); ctx.lineTo(arts[j].x, arts[j].y); }
      ctx.stroke(); ctx.globalAlpha = 1;
      // ambient query packets on edges
      if (!reduced && morph >= 1 && sec !== 'features') {
        ctx.fillStyle = COL.query;
        for (let k = 0; k < 3; k++) {
          const e = edges[(k * 7 + Math.floor(t / 2.2)) % edges.length], u = (t / 2.2 + k * .33) % 1;
          const A = arts[e[0]], B = arts[e[1]];
          ctx.globalAlpha = .8 * edgeBase * (1 - citeHold * .7);
          ctx.beginPath(); ctx.arc(lerp(A.x, B.x, u), lerp(A.y, B.y, u), 2.4, 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    // ---- artifacts ----
    for (const a of arts) {
      if (a.alpha < .02) continue;
      ctx.globalAlpha = a.alpha;
      ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot);
      const sc = a.scale * (morph >= 1 ? .8 : 1) * (bc.r < Math.min(vw, vh) * .2 && morph >= 1 ? .62 : 1);
      ctx.drawImage(a.sprite.c, -a.sprite.w / 2 * sc, -a.sprite.h / 2 * sc, a.sprite.w * sc, a.sprite.h * sc);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // ---- ask scene: query packet + citation lines ----
    if (sec === 'ask' && !reduced) {
      const pin = clamp(P.ask / .28, 0, 1);
      if (pin < 1) { // amber packet travels from bottom into the core
        const px = lerp(vw * .5, bc.cx, ease(pin)), py = lerp(vh + 20, bc.cy, ease(pin));
        ctx.fillStyle = COL.query; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(224,123,57,.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(vw * .5, vh + 20); ctx.lineTo(px, py); ctx.stroke();
      }
      cites.forEach((ce, k) => {
        if (!ce) return;
        const lp = ease(clamp((P.ask - .34 - k * .09) / .14, 0, 1));
        ce.style.background = lp > .9 ? COL.brain : 'transparent';
        ce.style.color = lp > .9 ? COL.paper : COL.brain;
        if (lp <= 0) return;
        const r = ce.getBoundingClientRect(), n = citeNodes[k];
        const x1 = r.left + r.width / 2, y1 = r.bottom + 2;
        const xe = lerp(x1, n.x, lp), ye = lerp(y1, n.y, lp);
        ctx.strokeStyle = COL.brain; ctx.lineWidth = 1.6; ctx.globalAlpha = .95;
        ctx.beginPath(); ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(lerp(x1, n.x, .5), Math.max(y1, n.y) + 60, xe, ye); ctx.stroke();
        if (lp > .95) { ctx.beginPath(); ctx.arc(n.x, n.y, 16 + Math.sin(t * 3) * 2, 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 1;
      });
      if (P.ask > .3 && !queried) { queried = true; if (tlQ) tlQ.textContent = '1'; }
    }

    // ---- sovereign scene: hostile packet repelled ----
    let sovEmph = 0;
    if (sec === 'sovereign') {
      sovEmph = Math.sin(clamp(P.sovereign, 0, 1) * Math.PI);
      if (!reduced) {
        const y = vh * .45;
        const f = clamp(P.sovereign * 2.4, 0, 1), g = clamp(P.sovereign * 2.4 - 1, 0, 1.2);
        const px = g > 0 ? lerp(m, -80, ease(clamp(g, 0, 1))) : lerp(-60, m, ease(f));
        if (px > -70) {
          ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(px - 8, y, 5, 0, 7); ctx.fill();
          ctx.strokeStyle = COL.paper; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(px - 10.5, y - 2.5); ctx.lineTo(px - 5.5, y + 2.5); ctx.moveTo(px - 5.5, y - 2.5); ctx.lineTo(px - 10.5, y + 2.5); ctx.stroke();
        }
        if (f >= 1 && g < .5) { // impact ripple
          const rp = 1 - clamp(g * 2, 0, 1);
          ctx.strokeStyle = 'rgba(216,49,91,' + rp + ')'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(m, y, 8 + (1 - rp) * 46, -1.2, 1.2); ctx.stroke();
          sovPulse = Math.max(sovPulse, rp);
        }
      }
    }

    // ---- turn pulse + cta heartbeat ----
    if (sec === 'turn' && P.turn > .96 && !turnPulsed) { turnPulsed = true; sovPulse = 1; }
    if (sec === 'turn' && P.turn < .5) turnPulsed = false;
    if (sec === 'cta' && !reduced) {
      const hb = (t % 1.9) / 1.9;
      ctx.strokeStyle = 'rgba(216,49,91,' + ((1 - hb) * .45) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(bc.cx, bc.cy, bc.r * .9 + hb * 55, 0, 7); ctx.stroke();
      if (hb < .1) sovPulse = Math.max(sovPulse, .35);
    }
    sovPulse *= .94;
    drawPerimeter(sovPulse, sovEmph);

    // ---- feature card reveals ----
    if (P.features > 0) cards.forEach((c, i) => {
      if (!c) return; const r = c.getBoundingClientRect();
      const cp = ease(clamp((vh * .92 - r.top) / (vh * .3) - i * .12, 0, 1));
      c.style.opacity = cp; c.style.transform = 'translateY(' + (1 - cp) * 26 + 'px)';
    });

    // ---- proof counters ----
    if (P.proof > .15 && !counted) {
      counted = true;
      counters.forEach(cEl => {
        const target = parseFloat(cEl.dataset.count), dec = (cEl.dataset.dec || 0) * 1, start = performance.now();
        const step = nw => {
          const u = ease(clamp((nw - start) / 1400, 0, 1));
          cEl.textContent = (target * u).toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: dec });
          if (u < 1 && !dead) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }

    // ---- telemetry + tooltip ----
    const realN = arts.filter(a => a.dupOf < 0).length;
    const idx = morph >= 1 ? realN : Math.floor(morph * realN);
    if (idx !== idxShown && tlIdx) { idxShown = idx; tlIdx.textContent = idx + ' / ' + realN; }
    if (sec !== lastSec && tlSec) { lastSec = sec; tlSec.textContent = sec.toUpperCase(); if (cfg.onSection) cfg.onSection(sec); }
    if (tip) {
      if (hoverA && !reduced) {
        tip.textContent = hoverA.label;
        tip.style.opacity = '1';
        tip.style.transform = 'translate(' + Math.min(mx + 14, vw - 240) + 'px,' + (my - 30) + 'px)';
      } else tip.style.opacity = '0';
    }
  }

  const onResize = () => resize();
  addEventListener('resize', onResize);
  raf = requestAnimationFrame(frame);

  return {
    setConfig(o) {
      if (o.edgeOpacity != null) edgeOpacity = o.edgeOpacity;
      if (o.count && o.count !== N) { build(o.count); }
    },
    destroy() { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); removeEventListener('mousemove', onMove); }
  };
}
