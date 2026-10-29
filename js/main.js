/* =========================================================
   Dropi · Lab Summit · motor de escenas a pantalla completa
   Cada gesto (rueda, swipe, teclado, flechas del riel) avanza un paso:
   primero los pasos internos de la escena (data-beats) y luego la
   escena siguiente. data-curtain="Texto" abre la escena con la
   cortina de capítulo (titular animado con partículas radiales).
   JavaScript vanilla, sin dependencias. Mapas en js/geo-data.js.
   ========================================================= */
(() => {
  'use strict';

  /* ---------------------------------------------------------
     CONFIGURACIÓN
     --------------------------------------------------------- */
  const CONFIG = {
    sectionMs: 1250,       // duración del cambio de escena
    wheelGap: 240,         // ms de quietud de la rueda para contar un gesto nuevo
    dropiPay: {
      nacionalidades: 'anuncio'   // 'anuncio' → "Desde la próxima semana" · 'disponible' → "Ya disponible"
    },
    ai: {
      words: ['ECOSISTEMA', 'DROPI'],          // palabras que forma el campo ASCII (se alternan)
      ais: ['CLAUDE', 'DEEPSEEK', 'GEMINI']    // nombres que aparecen de fondo
    },
    hundred: {
      lines: ['DROPI = 100 MILLONES', 'DE ÓRDENES'],                 // titular de la intro, una línea por elemento
      linesMobile: ['DROPI =', '100', 'MILLONES', 'DE ÓRDENES'],    // en pantallas angostas
      waveSpeed: 2.2                                                // velocidad de las ondas
    },
    chatea: {
      intervalMs: 2000     // cada cuánto cambia la captura de Chatea Pro
    }
  };

  /* ---------- utilidades ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eo = t => 1 - Math.pow(1 - t, 3);
  const eio = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pad2 = n => String(n).padStart(2, '0');
  const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const op = (el, o, tr) => { if (!el) return; el.style.opacity = o; if (tr !== undefined) el.style.transform = tr; };
  const EASE = 'cubic-bezier(.65,0,.25,1)';
  const SOFT = 'cubic-bezier(.33,0,.15,1)';
  const NS = 'http://www.w3.org/2000/svg';

  const root = document.documentElement;
  root.classList.add('js');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) root.classList.add('rm');
  const isMobile = () => innerWidth < 861;

  /* Puntero: inclinaciones suaves (mx, my de -1 a 1) y posición en px */
  let time = 0, mx = 0, my = 0, tmx = 0, tmy = 0, px = -9999, py = -9999, hasMouse = false;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
    px = e.clientX; py = e.clientY; hasMouse = true;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { hasMouse = false; tmx = tmy = 0; });

  /* ---------------------------------------------------------
     Fondo de la cortina: partículas en anillos concéntricos que
     giran; el cursor las dispersa y un resorte las devuelve.
     --------------------------------------------------------- */
  function Antigravity(cv) {
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, dpr = 1, P = [];
    function build() {
      dpr = Math.min(2, devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const base = Math.min(W * .62, H), N = W < 760 ? 150 : 300, RINGS = [.26, .4, .56, .74];
      const cx = W / 2, cy = H / 2;
      P = [];
      for (let i = 0; i < N; i++) {
        const ring = i % RINGS.length, a = Math.random() * Math.PI * 2, r = base * RINGS[ring] * (1 + (Math.random() - .5) * .07);
        P.push({
          ring, a, r, x: cx + Math.cos(a) * r * .86, y: cy + Math.sin(a) * r * .86, vx: 0, vy: 0,
          sp: (ring % 2 ? -1 : 1) * (.05 + ring * .018), len: 5 + Math.random() * 8, w: 1.4 + Math.random() * 1.4,
          hot: Math.random() < .35, ph: Math.random() * 6.28
        });
      }
    }
    function step(dt) {
      if (!W) build();
      if (!W) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H / 2, RR = Math.max(120, Math.min(W, H) * .2);
      ctx.lineCap = 'round';
      for (const p of P) {
        p.a += p.sp * dt;
        const br = 1 + Math.sin(time * .7 + p.ring * 1.3) * .03;
        const hx = cx + Math.cos(p.a) * p.r * br, hy = cy + Math.sin(p.a) * p.r * br;
        p.vx += (hx - p.x) * 14 * dt; p.vy += (hy - p.y) * 14 * dt;
        if (hasMouse && !RM) {
          const dx = p.x - px, dy = p.y - py, dd = Math.hypot(dx, dy) || 1;
          if (dd < RR) { const f = Math.pow(1 - dd / RR, 2) * 3200 * dt; p.vx += dx / dd * f; p.vy += dy / dd * f; }
        }
        const damp = Math.exp(-4.2 * dt); p.vx *= damp; p.vy *= damp;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const sp = Math.hypot(p.vx, p.vy), tg = p.a + Math.PI / 2, mix = clamp((sp - 90) / 220);
        const ang = mix > 0 ? Math.atan2(lerp(Math.sin(tg), p.vy / (sp || 1), mix), lerp(Math.cos(tg), p.vx / (sp || 1), mix)) : tg;
        const L = p.len * (1 + Math.min(2, sp / 260)), c = Math.cos(ang) * L / 2, s2 = Math.sin(ang) * L / 2;
        const tw = .45 + .55 * (.5 + .5 * Math.sin(time * 1.4 + p.ph));
        ctx.strokeStyle = p.hot ? `rgba(255,132,5,${(.75 * tw).toFixed(3)})` : `rgba(255,220,181,${(.42 * tw).toFixed(3)})`;
        ctx.lineWidth = p.w;
        ctx.beginPath(); ctx.moveTo(p.x - c, p.y - s2); ctx.lineTo(p.x + c, p.y + s2); ctx.stroke();
      }
    }
    return { build, step };
  }

  /* ---------------------------------------------------------
     Iconos lineales en 3D: la misma línea repetida en capas Z
     (extrusión de neón); la capa frontal brilla
     --------------------------------------------------------- */
  const LINE_ICONS = {
    clock: `<g class="speed"><path d="M4 52h16M0 66h18M6 80h13"/></g>
      <circle cx="64" cy="66" r="38"/><circle cx="64" cy="66" r="31" class="thin"/>
      <path d="M56 16h16M64 16v12M94 36l7-7"/>
      <path class="thin" d="M64 34v5M64 93v5M32 66h5M91 66h5"/>
      <g class="h-m"><path d="M64 66V47"/></g><g class="h-s"><path d="M64 66V37"/></g>
      <circle cx="64" cy="66" r="3.5"/>`,
    coin: `<circle cx="60" cy="60" r="46"/><circle cx="60" cy="60" r="37" class="thin"/>
      <path d="M72 46c-3-4-8-6-12-6-7 0-12 4-12 9 0 12 25 7 25 20 0 6-6 10-13 10-6 0-11-2-14-7M60 33v54"/>`
  };
  function lineIcon3D(box, name, o = {}) {
    if (!box) return null;
    const N = o.layers || 7, gap = o.gap || 2.4;
    box.innerHTML = '';
    const obj = document.createElement('div'); obj.className = 'ico3d-obj'; box.appendChild(obj);
    for (let i = N - 1; i >= 0; i--) {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('viewBox', '0 0 120 120'); s.innerHTML = LINE_ICONS[name];
      s.setAttribute('class', i === 0 ? 'lyr front' : 'lyr');
      s.style.setProperty('--d', (i / (N - 1)).toFixed(3));
      s.style.transform = `translateZ(${(-i * gap + (N - 1) * gap / 2).toFixed(2)}px)`;
      obj.appendChild(s);
    }
    return obj;
  }

  /* ---------------------------------------------------------
     Banderas en versión lineal: contorno y franjas en sus colores
     Coordenadas u, v de 0 a 1 sobre la bandera
     --------------------------------------------------------- */
  const FLAG_LINES = [
    { c: '#ffffff', el: [['rect', 0, 0, 1, 1], ['h', .5, 0, 1, '#ff5a4a'], ['rect', 0, 0, .34, .5, '#5b8cff'], ['star', .17, .25, .11, '#ffffff']] },
    { c: '#ffdd33', el: [['rect', 0, 0, 1, 1], ['h', .5, 0, 1, '#4f8dff'], ['h', .75, 0, 1, '#ff4a4a'], ['circle', .5, .5, .16, '#ffdd33']] },
    { c: '#2fd17a', el: [['rect', 0, 0, 1, 1], ['poly', [[.08, .5], [.5, .1], [.92, .5], [.5, .9]], '#ffe14d'], ['circle', .5, .5, .22, '#5b8cff']] },
    { c: '#8cc4f2', el: [['rect', 0, 0, 1, 1], ['h', .333, 0, 1, '#8cc4f2'], ['h', .667, 0, 1, '#8cc4f2'], ['circle', .5, .5, .1, '#ffc23a']] },
    { c: '#ffffff', el: [['rect', 0, 0, 1, 1], ['v', .333, 0, 1, '#2fd17a'], ['v', .667, 0, 1, '#ff4a5e'], ['circle', .5, .5, .13, '#e0a35f']] }
  ];

  /* ---------------------------------------------------------
     Controladores de escena: update(p, e, dt)
     p = progreso de los pasos (0..1) · e = entrada (0..1)
     --------------------------------------------------------- */
  const controllers = {

    /* =========================================================
       INTRO · DROPI = 100 MILLONES DE ÓRDENES
       El titular se arma con caracteres ASCII; ondas concéntricas
       recorren las letras y un campo de wave dots late detrás.
       El cursor ilumina letras y agranda los puntos.
       ========================================================= */
    hundred(el) {
      const cv = $('.hundred-field', el), ctx = cv.getContext('2d'), hint = $('.scroll-hint', el);
      const C = CONFIG.hundred, RAMP = '.:-=+*x%#@', SCR = '@#%x*+';
      const COL = ['rgba(255,255,255,.22)', '#9a4e10', '#ff8405', '#ffc48a', '#fff4e8'];
      let W = 0, H = 0, cw = 8, chh = 12, cols = 0, rows = 0, dpr = 1, atlas = null, aw = 0, ah = 0;
      let rnd = null, mask = null, dots = [], ready = false, ccx = 0, ccy = 0, maxD = 1;

      /* Máscara del titular a la resolución de la cuadrícula ASCII.
         Tusker no trae "=", así que se dibuja con dos barras del grosor del trazo. */
      function makeMask(lines) {
        const m = new Float32Array(cols * rows);
        const c = document.createElement('canvas'); c.width = cols; c.height = rows;
        const g = c.getContext('2d'), fam = `"Tusker Grotesk", "Anton", "Arial Narrow", sans-serif`;
        const mob = W < 861;
        g.font = `400 100px ${fam}`;
        const cap = g.measureText('M').actualBoundingBoxAscent || 72;
        const parts = t => t.split(/(=)/).filter(Boolean);
        const eqW = cap * .66;
        const widthOf = t => parts(t).reduce((w, q) => w + (q === '=' ? eqW : g.measureText(q).width), 0);
        const w100 = lines.map(widthOf), maxW = Math.max(...w100), pitch = 1.38, n = lines.length;
        const blockH = cap * (1 + pitch * (n - 1));
        const k = Math.min(W * (mob ? .9 : .84) / maxW, H * (mob ? .58 : .74) / blockH);
        const fs = 100 * k, capK = cap * k;
        g.setTransform(1 / cw, 0, 0, 1 / chh, 0, 0);
        g.font = `400 ${fs}px ${fam}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = fs * .018; g.lineJoin = 'round';
        const top = H * .47 - capK * (1 + pitch * (n - 1)) / 2;
        lines.forEach((t, li) => {
          let x = W / 2 - w100[li] * k / 2;
          const base = top + capK + li * capK * pitch;
          parts(t).forEach(q => {
            if (q === '=') {
              const bw = eqW * k * .7, bx = x + eqW * k * .15, bh = capK * .12, gap = capK * .17, mid = base - capK * .5;
              g.fillRect(bx, mid - gap / 2 - bh, bw, bh);
              g.fillRect(bx, mid + gap / 2, bw, bh);
              x += eqW * k;
            } else {
              g.fillText(q, x, base); g.strokeText(q, x, base);
              x += g.measureText(q).width;
            }
          });
        });
        const d = g.getImageData(0, 0, cols, rows).data;
        for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
        return m;
      }
      function build() {
        W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
        const mob = W < 861;
        cw = mob ? 4 : 7; chh = Math.round(cw * 1.5);
        cols = Math.ceil(W / cw); rows = Math.ceil(H / chh);
        dpr = Math.min(2, devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        aw = Math.ceil(cw * dpr); ah = Math.ceil(chh * dpr);
        atlas = document.createElement('canvas'); atlas.width = aw * RAMP.length; atlas.height = ah * COL.length;
        const a = atlas.getContext('2d');
        a.font = `700 ${(chh * .92 * dpr).toFixed(1)}px ui-monospace, Menlo, Consolas, "Courier New", monospace`; a.textAlign = 'center'; a.textBaseline = 'middle';
        COL.forEach((col, y) => { a.fillStyle = col; [...RAMP].forEach((chr, x) => a.fillText(chr, x * aw + aw / 2, y * ah + ah / 2 + dpr)); });
        rnd = new Float32Array(cols * rows); for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
        mask = makeMask(mob ? C.linesMobile : C.lines);
        ccx = W / 2; ccy = H * .47; maxD = Math.hypot(W / 2, H * .53);
        /* wave dots: rejilla regular fuera de las letras */
        const gs = mob ? 13 : 17; dots = [];
        for (let y = gs / 2; y < H; y += gs) for (let x = gs / 2; x < W; x += gs) {
          const i = Math.min(cols - 1, Math.floor(x / cw)), j = Math.min(rows - 1, Math.floor(y / chh));
          let near = 0;
          for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < cols && jj < rows) near = Math.max(near, mask[jj * cols + ii]); }
          if (near > .05) continue;
          dots.push({ x, y, d: Math.hypot(x - ccx, y - ccy) });
        }
        ready = true;
      }
      if (document.fonts) document.fonts.load('400 100px "Tusker Grotesk"').then(() => { if (W) build(); }).catch(() => {});

      return {
        live: true, build,
        update(p, e, dt) {
          if (!ready) build(); if (!ready) return;
          const t = RM ? 0 : time * C.waveSpeed, ent = eo(e), F = RM ? 2 : e * 1.25, tk = Math.floor(time * 9);
          const r0 = cv.getBoundingClientRect(), mxp = hasMouse ? px - r0.left : -9999, myp = hasMouse ? py - r0.top : -9999;
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);

          /* ---- wave dots de fondo (por lotes de opacidad, como en el globo) ---- */
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const B = 6, paths = Array.from({ length: B }, () => new Path2D()), Rmax = (W < 861 ? 13 : 17) * .2;
          const reach = maxD * lerp(.15, 1.05, ent);
          for (const q of dots) {
            if (q.d > reach) continue;
            const w = .5 + .5 * Math.sin(q.d * .028 - t), fall = 1 - q.d / maxD;
            let v = w * w * (.25 + .75 * fall);
            if (mxp > -999) { const md = Math.hypot(q.x - mxp, q.y - myp); if (md < 160) v += Math.pow(1 - md / 160, 2) * .9; }
            const r = Math.max(.5, Rmax * (.3 + .9 * Math.min(1, v)));
            const b = Math.min(B - 1, Math.floor(Math.min(.999, v) * B));
            paths[b].moveTo(q.x + r, q.y); paths[b].arc(q.x, q.y, r, 0, 6.2832);
          }
          paths.forEach((pth, b) => {
            const l = (b + .5) / B, a = (.08 + .62 * l) * ent;
            ctx.fillStyle = `rgba(255,${Math.round(150 + 70 * l)},${Math.round(60 + 90 * l)},${a.toFixed(3)})`;
            ctx.fill(pth);
          });

          /* ---- titular ASCII ---- */
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          for (let j = 0; j < rows; j++) {
            const y = (j + .5) * chh, dy = y - ccy;
            for (let i = 0; i < cols; i++) {
              const idx = j * cols + i, m = mask[idx];
              if (m < .12) continue;
              const r = rnd[idx], th = .08 + .8 * (i / cols * .6 + r * .4);
              if (F < th) continue;
              let ch, col;
              if (F - th < .07) { ch = RAMP.indexOf(SCR[(r * 6 + tk) % 6 | 0]); col = 3; }
              else {
                const x = (i + .5) * cw, dx = x - ccx, d = Math.sqrt(dx * dx + dy * dy);
                const w = .5 + .5 * Math.sin(d * .028 - t);
                let v = .3 + .7 * w;
                if (mxp > -999) { const md = Math.hypot(x - mxp, y - myp); if (md < 130) v += Math.pow(1 - md / 130, 2) * .6; }
                v += (r - .5) * .14;
                if (m < .45) { ch = 4; col = v > .6 ? 3 : 2; }           // borde de la letra: trazo más fino
                else { ch = Math.max(5, Math.min(9, 5 + Math.floor(v * 5))); col = v > .94 ? 4 : v > .68 ? 3 : 2; }
              }
              ctx.drawImage(atlas, ch * aw, col * ah, aw, ah, Math.round(i * cw * dpr), Math.round(j * chh * dpr), aw, ah);
            }
          }
          if (hint) op(hint, seg(e, .7, 1));
        }
      };
    },

    /* =========================================================
       CHATEA PRO · capturas que rotan cada CONFIG.chatea.intervalMs
       ========================================================= */
    chatea(el) {
      const slides = $$('.ch-slides img', el), frame = $('.ch-frame', el), dotsEl = $('.ch-dots', el);
      dotsEl.innerHTML = slides.map(() => '<i><b></b></i>').join('');
      const dots = $$('.ch-dots i', el), bars = dots.map(d => $('b', d));
      let k = 0, acc = 0;
      const set = n => { k = n; acc = 0; slides.forEach((s, i) => s.classList.toggle('is-on', i === n)); dots.forEach((d, i) => d.classList.toggle('is-on', i === n)); bars.forEach(b => { b.style.transform = 'scaleX(0)'; }); };
      set(0);
      return {
        live: true,
        enter() { set(0); },
        update(p, e, dt) {
          const ms = CONFIG.chatea.intervalMs;
          if (e > .55 && slides.length > 1) {
            acc += dt * 1000;
            if (acc >= ms) set((k + 1) % slides.length);
            bars[k].style.transform = `scaleX(${clamp(acc / ms).toFixed(4)})`;
          }
          frame.style.transform = `rotateY(${(-9 + mx * 7).toFixed(2)}deg) rotateX(${(4 - my * 5).toFixed(2)}deg)`;
        }
      };
    },

    /* =========================================================
       MOMENTO 1 · Globo 3D en tres pasos
       0 · Ecosistema: Latinoamérica iluminada con wave dots
       1 · Logística: el globo se acerca y salen camiones y aviones
       2 · Dropi Pro: el globo da una vuelta completa y llega a Europa
       ========================================================= */
    globe(el) {
      const G = window.GLOBE, d3 = window.d3;
      if (!G || !d3) return null;
      const cv = $('.globe', el), ctx = cv.getContext('2d');
      const buf = document.createElement('canvas'), bctx = buf.getContext('2d');
      const copies = [0, 1, 2].map(i => { const c = $(`.g-copy--${i}`, el); return { el: c, lines: $$('.reveal > span > i', c), rest: [...c.children].filter(x => !x.classList.contains('reveal')) }; });
      const logo = $('.pro-logo', el), hint = $('.scroll-hint', el);
      const proj = d3.geoOrthographic().clipAngle(90).precision(.7);
      const gp = d3.geoPath(proj, bctx), mp = d3.geoPath(proj, ctx);
      const F = g => ({ type: 'Feature', geometry: g });
      const FC = list => ({ type: 'FeatureCollection', features: list });
      const world = G.world.map(c => ({ n: c.n, f: F(c.g), b: d3.geoBounds(F(c.g)) }));
      const worldFC = FC(world.map(w => w.f));
      const prep = (list, origin) => list.map(c => {
        const f = F(c.g), d = [];
        for (let i = 0; i < c.dots.length; i += 2) d.push({ p: [c.dots[i], c.dots[i + 1]], d: d3.geoDistance([c.dots[i], c.dots[i + 1]], origin) });
        return { n: c.n, f, b: d3.geoBounds(f), c: c.c, dots: d, lift: 0 };
      });
      const LA = prep(G.latam, [-74.08, 4.6]), EU = prep(G.europe, [-3.7, 40.4]);
      const grat = d3.geoGraticule10(), SPHERE = { type: 'Sphere' };

      /* Cámara de cada paso: rotación (λ, φ), radio (× alto) y centro en pantalla */
      const CAM = {
        d: [{ l: 70, f: 12, r: .47, x: .69, y: .53 }, { l: 76, f: 8, r: .8, x: .68, y: .62 }, { l: -11, f: -46, r: 1.45, x: .68, y: .6 }],
        m: [{ l: 70, f: 12, r: .5, x: .5, y: .72 }, { l: 76, f: 8, r: .78, x: .5, y: .76 }, { l: -11, f: -45, r: .95, x: .5, y: .74 }]
      };

      /* Rutas de logística: camiones entre vecinos, aviones en distancias largas */
      const HUB = {
        bog: [-74.08, 4.6], cdmx: [-99.13, 19.43], uio: [-78.47, -.18], lim: [-77.04, -12.05], scl: [-70.67, -33.45],
        bue: [-58.38, -34.6], asu: [-57.58, -25.26], ccs: [-66.9, 10.5], pty: [-79.52, 8.98], sjo: [-84.09, 9.93], gua: [-90.51, 14.64], clo: [-76.53, 3.45]
      };
      const ROUTES = [
        ['truck', 'bog', 'uio'], ['truck', 'uio', 'lim'], ['truck', 'lim', 'scl'], ['truck', 'asu', 'bue'], ['truck', 'bog', 'ccs'],
        ['truck', 'pty', 'sjo'], ['truck', 'gua', 'cdmx'], ['truck', 'scl', 'bue'], ['truck', 'sjo', 'gua'], ['truck', 'clo', 'bog'],
        ['plane', 'bog', 'cdmx'], ['plane', 'bog', 'scl'], ['plane', 'cdmx', 'lim'], ['plane', 'clo', 'bue'], ['plane', 'pty', 'lim'], ['plane', 'uio', 'gua'], ['plane', 'ccs', 'asu']
      ].map(([kind, a, b]) => {
        const A = HUB[a], B = HUB[b], dist = d3.geoDistance(A, B);
        return { kind, A, B, ip: d3.geoInterpolate(A, B), dist, dur: kind === 'plane' ? 2.6 + dist * 1.6 : 2.6 + dist * 6, t: -Math.random() * 2.5 };
      });
      const PLANE = new Path2D('M26 0C24 3.4-18 3.8-26 2.2-27.5 1.2-27.5-1.2-26-2.2-18-3.8 24-3.4 26 0ZM4 3.2L-9 30H-16L-10 3.4ZM4-3.2L-9-30H-16L-10-3.4ZM-20 2.6L-28 11H-32L-27 2.4ZM-20-2.6L-28-11H-32L-27-2.4Z');
      const TRUCK = new Path2D('M-15-5h19v10h-19zM6-4.5h7c1.5 0 2.5 1 2.5 2.5v4c0 1.5-1 2.5-2.5 2.5h-7z');
      const FADE = .9;

      let W = 0, H = 0, dpr = 1, R = 1, cx = 0, cy = 0, rot = [0, 0];
      let dl = 0, df = 0, vl = 0, zu = 1, zuT = 1, drag = null, engaged = false, blurA = 0;
      let hot = null, hotSet = null, soft = null, lastP = 0;
      const pts = new Map(); let pinch0 = 0, z0 = 1;

      function build() {
        W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
        dpr = Math.min(1.75, devicePixelRatio || 1);
        cv.width = buf.width = Math.round(W * dpr); cv.height = buf.height = Math.round(H * dpr);
      }
      const visible = ll => { const r = d3.geoRotation(rot)(ll); return Math.cos(r[1] * Math.PI / 180) * Math.cos(r[0] * Math.PI / 180); };
      const lifted = (ll, h) => { const s = proj(ll); return [cx + (s[0] - cx) * (1 + h), cy + (s[1] - cy) * (1 + h)]; };
      const inBox = (b, ll) => b[0][0] > b[1][0] || (ll[0] >= b[0][0] - .5 && ll[0] <= b[1][0] + .5 && ll[1] >= b[0][1] - .5 && ll[1] <= b[1][1] + .5);
      function pick(x, y) {
        if (Math.hypot(x - cx, y - cy) > R) return { c: null, set: null, w: null };
        const ll = proj.invert([x, y]); if (!ll) return { c: null };
        const set = lastP < 1.5 ? LA : EU;
        for (const c of set) if (inBox(c.b, ll) && d3.geoContains(c.f, ll)) return { c, set };
        for (const w of world) if (inBox(w.b, ll) && d3.geoContains(w.f, ll)) return { c: null, w };
        return { c: null };
      }

      /* Interacción: arrastrar gira, rueda (tras tocar), doble clic o pellizco acercan */
      const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', e => {
        engaged = true;
        pts.set(e.pointerId, local(e));
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); z0 = zuT; drag = null; return; }
        const [x, y] = local(e);
        drag = { x, y, lx: x, ly: y, lt: performance.now(), moved: false, id: e.pointerId };
        if (e.pointerType !== 'mouse') { const r = pick(x, y); hot = r.c; hotSet = r.set; soft = null; }
      });
      cv.addEventListener('pointermove', e => {
        const [x, y] = local(e);
        if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
        if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; zuT = clamp(z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch0, 1, 1.4); return; }
        if (drag && drag.id === e.pointerId) {
          if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 5) { drag.moved = true; cv.classList.add('is-drag'); try { cv.setPointerCapture(e.pointerId); } catch (_) {} hot = null; soft = null; }
          if (drag.moved) {
            const k = 57.3 / R, now = performance.now();
            dl += (x - drag.lx) * k; df = clamp(df - (y - drag.ly) * k, -40, 40);
            vl = clamp((x - drag.lx) * k / Math.max(.008, (now - drag.lt) / 1000), -160, 160);
            drag.lx = x; drag.ly = y; drag.lt = now;
          }
          return;
        }
        if (e.pointerType === 'mouse') {
          const r = pick(x, y); hot = r.c; hotSet = r.set;
          soft = !r.c && r.w ? { n: r.w.n, x, y } : null;
        }
      });
      const end = e => {
        pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0;
        if (drag && drag.id === e.pointerId) { if (!drag.moved && e.pointerType !== 'mouse' && !hot) hot = null; drag = null; cv.classList.remove('is-drag'); }
      };
      cv.addEventListener('pointerup', end);
      cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) { hot = null; soft = null; engaged = false; } });
      cv.addEventListener('dblclick', () => { zuT = zuT > 1.15 ? 1 : 1.35; });
      cv.addEventListener('wheel', e => {
        if (!engaged && !e.ctrlKey) return;                 // sin tocar el globo, la rueda sigue navegando la presentación
        e.preventDefault(); e.stopPropagation();
        zuT = clamp(zuT - e.deltaY * (e.ctrlKey ? .01 : .0015), 1, 1.4);
      }, { passive: false });

      /* Logo oficial de Dropi Pro si existe el archivo */
      const img = $('img[data-srcs]', logo);
      if (img) {
        const list = img.dataset.srcs.split('|'); let i = 0;
        const next = () => { if (i >= list.length) return; const src = list[i++]; const t = new Image(); t.onload = () => { img.src = src; img.hidden = false; $('.pro-word', logo).hidden = true; }; t.onerror = next; t.src = src; };
        next();
      }

      function pill(c, x, y, txt, on, a) {
        c.font = `600 ${on ? 13 : 11.5}px Montserrat, system-ui, sans-serif`;
        const w = c.measureText(txt).width + 16, h = on ? 24 : 21;
        c.globalAlpha = a;
        c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
        c.fillStyle = on ? '#ff8405' : 'rgba(21,21,21,.66)'; c.fill();
        if (!on) { c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 1; c.stroke(); }
        c.fillStyle = on ? '#1a0d00' : '#f4f0eb'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y + .5);
        c.globalAlpha = 1;
      }
      function drawDots(c, set, amp, hotC, t, freq, rs) {
        if (amp < .02) return;
        const B = 6, paths = Array.from({ length: B * 2 }, () => new Path2D());
        for (const co of set) {
          const isHot = co === hotC, h = isHot ? co.lift * .035 : 0;
          for (const d of co.dots) {
            if (visible(d.p) < .03) continue;
            const w = RM ? .5 : .5 + .5 * Math.sin(d.d * freq - t * 2.4), [x, y] = h ? lifted(d.p, h) : proj(d.p);
            const r = Math.max(.55, R * rs * (.35 + .9 * w * w));
            const b = Math.min(B - 1, Math.floor(w * B)) + (isHot ? B : 0);
            paths[b].moveTo(x + r, y); paths[b].arc(x, y, r, 0, 6.2832);
          }
        }
        paths.forEach((p, b) => {
          const l = (b % B + .5) / B, a = (.18 + .75 * l) * amp;
          c.fillStyle = b >= B ? `rgba(255,240,224,${Math.min(1, a + .3).toFixed(3)})` : `rgba(255,${Math.round(150 + 70 * l)},${Math.round(60 + 90 * l)},${a.toFixed(3)})`;
          c.fill(p);
        });
      }
      function drawSet(c, set, amp, skip) {
        for (const co of set) {
          if (co === skip) continue;
          c.beginPath(); gp.context(c)(co.f);
          c.fillStyle = `rgba(255,132,5,${(.03 + .1 * amp).toFixed(3)})`; c.fill();
        }
        c.save();
        c.shadowColor = 'rgba(255,132,5,.9)'; c.shadowBlur = 12 * amp;
        c.strokeStyle = amp > .05 ? `rgba(255,${Math.round(177 + 40 * amp)},${Math.round(92 + 60 * amp)},${(.25 + .7 * amp).toFixed(3)})` : 'rgba(255,255,255,.13)';
        c.lineWidth = .7 + .7 * amp;
        c.beginPath(); for (const co of set) if (co !== skip) gp.context(c)(co.f); c.stroke();
        c.restore();
      }

      return {
        live: true, build,
        beatDur: (from, to) => (Math.max(from, to) > 1.5 && Math.min(from, to) < 1.5 ? 3.8 : 2.4),
        update(p, e, dt) {
          if (!W) build(); if (!W) return;
          lastP = p;
          const t = time, ent = eo(e), m = isMobile(), cams = CAM[m ? 'm' : 'd'];
          /* Interpolación de cámara entre pasos */
          const k = Math.min(1, Math.floor(p)), s = clamp(p - k), A = cams[k], B = cams[Math.min(2, k + 1)];
          const spin = k === 1 ? -360 : 0;                       // paso 1 → 2: una vuelta completa
          let l = lerp(A.l, B.l + spin, s), f = lerp(A.f, B.f, s);
          let r = lerp(A.r, B.r, s) * (k === 1 ? 1 - .48 * Math.sin(Math.PI * s) : 1);
          const ox = lerp(A.x, B.x, s), oy = lerp(A.y, B.y, s);
          const between = Math.abs(p - Math.round(p)) > .01;
          if (!drag) {
            dl += vl * dt; vl *= Math.exp(-2.4 * dt);
            if (between) { dl *= Math.exp(-5 * dt); df *= Math.exp(-5 * dt); zuT = 1; }
          }
          zu += (zuT - zu) * (1 - Math.exp(-4 * dt));
          const idle = RM ? 0 : Math.sin(t * .16) * 5;
          rot = [l + dl + idle + (RM ? 0 : mx * 3) + (1 - ent) * 50, f + df - (RM ? 0 : my * 2)];
          R = r * (m ? W * 1.6 : H) * zu * lerp(.6, 1, ent);
          cx = W * ox - (1 - ent) * W * .05; cy = H * oy;
          proj.scale(R).translate([cx, cy]).rotate(rot);

          const laA = 1 - .55 * seg(p, 1.2, 1.9), euA = seg(p, 1.55, 2);
          const hotOn = hot && !drag;
          [...LA, ...EU].forEach(co => { co.lift += ((hotOn && co === hot ? 1 : 0) - co.lift) * (1 - Math.exp(-7 * dt)); });
          blurA += ((hotOn && hotSet === EU && euA > .5 ? 1 : 0) - blurA) * (1 - Math.exp(-6 * dt));

          /* ---- capa base (se desenfoca cuando un país de Europa está activo) ---- */
          const c = bctx;
          c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, buf.width, buf.height); c.setTransform(dpr, 0, 0, dpr, 0, 0);
          // halo
          let g = c.createRadialGradient(cx, cy, R * .92, cx, cy, R * 1.32);
          g.addColorStop(0, 'rgba(255,132,5,.16)'); g.addColorStop(.35, 'rgba(255,132,5,.05)'); g.addColorStop(1, 'rgba(255,132,5,0)');
          c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.32, 0, 6.2832); c.fill();
          // anillos orbitales (mitad trasera)
          const rings = [[1.42, .3, -.22, .16], [1.26, .2, .3, .1]];
          c.lineWidth = 1;
          rings.forEach(([rx, ry, a, o]) => { c.strokeStyle = `rgba(255,177,92,${o})`; c.setLineDash([2, 7]); c.beginPath(); c.ellipse(cx, cy, R * rx, R * ry, a, Math.PI, Math.PI * 2); c.stroke(); });
          c.setLineDash([]);
          // esfera
          g = c.createRadialGradient(cx - R * .38, cy - R * .42, R * .05, cx, cy, R);
          g.addColorStop(0, '#2b241e'); g.addColorStop(.55, '#171513'); g.addColorStop(1, '#0c0b0a');
          c.fillStyle = g; c.beginPath(); gp.context(c)(SPHERE); c.fill();
          c.strokeStyle = 'rgba(255,255,255,.035)'; c.lineWidth = .7; c.beginPath(); gp(grat); c.stroke();
          // tierra
          c.beginPath(); gp(worldFC); c.fillStyle = 'rgba(255,255,255,.055)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = .6; c.stroke();
          // regiones
          drawSet(c, LA, laA, hotOn && hotSet === LA ? hot : null);
          drawSet(c, EU, euA, hotOn && hotSet === EU ? hot : null);
          drawDots(c, LA, laA * .95, null, t, 28, .0026);
          drawDots(c, EU, euA, null, t, 60, .0016);
          // borde iluminado
          c.save(); c.shadowColor = 'rgba(255,132,5,.7)'; c.shadowBlur = 24; c.strokeStyle = 'rgba(255,190,120,.35)'; c.lineWidth = 1.2; c.beginPath(); gp(SPHERE); c.stroke(); c.restore();
          // anillos orbitales (mitad delantera) con satélites
          rings.forEach(([rx, ry, a, o], i) => {
            c.strokeStyle = `rgba(255,177,92,${o * 1.6})`; c.setLineDash([2, 7]); c.beginPath(); c.ellipse(cx, cy, R * rx, R * ry, a, 0, Math.PI); c.stroke(); c.setLineDash([]);
            const th = (t * (.12 + i * .05) + i * 2) % (Math.PI * 2);
            if (th < Math.PI) { const ex = R * rx * Math.cos(th), ey = R * ry * Math.sin(th); c.fillStyle = '#ffdcb5'; c.beginPath(); c.arc(cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a), 2.2, 0, 6.2832); c.fill(); }
          });

          /* ---- composición final ---- */
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
          ctx.globalAlpha = ent;
          if (blurA > .02) ctx.filter = `blur(${(blurA * 2.6).toFixed(2)}px)`;
          ctx.drawImage(buf, 0, 0);
          ctx.filter = 'none';
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          // país activo: se eleva, proyecta sombra y brilla
          if (hot && hot.lift > .01) {
            const h = hot.lift * .035, pulse = RM ? .5 : .5 + .5 * Math.sin(t * 4);
            ctx.save(); ctx.globalAlpha = .55 * hot.lift; ctx.shadowColor = '#000'; ctx.shadowBlur = 18; ctx.fillStyle = 'rgba(0,0,0,.6)';
            ctx.beginPath(); mp.context(ctx)(hot.f); ctx.fill(); ctx.restore();
            proj.scale(R * (1 + h));
            ctx.save(); ctx.shadowColor = 'rgba(255,132,5,1)'; ctx.shadowBlur = 14 + 22 * pulse;
            ctx.beginPath(); mp(hot.f); ctx.fillStyle = `rgba(255,132,5,${(.28 + .14 * pulse).toFixed(3)})`; ctx.fill();
            ctx.strokeStyle = '#fff1e0'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore();
            proj.scale(R);
            drawDots(ctx, [hot], 1, hot, t, hotSet === EU ? 60 : 28, hotSet === EU ? .0016 : .0026);
          }

          /* ---- rutas de logística ---- */
          const rk = seg(p, .45, .95) * (1 - seg(p, 1.08, 1.4));
          if (rk > .01) {
            ctx.save(); ctx.globalAlpha = rk * ent;
            Object.values(HUB).forEach(hb => { if (visible(hb) > .05) { const [x, y] = proj(hb); ctx.fillStyle = '#ffdcb5'; ctx.shadowColor = '#ff8405'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 6.2832); ctx.fill(); } });
            ctx.shadowBlur = 0;
            for (const rt of ROUTES) {
              rt.t += dt / rt.dur;
              if (rt.t > 1 + FADE) rt.t = -(.1 + Math.random() * .8);
              if (rt.t <= 0) continue;
              const head = Math.min(1, rt.t), fade = rt.t > 1 ? 1 - (rt.t - 1) / FADE : 1;
              const plane = rt.kind === 'plane', alt = sx => plane ? .13 * Math.sin(Math.PI * sx) * Math.min(1, rt.dist / .45) : .004;
              const N = 34, P = [];
              for (let i = 0; i <= N; i++) { const sx = head * i / N, ll = rt.ip(sx); P.push({ v: visible(ll) > (plane ? -.25 : .02), xy: lifted(ll, alt(sx)) }); }
              // rastro: solo existe por donde ya pasó el vehículo y se desvanece al llegar
              ctx.lineCap = 'round';
              for (let i = 1; i <= N; i++) {
                if (!P[i].v || !P[i - 1].v) continue;
                const a = Math.pow(i / N, 1.6) * fade;
                ctx.strokeStyle = plane ? `rgba(255,177,92,${(a * .95).toFixed(3)})` : `rgba(255,220,181,${(a * .8).toFixed(3)})`;
                ctx.lineWidth = plane ? 2.4 : 2;
                ctx.beginPath(); ctx.moveTo(P[i - 1].xy[0], P[i - 1].xy[1]); ctx.lineTo(P[i].xy[0], P[i].xy[1]); ctx.stroke();
              }
              // vehículo
              if (rt.t <= 1 && P[N].v) {
                const [x, y] = P[N].xy, [x0, y0] = P[N - 1].xy, ang = Math.atan2(y - y0, x - x0) || 0;
                const sc = plane ? clamp(R * .0006, .36, .75) * (1 + alt(head) * 2) : clamp(R * .0012, .6, 1.25);
                ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sc, sc);
                ctx.shadowColor = '#ff8405'; ctx.shadowBlur = 16;
                ctx.fillStyle = plane ? '#fff3e3' : '#ffb15c'; ctx.fill(plane ? PLANE : TRUCK);
                ctx.restore();
              }
              // llegada: pulso en el destino
              if (rt.t > 1 && visible(rt.B) > .05) {
                const q = (rt.t - 1) / FADE, [x, y] = proj(rt.B);
                ctx.strokeStyle = `rgba(255,132,5,${(1 - q).toFixed(3)})`; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(x, y, 4 + q * 22, 0, 6.2832); ctx.stroke();
              }
            }
            ctx.restore();
          } else ROUTES.forEach((rt, i) => { rt.t = -(i % 5) * .22 - Math.random() * .3; });

          /* ---- nombres ---- */
          if (euA > .05) {
            EU.forEach(co => {
              if (visible(co.c) < .1) return;
              const [x, y] = co === hot ? lifted(co.c, co.lift * .035) : proj(co.c);
              const on = co === hot;
              pill(ctx, x, y - (on ? 4 : 0), co.n, on, euA * (hot && !on && blurA > .3 ? .35 : 1) * ent);
            });
          }
          if (hot && hotSet === LA && hot.lift > .05) {
            const [x, y] = lifted(hot.c, hot.lift * .035);
            pill(ctx, x, y, hot.n, true, hot.lift);
          }
          if (soft && !drag) {
            ctx.font = '400 12px Montserrat, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(176,169,162,.9)'; ctx.fillText(soft.n, soft.x + 14, soft.y - 16);
          }

          /* ---- textos de cada paso ---- */
          const win = [
            eo(seg(e, .25, .95)) * (1 - seg(p, .04, .4)),
            seg(p, .55, .95) * (1 - seg(p, 1.04, 1.32)),
            seg(p, 1.72, 1.98)
          ];
          copies.forEach((cp, i) => {
            const kk = win[i];
            cp.el.style.opacity = kk > .001 ? 1 : 0;
            cp.el.style.visibility = kk > .001 ? 'visible' : 'hidden';
            cp.lines.forEach((ln, j) => { const q = eo(clamp(kk * 1.25 - j * .12)); ln.style.transform = `translateY(${((1 - q) * 108).toFixed(2)}%)`; });
            cp.rest.forEach((x, j) => op(x, eo(clamp(kk * 1.4 - .3 - j * .1)), `translateY(${((1 - kk) * 18).toFixed(1)}px)`));
          });
          op(logo, seg(p, 1.65, 1.95), `translateY(${((1 - seg(p, 1.65, 1.95)) * -12).toFixed(1)}px)`);
          if (hint) hint.style.opacity = win[0];
        }
      };
    },

    /* =========================================================
       DropiPay · filas de titulares en bucle → 3 beneficios
       ========================================================= */
    pay(el) {
      const rows = $$('.pay-row', el).map(r => ({ el: r, track: $('.pay-track', r), sp: +r.dataset.speed, x: 0, w: 0, hot: r.classList.contains('pay-row--hot'), cy: 0 }));
      const when = $('.nat-when', el);
      if (when) when.textContent = CONFIG.dropiPay.nacionalidades === 'disponible' ? 'Ya disponible:' : 'Desde la próxima semana:';
      const icons = $$('.ico3d', el).map(b => ({ name: b.dataset.ico, obj: lineIcon3D(b, b.dataset.ico) }));
      const fc = $('.flags', el), fctx = fc.getContext('2d');
      let H = 0, fw = 0, fh = 0, fdpr = 1;
      function build() {
        H = el.querySelector('.stage').clientHeight;
        rows.forEach(r => {
          r.w = r.track.firstElementChild.getBoundingClientRect().width;
          r.el.style.transform = ''; const b = r.el.getBoundingClientRect(); r.cy = b.top + b.height / 2;
        });
        fdpr = Math.min(2, devicePixelRatio || 1); fw = fc.clientWidth; fh = fc.clientHeight;
        fc.width = Math.round(fw * fdpr); fc.height = Math.round(fh * fdpr);
      }
      return {
        live: true, build,
        update(p, e, dt) {
          if (!H || !rows[0].w) build();
          const k = eio(seg(p, 0, .8)), vw = innerWidth / 1440;
          rows.forEach((r, i) => {
            r.x -= r.sp * vw * (RM ? 0 : 1) * dt * (r.hot ? 1 : 1);
            if (r.w) r.x = ((r.x % r.w) + r.w) % r.w;
            const ent = eo(seg(e, .05 + Math.abs(i - 2) * .08, .7 + Math.abs(i - 2) * .08));
            r.track.style.transform = `translate3d(${(-r.x).toFixed(1)}px,0,0)`;
            if (r.hot) {
              const dy = (H * .2 - r.cy) * k, sc = 1 - .5 * k;
              r.el.style.transform = `translateY(${dy.toFixed(1)}px) scale(${sc.toFixed(4)})`;
              r.el.style.opacity = ent;
            } else {
              const dir = i < 2 ? -1 : 1;
              r.el.style.transform = `translateY(${(dir * k * H * .18).toFixed(1)}px)`;
              r.el.style.opacity = (ent * (1 - k)).toFixed(3);
              r.el.style.filter = k > .01 ? `blur(${(k * 10).toFixed(1)}px)` : '';
            }
          });
          /* iconos lineales 3D */
          icons.forEach((ic, i) => {
            if (!ic.obj) return;
            const rx = 12 - my * 10, ry = ic.name === 'coin' ? (RM ? 20 : time * 70 % 360) : (RM ? -20 : Math.sin(time * .9 + i) * 28 - 10) + mx * 18;
            ic.obj.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
          });
          /* banderas lineales ondeando; se encienden una a una */
          if (k > .02 && fw) {
            fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0); fctx.clearRect(0, 0, fw, fh);
            const n = FLAG_LINES.length, gap = Math.max(8, fw * .035), w = Math.min((fw - gap * (n - 1) - 4) / n, fh * 1.25), h = w * .66, y0 = (fh - h) / 2 - 2;
            fctx.lineCap = 'round'; fctx.lineJoin = 'round';
            FLAG_LINES.forEach((fl, i) => {
              const lit = eio(seg(p, .45 + i * .1, .58 + i * .1)), x0 = 4 + i * (w + gap);
              const amp = h * .09, ph = time * 5 + i * 1.1;
              const M = (u, v) => [x0 + u * w, y0 + v * h + (RM ? 0 : Math.sin(u * 6.5 - ph) * amp * u)];
              const line = pts => { fctx.beginPath(); pts.forEach(([u, v], j) => { const [x, y] = M(u, v); j ? fctx.lineTo(x, y) : fctx.moveTo(x, y); }); };
              const seg_ = (u0, v0, u1, v1) => { const a = []; for (let q = 0; q <= 16; q++) a.push([lerp(u0, u1, q / 16), lerp(v0, v1, q / 16)]); return a; };
              const stroke = col => {
                fctx.strokeStyle = lit > .02 ? col : 'rgba(255,255,255,.22)';
                fctx.globalAlpha = lit > .02 ? .35 + .65 * lit : 1;
                fctx.shadowColor = col; fctx.shadowBlur = 10 * lit; fctx.lineWidth = 1.7; fctx.stroke();
              };
              // asta
              fctx.save(); fctx.strokeStyle = 'rgba(176,169,162,.55)'; fctx.lineWidth = 1.4; fctx.beginPath(); fctx.moveTo(x0, y0 - 5); fctx.lineTo(x0, y0 + h + 12); fctx.stroke(); fctx.restore();
              fctx.save();
              fl.el.forEach(([type, ...a]) => {
                if (type === 'rect') { const [u0, v0, u1, v1, col] = a; line([...seg_(u0, v0, u1, v0), ...seg_(u1, v0, u1, v1), ...seg_(u1, v1, u0, v1), ...seg_(u0, v1, u0, v0)]); stroke(col || fl.c); }
                else if (type === 'h') { const [v, u0, u1, col] = a; line(seg_(u0, v, u1, v)); stroke(col); }
                else if (type === 'v') { const [u, v0, v1, col] = a; line(seg_(u, v0, u, v1)); stroke(col); }
                else if (type === 'poly') { const [P, col] = a; const pts = []; P.forEach((pt, j) => pts.push(...seg_(...pt, ...P[(j + 1) % P.length]))); line(pts); stroke(col); }
                else if (type === 'circle' || type === 'star') {
                  const [cu, cv, r, col] = a, pts = [], K = type === 'star' ? 10 : 28;
                  for (let q = 0; q <= K; q++) { const an = -Math.PI / 2 + q * Math.PI * 2 / K, rr = type === 'star' && q % 2 ? r * .45 : r; pts.push([cu + Math.cos(an) * rr * h / w, cv + Math.sin(an) * rr]); }
                  line(pts); stroke(col);
                }
              });
              fctx.restore();
            });
          }
        }
      };
    },

    /* =========================================================
       IA · campo ASCII: ECOSISTEMA ↔ DROPI, con nombres de IA de
       fondo; en el paso 2 llueve código y aparece MCP
       ========================================================= */
    ascii(el) {
      const cv = $('.ascii-field', el), ctx = cv.getContext('2d');
      const cap0 = $('.ai-cap--0', el), cap1 = $('.ai-cap--1', el);
      const RAMP = '.:-=+*x%#@', RAIN = '01<>/{}[]=+*#%x$&';
      const CH = [...new Set((RAMP + RAIN).split(''))], CI = {}; CH.forEach((c, i) => { CI[c] = i; });
      const COL = ['rgba(255,255,255,.26)', '#9a4e10', '#ff8405', '#ffc48a', '#fff4e8'];
      const C = CONFIG.ai;
      let W = 0, H = 0, cw = 8, chh = 12, cols = 0, rows = 0, dpr = 1, atlas = null, aw = 0, ah = 0;
      let rnd = null, rain = [], masks = {}, ready = false;
      let wordA = '', wordB = C.words[0], T = 0, wi = 0, wt = 0, aiI = 0, aiT = 0;

      function makeMask(text, o) {
        const m = new Float32Array(cols * rows); if (!text) return m;
        const c = document.createElement('canvas'); c.width = cols; c.height = rows;
        const g = c.getContext('2d');
        const fam = `"Tusker Grotesk", "Arial Narrow", sans-serif`;   // Tusker Grotesk 3500 Medium
        g.font = `${o.weight} 100px ${fam}`;
        const mt = g.measureText(text), w100 = mt.width, h100 = (mt.actualBoundingBoxAscent + mt.actualBoundingBoxDescent) || 72;
        const fs = Math.min(W * o.fit / w100 * 100, H * o.h / h100 * 100);
        g.setTransform(1 / cw, 0, 0, 1 / chh, 0, 0);
        g.font = `${o.weight} ${fs}px ${fam}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        const m2 = g.measureText(text), asc = m2.actualBoundingBoxAscent, des = m2.actualBoundingBoxDescent;
        g.fillStyle = '#fff'; g.fillText(text, W / 2, H * o.y + (asc - des) / 2);
        if (o.stroke) { g.strokeStyle = '#fff'; g.lineWidth = fs * o.stroke; g.lineJoin = 'round'; g.strokeText(text, W / 2, H * o.y + (asc - des) / 2); }
        const d = g.getImageData(0, 0, cols, rows).data;
        for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] / 255;
        return m;
      }
      function build() {
        W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
        cw = W < 861 ? 6 : 8; chh = Math.round(cw * 1.5);
        cols = Math.ceil(W / cw); rows = Math.ceil(H / chh);
        dpr = Math.min(2, devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        aw = Math.ceil(cw * dpr); ah = Math.ceil(chh * dpr);
        atlas = document.createElement('canvas'); atlas.width = aw * CH.length; atlas.height = ah * COL.length;
        const a = atlas.getContext('2d');
        a.font = `600 ${(chh * .9 * dpr).toFixed(1)}px ui-monospace, Menlo, Consolas, "Courier New", monospace`; a.textAlign = 'center'; a.textBaseline = 'middle';
        COL.forEach((col, y) => { a.fillStyle = col; CH.forEach((chr, x) => a.fillText(chr, x * aw + aw / 2, y * ah + ah / 2 + dpr)); });
        rnd = new Float32Array(cols * rows); for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
        rain = Array.from({ length: cols }, () => ({ y: Math.random() * rows * 2 - rows, sp: 9 + Math.random() * 22, len: 6 + Math.random() * 22 }));
        masks = {};
        const mob = W < 861;
        [...C.words].forEach(w => { masks[w] = makeMask(w, { weight: 400, fit: mob ? .94 : .8, h: mob ? .24 : .44, y: .46, stroke: .018 }); });
        masks.MCP = makeMask('MCP', { weight: 400, fit: .7, h: mob ? .34 : .6, y: .44, stroke: .02 });
        C.ais.forEach(w => { masks[w] = makeMask(w, { weight: 400, fit: .97, h: .9, y: .5 }); });
        masks[''] = new Float32Array(cols * rows);
        ready = true;
      }
      if (document.fonts) Promise.all([document.fonts.load('400 100px "Tusker Grotesk"')]).then(() => { if (W) build(); }).catch(() => {});

      return {
        live: true, build,
        enter() { wordA = ''; wordB = C.words[0]; T = 0; wi = 0; wt = 0; },
        update(p, e, dt) {
          if (!ready) build(); if (!ready) return;
          const t = time, kr = eio(seg(p, .05, .8));
          /* ciclo de palabras */
          const target = kr > .3 ? 'MCP' : C.words[wi % C.words.length];
          if (kr <= .3) { wt += dt; const hold = wi % C.words.length === 0 ? 4.4 : 3.2; if (T >= 1 && wt > hold) { wi++; wt = 0; } }
          if (target !== wordB) { wordA = T >= .5 ? wordB : wordA; wordB = target; T = 0; }
          T = Math.min(1.2, T + dt / 1.25);
          /* nombres de IA de fondo */
          aiT += dt; if (aiT > 4.6) { aiT = 0; aiI++; }
          const aiA = (1 - kr) * Math.min(1, aiT / .9) * Math.min(1, (4.6 - aiT) / .9) * .55;
          const mA = masks[wordA] || masks[''], mB = masks[wordB] || masks[''], mAI = masks[C.ais[aiI % C.ais.length]];
          /* lluvia */
          if (kr > .01) rain.forEach(r => { r.y += r.sp * dt; if (r.y - r.len > rows) { r.y = -Math.random() * rows * .6; r.sp = 9 + Math.random() * 22; r.len = 6 + Math.random() * 22; } });

          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
          const ccx = W / 2, ccy = H * .46, Rf = lerp(Math.min(W, H) * .52, Math.hypot(W, H) * .7, kr) * lerp(.5, 1, eo(e));
          const mxp = hasMouse ? px - cv.getBoundingClientRect().left : -9999, myp = hasMouse ? py - cv.getBoundingClientRect().top : -9999;
          const tk = Math.floor(t * 7);
          for (let j = 0; j < rows; j++) {
            const y = (j + .5) * chh, dy = y - ccy;
            for (let i = 0; i < cols; i++) {
              const idx = j * cols + i, r = rnd[idx], x = (i + .5) * cw, dx = x - ccx, d = Math.sqrt(dx * dx + dy * dy);
              let ch = -1, col = 0;
              // palabra principal (formación de letras)
              const th = .08 + .78 * (i / cols * .55 + r * .45);
              const a0 = mA[idx], b0 = mB[idx], wv = T > th ? b0 : a0, scr = Math.abs(T - th) < .07 && (a0 > .3 || b0 > .3);
              if (scr) { ch = CI['@#%x*+'[(r * 6 + tk) % 6 | 0]]; col = 3; }
              else if (wv > .3) {
                const dn = .55 + .45 * wv * (.85 + .15 * Math.sin(t * 3 + r * 9));
                ch = CI[RAMP[Math.min(9, 5 + Math.floor(dn * 5))]]; col = r < .18 ? 2 : (dn > .86 ? 4 : 3);
                if (kr > .05) { const rr = rain[i], q = (rr.y - j) / rr.len; if (q >= 0 && q < .25) col = 4; }
              } else {
                // campo de ondas (círculo) + nombres de IA + cursor + lluvia
                const fall = 1 - clamp((d - Rf * .7) / (Rf * .3)), ang = Math.atan2(dy, dx);
                const ring = .5 + .5 * Math.sin(d * .034 - t * 1.7), arcs = .5 + .5 * Math.cos(2 * ang + t * .45 - d * .005);
                let dn = fall > 0 ? fall * (.08 + .55 * ring * ring * (.35 + .65 * arcs)) : 0;
                if (mxp > -999) { const md = Math.hypot(x - mxp, y - myp); if (md < 140) dn += Math.pow(1 - md / 140, 2) * .55; }
                const ai = mAI ? mAI[idx] * aiA : 0;
                let rv = 0;
                if (kr > .01) { const rr = rain[i], q = (rr.y - j) / rr.len; if (q >= 0 && q <= 1) rv = (1 - q) * kr; }
                if (rv > dn * .8 && rv > ai * .7 && rv > .05) {
                  ch = CI[RAIN[(r * 97 + tk + i) % RAIN.length | 0]]; col = rv > .93 ? 4 : rv > .55 ? 3 : rv > .25 ? 2 : 1;
                } else if (ai > .12 && ai * .8 > dn) {
                  ch = CI[RAMP[Math.min(5, 1 + Math.floor(ai * 6))]]; col = ai > .45 && r < .3 ? 1 : 0;
                } else if (dn > .06) {
                  ch = CI[RAMP[Math.min(9, Math.floor(dn * 10))]]; col = dn < .3 ? 0 : dn < .55 ? 2 : 3;
                }
              }
              if (ch < 0) continue;
              ctx.drawImage(atlas, ch * aw, col * ah, aw, ah, Math.round(i * cw * dpr), Math.round(j * chh * dpr), aw, ah);
            }
          }
          op(cap0, seg(e, .45, 1) * (1 - seg(p, .02, .3)), `translateX(-50%) translateY(${((1 - seg(e, .45, 1)) * 16).toFixed(1)}px)`);
          op(cap1, seg(p, .55, 1), `translateX(-50%) translateY(${((1 - seg(p, .55, 1)) * 16).toFixed(1)}px)`);
        }
      };
    },

    /* ===== 6 · solo foto con parallax ===== */
    photo() { return { live: true, update() {} }; },

    /* ===== Dropi Pro · tiempos de entrega ===== */
    times(el) {
      const rows = $$('.eta-list li', el);
      rows.forEach(r => { r.style.setProperty('--a', r.dataset.a); r.style.setProperty('--b', r.dataset.b); });
      return {
        update(p, e) { rows.forEach((r, i) => r.style.setProperty('--k', eio(seg(e, .45 + i * .03, .8 + i * .03)).toFixed(4))); }
      };
    },

    /* ===== Dropi Pro · % de entrega ===== */
    rates(el) {
      const rows = $$('.rates-list li', el);
      rows.forEach(r => {
        const i = $('.rb i', r), a = +r.dataset.a, b = +r.dataset.b;
        i.style.setProperty('--l', `${((a - 40) / 60 * 100).toFixed(2)}%`);
        i.style.setProperty('--w', `${Math.max(1.5, (b - a) / 60 * 100).toFixed(2)}%`);
      });
      return {
        update(p, e) { rows.forEach((r, i) => $('.rb i', r).style.setProperty('--k', eio(seg(e, .4 + i * .04, .8 + i * .04)).toFixed(4))); }
      };
    }
  };

  /* ---------------------------------------------------------
     Fotos reemplazables con parallax
     --------------------------------------------------------- */
  $$('.photo[data-src]').forEach(ph => {
    const img = new Image();
    const abs = new URL(ph.dataset.src, location.href).href;   // ruta absoluta: las url() en variables CSS se resuelven desde el CSS
    img.onload = () => { ph.style.setProperty('--img', `url("${abs}")`); ph.classList.add('is-loaded'); };
    img.src = ph.dataset.src;
  });

  /* Entradas genéricas: [data-in] (orden de entrada), [data-beat] (aparece en ese paso),
     titulares .reveal (líneas que suben desde una máscara) y parallax de fotos */
  function generic(s) {
    const e = s.e;
    s.ins.forEach(({ el, d, lines }) => {
      const k = eo(seg(e, .12 + d * .1, .62 + d * .1));
      if (lines) { el.style.opacity = 1; lines.forEach((l, j) => { const kk = eo(seg(e, .1 + j * .08, .6 + j * .08)); l.style.transform = `translateY(${((1 - kk) * 108).toFixed(2)}%)`; }); }
      else op(el, k, `translateY(${((1 - k) * 22).toFixed(1)}px)`);
    });
    s.beatEls.forEach(({ el, b }) => {
      const k = seg(s.p, b - .7, b) * seg(e, .5, 1);
      op(el, k, `translateY(${((1 - k) * 16).toFixed(1)}px)`);
    });
    s.photos.forEach(ph => {
      const ent = eo(e);
      ph.sharp.style.transform = `translate3d(${(-mx * 26).toFixed(1)}px,${(-my * 16).toFixed(1)}px,0) scale(${(1.08 + (1 - ent) * .08).toFixed(4)})`;
      ph.blur.style.transform = `translate3d(${(-mx * 12).toFixed(1)}px,${(-my * 8).toFixed(1)}px,0) scale(1.16)`;
    });
  }

  /* ---------------------------------------------------------
     Escenas
     --------------------------------------------------------- */
  const scenes = $$('.scene').map((el, i) => {
    const ctl = controllers[el.dataset.scene] ? controllers[el.dataset.scene](el) : null;
    const beats = (el.dataset.beats || '0').split(',').map(Number);
    return {
      el, i, ctl, beats, p: beats[0], e: 1, tw: [], vis: false,
      curtain: el.dataset.curtain || '', n: el.dataset.n || '',
      ins: $$('[data-in]', el).map(x => ({ el: x, d: +x.dataset.in || 0, lines: x.classList.contains('reveal') ? $$(':scope > span > i', x) : null })),
      beatEls: $$('[data-beat]', el).map(x => ({ el: x, b: +x.dataset.beat })),
      photos: $$('.photo', el).map(x => ({ sharp: $('.photo-sharp', x), blur: $('.photo-blur', x) }))
    };
  });
  const N = scenes.length;
  const sceneOf = node => scenes.findIndex(s => s.el === node || s.el.contains(node));

  /* Capítulos (riel) */
  const railLinks = $$('.rail a');
  const chapters = railLinks.map(a => ({ a, name: $('span', a).textContent.trim(), idx: sceneOf($(a.getAttribute('href'))), beat: +(a.dataset.beat || 0) }));
  const chapterAt = (i, b = 0) => { let c = 0; chapters.forEach((ch, k) => { if (i > ch.idx || (i === ch.idx && b >= ch.beat)) c = k; }); return c; };

  /* Tweens por escena (p = progreso, e = entrada) */
  function tween(s, prop, to, dur, ease = eio) {
    s.tw = s.tw.filter(t => t.prop !== prop);
    if (RM || dur <= 0) { s[prop] = to; return Promise.resolve(); }
    return new Promise(res => s.tw.push({ prop, from: s[prop], to, t0: performance.now(), dur: dur * 1000, ease, res }));
  }
  function runTweens(s, now) {
    if (!s.tw.length) return;
    s.tw = s.tw.filter(t => {
      const k = clamp((now - t.t0) / t.dur);
      s[t.prop] = lerp(t.from, t.to, t.ease(k));
      if (k >= 1) { t.res(); return false; }
      return true;
    });
  }
  const beatDur = dp => clamp(1.3 + Math.abs(dp) * 1.2, 1.4, 2.6);

  /* ---------- Cortina de capítulo ---------- */
  const Curtain = (() => {
    const el = $('.curtain'), word = $('.curtain-word', el), num = $('.curtain-n', el);
    const AG = Antigravity($('.curtain-ag', el));
    let chars = [];
    function set(text, n) {
      word.style.fontSize = '';
      chars = []; word.textContent = '';
      [...text].forEach(chr => {
        const c = document.createElement('span');
        c.className = 'cc'; c.textContent = chr === ' ' ? '\u00a0' : chr;
        word.appendChild(c); chars.push(c);
      });
      num.textContent = n ? `( ${n} )` : '';
      el.classList.add('is-on');
      AG.build();
      if (!isMobile()) {
        const fit = word.clientWidth * .96 / word.scrollWidth;
        if (fit < 1) word.style.fontSize = `${parseFloat(getComputedStyle(word).fontSize) * fit}px`;
      }
    }
    async function cover(text, n) {
      set(text, n);
      const a = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: SOFT, fill: 'forwards' });
      chars.forEach((c, i) => c.animate(
        [{ transform: 'translateY(35%)', opacity: 0, filter: 'blur(10px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }],
        { duration: 1100, delay: 200 + i * 30, easing: SOFT, fill: 'both' }));
      num.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 200, easing: SOFT, fill: 'both' });
      await a.finished;
      await wait(200 + chars.length * 30 + 550);
    }
    async function reveal() {
      chars.forEach((c, i) => c.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-18%)', opacity: 0 }], { duration: 900, delay: i * 16, easing: SOFT, fill: 'forwards' }));
      const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, delay: 300, easing: SOFT, fill: 'forwards' });
      await a.finished;
      el.classList.remove('is-on');
      el.getAnimations({ subtree: true }).forEach(x => x.cancel());
    }
    return { cover, reveal, step: dt => { if (el.classList.contains('is-on')) AG.step(dt); } };
  })();

  /* ---------- HUD: número de escena, sección y pasos ---------- */
  const hudN = $('.hud-n'), hudCh = $('.hud-ch'), hudBeats = $('.hud-beats'), bar = $('.progress i');
  const beatOffset = []; let totalBeats = 0;
  scenes.forEach(s => { beatOffset.push(totalBeats); totalBeats += s.beats.length; });
  let hudShown = -1, curCh = -1;
  const pagerUp = $$('[data-step="-1"]'), pagerDown = $$('[data-step="1"]');
  $$('[data-step]').forEach(b => b.addEventListener('click', () => step(+b.dataset.step)));
  function hud() {
    const s = scenes[cur];
    if (hudShown !== cur) {
      const dir = cur > hudShown ? 1 : -1, old = hudN.lastElementChild, nu = document.createElement('i');
      nu.textContent = pad2(cur + 1);
      hudN.appendChild(nu);
      if (old && !RM && hudShown >= 0) {
        nu.animate([{ transform: `translateY(${dir * 100}%)` }, { transform: 'none' }], { duration: 700, easing: EASE });
        old.animate([{ transform: 'none' }, { transform: `translateY(${-dir * 100}%)` }], { duration: 700, easing: EASE }).finished.then(() => old.remove());
      } else if (old) old.remove();
      hudBeats.innerHTML = s.beats.length > 1 ? s.beats.map(() => '<i></i>').join('') : '';
      hudShown = cur;
    }
    $$('i', hudBeats).forEach((t, k) => t.classList.toggle('is-on', k <= beat));
    const ch = chapterAt(cur, beat);
    if (ch !== curCh) {
      curCh = ch; hudCh.textContent = chapters[ch] ? chapters[ch].name : '';
      railLinks.forEach((a, i) => a.setAttribute('aria-current', i === ch ? 'true' : 'false'));
    }
    bar.style.transform = `scaleX(${(beatOffset[cur] + beat) / Math.max(1, totalBeats - 1)})`;
    pagerUp.forEach(b => { b.disabled = cur === 0 && beat === 0; });
    pagerDown.forEach(b => { b.disabled = cur === N - 1 && beat === scenes[N - 1].beats.length - 1; });
  }

  /* ---------- Navegación ---------- */
  let cur = 0, beat = 0, busy = false, queued = 0;

  function show(s) { s.vis = true; s.el.classList.add('is-vis'); s.el.removeAttribute('inert'); }
  function hide(s) { s.vis = false; s.el.classList.remove('is-vis'); s.el.setAttribute('inert', ''); }
  function done() { busy = false; if (queued) { const q = queued; queued = 0; step(q); } }

  function step(dir) {
    if (busy) { queued = dir; return; }
    const s = scenes[cur];
    if (dir > 0) {
      if (beat < s.beats.length - 1) return toBeat(beat + 1);
      if (cur < N - 1) return toScene(cur + 1, 1);
    } else {
      if (beat > 0) return toBeat(beat - 1);
      if (cur > 0) return toScene(cur - 1, -1);
    }
  }
  function toBeat(b) {
    const s = scenes[cur], to = s.beats[b];
    beat = b; busy = true; hud();
    const custom = s.ctl && s.ctl.beatDur ? s.ctl.beatDur(s.p, to) : 0;
    tween(s, 'p', to, custom || beatDur(to - s.p), eio).then(done);
  }
  function slide(from, to, dir) {
    from.el.style.zIndex = 1; to.el.style.zIndex = 2;
    const D = RM ? 320 : CONFIG.sectionMs;
    const anims = RM
      ? [to.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: D })]
      : [
          to.el.animate([{ opacity: 0, transform: `translateY(${dir * 3}vh) scale(1.008)` }, { opacity: 1, transform: 'none' }],
            { duration: D * .9, delay: D * .1, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' }),
          from.el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${-dir * 2.4}vh) scale(.992)` }],
            { duration: D * .85, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' })
        ];
    return Promise.all(anims.map(a => a.finished)).then(() => {
      anims.forEach(a => a.cancel());
      from.el.style.zIndex = ''; to.el.style.zIndex = '';
    });
  }
  async function toScene(j, dir, opt = {}) {
    if (j < 0 || j >= N) return;
    const from = scenes[cur], to = scenes[j];
    if (j === cur) return;
    busy = true; queued = 0;
    const b = opt.beat != null ? opt.beat : dir > 0 ? 0 : to.beats.length - 1;
    const fresh = opt.fresh || dir > 0;
    to.tw = [];
    if (fresh) { to.p = 0; to.e = 0; if (to.ctl && to.ctl.enter) to.ctl.enter(); } else { to.p = to.beats[b]; to.e = 1; }
    cur = j; beat = b; hud();
    if (to.el.id) history.replaceState(null, '', `#${to.el.id}`);
    const enter = () => fresh
      ? Promise.all([tween(to, 'e', 1, 2.2, eo), tween(to, 'p', to.beats[b], (to.ctl && to.ctl.beatDur && to.beats[b] ? to.ctl.beatDur(0, to.beats[b]) : 0) || beatDur(to.beats[b]))])
      : Promise.resolve();
    const useCurtain = !RM && to.curtain && (opt.curtain || dir > 0);
    if (useCurtain) {
      await Curtain.cover(to.curtain, to.n);
      show(to); hide(from);
      if (to.ctl && to.ctl.build) to.ctl.build();
      await Promise.all([Curtain.reveal(), enter()]);
    } else {
      show(to);
      if (to.ctl && to.ctl.build) to.ctl.build();
      const entering = enter();
      await slide(from, to, dir);
      hide(from);
      await entering;
    }
    done();
  }
  function goTo(j, opt = {}) {
    if (busy || j < 0) return;
    if (j === cur) { const b = opt.beat || 0; if (b !== beat) toBeat(b); return; }
    toScene(j, j > cur ? 1 : -1, { fresh: true, curtain: true, ...opt });
  }

  /* Enlaces internos (#sección) */
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    const j = target ? sceneOf(target) : -1;
    if (j < 0) return;
    e.preventDefault();
    goTo(j, { beat: +(a.dataset.beat || 0) });
  });

  /* ¿Hay un contenedor con scroll propio que aún puede moverse en esa dirección? */
  function scrollable(node, dir) {
    for (let n = node; n && n !== document.body; n = n.parentElement) {
      if (n.hasAttribute && n.hasAttribute('data-scroll') && n.scrollHeight > n.clientHeight + 2) {
        if (dir > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 2 : n.scrollTop > 2) return n;
      }
    }
    return null;
  }

  /* Rueda / trackpad: un gesto = un paso */
  let wAcc = 0, wLast = 0, wFresh = true;
  addEventListener('wheel', e => {
    if (e.ctrlKey) return;
    const now = performance.now();
    if (now - wLast > CONFIG.wheelGap) { wFresh = true; wAcc = 0; }
    wLast = now;
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const d = e.deltaY * k;
    if (scrollable(e.target, Math.sign(d))) return;
    e.preventDefault();
    if (!wFresh) return;
    wAcc += d;
    if (Math.abs(wAcc) > 24) { wFresh = false; wAcc = 0; step(Math.sign(d)); }
  }, { passive: false });

  /* Táctil: swipe vertical u horizontal (fuera del mapa interactivo) */
  let t0 = null;
  addEventListener('touchstart', e => {
    if (e.touches.length > 1 || e.target.closest('[data-drag]')) { t0 = null; return; }
    const t = e.touches[0];
    t0 = { x: t.clientX, y: t.clientY, down: scrollable(e.target, 1), up: scrollable(e.target, -1) };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!t0) return;
    const dy = t0.y - e.touches[0].clientY;
    if (!(dy > 0 ? t0.down : t0.up) && e.cancelable) e.preventDefault();
  }, { passive: false });
  addEventListener('touchend', e => {
    if (!t0) return;
    const t = e.changedTouches[0], dy = t0.y - t.clientY, dx = t0.x - t.clientX, st = t0;
    t0 = null;
    const vertical = Math.abs(dy) >= Math.abs(dx), d = vertical ? dy : dx;
    if (Math.abs(d) < 42) return;
    if (vertical && (dy > 0 ? st.down : st.up)) return;
    step(Math.sign(d));
  }, { passive: true });

  /* Teclado */
  addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key, onBtn = e.target.closest('button, a');
    let d = 0;
    if (k === 'ArrowDown' || k === 'PageDown' || k === 'ArrowRight' || (k === ' ' && !e.shiftKey && !onBtn)) d = 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || k === 'ArrowLeft' || (k === ' ' && e.shiftKey && !onBtn)) d = -1;
    else if (k === 'Home') { e.preventDefault(); goTo(0); return; }
    else if (k === 'End') { e.preventDefault(); goTo(N - 1); return; }
    if (!d) return;
    if ((k === 'ArrowDown' || k === 'ArrowUp') && scrollable(document.activeElement, d)) return;
    e.preventDefault();
    if (e.repeat && busy) return;
    step(d);
  });

  /* ---------------------------------------------------------
     Bucle principal
     --------------------------------------------------------- */
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now; time += dt;
    mx += (tmx - mx) * .06; my += (tmy - my) * .06;
    for (const s of scenes) {
      if (!s.vis) continue;
      runTweens(s, now);
      generic(s);
      if (s.ctl) s.ctl.update(s.p, s.e, dt);
    }
    Curtain.step(dt);
    requestAnimationFrame(frame);
  }

  /* Titulares [data-fit]: si una línea no cabe en su contenedor, se reduce el tamaño hasta que quepa entera */
  function fitTitles() {
    $$('[data-fit]').forEach(h => {
      h.style.fontSize = '';
      if (isMobile()) return;
      const lines = $$(':scope > span > i', h); if (!lines.length) return;
      const host = h.parentElement, avail = Math.min(host.clientWidth, innerWidth - h.getBoundingClientRect().left - 24);
      let maxW = 0;
      lines.forEach(l => { l.style.display = 'inline-block'; maxW = Math.max(maxW, l.getBoundingClientRect().width); l.style.display = ''; });
      if (maxW > avail) h.style.fontSize = `${(parseFloat(getComputedStyle(h).fontSize) * avail / maxW * .98).toFixed(2)}px`;
    });
  }
  function measure() { fitTitles(); scenes.forEach(s => { if (s.ctl && s.ctl.build && s.vis) s.ctl.build(); }); }
  let rz;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(measure, 150); });
  window.DP = { goTo, step, scenes: () => scenes, state: () => ({ cur, beat, busy }) };

  /* Arranque: respeta el #sección de la URL */
  const start = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  cur = start ? Math.max(0, sceneOf(start)) : 0;
  scenes.forEach((s, i) => (i === cur ? show(s) : hide(s)));
  scenes[cur].e = 0;
  tween(scenes[cur], 'e', 1, 2.6, eo);
  measure();
  hud();
  requestAnimationFrame(frame);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { measure(); document.body.classList.add('is-loaded'); });
})();
