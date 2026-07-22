'use strict';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasGsap      = typeof window.gsap !== 'undefined';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

if (hasGsap && typeof window.ScrollTrigger !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/* ── Preloader + hero intro ─────────────────────────────────── */
function intro() {
  const pre   = $('#preloader');
  const count = $('#preloaderCount');
  const lines = $$('.hero-line-inner');

  const showHero = () => {
    $$('.hero .reveal-line, .hero-foot').forEach(el => el.classList.add('is-in'));
  };

  if (!hasGsap || reduceMotion) {
    pre.remove();
    showHero();
    return;
  }

  document.body.style.overflow = 'hidden';
  gsap.set(lines, { yPercent: 110 });

  const tl = gsap.timeline({
    onComplete() {
      document.body.style.overflow = '';
      pre.remove();
    }
  });

  const n = { v: 0 };
  tl.to(n, {
      v: 100, duration: 1.1, ease: 'power2.inOut',
      onUpdate: () => { count.textContent = String(Math.round(n.v)).padStart(2, '0'); }
    })
    .to(pre, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '+=0.15')
    .to(lines, { yPercent: 0, duration: 1.1, ease: 'power4.out', stagger: 0.09 }, '-=0.45')
    .add(showHero, '-=0.8');
}

/* ── Custom cursor ──────────────────────────────────────────── */
function cursor() {
  if (!finePointer || reduceMotion) return;

  document.body.classList.add('has-cursor');
  const dot   = $('#cursorDot');
  const ring  = $('#cursorRing');
  const label = $('#cursorLabel');

  let mx = -100, my = -100;      // target (mouse)
  let rx = -100, ry = -100;      // ring, eased

  window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; }, { passive: true });

  (function loop() {
    rx += (mx - rx) * 0.16;
    ry += (my - ry) * 0.16;
    dot.style.transform  = `translate(${mx}px, ${my}px)`;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(loop);
  })();

  // Grow on interactive elements; show a label when data-cursor is set
  document.addEventListener('mouseover', e => {
    const labelled    = e.target.closest('[data-cursor]');
    const interactive = e.target.closest('a, button');
    if (labelled) {
      label.textContent = labelled.dataset.cursor;
      ring.classList.add('is-active');
    } else {
      ring.classList.remove('is-active');
    }
    ring.classList.toggle('is-hover', !!interactive);
  });
}

/* ── Magnetic elements ──────────────────────────────────────── */
function magnetics() {
  if (!finePointer || reduceMotion || !hasGsap) return;

  $$('[data-magnetic]').forEach(el => {
    const strength = 0.35;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });

    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * strength);
      yTo((e.clientY - r.top - r.height / 2) * strength);
    });
    el.addEventListener('mouseleave', () => { xTo(0); yTo(0); });
  });
}

/* ── Nav: hide on scroll down, translucent after top ────────── */
function nav() {
  const el = $('#nav');
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    el.classList.toggle('is-scrolled', y > 30);
    el.classList.toggle('is-hidden', y > last && y > 160);
    last = y;
  }, { passive: true });
}

/* ── Marquee: infinite loop, speed reacts to scroll velocity ── */
function marquee() {
  if (!hasGsap || reduceMotion) return;

  const track = $('#marqueeA');
  const tween = gsap.to(track, { xPercent: -50, duration: 22, ease: 'none', repeat: -1 });

  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
      onUpdate(self) {
        const v = gsap.utils.clamp(-4, 4, self.getVelocity() / 220);
        gsap.to(tween, {
          timeScale: v === 0 ? 1 : v,
          duration: 0.4,
          overwrite: true,
          onComplete: () => gsap.to(tween, { timeScale: 1, duration: 1.2 })
        });
      }
    });
  }
}

/* ── Hero orb: drifts with the mouse, sinks on scroll ───────── */
function heroOrb() {
  if (!hasGsap || reduceMotion || !finePointer) return;

  const orb = $('#heroOrb');
  const xTo = gsap.quickTo(orb, 'x', { duration: 1.6, ease: 'power3.out' });
  const yTo = gsap.quickTo(orb, 'y', { duration: 1.6, ease: 'power3.out' });

  window.addEventListener('mousemove', e => {
    xTo((e.clientX / window.innerWidth  - 0.5) * -80);
    yTo((e.clientY / window.innerHeight - 0.5) * -60);
  }, { passive: true });

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.to(orb, {
      yPercent: 30, opacity: 0.4, ease: 'none',
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }
}

/* ── Scroll reveals (CSS transitions, IO just flips a class) ── */
function reveals() {
  const targets = $$('.reveal-line, .section-head, .work-row, .principle, .about-stats, .footer-actions, .footer-bottom');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  targets.forEach(el => io.observe(el));
}

/* ── Manifesto: words brighten as you scroll through them ───── */
function manifesto() {
  const el = $('#manifesto');
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map(w => `<span class="w">${w}</span>`).join(' ');

  if (!hasGsap || typeof ScrollTrigger === 'undefined' || reduceMotion) return;

  gsap.to('#manifesto .w', {
    opacity: 1,
    stagger: 0.06,
    ease: 'none',
    scrollTrigger: {
      trigger: el,
      start: 'top 80%',
      end: 'bottom 45%',
      scrub: 0.6
    }
  });
}

/* ── Stats count-up ─────────────────────────────────────────── */
function stats() {
  const values = $$('.stat-value');
  if (!hasGsap || typeof ScrollTrigger === 'undefined' || reduceMotion) {
    values.forEach(v => { v.textContent = v.dataset.count; });
    return;
  }

  values.forEach(v => {
    const target = +v.dataset.count;
    const n = { v: 0 };
    gsap.to(n, {
      v: target, duration: 1.6, ease: 'power3.out',
      onUpdate: () => { v.textContent = Math.round(n.v); },
      scrollTrigger: { trigger: v, start: 'top 88%', once: true }
    });
  });
}

/* ── Work: floating preview trails the cursor over each row ── */
function workPreviews() {
  if (!finePointer || !hasGsap || reduceMotion) return;

  const wrap  = $('#workPreview');
  const list  = $('#workList');
  const cards = {
    p1: $('.preview-p1'), p2: $('.preview-p2'),
    p3: $('.preview-p3'), p4: $('.preview-p4')
  };

  const xTo = gsap.quickTo(wrap, 'x', { duration: 0.55, ease: 'power3.out' });
  const yTo = gsap.quickTo(wrap, 'y', { duration: 0.55, ease: 'power3.out' });
  const rTo = gsap.quickTo(wrap, 'rotation', { duration: 0.8, ease: 'power3.out' });

  let lastX = 0, settle;

  list.addEventListener('mousemove', e => {
    xTo(e.clientX + 32);
    yTo(e.clientY - wrap.offsetHeight / 2);
    rTo(gsap.utils.clamp(-9, 9, (e.clientX - lastX) * 0.55));  // tilt with velocity
    lastX = e.clientX;
    clearTimeout(settle);
    settle = setTimeout(() => rTo(0), 90);  // level out once the mouse rests
  });

  $$('.work-row').forEach(row => {
    row.addEventListener('mouseenter', () => {
      gsap.to(wrap, { opacity: 1, duration: 0.3 });
      Object.entries(cards).forEach(([k, c]) =>
        c.classList.toggle('is-on', k === row.dataset.preview));
    });
  });
  list.addEventListener('mouseleave', () => {
    gsap.to(wrap, { opacity: 0, duration: 0.3 });
    Object.values(cards).forEach(c => c.classList.remove('is-on'));
  });
}

/* ── Footer title: split into letters that spring on hover ──── */
function footerTitle() {
  const el = $('#footerTitle');
  el.innerHTML = [...el.textContent].map(ch =>
    ch.trim() === '' ? ch : `<span class="ltr">${ch}</span>`
  ).join('');
}

/* ── Clock (Lisbon) ─────────────────────────────────────────── */
function clock() {
  const el = $('#clock');
  const tick = () => {
    el.textContent = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon'
    }).format(new Date());
  };
  tick();
  setInterval(tick, 30_000);
}

/* ── Back to top ────────────────────────────────────────────── */
function backTop() {
  $('#backTop').addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
}

/* ── Boot ───────────────────────────────────────────────────── */
intro();
cursor();
magnetics();
nav();
marquee();
heroOrb();
reveals();
manifesto();
stats();
workPreviews();
footerTitle();
clock();
backTop();
