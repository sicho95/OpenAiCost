const Parser = (() => {
  function detectFormat(file, text) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".html")) return "html";
    if (name.endsWith(".json")) return "json";
    if (/^\s*</.test(text)) return "html";
    return "json";
  }

  async function parseFile(file, options, onProgress) {
    const text = await file.text();
    const format = detectFormat(file, text);
    const conversations = format === "html" ? parseHtml(text) : parseJson(text);
    return analyzeConversations(conversations, options, onProgress);
  }

  function parseJson(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data.map(normalizeConversation);
    if (Array.isArray(data.conversations)) return data.conversations.map(normalizeConversation);
    if (data.mapping || data.messages) return [normalizeConversation(data)];
    throw new Error("Format JSON non reconnu. Utilisez conversations.json depuis l'export ChatGPT.");
  }

  function parseHtml(text) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    const blocks = [...doc.querySelectorAll("[data-message-author-role], .message, article")];
    if (!blocks.length) {
      const bodyText = doc.body ? doc.body.innerText : text.replace(/<[^>]+>/g, " ");
      return [{ id: "chat-html", title: "chat.html", create_time: Date.now() / 1000, messages: [{ role: "assistant", text: bodyText }] }];
    }
    const messages = blocks.map((node) => {
      const role = node.getAttribute("data-message-author-role") || (node.textContent.match(/\buser\b/i) ? "user" : "assistant");
      return { role, text: node.innerText || node.textContent || "" };
    });
    return [{ id: "chat-html", title: doc.title || "chat.html", create_time: Date.now() / 1000, messages }];
  }

  function normalizeConversation(raw) {
    const messages = raw.mapping ? messagesFromMapping(raw.mapping) : messagesFromArray(raw.messages || []);
    return {
      id: raw.id || raw.conversation_id || crypto.randomUUID(),
      title: raw.title || "Sans titre",
      create_time: raw.create_time || raw.createTime || raw.created_at || raw.createdAt || firstMessageTime(messages),
      update_time: raw.update_time || raw.updateTime || raw.updated_at || raw.updatedAt,
      model: extractModel(raw),
      messages
    };
  }

  function messagesFromMapping(mapping) {
    return Object.values(mapping)
      .map((node) => node && node.message)
      .filter(Boolean)
      .map(normalizeMessage)
      .filter((message) => message.role && message.text);
  }

  function messagesFromArray(messages) {
    return messages.map(normalizeMessage).filter((message) => message.role && message.text);
  }

  function normalizeMessage(message) {
    const author = message.author || {};
    const content = message.content || {};
    const metadata = message.metadata || {};
    return {
      id: message.id || crypto.randomUUID(),
      role: author.role || message.role || message.author_role,
      text: Helpers.textFromParts(content.parts || content.text || content.content || message.text || message.content),
      create_time: message.create_time || message.createTime || message.created_at || message.timestamp,
      model: extractModel(message) || extractModel(metadata)
    };
  }

  function extractModel(value) {
    if (!value || typeof value !== "object") return "";
    return value.model_slug || value.model || value.default_model_slug || value.selected_model_slug ||
      value.model_name || value.conversation_model_slug || value?.metadata?.model_slug || value?.metadata?.model || "";
  }

  function firstMessageTime(messages) {
    const found = messages.find((message) => message.create_time);
    return found ? found.create_time : Date.now() / 1000;
  }

  function toDate(value) {
    if (!value) return null;
    if (typeof value === "number") return new Date(value < 10000000000 ? value * 1000 : value);
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  async function analyzeConversations(conversations, options, onProgress) {
    const start = options.start ? new Date(`${options.start}T00:00:00`) : null;
    const end = options.end ? new Date(`${options.end}T23:59:59`) : null;
    const analysis = {
      conversations: 0,
      userMessages: 0,
      assistantMessages: 0,
      userChars: 0,
      assistantChars: 0,
      inputTokens: 0,
      outputTokens: 0,
      models: new Map(),
      timeline: new Map(),
      rows: []
    };

    for (let index = 0; index < conversations.length; index += 1) {
      const conversation = conversations[index];
      const conversationDate = toDate(conversation.create_time || conversation.update_time);
      if (start && conversationDate && conversationDate < start) continue;
      if (end && conversationDate && conversationDate > end) continue;
      analysis.conversations += 1;
      const seenModels = new Set();

      for (const message of conversation.messages) {
        const role = String(message.role || "").toLowerCase();
        if (role !== "user" && role !== "assistant") continue;
        const text = message.text || "";
        const tokens = Helpers.estimateTokens(text, options.tokenMethod);
        const model = Helpers.normalizeModelName(message.model || conversation.model || "unknown");
        const modelStats = ensureModel(analysis.models, model);
        modelStats.messages += 1;
        seenModels.add(model);

        if (role === "user") {
          analysis.userMessages += 1;
          analysis.userChars += text.length;
          analysis.inputTokens += tokens;
          modelStats.inputTokens += tokens;
        } else {
          analysis.assistantMessages += 1;
          analysis.assistantChars += text.length;
          analysis.outputTokens += tokens;
          modelStats.outputTokens += tokens;
        }

        const key = Helpers.dateKey(toDate(message.create_time) || conversationDate || Date.now(), options.granularity);
        const day = analysis.timeline.get(key) || { inputTokens: 0, outputTokens: 0 };
        if (role === "user") day.inputTokens += tokens;
        else day.outputTokens += tokens;
        analysis.timeline.set(key, day);
      }

      seenModels.forEach((model) => {
        ensureModel(analysis.models, model).conversations += 1;
      });

      if (index % 100 === 0) {
        onProgress?.(Math.round((index / Math.max(conversations.length, 1)) * 100));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    onProgress?.(100);
    return analysis;
  }

  function ensureModel(map, model) {
    if (!map.has(model)) {
      map.set(model, { model, conversations: 0, messages: 0, inputTokens: 0, outputTokens: 0 });
    }
    return map.get(model);
  }

  return { parseFile };
})();
