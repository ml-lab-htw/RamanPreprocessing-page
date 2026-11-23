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
    d3.selectAll("#fig2-seg button").on("click", function () {
      const src = this.dataset.src;
      d3.selectAll("#fig2-seg button").attr("aria-pressed", function () { return String(this.dataset.src === src); });
      const img = d3.select("#fig2-img");
      if (RP.reduced) { img.attr("src", src); return; }
      img.transition().duration(180).style("opacity", 0).on("end", function () {
        img.attr("src", src).transition().duration(260).style("opacity", 1);
      });
    });
    const dlg = document.getElementById("lightbox");
    d3.selectAll("[data-zoom]").on("click", function () {
      const img = this.querySelector("img");
      dlg.querySelector("img").src = img.getAttribute("src");
      dlg.querySelector("img").alt = img.alt;
      dlg.showModal();
    });
    dlg.querySelector(".close").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (ev) => { if (ev.target === dlg) dlg.close(); });
  }

  RP.figures = {
    init: function (paper) { fig1(paper); fig4(paper); tabs(); }
  };
})();
