(() => {
  const STORAGE = {
    theme: "startpage.theme",
    engine: "startpage.engine",
    pins: "startpage.pins",
    freq: "startpage.freq",
    override: "startpage.override",
    category: "startpage.category",
  };

  const ENGINES = [
    { id: "bookmarks", label: "书签", url: null },
    { id: "google", label: "Google", url: "https://www.google.com/search?q=" },
    { id: "baidu", label: "百度", url: "https://www.baidu.com/s?wd=" },
    { id: "bing", label: "Bing", url: "https://www.bing.com/search?q=" },
  ];

  const CATEGORY_META = {
    书签栏: { label: "书签栏", icon: "📌", order: 10 },
    home: { label: "日常", icon: "🏠", order: 20 },
    公司: { label: "公司", icon: "🏢", order: 30 },
    影视: { label: "影视", icon: "🎬", order: 40 },
    技术: { label: "技术", icon: "🛠️", order: 50 },
    游戏: { label: "游戏", icon: "🎮", order: 60 },
    AI: { label: "AI", icon: "✨", order: 70 },
    机场: { label: "机场", icon: "✈️", order: 80 },
  };
  const FALLBACK_META = { label: "其他", icon: "📦", order: 90 };
  const TITLE_SEPS = [" | ", " – ", " — ", " - ", " · "];

  const $ = (id) => document.getElementById(id);
  const els = {
    clock: $("clock"),
    dateText: $("dateText"),
    greeting: $("greeting"),
    q: $("q"),
    form: $("searchForm"),
    engines: $("engines"),
    cats: $("cats"),
    grid: $("grid"),
    status: $("status"),
    themeBtn: $("themeBtn"),
    settingsBtn: $("settingsBtn"),
    drawer: $("drawer"),
    closeDrawer: $("closeDrawer"),
    engineSelect: $("engineSelect"),
    themeSelect: $("themeSelect"),
    fileInput: $("fileInput"),
    resetOverride: $("resetOverride"),
    dataMeta: $("dataMeta"),
    sourceHint: $("sourceHint"),
    dropMask: $("dropMask"),
  };

  const state = {
    engine: localStorage.getItem(STORAGE.engine) || "bookmarks",
    theme: localStorage.getItem(STORAGE.theme) || "system",
    category: "书签栏",
    pins: readJson(STORAGE.pins, []),
    freq: readJson(STORAGE.freq, {}),
    query: "",
    selected: 0,
    visible: [],
    data: null,
    usingOverride: false,
  };

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function applyTheme() {
    const preferDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = state.theme === "system" ? (preferDark ? "dark" : "light") : state.theme;
    document.documentElement.dataset.theme = theme;
    els.themeSelect.value = state.theme;
  }

  function tick() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    els.clock.textContent = `${hh}:${mm}`;
    els.clock.dateTime = now.toISOString();
    const week = "日一二三四五六"[now.getDay()];
    els.dateText.textContent = `${now.getMonth() + 1}月${now.getDate()}日 星期${week}`;
    const h = now.getHours();
    els.greeting.textContent = h < 5 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  }

  function allItems(data) {
    return data.categories.flatMap((cat) =>
      cat.items.map((item) => ({ ...item, categoryId: cat.id, categoryLabel: cat.label, categoryIcon: cat.icon }))
    );
  }

  function flatten(data) {
    return allItems(data);
  }

  function iconUrl(host) {
    return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
  }

  function letterOf(item) {
    return (item.shortTitle || item.title || "?").trim().charAt(0).toUpperCase();
  }

  function currentList() {
    const items = flatten(state.data);
    const q = state.query.trim().toLowerCase();
    let list;
    if (q) {
      list = items.filter((item) =>
        [item.title, item.shortTitle, item.host, item.url, item.categoryLabel]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    } else if (state.category === "freq") {
      list = items
        .filter((item) => state.pins.includes(item.id) || state.freq[item.id])
        .sort((a, b) => {
          const pin = Number(state.pins.includes(b.id)) - Number(state.pins.includes(a.id));
          if (pin) return pin;
          return (state.freq[b.id] || 0) - (state.freq[a.id] || 0);
        });
    } else if (state.category !== "all") {
      list = items.filter((item) => item.categoryId === state.category);
    } else {
      list = items;
    }
    return list;
  }

  function renderEngines() {
    els.engines.innerHTML = ENGINES.map(
      (engine) =>
        `<button type="button" class="engine${engine.id === state.engine ? " active" : ""}" data-engine="${engine.id}">${engine.label}</button>`
    ).join("");
    els.engineSelect.innerHTML = ENGINES.map(
      (engine) => `<option value="${engine.id}">${engine.label}</option>`
    ).join("");
    els.engineSelect.value = state.engine;
  }

  function renderCats() {
    const cats = [
      { id: "all", label: "全部", icon: "✦", count: state.data.total },
      { id: "freq", label: "常用", icon: "★", count: flatten(state.data).filter((i) => state.pins.includes(i.id) || state.freq[i.id]).length },
      ...state.data.categories,
    ];
    if (!cats.some((c) => c.id === state.category)) {
      state.category = cats.some((c) => c.id === "书签栏") ? "书签栏" : "all";
    }
    els.cats.innerHTML = cats
      .map(
        (cat) =>
          `<button type="button" class="chip${cat.id === state.category ? " active" : ""}" data-cat="${cat.id}">${cat.icon || ""} ${cat.label}<span> ${cat.count ?? cat.items?.length ?? ""}</span></button>`
      )
      .join("");
    queueMicrotask(() => {
      els.cats.querySelector(".chip.active")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
  }

  function renderGrid() {
    const list = currentList();
    state.visible = list;
    if (state.selected >= list.length) state.selected = Math.max(0, list.length - 1);
    if (!list.length) {
      els.grid.innerHTML = `<div class="empty">没有匹配的书签。回车可以用当前引擎搜索网页。</div>`;
      els.status.textContent = state.query ? `未找到「${state.query}」` : "这个分类还是空的";
      return;
    }
    els.status.textContent = state.query
      ? `找到 ${list.length} 条`
      : `${list.length} 个站点`;
    els.grid.innerHTML = list
      .map((item, index) => {
        const pinned = state.pins.includes(item.id);
        const host = item.host || "";
        return `<a class="card${index === state.selected ? " active" : ""}" href="${item.url}" data-id="${item.id}" data-index="${index}" title="${escapeHtml(item.title)}">
          ${host ? `<img class="favicon" src="${iconUrl(host)}" alt="" data-letter="${escapeHtml(letterOf(item))}">` : `<span class="letter">${escapeHtml(letterOf(item))}</span>`}
          <span class="card-text">
            <b>${escapeHtml(item.shortTitle || item.title)}</b>
            <small>${escapeHtml(host || item.categoryLabel)}</small>
          </span>
          <button class="pin${pinned ? " on" : ""}" type="button" data-pin="${item.id}" title="固定到常用" aria-label="固定">${pinned ? "★" : "☆"}</button>
        </a>`;
      })
      .join("");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderMeta() {
    const local = state.usingOverride ? " · 当前为本地导入" : "";
    els.sourceHint.textContent = `${state.data.total} 条书签${state.usingOverride ? " · 本地导入" : ""}`;
    els.dataMeta.textContent = `数据来源 ${state.data.sourceFile || "bookmarks.html"} · ${state.data.generatedAt || ""}${local}`;
  }

  function render() {
    renderEngines();
    renderCats();
    renderGrid();
    renderMeta();
  }

  function openItem(item) {
    if (!item) return;
    state.freq[item.id] = (state.freq[item.id] || 0) + 1;
    writeJson(STORAGE.freq, state.freq);
    window.location.href = item.url;
  }

  function searchWeb(query) {
    const engine = ENGINES.find((e) => e.id === state.engine && e.url) || ENGINES.find((e) => e.id === "google");
    window.location.href = engine.url + encodeURIComponent(query);
  }

  function togglePin(id, event) {
    event.preventDefault();
    event.stopPropagation();
    if (state.pins.includes(id)) {
      state.pins = state.pins.filter((x) => x !== id);
    } else {
      state.pins.unshift(id);
    }
    writeJson(STORAGE.pins, state.pins);
    render();
  }

  function setEngine(id) {
    state.engine = id;
    localStorage.setItem(STORAGE.engine, id);
    renderEngines();
  }

  function setCategory(id) {
    state.category = id;
    localStorage.setItem(STORAGE.category, id);
    state.selected = 0;
    render();
  }

  function cycleTheme() {
    const order = ["system", "dark", "light"];
    state.theme = order[(order.indexOf(state.theme) + 1) % order.length];
    localStorage.setItem(STORAGE.theme, state.theme);
    applyTheme();
  }

  function loadData() {
    const override = readJson(STORAGE.override, null);
    if (override?.categories) {
      state.data = override;
      state.usingOverride = true;
      return;
    }
    state.data = window.BOOKMARKS;
    state.usingOverride = false;
  }

  async function sha1(text) {
    const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
  }

  function parseAttrs(raw) {
    const out = {};
    const re = /([A-Z_]+)\s*=\s*"([^"]*)"/gi;
    let match;
    while ((match = re.exec(raw || ""))) out[match[1].toUpperCase()] = match[2];
    return out;
  }

  function cleanText(raw) {
    return decodeHtml((raw || "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
  }

  function decodeHtml(text) {
    const area = document.createElement("textarea");
    area.innerHTML = text;
    return area.value;
  }

  function shortTitle(title, host) {
    let text = (title || "").trim();
    if (!text) return host || "未命名";
    for (const sep of TITLE_SEPS) {
      if (text.includes(sep)) {
        const left = text.split(sep)[0].trim();
        if (left.length > 1 && left.length <= 32) {
          text = left;
          break;
        }
      }
    }
    return text.length > 22 ? `${text.slice(0, 21)}…` : text;
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  function categoryMeta(path) {
    if (!path.length) return { id: "other", ...FALLBACK_META };
    const leaf = path[path.length - 1];
    const meta = CATEGORY_META[leaf];
    if (meta) return { id: leaf === "home" ? "home" : leaf, ...meta };
    return { id: leaf.replace(/[^\w\u4e00-\u9fff]+/g, "-") || "other", label: leaf, icon: FALLBACK_META.icon, order: FALLBACK_META.order };
  }

  async function parseNetscape(htmlText) {
    const tokenRe =
      /(?<folder><DT>\s*<H3(?<folder_attrs>[^>]*)>(?<folder_name>.*?)<\/H3>)|(?<link><DT>\s*<A(?<link_attrs>[^>]*)>(?<link_name>.*?)<\/A>)|(?<dl_open><DL\b[^>]*>)|(?<dl_close><\/DL>)/gi;
    const folderStack = [];
    let pending = null;
    const grouped = new Map();
    const seen = new Set();
    let match;
    while ((match = tokenRe.exec(htmlText))) {
      const g = match.groups;
      if (g.folder) pending = cleanText(g.folder_name);
      else if (g.dl_open) {
        if (pending) {
          folderStack.push(pending);
          pending = null;
        }
      } else if (g.dl_close) {
        pending = null;
        folderStack.pop();
      } else if (g.link) {
        const attrs = parseAttrs(g.link_attrs);
        const url = decodeHtml(attrs.HREF || "").trim();
        if (!url || url.toLowerCase().startsWith("javascript:") || url.toLowerCase().startsWith("place:")) continue;
        const title = cleanText(g.link_name);
        const host = hostOf(url);
        const id = await sha1(url);
        if (seen.has(id)) continue;
        seen.add(id);
        const meta = categoryMeta(folderStack);
        if (!grouped.has(meta.id)) {
          grouped.set(meta.id, { id: meta.id, label: meta.label, icon: meta.icon, order: meta.order, count: 0, items: [] });
        }
        const cat = grouped.get(meta.id);
        cat.items.push({
          id,
          title: title || host || url,
          shortTitle: shortTitle(title, host),
          url,
          host,
          addDate: /^\d+$/.test(attrs.ADD_DATE || "") ? Number(attrs.ADD_DATE) : null,
        });
        cat.count += 1;
      }
    }
    const categories = [...grouped.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "zh"));
    return {
      generatedAt: new Date().toISOString(),
      sourceFile: "local-import.html",
      total: categories.reduce((sum, cat) => sum + cat.count, 0),
      categories,
    };
  }

  async function importHtmlFile(file) {
    const text = await file.text();
    if (!text.includes("<DT>") && !text.includes("NETSCAPE-Bookmark-file")) {
      alert("这不像浏览器导出的书签 HTML。请在浏览器里：书签管理器 → 导出。");
      return;
    }
    const payload = await parseNetscape(text);
    if (!payload.total) {
      alert("没有解析到书签。");
      return;
    }
    writeJson(STORAGE.override, payload);
    loadData();
    state.category = payload.categories.some((c) => c.id === "书签栏") ? "书签栏" : "all";
    render();
    els.drawer.hidden = true;
  }

  function bind() {
    els.form.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = els.q.value.trim();
      const item = state.visible[state.selected];
      if (state.engine === "bookmarks") {
        if (item) openItem(item);
        else if (query) searchWeb(query);
      } else if (query) {
        searchWeb(query);
      } else if (item) {
        openItem(item);
      }
    });

    els.q.addEventListener("input", () => {
      state.query = els.q.value;
      state.selected = 0;
      renderGrid();
    });

    els.engines.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-engine]");
      if (btn) setEngine(btn.dataset.engine);
    });

    els.cats.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-cat]");
      if (btn) setCategory(btn.dataset.cat);
    });

    els.grid.addEventListener("click", (event) => {
      const pin = event.target.closest("[data-pin]");
      if (pin) return togglePin(pin.dataset.pin, event);
      const card = event.target.closest(".card");
      if (!card) return;
      const item = state.visible[Number(card.dataset.index)];
      if (item) {
        event.preventDefault();
        openItem(item);
      }
    });

    els.grid.addEventListener("error", (event) => {
      const img = event.target;
      if (img.classList.contains("favicon")) {
        const letter = document.createElement("span");
        letter.className = "letter";
        letter.textContent = img.dataset.letter || "#";
        img.replaceWith(letter);
      }
    }, true);

    els.themeBtn.addEventListener("click", cycleTheme);
    els.settingsBtn.addEventListener("click", () => {
      els.drawer.hidden = false;
    });
    els.closeDrawer.addEventListener("click", () => {
      els.drawer.hidden = true;
    });
    els.drawer.addEventListener("click", (event) => {
      if (event.target === els.drawer) els.drawer.hidden = true;
    });
    els.engineSelect.addEventListener("change", () => setEngine(els.engineSelect.value));
    els.themeSelect.addEventListener("change", () => {
      state.theme = els.themeSelect.value;
      localStorage.setItem(STORAGE.theme, state.theme);
      applyTheme();
    });
    els.fileInput.addEventListener("change", () => {
      const file = els.fileInput.files?.[0];
      if (file) importHtmlFile(file);
      els.fileInput.value = "";
    });
    els.resetOverride.addEventListener("click", () => {
      localStorage.removeItem(STORAGE.override);
      loadData();
      render();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && document.activeElement !== els.q && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        els.q.focus();
        els.q.select();
      } else if (event.key === "Escape") {
        els.drawer.hidden = true;
        els.q.blur();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        state.selected = Math.min(state.visible.length - 1, state.selected + 1);
        renderGrid();
        els.grid.querySelector(".card.active")?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        state.selected = Math.max(0, state.selected - 1);
        renderGrid();
        els.grid.querySelector(".card.active")?.scrollIntoView({ block: "nearest" });
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        els.q.focus();
        els.q.select();
      }
    });

    let dragDepth = 0;
    const hasFile = (event) => [...(event.dataTransfer?.types || [])].includes("Files");
    document.addEventListener("dragenter", (event) => {
      if (!hasFile(event)) return;
      event.preventDefault();
      dragDepth += 1;
      els.dropMask.hidden = false;
    });
    document.addEventListener("dragover", (event) => {
      if (!hasFile(event)) return;
      event.preventDefault();
    });
    document.addEventListener("dragleave", (event) => {
      if (!hasFile(event)) return;
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) els.dropMask.hidden = true;
    });
    document.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      els.dropMask.hidden = true;
      const file = event.dataTransfer?.files?.[0];
      if (file && /\.html?$/i.test(file.name)) importHtmlFile(file);
      else if (file) alert("请拖入 .html 书签导出文件。");
    });

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
    window.matchMedia("(max-width: 720px)").addEventListener("change", setPlaceholder);
  }

  function isCoarsePointer() {
    return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(max-width: 720px)").matches;
  }

  function setPlaceholder() {
    els.q.placeholder = isCoarsePointer() ? "搜索书签或网页" : "搜索书签，或直接回车搜索网页";
  }

  loadData();
  applyTheme();
  tick();
  setInterval(tick, 1000);
  bind();
  setPlaceholder();
  if (!isCoarsePointer()) els.q.focus();
  render();
})();
