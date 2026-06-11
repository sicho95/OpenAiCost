const Charts = (() => {
  const instances = new Map();

  function replace(id, config) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (instances.has(id)) instances.get(id).destroy();
    instances.set(id, new Chart(canvas, config));
  }

  function render(analysis, modelRows, pricing, reasoningProfiles) {
    renderTokenSplit(analysis);
    renderCostByModel(modelRows);
    renderReasoningImpact(modelRows, reasoningProfiles);
    renderTimeline(analysis, pricing, reasoningProfiles);
  }

  function renderTokenSplit(analysis) {
    replace("tokensChart", {
      type: "doughnut",
      data: {
        labels: ["Input", "Output"],
        datasets: [{ data: [analysis.inputTokens, analysis.outputTokens] }]
      }
    });
  }

  function renderCostByModel(rows) {
    replace("modelCostChart", {
      type: "bar",
      data: {
        labels: rows.slice(0, 10).map((row) => row.rate.label || row.model),
        datasets: [{ data: rows.slice(0, 10).map((row) => row.costs.medium || 0) }]
      }
    });
  }

  function renderReasoningImpact(rows) {
    const totals = ["low", "medium", "high", "very_high"].map((key) =>
      rows.reduce((sum, row) => sum + (row.costs[key] || 0), 0)
    );
    replace("reasoningChart", {
      type: "bar",
      data: {
        labels: ["Faible", "Moyen", "Approfondi", "Très élevé"],
        datasets: [{ data: totals }]
      }
    });
  }

  function renderTimeline(analysis, pricing, reasoningProfiles) {
    const coefficient = Number(reasoningProfiles.medium?.coefficient || 1);
    const labels = [...analysis.timeline.keys()].sort();
    const values = labels.map((label) => {
      const bucket = analysis.timeline.get(label);
      return [...analysis.models.values()].reduce((sum, model) => {
        const rate = Pricing.findRate(pricing, model.model);
        if (rate.unknown) return sum;
        const totalTokens = Math.max(analysis.inputTokens + analysis.outputTokens, 1);
        const modelShare = (model.inputTokens + model.outputTokens) / totalTokens;
        return sum + (Pricing.costFor(bucket.inputTokens * modelShare, bucket.outputTokens * modelShare, rate, coefficient) || 0);
      }, 0);
    });
    replace("timelineChart", {
      type: "line",
      data: { labels, datasets: [{ data: values }] }
    });
  }

  return { render };
})();
