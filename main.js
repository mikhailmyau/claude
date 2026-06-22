'use strict';

/* ── Particles ──────────────────────────────────────────────── */
function particles() {
  const cv = document.getElementById('particles');
  if (!cv) return;

  const ctx   = cv.getContext('2d');
  const MOUSE = { x: -2000, y: -2000 };
  const COUNT = 50;
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
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.r  = Math.random() * 1.6 + 0.4;
      this.a  = Math.random() * 0.4 + 0.07;
    }
    update() {
      const dx = this.x - MOUSE.x, dy = this.y - MOUSE.y;
      const d  = Math.hypot(dx, dy);
      if (d < 130 && d > 0) {
        const f = ((130 - d) / 130) * 0.85;
        this.vx += (dx / d) * f;
        this.vy += (dy / d) * f;
      }
      this.vx *= 0.97; this.vy *= 0.97;
      this.x  += this.vx; this.y += this.vy;
      if (this.x < -10 || this.x > w + 10 || this.y < -10 || this.y > h + 10) this.init();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,184,0,${this.a})`;
      ctx.fill();
    }
  }

  function init() { pts = Array.from({ length: COUNT }, () => new Pt()); }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < pts.length; i++) {
      pts[i].update(); pts[i].draw();
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(255,184,0,${(1 - d / 100) * 0.09})`;
          ctx.lineWidth = 0.5;
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

/* ── Nav ────────────────────────────────────────────────────── */
function nav() {
  const el = document.getElementById('nav');
  if (!el) return;
  window.addEventListener('scroll', () => {
    el.classList.toggle('nav-solid', window.scrollY > 40);
  }, { passive: true });
}

/* ── Scroll animations ──────────────────────────────────────── */
function scrollAnimations() {
  /* stat counter in trust bar */
  document.querySelectorAll('.stat-num').forEach(el => {
    const to  = parseFloat(el.dataset.to);
    const suf = el.dataset.suf || '';
    const obj = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter() {
        gsap.to(obj, {
          v: to, duration: 1.4, ease: 'power2.out',
          onUpdate() {
            el.textContent = Math.round(obj.v) + suf;
          }
        });
      }
    });
  });

  /* section heads */
  gsap.utils.toArray('.s-head').forEach(el => {
    gsap.from(el, {
      opacity: 0, y: 24, duration: 0.65, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' }
    });
  });

  /* calc card */
  gsap.from('#calc-card', {
    opacity: 0, y: 28, duration: 0.7, ease: 'power3.out',
    scrollTrigger: { trigger: '#calc-card', start: 'top 84%' }
  });

  /* how items */
  gsap.from('.how-item', {
    opacity: 0, y: 22, duration: 0.6, stagger: 0.1, ease: 'power3.out',
    scrollTrigger: { trigger: '.how-list', start: 'top 82%' }
  });

  /* reviews */
  gsap.from('.rev-card', {
    opacity: 0, y: 18, duration: 0.55, stagger: 0.09, ease: 'power3.out',
    scrollTrigger: { trigger: '.reviews-track', start: 'top 84%' }
  });

  /* faq */
  gsap.from('.faq-item', {
    opacity: 0, y: 14, duration: 0.5, stagger: 0.07, ease: 'power3.out',
    scrollTrigger: { trigger: '.faq-list', start: 'top 84%' }
  });

  /* trust bar */
  gsap.from('.trust-item', {
    opacity: 0, y: 16, duration: 0.55, stagger: 0.08, ease: 'power3.out',
    scrollTrigger: { trigger: '.trust-bar', start: 'top 90%' }
  });

  /* gold cta */
  gsap.from('.gold-cta-in > *', {
    opacity: 0, y: 20, duration: 0.6, stagger: 0.09, ease: 'power3.out',
    scrollTrigger: { trigger: '.gold-cta', start: 'top 75%' }
  });

  /* price comp card */
  gsap.from('.price-comp', {
    opacity: 0, y: 16, duration: 0.55, ease: 'power3.out',
    scrollTrigger: { trigger: '.price-comp', start: 'top 92%' }
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
      v: target, duration: 0.4, ease: 'power2.out',
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
      rubIn.value = btn.dataset.v;
      update(parseInt(btn.dataset.v, 10));
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

      document.querySelectorAll('.faq-item').forEach(other => {
        if (other === item) return;
        const ob = other.querySelector('.faq-btn');
        if (ob.getAttribute('aria-expanded') !== 'true') return;
        ob.setAttribute('aria-expanded', 'false');
        gsap.to(other.querySelector('.faq-body'), { height: 0, duration: 0.3, ease: 'power2.in' });
        gsap.to(other.querySelector('.faq-ico'),  { rotation: 0, duration: 0.26 });
      });

      if (isOpen) {
        btn.setAttribute('aria-expanded', 'false');
        gsap.to(body, { height: 0,      duration: 0.3, ease: 'power2.in' });
        gsap.to(ico,  { rotation: 0,    duration: 0.26 });
      } else {
        btn.setAttribute('aria-expanded', 'true');
        gsap.to(body, { height: 'auto', duration: 0.42, ease: 'power3.out' });
        gsap.to(ico,  { rotation: 180,  duration: 0.3 });
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
    el.classList.toggle('sticky-hide', entries.some(e => e.isIntersecting));
  }, { threshold: 0.1 });

  io.observe(hero);
  if (footer) io.observe(footer);
}

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  particles();
  nav();
  scrollAnimations();
  calculator();
  faq();
  sticky();
});
