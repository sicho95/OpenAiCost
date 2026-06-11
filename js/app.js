const App = (() => {
  const state = {
    config: null,
    file: null,
    analysis: null,
    modelRows: [],
    sortKey: "costMedium",
    sortDirection: "desc",
    page: 1,
    pageSize: 12,
    exchangeRate: 0.92
  };

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    bindEvents();
    state.config = await Pricing.loadConfig();
    populateMetadata();
    initDates();
    restoreTheme();
    registerServiceWorker();
    renderEmpty();
  }

  function cacheElements() {
    [
      "fileInput", "dropzone", "statusText", "progress", "startDate", "endDate", "tokenMethod",
      "granularity", "plusPrice", "search", "tbody", "pagination", "summaryCards", "comparison",
      "exportCsv", "exportJson", "helpButton", "helpModal", "closeHelp", "themeToggle",
      "pricingMeta", "methodLabel", "lowCoeff", "mediumCoeff", "highCoeff", "veryHighCoeff"
    ].forEach((id) => { els[id] = document.getElementById(id); });
  }

  function bindEvents() {
    els.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
    ["dragenter", "dragover"].forEach((name) => els.dropzone.addEventListener(name, onDragOver));
    ["dragleave", "drop"].forEach((name) => els.dropzone.addEventListener(name, onDragLeave));
    els.dropzone.addEventListener("drop", (event) => handleFile(event.dataTransfer.files[0]));
    document.querySelectorAll("[data-range]").forEach((button) => button.addEventListener("click", () => applyRange(button.dataset.range)));
    ["startDate", "endDate", "tokenMethod", "granularity", "plusPrice", "lowCoeff", "mediumCoeff", "highCoeff", "veryHighCoeff"].forEach((id) => {
      els[id].addEventListener("input", Helpers.debounce(reanalyze, 120));
    });
    els.search.addEventListener("input", () => { state.page = 1; renderTable(); });
    els.exportCsv.addEventListener("click", exportCsv);
    els.exportJson.addEventListener("click", exportJson);
    els.helpButton.addEventListener("click", () => els.helpModal.showModal());
    els.closeHelp.addEventListener("click", () => els.helpModal.close());
    els.themeToggle.addEventListener("click", toggleTheme);
    document.querySelectorAll("th[data-sort]").forEach((th) => th.addEventListener("click", () => sortBy(th.dataset.sort)));
  }

  function populateMetadata() {
    const { pricing, reasoning } = state.config;
    els.pricingMeta.textContent = `Tarifs générés le ${pricing.generated_at} depuis ${pricing.source}`;
    els.lowCoeff.value = reasoning.profiles.low.coefficient;
    els.mediumCoeff.value = reasoning.profiles.medium.coefficient;
    els.highCoeff.value = reasoning.profiles.high.coefficient;
    els.veryHighCoeff.value = reasoning.profiles.very_high.coefficient;
  }

  function initDates() {
    els.endDate.value = dayjs().format("YYYY-MM-DD");
    applyRange("all");
  }

  function restoreTheme() {
    const theme = localStorage.getItem("theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  }

  function onDragOver(event) {
    event.preventDefault();
    els.dropzone.classList.add("is-dragging");
  }

  function onDragLeave(event) {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragging");
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/\.(json|html?)$/i.test(file.name)) {
      setStatus("Format non accepté. Sélectionnez conversations.json ou chat.html.", 0);
      return;
    }
    state.file = file;
    await reanalyze();
  }

  async function reanalyze() {
    if (!state.file) return;
    try {
      setStatus(`Analyse de ${state.file.name}...`, 2);
      els.methodLabel.textContent = methodLabel();
      const analysis = await Parser.parseFile(state.file, currentOptions(), (progress) => setProgress(progress));
      state.analysis = analysis;
      updateReasoningFromInputs();
      state.modelRows = Pricing.summarizeModels(analysis, state.config.pricing, state.config.reasoning.profiles);
      state.page = 1;
      renderAll();
      setStatus("Analyse terminée.", 100);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Analyse impossible.", 0);
    }
  }

  function currentOptions() {
    return {
      start: els.startDate.value,
      end: els.endDate.value,
      tokenMethod: els.tokenMethod.value,
      granularity: els.granularity.value
    };
  }

  function updateReasoningFromInputs() {
    const profiles = state.config.reasoning.profiles;
    profiles.low.coefficient = Number(els.lowCoeff.value || 1);
    profiles.medium.coefficient = Number(els.mediumCoeff.value || 1);
    profiles.high.coefficient = Number(els.highCoeff.value || 1);
    profiles.very_high.coefficient = Number(els.veryHighCoeff.value || 1);
  }

  function renderAll() {
    renderSummary();
    renderComparison();
    renderTable();
    Charts.render(state.analysis, state.modelRows, state.config.pricing, state.config.reasoning.profiles);
  }

  function renderEmpty() {
    els.summaryCards.innerHTML = cardMarkup([
      ["Conversations", "0"], ["Messages utilisateur", "0"], ["Réponses assistant", "0"], ["Tokens estimés", "0"]
    ]);
    els.tbody.innerHTML = `<tr><td colspan="7" class="empty">Importez un export ChatGPT pour lancer l'analyse.</td></tr>`;
  }

  function renderSummary() {
    const a = state.analysis;
    const avg = a.conversations ? (a.userMessages + a.assistantMessages) / a.conversations : 0;
    els.summaryCards.innerHTML = cardMarkup([
      ["Conversations", Helpers.formatNumber(a.conversations)],
      ["Messages utilisateur", Helpers.formatNumber(a.userMessages)],
      ["Réponses assistant", Helpers.formatNumber(a.assistantMessages)],
      ["Messages / conversation", avg.toFixed(1).replace(".", ",")],
      ["Texte utilisateur", `${Helpers.formatNumber(a.userChars)} car.`],
      ["Texte assistant", `${Helpers.formatNumber(a.assistantChars)} car.`],
      ["Input tokens", Helpers.formatNumber(a.inputTokens)],
      ["Output tokens", Helpers.formatNumber(a.outputTokens)]
    ]);
  }

  function cardMarkup(items) {
    return items.map(([label, value]) => `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`).join("");
  }

  function renderComparison() {
    const apiUsd = totalCost("medium");
    const apiEur = apiUsd * state.exchangeRate;
    const plus = Number(els.plusPrice.value || 0);
    const diff = apiEur - plus;
    const verdict = diff > 0 ? "ChatGPT Plus plus rentable" : "API plus rentable";
    els.comparison.innerHTML = `
      <div><span>Vous auriez payé</span><strong>${Helpers.formatEUR(apiEur)}</strong></div>
      <div><span>Vous avez payé</span><strong>${Helpers.formatEUR(plus)}</strong></div>
      <div><span>Différence</span><strong class="${diff > 0 ? "negative" : "positive"}">${Helpers.formatEUR(diff)}</strong></div>
      <p>${verdict}</p>
    `;
  }

  function totalCost(profile) {
    return state.modelRows.reduce((sum, row) => sum + (row.costs[profile] || 0), 0);
  }

  function filteredRows() {
    const query = els.search.value.trim().toLowerCase();
    const rows = query ? state.modelRows.filter((row) => (row.rate.label || row.model).toLowerCase().includes(query)) : state.modelRows;
    const sorted = [...rows].sort((a, b) => {
      const av = valueForSort(a, state.sortKey);
      const bv = valueForSort(b, state.sortKey);
      const result = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return state.sortDirection === "asc" ? result : -result;
    });
    return sorted;
  }

  function valueForSort(row, key) {
    const map = {
      model: row.rate.label || row.model,
      input: row.inputTokens,
      output: row.outputTokens,
      low: row.costs.low || -1,
      medium: row.costs.medium || -1,
      high: row.costs.high || -1,
      very_high: row.costs.very_high || -1
    };
    return map[key] ?? 0;
  }

  function renderTable() {
    const rows = filteredRows();
    const start = (state.page - 1) * state.pageSize;
    const pageRows = rows.slice(start, start + state.pageSize);
    els.tbody.innerHTML = pageRows.map((row) => `
      <tr>
        <td><strong>${row.rate.label || Helpers.displayModelName(row.model)}</strong>${row.rate.unknown ? "<span class='pill'>tarif inconnu</span>" : ""}</td>
        <td>${Helpers.formatNumber(row.inputTokens)}</td>
        <td>${Helpers.formatNumber(row.outputTokens)}</td>
        <td>${formatCost(row.costs.low)}</td>
        <td>${formatCost(row.costs.medium)}</td>
        <td>${formatCost(row.costs.high)}</td>
        <td>${formatCost(row.costs.very_high)}</td>
      </tr>
    `).join("") || `<tr><td colspan="7" class="empty">Aucun modèle ne correspond à la recherche.</td></tr>`;
    renderPagination(rows.length);
  }

  function renderPagination(total) {
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Helpers.clamp(state.page, 1, pages);
    els.pagination.innerHTML = `
      <button ${state.page === 1 ? "disabled" : ""} data-page="${state.page - 1}">Précédent</button>
      <span>Page ${state.page} / ${pages}</span>
      <button ${state.page === pages ? "disabled" : ""} data-page="${state.page + 1}">Suivant</button>
    `;
    els.pagination.querySelectorAll("button[data-page]").forEach((button) => button.addEventListener("click", () => {
      state.page = Number(button.dataset.page);
      renderTable();
    }));
  }

  function formatCost(value) {
    return value == null ? "N/D" : Helpers.formatUSD(value);
  }

  function sortBy(key) {
    if (state.sortKey === key) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
    else state.sortKey = key, state.sortDirection = "desc";
    renderTable();
  }

  function applyRange(range) {
    const today = dayjs();
    els.endDate.value = today.format("YYYY-MM-DD");
    if (range === "today") els.startDate.value = today.format("YYYY-MM-DD");
    if (range === "7") els.startDate.value = today.subtract(7, "day").format("YYYY-MM-DD");
    if (range === "30") els.startDate.value = today.subtract(30, "day").format("YYYY-MM-DD");
    if (range === "90") els.startDate.value = today.subtract(90, "day").format("YYYY-MM-DD");
    if (range === "365") els.startDate.value = today.subtract(1, "year").format("YYYY-MM-DD");
    if (range === "all") els.startDate.value = "";
    reanalyze();
  }

  function exportCsv() {
    if (!state.modelRows.length) return;
    Helpers.download("openai-cost-analysis.csv", Papa.unparse(exportRows()), "text/csv");
  }

  function exportJson() {
    if (!state.analysis) return;
    Helpers.download("openai-cost-analysis.json", JSON.stringify({
      generated_at: new Date().toISOString(),
      options: currentOptions(),
      summary: state.analysis,
      models: exportRows()
    }, replacer, 2), "application/json");
  }

  function exportRows() {
    return filteredRows().map((row) => ({
      model: row.rate.label || row.model,
      conversations: row.conversations,
      messages: row.messages,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      cost_low_usd: row.costs.low,
      cost_medium_usd: row.costs.medium,
      cost_high_usd: row.costs.high,
      cost_very_high_usd: row.costs.very_high,
      pricing_status: row.rate.unknown ? "unknown" : "priced"
    }));
  }

  function replacer(key, value) {
    if (value instanceof Map) return Object.fromEntries(value);
    return value;
  }

  function methodLabel() {
    return { simple: "Simple", words: "Mots", tiktoken: "Avancée demandée, indisponible offline: approximation simple" }[els.tokenMethod.value] || "Simple";
  }

  function setStatus(text, progress) {
    els.statusText.textContent = text;
    setProgress(progress);
  }

  function setProgress(progress) {
    els.progress.value = Helpers.clamp(progress, 0, 100);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }
})();
