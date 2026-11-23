/* Redrawn paper figures (Fig. 1 effect map, Fig. 4 model gap), figure tabs and the lightbox. */
(function () {
  "use strict";
  const RP = window.RP;
  const DUR = RP.reduced ? 0 : 700;

  function goToRecipe(key) {
    RP.bus.call("recipe", null, key);
    document.getElementById("explorer").scrollIntoView({ behavior: RP.reduced ? "auto" : "smooth" });
  }

  /* ------------------------------------------------------------ Fig. 1 */
  function fig1(paper) {
    const F = paper.fig1;
    const svgEl = document.getElementById("fig1-svg");
    const svg = d3.select(svgEl);
    let task = "regression";
    const SPEC = {
      regression: { sign: -1, lim: 20, lab: 5, white: 15, xl: 25, ticks: [-20, -10, 0, 10, 20], unit: "%", what: "RMSE" },
      classification: { sign: 1, lim: 8, lab: 2, white: 6.5, xl: 12, ticks: [-8, -4, 0, 4, 8], unit: " pp", what: "balanced accuracy" }
    };
    const cellOf = {};
    F.cells.forEach((c) => { cellOf[c.task + "|" + c.recipe + "|" + c.family] = c; });
    const allOf = {};
    F.all_models.forEach((c) => { allOf[c.task + "|" + c.recipe] = c; });
    let W = 800;

    function legend() {
      const sp = SPEC[task];
      const L = d3.select("#fig1-legend").html("");
      const g = L.append("span").style("display", "inline-flex").style("align-items", "center").style("gap", "6px");
      g.append("span").text(sp.sign < 0 ? "+" + sp.lim + "% worse" : "−" + sp.lim + " pp worse");
      const bar = g.append("span").style("display", "inline-block").style("width", "120px").style("height", "10px").style("border-radius", "5px");
      const stops = d3.range(0, 1.01, 0.1).map((t) => RP.diverging(2 * t - 1) + " " + (t * 100) + "%").join(",");
      bar.style("background", "linear-gradient(90deg," + stops + ")");
      g.append("span").text(sp.sign < 0 ? "−" + sp.lim + "% better" : "+" + sp.lim + " pp better");
    }

    function draw(animate) {
      const sp = SPEC[task];
      const order = F.order;
      const fams = F.families;
      const labelW = 128, headH = 46, rowH = 21, gap = 18;
      const width = Math.max(720, W);
      const timeW = 92, whW = Math.min(190, Math.max(140, width * 0.18));
      const heatW = width - labelW - whW - timeW - 3 * gap;
      const cw = heatW / fams.length;
      const H = headH + order.length * rowH + 34;
      svg.attr("width", width).attr("height", H).attr("viewBox", "0 0 " + width + " " + H);
      const x0 = labelW, xw = labelW + heatW + gap, xt = xw + whW + gap;
      const y = (i) => headH + i * rowH;

      /* static parts, rebuilt on resize */
      if (svg.attr("data-w") !== String(width)) {
        svg.selectAll("*").remove();
        svg.attr("data-w", width);
        const head = svg.append("g").attr("class", "head");
        fams.forEach(function (f, j) {
          head.append("text").attr("x", x0 + j * cw + cw / 2).attr("y", headH - 10).attr("text-anchor", "middle")
            .style("font-weight", 700).style("fill", RP.famColor(f)).text(RP.FAMILY_SHORT[f]);
        });
        head.append("text").attr("class", "whead").attr("x", xw + whW / 2).attr("y", headH - 10).attr("text-anchor", "middle").style("font-weight", 600).text("all models");
        head.append("text").attr("x", xt + 4).attr("y", headH - 10).style("font-weight", 600).text("training time");
        const rows = svg.append("g").attr("class", "rows");
        const rg = rows.selectAll("g.row").data(order).join("g").attr("class", "row").attr("transform", (d, i) => "translate(0," + y(i) + ")")
          .style("cursor", "pointer").on("click", (ev, d) => goToRecipe(d));
        rg.append("rect").attr("class", "rowbg").attr("x", 0).attr("width", width).attr("height", rowH).attr("fill", "transparent");
        rg.append("text").attr("x", labelW - 10).attr("y", rowH / 2 + 4).attr("text-anchor", "end")
          .style("font-family", "var(--font-mono)").style("font-size", "11.5px").style("fill", "var(--ink)").text((d) => d);
        rg.selectAll("rect.cell").data((r) => fams.map((f) => ({ r: r, f: f }))).join("rect").attr("class", "cell")
          .attr("x", (d, j) => x0 + j * cw + 1).attr("y", 1).attr("width", cw - 2).attr("height", rowH - 2).attr("rx", 2);
        rg.selectAll("text.val").data((r) => fams.map((f) => ({ r: r, f: f }))).join("text").attr("class", "val")
          .attr("x", (d, j) => x0 + j * cw + cw / 2).attr("y", rowH / 2 + 4).attr("text-anchor", "middle")
          .style("font-size", "10.5px").style("font-variant-numeric", "tabular-nums").style("pointer-events", "none");
        rg.append("line").attr("class", "ci").attr("y1", rowH / 2).attr("y2", rowH / 2).attr("stroke-width", 1.6).attr("stroke-linecap", "round");
        rg.append("circle").attr("class", "med").attr("cy", rowH / 2).attr("r", 3.6).attr("stroke", "var(--surface)").attr("stroke-width", 1);
        rg.append("rect").attr("class", "tbar").attr("y", 5).attr("height", rowH - 10).attr("rx", 2);
        rg.append("text").attr("class", "ttxt").attr("y", rowH / 2 + 4).style("font-size", "10.5px").style("font-variant-numeric", "tabular-nums");
        svg.append("g").attr("class", "waxis axis");
        svg.append("line").attr("class", "wzero zero");
        rg.on("mouseenter", function () { d3.select(this).select(".rowbg").attr("fill", RP.css("--sunk")); })
          .on("mouseleave", function () { d3.select(this).select(".rowbg").attr("fill", "transparent"); RP.untip(); });
        rg.selectAll("rect.cell").on("mousemove", function (ev, d) {
          const c = cellOf[task + "|" + d.r + "|" + d.f];
          if (!c) return;
          const s = SPEC[task];
          RP.tip("<span class='mono'>" + d.r + "</span> · " + RP.FAMILY_SHORT[d.f] + "<br><b>" + RP.sgn(c.median) + s.unit + "</b> " +
            s.what + " [" + RP.sgn(c.lo) + ", " + RP.sgn(c.hi) + "]<br>worse than none on " + c.worse + "% of " + c.pairs + " pairs", ev);
        });
        rg.select("line.ci").on("mousemove", null);
        rg.select("circle.med").on("mousemove", function (ev, r) {
          const c = allOf[task + "|" + r];
          const s = SPEC[task];
          RP.tip("<span class='mono'>" + r + "</span> · all models<br><b>" + RP.sgn(c.median) + s.unit + "</b> [" + RP.sgn(c.lo) + ", " + RP.sgn(c.hi) +
            "]<br>" + c.pairs + " (model, target) pairs", ev);
        });
      }

      /* data-driven parts, animated between task types */
      const t = svg.transition().duration(animate ? DUR : 0);
      const wx = d3.scaleLinear().domain([-sp.xl, sp.xl]).range([xw, xw + whW]).clamp(true);
      const rows = svg.selectAll("g.row");
      rows.selectAll("rect.cell").transition(t).attr("fill", function (d) {
        const c = cellOf[task + "|" + d.r + "|" + d.f];
        return c ? RP.diverging((sp.sign * c.median) / sp.lim) : RP.css("--sunk");
      });
      rows.selectAll("text.val").text(function (d) {
        const c = cellOf[task + "|" + d.r + "|" + d.f];
        return c && Math.abs(c.median) >= sp.lab ? RP.sgn(c.median, 0) : "";
      }).style("fill", function (d) {
        const c = cellOf[task + "|" + d.r + "|" + d.f];
        return c && Math.abs(c.median) >= sp.white ? "#ffffff" : RP.css("--ink");
      });
      rows.each(function (r) {
        const c = allOf[task + "|" + r];
        const better = sp.sign < 0 ? c.hi < 0 : c.lo > 0;
        const worse = sp.sign < 0 ? c.lo > 0 : c.hi < 0;
        const col = better ? RP.css("--better") : worse ? RP.css("--worse") : RP.css("--faint");
        const g = d3.select(this);
        g.select("line.ci").transition(t).attr("x1", wx(c.lo)).attr("x2", wx(c.hi)).attr("stroke", col);
        g.select("circle.med").transition(t).attr("cx", wx(c.median)).attr("fill", col);
        const m = F.time[r];
        const tx = d3.scaleLinear().domain([-0.8, 4.2]).range([xt, xt + timeW - 34]);
        g.select("rect.tbar").attr("x", Math.min(tx(0), tx(Math.log2(m)))).attr("width", Math.abs(tx(Math.log2(m)) - tx(0)))
          .attr("fill", m < 1 ? RP.css("--better") : RP.css("--worse")).attr("opacity", 0.75);
        g.select("text.ttxt").attr("x", tx(Math.max(Math.log2(m), 0)) + 4).text("×" + m.toFixed(1));
      });
      const H2 = headH + order.length * rowH;
      svg.select("g.waxis").attr("transform", "translate(0," + (H2 + 4) + ")")
        .transition(t).call(d3.axisBottom(wx).tickValues(sp.ticks).tickFormat((v) => RP.minus(v) + (v === sp.ticks[sp.ticks.length - 1] ? sp.unit : "")).tickSizeOuter(0));
      svg.select("line.wzero").attr("x1", wx(0)).attr("x2", wx(0)).attr("y1", headH).attr("y2", H2);
      legend();
    }

    d3.selectAll("#fig1-seg button").on("click", function () {
      const tk = this.dataset.task;
      if (tk === task) return;
      task = tk;
      d3.selectAll("#fig1-seg button").attr("aria-pressed", function () { return String(this.dataset.task === task); });
      draw(true);
    });
    RP.onResize(svgEl.parentNode, function (w) { W = w - 34; draw(false); });
    RP.bus.on("theme.fig1", () => { svg.attr("data-w", null); draw(false); });
  }

  /* ------------------------------------------------------------ Fig. 4 */
  function fig4(paper) {
    const F = paper.fig4;
    const svgEl = document.getElementById("fig4-svg");
    const svg = d3.select(svgEl);
    const RULES = ["none", "global", "cv", "oracle"];
    const NAMES = { none: "no preprocessing", global: "global recipe (" + F.global_recipe + ")", cv: "per-task CV", oracle: "oracle" };
    let rule = "all", W = 700, playing = null, prevRule = "none";

    function shape(k, col) {
      const s = {
        none: (g) => g.append("circle").attr("r", 5.2).attr("fill", RP.css("--surface")).attr("stroke", col).attr("stroke-width", 1.6),
        global: (g) => g.append("circle").attr("r", 5.2).attr("fill", col).attr("stroke", RP.css("--surface")).attr("stroke-width", 1),
        cv: (g) => g.append("rect").attr("x", -4.6).attr("y", -4.6).attr("width", 9.2).attr("height", 9.2).attr("fill", col).attr("stroke", RP.css("--surface")).attr("stroke-width", 1),
        oracle: (g) => g.append("path").attr("d", "M0,-6L6,0L0,6L-6,0Z").attr("fill", RP.css("--oracle")).attr("stroke", RP.css("--surface")).attr("stroke-width", 1)
      };
      return s[k];
    }

    function draw() {
      const rows = F.rows;
      const labelW = 92, rowH = 30, top = 10, bottom = 66;
      const width = Math.max(560, W);
      const H = top + rows.length * rowH + bottom;
      svg.selectAll("*").remove();
      svg.attr("width", width).attr("height", H).attr("viewBox", "0 0 " + width + " " + H);
      const x = d3.scaleLinear().domain([-5, 290]).range([labelW, width - 16]);
      const y = (i) => top + i * rowH + rowH / 2;
      svg.append("g").attr("class", "grid").attr("transform", "translate(0," + (top + rows.length * rowH) + ")")
        .call(d3.axisBottom(x).tickValues([0, 50, 100, 150, 200, 250]).tickSize(-(rows.length * rowH)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", "translate(0," + (top + rows.length * rowH) + ")")
        .call(d3.axisBottom(x).tickValues([0, 50, 100, 150, 200, 250]).tickSizeOuter(0));
      svg.append("text").attr("x", width - 16).attr("y", top + rows.length * rowH + 32).attr("text-anchor", "end").text("RMSE above best (%)");
      const g = svg.selectAll("g.m").data(rows).join("g").attr("class", "m").attr("transform", (d, i) => "translate(0," + y(i) + ")");
      g.append("text").attr("x", labelW - 10).attr("y", 4).attr("text-anchor", "end").style("font-weight", 700)
        .style("fill", (d) => RP.famColor(d.family)).text((d) => d.model);
      g.append("line").attr("x1", (d) => x(d.oracle)).attr("x2", (d) => x(d.none)).attr("stroke", RP.css("--ghost"))
        .attr("stroke-width", 2.2).attr("stroke-linecap", "round").attr("opacity", 0.6);
      RULES.forEach(function (k) {
        g.each(function (d) {
          const mk = d3.select(this).append("g").attr("class", "mk mk-" + k).attr("transform", "translate(" + x(d[k]) + ",0)");
          shape(k, RP.famColor(d.family))(mk);
        });
      });
      g.append("circle").attr("class", "ring").attr("r", 10).attr("fill", "none").attr("stroke", RP.css("--accent"))
        .attr("stroke-width", 2).attr("opacity", 0).attr("cx", (d) => x(d.none));
      g.append("text").attr("class", "vlab").attr("y", -9).attr("text-anchor", "middle").style("font-size", "10.5px")
        .style("font-weight", 600).style("fill", "var(--ink)").style("font-variant-numeric", "tabular-nums");
      g.append("rect").attr("x", 0).attr("y", -rowH / 2).attr("width", width).attr("height", rowH).attr("fill", "transparent")
        .on("mousemove", function (ev, d) {
          RP.tip("<b>" + d.model + "</b> · " + RP.FAMILY_SHORT[d.family] + "<br>" + RULES.map((k) => NAMES[k] + ": <b>" + d[k].toFixed(0) + "%</b>").join("<br>") +
            "<br><span style='opacity:.75'>" + d.targets + " regression targets</span>", ev);
        }).on("mouseleave", RP.untip);
      /* legend */
      const lg = svg.append("g").attr("transform", "translate(" + labelW + "," + (H - 14) + ")");
      let lx = 0;
      RULES.forEach(function (k) {
        const it = lg.append("g").attr("transform", "translate(" + (lx + 6) + ",-4)");
        shape(k, RP.css("--ink"))(it);
        const tx = lg.append("text").attr("x", lx + 16).attr("y", 0).text(NAMES[k]);
        lx += 22 + tx.node().getComputedTextLength() + 14;
      });
      self.x = x;
      apply(false);
    }
    const self = {};

    function apply(animate) {
      const x = self.x;
      const t = svg.transition().duration(animate ? DUR : 0).ease(d3.easeCubicInOut);
      RULES.forEach(function (k) {
        svg.selectAll(".mk-" + k).transition(t).attr("opacity", rule === "all" || rule === k ? 1 : 0.14);
      });
      const g = svg.selectAll("g.m");
      if (rule === "all") {
        g.select(".ring").transition(t).attr("opacity", 0);
        g.select(".vlab").transition(t).attr("opacity", 0);
      } else {
        g.select(".ring").attr("cx", (d) => x(d[prevRule])).transition(t).delay((d, i) => (animate ? i * 25 : 0))
          .attr("opacity", 1).attr("cx", (d) => x(d[rule]));
        g.select(".vlab").text((d) => Math.round(d[rule]) + "%").transition(t).delay((d, i) => (animate ? i * 25 : 0))
          .attr("opacity", 1).attr("x", (d) => x(d[rule]));
        prevRule = rule;
      }
    }

    function setRule(r, animate) {
      rule = r;
      d3.selectAll("#fig4-seg button").attr("aria-pressed", function () { return String(this.dataset.rule === rule); });
      apply(animate);
    }

    function play() {
      if (playing) { clearTimeout(playing); playing = null; }
      const seq = ["none", "global", "cv", "oracle", "all"];
      let k = 0;
      prevRule = "none";
      (function step() {
        setRule(seq[k], true);
        k += 1;
        if (k < seq.length) playing = setTimeout(step, 1500);
        else playing = null;
      })();
    }

    d3.selectAll("#fig4-seg button").on("click", function () {
      if (playing) { clearTimeout(playing); playing = null; }
      setRule(this.dataset.rule, true);
    });
    d3.select("#fig4-play").on("click", play);
    RP.onResize(svgEl.parentNode, function (w) { W = w - 34; draw(); });
    if (!RP.reduced) RP.onVisible(svgEl, play, 0.5);
    RP.bus.on("theme.fig4", draw);
  }

  /* ------------------------------------------------------------ Fig. 2 tabs, lightbox */
  function tabs() {
    const dlg = document.getElementById("lightbox");
    d3.selectAll("[data-zoom]").on("click", function () {
      const srcs = this.dataset.src.split(" ");
      const box = dlg.querySelector(".lb-figs");
      box.innerHTML = "";
      srcs.forEach(function (s) {
        const im = document.createElement("img");
        im.src = s; im.alt = "Figure as printed in the paper";
        box.appendChild(im);
      });
      dlg.showModal();
    });
    dlg.querySelector(".close").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.close(); });
  }

  /* ------------------------------------------------------------ Fig. 2: critical-difference diagrams */
  function fig2(paper) {
    const F = paper.fig2;
    const svgEl = document.getElementById("fig2-svg");
    const svg = d3.select(svgEl);
    let task = "regression", W = 800, hover = null, first = true;
    const gAxis = svg.append("g").attr("class", "axis");
    const gCl = svg.append("g");
    const gLimbs = svg.append("g");
    const cdG = svg.append("g");

    function layout() {
      const d = F[task];
      const k = d.ranks.length, nLeft = Math.ceil(k / 2), rowH = 22;
      const width = Math.max(640, W);
      const labW = 158;
      const lo = Math.floor(d.ranks[0].rank - 0.5), hi = Math.ceil(d.ranks[k - 1].rank + 0.5);
      const x = d3.scaleLinear().domain([lo, hi]).range([labW + 14, width - labW - 14]);
      const nCl = Math.max(F.regression.cliques.length, F.classification.cliques.length);
      const axisY = 46 + nCl * 6 + 18;
      const rows = d.ranks.map((r, i) => {
        const left = i < nLeft;
        const row = left ? i : k - 1 - i;
        return Object.assign({}, r, { i: i, left: left, y: axisY + 18 + (row + 1) * rowH, x: x(r.rank),
          anchor: left ? x.range()[0] : x.range()[1] });
      });
      return { d, k, x, axisY, rows, width, H: axisY + 18 + (nLeft + 1) * rowH + 6, lo, hi };
    }

    function draw(animate) {
      const L = layout();
      const t = svg.transition().duration(animate ? DUR : 0).ease(d3.easeCubicInOut);
      svg.attr("width", L.width).attr("height", L.H).attr("viewBox", "0 0 " + L.width + " " + L.H);
      gAxis.attr("transform", "translate(0," + L.axisY + ")").transition(t)
        .call(d3.axisTop(L.x).ticks(L.hi - L.lo).tickFormat(d3.format("d")).tickSizeOuter(0));
      const noneIdx = L.d.ranks.findIndex((r) => r.recipe === "none");
      const cl = gCl.selectAll("line").data(L.d.cliques).join(
        (en) => en.append("line").attr("stroke-width", 3.4).attr("stroke-linecap", "round").attr("opacity", 0)
          .attr("x1", (c) => L.x(L.d.ranks[c[0]].rank)).attr("x2", (c) => L.x(L.d.ranks[c[0]].rank)));
      cl.attr("y1", (c, j) => L.axisY - 24 - j * 6).attr("y2", (c, j) => L.axisY - 24 - j * 6)
        .attr("stroke", (c) => (c[0] <= noneIdx && noneIdx <= c[1] ? RP.css("--ghost") : RP.css("--worse")))
        .transition(t).attr("opacity", 1)
        .attr("x1", (c) => L.x(L.d.ranks[c[0]].rank) - 3).attr("x2", (c) => L.x(L.d.ranks[c[1]].rank) + 3);
      const path = (r) => "M" + r.x + "," + L.axisY + "V" + r.y + "H" + r.anchor;
      const g = gLimbs.selectAll("g.limb").data(L.rows, (r) => r.recipe).join((en) => {
        const e = en.append("g").attr("class", "limb").style("cursor", "pointer");
        e.append("path").attr("fill", "none");
        e.append("text").style("font-family", "var(--font-mono)").style("font-size", "11.5px");
        e.append("rect").attr("fill", "transparent");
        return e;
      });
      g.select("path").transition(t).attr("d", path)
        .attr("stroke", (r) => (r.recipe === "none" ? RP.css("--ink") : RP.css("--ghost")))
        .attr("stroke-width", (r) => (r.recipe === "none" ? 2 : 1.1));
      g.select("text").attr("text-anchor", (r) => (r.left ? "end" : "start"))
        .style("font-weight", (r) => (r.recipe === "none" ? 700 : 400))
        .style("fill", (r) => (r.vs_none === "better" ? RP.css("--ink") : RP.css("--muted")))
        .text((r) => r.recipe)
        .transition(t).attr("x", (r) => r.anchor + (r.left ? -8 : 8)).attr("y", (r) => r.y + 4);
      g.select("rect").attr("x", (r) => (r.left ? r.anchor - 156 : r.x)).attr("y", (r) => r.y - 10)
        .attr("width", (r) => (r.left ? r.x - r.anchor + 156 : r.anchor - r.x + 156)).attr("height", 20);
      g.on("mouseenter", function (ev, r) { hover = r.recipe; focus(L); })
        .on("mousemove", function (ev, r) {
          const d = L.d;
          RP.tip("<span class='mono'>" + r.recipe + "</span><br>mean rank <b>" + r.rank.toFixed(2) + "</b> (" + (r.i + 1) + " of " + d.ranks.length + ")<br>" +
            (r.recipe === "none" ? "the reference" : r.vs_none === "better" ? "ranks significantly above none" :
              r.vs_none === "worse" ? "ranks significantly below none" : "not significantly different from none"), ev);
        })
        .on("mouseleave", function () { hover = null; focus(L); RP.untip(); })
        .on("click", (ev, r) => goToRecipe(r.recipe));
      cdG.selectAll("*").remove();
      const x0 = L.x.range()[0];
      cdG.append("line").attr("x1", x0).attr("x2", x0 + L.x(L.lo + L.d.cd) - L.x(L.lo)).attr("y1", 18).attr("y2", 18)
        .attr("stroke", RP.css("--ink")).attr("stroke-width", 2);
      [x0, x0 + L.x(L.lo + L.d.cd) - L.x(L.lo)].forEach((xx) => cdG.append("line").attr("x1", xx).attr("x2", xx).attr("y1", 13).attr("y2", 23).attr("stroke", RP.css("--ink")));
      cdG.append("text").attr("x", x0 + L.x(L.lo + L.d.cd) - L.x(L.lo) + 8).attr("y", 22).style("fill", RP.css("--ink"))
        .text("CD = " + L.d.cd.toFixed(2) + ", N = " + d3.format(",")(L.d.n_blocks) + " (model, target) pairs");
      focus(L);
      if (animate === "intro") {
        g.select("path").each(function (r, i) {
          const len = this.getTotalLength();
          d3.select(this).attr("stroke-dasharray", len + " " + len).attr("stroke-dashoffset", len)
            .transition().delay(i * 35).duration(700).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
            .on("end", function () { d3.select(this).attr("stroke-dasharray", null); });
        });
        g.select("text").attr("opacity", 0).transition().delay((r, i) => 300 + i * 35).duration(400).attr("opacity", 1);
        cl.attr("opacity", 0).transition().delay((c, j) => 900 + j * 60).duration(400).attr("opacity", 1);
      }
    }

    function focus(L) {
      const idx = hover ? L.d.ranks.findIndex((r) => r.recipe === hover) : -1;
      gLimbs.selectAll("g.limb").attr("opacity", (r) => (idx < 0 || r.recipe === hover ? 1 : 0.35))
        .select("path").attr("stroke", (r) => (r.recipe === hover ? RP.css("--accent") : r.recipe === "none" ? RP.css("--ink") : RP.css("--ghost")))
        .attr("stroke-width", (r) => (r.recipe === hover ? 2.4 : r.recipe === "none" ? 2 : 1.1));
      gCl.selectAll("line").attr("opacity", (c) => (idx < 0 || (c[0] <= idx && idx <= c[1]) ? 1 : 0.12));
    }

    d3.selectAll("#fig2-seg button").on("click", function () {
      if (this.dataset.task === task) return;
      task = this.dataset.task;
      d3.selectAll("#fig2-seg button").attr("aria-pressed", function () { return String(this.dataset.task === task); });
      draw(true);
    });
    RP.onResize(svgEl.parentNode, function (w) { W = w - 34; draw(false); });
    if (!RP.reduced) RP.onVisible(svgEl, () => draw("intro"), 0.3);
    RP.bus.on("theme.fig2", () => draw(false));
  }

  /* ------------------------------------------------------------ Fig. 3: variance shares */
  function fig3(paper) {
    const rows = paper.fig3;
    const svgEl = document.getElementById("fig3-svg");
    const svg = d3.select(svgEl);
    const COMP = [
      { k: "model", name: "model", col: () => RP.css("--oracle"), txt: () => RP.css("--surface") },
      { k: "recipe", name: "recipe", col: () => RP.css("--better"), txt: () => "#ffffff" },
      { k: "interaction", name: "model × recipe", col: () => "#56b4e9", txt: () => "#0d141b" },
      { k: "noise", name: "fold noise", col: () => RP.css("--ghost"), txt: () => "#0d141b" }
    ];
    let first = null, W = 700;

    function draw(animate) {
      const width = Math.max(520, W), labW = 170, rowH = 46, top = 8, H = top + rows.length * rowH + 34;
      svg.attr("width", width).attr("height", H).attr("viewBox", "0 0 " + width + " " + H);
      const x = d3.scaleLinear().domain([0, 100]).range([labW, width - 20]);
      const order = first ? [COMP.find((c) => c.k === first)].concat(COMP.filter((c) => c.k !== first)) : COMP;
      svg.selectAll("g.ax").data([0]).join("g").attr("class", "ax axis").attr("transform", "translate(0," + (top + rows.length * rowH + 4) + ")")
        .call(d3.axisBottom(x).tickValues([0, 25, 50, 75, 100]).tickFormat((v) => v + "%").tickSizeOuter(0));
      const rg = svg.selectAll("g.vrow").data(rows).join((en) => {
        const e = en.append("g").attr("class", "vrow");
        e.append("text").attr("class", "lab").attr("x", labW - 12).attr("y", rowH / 2 - 2).attr("text-anchor", "end").style("fill", "var(--ink)").style("font-weight", 600);
        e.append("text").attr("class", "sub").attr("x", labW - 12).attr("y", rowH / 2 + 12).attr("text-anchor", "end");
        return e;
      }).attr("transform", (r, i) => "translate(0," + (top + i * rowH) + ")");
      rg.select(".lab").text((r) => r.label);
      rg.select(".sub").text((r) => "N = " + r.n_models + " models, " + r.n_targets + " targets");
      const t = svg.transition().duration(animate ? DUR : 0).ease(d3.easeCubicInOut);
      rg.each(function (r, ri) {
        let acc = 0;
        const segs = order.map((c) => { const s = { c: c, v: r.shares[c.k], x0: acc, row: r }; acc += r.shares[c.k] + 0.6; return s; });
        const g = d3.select(this);
        const sg = g.selectAll("g.seg").data(segs, (s) => s.c.k).join((en) => {
          const e = en.append("g").attr("class", "seg").style("cursor", "pointer");
          e.append("rect").attr("y", 6).attr("height", rowH - 16).attr("rx", 3).attr("x", labW).attr("width", 0);
          e.append("text").attr("y", rowH / 2 + 3).attr("text-anchor", "middle").style("font-size", "12px").style("font-weight", 700).style("font-variant-numeric", "tabular-nums");
          return e;
        });
        const rect = sg.select("rect").attr("fill", (s) => s.c.col())
          .attr("opacity", (s) => (!first || s.c.k === first ? 1 : 0.35));
        if (animate === "intro") rect.attr("x", labW).attr("width", 0);
        rect.transition(t).delay(animate === "intro" ? ri * 120 : 0).attr("x", (s) => x(s.x0)).attr("width", (s) => Math.max(0, x(s.v) - x(0)));
        const txt = sg.select("text").text((s) => (s.v >= 6 ? Math.round(s.v) : "")).style("fill", (s) => s.c.txt());
        if (animate === "intro") txt.attr("x", labW);
        txt.transition(t).delay(animate === "intro" ? ri * 120 : 0).attr("x", (s) => x(s.x0 + s.v / 2));
        sg.on("mousemove", (ev, s) => RP.tip("<b>" + s.row.label + "</b><br>" + s.c.name + ": <b>" + s.v.toFixed(0) + "%</b> of the variance<br><span style='opacity:.75'>median over " + s.row.n_targets + " targets</span>", ev))
          .on("mouseleave", RP.untip)
          .on("click", (ev, s) => { first = first === s.c.k ? null : s.c.k; draw(true); legend(); });
      });
    }

    function legend() {
      d3.select("#fig3-legend").selectAll("button").data(COMP).join("button").attr("type", "button")
        .attr("aria-pressed", (c) => String(first === c.k))
        .html((c) => "<i style='background:" + c.col() + ";border-radius:2px'></i>" + c.name)
        .on("click", (ev, c) => { first = first === c.k ? null : c.k; legend(); draw(true); });
    }
    legend();
    RP.onResize(svgEl.parentNode, function (w) { W = w - 34; draw(false); });
    if (!RP.reduced) RP.onVisible(svgEl, () => draw("intro"), 0.4);
    RP.bus.on("theme.fig3", () => { legend(); draw(false); });
  }

  /* ------------------------------------------------------------ Fig. 5: in-sample vs held out */
  function fig5(paper) {
    const F = paper.fig5;
    const svgEl = document.getElementById("fig5-svg");
    const svg = d3.select(svgEl);
    let W = 900, phase = "held";
    const SPEC = {
      regression: { title: "(a) Regression: change in RMSE (%)", dom: [-33, 13], better: "← better" },
      classification: { title: "(b) Classification: change in balanced accuracy (pp)", dom: [-4, 24], better: "better →" }
    };

    function draw(mode) {
      const width = Math.max(560, W);
      const side = width >= 760;
      const pw = side ? (width - 30) / 2 : width;
      const rowH = 22, top = 36;
      const ph = (task) => top + F[task].length * rowH + 40;
      const H = side ? Math.max(ph("regression"), ph("classification")) : ph("regression") + ph("classification") + 10;
      svg.attr("width", width).attr("height", H).attr("viewBox", "0 0 " + width + " " + H);
      svg.selectAll("*").remove();
      ["regression", "classification"].forEach(function (task, pi) {
        const sp = SPEC[task];
        const ox = side ? pi * (pw + 30) : 0, oy = side ? 0 : pi * (ph("regression") + 10);
        const g = svg.append("g").attr("transform", "translate(" + ox + "," + oy + ")");
        const labW = 92;
        const x = d3.scaleLinear().domain(sp.dom).range([labW, pw - 10]);
        const rows = F[task];
        const y = (i) => top + i * rowH + rowH / 2;
        g.append("text").attr("x", 0).attr("y", 14).style("font-weight", 600).style("fill", "var(--ink)").text(sp.title);
        g.append("text").attr("x", pw - 10).attr("y", 14).attr("text-anchor", "end").style("fill", "var(--better)").style("font-weight", 600).text(sp.better);
        g.append("g").attr("class", "grid").attr("transform", "translate(0," + (top + rows.length * rowH) + ")")
          .call(d3.axisBottom(x).ticks(6).tickSize(-(rows.length * rowH)).tickFormat(""));
        g.append("g").attr("class", "axis").attr("transform", "translate(0," + (top + rows.length * rowH) + ")")
          .call(d3.axisBottom(x).ticks(6).tickFormat((v) => RP.minus(v)).tickSizeOuter(0));
        g.append("line").attr("class", "zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", top - 4).attr("y2", top + rows.length * rowH);
        const r = g.selectAll("g.m5").data(rows).join("g").attr("class", "m5").attr("transform", (d, i) => "translate(0," + y(i) + ")");
        r.append("text").attr("x", labW - 10).attr("y", 4).attr("text-anchor", "end").style("font-weight", 700)
          .style("fill", (d) => RP.famColor(d.family)).text((d) => d.model);
        const ci = r.append("line").attr("stroke", (d) => RP.famColor(d.family)).attr("stroke-width", 2).attr("stroke-linecap", "round")
          .attr("opacity", (d) => (d.stable ? 0.9 : 0.45));
        r.append("line").attr("class", "tick").attr("x1", (d) => x(d.ins)).attr("x2", (d) => x(d.ins)).attr("y1", -8).attr("y2", 8)
          .attr("stroke", RP.css("--ink")).attr("stroke-width", 2);
        const dot = r.append("circle").attr("r", 5).attr("stroke", (d) => RP.famColor(d.family)).attr("stroke-width", 1.6)
          .attr("fill", (d) => (d.stable ? RP.famColor(d.family) : RP.css("--surface")));
        r.append("rect").attr("x", 0).attr("y", -rowH / 2).attr("width", pw).attr("height", rowH).attr("fill", "transparent")
          .on("mousemove", function (ev, d) {
            const u = task === "regression" ? "%" : " pp";
            RP.tip("<b>" + d.model + "</b> · best recipe <span class='mono'>" + d.recipe + "</span><br>chosen and scored on all datasets: <b>" + RP.sgn(d.ins) + u +
              "</b><br>held out: <b>" + RP.sgn(d.held) + u + "</b> [" + RP.sgn(d.lo) + ", " + RP.sgn(d.hi) + "]<br>" +
              (d.stable ? "interval excludes 0" : "interval includes 0"), ev);
          }).on("mouseleave", RP.untip);
        const end = (sel) => sel.attr("cx", (d) => x(d.held));
        const endCi = (sel) => sel.attr("x1", (d) => x(d.lo)).attr("x2", (d) => x(d.hi));
        if (mode === "replay") {
          dot.attr("cx", (d) => x(d.ins));
          ci.attr("x1", (d) => x(d.ins)).attr("x2", (d) => x(d.ins));
          dot.transition().delay((d, i) => 400 + i * 50).duration(900).ease(d3.easeCubicInOut).call(end);
          ci.transition().delay((d, i) => 400 + i * 50).duration(900).ease(d3.easeCubicInOut).call(endCi);
        } else { end(dot); endCi(ci); }
      });
    }
    d3.select("#fig5-play").on("click", () => draw("replay"));
    RP.onResize(svgEl.parentNode, function (w) { W = w - 34; draw(); });
    if (!RP.reduced) RP.onVisible(svgEl, () => draw("replay"), 0.35);
    RP.bus.on("theme.fig5", () => draw());
  }

  /* ------------------------------------------------------------ Fig. 6: selection by size */
  function fig6(paper) {
    const F = paper.fig6;
    const svgEl = document.getElementById("fig6-svg");
    const svg = d3.select(svgEl);
    const RULES = [
      { k: "global", name: "global recipe", col: () => "#56b4e9", shape: d3.symbolCircle },
      { k: "family", name: "family recipe", col: () => "#e69f00", shape: d3.symbolSquare },
      { k: "nested", name: "per-task CV", col: () => RP.css("--better"), shape: d3.symbolDiamond }
    ];
    const on = { global: true, family: true, nested: true };
    let W = 900, hoverKey = null;
    const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return ((h >>> 0) % 1000) / 1000; };
    const toLog = (v) => Math.log(1 + v / 100);
    const lo = toLog(-75), hi = toLog(100);

    function draw(mode) {
      const width = Math.max(640, W), H = 380, M = { l: 58, r: 12, t: 34, b: 52 };
      svg.attr("width", width).attr("height", H).attr("viewBox", "0 0 " + width + " " + H);
      svg.selectAll("*").remove();
      const gx = d3.scaleBand().domain(F.groups.map((g) => g.n_lo)).range([M.l, width - M.r]).paddingInner(0.08);
      const y = d3.scaleLinear().domain([lo, hi]).range([H - M.b, M.t]).clamp(true);
      const ticks = [-75, -50, -25, 0, 50, 100];
      svg.append("g").attr("class", "grid").attr("transform", "translate(" + M.l + ",0)")
        .call(d3.axisLeft(y).tickValues(ticks.map(toLog)).tickSize(-(width - M.l - M.r)).tickFormat(""));
      svg.append("g").attr("class", "axis").attr("transform", "translate(" + M.l + ",0)")
        .call(d3.axisLeft(y).tickValues(ticks.map(toLog)).tickFormat((v, i) => (ticks[i] > 0 ? "+" : "") + RP.minus(ticks[i]) + "%").tickSizeOuter(0));
      svg.append("text").attr("transform", "rotate(-90)").attr("x", -(M.t + (H - M.b)) / 2).attr("y", 11).attr("text-anchor", "middle").text("change in RMSE against none");
      svg.append("line").attr("class", "zero").attr("x1", M.l).attr("x2", width - M.r).attr("y1", y(0)).attr("y2", y(0)).style("stroke-dasharray", null);
      const sep = gx(F.groups[1].n_lo) - gx.step() * gx.paddingInner() / 2;
      svg.append("line").attr("x1", sep).attr("x2", sep).attr("y1", M.t - 20).attr("y2", H - M.b).attr("stroke", RP.css("--ink")).attr("stroke-width", 1.2);
      svg.append("text").attr("x", sep - 6).attr("y", M.t - 24).attr("text-anchor", "end").style("font-weight", 600).text("small-data ablation");
      svg.append("text").attr("x", sep + 6).attr("y", M.t - 24).style("font-weight", 600).text("benchmark targets");
      const sub = d3.scaleBand().domain(RULES.map((r) => r.k)).range([0, gx.bandwidth()]).paddingInner(0.12).paddingOuter(0.1);
      F.groups.forEach(function (g) {
        svg.append("text").attr("x", gx(g.n_lo) + gx.bandwidth() / 2).attr("y", H - M.b + 18).attr("text-anchor", "middle")
          .style("font-weight", 600).style("fill", "var(--ink)").text(g.label + " spectra");
        svg.append("text").attr("x", gx(g.n_lo) + gx.bandwidth() / 2).attr("y", H - M.b + 33).attr("text-anchor", "middle").text("N = " + g.n + " targets");
      });
      const linkG = svg.append("g");
      const ptsG = svg.append("g");
      const medG = svg.append("g");
      RULES.forEach(function (rule, ri) {
        if (!on[rule.k]) return;
        const pts = F.targets.map((t) => ({ t: t, v: t[rule.k],
          cx: gx(t.g) + sub(rule.k) + sub.bandwidth() * (0.18 + 0.64 * hash(t.key + rule.k)) }));
        const sym = d3.symbol().type(rule.shape).size(30);
        const p = ptsG.selectAll(null).data(pts).join("path").attr("class", "pt").attr("d", sym)
          .attr("fill", rule.col()).attr("opacity", 0.7).style("cursor", "pointer")
          .attr("transform", (d) => "translate(" + d.cx + "," + (mode === "intro" ? y(0) : y(toLog(d.v))) + ")")
          .on("mouseenter", function (ev, d) { hoverKey = d.t.key; link(); })
          .on("mousemove", function (ev, d) {
            const t = d.t;
            RP.tip("<span class='mono'>" + t.key + "</span><br>" + RULES.map((r) => r.name + ": <b>" + RP.sgn(t[r.k], 1) + "%</b>").join("<br>") +
              "<br><span style='opacity:.75'>median over " + F.n_models + " models</span>", ev);
          })
          .on("mouseleave", function () { hoverKey = null; link(); RP.untip(); });
        if (mode === "intro") {
          p.attr("opacity", 0).transition().delay((d, i) => ri * 250 + (d.t.g / 20) + i * 3).duration(800).ease(d3.easeBackOut.overshoot(0.8))
            .attr("opacity", 0.7).attr("transform", (d) => "translate(" + d.cx + "," + y(toLog(d.v)) + ")");
        }
        F.groups.forEach(function (g) {
          const cx = gx(g.n_lo) + sub(rule.k);
          const m = medG.append("line").attr("x1", cx + 2).attr("x2", cx + sub.bandwidth() - 2)
            .attr("stroke", RP.css("--ink")).attr("stroke-width", 2.4)
            .attr("y1", y(toLog(g.median[rule.k]))).attr("y2", y(toLog(g.median[rule.k])));
          medG.append("text").attr("x", cx + sub.bandwidth() / 2).attr("y", M.t - 6).attr("text-anchor", "middle")
            .style("font-variant-numeric", "tabular-nums").style("fill", rule.col()).style("font-weight", 700).text(g.worse[rule.k]);
          medG.append("rect").attr("x", cx).attr("width", sub.bandwidth()).attr("y", y(toLog(g.median[rule.k])) - 5).attr("height", 10).attr("fill", "transparent")
            .on("mousemove", (ev) => RP.tip("<b>" + rule.name + "</b>, " + g.label + " spectra<br>group median: <b>" + RP.sgn(g.median[rule.k], 1) + "%</b><br>worse than none on " + g.worse[rule.k] + "% of " + g.n + " targets", ev))
            .on("mouseleave", RP.untip);
          if (mode === "intro") m.attr("opacity", 0).transition().delay(900 + ri * 250).duration(500).attr("opacity", 1);
        });
      });
      function link() {
        linkG.selectAll("*").remove();
        ptsG.selectAll("path.pt").attr("opacity", (d) => (!hoverKey ? 0.7 : d.t.key === hoverKey ? 1 : 0.15))
          .attr("stroke", (d) => (d.t.key === hoverKey ? RP.css("--ink") : null));
        if (!hoverKey) return;
        const ps = ptsG.selectAll("path.pt").filter((d) => d.t.key === hoverKey).data();
        linkG.append("path").attr("fill", "none").attr("stroke", RP.css("--ink")).attr("stroke-width", 1.2).attr("stroke-dasharray", "3 2")
          .attr("d", d3.line()(ps.map((d) => [d.cx, y(toLog(d.v))])));
      }
    }

    function legend() {
      d3.select("#fig6-legend").selectAll("button").data(RULES).join("button").attr("type", "button")
        .attr("aria-pressed", (r) => String(on[r.k]))
        .html((r) => "<i style='background:" + r.col() + "'></i>" + r.name)
        .on("click", function (ev, r) {
          on[r.k] = !on[r.k];
          if (!RULES.some((x) => on[x.k])) on[r.k] = true;
          legend(); draw();
        });
    }
    legend();
    d3.select("#fig6-play").on("click", () => draw("intro"));
    RP.onResize(svgEl.parentNode, function (w) { W = w - 34; draw(); });
    if (!RP.reduced) RP.onVisible(svgEl, () => draw("intro"), 0.35);
    RP.bus.on("theme.fig6", () => { legend(); draw(); });
  }

  RP.figures = {
    init: function (paper) { fig1(paper); fig2(paper); fig3(paper); fig4(paper); fig5(paper); fig6(paper); tabs(); }
  };
})();
