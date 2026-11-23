/* Recipe explorer: precomputed outputs of all 26 recipes on synthetic and real spectra. */
(function () {
  "use strict";
  const RP = window.RP;
  const pad3 = (i) => String(i).padStart(3, "0");
  const arrow = (s) => s.replace(/ -> /g, " → ");
  const MARGIN = { t: 12, r: 14, b: 36, l: 54 };
  const DUR = RP.reduced ? 0 : 650;

  /* ------------------------------------------------------------ chart */
  function SpecChart(svgEl, height, opts) {
    const svg = d3.select(svgEl).attr("height", height);
    const gGrid = svg.append("g").attr("class", "grid");
    const gZero = svg.append("g");
    const gGhost = svg.append("g");
    const gMain = svg.append("g");
    const gAxes = svg.append("g");
    const gHover = svg.append("g").style("pointer-events", "none");
    const hit = svg.append("rect").attr("fill", "transparent");
    const self = { svg, height, width: 600, cur: null, peers: [], opts: opts || {} };

    function frame() {
      return { x0: MARGIN.l, x1: self.width - MARGIN.r, y0: MARGIN.t, y1: height - MARGIN.b };
    }
    function extent(arrs) {
      let lo = Infinity, hi = -Infinity;
      arrs.forEach(function (a) { if (a) for (let i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; } });
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      if (hi === lo) { hi = lo + 1; }
      const p = (hi - lo) * 0.06;
      return [lo - p, hi + p];
    }

    /* panels: one for spectrum/features mode, four for blocks mode */
    function panels(m) {
      const f = frame();
      if (m.mode !== "blocks") return [{ x0: f.x0, x1: f.x1, idx: null }];
      const gap = 16, n = m.blocks.length, w = (f.x1 - f.x0 - gap * (n - 1)) / n;
      return m.blocks.map(function (b, k) { return { x0: f.x0 + k * (w + gap), x1: f.x0 + k * (w + gap) + w, idx: k, name: b }; });
    }

    function render(m) {
      const f = frame();
      const ps = panels(m);
      gAxes.selectAll("*").remove();
      gGrid.selectAll("*").remove();
      gZero.selectAll("*").remove();
      gMain.selectAll("*").remove();
      gGhost.selectAll("*").remove();
      const yAll = [m.y].concat(m.clean ? [m.clean] : [], m.bg ? [m.bg] : [], m.ghosts || []);
      if (m.mode === "features") yAll.push([0]);
      ps.forEach(function (p) {
        const sl = (a) => (p.idx === null ? a : a.slice(p.idx * m.x.length, (p.idx + 1) * m.x.length));
        const ys = d3.scaleLinear().domain(m.yd || extent(yAll.map(sl))).range([f.y1, f.y0]);
        let xs;
        if (m.mode === "features") {
          xs = d3.scaleBand().domain(d3.range(m.y.length)).range([p.x0, p.x1]).paddingInner(0.25);
        } else {
          xs = d3.scaleLinear().domain(m.xd || d3.extent(m.x)).range([p.x0, p.x1]);
        }
        p.xs = xs; p.ys = ys;
        const nTicksY = height < 220 ? 4 : 5;
        gGrid.append("g").attr("transform", "translate(" + p.x0 + ",0)")
          .call(d3.axisLeft(ys).ticks(nTicksY).tickSize(-(p.x1 - p.x0)).tickFormat(""));
        if (p.idx === null || p.idx === 0) {
          gAxes.append("g").attr("class", "axis").attr("transform", "translate(" + p.x0 + ",0)")
            .call(d3.axisLeft(ys).ticks(nTicksY).tickFormat(d3.format("~s")).tickSizeOuter(0));
        }
        const xa = gAxes.append("g").attr("class", "axis").attr("transform", "translate(0," + f.y1 + ")");
        if (m.mode === "features") {
          const every = Math.ceil(m.y.length / 16);
          xa.call(d3.axisBottom(xs).tickValues(d3.range(0, m.y.length, every)).tickFormat((d) => d + 1).tickSizeOuter(0));
        } else {
          const nx = Math.max(2, Math.floor((p.x1 - p.x0) / 70));
          xa.call(d3.axisBottom(xs).ticks(nx).tickFormat(d3.format("d")).tickSizeOuter(0));
        }
        if (ys.domain()[0] < 0 && ys.domain()[1] > 0) {
          gZero.append("line").attr("class", "zero").attr("x1", p.x0).attr("x2", p.x1).attr("y1", ys(0)).attr("y2", ys(0));
        }
        if (p.name) {
          gAxes.append("text").attr("class", "segtxt").attr("x", p.x0 + 4).attr("y", f.y0 + 11).text(p.name);
        }
        if (m.mode === "features") {
          (m.ghosts || []).forEach(function (g) {
            gGhost.append("g").selectAll("circle").data(Array.from(g)).join("circle")
              .attr("cx", (d, i) => xs(i) + xs.bandwidth() / 2).attr("cy", (d) => ys(d)).attr("r", 1.3)
              .attr("fill", RP.css("--ghost")).attr("opacity", 0.7);
          });
          gMain.append("g").selectAll("rect").data(Array.from(m.y)).join("rect").attr("class", "bar")
            .attr("x", (d, i) => xs(i)).attr("width", xs.bandwidth())
            .attr("y", (d) => ys(Math.max(0, d))).attr("height", (d) => Math.abs(ys(d) - ys(0)));
          if (m.clean) {
            gMain.append("g").selectAll("circle").data(Array.from(m.clean)).join("circle")
              .attr("cx", (d, i) => xs(i) + xs.bandwidth() / 2).attr("cy", (d) => ys(d)).attr("r", 2.2)
              .attr("fill", "none").attr("stroke", RP.css("--clean")).attr("stroke-width", 1.2);
          }
          let off = 0;
          (m.segments || []).forEach(function (s) {
            if (m.segments.length > 1) {
              gAxes.append("text").attr("class", "segtxt").attr("x", xs(off) + 2).attr("y", f.y0 + 11).text(s.name);
              if (off > 0) {
                gAxes.append("line").attr("x1", xs(off) - xs.step() * 0.15).attr("x2", xs(off) - xs.step() * 0.15)
                  .attr("y1", f.y0).attr("y2", f.y1).attr("stroke", RP.css("--line"));
              }
            }
            off += s.n;
          });
        } else {
          const line = d3.line().x((d, i) => xs(m.x[i])).y((d) => ys(d));
          (m.ghosts || []).forEach(function (g) { gGhost.append("path").attr("class", "ghost").attr("d", line(Array.from(sl(g)))); });
          if (m.bg) gMain.append("path").attr("class", "bgline").attr("d", line(Array.from(sl(m.bg))));
          gMain.append("path").attr("class", "trace").attr("d", line(Array.from(sl(m.y))));
          if (m.clean) gMain.append("path").attr("class", "cleanline").attr("d", line(Array.from(sl(m.clean))));
        }
      });
      if (m.xLabel) {
        gAxes.append("text").attr("x", f.x1).attr("y", height - 4).attr("text-anchor", "end").text(m.xLabel);
      }
      if (m.yLabel) {
        gAxes.append("text").attr("transform", "rotate(-90)").attr("x", -f.y0).attr("y", 12).attr("text-anchor", "end").text(m.yLabel);
      }
      self.ps = ps;
      hit.attr("x", f.x0).attr("y", f.y0).attr("width", Math.max(0, f.x1 - f.x0)).attr("height", f.y1 - f.y0);
    }

    function lerpArr(a, b, t) {
      if (!a || !b || a.length !== b.length) return b;
      const o = new Float64Array(b.length);
      for (let i = 0; i < b.length; i++) o[i] = a[i] + (b[i] - a[i]) * t;
      return o;
    }

    self.draw = function (m, animate) {
      m.yd = null;
      const prev = self.cur;
      const yAll = [m.y].concat(m.clean ? [m.clean] : [], m.bg ? [m.bg] : [], m.ghosts || []);
      if (m.mode === "features") yAll.push([0]);
      const target = Object.assign({}, m, { yd: m.mode === "blocks" ? null : extent(yAll) });
      self.cur = target;
      const same = prev && prev.mode === m.mode && m.mode === "spectrum" && prev.y.length === m.y.length;
      svg.interrupt();
      if (animate && DUR && same) {
        const xi = d3.interpolateArray(prev.xd || d3.extent(prev.x), d3.extent(m.x));
        const yi = d3.interpolateArray(prev.yd, target.yd);
        svg.transition().duration(DUR).ease(d3.easeCubicInOut).tween("morph", function () {
          return function (t) {
            render(Object.assign({}, target, {
              y: lerpArr(prev.y, m.y, t), clean: m.clean ? lerpArr(prev.clean, m.clean, t) : null,
              bg: m.bg ? lerpArr(prev.bg, m.bg, t) : null, yd: yi(t), xd: xi(t),
              ghosts: m.ghosts && prev.ghosts && prev.ghosts.length === m.ghosts.length ?
                m.ghosts.map((g, k) => lerpArr(prev.ghosts[k], g, t)) : m.ghosts
            }));
          };
        });
      } else if (animate && DUR) {
        render(target);
        gMain.attr("opacity", 0).transition().duration(DUR * 0.7).attr("opacity", 1);
        gGhost.attr("opacity", 0).transition().duration(DUR * 0.7).attr("opacity", 1);
      } else {
        render(target);
      }
    };

    self.resize = function (w) { self.width = w; if (self.cur) render(self.cur); };

    /* hover crosshair, linked to the peer charts by Raman shift */
    function showAt(xval, ev, isSource) {
      gHover.selectAll("*").remove();
      const m = self.cur;
      if (!m || m.mode !== "spectrum" || !self.ps) return;
      const p = self.ps[0];
      const i = Math.max(0, Math.min(m.x.length - 1, d3.bisectCenter(m.x, xval)));
      const f = frame();
      const cx = p.xs(m.x[i]);
      gHover.append("line").attr("class", "cross").attr("x1", cx).attr("x2", cx).attr("y1", f.y0).attr("y2", f.y1);
      gHover.append("circle").attr("class", "dot").attr("cx", cx).attr("cy", p.ys(m.y[i])).attr("r", 4);
      if (isSource) {
        RP.tip("<span class='mono'>" + d3.format(",.0f")(m.x[i]) + " cm⁻¹</span><br><b>" + d3.format(".4~g")(m.y[i]) + "</b>", ev);
      }
    }
    function clear() { gHover.selectAll("*").remove(); }
    hit.on("mousemove", function (ev) {
      const m = self.cur;
      if (!m || m.mode !== "spectrum") return;
      const xval = self.ps[0].xs.invert(d3.pointer(ev)[0]);
      showAt(xval, ev, true);
      self.peers.forEach((c) => c.showAt(xval));
    }).on("mouseleave", function () {
      clear(); RP.untip(); self.peers.forEach((c) => c.clear());
    });
    self.showAt = (x) => showAt(x, null, false);
    self.clear = clear;
    RP.onResize(svgEl, self.resize);
    return self;
  }

  /* ------------------------------------------------------------ explorer */
  const state = { set: "synthetic", i: 74, recipe: null, clean: false, overlay: false };
  let recipes, recipeMap, sets, paper, rawChart, procChart;
  const ranks = {};

  function setInfo() { return sets.find((s) => s.id === state.set); }

  function sample(set, i) { return RP.json("data/" + set + "/" + pad3(i) + ".json"); }

  async function draw(animate) {
    const s = setInfo();
    const [ax, rec] = await Promise.all([RP.json("data/" + s.id + "/axes.json"), sample(s.id, state.i)]);
    const key = state.recipe;
    const a = ax[key];
    let ghostsRaw = null, ghostsProc = null;
    if (state.overlay) {
      const idx = d3.range(s.n).filter((j) => j !== state.i).slice(0, 24);
      const recs = await Promise.all(idx.map((j) => sample(s.id, j)));
      ghostsRaw = recs.map((r) => RP.dq(r.out.none));
      ghostsProc = recs.map((r) => RP.dq(r.out[key]));
    }
    if (key !== state.recipe) return; /* a newer click arrived meanwhile */
    const synth = s.kind === "synthetic";
    rawChart.draw({
      mode: "spectrum", x: ax.none.x, y: RP.dq(rec.out.none), bg: synth ? RP.dq(rec.background) : null,
      ghosts: ghostsRaw, xLabel: "Raman shift (cm⁻¹)", yLabel: synth ? "counts" : "intensity"
    }, animate);
    const m = {
      mode: a.kind, y: RP.dq(rec.out[key]), ghosts: ghostsProc,
      clean: synth && state.clean ? RP.dq(rec.clean[key]) : null
    };
    if (a.kind === "features") { m.segments = a.segments; m.xLabel = "feature"; }
    else if (a.kind === "blocks") { m.blocks = a.blocks; m.x = a.x; m.xLabel = "Raman shift (cm⁻¹), four blocks side by side"; }
    else { m.x = a.x; m.xLabel = "Raman shift (cm⁻¹)"; }
    procChart.draw(m, animate);
    chips(s, rec);
    d3.select("#ex-counter").text("spectrum " + (state.i + 1) + " of " + s.n);
    note(s, ax);
  }

  function chips(s, rec) {
    const c = [];
    const meta = rec.meta;
    if (s.kind === "synthetic") {
      c.push(["SNR", meta.snr_db + " dB"], ["fluorescence", "×" + meta.fluorescence], ["scatter", "×" + meta.scatter],
        ["spikes", meta.spikes], ["analyte", meta.y.analyte]);
    } else {
      Object.entries(meta.y).forEach(([k, v]) => { if (v !== null) c.push([k, d3.format(".4~g")(v)]); });
      c.push(["row", meta.row]);
    }
    d3.select("#meta-chips").selectAll("span").data(c).join("span").attr("class", "chip")
      .html((d) => d[0] + " <b>" + d[1] + "</b>");
  }

  function note(s, ax) {
    const bin = Math.round(ax.none.points / ax.none.x.length);
    let t;
    if (s.kind === "synthetic") {
      t = "100 synthetic spectra, 701 points from 400 to 1800 cm⁻¹. Recipes that learn from the data are fitted on all 100. " +
        "Dashed in the upper panel: fluorescence background plus offset. “Show clean signal” draws the same recipe applied to the noise-free mixture of the three components, without background or scatter.";
    } else {
      t = s.label + ": " + s.what.toLowerCase() + "; " + s.n_fit + " spectra with " + s.channels + " channels, " +
        Math.round(s.range[0]) + "–" + Math.round(s.range[1]) + " cm⁻¹. Recipes that learn from the data are fitted on all " +
        s.n_fit + "; " + s.n + " are shown" + (bin > 1 ? ", averaged in bins of " + bin + " channels for drawing only" : "") +
        ". Source: <a href='" + s.source + "' target='_blank' rel='noopener'>data</a>, <a href='https://doi.org/" + s.doi +
        "' target='_blank' rel='noopener'>paper</a>, " + s.license + ".";
    }
    d3.select("#set-note").html(t);
    d3.select("#clean-toggle-wrap").attr("hidden", s.kind === "synthetic" ? null : "");
  }

  function stages(key) {
    const r = recipeMap[key];
    const strip = d3.select("#stage-strip").selectAll("div.stage").data(recipes.stages).join((en) => {
      const d = en.append("div").attr("class", "stage");
      d.append("span").attr("class", "sn").text((s) => s);
      d.append("span").attr("class", "sm");
      return d;
    });
    strip.each(function (s, k) {
      const on = !!r.stages[s];
      const el = d3.select(this);
      const apply = () => { el.classed("on", on); el.select(".sm").text(on ? r.stages[s] : " "); };
      if (RP.reduced) apply(); else setTimeout(apply, on ? k * 45 : 0);
    });
  }

  function resultRow(label, unit, d, lo, hi, betterNeg) {
    const good = d.significant && (betterNeg ? d.median < 0 : d.median > 0);
    const cls = !d.significant ? "ns" : good ? "good" : "bad";
    const x = d3.scaleLinear().domain([lo, hi]).range([6, 214]).clamp(true);
    const col = !d.significant ? RP.css("--faint") : good ? RP.css("--better") : RP.css("--worse");
    const ticks = x.ticks(5).map((t) => "<text x='" + x(t) + "' y='29' text-anchor='middle'>" + RP.minus(t) + "</text>").join("");
    return "<div class='res-row'><div class='v " + cls + "'>" + RP.minus(d.text) + "<span style='font-size:.6em'>" + unit + "</span>" +
      "<small>" + label + "</small></div>" +
      "<svg viewBox='0 0 220 30' preserveAspectRatio='none'>" +
      "<line x1='" + x(0) + "' x2='" + x(0) + "' y1='2' y2='18' stroke='" + RP.css("--faint") + "' stroke-dasharray='2 2'/>" +
      "<rect x='" + x(d.iqr[0]) + "' y='7' width='" + Math.max(2, x(d.iqr[1]) - x(d.iqr[0])) + "' height='6' rx='3' fill='" + col + "' opacity='.3'/>" +
      "<circle cx='" + x(d.median) + "' cy='10' r='4.5' fill='" + col + "' stroke='" + RP.css("--surface") + "' stroke-width='1.5'/>" +
      ticks + "</svg></div>";
  }

  function card(key) {
    const r = recipeMap[key];
    const t4 = paper.table4.find((d) => d.recipe === key);
    const sAx = RP.json("data/" + state.set + "/axes.json");
    const el = d3.select("#recipe-card");
    sAx.then(function (ax) {
      const a = ax[key];
      const inP = ax.none.points;
      let size;
      if (a.kind === "features") size = inP + " points → " + a.points + " features";
      else if (a.kind === "blocks") size = inP + " points → 4 × " + inP + " features";
      else size = inP + " → " + a.points + " points";
      let res;
      if (!t4) {
        res = "<div class='rc-res'><span class='lbl'>In the benchmark</span><p class='rc-steps'>The reference. Every change in the paper is measured against the spectrum as supplied.</p></div>";
      } else {
        res = "<div class='rc-res'><span class='lbl'>In the benchmark · median over (model, target) pairs</span>" +
          resultRow("RMSE · rank " + ranks[key].reg + " of 25 · worse on " + t4.reg.worse + "%", "%", t4.reg, -35, 12, true) +
          resultRow("balanced accuracy · worse on " + t4.cls.worse + "%", " pp", t4.cls, -4, 10, false) +
          "</div>";
      }
      el.html("<div><div class='rc-name'>" + key + "</div><div class='rc-steps'>" + arrow(r.steps) + "</div>" +
        "<div class='rc-note'><span class='badge'>" + r.group + "</span><span class='badge'>" + size + "</span>" +
        (r.batch_fitted ? "<span class='badge'>learns from the training spectra</span>" : "<span class='badge'>spectrum by spectrum</span>") +
        "</div></div>" + res);
    });
  }

  function select(key, animate) {
    if (!recipeMap[key] || key === state.recipe) return;
    state.recipe = key;
    d3.selectAll("#recipe-list .rbtn").attr("aria-pressed", (d) => String(d.key === key));
    d3.select("#proc-name").text(key);
    stages(key);
    card(key);
    draw(animate !== false);
    RP.bus.call("recipe", null, key);
  }

  function buildList() {
    const groups = d3.groups(recipes.recipes, (d) => d.group);
    const list = d3.select("#recipe-list");
    groups.forEach(function ([g, rs]) {
      const grp = list.append("div").attr("class", "rgroup");
      grp.append("h4").text(g);
      grp.selectAll("button").data(rs).join("button").attr("type", "button").attr("class", "rbtn")
        .attr("aria-pressed", "false")
        .html(function (d) {
          const t = paper.table4.find((x) => x.recipe === d.key);
          const e = t ? "<span class='eff" + (t.reg.significant && t.reg.median < 0 ? " good" : "") + "'>" + RP.minus(t.reg.text) + "%</span>" : "<span class='eff'>ref</span>";
          return "<span>" + d.key + "</span>" + e;
        })
        .on("click", (ev, d) => select(d.key));
    });
    list.on("keydown", function (ev) {
      if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp" && ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      ev.preventDefault();
      const keys = recipes.recipes.map((r) => r.key);
      const k = keys.indexOf(state.recipe) + (ev.key === "ArrowDown" || ev.key === "ArrowRight" ? 1 : -1);
      const next = keys[(k + keys.length) % keys.length];
      select(next);
      const btn = list.selectAll(".rbtn").filter((d) => d.key === next).node();
      if (btn) { btn.focus({ preventScroll: true }); btn.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    });
  }

  function buildSets() {
    const short = { synthetic: "Synthetic", bioprocess: "Bioprocess", fuel: "Fuel", sers: "SERS" };
    d3.select("#set-seg").selectAll("button").data(sets).join("button").attr("type", "button")
      .attr("aria-pressed", (d) => String(d.id === state.set)).attr("title", (d) => d.label)
      .text((d) => short[d.id] || d.label)
      .on("click", function (ev, d) {
        if (d.id === state.set) return;
        state.set = d.id; state.i = d.id === "synthetic" ? 74 : 0;
        d3.selectAll("#set-seg button").attr("aria-pressed", (x) => String(x.id === d.id));
        card(state.recipe);
        draw(true);
      });
  }

  async function init() {
    [recipes, sets, paper] = await Promise.all([RP.json("data/recipes.json"), RP.json("data/sets.json"), RP.json("data/paper.json")]);
    recipeMap = Object.fromEntries(recipes.recipes.map((r) => [r.key, r]));
    paper.table4.forEach(function (d, k) { ranks[d.recipe] = { reg: k + 1 }; }); /* Table 4 is sorted by the regression median */
    rawChart = SpecChart(document.getElementById("raw-chart"), 210);
    procChart = SpecChart(document.getElementById("proc-chart"), 280);
    rawChart.peers = [procChart]; procChart.peers = [rawChart];
    buildList();
    buildSets();
    d3.select("#gen-btn").on("click", function () {
      const n = setInfo().n;
      let j = state.i;
      while (j === state.i) j = Math.floor(Math.random() * n);
      state.i = j;
      const icon = d3.select(this).select("svg");
      if (!RP.reduced) icon.style("transition", "transform .5s ease").style("transform", "rotate(" + (360 * (++spins)) + "deg)");
      draw(true);
    });
    d3.select("#clean-toggle").on("change", function () { state.clean = this.checked; draw(true); });
    d3.select("#overlay-toggle").on("change", function () { state.overlay = this.checked; draw(true); });
    RP.bus.on("recipe.explorer", (key) => select(key));
    RP.bus.on("theme.card", () => card(state.recipe));
    select(paper.fig4.global_recipe, false);
  }
  let spins = 0;

  RP.explorer = { init, select: (k) => select(k), SpecChart };
})();
