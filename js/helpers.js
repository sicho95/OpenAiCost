const Helpers = (() => {
  const eurFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
  const usdFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" });
  const numberFormatter = new Intl.NumberFormat("fr-FR");

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeModelName(value) {
    const text = String(value || "unknown").trim();
    if (!text) return "unknown";
    return text
      .toLowerCase()
      .replace(/^model_slug:/, "")
      .replace(/\s+/g, "-")
      .replace(/_/g, "-")
      .replace(/--+/g, "-");
  }

  function displayModelName(value) {
    if (!value || value === "unknown") return "Modèle inconnu";
    return String(value)
      .replace(/-/g, " ")
      .replace(/\bgpt\b/i, "GPT")
      .replace(/\bo(\d)/i, "o$1")
      .replace(/\bmini\b/i, "mini")
      .replace(/\bnano\b/i, "nano");
  }

  function textFromParts(parts) {
    if (parts == null) return "";
    if (typeof parts === "string") return parts;
    if (Array.isArray(parts)) return parts.map(textFromParts).filter(Boolean).join("\n");
    if (typeof parts === "object") {
      if (parts.text) return textFromParts(parts.text);
      if (parts.content) return textFromParts(parts.content);
      if (parts.parts) return textFromParts(parts.parts);
      if (parts.value) return textFromParts(parts.value);
    }
    return "";
  }

  function estimateTokens(text, method) {
    const normalized = String(text || "").trim();
    if (!normalized) return 0;
    if (method === "words") return Math.ceil(normalized.split(/\s+/).filter(Boolean).length * 1.3);
    return Math.ceil(normalized.length / 4);
  }

  function dateKey(date, granularity) {
    const d = new Date(date);
    if (Number.isNaN(d.valueOf())) return "Sans date";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    if (granularity === "month") return `${y}-${m}`;
    if (granularity === "week") {
      const copy = new Date(Date.UTC(y, d.getMonth(), d.getDate()));
      const dayNum = copy.getUTCDay() || 7;
      copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
      const week = Math.ceil((((copy - yearStart) / 86400000) + 1) / 7);
      return `${copy.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
    }
    return `${y}-${m}-${day}`;
  }

  function download(filename, content, type = "text/plain") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function debounce(fn, wait = 150) {
    let timer = 0;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  return {
    clamp,
    dateKey,
    debounce,
    displayModelName,
    download,
    estimateTokens,
    formatEUR: (value) => eurFormatter.format(Number(value || 0)),
    formatUSD: (value) => usdFormatter.format(Number(value || 0)),
    formatNumber: (value) => numberFormatter.format(Math.round(Number(value || 0))),
    normalizeModelName,
    textFromParts
  };
})();
