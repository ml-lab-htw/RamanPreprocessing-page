/* Paper tables 1-6 as HTML, values from data/paper.json (parsed from the paper's .tex) and data/recipes.json. */
(function () {
  "use strict";
  const RP = window.RP;
  const M = (s) => RP.minus(s);

  function goToRecipe(key) {
    RP.bus.call("recipe", null, key);
    document.getElementById("explorer").scrollIntoView({ behavior: RP.reduced ? "auto" : "smooth" });
  }

  function table1(t) {
    const T = d3.select("#t1");
    const th = T.append("thead");
    const r1 = th.append("tr");
    r1.append("th").attr("colspan", 3);
    r1.append("th").attr("class", "grp").attr("colspan", 5).text("Models with varied preprocessing");
    r1.append("th").attr("colspan", 4);
    th.append("tr").selectAll("th").data(t.columns).join("th").attr("class", (d, i) => (i >= 8 && i <= 10 ? "l" : null)).text((d) => d);
    const tb = T.append("tbody");
    t.rows.forEach(function (r) {
      tb.append("tr").selectAll("td").data(r).join("td").attr("class", (d, i) => (i >= 8 && i <= 10 ? "l" : null)).text((d) => d);
    });
    t.ours.forEach(function (r, k) {
      tb.append("tr").attr("class", k === 0 ? "ours" : "ours sub").selectAll("td").data(r).join("td")
        .attr("class", (d, i) => (i >= 8 && i <= 10 ? "l" : null)).text((d, i) => (k === 1 && i === 0 ? " " + d : d));
    });
  }

  function table2(rows) {
    const T = d3.select("#t2");
    const th = T.append("thead");
    const r1 = th.append("tr");
    r1.append("th").attr("colspan", 2);
    r1.append("th").attr("class", "grp").attr("colspan", 2).text("Removed");
    r1.append("th").attr("class", "grp").attr("colspan", 5).text("Remaining");
    th.append("tr").selectAll("th").data(["Step", "Criterion", "Datasets", "Targets", "Datasets", "Targets", "", "Class.", "Regr."])
      .join("th").attr("class", (d, i) => (i === 1 ? "l" : null)).text((d) => d);
    const max = rows[0].targets;
    const tb = T.append("tbody");
    rows.forEach(function (r, k) {
      const last = k === rows.length - 1;
      const tr = tb.append("tr").attr("class", last ? "total ours" : null);
      tr.append("td").text(r.step);
      tr.append("td").attr("class", "l").style("white-space", "normal").style("min-width", "200px")
        .html(r.criterion + (r.step === "Small data" ? "<br><span style='color:var(--muted)'>→ small-data ablation</span>" : ""));
      tr.append("td").text(r.removed[0] === null ? "–" : r.removed[0]);
      tr.append("td").text(r.removed[1] === null ? "–" : r.removed[1]);
      tr.append("td").text(r.datasets);
      tr.append("td").text(r.targets);
      const fc = tr.append("td").attr("class", "fcell").append("div").attr("class", "row");
      fc.append("div").attr("class", "fbar").style("width", (100 * r.targets / max) + "%").style("transform", "scaleX(" + (RP.reduced ? 1 : 0.02) + ")")
        .style("opacity", last ? 1 : 0.55);
      if (r.removed[1]) fc.append("span").attr("class", "removed").text("−" + r.removed[1]);
      tr.append("td").text(r.classification);
      tr.append("td").text(r.regression);
    });
    RP.onVisible(document.getElementById("t2"), function () {
      d3.selectAll("#t2 .fbar").each(function (d, i) {
        const el = this;
        setTimeout(() => { el.style.transform = "scaleX(1)"; }, i * 160);
      });
    }, 0.4);
  }

  function table3(rec) {
    const T = d3.select("#t3");
    T.append("thead").append("tr").selectAll("th").data(["Recipe"].concat(rec.stages)).join("th")
      .style("text-align", (d, i) => (i === 0 ? "left" : "center")).text((d) => d);
    const tb = T.append("tbody");
    d3.groups(rec.recipes, (d) => d.group).forEach(function ([g, rs]) {
      if (g !== "Reference") tb.append("tr").attr("class", "grouprow").append("td").attr("colspan", 10).text(g);
      rs.forEach(function (r) {
        const tr = tb.append("tr").attr("class", "rec").datum(r).on("click", () => goToRecipe(r.key));
        tr.append("td").append("button").attr("type", "button").attr("class", "rlink").text(r.key)
          .on("click", (ev) => { ev.stopPropagation(); goToRecipe(r.key); });
        if (r.key === "gcu_lvse" || r.key === "prep_ensemble") {
          tr.append("td").attr("class", "span").attr("colspan", 9).html(r.key === "gcu_lvse" ?
            "<code>gcu</code> features and <code>lvse</code> features" :
            "outputs of <code>snv</code>, <code>emsc</code>, <code>airpls_snv</code> and <code>none</code>");
          return;
        }
        rec.stages.forEach(function (s) {
          const v = r.stages[s];
          tr.append("td").attr("class", v ? "on" : null).text(v || "");
        });
      });
    });
    RP.bus.on("recipe.t3", function (key) {
      tb.selectAll("tr.rec").classed("current", (d) => d.key === key);
    });
  }

  function iqrBar(lo, hi, med, dom, sig, betterNeg) {
    const x = d3.scaleLinear().domain(dom).range([4, 146]).clamp(true);
    const good = betterNeg ? med < 0 : med > 0;
    const col = !sig ? RP.css("--faint") : good ? RP.css("--better") : RP.css("--worse");
    return "<svg viewBox='0 0 150 18'><line x1='" + x(0) + "' x2='" + x(0) + "' y1='1' y2='17' stroke='" + RP.css("--line") + "'/>" +
      "<rect x='" + x(lo) + "' y='6' width='" + Math.max(2, x(hi) - x(lo)) + "' height='6' rx='3' fill='" + col + "' opacity='.3'/>" +
      "<circle cx='" + x(med) + "' cy='9' r='3.8' fill='" + col + "'/></svg>";
  }

  function table4(rows) {
    const T = d3.select("#t4");
    const cols = [
      { k: "recipe", label: "Recipe", get: (d) => d.recipe },
      { k: "reg", label: "ΔRMSE (%)", get: (d) => d.reg.median },
      { k: "regiqr", label: "pairs, 25th–75th pct.", get: null },
      { k: "regw", label: "Worse (%)", get: (d) => d.reg.worse },
      { k: "cls", label: "ΔBA (pp)", get: (d) => -d.cls.median },
      { k: "clsiqr", label: "pairs, 25th–75th pct.", get: null },
      { k: "clsw", label: "Worse (%)", get: (d) => d.cls.worse }
    ];
    const th = T.append("thead");
    const g = th.append("tr");
    g.append("th");
    g.append("th").attr("class", "grp").attr("colspan", 3).text("Regression (lower is better)");
    g.append("th").attr("class", "grp").attr("colspan", 3).text("Classification (higher is better)");
    const hr = th.append("tr").selectAll("th").data(cols).join("th").attr("class", (d) => (d.get ? "sort" : null))
      .style("text-align", (d) => (d.k.endsWith("iqr") ? "center" : null)).text((d) => d.label);
    const tb = T.append("tbody");
    let sortKey = "reg", asc = true;
    function render() {
      const c = cols.find((x) => x.k === sortKey);
      const data = rows.slice().sort((a, b) => {
        const va = c.get(a), vb = c.get(b);
        const r = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return asc ? r : -r;
      });
      hr.attr("aria-sort", (d) => (d.k === sortKey ? (asc ? "ascending" : "descending") : null));
      tb.selectAll("tr").data(data, (d) => d.recipe).join("tr").order().html(function (d) {
        const rg = d.reg.significant ? "" : " gray", cg = d.cls.significant ? "" : " gray";
        return "<td><button type='button' class='rlink'>" + d.recipe + "</button></td>" +
          "<td class='" + rg + "'>" + M(d.reg.text) + "</td>" +
          "<td class='bar' title='" + M(d.reg.iqr[0]) + " … " + M(d.reg.iqr[1]) + "'>" + iqrBar(d.reg.iqr[0], d.reg.iqr[1], d.reg.median, [-32, 12], d.reg.significant, true) + "</td>" +
          "<td>" + d.reg.worse + "</td>" +
          "<td class='" + cg + "'>" + M(d.cls.text) + "</td>" +
          "<td class='bar' title='" + M(d.cls.iqr[0]) + " … " + M(d.cls.iqr[1]) + "'>" + iqrBar(d.cls.iqr[0], d.cls.iqr[1], d.cls.median, [-4, 10], d.cls.significant, false) + "</td>" +
          "<td>" + d.cls.worse + "</td>";
      }).select("button").on("click", (ev, d) => goToRecipe(d.recipe));
    }
    hr.filter((d) => d.get).on("click", function (ev, d) {
      if (sortKey === d.k) asc = !asc; else { sortKey = d.k; asc = true; }
      render();
    });
    render();
    RP.bus.on("theme.t4", render);
  }

  function med(c) {
    return "<span class='" + (c.gray ? "gray" : "") + (c.bold ? " bold" : "") + "'>" + M(c.median) +
      "<span class='ci'>[" + M(c.ci[0]) + ", " + M(c.ci[1]) + "]</span></span>";
  }

  function table5(rows) {
    const T = d3.select("#t5");
    const th = T.append("thead");
    const g = th.append("tr");
    g.append("th");
    g.append("th").attr("class", "grp").attr("colspan", 2).html("Global recipe (<code>bc_snv_avgpool</code>)");
    g.append("th").attr("class", "grp").attr("colspan", 3).text("Family recipe");
    g.append("th").attr("class", "grp").attr("colspan", 2).text("Per-task CV");
    g.append("th").attr("class", "grp").text("Oracle");
    th.append("tr").selectAll("th").data(["Family (models)", "Median", "Worse (%)", "Recipe", "Median", "Worse (%)", "Median", "Worse (%)", "Median"])
      .join("th").attr("class", (d, i) => (i === 3 ? "l" : null)).text((d) => d);
    const tb = T.append("tbody");
    rows.forEach(function (r, k) {
      const tr = tb.append("tr").attr("class", k === rows.length - 1 ? "total" : null);
      tr.append("td").text(r.family);
      tr.append("td").html(med(r.global));
      tr.append("td").text(r.global.worse);
      const fr = r.family_recipe.recipe;
      tr.append("td").attr("class", "l").html(fr === "per family" ? "<em>per family</em>" : "<button type='button' class='rlink'>" + fr + "</button>")
        .select("button").on("click", () => goToRecipe(fr));
      tr.append("td").html(med(r.family_recipe));
      tr.append("td").text(r.family_recipe.worse);
      tr.append("td").html(med(r.per_task_cv));
      tr.append("td").text(r.per_task_cv.worse);
      tr.append("td").html(med(r.oracle));
    });
  }

  function table6(rows) {
    const T = d3.select("#t6");
    const th = T.append("thead");
    const g = th.append("tr");
    g.append("th").attr("colspan", 2);
    g.append("th").attr("class", "grp").attr("colspan", 3).text("RMSE (%)");
    g.append("th").attr("class", "grp").attr("colspan", 3).text("Balanced accuracy (pp)");
    th.append("tr").selectAll("th").data(["Rule", "Chosen on", "Median", "", "Worse", "Median", "", "Worse"])
      .join("th").attr("class", (d, i) => (i < 2 ? "l" : null)).text((d) => d);
    const tb = T.append("tbody");
    let last = null;
    rows.forEach(function (r) {
      const tr = tb.append("tr").attr("class", r.rule === "Oracle" ? "total" : null);
      tr.append("td").attr("class", "l").style("font-weight", 600).text(r.rule === last ? "" : r.rule);
      last = r.rule;
      tr.append("td").attr("class", "l").text(r.chosen_on);
      tr.append("td").html(med(r.rmse));
      tr.append("td").attr("class", "bar").html(iqrBar(r.rmse.ci[0], r.rmse.ci[1], Number(r.rmse.median), [-32, 4], !r.rmse.gray, true));
      tr.append("td").text(r.rmse.worse);
      tr.append("td").html(med(r.ba));
      tr.append("td").attr("class", "bar").html(iqrBar(r.ba.ci[0], r.ba.ci[1], Number(r.ba.median), [-1, 8], !r.ba.gray, false));
      tr.append("td").text(r.ba.worse);
    });
  }

  function credits(sets) {
    const ul = d3.select("#credits");
    ul.append("li").text("Synthetic spectra: three components with pseudo-Voigt bands, generated for this page (tools/build_spectra.py).");
    sets.filter((s) => s.kind === "real").forEach(function (s) {
      ul.append("li").html(s.label + " (<code>" + s.dataset + "</code>): <a href='" + s.source + "' target='_blank' rel='noopener'>data</a>, " +
        "<a href='https://doi.org/" + s.doi + "' target='_blank' rel='noopener'>doi:" + s.doi + "</a>, " + s.license);
    });
  }

  RP.tables = {
    init: function (paper, recipes, sets) {
      table1(paper.table1); table2(paper.table2); table3(recipes); table4(paper.table4);
      table5(paper.table5); table6(paper.table6); credits(sets);
    }
  };
})();
