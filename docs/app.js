// Fotoin site: a working miniature of the app's viewfinder.
// The placement maths and hint copy are the app's own (src/features/pose).
(() => {
  document.documentElement.classList.remove('no-js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Subjects (joints normalised to each photograph) --------------------

  const LIMBS = [
    ['ls', 'rs'], ['lh', 'rh'], ['ls', 'lh'], ['rs', 'rh'],
    ['ls', 'le'], ['le', 'lw'], ['rs', 're'], ['re', 'rw'],
    ['lh', 'lk'], ['lk', 'la'], ['rh', 'rk'], ['rk', 'ra'],
  ];
  const BODY = {
    nose: [0.371, 0.186],
    ls: [0.474, 0.288], rs: [0.254, 0.303],
    le: [0.545, 0.451], re: [0.204, 0.467],
    lw: [0.644, 0.382], rw: [0.315, 0.561],
    lh: [0.474, 0.639], rh: [0.315, 0.647],
    lk: [0.484, 0.826], rk: [0.354, 0.826],
    la: [0.504, 0.966], ra: [0.384, 0.966],
  };
  const FACE = {
    box: [0.27, 0.136, 0.423, 0.42],
    eyes: [[0.369, 0.326], [0.54, 0.329]],
    nose: [0.471, 0.421],
    mouth: [[0.41, 0.476], [0.527, 0.476]],
  };
  const GROUP = [
    { box: [0.236, 0.325, 0.157, 0.325], eyes: [[0.293, 0.466], [0.35, 0.46]], nose: [0.331, 0.52], mouth: [[0.307, 0.568], [0.354, 0.568]] },
    { box: [0.529, 0.38, 0.142, 0.28], eyes: [[0.56, 0.51], [0.614, 0.503]], nose: [0.586, 0.56], mouth: [[0.567, 0.597], [0.611, 0.594]] },
  ];
  const IMG = { body: [1254, 1610], face: [1400, 1762], group: [1600, 1054] };

  const viewport = document.getElementById('viewport');
  const scoreEl = document.getElementById('score');
  const hintEl = document.getElementById('hint');
  const ringFill = document.querySelector('.ring .fill');
  const flash = document.getElementById('flash');
  const caption = document.getElementById('caption');
  const zoomUi = document.getElementById('zoom');
  const CIRC = 113.1;

  const svgNS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs) => {
    const n = document.createElementNS(svgNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  function scoreColor(score) {
    if (score >= 0.8) return '#ffd60a';
    const t = Math.max(0, Math.min(1, score / 0.8));
    const mix = (a) => Math.round(a + (255 - a) * t);
    return `rgb(${mix(161)},${mix(161)},${mix(166)})`;
  }

  function setMeter(score, hint) {
    scoreEl.textContent = score == null ? '–' : Math.round(score * 100);
    hintEl.textContent = hint;
    const s = score ?? 0;
    ringFill.style.strokeDashoffset = String(CIRC * (1 - s));
    ringFill.style.setProperty('--score', scoreColor(s));
    ringFill.style.stroke = scoreColor(s);
  }

  // object-fit: cover mapping from image-normalised to viewport pixels.
  function coverMap(imgW, imgH, vw, vh, posX = 0.5) {
    const s = Math.max(vw / imgW, vh / imgH);
    const w = imgW * s;
    const h = imgH * s;
    const ox = (vw - w) * posX;
    const oy = (vh - h) / 2;
    return ([x, y]) => [ox + x * w, oy + y * h];
  }

  // pointOf(jointKey) → [x, y] in viewport pixels.
  function drawSkeleton(svg, pointOf, color, width, dx = 0, dy = 0) {
    const pt = (k) => {
      const [x, y] = pointOf(k);
      return [x + dx, y + dy];
    };
    for (const [a, b] of LIMBS) {
      const [x1, y1] = pt(a);
      const [x2, y2] = pt(b);
      svg.appendChild(el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }));
    }
    const [nx, ny] = pt('nose');
    svg.appendChild(el('circle', { cx: nx, cy: ny, r: width * 1.4, fill: color }));
  }

  function drawFace(svg, map, face, color, width, dashed, dx = 0, dy = 0) {
    const p = (q) => {
      const [x, y] = map(q);
      return [x + dx, y + dy];
    };
    const [bx, by] = p([face.box[0], face.box[1]]);
    const [bx2, by2] = p([face.box[0] + face.box[2], face.box[1] + face.box[3]]);
    const w = bx2 - bx;
    const h = by2 - by;
    svg.appendChild(
      el('rect', {
        x: bx, y: by, width: w, height: h, rx: Math.min(w, h) * 0.45,
        fill: 'none', stroke: color, 'stroke-width': width, ...(dashed ? { 'stroke-dasharray': '10 8' } : {}),
      }),
    );
    const [e1, e2] = face.eyes.map(p);
    const [m1, m2] = face.mouth.map(p);
    const n = p(face.nose);
    svg.appendChild(el('line', { x1: e1[0], y1: e1[1], x2: e2[0], y2: e2[1], stroke: color, 'stroke-width': width }));
    for (const [x, y] of [e1, e2]) svg.appendChild(el('circle', { cx: x, cy: y, r: width * 1.6, fill: color }));
    svg.appendChild(el('circle', { cx: n[0], cy: n[1], r: width * 1.4, fill: color }));
    svg.appendChild(el('line', { x1: m1[0], y1: m1[1], x2: m2[0], y2: m2[1], stroke: color, 'stroke-width': width, 'stroke-linecap': 'round' }));
  }

  // ---- Static scenes (how it works, modes) --------------------------------

  const TARGET = 'rgba(247,247,247,0.6)';
  const STATIC = {
    reference: { score: null, hint: 'Referensi tersimpan' },
    guide: { score: 0.62, hint: 'Geser HP ke kanan' },
    shot: { score: 0.86, hint: 'Pas! Tahan…' },
    face: { score: 0.71, hint: 'Menoleh ke kanan layar' },
    group: { score: 0.74, hint: 'Orang kanan: angkat dagu sedikit' },
  };

  function drawStatic() {
    const { width: vw, height: vh } = viewport.getBoundingClientRect();
    for (const svg of viewport.querySelectorAll('svg[data-draw]')) {
      svg.replaceChildren();
      svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
      const kind = svg.dataset.draw;
      if (kind === 'guide' || kind === 'shot') {
        const map = coverMap(...IMG.body, vw, vh);
        const pointOf = (k) => map(BODY[k]);
        drawSkeleton(svg, pointOf, TARGET, 6);
        const off = kind === 'guide' ? [vw * 0.09, -vh * 0.015] : [vw * 0.008, 0];
        drawSkeleton(svg, pointOf, scoreColor(STATIC[kind].score), 4, ...off);
      } else if (kind === 'face') {
        const map = coverMap(...IMG.face, vw, vh);
        drawFace(svg, map, FACE, TARGET, 3, true);
        drawFace(svg, map, FACE, scoreColor(STATIC.face.score), 2.5, false, -vw * 0.035, vh * 0.01);
      } else if (kind === 'group') {
        const map = coverMap(...IMG.group, vw, vh, 0.45);
        GROUP.forEach((f, i) => {
          drawFace(svg, map, f, TARGET, 3, true);
          drawFace(svg, map, f, scoreColor(STATIC.group.score), 2.5, false, 0, i === 1 ? vh * 0.025 : 0);
        });
      }
    }
  }

  // ---- The live viewfinder ------------------------------------------------

  const photo = document.getElementById('live-photo');
  const liveSvg = document.getElementById('live-overlay');
  const [IW, IH] = IMG.body;
  const live = { z: 1.35, tx: 0, ty: 0, base: 1, vw: 0, vh: 0, target: null, firing: false };

  function torso(j) {
    const sx = (j.ls[0] + j.rs[0]) / 2;
    const sy = (j.ls[1] + j.rs[1]) / 2;
    const hx = (j.lh[0] + j.rh[0]) / 2;
    const hy = (j.lh[1] + j.rh[1]) / 2;
    return { cx: (sx + hx) / 2, cy: (sy + hy) / 2, size: Math.hypot(hx - sx, hy - sy) };
  }

  // Joints of the photograph as placed now, normalised to the viewport.
  function placedJoints() {
    const s = live.base * live.z;
    const out = {};
    for (const k in BODY) {
      out[k] = [(live.tx + BODY[k][0] * IW * s) / live.vw, (live.ty + BODY[k][1] * IH * s) / live.vh];
    }
    return out;
  }

  function clampPan() {
    const s = live.base * live.z;
    live.tx = Math.min(0, Math.max(live.vw - IW * s, live.tx));
    live.ty = Math.min(0, Math.max(live.vh - IH * s, live.ty));
  }

  function layoutLive(resetOffset) {
    const r = viewport.getBoundingClientRect();
    live.vw = r.width;
    live.vh = r.height;
    live.base = Math.max(r.width / IW, r.height / IH);
    // The target is the photograph framed as the reference: centred, cover.
    const z = live.z;
    live.z = 1;
    live.tx = (live.vw - IW * live.base) / 2;
    live.ty = (live.vh - IH * live.base) / 2;
    live.target = placedJoints();
    live.z = z;
    if (resetOffset) {
      live.z = 1.3 + Math.random() * 0.15;
      const s = live.base * live.z;
      live.tx = live.vw - IW * s;
      live.ty = (live.vh - IH * s) * (0.15 + Math.random() * 0.2);
    }
    photo.classList.remove('cover');
    photo.style.width = `${IW}px`;
    photo.style.height = `${IH}px`;
    clampPan();
    renderLive();
  }

  // The app's placement rule (matcher.ts `placement`).
  function evaluate() {
    const l = torso(placedJoints());
    const r = torso(live.target);
    const dx = l.cx - r.cx;
    const dy = l.cy - r.cy;
    const ratio = l.size / r.size;
    const err = Math.abs(dx) + Math.abs(dy) + Math.abs(Math.log(ratio)) * 0.8;
    const place = Math.max(0, 1 - err / 0.6);
    let hint = 'Pas! Tahan…';
    if (ratio > 1.12) hint = 'Mundur sedikit';
    else if (ratio < 0.88) hint = 'Maju sedikit';
    else if (dx > 0.07) hint = 'Geser HP ke kanan';
    else if (dx < -0.07) hint = 'Geser HP ke kiri';
    else if (dy > 0.07) hint = 'Arahkan HP sedikit ke bawah';
    else if (dy < -0.07) hint = 'Arahkan HP sedikit ke atas';
    // Same photograph, same pose: the pose part of the score is full.
    return { score: Math.min(1, 0.6 + 0.4 * place), hint };
  }

  function renderLive() {
    const s = live.base * live.z;
    photo.style.transform = `translate(${live.tx}px, ${live.ty}px) scale(${s})`;
    const { score, hint } = evaluate();
    liveSvg.replaceChildren();
    liveSvg.setAttribute('viewBox', `0 0 ${live.vw} ${live.vh}`);
    const toPx = ([x, y]) => [x * live.vw, y * live.vh];
    const liveJ = placedJoints();
    drawSkeleton(liveSvg, (k) => toPx(live.target[k]), TARGET, 6);
    drawSkeleton(liveSvg, (k) => toPx(liveJ[k]), scoreColor(score), 4);
    if (current === 'live' && !live.firing) setMeter(score, hint);
    checkShutter(score);
  }

  // Like the app: fire once the match has held at 80+ for 700 ms.
  let holdTimer = null;
  function checkShutter(score) {
    if (current !== 'live' || live.firing || score < 0.8) {
      clearTimeout(holdTimer);
      holdTimer = null;
      return;
    }
    if (!holdTimer) holdTimer = setTimeout(fire, 700);
  }

  function fire() {
    clearTimeout(holdTimer);
    holdTimer = null;
    live.firing = true;
    setMeter(1, 'Jepret! Foto tersimpan');
    if (!reduced) {
      flash.classList.remove('is-firing');
      void flash.offsetWidth;
      flash.classList.add('is-firing');
    }
    navigator.vibrate?.(30);
    setTimeout(() => {
      live.firing = false;
      layoutLive(true);
    }, 2200);
  }

  // Dragging the photograph is moving the phone; zoom is stepping in or out.
  let drag = null;
  const pointers = new Map();
  viewport.addEventListener('pointerdown', (e) => {
    if (current !== 'live' || e.target.closest('button')) return;
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    drag = { x: e.clientX, y: e.clientY, tx: live.tx, ty: live.ty, pinch: null };
    viewport.classList.add('is-dragging');
    caption.style.opacity = '0';
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (!drag.pinch) drag.pinch = { dist, z: live.z };
      zoomTo(drag.pinch.z * (dist / drag.pinch.dist));
      return;
    }
    live.tx = drag.tx + (e.clientX - drag.x);
    live.ty = drag.ty + (e.clientY - drag.y);
    clampPan();
    renderLive();
  });
  const endDrag = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      drag = null;
      viewport.classList.remove('is-dragging');
    }
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  function zoomTo(z) {
    const cx = live.vw / 2;
    const cy = live.vh / 2;
    const old = live.base * live.z;
    live.z = Math.max(1, Math.min(2.2, z));
    const s = live.base * live.z;
    live.tx = cx - ((cx - live.tx) / old) * s;
    live.ty = cy - ((cy - live.ty) / old) * s;
    clampPan();
    renderLive();
  }

  zoomUi.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    caption.style.opacity = '0';
    zoomTo(live.z * (b.dataset.zoom === 'in' ? 1.12 : 1 / 1.12));
  });
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (current !== 'live') return;
      e.preventDefault();
      zoomTo(live.z * Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false },
  );
  document.getElementById('shutter').addEventListener('click', () => {
    if (current === 'live' && !live.firing) fire();
  });

  // ---- Scenes follow the reading column -----------------------------------

  let current = 'live';
  const scenes = [...viewport.querySelectorAll('.scene')];
  function show(name) {
    if (name === current) return;
    current = name;
    for (const s of scenes) s.classList.toggle('is-on', s.dataset.view === name);
    zoomUi.style.visibility = name === 'live' ? 'visible' : 'hidden';
    caption.style.visibility = name === 'live' ? 'visible' : 'hidden';
    if (name === 'live') renderLive();
    else setMeter(STATIC[name].score, STATIC[name].hint);
  }

  const triggers = [...document.querySelectorAll('[data-view]')].filter((n) => !n.classList.contains('scene'));
  const steps = [...document.querySelectorAll('.step')];
  function onScroll() {
    const mid = window.innerHeight * 0.5;
    let best = null;
    let bestDist = Infinity;
    for (const t of triggers) {
      const r = t.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    if (best) show(best.dataset.view);
    for (const s of steps) s.classList.toggle('is-active', s === best);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- Entrances ----------------------------------------------------------

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  document.querySelectorAll('.reveal').forEach((n, i) => {
    n.style.transitionDelay = `${(i % 4) * 75}ms`;
    io.observe(n);
  });

  // ---- Start ----------------------------------------------------------------

  const start = () => {
    layoutLive(true);
    drawStatic();
    onScroll();
  };
  if (photo.complete) start();
  else photo.addEventListener('load', start, { once: true });
  window.addEventListener('resize', () => {
    layoutLive(false);
    drawStatic();
  });
})();
