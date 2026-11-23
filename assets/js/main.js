/* Page wiring: hero spectrum, counters, nav highlight, reveal, theme toggle, copy buttons. */
(function () {
  "use strict";
  const RP = window.RP;

  /* hero: one synthetic spectrum cycling through the recipes, each scaled to the panel */
  async function hero() {
    const [ax, rec, recipes] = await Promise.all([RP.json("data/synthetic/axes.json"), RP.json("data/synthetic/005.json"), RP.json("data/recipes.json")]);
    const order = ["none", "bc", "bc_snv", "bc_sg_snv", "sg_rubberband_snv", "bc_snv_avgpool", "msc", "sg_d1_snv", "sg_d2_snv", "wavelet_bc_snv", "decimate", "all"];
    const steps = Object.fromEntries(recipes.recipes.map((r) => [r.key, r.steps.replace(/ -> /g, " → ")]));
    const svgEl = document.getElementById("hero-svg");
    const svg = d3.select(svgEl);
    const gGrid = svg.append("g");
    const raw = svg.append("path").attr("fill", "none").attr("stroke", "var(--ghost)").attr("stroke-width", 1).attr("opacity", 0.55);
    const area = svg.append("path").attr("fill", "var(--trace)").attr("opacity", 0.08);
    const line = svg.append("path").attr("fill", "none").attr("stroke", "var(--trace)").attr("stroke-width", 1.8).attr("stroke-linejoin", "round");
    const axisG = svg.append("g").attr("class", "chart");
    const unit = svg.append("text").attr("text-anchor", "end").style("font", "11px var(--font-mono)").style("fill", "var(--muted)").text("Raman shift, cm⁻¹");
    let W = 500, k = order.indexOf("bc_snv_avgpool"), cur = null;
    const H = 230, M = { l: 16, r: 16, t: 8, b: 22 };

    /* resample every recipe onto the common axis so the line can morph between lengths */
    const xs0 = ax.none.x;
    function series(key) {
      const y = RP.dq(rec.out[key]);
      const x = ax[key].x;
      const out = new Float64Array(xs0.length);
      for (let i = 0; i < xs0.length; i++) {
        const j = Math.max(0, Math.min(x.length - 1, d3.bisectCenter(x, xs0[i])));
        out[i] = y[j];
      }
      const [lo, hi] = d3.extent(out);
      return out.map((v) => (v - lo) / (hi - lo || 1));
    }
    const S = Object.fromEntries(order.map((o) => [o, series(o)]));
    function geom() {
      const x = d3.scaleLinear().domain(d3.extent(xs0)).range([M.l, W - M.r]);
      const y = d3.scaleLinear().domain([-0.04, 1.04]).range([H - M.b, M.t]);
      return { x, y };
    }
    function paint(vals) {
      const { x, y } = geom();
      const ln = d3.line().x((d, i) => x(xs0[i])).y((d) => y(d)).curve(d3.curveLinear);
      const ar = d3.area().x((d, i) => x(xs0[i])).y0(H - M.b).y1((d) => y(d));
      line.attr("d", ln(Array.from(vals)));
      area.attr("d", ar(Array.from(vals)));
      raw.attr("d", ln(Array.from(S.none)));
      axisG.attr("transform", "translate(0," + (H - M.b) + ")").call(d3.axisBottom(x).ticks(Math.max(3, Math.floor(W / 90))).tickSizeOuter(0).tickFormat(d3.format("d")));
      unit.attr("x", W - M.r).attr("y", M.t + 10);
      axisG.selectAll("path,line").attr("stroke", "var(--line)");
      gGrid.selectAll("*").remove();
    }
    function show(key, animate) {
      document.getElementById("hero-recipe").textContent = key;
      document.getElementById("hero-steps").textContent = steps[key];
      const target = S[key];
      if (!animate || !cur || RP.reduced) { cur = target; paint(cur); return; }
      const from = cur;
      svg.transition().duration(900).ease(d3.easeCubicInOut).tween("m", () => (t) => {
        const v = new Float64Array(target.length);
        for (let i = 0; i < v.length; i++) v[i] = from[i] + (target[i] - from[i]) * t;
        cur = v; paint(v);
      });
    }
    RP.onResize(svgEl, function (w) { W = w; paint(cur || S[order[k]]); });
    show(order[k], false);
    if (RP.reduced) return;
    let visible = true;
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(svgEl);
    setInterval(function () {
      if (!visible || document.hidden) return;
      k = (k + 1) % order.length;
      show(order[k], true);
    }, 2600);
  }

  function counters() {
    if (RP.reduced) return;
    document.querySelectorAll("[data-count]").forEach(function (el) {
      const n = +el.dataset.count;
      d3.select(el).transition().duration(1200).ease(d3.easeCubicOut)
        .tween("text", () => (t) => { el.textContent = Math.round(n * t); });
    });
  }

  function nav() {
    const links = Array.from(document.querySelectorAll(".nav a"));
    const secs = links.map((a) => document.querySelector(a.getAttribute("href")));
    const io = new IntersectionObserver(function () {
      let best = null;
      secs.forEach(function (s, i) {
        const r = s.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.35) best = i;
      });
      links.forEach((a, i) => a.classList.toggle("active", i === best));
    }, { threshold: [0, 0.1, 0.5, 1], rootMargin: "-20% 0px -60% 0px" });
    secs.forEach((s) => io.observe(s));
  }

  function reveal() {
    if (RP.reduced) return;
    const els = Array.from(document.querySelectorAll(".reveal"));
    const io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove("pending"); io.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    els.forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add("pending"); io.observe(el); }
    });
  }

  function theme() {
    const btn = document.getElementById("theme-btn");
    const root = document.documentElement;
    try { const t = localStorage.getItem("rp-theme"); if (t) root.dataset.theme = t; } catch (e) { /* storage unavailable */ }
    btn.addEventListener("click", function () {
      const dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      try { localStorage.setItem("rp-theme", root.dataset.theme); } catch (e) { /* storage unavailable */ }
      RP.bus.call("theme");
    });
    new MutationObserver(() => RP.bus.call("theme")).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => RP.bus.call("theme"));
  }

  function copy() {
    document.querySelectorAll("[data-copy]").forEach(function (b) {
      b.addEventListener("click", function () {
        const pre = document.getElementById(b.dataset.copy);
        const text = Array.from(pre.childNodes).filter((n) => n !== b).map((n) => n.textContent).join("").trim();
        const done = () => { b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy"; }, 1400); };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(done).catch(function () {
            const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
            b.textContent = "Press ⌘C";
          });
        }
      });
    });
  }

  async function init() {
    theme();
    counters();
    nav();
    reveal();
    copy();
    const [paper, recipes, sets] = await Promise.all([RP.json("data/paper.json"), RP.json("data/recipes.json"), RP.json("data/sets.json")]);
    RP.tables.init(paper, recipes, sets);
    RP.figures.init(paper);
    await RP.explorer.init();
    hero();
  }
  init();
})();
