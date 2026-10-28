/* =========================================================
   Dropi Acceleration · motor de escenas a pantalla completa
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
     Moneda 3D: capas apiladas en Z (canto) + caras con símbolo
     --------------------------------------------------------- */
  function coinStack(box, o = {}) {
    if (!box) return;
    const T = o.T || 20, N = o.N || 10, g = o.glyph || '€';
    for (let i = 0; i < N; i++) {
      const l = document.createElement('i'); l.className = 'cl cl--side';
      l.style.transform = `translateZ(${(-T / 2 + (T * i) / (N - 1)).toFixed(2)}px)`; box.appendChild(l);
    }
    const front = document.createElement('i'); front.className = 'cl cl--face'; front.innerHTML = `<span>${g}</span>`;
    front.style.transform = `translateZ(${T / 2 + .5}px)`;
    const back = document.createElement('i'); back.className = 'cl cl--face cl--back'; back.innerHTML = `<span>${g}</span>`;
    back.style.transform = `translateZ(${-T / 2 - .5}px) rotateY(180deg)`;
    box.append(front, back);
  }



  /* ---------------------------------------------------------
     ASCII wave de fondo: ondas concéntricas de caracteres que
     salen de un origen; el cursor las agita
     --------------------------------------------------------- */
  function AsciiWave(cv, o = {}) {
    const ctx = cv.getContext('2d');
    const RAMP = '.:-=+*x%#@', COL = ['rgba(255,255,255,.2)', '#7a3e0c', '#ff8405', '#ffc48a'];
    let W = 0, H = 0, cw = 9, chh = 14, cols = 0, rows = 0, dpr = 1, atlas = null, aw = 0, ah = 0, rnd = null;
    function build() {
      W = cv.clientWidth; H = cv.clientHeight; if (!W || !H) return;
      cw = W < 861 ? 7 : 9; chh = Math.round(cw * 1.55);
      cols = Math.ceil(W / cw); rows = Math.ceil(H / chh);
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      aw = Math.ceil(cw * dpr); ah = Math.ceil(chh * dpr);
      atlas = document.createElement('canvas'); atlas.width = aw * RAMP.length; atlas.height = ah * COL.length;
      const a = atlas.getContext('2d');
      a.font = `600 ${(chh * .85 * dpr).toFixed(1)}px ui-monospace, Menlo, Consolas, "Courier New", monospace`; a.textAlign = 'center'; a.textBaseline = 'middle';
      COL.forEach((c, y) => { a.fillStyle = c; [...RAMP].forEach((ch, x) => a.fillText(ch, x * aw + aw / 2, y * ah + ah / 2 + dpr)); });
      rnd = new Float32Array(cols * rows); for (let i = 0; i < rnd.length; i++) rnd[i] = Math.random();
    }
    function draw(t, alpha = 1) {
      if (!W) build(); if (!W) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      if (alpha < .01) return;
      ctx.globalAlpha = alpha;
      const ox = W * (o.x ?? .5), oy = H * (o.y ?? .5), maxD = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
      const r = cv.getBoundingClientRect(), mxp = hasMouse ? px - r.left : -9999, myp = hasMouse ? py - r.top : -9999;
      const sp = RM ? 0 : 1;
      for (let j = 0; j < rows; j++) {
        const y = (j + .5) * chh, dy = y - oy;
        for (let i = 0; i < cols; i++) {
          const x = (i + .5) * cw, dx = x - ox, d = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx);
          const ring = .5 + .5 * Math.sin(d * .03 - t * 1.6 * sp);
          const arcs = .5 + .5 * Math.cos(3 * ang + t * .35 * sp + d * .004);
          const swell = .5 + .5 * Math.sin(x * .006 + y * .004 + t * .5 * sp);
          let dn = (.05 + .62 * ring * ring * (.3 + .7 * arcs)) * (.55 + .45 * swell) * (1 - .55 * d / maxD);
          if (mxp > -999) { const md = Math.hypot(x - mxp, y - myp); if (md < 150) dn += Math.pow(1 - md / 150, 2) * .5; }
          dn += (rnd[j * cols + i] - .5) * .06;
          if (dn < .1) continue;
          const ci = Math.min(9, Math.floor(dn * 10)), col = dn < .32 ? 0 : dn < .5 ? 1 : dn < .7 ? 2 : 3;
          ctx.drawImage(atlas, ci * aw, col * ah, aw, ah, Math.round(i * cw * dpr), Math.round(j * chh * dpr), aw, ah);
        }
      }
      ctx.globalAlpha = 1;
    }
    return { build, draw };
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

  /* Logo Dropi (isotipo) en línea, para la caja de importación */
  const DROPI_LOGO = `<svg class="box-logo" viewBox="0 0 1050.34 1048.79" aria-hidden="true"><path d="M311.41,254.79c.45.3,0,0-.55-.35-47.93-27.33-95.86-54.66-143.69-82.09-2.61-1.51-4.07-1.16-5.88.85-15.78,17.18-32.1,33.86-47.18,51.55-10.95,12.86-20.25,27.13-30.45,40.69-.95,1.31-2.81,1.91-4.27,2.86-1-1.61-2.31-3.06-2.96-4.82-.5-1.41-.25-3.06-.25-4.62-.2-24.72-.15-49.49-.7-74.21-.15-6.38,1.76-10.55,6.73-14.62,18.44-15.07,22.91-38.69,11.91-59.69-9.85-18.74-31.2-29.29-50.69-25.07-20.4,4.42-35.97,21.25-39.34,42.45-3.01,19.14,6.53,37.83,24.92,48.18,4.02,2.26,5.68,4.82,5.63,9.55-.15,58.63-.1,117.26-.15,175.89,0,2.56-.5,5.28-1.46,7.64-15.52,38.23-25.37,77.87-30.14,118.82-6.08,52.6-2.31,104.6,9.09,156.15,18.99,86.01,60.04,160.12,120.88,223.32,53.96,56.07,117.71,97.67,190.31,125.65,39.74,15.32,80.79,25.67,123.09,30.75,15.12,1.81,30.35,3.32,45.47-.25,56.62-13.31,102.34-43.71,139.02-88.32.55-.65.85-1.51,1.51-2.61-1.21-.1-1.96-.25-2.71-.25-17.38-.6-34.82-1.21-52.2-1.81-1.71-.05-3.47-.05-5.07-.55-2.86-.85-3.82-2.71-1.71-5.17,1.51-1.76,3.32-3.27,5.17-4.72,38.69-30.09,76.47-61.19,110.28-96.91,9.24-9.75,9.14-9.5,18.29.5,24.47,26.68,49.14,53.26,73.75,79.78,4.42,4.77,3.92,7.99-2.41,10.25-14.17,5.07-28.34,10.35-42.7,14.77-6.63,2.06-10.5,5.88-13.82,11.81-11.66,20.9-23.81,41.5-35.82,62.2-1.36,2.36-2.91,4.62-5.02,7.89,4.17-1.26,7.23-2.26,10.3-3.11,72.65-20.65,138.11-54.76,195.03-104.8,70.04-61.54,119.42-136.5,146.15-225.93,21.25-71.09,25.72-143.64,14.92-216.94-10.55-71.59-36.27-137.76-76.06-198.15-44.11-67.02-100.98-121.03-169.71-162.53-57.63-34.82-119.57-57.63-186.04-68.38-50.99-8.24-101.99-9.8-153.23-2.71-51.9,7.18-101.79,21.2-149.42,43.11-9.34,4.32-18.49,8.99-28.34,13.82,3.37,1.86,5.83,3.11,8.19,4.57,44.76,26.58,89.53,53.15,134.19,79.83,2.66,1.56,4.77,1.81,7.69.6,53-22.66,108.87-32.36,166.05-34.87,48.13-2.16,95.56,2.96,142.23,15.37,48.58,12.91,92.14,35.02,129.92,68.38,35.52,31.35,62.5,68.98,82.8,111.53,20,41.9,31.7,86.21,37.23,132.13,6.33,52.6,5.02,104.9-8.74,156.4-19.34,72.35-63,123.59-132.84,151.73-41.8,16.83-85.76,23.86-130.48,26.63-36.68,2.31-73.3,2.11-109.98-.6-42.25-3.11-83.4-11.15-123.54-24.67-46.72-15.73-89.53-38.53-126.91-71.04-6.53-5.68-12.71-11.71-19.29-17.84-.75,1.26-1.36,2.31-1.96,3.37-12.66,22.36-27.88,42.75-48.08,58.93-43.76,35.02-92.44,44.46-143.99,21.35-44.31-19.85-73.25-55.47-89.93-100.98-.8-2.26-1.21-4.67-1.81-6.98,1.96,1.26,3.06,2.86,4.07,4.52,14.37,23.06,32.15,42.81,56.17,56.07,49.94,27.53,98.92,24.92,146.2-6.28,32.51-21.45,52.8-52.65,66.47-88.37,13.97-36.47,17.94-74.46,14.87-113.24-2.61-33.36-12.06-64.61-29.29-93.4-13.51-22.56-31.2-41.4-51.95-57.43-2.06-1.61-4.32-2.91-3.06-6.38,6.98-19.29,14.12-38.58,25.17-55.97,9.39-14.77,19.9-28.84,29.94-43.31l.2.1ZM589.44,505.74c-.45-5.12-.7-11.81-1.61-18.44-2.51-17.79-7.94-34.47-19.54-48.63-14.17-17.23-34.62-23.31-53.31-15.52-13.82,5.78-23.16,16.28-29.99,29.34-12.76,24.37-15.12,50.29-11.25,77.02,2.41,16.68,8.14,32.2,18.84,45.52,8.09,10.05,17.94,17.68,31.15,19.64,17.28,2.56,31.1-4.37,42.2-16.93,17.74-20.1,22.81-44.61,23.56-72.05l-.05.05ZM910.78,501.37c-.1-8.49-1.61-23.16-6.53-37.23-4.17-12.01-9.45-23.36-19.59-31.7-11.35-9.29-25.32-9.7-36.07.15-5.73,5.28-11.25,11.56-14.52,18.54-17.13,36.37-17.84,73.45-2.26,110.58,3.57,8.49,9.04,15.98,16.68,21.55,10.4,7.59,20.75,8.04,31.7,1.21,7.74-4.82,13.16-11.76,17.48-19.64,9.7-17.79,13.21-37.03,13.11-63.4v-.05ZM303.12,366.67c.4,0,.85.1,1.26.15,7.39-10.55,14.42-21.4,22.26-31.55,27.18-35.22,59.84-63.91,100.78-82.34,31.75-14.32,65.26-21.9,99.53-26.68,18.29-2.56,22.71-8.44,21.1-26.83-.75-8.59-5.17-14.12-13.11-16.08-5.78-1.41-12.01-1.76-17.99-1.46-18.44.9-36.32,4.82-53.71,10.9-78.22,27.28-129.52,81.24-156.7,158.91-1.71,4.82-2.36,10-3.47,15.02l.05-.05ZM198.47,139.34c2.56,1.51,4.42,2.61,6.23,3.67,45.32,26.48,90.63,52.95,135.9,79.58,2.61,1.56,3.87.4,5.63-.9,9.75-7.49,19.49-14.92,29.29-22.31,1.56-1.16,3.22-2.16,5.12-3.47-48.13-28.39-95.76-56.42-143.79-84.76-12.61,9.29-25.17,18.54-38.33,28.24l-.05-.05Z"/><path d="M290.21,521.37c-.65,39.99-10.55,78.38-35.17,112.09-14.92,20.45-33.56,36.47-58.43,43.26-35.62,9.7-67.57,1.06-95.16-22.66-30.09-25.82-46.37-59.43-52-98.32-5.38-36.93-2.56-73.2,11.15-108.17,10.05-25.67,25.12-47.68,47.38-64.51,42.3-31.95,88.67-26.23,125.2,2.06,25.32,19.59,39.74,46.42,48.63,76.57,5.63,19.04,8.14,38.58,8.39,59.69h0Z"/></svg>`;

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

    /* =========================================================
       MOMENTO 2 · Dropi Acceleration (titular con partículas)
       ========================================================= */
    accel(el) {
      const AG = Antigravity($('.accel-ag', el)), sub = $('.accel-sub', el);
      const chars = [];
      $$('.accel-l', el).forEach(l => {
        const txt = l.textContent; l.textContent = ''; l.setAttribute('aria-label', txt);
        [...txt].forEach(chr => { const s = document.createElement('span'); s.className = 'cc'; s.textContent = chr === ' ' ? '\u00a0' : chr; s.setAttribute('aria-hidden', 'true'); l.appendChild(s); chars.push(s); });
      });
      return {
        live: true, build: () => AG.build(),
        update(p, e, dt) {
          AG.step(dt);
          chars.forEach((c, i) => {
            const k = eo(seg(e, .08 + i * .025, .5 + i * .025));
            c.style.opacity = k; c.style.transform = `translateY(${((1 - k) * 35).toFixed(1)}%)`;
            c.style.filter = k < .99 ? `blur(${((1 - k) * 10).toFixed(1)}px)` : '';
          });
          op(sub, seg(e, .55, 1), `translateY(${((1 - seg(e, .55, 1)) * 14).toFixed(1)}px)`);
        }
      };
    },

    /* ===== 2 · Moneda que se parte en dos mitades ===== */
    coin(el) {
      const coin = $('.coin', el), halves = $$('.coin-half', el), lbls = $$('.coin-lbl', el);
      const bar = $('.example-bar i', el), count = $('.example .count', el), scene = $('.coin-scene', el);
      const T = 26, N = 9;
      const face = `<circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="76" class="thin"/>
        <path class="thin" d="M100 8v184"/>
        <path d="M128 66c-6-8-15-12-25-12-21 0-35 17-35 46s14 46 35 46c10 0 19-4 25-12M56 88h50M56 112h50"/>`;
      halves.forEach((h, side) => {
        for (let i = 0; i < N; i++) {
          const z = -T / 2 + (T * i) / (N - 1), edge = i === N - 1;
          const sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          sv.setAttribute('viewBox', '0 0 200 200'); sv.innerHTML = face;
          sv.setAttribute('class', 'coin-line' + (edge ? ' is-face' : ''));
          sv.style.setProperty('--d', (1 - Math.abs(z) / (T / 2)).toFixed(3));
          const back = i === 0;
          sv.style.transform = `translateZ(${z.toFixed(2)}px)${back ? ' rotateY(180deg)' : ''}`;
          sv.style.clipPath = (side === 0) !== back ? 'inset(-4% 50% -4% -4%)' : 'inset(-4% -4% -4% 50%)';
          h.appendChild(sv);
        }
      });
      let ang = 0;
      return {
        live: true,
        update(p, e, dt) {
          const split = eio(seg(p, .08, .9)), ent = eo(e);
          const speed = RM ? 0 : lerp(46, 0, split);
          ang += speed * dt;
          if (split > .02) { const target = Math.round(ang / 360) * 360 + (RM ? 0 : Math.sin(time * .9) * 12); ang += (target - ang) * Math.min(1, dt * 2.6 * split); }
          coin.style.transform = `scale(${lerp(.6, 1, ent).toFixed(3)}) rotateX(${(14 - my * 8).toFixed(2)}deg) rotateY(${(ang + mx * 12).toFixed(2)}deg)`;
          const w = scene.clientWidth;
          halves[0].style.transform = `translateX(${(-split * w * .2).toFixed(1)}px) translateY(${(-split * 10).toFixed(1)}px) rotateZ(${(-split * 8).toFixed(2)}deg)`;
          halves[1].style.transform = `translateX(${(split * w * .2).toFixed(1)}px) translateY(${(split * 10).toFixed(1)}px) rotateZ(${(split * 8).toFixed(2)}deg)`;
          lbls.forEach(l => op(l, seg(p, .55, 1), `translateY(${(1 - seg(p, .55, 1)) * 16}px)`));
          const k = eio(seg(p, .25, 1));
          bar.style.transform = `scaleX(${k.toFixed(4)})`;
          count.textContent = fmt(3000 * k);
          scene.style.opacity = ent;
        }
      };
    },

    /* ===== 3 · Barras isométricas que crecen ===== */
    bars(el) {
      const iso = $('.iso', el);
      const N = 7, bars = [];
      for (let i = 0; i < N; i++) {
        const c = document.createElement('div'); c.className = 'cube' + (i >= N - 2 ? ' is-hot' : '');
        c.innerHTML = '<i class="f-top"></i><i class="f-a f-y0"></i><i class="f-a f-y1"></i><i class="f-b f-x0"></i><i class="f-b f-x1"></i>';
        iso.appendChild(c);
        bars.push({ el: c, f: $$('i', c) });
      }
      let S = 0;
      const build = () => { S = iso.clientWidth; };
      function cube(b, x, y, w, d, h) {
        b.el.style.transform = `translate3d(${x}px,${y}px,0)`;
        const [t, y0, y1, x0, x1] = b.f;
        Object.assign(t.style, { width: `${w}px`, height: `${d}px`, transform: `translateZ(${h.toFixed(1)}px)` });
        Object.assign(y0.style, { width: `${w}px`, height: `${h.toFixed(1)}px`, transform: 'rotateX(90deg)' });
        Object.assign(y1.style, { width: `${w}px`, height: `${h.toFixed(1)}px`, transform: `translateY(${d}px) rotateX(90deg)` });
        Object.assign(x0.style, { width: `${d}px`, height: `${h.toFixed(1)}px`, transform: 'rotateZ(90deg) rotateX(90deg)' });
        Object.assign(x1.style, { width: `${d}px`, height: `${h.toFixed(1)}px`, transform: `translateX(${w}px) rotateZ(90deg) rotateX(90deg)` });
      }
      return {
        live: true, build,
        update(p, e) {
          if (!S) build(); if (!S) return;
          const w = S * .095, gap = S * .128, extra = eio(seg(p, .1, 1));
          bars.forEach((b, i) => {
            const grow = eo(seg(e, .25 + i * .06, .75 + i * .06));
            let h = S * (.08 + i * .07) * grow;
            if (i >= N - 2) h *= 1 + extra * (i === N - 1 ? .75 : .35) + (RM ? 0 : Math.sin(time * 1.4 + i) * .02 * extra);
            cube(b, S * .06 + i * gap, S * .44, w, w, h);
          });
          iso.style.transform = `rotateX(${(58 - my * 4).toFixed(2)}deg) rotateZ(${(-42 + mx * 6).toFixed(2)}deg)`;
        }
      };
    },

    /* ===== 4 · Caja de importación que flota y gira ===== */
    box(el) {
      const obj = $('.box-obj', el), scene = $('.box-scene', el), ring = $('.ring-fg', el), count = $('.box-days .count', el), days = $('.box-days', el);
      const faces = ['front', 'back', 'side', 'side', 'top', 'side'].map((n, i) => {
        const f = document.createElement('i'); f.className = `f f--${n}${i === 1 ? ' f--back' : ''}`; if (i < 2) f.innerHTML = DROPI_LOGO; obj.appendChild(f); return f;
      });
      let ang = 20;
      const build = () => {
        const S = scene.clientWidth, w = S * .74, h = S * .56, d = S * .6;
        const set = (f, W, H, tr) => Object.assign(f.style, { width: `${W}px`, height: `${H}px`, left: `${-W / 2}px`, top: `${-H / 2}px`, transform: tr });
        set(faces[0], w, h, `translateZ(${d / 2}px)`);
        set(faces[1], w, h, `rotateY(180deg) translateZ(${d / 2}px)`);
        set(faces[2], d, h, `rotateY(90deg) translateZ(${w / 2}px)`);
        set(faces[3], d, h, `rotateY(-90deg) translateZ(${w / 2}px)`);
        set(faces[4], w, d, `rotateX(90deg) translateZ(${h / 2}px)`);
        set(faces[5], w, d, `rotateX(-90deg) translateZ(${h / 2}px)`);
      };
      return {
        live: true, build,
        update(p, e, dt) {
          if (!faces[0].style.width) build();
          ang += (RM ? 0 : 16) * dt;
          const ent = eo(e), fl = RM ? 0 : Math.sin(time * 1.3) * 8;
          obj.style.transform = `translateY(${(fl - (1 - ent) * 60).toFixed(1)}px) rotateX(${(-24 + my * 6).toFixed(2)}deg) rotateY(${(ang + mx * 16).toFixed(2)}deg) scale(${lerp(.7, 1, ent).toFixed(3)})`;
          scene.style.opacity = ent;
          const k = eio(seg(p, .15, 1));
          ring.style.strokeDashoffset = (553 * (1 - k)).toFixed(1);
          count.textContent = Math.round(30 * k);
          op(days, seg(e, .5, 1));
        }
      };
    },

    /* ===== 5 · 0 € en 3D sobre foto con parallax ===== */
    zero(el) {
      const num = $('.num3d', el), face = $('.num3d-face', el), cap = $('.zero-cap', el);
      for (let i = 16; i >= 1; i--) {
        const l = document.createElement('span'); l.className = 'layer'; l.style.setProperty('--i', i); l.textContent = face.textContent; l.setAttribute('aria-hidden', 'true');
        l.style.padding = '.12em .06em .1em'; num.insertBefore(l, face);
      }
      return {
        live: true,
        update(p, e) {
          const ent = eo(e);
          num.style.transform = `translateY(${((1 - ent) * 40).toFixed(1)}px) rotateX(${(8 - my * 10).toFixed(2)}deg) rotateY(${(-14 + mx * 18 + (RM ? 0 : Math.sin(time * .5) * 6)).toFixed(2)}deg) scale(${lerp(.85, 1, ent).toFixed(3)})`;
          num.style.opacity = ent;
          op(cap, seg(e, .5, 1));
        }
      };
    },

    /* ===== 6 · solo foto con parallax ===== */
    photo() { return { live: true, update() {} }; },

    /* ===== 7 · Anillo de temas semanales ===== */
    week(el) {
      const ring = $('.week-ring', el), tiles = $$('.wk', el), n = tiles.length;
      let R = 0, ang = 0, front = -1;
      const build = () => {
        const w = ring.clientWidth; R = (w / 2) / Math.tan(Math.PI / n) * 1.12;
        tiles.forEach((t, i) => { t.style.transform = `rotateY(${(i * 360 / n).toFixed(2)}deg) translateZ(${R.toFixed(1)}px)`; });
      };
      return {
        live: true, build,
        update(p, e, dt) {
          if (!R) build();
          ang += (RM ? 0 : 12) * dt;
          const a = ang + mx * 16, ent = eo(e);
          ring.style.transform = `translateZ(${(-R * .4 - (1 - ent) * 300).toFixed(1)}px) rotateX(${(-10 + my * 5).toFixed(2)}deg) rotateY(${(-a).toFixed(2)}deg)`;
          ring.style.opacity = ent;
          let best = 0, bd = 1e9;
          tiles.forEach((t, i) => {
            const d = ((i * 360 / n - a) % 360 + 540) % 360 - 180;
            if (Math.abs(d) < bd) { bd = Math.abs(d); best = i; }
            t.style.opacity = (.12 + .88 * Math.pow((Math.cos(d * Math.PI / 180) + 1) / 2, 2)).toFixed(3);
          });
          if (best !== front) { if (front >= 0) tiles[front].classList.remove('is-front'); front = best; tiles[front].classList.add('is-front'); }
        }
      };
    },

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
    },

    /* ===== 9 · Go Verify: pedidos que se confirman en vivo ===== */
    verify(el) {
      const phone = $('.phone', el), list = $('.phone-list', el), num = $('.phone-count b', el), bar = $('.phone-bar i', el);
      const bgCv = $('.ascii-bg', el), bg = bgCv ? AsciiWave(bgCv, { x: .7, y: .52 }) : null;
      const cities = ['Madrid', 'Lisboa', 'Bucarest', 'Varsovia', 'Praga', 'Budapest', 'Zagreb', 'Liubliana', 'Bratislava', 'Atenas', 'Sofía', 'Sevilla', 'Oporto', 'Cracovia', 'Valencia'];
      let n = 0, acc = 0, id = 4810;
      function add() {
        if (n >= 100) return;
        const li = document.createElement('li');
        li.innerHTML = `<span><b>Pedido ${++id}</b>${cities[id % cities.length]}</span><em>Confirmando</em>`;
        list.prepend(li);
        setTimeout(() => { li.classList.add('is-ok'); $('em', li).textContent = 'Confirmado'; n++; num.textContent = n; bar.style.transform = `scaleX(${n / 100})`; }, 700);
        while (list.children.length > 7) list.lastElementChild.remove();
      }
      return {
        live: true,
        build() { if (bg) bg.build(); },
        update(p, e, dt) {
          const ent = eo(e);
          if (bg) { bg.draw(time, ent); bgCv.style.opacity = 1; }
          phone.style.transform = `translateY(${((1 - ent) * 60).toFixed(1)}px) rotateY(${(-18 + mx * 10).toFixed(2)}deg) rotateX(${(6 - my * 8).toFixed(2)}deg)`;
          phone.style.opacity = ent;
          if (e > .7) { acc += dt * (n < 12 ? 2.2 : 1.1); if (acc > 1) { acc = 0; add(); } }
        }
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
