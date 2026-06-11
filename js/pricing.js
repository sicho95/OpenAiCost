const Pricing = (() => {
  const DEFAULT_PRICING = {
    generated_at: "2026-06-11",
    currency: "USD",
    unit: "per_1m_tokens",
    source: "https://openai.com/api/pricing/",
    models: {
      "gpt-5.5": { label: "GPT-5.5", input: 5, cached_input: 0.5, output: 30 },
      "gpt-5.4": { label: "GPT-5.4", input: 2.5, cached_input: 0.25, output: 15 },
      "gpt-5.4-mini": { label: "GPT-5.4 mini", aliases: ["gpt-5.4 mini"], input: 0.75, cached_input: 0.075, output: 4.5 }
    }
  };

  const DEFAULT_REASONING = {
    generated_at: "2026-06-11",
    profiles: {
      low: { label: "Faible", coefficient: 1 },
      medium: { label: "Moyen", coefficient: 1 },
      high: { label: "Approfondi", coefficient: 1 },
      very_high: { label: "Très élevé", coefficient: 1 }
    }
  };

  async function loadJson(path, fallback) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch {
      return fallback;
    }
  }

  async function loadConfig() {
    const [pricing, reasoning] = await Promise.all([
      loadJson("config/pricing.json", DEFAULT_PRICING),
      loadJson("config/reasoning_profiles.json", DEFAULT_REASONING)
    ]);
    return { pricing, reasoning };
  }

  function findRate(pricing, modelName) {
    const normalized = Helpers.normalizeModelName(modelName);
    const direct = pricing.models[normalized];
    if (direct) return { key: normalized, ...direct };
    const found = Object.entries(pricing.models).find(([, value]) =>
      (value.aliases || []).map(Helpers.normalizeModelName).includes(normalized)
    );
    if (found) return { key: found[0], ...found[1] };
    return { key: normalized, label: Helpers.displayModelName(normalized), unknown: true };
  }

  function costFor(tokensIn, tokensOut, rate, coefficient = 1) {
    if (!rate || rate.unknown || rate.input == null || rate.output == null) return null;
    return ((tokensIn * coefficient * rate.input) + (tokensOut * coefficient * rate.output)) / 1000000;
  }

  function summarizeModels(analysis, pricing, reasoningProfiles) {
    return [...analysis.models.values()].map((model) => {
      const rate = findRate(pricing, model.model);
      const costs = {};
      Object.entries(reasoningProfiles).forEach(([key, profile]) => {
        costs[key] = costFor(model.inputTokens, model.outputTokens, rate, Number(profile.coefficient || 1));
      });
      return { ...model, rate, costs };
    }).sort((a, b) => (b.costs.medium || 0) - (a.costs.medium || 0));
  }

  return { costFor, findRate, loadConfig, summarizeModels };
})();
