'use strict';

/* ── Particles (desktop only) ───────────────────────────────── */
function particles() {
  if (window.innerWidth < 1080) return; // skip on mobile/tablet

  const cv = document.getElementById('particles');
  if (!cv) return;

  const ctx   = cv.getContext('2d');
  const MOUSE = { x: -9999, y: -9999 };
  const N     = 30;
  let w, h, pts = [];

  function resize() {
    const r = cv.parentElement.getBoundingClientRect();
    w = cv.width  = r.width;
    h = cv.height = r.height;
  }

  class P {
    reset(spread) {
      this.x  = Math.random() * w;
      this.y  = spread ? Math.random() * h : (Math.random() < 0.5 ? -10 : h + 10);
      this.vx = (Math.random() - 0.5) * 0.28;
      this.vy = (Math.random() - 0.5) * 0.28;
      this.r  = Math.random() * 1.5 + 0.3;
      this.a  = Math.random() * 0.35 + 0.06;
    }
    constructor() { this.reset(true); }
    update() {
      const dx = this.x - MOUSE.x, dy = this.y - MOUSE.y;
      const d  = Math.hypot(dx, dy);
      if (d < 120 && d > 0) {
        const f = ((120 - d) / 120) * 0.8;
        this.vx += (dx / d) * f;
        this.vy += (dy / d) * f;
      }
      this.vx *= 0.97; this.vy *= 0.97;
      this.x  += this.vx; this.y += this.vy;
      if (this.x < -20 || this.x > w + 20 || this.y < -20 || this.y > h + 20) this.reset(false);
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,184,0,${this.a})`;
      ctx.fill();
    }
  }

  pts = Array.from({ length: N }, () => new P());

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < pts.length; i++) {
      pts[i].update(); pts[i].draw();
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 90) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(255,184,0,${(1 - d / 90) * 0.08})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('mousemove', e => {
    const r = cv.getBoundingClientRect();
    MOUSE.x = e.clientX - r.left;
    MOUSE.y = e.clientY - r.top;
  }, { passive: true });

  resize();
  window.addEventListener('resize', () => {
    resize();
    pts = Array.from({ length: N }, () => new P());
  }, { passive: true });
  requestAnimationFrame(frame);
}

/* ── Nav ────────────────────────────────────────────────────── */
function nav() {
  const el = document.getElementById('nav');
  if (!el) return;
  const tick = () => el.classList.toggle('nav-solid', window.scrollY > 40);
  window.addEventListener('scroll', tick, { passive: true });
  tick();
}

/* ── Count-up for hero stats ────────────────────────────────── */
function heroStats() {
  const nums = document.querySelectorAll('.hstat-num');
  nums.forEach(el => {
    const to  = parseFloat(el.dataset.to);
    const dec = parseInt(el.dataset.dec, 10) || 0;
    const suf = el.dataset.suf || '';
    let started = false;

    function run() {
      if (started) return;
      started = true;
      const obj = { v: 0 };
      gsap.to(obj, {
        v: to, duration: 1.6, ease: 'power2.out',
        onUpdate() {
          el.textContent = (dec ? obj.v.toFixed(dec) : Math.round(obj.v)) + suf;
        }
      });
    }

    // Fire immediately if already in viewport
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.95) {
      run();
    } else {
      ScrollTrigger.create({
        trigger: el, start: 'top 94%', once: true,
        onEnter: run
      });
    }
  });
}

/* ── Scroll reveal animations ───────────────────────────────── */
function reveals() {
  const cfg = [
    { sel: '.s-head',        from: { y: 22, opacity: 0 }, start: '88%' },
    { sel: '#calc-card',     from: { y: 28, opacity: 0 }, start: '85%' },
    { sel: '.how-item',      from: { y: 22, opacity: 0 }, start: '82%', stagger: 0.1 },
    { sel: '.rev-card',      from: { y: 18, opacity: 0 }, start: '84%', stagger: 0.09 },
    { sel: '.faq-item',      from: { y: 14, opacity: 0 }, start: '84%', stagger: 0.07 },
    { sel: '.trust-item',    from: { y: 16, opacity: 0 }, start: '92%', stagger: 0.07 },
    { sel: '.gold-cta-in > *', from: { y: 20, opacity: 0 }, start: '78%', stagger: 0.09 },
    { sel: '.price-comp',    from: { y: 14, opacity: 0 }, start: '90%' },
  ];

  cfg.forEach(({ sel, from, start, stagger }) => {
    const els = document.querySelectorAll(sel);
    if (!els.length) return;
    gsap.from(els, {
      ...from, duration: 0.6, ease: 'power3.out',
      stagger: stagger || 0,
      scrollTrigger: {
        trigger: els[0],
        start: `top ${start}`
      }
    });
  });
}

/* ── Calculator ─────────────────────────────────────────────── */
function calculator() {
  const rubIn   = document.getElementById('rub-in');
  const goldOut  = document.getElementById('gold-out');
  const bonusEl  = document.getElementById('bonus-val');
  if (!rubIn || !goldOut) return;

  const RATE = 0.67;
  const SHOP = 1.0;
  let prev = 1492, anim;

  function update(rub) {
    const target = Math.round(rub / RATE);
    if (anim) anim.kill();
    const obj = { v: prev };
    anim = gsap.to(obj, {
      v: target, duration: 0.38, ease: 'power2.out',
      onUpdate() {
        const val = Math.round(obj.v);
        goldOut.textContent = val.toLocaleString('ru');
        prev = val;
      }
    });
    if (bonusEl) {
      const saved = Math.round(rub / RATE - rub / SHOP);
      bonusEl.textContent = '~' + saved.toLocaleString('ru') + ' G';
    }
  }

  rubIn.addEventListener('input', () => {
    const v = parseFloat(rubIn.value);
    document.querySelectorAll('.pb').forEach(b => b.classList.remove('on'));
    if (v > 0 && v < 1e7) update(v);
  });

  document.querySelectorAll('.pb').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pb').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      rubIn.value = btn.dataset.v;
      update(parseInt(btn.dataset.v, 10));
    });
  });
}

/* ── FAQ accordion ──────────────────────────────────────────── */
function faq() {
  document.querySelectorAll('.faq-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const body   = item.querySelector('.faq-body');
      const ico    = btn.querySelector('.faq-ico');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close others
      document.querySelectorAll('.faq-item').forEach(other => {
        if (other === item) return;
        const ob = other.querySelector('.faq-btn');
        if (ob.getAttribute('aria-expanded') !== 'true') return;
        ob.setAttribute('aria-expanded', 'false');
        gsap.to(other.querySelector('.faq-body'), { height: 0, duration: 0.28, ease: 'power2.in' });
        gsap.to(other.querySelector('.faq-ico'),  { rotation: 0, duration: 0.24 });
      });

      if (isOpen) {
        btn.setAttribute('aria-expanded', 'false');
        gsap.to(body, { height: 0,      duration: 0.28, ease: 'power2.in' });
        gsap.to(ico,  { rotation: 0,    duration: 0.24 });
      } else {
        btn.setAttribute('aria-expanded', 'true');
        gsap.to(body, { height: 'auto', duration: 0.38, ease: 'power3.out' });
        gsap.to(ico,  { rotation: 180,  duration: 0.28 });
      }
    });
  });
}

/* ── Sticky CTA ─────────────────────────────────────────────── */
function sticky() {
  const el   = document.getElementById('sticky');
  const hero = document.getElementById('hero');
  const cta  = document.querySelector('.gold-cta');
  if (!el || !hero) return;

  const io = new IntersectionObserver(entries => {
    const anyVisible = entries.some(e => e.isIntersecting);
    el.classList.toggle('sticky-hide', anyVisible);
  }, { threshold: 0.05 });

  io.observe(hero);
  if (cta) io.observe(cta);
}

/* ── Smooth anchor links ────────────────────────────────────── */
function anchors() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  anchors();
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  particles();
  nav();
  heroStats();
  reveals();
  calculator();
  faq();
  sticky();
});
