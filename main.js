'use strict';

/* ── Grain ──────────────────────────────────────────────────── */
function grain() {
  const cv = document.createElement('canvas');
  Object.assign(cv.style, {
    position: 'fixed', inset: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '9990',
    opacity: '0.04', mixBlendMode: 'overlay'
  });
  document.body.appendChild(cv);

  const ctx = cv.getContext('2d');
  let w, h;

  function resize() {
    w = cv.width  = window.innerWidth;
    h = cv.height = window.innerHeight;
  }

  function tick() {
    const img = ctx.createImageData(w, h);
    const d   = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  tick();
}

/* ── Particles ──────────────────────────────────────────────── */
function particles() {
  const cv = document.getElementById('particles');
  if (!cv) return;

  const ctx   = cv.getContext('2d');
  const MOUSE = { x: -2000, y: -2000 };
  const COUNT = 55;
  let w, h, pts = [];

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    w = cv.width  = r.width;
    h = cv.height = r.height;
  }

  class Pt {
    constructor() { this.init(); }

    init() {
      this.x  = Math.random() * w;
      this.y  = Math.random() * h;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = (Math.random() - 0.5) * 0.35;
      this.r  = Math.random() * 1.8 + 0.4;
      this.a  = Math.random() * 0.45 + 0.08;
    }

    update() {
      const dx   = this.x - MOUSE.x;
      const dy   = this.y - MOUSE.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 130 && dist > 0) {
        const f = ((130 - dist) / 130) * 0.9;
        this.vx += (dx / dist) * f;
        this.vy += (dy / dist) * f;
      }

      this.vx *= 0.972;
      this.vy *= 0.972;
      this.x  += this.vx;
      this.y  += this.vy;

      if (this.x < -10 || this.x > w + 10 || this.y < -10 || this.y > h + 10) this.init();
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,168,0,${this.a})`;
      ctx.fill();
    }
  }

  function init() {
    pts = Array.from({ length: COUNT }, () => new Pt());
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < pts.length; i++) {
      pts[i].update();
      pts[i].draw();

      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(240,168,0,${(1 - d / 110) * 0.1})`;
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(tick);
  }

  cv.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    MOUSE.x = e.clientX - r.left;
    MOUSE.y = e.clientY - r.top;
  }, { passive: true });

  cv.addEventListener('mouseleave', () => { MOUSE.x = MOUSE.y = -2000; });

  resize();
  window.addEventListener('resize', () => { resize(); init(); }, { passive: true });
  init();
  requestAnimationFrame(tick);
}

/* ── Cursor ─────────────────────────────────────────────────── */
function cursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const dot   = document.getElementById('cur');
  const trail = document.getElementById('cur-t');
  if (!dot || !trail) return;

  let mx = 0, my = 0, tx = 0, ty = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top  = my + 'px';
  }, { passive: true });

  (function loop() {
    tx += (mx - tx) * 0.1;
    ty += (my - ty) * 0.1;
    trail.style.left = tx + 'px';
    trail.style.top  = ty + 'px';
    requestAnimationFrame(loop);
  })();

  document.querySelectorAll('a, button, .pb, input').forEach(el => {
    el.addEventListener('mouseenter', () => {
      dot.classList.add('cur-hover');
      trail.classList.add('cur-hover');
    });
    el.addEventListener('mouseleave', () => {
      dot.classList.remove('cur-hover');
      trail.classList.remove('cur-hover');
    });
  });
}

/* ── Toasts ─────────────────────────────────────────────────── */
function toasts() {
  const toast = document.getElementById('toast');
  const tAva  = document.getElementById('t-ava');
  const tName = document.getElementById('t-name');
  const tSub  = document.getElementById('t-sub');
  if (!toast) return;

  const orders = [
    { n: 'Алексей', a: 'А', rub: 2500, g: 3731 },
    { n: 'Дмитрий', a: 'Д', rub: 500,  g: 746  },
    { n: 'Максим',  a: 'М', rub: 1000, g: 1492 },
    { n: 'Никита',  a: 'Н', rub: 3000, g: 4478 },
    { n: 'Иван',    a: 'И', rub: 200,  g: 298  },
    { n: 'Артём',   a: 'А', rub: 5000, g: 7462 },
    { n: 'Кирилл',  a: 'К', rub: 800,  g: 1194 },
  ];

  let idx = Math.floor(Math.random() * orders.length);

  function show() {
    const o = orders[idx++ % orders.length];
    tAva.textContent  = o.a;
    tName.textContent = `${o.n} купил ${o.rub.toLocaleString('ru')}₽`;
    tSub.textContent  = `≈ ${o.g.toLocaleString('ru')} G голды`;

    toast.classList.add('toast-in');
    setTimeout(() => toast.classList.remove('toast-in'), 3500);
    setTimeout(show, 10000 + Math.random() * 8000);
  }

  setTimeout(show, 4000);
}

/* ── Nav ────────────────────────────────────────────────────── */
function nav() {
  const el = document.getElementById('nav');
  if (!el) return;
  window.addEventListener('scroll', () => {
    el.classList.toggle('nav-solid', window.scrollY > 50);
  }, { passive: true });
}

/* ── Hero Intro ─────────────────────────────────────────────── */
function heroIntro() {
  gsap.set('.hl-in', { yPercent: 110 }); // hide before GSAP takes over
  const tl = gsap.timeline({ delay: 0.15 });

  tl.to('#badge', {
      opacity: 1, duration: 0.55, ease: 'power3.out'
    })
    .to('.hl-in', {
      yPercent: 0, duration: 0.85,
      stagger: 0.09, ease: 'power4.out'
    }, '-=0.3')
    .to('#hero-sub', {
      opacity: 1, y: 0, duration: 0.6, ease: 'power3.out'
    }, '-=0.5')
    .to('#hero-cta', {
      opacity: 1, y: 0, duration: 0.6, ease: 'power3.out'
    }, '-=0.48')
    .to('.scroll-hint', {
      opacity: 1, duration: 0.5
    }, '-=0.2');
}

/* ── Scroll Animations ──────────────────────────────────────── */
function scrollAnimations() {
  /* stat counters */
  document.querySelectorAll('.stat-num').forEach(el => {
    const to  = parseFloat(el.dataset.to);
    const suf = el.dataset.suf || '';
    const obj = { v: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter() {
        gsap.to(obj, {
          v: to, duration: 1.6, ease: 'power2.out',
          onUpdate() {
            el.textContent = (Number.isInteger(to) ? Math.round(obj.v) : obj.v.toFixed(0)) + suf;
          }
        });
      }
    });
  });

  /* feat line scrub */
  gsap.fromTo('#feat-line',
    { scaleY: 0 },
    {
      scaleY: 1, ease: 'none',
      scrollTrigger: {
        trigger: '.feat-list',
        start: 'top 70%', end: 'bottom 35%',
        scrub: 0.8
      }
    }
  );

  /* feat items */
  gsap.from('.feat-item', {
    x: -36, opacity: 0, duration: 0.75,
    stagger: 0.14, ease: 'power3.out',
    scrollTrigger: { trigger: '.feat-list', start: 'top 76%' }
  });

  /* section heads */
  gsap.utils.toArray('.s-head').forEach(head => {
    gsap.from(head, {
      opacity: 0, y: 28, duration: 0.8, ease: 'power3.out',
      scrollTrigger: { trigger: head, start: 'top 86%' }
    });
  });

  /* reviews */
  gsap.from('.rev-card', {
    opacity: 0, y: 22, duration: 0.65,
    stagger: 0.1, ease: 'power3.out',
    scrollTrigger: { trigger: '.reviews-track', start: 'top 82%' }
  });

  /* calc */
  gsap.from('#calc-card', {
    opacity: 0, y: 32, duration: 0.85, ease: 'power3.out',
    scrollTrigger: { trigger: '#calc-card', start: 'top 82%' }
  });

  /* faq */
  gsap.from('.faq-item', {
    opacity: 0, y: 16, duration: 0.55,
    stagger: 0.09, ease: 'power3.out',
    scrollTrigger: { trigger: '.faq-list', start: 'top 82%' }
  });

  /* gold cta */
  gsap.from('.gold-cta-in > *', {
    opacity: 0, y: 22, duration: 0.7,
    stagger: 0.1, ease: 'power3.out',
    scrollTrigger: { trigger: '.gold-cta', start: 'top 72%' }
  });
}

/* ── Calculator ─────────────────────────────────────────────── */
function calculator() {
  const rubIn  = document.getElementById('rub-in');
  const goldOut = document.getElementById('gold-out');
  if (!rubIn || !goldOut) return;

  const RATE = 0.67;
  let displayed = 1492;
  let anim = null;

  function update(rub) {
    const target = Math.round(rub / RATE);
    if (anim) anim.kill();
    const obj = { v: displayed };
    anim = gsap.to(obj, {
      v: target, duration: 0.45, ease: 'power2.out',
      onUpdate() {
        const val = Math.round(obj.v);
        goldOut.textContent = val.toLocaleString('ru');
        displayed = val;
      },
      onComplete() { displayed = target; }
    });
  }

  rubIn.addEventListener('input', () => {
    const v = parseFloat(rubIn.value);
    if (v > 0 && v < 1e7) update(v);
  });

  document.querySelectorAll('.pb').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pb').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const v = parseInt(btn.dataset.v, 10);
      rubIn.value = v;
      update(v);
    });
  });
}

/* ── FAQ ────────────────────────────────────────────────────── */
function faq() {
  document.querySelectorAll('.faq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const body   = item.querySelector('.faq-body');
      const ico    = btn.querySelector('.faq-ico');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      /* close others */
      document.querySelectorAll('.faq-item').forEach(other => {
        if (other === item) return;
        const ob = other.querySelector('.faq-btn');
        if (ob.getAttribute('aria-expanded') !== 'true') return;
        ob.setAttribute('aria-expanded', 'false');
        gsap.to(other.querySelector('.faq-body'), { height: 0, duration: 0.32, ease: 'power2.in' });
        gsap.to(other.querySelector('.faq-ico'),  { rotation: 0, duration: 0.28 });
      });

      if (isOpen) {
        btn.setAttribute('aria-expanded', 'false');
        gsap.to(body, { height: 0,      duration: 0.32, ease: 'power2.in' });
        gsap.to(ico,  { rotation: 0,    duration: 0.28 });
      } else {
        btn.setAttribute('aria-expanded', 'true');
        gsap.to(body, { height: 'auto', duration: 0.45, ease: 'power3.out' });
        gsap.to(ico,  { rotation: 180,  duration: 0.32 });
      }
    });
  });
}

/* ── Sticky CTA ─────────────────────────────────────────────── */
function sticky() {
  const el     = document.getElementById('sticky');
  const hero   = document.getElementById('hero');
  const footer = document.querySelector('.footer');
  if (!el || !hero) return;

  const io = new IntersectionObserver(entries => {
    const anyVisible = entries.some(e => e.isIntersecting);
    el.classList.toggle('sticky-hide', anyVisible);
  }, { threshold: 0.1 });

  io.observe(hero);
  if (footer) io.observe(footer);
}

/* ── Magnetic Buttons ───────────────────────────────────────── */
function magnetic() {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  document.querySelectorAll('.btn-mag').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r  = btn.getBoundingClientRect();
      const cx = r.left + r.width  / 2;
      const cy = r.top  + r.height / 2;
      gsap.to(btn, {
        x: (e.clientX - cx) * 0.38,
        y: (e.clientY - cy) * 0.38,
        duration: 0.42, ease: 'power3.out'
      });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.65, ease: 'elastic.out(1, 0.4)' });
    });
  });
}

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  grain();
  particles();
  cursor();
  toasts();
  nav();
  heroIntro();
  scrollAnimations();
  calculator();
  faq();
  sticky();
  magnetic();
});
