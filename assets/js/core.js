/* Shared helpers: data loading and decoding, tooltip, colors, responsive SVG charts. */
window.RP = (function () {
  "use strict";
  const cache = new Map();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function json(url) {
    if (!cache.has(url)) {
      cache.set(url, fetch(url).then(function (r) {
        if (!r.ok) throw new Error(url + ": " + r.status);
        return r.json();
      }));
    }
    return cache.get(url);
  }

  /* 16-bit quantised series {lo, hi, b64} -> Float64Array */
  function dq(q) {
    const bin = atob(q.b64);
    const n = bin.length / 2;
    const out = new Float64Array(n);
    const span = q.hi - q.lo;
    for (let i = 0; i < n; i++) {
      const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      out[i] = q.lo + (v / 65535) * span;
    }
    return out;
  }

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  const FAMILY_VAR = {
    "Chemometric": "--fam-chemo", "Kernel methods": "--fam-kernel", "Tree ensembles": "--fam-trees",
    "Deep learning": "--fam-deep", "Tabular foundation": "--fam-tfm"
  };
  const FAMILY_SHORT = {
    "Chemometric": "Chemometric", "Kernel methods": "SVM", "Tree ensembles": "Trees",
    "Deep learning": "Deep nets", "Tabular foundation": "TFMs"
  };
  function famColor(f) { return css(FAMILY_VAR[f]); }

  /* diverging color for a change against none; better = positive t */
  function diverging(t) {
    const c = Math.max(-1, Math.min(1, t));
    const mid = css("--neutral");
    return c >= 0 ? d3.interpolateRgb(mid, css("--better"))(c) : d3.interpolateRgb(mid, css("--worse"))(-c);
  }

  /* tooltip */
  const tipEl = document.getElementById("tip");
  function tip(html, ev) {
    tipEl.innerHTML = html;
    tipEl.classList.add("show");
    move(ev);
  }
  function move(ev) {
    if (!ev) return;
    const pad = 14;
    const r = tipEl.getBoundingClientRect();
    let x = ev.clientX + pad, y = ev.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - pad;
    tipEl.style.left = Math.max(8, x) + "px";
    tipEl.style.top = Math.max(8, y) + "px";
  }
  function untip() { tipEl.classList.remove("show"); }

  /* signed number with a real minus sign */
  function sgn(v, digits) {
    const s = Math.abs(v).toFixed(digits === undefined ? 1 : digits);
    if (Number(s) === 0) return s;
    return (v < 0 ? "−" : "+") + s;
  }
  function minus(s) { return String(s).replace(/-/g, "−"); }

  /* re-run a draw function when the element's width changes */
  function onResize(el, fn) {
    let w = 0;
    const ro = new ResizeObserver(function (entries) {
      const nw = Math.round(entries[0].contentRect.width);
      if (nw && nw !== w) { w = nw; fn(nw); }
    });
    ro.observe(el);
  }

  /* run fn once when el first scrolls into view */
  function onVisible(el, fn, threshold) {
    const io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: threshold || 0.3 });
    io.observe(el);
  }

  const bus = d3.dispatch("recipe", "theme");

  return { json, dq, css, famColor, FAMILY_SHORT, diverging, tip, move, untip, sgn, minus, onResize, onVisible, reduced, bus };
})();
