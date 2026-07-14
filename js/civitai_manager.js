import { app } from "../../scripts/app.js";

const API = "/civitai-manager/api";
const SEARCH_CACHE_KEY = "cmgr-civitai-search-cache";
const SEARCH_CACHE_VERSION = "v7-base-query-fallback";
const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000;
const SEARCH_CACHE_LIMIT = 80;
const INITIAL_PREVIEW_LOADS = 16;
const DETAIL_PREVIEW_LIMIT = 12;
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const TABS = ["Discover", "Library", "Downloads", "Settings"];
const ASSET_KINDS = [
    { id: "checkpoint", label: "Checkpoint/UNet", rootKinds: ["checkpoints", "unet"] },
    { id: "lora", label: "LoRA" },
    { id: "workflow", label: "Workflow" },
];
const CIVITAI_CATEGORY_FILTERS = [
    { label: "Action", value: "action" },
    { label: "Animal", value: "animal" },
    { label: "Assets", value: "assets" },
    { label: "Background", value: "background" },
    { label: "Base Model", value: "base model" },
    { label: "Buildings", value: "buildings" },
    { label: "Celebrity", value: "celebrity" },
    { label: "Character", value: "character" },
    { label: "Clothing", value: "clothing" },
    { label: "Concept", value: "concept" },
    { label: "Objects", value: "objects" },
    { label: "Poses", value: "poses" },
    { label: "Style", value: "style" },
    { label: "Tool", value: "tool" },
    { label: "Vehicle", value: "vehicle" },
];
const ROOT_KINDS = [
    { id: "checkpoints", label: "Checkpoints" },
    { id: "unet", label: "UNet" },
    { id: "loras", label: "LoRA" },
    { id: "workflows", label: "Workflows" },
];
const ROOT_LOCAL_FOLDER = "__cmgr_root_files__";

const state = {
    mounted: false,
    activeTab: "Discover",
    assetKind: "lora",
    selectedCategory: "",
    selectedCivitaiCategory: "",
    selectedBaseModel: "",
    selectedTag: "",
    taxonomyByKind: {},
    taxonomyLoading: false,
    query: "",
    sort: "Highest Rated",
    cursor: "",
    nextCursor: "",
    loadingSearch: false,
    autoLoadingMore: false,
    searchItems: [],
    selectedModel: null,
    selectedVersionId: "",
    selectedFileName: "",
    detailPreviewIndex: 0,
    pathOverrides: {},
    resolution: null,
    resolvingPath: false,
    libraryLoading: false,
    libraryFilter: "all",
    libraryItems: [],
    expandedLocalFolders: {},
    selectedAssetId: "",
    downloads: {},
    config: null,
    settingsSaving: false,
    apiTesting: false,
    error: "",
    toast: "",
    scroll: {
        discoverResults: 0,
        libraryResults: 0,
    },
};

let overlay = null;
let bodyEl = null;
let navEl = null;
let pollTimer = null;
let toastTimer = null;
let previewObserver = null;
let searchRequestSeq = 0;
let downloadsPollingFast = false;
let themeObserver = null;
let themeSyncQueued = false;
let responsiveSearchTimer = null;
let pendingResponsiveSearch = false;
let lastResponsiveSearchKey = "";
let comboOutsideBound = false;
let lastDownloadNavCount = -1;
let cardGridSyncFrame = null;
let cardGridResizeBound = false;

if (!window.__cmgrLoadedImageUrls) {
    window.__cmgrLoadedImageUrls = new Set();
}
window.__cmgrMarkImageLoaded = (url) => {
    if (!url || String(url).startsWith("data:")) return;
    window.__cmgrLoadedImageUrls.add(url);
    if (window.__cmgrLoadedImageUrls.size > 2000) {
        const first = window.__cmgrLoadedImageUrls.values().next().value;
        window.__cmgrLoadedImageUrls.delete(first);
    }
};

function scheduleCardGridSync(root = bodyEl || document) {
    if (cardGridSyncFrame) cancelAnimationFrame(cardGridSyncFrame);
    cardGridSyncFrame = requestAnimationFrame(() => {
        cardGridSyncFrame = null;
        syncCardGridRows(root);
    });
    if (!cardGridResizeBound) {
        cardGridResizeBound = true;
        window.addEventListener("resize", () => scheduleCardGridSync(), { passive: true });
    }
}

function syncCardGridRows(root = bodyEl || document) {
    const scope = root?.querySelectorAll ? root : document;
    scope.querySelectorAll(".cmgr-results").forEach((grid) => {
        const card = grid.querySelector(".cmgr-card");
        if (!card) return;
        const width = card.getBoundingClientRect().width;
        if (!Number.isFinite(width) || width <= 0) return;
        const rowHeight = Math.round(width * 1.5);
        grid.style.setProperty("grid-auto-rows", `${rowHeight}px`, "important");
        grid.querySelectorAll(".cmgr-card").forEach((item) => {
            item.style.setProperty("height", "100%", "important");
            item.style.setProperty("aspect-ratio", "auto", "important");
        });
    });
}

app.registerExtension({
    name: "CivitaiManager.extension",
    async setup() {
        injectStyles();
        syncThemeVariables();
        observeThemeChanges();
        registerEntryPoint();
    },
});

function isUsefulThemeColor(value) {
    const color = String(value || "").trim();
    return color
        && color !== "transparent"
        && color !== "none"
        && !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/i.test(color)
        && !/^rgba?\([^)]*,\s*0\s*\)$/i.test(color);
}

function isVisibleThemeElement(element) {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && element.getClientRects().length > 0;
}

function readCssColor(style, names) {
    for (const name of names) {
        const value = style.getPropertyValue(name).trim();
        if (isUsefulThemeColor(value)) return value;
    }
    return "";
}

function firstVisibleElement(selectors) {
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
            if (isVisibleThemeElement(element)) return element;
        }
    }
    return null;
}

function readElementColor(elementOrSelectors, property, fallback = "") {
    const element = Array.isArray(elementOrSelectors) ? firstVisibleElement(elementOrSelectors) : elementOrSelectors;
    if (!element || !(element instanceof HTMLElement)) return fallback;
    const value = getComputedStyle(element)[property];
    return isUsefulThemeColor(value) ? value : fallback;
}

function readBorderColor(element) {
    if (!element || !(element instanceof HTMLElement)) return "";
    const style = getComputedStyle(element);
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
        const width = Number.parseFloat(style[`border${side}Width`] || "0");
        const borderStyle = style[`border${side}Style`];
        const color = style[`border${side}Color`];
        if (width > 0 && borderStyle !== "none" && borderStyle !== "hidden" && isUsefulThemeColor(color)) {
            return color;
        }
    }
    return "";
}

function findThemeMenuContainer() {
    if (app?.ui?.menuContainer instanceof HTMLElement) {
        return app.ui.menuContainer;
    }
    return firstVisibleElement([
        "#comfy-menu",
        ".comfy-menu",
        ".comfyui-menu",
        ".comfyui-body-topbar",
        ".comfyui-workspace-bar",
        ".comfyui-topbar",
        ".comfyui-toolbar",
        ".comfyui-menu-right",
        "[data-testid='topbar']",
        "[role='toolbar']",
        ".p-toolbar",
        ".topbar",
        ".p-menubar",
    ]);
}

function setRootVariable(name, value) {
    const root = document.documentElement;
    const current = root.style.getPropertyValue(name).trim();
    if (isUsefulThemeColor(value)) {
        if (current !== value) root.style.setProperty(name, value);
    } else if (current) {
        root.style.removeProperty(name);
    }
}

function syncThemeVariables() {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = document.body ? getComputedStyle(document.body) : rootStyle;
    const menu = findThemeMenuContainer();
    const controlElement = firstVisibleElement([
        ".comfy-menu input",
        ".comfy-menu select",
        ".comfy-menu button",
        ".comfyui-menu input",
        ".comfyui-menu select",
        ".comfyui-menu button",
        ".comfyui-input",
        ".comfyui-button",
        ".p-form-field",
        ".p-inputtext",
        ".p-select",
        ".p-button",
    ]);

    const panelBg = readElementColor(menu, "backgroundColor")
        || readCssColor(rootStyle, ["--comfy-menu-bg", "--p-content-background", "--bg-color"])
        || readElementColor(document.body, "backgroundColor")
        || bodyStyle.backgroundColor;
    const cardBg = readCssColor(rootStyle, [
        "--comfy-input-bg",
        "--p-form-field-background",
        "--component-node-widget-background",
        "--secondary-background",
    ]) || readElementColor(menu, "backgroundColor") || panelBg;
    const controlBg = cardBg;
    const borderColor = readBorderColor(controlElement)
        || readBorderColor(menu)
        || readCssColor(rootStyle, ["--border-color", "--p-content-border-color", "--p-button-secondary-border-color"]);
    const textColor = readElementColor(menu, "color")
        || readCssColor(rootStyle, ["--fg-color", "--input-text", "--p-text-color"])
        || bodyStyle.color;
    const mutedColor = readCssColor(rootStyle, ["--descrip-text", "--p-text-muted-color", "--muted-foreground"]);

    setRootVariable("--cmgr-sampled-panel-bg", panelBg);
    setRootVariable("--cmgr-sampled-card-bg", cardBg);
    setRootVariable("--cmgr-sampled-control-bg", controlBg);
    setRootVariable("--cmgr-sampled-border-color", borderColor);
    setRootVariable("--cmgr-sampled-text-color", textColor);
    setRootVariable("--cmgr-sampled-muted-color", mutedColor);

    setRootVariable("--cmgr-sampled-bg", panelBg);
    setRootVariable("--cmgr-sampled-panel", panelBg);
    setRootVariable("--cmgr-sampled-card", cardBg);
    setRootVariable("--cmgr-sampled-control", controlBg);
    setRootVariable("--cmgr-sampled-border", borderColor);
    setRootVariable("--cmgr-sampled-text", textColor);
    setRootVariable("--cmgr-sampled-muted", mutedColor);
}

function queueThemeSync() {
    if (themeSyncQueued) return;
    themeSyncQueued = true;
    requestAnimationFrame(() => {
        themeSyncQueued = false;
        syncThemeVariables();
    });
}

function observeThemeChanges() {
    if (themeObserver) {
        queueThemeSync();
        return;
    }
    themeObserver = new MutationObserver(() => queueThemeSync());
    themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "style", "data-theme", "data-color-mode"],
    });
    if (document.body) {
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["class", "style", "data-theme", "data-color-mode"],
        });
    }
    if (document.head) {
        themeObserver.observe(document.head, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ["class", "style", "href"],
        });
    }
    window.addEventListener("focus", queueThemeSync);
    queueThemeSync();
}

function registerEntryPoint() {
    createFallbackLeftButton();
}

function createFallbackLeftButton() {
    if (document.querySelector(".cmgr-left-entry")) return;
    const btn = document.createElement("button");
    btn.className = "cmgr-left-entry";
    btn.type = "button";
    btn.title = "Civitai Manager";
    btn.textContent = "Civitai";
    btn.onclick = () => openOverlay();
    document.body.appendChild(btn);
}

function openOverlay() {
    if (overlay) {
        overlay.classList.add("show");
        render();
        return;
    }
    overlay = document.createElement("div");
    overlay.className = "cmgr-overlay show";
    overlay.innerHTML = `
        <div class="cmgr-shell" role="dialog" aria-label="Civitai Manager">
            <div class="cmgr-topbar">
                <div>
                    <div class="cmgr-title">Civitai Manager</div>
                    <div class="cmgr-subtitle">Browse, download, and organize Checkpoints, UNet, LoRA, and Workflows from Civitai.</div>
                </div>
                <button class="cmgr-icon-btn" data-action="close" title="Close">Cancel</button>
            </div>
            <div class="cmgr-layout">
                <nav class="cmgr-nav"></nav>
                <main class="cmgr-body"></main>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    navEl = overlay.querySelector(".cmgr-nav");
    bodyEl = overlay.querySelector(".cmgr-body");
    overlay.querySelector('[data-action="close"]').onclick = () => overlay.classList.remove("show");
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) overlay.classList.remove("show");
    });
    state.mounted = true;
    hydrateInitialData();
    render();
    startPolling();
}

async function hydrateInitialData() {
    const tasks = [loadConfig(), loadLibrary(), loadDownloads(), loadTaxonomy(state.assetKind, { silent: true })];
    if (state.activeTab === "Discover" && state.searchItems.length === 0 && !state.loadingSearch) {
        tasks.push(search(true, { silent: true }));
    }
    await Promise.allSettled(tasks);
}

function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
        if (!overlay?.classList.contains("show")) return;
        loadDownloads(false);
    }, 1500);
}

function tuneDownloadPolling() {
    const hasActive = activeDownloadCount() > 0;
    if (hasActive === downloadsPollingFast && pollTimer) return;
    downloadsPollingFast = hasActive;
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    pollTimer = setInterval(() => {
        if (!overlay?.classList.contains("show")) return;
        loadDownloads(false);
    }, hasActive ? 500 : 1500);
}

async function apiGet(path) {
    const response = await fetch(`${API}${path}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

async function apiPost(path, body) {
    const response = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

function searchCacheKey(path) {
    return `${SEARCH_CACHE_VERSION}:${path}`;
}

function getSearchCache(path) {
    try {
        const raw = localStorage.getItem(SEARCH_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        const entry = cache?.[searchCacheKey(path)];
        if (!entry || Date.now() - Number(entry.timestamp || 0) > SEARCH_CACHE_TTL) return null;
        return entry.data || null;
    } catch (_) {
        return null;
    }
}

function setSearchCache(path, data) {
    try {
        const raw = localStorage.getItem(SEARCH_CACHE_KEY);
        const cache = raw ? JSON.parse(raw) : {};
        cache[searchCacheKey(path)] = { data, timestamp: Date.now() };
        const keys = Object.keys(cache);
        if (keys.length > SEARCH_CACHE_LIMIT) {
            keys.sort((a, b) => Number(cache[a]?.timestamp || 0) - Number(cache[b]?.timestamp || 0));
            for (const key of keys.slice(0, keys.length - SEARCH_CACHE_LIMIT)) {
                delete cache[key];
            }
        }
        localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
    } catch (err) {
        if (err?.name === "QuotaExceededError") {
            try {
                localStorage.removeItem(SEARCH_CACHE_KEY);
            } catch (_) {}
        }
    }
}

function clearSearchCache() {
    try {
        localStorage.removeItem(SEARCH_CACHE_KEY);
    } catch (_) {}
}

function normalizeTaxonomy(data = {}) {
    const toItems = (value) => (Array.isArray(value) ? value : [])
        .map((item) => ({
            name: String(item?.name || "Other"),
            count: Number(item?.count || 0),
        }))
        .filter((item) => item.name);
    return {
        kind: data.kind || state.assetKind,
        categories: toItems(data.categories),
        baseModels: toItems(data.baseModels),
        modelTypes: toItems(data.modelTypes),
        tags: toItems(data.tags),
        updated_at: data.updated_at || 0,
        warning: data.warning || "",
    };
}

function mergeTaxonomy(kind, data) {
    if (!data || typeof data !== "object") return;
    const normalized = normalizeTaxonomy({ ...data, kind });
    state.taxonomyByKind = {
        ...state.taxonomyByKind,
        [kind]: normalized,
    };
}

function currentTaxonomy() {
    return normalizeTaxonomy(state.taxonomyByKind[state.assetKind] || { kind: state.assetKind });
}

async function loadConfig() {
    try {
        state.config = await apiGet("/config");
    } catch (err) {
        console.warn("[Civitai Manager] Failed to load config:", err);
    }
    render();
}

async function loadTaxonomy(kind = state.assetKind, options = {}) {
    const silent = options.silent === true;
    const force = options.force === true;
    state.taxonomyLoading = true;
    if (!silent) render();
    try {
        const data = await apiGet(`/taxonomy?kind=${encodeURIComponent(kind)}${force ? "&force=true" : ""}`);
        mergeTaxonomy(kind, data);
    } catch (err) {
        console.warn("[Civitai Manager] Failed to load taxonomy:", err);
    }
    state.taxonomyLoading = false;
    render();
}

async function saveSettings(form) {
    state.settingsSaving = true;
    render();
    try {
        const payload = {
            allow_nsfw: form.allow_nsfw,
            workflow_dir: form.workflow_dir,
            save_metadata: form.save_metadata,
            save_preview: form.save_preview,
        };
        if (String(form.civitai_api_key || "").trim()) {
            payload.civitai_api_key = String(form.civitai_api_key || "").trim();
        }
        const data = await apiPost("/config", payload);
        state.config = data.config;
        clearSearchCache();
        await loadTaxonomy(state.assetKind, { silent: true, force: true });
        showToast("Settings saved");
    } catch (err) {
        state.error = err.message;
    }
    state.settingsSaving = false;
    render();
}

async function clearApiKey() {
    try {
        const data = await apiPost("/config", { civitai_api_key: "" });
        state.config = data.config;
        clearSearchCache();
        await loadTaxonomy(state.assetKind, { silent: true, force: true });
        showToast("API key cleared");
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function testApiConnection() {
    state.apiTesting = true;
    render();
    try {
        const data = await apiGet("/test-api");
        if (data.success) {
            showToast(data.api_key_set ? "Civitai red connected with saved API key" : "Civitai red connected");
        } else {
            state.error = data.error || "Civitai red test failed";
        }
    } catch (err) {
        state.error = err.message;
    }
    state.apiTesting = false;
    render();
}

async function search(reset = true, options = {}) {
    const silent = options.silent === true;
    const forceRefresh = options.forceRefresh === true;
    if (state.loadingSearch) return;
    const requestSeq = ++searchRequestSeq;
    state.loadingSearch = true;
    if (!silent) state.error = "";
    if (reset) {
        state.cursor = "";
        state.nextCursor = "";
        state.searchItems = [];
        state.selectedModel = null;
        state.scroll.discoverResults = 0;
    }
    if (reset) {
        render({ preserveScroll: false });
    } else {
        setDiscoverLoadStatus(true);
    }
    try {
        const params = new URLSearchParams({
            kind: state.assetKind,
            query: state.query,
            sort: state.sort,
            limit: "40",
        });
        if (state.selectedBaseModel) params.set("base_model", state.selectedBaseModel);
        if (state.selectedTag) params.set("tag", state.selectedTag);
        if (state.selectedCivitaiCategory) params.set("category", state.selectedCivitaiCategory);
        if (!reset && state.nextCursor) params.set("cursor", state.nextCursor);
        const requestPath = `/search?${params.toString()}`;
        const cached = forceRefresh ? null : getSearchCache(requestPath);
        const data = cached || await apiGet(requestPath);
        if (!cached) setSearchCache(requestPath, data);
        if (requestSeq !== searchRequestSeq) {
            return;
        }
        const nextItems = Array.isArray(data.items) ? data.items : [];
        const startIndex = state.searchItems.length;
        state.searchItems = reset ? nextItems : [...state.searchItems, ...nextItems];
        state.nextCursor = data.metadata?.nextCursor || "";
        state.cursor = state.nextCursor;
        if (data.taxonomy) mergeTaxonomy(state.assetKind, data.taxonomy);
        if (data.warning && !silent && !nextItems.length) {
            state.error = data.warning;
        }
        if (!reset && state.activeTab === "Discover" && appendDiscoverItems(nextItems, startIndex)) {
            state.loadingSearch = false;
            state.autoLoadingMore = false;
            setDiscoverLoadStatus(false);
            return;
        }
    } catch (err) {
        if (!silent) {
            state.error = err.message;
        } else {
            console.warn("[Civitai Manager] Initial search failed:", err);
        }
    }
    if (requestSeq !== searchRequestSeq) {
        return;
    }
    state.loadingSearch = false;
    state.autoLoadingMore = false;
    render({ preserveScroll: !reset });
    if (pendingResponsiveSearch && state.activeTab === "Discover") {
        pendingResponsiveSearch = false;
        scheduleResponsiveSearch(true);
    }
}

function currentSearchSignature() {
    return [
        state.assetKind,
        state.query,
        state.sort,
        state.selectedBaseModel,
        state.selectedTag,
        state.selectedCivitaiCategory,
    ].map((item) => String(item || "").trim()).join("\u001f");
}

function scheduleResponsiveSearch(immediate = false) {
    if (responsiveSearchTimer) {
        clearTimeout(responsiveSearchTimer);
        responsiveSearchTimer = null;
    }
    responsiveSearchTimer = setTimeout(() => {
        responsiveSearchTimer = null;
        if (state.activeTab !== "Discover") return;
        const signature = currentSearchSignature();
        if (signature === lastResponsiveSearchKey && !pendingResponsiveSearch) return;
        if (state.loadingSearch) {
            pendingResponsiveSearch = true;
            return;
        }
        pendingResponsiveSearch = false;
        lastResponsiveSearchKey = signature;
        search(true, { silent: true });
    }, immediate ? 0 : 450);
}

function setDiscoverLoadStatus(visible) {
    if (state.activeTab !== "Discover" || !bodyEl) return;
    const results = bodyEl.querySelector(".cmgr-discover .cmgr-results");
    if (!results) return;
    results.querySelectorAll(".cmgr-load-status").forEach((item) => item.remove());
    if (visible) {
        results.insertAdjacentHTML("beforeend", `<div class="cmgr-load-status">Loading more...</div>`);
    }
}

function appendDiscoverItems(items, startIndex = 0) {
    if (!items.length || !bodyEl) return false;
    const results = bodyEl.querySelector(".cmgr-discover .cmgr-results");
    if (!results) return false;
    results.querySelectorAll(".cmgr-load-status").forEach((item) => item.remove());
    results.insertAdjacentHTML("beforeend", items.map((model, index) => renderModelCard(model, startIndex + index)).join(""));
    bindDiscoverEvents(bodyEl);
    setupLazyPreviews(results);
    scheduleCardGridSync(results);
    return true;
}

async function selectModel(model) {
    state.selectedModel = model;
    state.pathOverrides = {};
    state.resolution = null;
    state.detailPreviewIndex = 0;
    const firstVersion = getVersions(model)[0] || {};
    state.selectedVersionId = String(firstVersion.id || "");
    state.selectedFileName = String(getFiles(firstVersion)[0]?.name || "");
    renderSelectedModelDetail();
    try {
        const detail = await apiGet(`/model-detail?id=${encodeURIComponent(model.id)}`);
        if (detail.success && detail.model) {
            state.selectedModel = detail.model;
            const version = getSelectedVersion();
            state.selectedVersionId = String(version?.id || getVersions(detail.model)[0]?.id || "");
            state.selectedFileName = String(getSelectedFile()?.name || "");
            renderSelectedModelDetail();
        }
    } catch (_) {
        // Search results are enough for path resolution in the common case.
    }
    await resolveSelectedPath({ detailOnly: true, pathOnly: true });
}

function getVersions(model = state.selectedModel) {
    return Array.isArray(model?.modelVersions) ? model.modelVersions : [];
}

function getSelectedVersion() {
    const versions = getVersions();
    return versions.find((version) => String(version.id) === String(state.selectedVersionId)) || versions[0] || null;
}

function getFiles(version = getSelectedVersion()) {
    return Array.isArray(version?.files) ? version.files : [];
}

function getSelectedFile() {
    const files = getFiles();
    return files.find((file) => String(file.name || file.id) === String(state.selectedFileName)) || files[0] || {};
}

async function resolveSelectedPath(options = {}) {
    if (!state.selectedModel) return;
    state.resolvingPath = true;
    renderSelectionSurface(options);
    try {
        const data = await apiPost("/resolve-path", {
            kind: state.assetKind,
            model: state.selectedModel,
            version: getSelectedVersion() || {},
            file: getSelectedFile() || {},
            overrides: state.pathOverrides,
        });
        state.resolution = data.resolution;
        state.pathOverrides = {
            root_kind: data.resolution.root_kind,
            base_model_dir: data.resolution.base_model_dir,
            category_dir: data.resolution.category_dir,
            filename: data.resolution.filename,
        };
    } catch (err) {
        state.error = err.message;
    }
    state.resolvingPath = false;
    renderSelectionSurface(options);
}

function renderSelectionSurface(options = {}) {
    if (options.pathOnly && options.detailOnly && state.activeTab === "Discover" && updateSelectedPathPanel()) return;
    if (options.detailOnly && state.activeTab === "Discover" && renderSelectedModelDetail()) return;
    render();
}

function renderSelectedModelDetail() {
    if (state.activeTab !== "Discover" || !bodyEl) return false;
    const split = bodyEl.querySelector(".cmgr-discover .cmgr-split");
    if (!split) return false;
    split.classList.add("has-detail");
    split.querySelectorAll("[data-model-id]").forEach((card) => {
        card.classList.toggle("selected", String(card.dataset.modelId) === String(state.selectedModel?.id || ""));
    });
    const existing = split.querySelector(".cmgr-detail");
    const detailModelId = state.selectedModel?.id || "";
    const detailVersionId = state.selectedVersionId || "";
    const html = `<aside class="cmgr-detail is-open" data-detail-model-id="${escapeAttr(detailModelId)}" data-detail-version-id="${escapeAttr(detailVersionId)}">${state.selectedModel ? renderModelDetail(state.selectedModel) : renderEmptyModelDetail()}</aside>`;
    const next = htmlToElement(html);
    if (existing) {
        preserveDetailPreview(existing, next);
        existing.replaceWith(next);
    } else {
        split.appendChild(next);
    }
    bindCommonEvents(bodyEl);
    bindDiscoverEvents(bodyEl);
    return true;
}

function updateSelectedPathPanel() {
    if (!bodyEl || state.activeTab !== "Discover" || !state.selectedModel) return false;
    const detail = bodyEl.querySelector(".cmgr-discover .cmgr-detail");
    if (!detail) return false;
    const pathBox = detail.querySelector(".cmgr-path-box");
    const downloadBtn = detail.querySelector('[data-action="download"]');
    if (pathBox) pathBox.outerHTML = renderPathBox();
    if (downloadBtn) downloadBtn.disabled = !state.resolution?.download_url;
    bindDiscoverEvents(bodyEl);
    return true;
}

function htmlToElement(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "").trim();
    return template.content.firstElementChild;
}

function preserveDetailPreview(existing, next) {
    const oldPreview = existing?.querySelector?.(".cmgr-detail-preview");
    const newPreview = next?.querySelector?.(".cmgr-detail-preview");
    if (!oldPreview || !newPreview) return;
    const samePreview = oldPreview.dataset.previewKey && oldPreview.dataset.previewKey === newPreview.dataset.previewKey;
    const sameSelection = existing.dataset.detailModelId
        && existing.dataset.detailModelId === next.dataset.detailModelId
        && existing.dataset.detailVersionId === next.dataset.detailVersionId;
    if (samePreview || sameSelection) {
        newPreview.replaceWith(oldPreview);
    }
}

async function startDownload() {
    if (!state.selectedModel || !state.resolution) return;
    try {
        await apiPost("/download", {
            kind: state.assetKind,
            model: state.selectedModel,
            version: getSelectedVersion() || {},
            file: getSelectedFile() || {},
            overrides: state.pathOverrides,
        });
        showToast("Download queued");
        state.activeTab = "Downloads";
        await loadDownloads();
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function loadDownloads(doRender = true) {
    try {
        state.downloads = await apiGet("/download-status");
    } catch (_) {
        state.downloads = state.downloads || {};
    }
    tuneDownloadPolling();
    if (doRender !== false) {
        lastDownloadNavCount = activeDownloadCount();
        render();
    } else if (state.activeTab === "Downloads") {
        renderDownloadListOnly();
    } else {
        const nextCount = activeDownloadCount();
        if (nextCount !== lastDownloadNavCount) {
            lastDownloadNavCount = nextCount;
            const comboState = captureOpenComboState();
            renderNav(navEl);
            restoreOpenComboState(comboState);
        }
    }
}

async function loadLibrary() {
    state.libraryLoading = true;
    render();
    try {
        const data = await apiGet("/library");
        state.libraryItems = Array.isArray(data.items) ? data.items : [];
        const visible = state.libraryItems.filter((item) => assetMatchesKind(item));
        if (!visible.some((item) => item.id === state.selectedAssetId)) {
            state.selectedAssetId = visible[0]?.id || "";
        }
    } catch (err) {
        console.warn("[Civitai Manager] Failed to load library:", err);
    }
    state.libraryLoading = false;
    render();
}

function getSelectedAsset() {
    return state.libraryItems.find((item) => item.id === state.selectedAssetId) || null;
}

async function moveSelectedAsset(form) {
    const asset = getSelectedAsset();
    if (!asset) return;
    try {
        await apiPost("/asset/move", {
            root_kind: asset.root_kind,
            relative_path: asset.relative_path,
            target_root_kind: form.target_root_kind,
            base_model_dir: form.base_model_dir,
            category_dir: form.category_dir,
            filename: form.filename,
        });
        showToast("Asset moved");
        await loadLibrary();
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function deleteSelectedAsset() {
    const asset = getSelectedAsset();
    if (!asset) return;
    if (!confirm(`Delete ${asset.filename}? This also removes companion metadata and preview files.`)) return;
    try {
        await apiPost("/asset/delete", {
            root_kind: asset.root_kind,
            relative_path: asset.relative_path,
        });
        state.selectedAssetId = "";
        showToast("Asset deleted");
        await loadLibrary();
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function enrichSelectedAsset() {
    const asset = getSelectedAsset();
    if (!asset) return;
    try {
        showToast("Hashing asset...");
        const data = await apiPost("/asset/metadata", {
            root_kind: asset.root_kind,
            relative_path: asset.relative_path,
        });
        showToast(data.matched ? "Metadata matched from Civitai" : "SHA256 metadata saved");
        await loadLibrary();
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function toggleSelectedFavorite() {
    const asset = getSelectedAsset();
    if (!asset) return;
    try {
        await apiPost("/asset/favorite", {
            root_kind: asset.root_kind,
            relative_path: asset.relative_path,
            favorite: !asset.favorite,
        });
        showToast(!asset.favorite ? "Marked favorite" : "Removed favorite");
        await loadLibrary();
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function openSelectedFolder() {
    const asset = getSelectedAsset();
    if (!asset) return;
    try {
        await apiPost("/asset/open-folder", {
            root_kind: asset.root_kind,
            relative_path: asset.relative_path,
        });
        showToast("Folder opened");
    } catch (err) {
        state.error = err.message;
        render();
    }
}

function render(options = {}) {
    if (!state.mounted || !bodyEl) return;
    const preserveScroll = options.preserveScroll !== false;
    const scrollState = preserveScroll ? captureScrollState() : null;
    const comboState = captureOpenComboState();
    if (navEl) {
        renderNav(navEl);
        restoreOpenComboState(comboState);
    }
    bodyEl.innerHTML = `
        ${state.error ? `<div class="cmgr-alert"><span>${escapeHtml(state.error)}</span><button data-action="clear-error">Dismiss</button></div>` : ""}
        ${state.toast ? `<div class="cmgr-toast">${escapeHtml(state.toast)}</div>` : ""}
        ${renderActiveTab()}
    `;
    bindCommonEvents(bodyEl);
    bindActiveTabEvents(bodyEl);
    if (scrollState) restoreScrollState(scrollState);
    scheduleCardGridSync(bodyEl);
}

function captureOpenComboState() {
    const combo = navEl?.querySelector?.(".cmgr-combo.open");
    if (!combo) return null;
    return {
        id: combo.dataset.combo || "",
        query: combo.querySelector("[data-combo-search]")?.value || "",
        focused: combo.contains(document.activeElement),
    };
}

function restoreOpenComboState(snapshot) {
    if (!snapshot?.id || !navEl) return;
    const combo = Array.from(navEl.querySelectorAll(".cmgr-combo")).find((item) => item.dataset.combo === snapshot.id);
    if (!combo) return;
    const toggle = combo.querySelector("[data-combo-toggle]");
    const searchInput = combo.querySelector("[data-combo-search]");
    combo.classList.add("open");
    toggle?.setAttribute("aria-expanded", "true");
    if (searchInput) {
        searchInput.value = snapshot.query || "";
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        if (snapshot.focused) {
            requestAnimationFrame(() => {
                searchInput.focus();
                const length = searchInput.value.length;
                searchInput.setSelectionRange?.(length, length);
            });
        }
    }
}

function captureScrollState() {
    const selectors = [".cmgr-results", ".cmgr-split", ".cmgr-detail-scroll", ".cmgr-nav", ".cmgr-download-list", ".cmgr-settings-grid"];
    return selectors.map((selector) => {
        const element = selector === ".cmgr-nav" ? navEl : bodyEl?.querySelector(selector);
        return element ? { selector, top: element.scrollTop, left: element.scrollLeft } : null;
    }).filter(Boolean);
}

function restoreScrollState(scrollState) {
    const apply = () => {
        scrollState.forEach((item) => {
            const element = item.selector === ".cmgr-nav" ? navEl : bodyEl?.querySelector(item.selector);
            if (!element) return;
            element.scrollTop = item.top;
            element.scrollLeft = item.left;
        });
    };
    apply();
    requestAnimationFrame(apply);
}

function attachRememberedScroll(element, key, onScroll) {
    if (!element || !key) return;
    const value = Number(state.scroll[key] || 0);
    if (value > 0) {
        element.scrollTop = value;
    }
    element.onscroll = () => {
        state.scroll[key] = element.scrollTop;
        onScroll?.(element);
    };
}

function maybeAutoLoadMore(element) {
    if (!element || state.loadingSearch || state.autoLoadingMore || !state.nextCursor) return;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining > 520) return;
    state.autoLoadingMore = true;
    search(false, { silent: true });
}

function renderNav(nav) {
    nav.innerHTML = `
        <div class="cmgr-nav-group">
            <div class="cmgr-nav-title">Views</div>
            ${TABS.map((tab) => `
                <button class="cmgr-nav-btn ${state.activeTab === tab ? "active" : ""}" data-tab="${tab}">
                    <span>${tab}</span>
                    ${tab === "Downloads" && activeDownloadCount() ? `<b>${activeDownloadCount()}</b>` : ""}
                </button>
            `).join("")}
        </div>
        ${["Discover", "Library"].includes(state.activeTab) ? renderAssetSidebar() : ""}
    `;
    nav.querySelectorAll("[data-tab]").forEach((btn) => {
        btn.onclick = () => {
            state.activeTab = btn.dataset.tab;
            if (state.activeTab === "Library") loadLibrary();
            if (state.activeTab === "Downloads") loadDownloads();
            if (state.activeTab === "Discover") {
                loadTaxonomy(state.assetKind, { silent: true });
                if (!state.searchItems.length) search(true, { silent: true });
            }
            render();
        };
    });
    nav.querySelectorAll("[data-asset-kind]").forEach((btn) => {
        btn.onclick = () => selectAssetKind(btn.dataset.assetKind);
    });
    bindSelectMenus(nav);
    const assetKindSelect = nav.querySelector("[data-asset-kind-select]");
    if (assetKindSelect) {
        assetKindSelect.onchange = () => selectAssetKind(assetKindSelect.value);
    }
    nav.querySelectorAll("[data-category]").forEach((btn) => {
        selectCategoryButton(btn);
    });
    nav.querySelectorAll("[data-local-folder-toggle]").forEach((btn) => {
        btn.onclick = (event) => {
            event.stopPropagation();
            toggleLocalFolder(btn.dataset.localFolderToggle || "");
        };
    });
    bindSearchCombo(nav.querySelector('[data-combo="base-model"]'), (value) => selectBaseModel(value));
    const clearBaseModel = nav.querySelector("[data-clear-base-model]");
    if (clearBaseModel) clearBaseModel.onclick = () => selectBaseModel("");
    bindSearchCombo(nav.querySelector('[data-combo="tag"]'), (value) => selectTag(value));
    const clearTag = nav.querySelector("[data-clear-tag]");
    if (clearTag) clearTag.onclick = () => selectTag("");
    ensureComboOutsideHandler();
}

function renderAssetSidebar() {
    const taxonomy = currentTaxonomy();
    const baseModels = state.activeTab === "Library" ? libraryBaseModelsForKind(state.assetKind) : taxonomy.baseModels;
    const tags = state.activeTab === "Library" ? libraryTagsForKind(state.assetKind) : taxonomy.tags;
    const selectedCategory = state.activeTab === "Library" ? state.selectedCategory || "" : state.selectedCivitaiCategory || "";
    const localFolderTree = state.activeTab === "Library" ? libraryFolderTreeForKind(state.assetKind) : null;
    const baseModelOptions = ensureSelectedOption(baseModels, state.selectedBaseModel);
    const tagOptions = ensureSelectedOption(tags, state.selectedTag);
    return `
        <div class="cmgr-nav-group cmgr-asset-group">
            <div class="cmgr-nav-title">Asset Type</div>
            ${renderSelectMenu({
                id: "asset-kind",
                value: state.assetKind,
                options: ASSET_KINDS.map((kind) => ({
                    value: kind.id,
                    label: `${kind.label}${state.activeTab === "Library" ? ` (${libraryCountForKind(kind.id)})` : ""}`,
                })),
                inputAttrs: "data-asset-kind-select",
            })}
        </div>
        <div class="cmgr-nav-group cmgr-category-group">
            <div class="cmgr-nav-title">Base Model</div>
            <div class="cmgr-search-picker">
                ${renderSearchCombo({
                    id: "base-model",
                    value: state.selectedBaseModel,
                    items: baseModelOptions,
                    placeholder: "Choose a base model",
                    searchPlaceholder: "Search base models...",
                    emptyText: "No base models found",
                })}
                <button class="cmgr-clear-filter" data-clear-base-model title="Clear base model" ${state.selectedBaseModel ? "" : "disabled"}>Clear</button>
            </div>
            ${state.taxonomyLoading && state.activeTab === "Discover" ? `<div class="cmgr-nav-note">Loading base models...</div>` : ""}
            ${!baseModels.length && !state.taxonomyLoading ? `<div class="cmgr-nav-note">Base models appear from Civitai red data.</div>` : ""}
        </div>
        ${state.activeTab === "Discover" ? `
            <div class="cmgr-nav-group cmgr-category-group">
                <div class="cmgr-nav-title">Filter by Category</div>
                <div class="cmgr-chip-grid">
                    <button class="cmgr-filter-chip ${!state.selectedCivitaiCategory ? "active" : ""}" data-category="">All</button>
                    ${CIVITAI_CATEGORY_FILTERS.map((item) => `
                        <button class="cmgr-filter-chip ${state.selectedCivitaiCategory === item.value ? "active" : ""}" data-category="${escapeAttr(item.value)}">
                            ${escapeHtml(item.label)}
                        </button>
                    `).join("")}
                </div>
            </div>
        ` : ""}
        ${state.activeTab === "Library" ? `
            <div class="cmgr-nav-group cmgr-category-group">
                <div class="cmgr-nav-title">Local Folders</div>
                <button class="cmgr-nav-btn ${!selectedCategory ? "active" : ""}" data-category="">
                    <span>All</span>
                    <b>${libraryCountForKind(state.assetKind)}</b>
                </button>
                ${renderLibraryFolderTree(localFolderTree)}
                ${!localFolderTree?.count ? `<div class="cmgr-nav-note">Local folders appear after scanning your model files.</div>` : ""}
            </div>
        ` : ""}
        <div class="cmgr-nav-group cmgr-category-group">
            <div class="cmgr-nav-title">Search Tags</div>
            <div class="cmgr-search-picker">
                ${renderSearchCombo({
                    id: "tag",
                    value: state.selectedTag,
                    items: tagOptions,
                    placeholder: "Choose a tag",
                    searchPlaceholder: "Search tags...",
                    emptyText: "No tags found",
                })}
                <button class="cmgr-clear-filter" data-clear-tag title="Clear tag" ${state.selectedTag ? "" : "disabled"}>Clear</button>
            </div>
            ${state.taxonomyLoading && state.activeTab === "Discover" ? `<div class="cmgr-nav-note">Loading tags from Civitai red...</div>` : ""}
            ${!tags.length && !state.taxonomyLoading ? `<div class="cmgr-nav-note">Tags appear from Civitai red model and tag data.</div>` : ""}
        </div>
    `;
}

function renderLibraryFolderTree(tree) {
    if (!tree?.count) return "";
    const rootFiles = tree.rootFileCount ? renderLibraryRootFilesNode(tree.rootFileCount) : "";
    return `
        <div class="cmgr-folder-tree">
            ${rootFiles}
            ${tree.children.map((node) => renderLibraryFolderNode(node, 0)).join("")}
        </div>
    `;
}

function renderLibraryRootFilesNode(count) {
    return `
        <div class="cmgr-folder-node" style="--cmgr-folder-depth: 0">
            <div class="cmgr-folder-row">
                <span class="cmgr-folder-spacer" aria-hidden="true"></span>
                <button class="cmgr-nav-btn cmgr-folder-select ${state.selectedCategory === ROOT_LOCAL_FOLDER ? "active" : ""}" data-category="${ROOT_LOCAL_FOLDER}" title="Root files">
                    <span>Root files</span>
                    <b>${count}</b>
                </button>
            </div>
        </div>
    `;
}

function renderLibraryFolderNode(node, depth) {
    const expanded = isLocalFolderExpanded(node.path);
    const hasChildren = node.children.length > 0;
    const depthValue = Math.min(depth, 8);
    return `
        <div class="cmgr-folder-node" style="--cmgr-folder-depth: ${depthValue}">
            <div class="cmgr-folder-row">
                ${hasChildren ? `
                    <button class="cmgr-folder-toggle ${expanded ? "expanded" : ""}" data-local-folder-toggle="${escapeAttr(node.path)}" aria-label="${expanded ? "Collapse" : "Expand"} ${escapeAttr(node.path)}" aria-expanded="${expanded ? "true" : "false"}"></button>
                ` : `<span class="cmgr-folder-spacer" aria-hidden="true"></span>`}
                <button class="cmgr-nav-btn cmgr-folder-select ${state.selectedCategory === node.path ? "active" : ""}" data-category="${escapeAttr(node.path)}" title="${escapeAttr(node.path)}">
                    <span>${escapeHtml(node.name)}</span>
                    <b>${node.count}</b>
                </button>
            </div>
            ${hasChildren && expanded ? `<div class="cmgr-folder-children">${node.children.map((child) => renderLibraryFolderNode(child, depth + 1)).join("")}</div>` : ""}
        </div>
    `;
}

function renderSearchCombo(options = {}) {
    const id = String(options.id || "combo");
    const value = String(options.value || "").trim();
    const items = (Array.isArray(options.items) ? options.items : [])
        .map((item) => String(item?.name || "").trim())
        .filter(Boolean);
    const uniqueItems = Array.from(new Set(items));
    const display = value || options.placeholder || "Choose...";
    return `
        <div class="cmgr-combo" data-combo="${escapeAttr(id)}">
            <button class="cmgr-combo-control" type="button" data-combo-toggle aria-haspopup="listbox" aria-expanded="false" title="${escapeAttr(display)}">
                <span class="cmgr-combo-value ${value ? "" : "placeholder"}">${escapeHtml(display)}</span>
                <span class="cmgr-combo-arrow" aria-hidden="true">⌄</span>
            </button>
            <div class="cmgr-combo-popover" data-combo-popover>
                <input class="cmgr-combo-search" data-combo-search value="" placeholder="${escapeAttr(options.searchPlaceholder || "Search...")}" autocomplete="off" />
                <div class="cmgr-combo-list" data-combo-list role="listbox">
                    ${uniqueItems.map((name) => `
                        <button class="cmgr-combo-option ${value && name.toLowerCase() === value.toLowerCase() ? "active" : ""}" type="button" data-combo-option="${escapeAttr(name)}" role="option" aria-selected="${value && name.toLowerCase() === value.toLowerCase() ? "true" : "false"}">
                            <span>${escapeHtml(name)}</span>
                        </button>
                    `).join("")}
                    <div class="cmgr-combo-empty" data-combo-empty ${uniqueItems.length ? "hidden" : ""}>${escapeHtml(options.emptyText || "No options found")}</div>
                </div>
            </div>
        </div>
    `;
}

function renderSelectMenu(options = {}) {
    const id = String(options.id || "select");
    const selectedValue = String(options.value ?? "");
    const items = (Array.isArray(options.options) ? options.options : [])
        .map((item) => ({
            value: String(item?.value ?? item?.id ?? item?.name ?? ""),
            label: String(item?.label ?? item?.name ?? item?.value ?? ""),
        }))
        .filter((item) => item.value || item.label);
    const selected = items.find((item) => item.value === selectedValue) || items[0] || { value: selectedValue, label: selectedValue || "Choose..." };
    const inputAttrs = options.inputAttrs ? ` ${String(options.inputAttrs).trim()}` : "";
    const className = options.className ? ` ${escapeAttr(options.className)}` : "";
    return `
        <div class="cmgr-combo cmgr-select-menu${className}" data-combo="${escapeAttr(id)}" data-select-menu>
            <input type="hidden"${inputAttrs} value="${escapeAttr(selected.value)}" />
            <button class="cmgr-combo-control" type="button" data-combo-toggle aria-haspopup="listbox" aria-expanded="false" title="${escapeAttr(selected.label)}">
                <span class="cmgr-combo-value">${escapeHtml(selected.label)}</span>
                <span class="cmgr-combo-arrow" aria-hidden="true">⌄</span>
            </button>
            <div class="cmgr-combo-popover" data-combo-popover>
                <div class="cmgr-combo-list" data-combo-list role="listbox">
                    ${items.map((item) => `
                        <button class="cmgr-combo-option ${item.value === selected.value ? "active" : ""}" type="button" data-select-value="${escapeAttr(item.value)}" role="option" aria-selected="${item.value === selected.value ? "true" : "false"}">
                            <span>${escapeHtml(item.label)}</span>
                        </button>
                    `).join("")}
                </div>
            </div>
        </div>
    `;
}

function bindSelectMenus(root) {
    if (!root) return;
    root.querySelectorAll("[data-select-menu]").forEach((menu) => {
        const toggle = menu.querySelector("[data-combo-toggle]");
        const input = menu.querySelector('input[type="hidden"]');
        const valueEl = menu.querySelector(".cmgr-combo-value");
        const options = Array.from(menu.querySelectorAll("[data-select-value]"));
        if (!toggle || !input) return;
        let activeIndex = Math.max(0, options.findIndex((option) => option.classList.contains("active")));
        const setOpen = (open) => {
            if (open) {
                document.querySelectorAll(".cmgr-combo.open").forEach((item) => {
                    if (item !== menu) {
                        item.classList.remove("open");
                        item.querySelector("[data-combo-toggle]")?.setAttribute("aria-expanded", "false");
                    }
                });
            }
            menu.classList.toggle("open", open);
            toggle.setAttribute("aria-expanded", open ? "true" : "false");
            if (open && options[activeIndex]) {
                options[activeIndex].classList.add("is-key-active");
                options[activeIndex].scrollIntoView({ block: "nearest" });
            }
        };
        const setActive = (index, behavior = {}) => {
            if (!options.length) return;
            activeIndex = (index + options.length) % options.length;
            options.forEach((option) => option.classList.remove("is-key-active"));
            options[activeIndex].classList.add("is-key-active");
            if (behavior.scroll !== false) options[activeIndex].scrollIntoView({ block: "nearest" });
        };
        const choose = (option) => {
            if (!option) return;
            const value = option.dataset.selectValue || "";
            const label = option.textContent?.trim() || value;
            input.value = value;
            valueEl.textContent = label;
            toggle.title = label;
            options.forEach((item) => {
                const active = item === option;
                item.classList.toggle("active", active);
                item.setAttribute("aria-selected", active ? "true" : "false");
            });
            setOpen(false);
            input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        toggle.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(!menu.classList.contains("open"));
        };
        toggle.onkeydown = (event) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                return;
            }
            if (event.key === "Tab") {
                setOpen(false);
                return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (!menu.classList.contains("open")) setOpen(true);
                setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1), { scroll: true });
                return;
            }
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (!menu.classList.contains("open")) {
                    setOpen(true);
                } else {
                    choose(options[activeIndex]);
                }
            }
        };
        options.forEach((option) => {
            option.onpointerdown = (event) => {
                event.preventDefault();
                event.stopPropagation();
                choose(option);
            };
            option.onmouseenter = () => setActive(options.indexOf(option), { scroll: false });
        });
    });
}

function bindSearchCombo(combo, applyValue) {
    if (!combo || typeof applyValue !== "function") return;
    const toggle = combo.querySelector("[data-combo-toggle]");
    const searchInput = combo.querySelector("[data-combo-search]");
    const options = Array.from(combo.querySelectorAll("[data-combo-option]"));
    const empty = combo.querySelector("[data-combo-empty]");
    let activeIndex = Math.max(0, options.findIndex((option) => option.classList.contains("active")));

    const visibleOptions = () => options.filter((option) => !option.hidden);
    const setOpen = (open) => {
        if (open) {
            document.querySelectorAll(".cmgr-combo.open").forEach((item) => {
                if (item !== combo) {
                    item.classList.remove("open");
                    item.querySelector("[data-combo-toggle]")?.setAttribute("aria-expanded", "false");
                }
            });
        }
        combo.classList.toggle("open", open);
        toggle?.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
            filterOptions("");
            requestAnimationFrame(() => {
                searchInput?.focus();
                searchInput?.select();
            });
        }
    };
    const setActive = (index, behavior = {}) => {
        const visible = visibleOptions();
        if (!visible.length) {
            activeIndex = -1;
            options.forEach((option) => option.classList.remove("is-key-active"));
            return;
        }
        activeIndex = (index + visible.length) % visible.length;
        options.forEach((option) => option.classList.remove("is-key-active"));
        const option = visible[activeIndex];
        option.classList.add("is-key-active");
        if (behavior.scroll !== false) option.scrollIntoView({ block: "nearest" });
    };
    const filterOptions = (query) => {
        const clean = String(query || "").trim().toLowerCase();
        let visibleCount = 0;
        options.forEach((option) => {
            const value = String(option.dataset.comboOption || "");
            const match = !clean || value.toLowerCase().includes(clean);
            option.hidden = !match;
            if (match) visibleCount += 1;
        });
        if (empty) empty.hidden = visibleCount > 0;
        const visible = visibleOptions();
        const selectedIndex = visible.findIndex((option) => option.classList.contains("active"));
        setActive(selectedIndex >= 0 ? selectedIndex : 0);
    };
    const choose = (value) => {
        setOpen(false);
        applyValue(value);
    };

    toggle.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setOpen(!combo.classList.contains("open"));
    };
    searchInput.oninput = () => filterOptions(searchInput.value);
    searchInput.onkeydown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            toggle?.focus();
            return;
        }
        if (event.key === "Tab") {
            setOpen(false);
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(activeIndex + (event.key === "ArrowDown" ? 1 : -1), { scroll: true });
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            const option = visibleOptions()[activeIndex];
            if (option) {
                choose(option.dataset.comboOption || "");
            } else {
                const typed = String(searchInput.value || "").trim();
                if (typed) choose(typed);
            }
        }
    };
    options.forEach((option) => {
        option.onpointerdown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            choose(option.dataset.comboOption || "");
        };
        option.onmouseenter = () => setActive(visibleOptions().indexOf(option), { scroll: false });
    });
}

function ensureComboOutsideHandler() {
    if (comboOutsideBound) return;
    comboOutsideBound = true;
    document.addEventListener("pointerdown", (event) => {
        document.querySelectorAll(".cmgr-combo.open").forEach((combo) => {
            if (!combo.contains(event.target)) {
                combo.classList.remove("open");
                combo.querySelector("[data-combo-toggle]")?.setAttribute("aria-expanded", "false");
            }
        });
    }, true);
}

function selectCategoryButton(btn) {
    btn.onclick = () => {
        const category = btn.dataset.category || "";
        if (state.activeTab === "Discover") {
            if (state.selectedCivitaiCategory === category) return;
            state.selectedCivitaiCategory = category;
        } else {
            if (state.selectedCategory === category) return;
            state.selectedCategory = category;
            expandLocalFolderAncestors(category);
        }
        state.selectedModel = null;
        state.selectedAssetId = "";
        state.resolution = null;
        state.scroll.discoverResults = 0;
        state.scroll.libraryResults = 0;
        if (state.activeTab === "Discover") {
            search(true, { silent: true });
        } else {
            render();
        }
    };
}

function selectBaseModelButton(btn) {
    btn.onclick = () => selectBaseModel(btn.dataset.baseModel || "");
}

function selectTagButton(btn) {
    btn.onclick = () => selectTag(btn.dataset.tag || "");
}

function toggleLocalFolder(path) {
    const folder = normalizeLocalFolderPath(path);
    if (!folder) return;
    const key = localFolderStateKey(folder);
    state.expandedLocalFolders[key] = !state.expandedLocalFolders[key];
    render();
}

function expandLocalFolderAncestors(path) {
    const folder = normalizeLocalFolderPath(path);
    if (!folder || folder === ROOT_LOCAL_FOLDER) return;
    const parts = splitLocalPath(folder);
    for (let index = 1; index <= parts.length; index += 1) {
        state.expandedLocalFolders[localFolderStateKey(parts.slice(0, index).join("/"))] = true;
    }
}

function isLocalFolderExpanded(path) {
    return Boolean(state.expandedLocalFolders[localFolderStateKey(path)]);
}

function localFolderStateKey(path) {
    return `${state.assetKind}:${normalizeLocalFolderPath(path)}`;
}

function selectBaseModel(baseModel) {
    baseModel = normalizePickerChoice(baseModel, currentBaseModelItems());
    if (state.selectedBaseModel === baseModel) return;
    state.selectedBaseModel = baseModel;
    state.selectedModel = null;
    state.selectedAssetId = "";
    state.resolution = null;
    state.scroll.discoverResults = 0;
    state.scroll.libraryResults = 0;
    if (state.activeTab === "Discover") {
        search(true, { silent: true });
    } else {
        render();
    }
}

function selectTag(tag) {
    tag = normalizePickerChoice(tag, currentTagItems());
    if (state.selectedTag === tag) return;
    state.selectedTag = tag;
    state.selectedModel = null;
    state.selectedAssetId = "";
    state.resolution = null;
    state.scroll.discoverResults = 0;
    state.scroll.libraryResults = 0;
    if (state.activeTab === "Discover") {
        search(true, { silent: true });
    } else {
        render();
    }
}

function selectAssetKind(kind) {
    if (!kind || state.assetKind === kind) return;
    searchRequestSeq++;
    state.loadingSearch = false;
    state.autoLoadingMore = false;
    state.assetKind = kind;
    state.selectedCategory = "";
    state.selectedCivitaiCategory = "";
    state.selectedBaseModel = "";
    state.selectedTag = "";
    state.selectedModel = null;
    state.selectedAssetId = "";
    state.resolution = null;
    state.searchItems = [];
    state.nextCursor = "";
    state.cursor = "";
    state.scroll.discoverResults = 0;
    state.scroll.libraryResults = 0;
    loadTaxonomy(kind, { silent: true });
    if (state.activeTab === "Discover") {
        search(true, { silent: true });
    } else {
        render();
    }
}

function renderActiveTab() {
    if (state.activeTab === "Library") return renderLibrary();
    if (state.activeTab === "Downloads") return renderDownloads();
    if (state.activeTab === "Settings") return renderSettings();
    return renderDiscover();
}

function renderDiscover() {
    const selected = state.selectedModel;
    const filterText = activeFilterText();
    return `
        <section class="cmgr-page cmgr-discover">
            <div class="cmgr-toolbar">
                <h2>${escapeHtml(assetKindLabel(state.assetKind))}${filterText ? ` · ${escapeHtml(filterText)}` : ""}</h2>
                <div class="cmgr-search-wrap">
                    <span class="cmgr-search-mark" aria-hidden="true">⌕</span>
                    <input class="cmgr-input cmgr-search" data-field="query" value="${escapeAttr(state.query)}" placeholder="Search as you type..." autocomplete="off" />
                    ${state.query ? `<button class="cmgr-search-clear" data-action="clear-search" title="Clear search">×</button>` : ""}
                </div>
                ${renderSelectMenu({
                    id: "sort",
                    value: state.sort,
                    options: ["Highest Rated", "Most Downloaded", "Newest"].map((sort) => ({ value: sort, label: sort })),
                    inputAttrs: 'data-field="sort"',
                    className: "cmgr-toolbar-select",
                })}
                <button class="cmgr-primary" data-action="search">${state.loadingSearch ? "Searching..." : "Search"}</button>
            </div>
            <div class="cmgr-split has-detail">
                <div class="cmgr-results">
                    ${state.searchItems.length ? state.searchItems.map(renderModelCard).join("") : renderEmptySearch()}
                    ${state.loadingSearch && state.searchItems.length ? `<div class="cmgr-load-status">Loading more...</div>` : ""}
                </div>
                <aside class="cmgr-detail is-open">${selected ? renderModelDetail(selected) : renderEmptyModelDetail()}</aside>
            </div>
        </section>
    `;
}

function renderEmptySearch() {
    if (state.loadingSearch) return `<div class="cmgr-empty">Searching Civitai...</div>`;
    return `<div class="cmgr-empty">Search ${escapeHtml(assetKindLabel(state.assetKind))} from Civitai red.</div>`;
}

function renderModelCard(model, index = 0) {
    const version = getVersions(model)[0] || {};
    const badge = version.baseModel || model.baseModel || model.base_model || "Other";
    return `
        <article class="cmgr-card ${state.selectedModel?.id === model.id ? "selected" : ""}" data-model-id="${escapeAttr(model.id)}" style="position:relative;width:100%;height:auto!important;min-height:0!important;aspect-ratio:auto!important;overflow:hidden;">
            <div class="cmgr-card-spacer" aria-hidden="true" style="display:block;width:100%;height:0;padding-top:150%;pointer-events:none;"></div>
            <div class="cmgr-thumb">${renderMedia(modelPreviewMedia(model), model.name, { defer: index >= INITIAL_PREVIEW_LOADS, priority: index < INITIAL_PREVIEW_LOADS ? "high" : "low" })}</div>
            ${badge ? `<div class="cmgr-card-badge">${escapeHtml(badge)}</div>` : ""}
            <div class="cmgr-card-body">
                <div class="cmgr-card-title">${escapeHtml(model.name || "Untitled")}</div>
                ${renderCardStats(model, version)}
            </div>
        </article>
    `;
}

function renderCardStats(model, version = {}) {
    const stats = getModelStats(model, version);
    return `
        <div class="cmgr-card-stat-row" aria-label="Model stats">
            <span class="cmgr-card-stat-chip" title="Downloads"><span aria-hidden="true">↓</span><span>${formatStatCount(stats.downloadCount)}</span></span>
            <span class="cmgr-card-stat-chip" title="Likes"><span aria-hidden="true">♥</span><span>${formatStatCount(stats.likeCount)}</span></span>
        </div>
    `;
}

function renderModelDetail(model) {
    const versions = getVersions(model);
    const version = getSelectedVersion() || versions[0] || {};
    const files = getFiles(version);
    const file = getSelectedFile() || files[0] || {};
    const resolution = state.resolution;
    const modelUrl = `https://civitai.red/models/${encodeURIComponent(model.id || "")}`;
    return `
        <div class="cmgr-detail-scroll">
            <button class="cmgr-detail-close" data-action="close-detail" title="Close detail">×</button>
            ${renderDetailPreview(modelPreviewItems(model, version, 700), model.name, state.detailPreviewIndex)}
            <div class="cmgr-detail-head">
                <div>
                    <a class="cmgr-detail-title-link" href="${escapeAttr(modelUrl)}" target="_blank" rel="noopener noreferrer" title="Open on Civitai red">
                        <h2>${escapeHtml(model.name || "Untitled")}</h2>
                        <span class="cmgr-external-icon" aria-hidden="true">↗</span>
                    </a>
                    <p>${escapeHtml(model.creator?.username || "Unknown creator")} · ${escapeHtml(model.type || "Asset")} · ${escapeHtml(modelTagSummary(model) || categoryLabel(model))}</p>
                </div>
            </div>
            <label class="cmgr-label">Version</label>
            ${renderSelectMenu({
                id: "selected-version",
                value: String(version.id || ""),
                options: versions.map((item) => ({
                    value: String(item.id || ""),
                    label: `${item.name || item.id} · ${item.baseModel || "Other"}`,
                })),
                inputAttrs: 'data-field="selected-version"',
                className: "cmgr-full",
            })}
            <label class="cmgr-label">File</label>
            ${renderSelectMenu({
                id: "selected-file",
                value: String(file.name || file.id || ""),
                options: files.map((item) => ({
                    value: String(item.name || item.id || ""),
                    label: `${item.name || "Unnamed file"}${item.sizeKB ? ` · ${formatBytes(item.sizeKB * 1024)}` : ""}`,
                })),
                inputAttrs: 'data-field="selected-file"',
                className: "cmgr-full",
            })}
            <div class="cmgr-section-title">Trigger Words</div>
            <div class="cmgr-trained">
                ${(Array.isArray(version.trainedWords) ? version.trainedWords : []).slice(0, 12).map((word) => `<button data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("") || `<span>No trained words listed.</span>`}
            </div>
            ${renderPathBox()}
            <button class="cmgr-primary cmgr-full" data-action="download" ${resolution?.download_url ? "" : "disabled"}>Queue Download</button>
            <div class="cmgr-section-title">Description</div>
            <div class="cmgr-description">${sanitizeDescriptionHtml(model.description || version.description || "")}</div>
        </div>
    `;
}

function renderEmptyModelDetail() {
    return `
        <div class="cmgr-detail-scroll">
            <div class="cmgr-empty-detail">
                <h2>Select a model</h2>
                <p>Model details, versions, files, and download path will stay here.</p>
            </div>
        </div>
    `;
}

function renderPathEditor(resolution) {
    return `
        <div class="cmgr-grid2">
            <label>Type${renderSelectMenu({
                id: "override-root-kind",
                value: state.pathOverrides.root_kind || "",
                options: ROOT_KINDS
                    .filter((root) => rootKindsForAssetKind(state.assetKind).includes(root.id))
                    .map((root) => ({ value: root.id, label: root.label })),
                inputAttrs: 'data-override="root_kind"',
            })}</label>
            <label>Base Model<input class="cmgr-input" data-override="base_model_dir" value="${escapeAttr(state.pathOverrides.base_model_dir || "")}" ${state.pathOverrides.root_kind === "workflows" ? "disabled" : ""} /></label>
            <label>Category<input class="cmgr-input" data-override="category_dir" value="${escapeAttr(state.pathOverrides.category_dir || "")}" /></label>
            <label>Filename<input class="cmgr-input" data-override="filename" value="${escapeAttr(state.pathOverrides.filename || "")}" /></label>
        </div>
        <div class="cmgr-path">${escapeHtml(resolution.absolute_path || "")}</div>
        ${resolution.exists ? `<div class="cmgr-warning">A file already exists at this path. The downloader will keep both by adding a numeric suffix.</div>` : ""}
    `;
}

function renderPathBox() {
    return `
        <div class="cmgr-path-box">
            <div class="cmgr-path-title">Automatic Save Path</div>
            ${state.resolution ? renderPathEditor(state.resolution) : `<div class="cmgr-muted">${state.resolvingPath ? "Resolving path..." : "No path resolved yet."}</div>`}
        </div>
    `;
}

function renderLibrary() {
    const items = filteredLibraryItems();
    const selected = getSelectedAsset();
    const filterText = activeFilterText();
    return `
        <section class="cmgr-page">
            <div class="cmgr-toolbar">
                <h2>Library · ${escapeHtml(assetKindLabel(state.assetKind))}${filterText ? ` · ${escapeHtml(filterText)}` : ""}</h2>
                <button class="cmgr-secondary" data-action="refresh-library">${state.libraryLoading ? "Scanning..." : "Refresh"}</button>
            </div>
            <div class="cmgr-split ${selected ? "has-detail" : ""}">
                <div class="cmgr-results">
                    ${items.length ? items.map(renderAssetCard).join("") : `<div class="cmgr-empty">No local assets found for this filter.</div>`}
                </div>
                ${selected ? `<aside class="cmgr-detail is-open">${renderAssetDetail(selected)}</aside>` : ""}
            </div>
        </section>
    `;
}

function renderAssetCard(asset, index = 0) {
    const badge = asset.base_model || inferBaseFromPath(asset) || "Other";
    return `
        <article class="cmgr-card asset ${state.selectedAssetId === asset.id ? "selected" : ""}" data-asset-id="${escapeAttr(asset.id)}" style="position:relative;width:100%;height:auto!important;min-height:0!important;aspect-ratio:auto!important;overflow:hidden;">
            <div class="cmgr-card-spacer" aria-hidden="true" style="display:block;width:100%;height:0;padding-top:150%;pointer-events:none;"></div>
            <div class="cmgr-thumb small">${renderImage(asset.thumb_url, asset.name, { defer: index >= INITIAL_PREVIEW_LOADS, priority: index < INITIAL_PREVIEW_LOADS ? "high" : "low" })}</div>
            ${badge ? `<div class="cmgr-card-badge">${escapeHtml(badge)}</div>` : ""}
            <div class="cmgr-card-body">
                <div class="cmgr-card-title">${escapeHtml(asset.name || asset.filename)}</div>
            </div>
        </article>
    `;
}

function renderAssetDetail(asset) {
    const baseValue = asset.base_model || inferBaseFromPath(asset);
    const categoryValue = asset.category || inferCategoryFromPath(asset);
    return `
        <div class="cmgr-detail-scroll">
            <button class="cmgr-detail-close" data-action="close-detail" title="Close detail">×</button>
            ${renderDetailPreview(asset.thumb_url, asset.name, 0)}
            <div class="cmgr-detail-head">
                <div>
                    <h2>${escapeHtml(asset.name || asset.filename)}</h2>
                    <p>${escapeHtml(labelForRoot(asset.root_kind))} · ${escapeHtml(baseValue || "Other")} · ${escapeHtml(categoryValue || "Other")}</p>
                </div>
            </div>
            <div class="cmgr-info-list">
                <div><span>File</span><b>${escapeHtml(asset.filename)}</b></div>
                <div><span>Relative Path</span><b>${escapeHtml(asset.relative_path)}</b></div>
                <div><span>Size</span><b>${formatBytes(asset.size || 0)}</b></div>
                <div><span>Metadata</span><b>${escapeHtml(asset.metadata_status || "unknown")}</b></div>
                <div><span>Absolute Path</span><b>${escapeHtml(asset.absolute_path || "")}</b></div>
            </div>
            <div class="cmgr-section-title">Trigger Words</div>
            <div class="cmgr-trained">
                ${(asset.trained_words || []).slice(0, 16).map((word) => `<button data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("") || `<span>No trained words cached.</span>`}
            </div>
            <div class="cmgr-path-box">
                <div class="cmgr-path-title">Move / Rename</div>
                <div class="cmgr-grid2">
                    <label>Type${renderSelectMenu({
                        id: "move-root-kind",
                        value: asset.root_kind || "",
                        options: ROOT_KINDS
                            .filter((root) => compatibleRootKinds(asset.root_kind).includes(root.id))
                            .map((root) => ({ value: root.id, label: root.label })),
                        inputAttrs: 'data-move="target_root_kind"',
                    })}</label>
                    <label>Base Model<input class="cmgr-input" data-move="base_model_dir" value="${escapeAttr(baseValue || "Other")}" ${asset.root_kind === "workflows" ? "disabled" : ""}/></label>
                    <label>Category<input class="cmgr-input" data-move="category_dir" value="${escapeAttr(categoryValue || "Other")}" /></label>
                    <label>Filename<input class="cmgr-input" data-move="filename" value="${escapeAttr(asset.filename)}" /></label>
                </div>
                <button class="cmgr-secondary cmgr-full" data-action="move-asset">Move Asset</button>
            </div>
            <div class="cmgr-action-row">
                <button class="cmgr-secondary" data-action="favorite-asset">${asset.favorite ? "Unfavorite" : "Favorite"}</button>
                <button class="cmgr-secondary" data-action="open-folder">Open Folder</button>
                <button class="cmgr-secondary" data-action="enrich-asset">Hash + Fetch Metadata</button>
                <button class="cmgr-danger" data-action="delete-asset">Delete</button>
            </div>
        </div>
    `;
}

function renderDownloads() {
    const jobs = Object.values(state.downloads || {}).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return `
        <section class="cmgr-page">
            <div class="cmgr-toolbar">
                <h2>Downloads</h2>
                <button class="cmgr-secondary" data-action="refresh-downloads">Refresh</button>
            </div>
            <div class="cmgr-download-list">
                ${renderDownloadJobs(jobs)}
            </div>
        </section>
    `;
}

function renderDownloadListOnly() {
    if (!bodyEl) return false;
    const list = bodyEl.querySelector(".cmgr-download-list");
    if (!list) return false;
    const jobs = Object.values(state.downloads || {}).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    list.innerHTML = renderDownloadJobs(jobs);
    return true;
}

function renderDownloadJobs(jobs) {
    return jobs.length ? jobs.map(renderDownloadJob).join("") : `<div class="cmgr-empty">No download jobs yet.</div>`;
}

function renderDownloadJob(job) {
    const total = Number(job.total || 0);
    const progress = Number(job.progress || 0);
    const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : (job.status === "completed" ? 100 : 0);
    const active = ["pending", "downloading"].includes(job.status);
    const progressClass = total > 0 ? "" : " indeterminate";
    return `
        <article class="cmgr-download">
            <div class="cmgr-download-head">
                <div>
                    <strong>${escapeHtml(job.filename || "Download")}</strong>
                    <span>${escapeHtml(job.root_kind || "")} · ${escapeHtml(job.relative_path || "")}</span>
                </div>
                <b class="${job.status}">${escapeHtml(job.status || "pending")}</b>
            </div>
            <div class="cmgr-progress${progressClass}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                <div style="width:${pct}%"></div>
                <span>${total > 0 ? `${pct}%` : (active ? "Waiting for size..." : `${pct}%`)}</span>
            </div>
            <div class="cmgr-card-meta">
                <span>${pct}%</span>
                <span>${formatBytes(progress)} / ${total ? formatBytes(total) : "unknown"}</span>
            </div>
            ${job.error ? `<div class="cmgr-warning">${escapeHtml(job.error)}</div>` : ""}
            ${job.target_path ? `<div class="cmgr-path">${escapeHtml(job.target_path)}</div>` : ""}
        </article>
    `;
}

function renderSettings() {
    const config = state.config || {};
    const roots = config.roots || {};
    return `
        <section class="cmgr-page settings">
            <div class="cmgr-settings-grid">
                <div class="cmgr-settings-column">
                    <div class="cmgr-settings-form cmgr-setting-card">
                        <div class="cmgr-settings-head">
                            <div>
                                <h2>Connection</h2>
                                <p>Civitai red API access and restricted content permissions.</p>
                            </div>
                            <span class="cmgr-setting-status ${config.api_key_set ? "is-set" : ""}">${config.api_key_set ? "Key saved" : "No key"}</span>
                        </div>
                        <label class="cmgr-label">Civitai API Key</label>
                        <input class="cmgr-input cmgr-full" data-setting="civitai_api_key" type="password" value="" placeholder="${config.api_key_set ? "Leave blank to keep the saved key" : "Optional, required for restricted downloads"}" />
                        <div class="cmgr-action-row">
                            <button class="cmgr-secondary" data-action="test-api">${state.apiTesting ? "Testing..." : "Test API"}</button>
                            ${config.api_key_set ? `<button class="cmgr-secondary" data-action="clear-api-key">Clear Saved Key</button>` : ""}
                        </div>
                    </div>

                    <div class="cmgr-settings-form cmgr-setting-card">
                        <div class="cmgr-settings-head">
                            <div>
                                <h2>Download Defaults</h2>
                                <p>Defaults used when queueing models and companion files.</p>
                            </div>
                        </div>
                        <div class="cmgr-check-list">
                            <label class="cmgr-check"><input type="checkbox" data-setting="allow_nsfw" ${config.allow_nsfw ? "checked" : ""}/> <span>Allow NSFW results</span></label>
                            <label class="cmgr-check"><input type="checkbox" data-setting="save_metadata" ${config.save_metadata !== false ? "checked" : ""}/> <span>Save companion metadata JSON</span></label>
                            <label class="cmgr-check"><input type="checkbox" data-setting="save_preview" ${config.save_preview !== false ? "checked" : ""}/> <span>Save companion preview image</span></label>
                        </div>
                    </div>
                </div>

                <div class="cmgr-settings-column">
                    <div class="cmgr-settings-form cmgr-setting-card">
                        <div class="cmgr-settings-head">
                            <div>
                                <h2>Workflow Storage</h2>
                                <p>Online workflows are saved here as JSON files.</p>
                            </div>
                        </div>
                        <label class="cmgr-label">Workflow Directory</label>
                        <input class="cmgr-input cmgr-full" data-setting="workflow_dir" value="${escapeAttr(config.workflow_dir || "")}" />
                    </div>

                    <div class="cmgr-roots cmgr-setting-card">
                        <div class="cmgr-settings-head">
                            <div>
                                <h2>Resolved Roots</h2>
                                <p>Model roots detected from ComfyUI folder paths.</p>
                            </div>
                        </div>
                        <div class="cmgr-root-list">
                            ${ROOT_KINDS.map((root) => `
                                <div class="cmgr-root-row">
                                    <span>${root.label}</span>
                                    <b>${escapeHtml(roots[root.id] || "")}</b>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>

                <div class="cmgr-settings-footer">
                    <button class="cmgr-primary" data-action="save-settings">${state.settingsSaving ? "Saving..." : "Save Settings"}</button>
                </div>
            </div>
        </section>
    `;
}

function bindCommonEvents(root) {
    bindSelectMenus(root);
    const clear = root.querySelector('[data-action="clear-error"]');
    if (clear) clear.onclick = () => {
        state.error = "";
        render();
    };
    root.querySelectorAll("[data-copy]").forEach((btn) => {
        btn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(btn.dataset.copy || "");
                showToast("Copied");
            } catch (_) {
                showToast("Copy failed");
            }
        };
    });
}

function bindActiveTabEvents(root) {
    if (state.activeTab === "Discover") bindDiscoverEvents(root);
    if (state.activeTab === "Library") bindLibraryEvents(root);
    if (state.activeTab === "Downloads") bindDownloadsEvents(root);
    if (state.activeTab === "Settings") bindSettingsEvents(root);
    setupLazyPreviews(root);
    scheduleCardGridSync(root);
}

function setupLazyPreviews(root) {
    previewObserver?.disconnect();
    previewObserver = null;
    const pending = [...root.querySelectorAll("img[data-cmgr-src], video[data-cmgr-src]")];
    if (!pending.length) return;

    const loadImage = (img) => {
        const src = img.dataset.cmgrSrc;
        if (!src || img.dataset.cmgrLoaded === "1") return;
        img.dataset.cmgrLoaded = "1";
        img.src = src;
        if (img.tagName === "VIDEO") {
            img.load();
            img.play?.().catch(() => {});
        }
    };

    const scrollRoot = root.querySelector(".cmgr-results") || null;
    if ("IntersectionObserver" in window) {
        previewObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                previewObserver?.unobserve(entry.target);
                loadImage(entry.target);
            });
        }, { root: scrollRoot, rootMargin: "700px 0px" });
        pending.forEach((img) => previewObserver.observe(img));
    } else {
        pending.forEach(loadImage);
    }
}

function bindDiscoverEvents(root) {
    const queryInput = root.querySelector('[data-field="query"]');
    if (queryInput) {
        queryInput.oninput = () => {
            state.query = queryInput.value;
            scheduleResponsiveSearch();
        };
        queryInput.onkeydown = (event) => {
            if (event.key === "Enter") {
                if (responsiveSearchTimer) {
                    clearTimeout(responsiveSearchTimer);
                    responsiveSearchTimer = null;
                }
                lastResponsiveSearchKey = currentSearchSignature();
                search(true, { forceRefresh: true });
            }
        };
    }
    const clearSearch = root.querySelector('[data-action="clear-search"]');
    if (clearSearch) clearSearch.onclick = () => {
        state.query = "";
        if (responsiveSearchTimer) {
            clearTimeout(responsiveSearchTimer);
            responsiveSearchTimer = null;
        }
        search(true, { silent: true });
    };
    const sortSelect = root.querySelector('[data-field="sort"]');
    if (sortSelect) sortSelect.onchange = () => {
        searchRequestSeq++;
        state.loadingSearch = false;
        state.autoLoadingMore = false;
        state.sort = sortSelect.value;
        search(true, { silent: true });
    };
    const searchBtn = root.querySelector('[data-action="search"]');
    if (searchBtn) searchBtn.onclick = () => {
        if (responsiveSearchTimer) {
            clearTimeout(responsiveSearchTimer);
            responsiveSearchTimer = null;
        }
        lastResponsiveSearchKey = currentSearchSignature();
        search(true, { forceRefresh: true });
    };
    const moreBtn = root.querySelector('[data-action="load-more"]');
    if (moreBtn) moreBtn.onclick = () => search(false);
    attachRememberedScroll(root.querySelector(".cmgr-results"), "discoverResults", maybeAutoLoadMore);
    const closeDetail = root.querySelector('[data-action="close-detail"]');
    if (closeDetail) closeDetail.onclick = () => {
        state.selectedModel = null;
        state.resolution = null;
        renderSelectedModelDetail() || render();
    };
    root.querySelectorAll("[data-model-id]").forEach((card) => {
        card.onclick = () => {
            const results = card.closest(".cmgr-results");
            if (results) {
                state.scroll.discoverResults = results.scrollTop;
            }
            if (String(state.selectedModel?.id || "") === String(card.dataset.modelId || "")) {
                return;
            }
            const model = state.searchItems.find((item) => String(item.id) === String(card.dataset.modelId));
            if (model) selectModel(model);
        };
    });
    const versionSelect = root.querySelector('[data-field="selected-version"]');
    if (versionSelect) versionSelect.onchange = async () => {
        state.selectedVersionId = versionSelect.value;
        state.selectedFileName = String(getFiles(getSelectedVersion())[0]?.name || "");
        state.pathOverrides = {};
        state.detailPreviewIndex = 0;
        renderSelectedModelDetail();
        await resolveSelectedPath({ detailOnly: true, pathOnly: true });
    };
    const fileSelect = root.querySelector('[data-field="selected-file"]');
    if (fileSelect) fileSelect.onchange = async () => {
        state.selectedFileName = fileSelect.value;
        state.pathOverrides = {};
        await resolveSelectedPath({ detailOnly: true, pathOnly: true });
    };
    root.querySelectorAll("[data-override]").forEach((input) => {
        input.onchange = async () => {
            state.pathOverrides[input.dataset.override] = input.value;
            await resolveSelectedPath({ detailOnly: true, pathOnly: true });
        };
    });
    const downloadBtn = root.querySelector('[data-action="download"]');
    if (downloadBtn) downloadBtn.onclick = () => startDownload();
    root.querySelectorAll("[data-preview-delta]").forEach((btn) => {
        btn.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            const delta = Number(btn.dataset.previewDelta || 0);
            state.detailPreviewIndex = Math.max(0, state.detailPreviewIndex + delta);
            const preview = btn.closest(".cmgr-detail-preview");
            if (preview && state.selectedModel) {
                preview.outerHTML = renderDetailPreview(
                    modelPreviewItems(state.selectedModel, getSelectedVersion(), 700),
                    state.selectedModel.name,
                    state.detailPreviewIndex,
                );
                bindDiscoverEvents(bodyEl);
                setupLazyPreviews(bodyEl.querySelector(".cmgr-detail") || bodyEl);
            } else {
                renderSelectedModelDetail();
            }
        };
    });
}

function bindLibraryEvents(root) {
    root.querySelectorAll("[data-library-filter]").forEach((btn) => {
        btn.onclick = () => {
            state.libraryFilter = btn.dataset.libraryFilter;
            render();
        };
    });
    const refresh = root.querySelector('[data-action="refresh-library"]');
    if (refresh) refresh.onclick = () => loadLibrary();
    attachRememberedScroll(root.querySelector(".cmgr-results"), "libraryResults");
    const closeDetail = root.querySelector('[data-action="close-detail"]');
    if (closeDetail) closeDetail.onclick = () => {
        state.selectedAssetId = "";
        render();
    };
    root.querySelectorAll("[data-asset-id]").forEach((card) => {
        card.onclick = () => {
            const results = card.closest(".cmgr-results");
            if (results) {
                state.scroll.libraryResults = results.scrollTop;
            }
            if (String(state.selectedAssetId || "") === String(card.dataset.assetId || "")) {
                return;
            }
            state.detailPreviewIndex = 0;
            state.selectedAssetId = card.dataset.assetId;
            render();
        };
    });
    const move = root.querySelector('[data-action="move-asset"]');
    if (move) move.onclick = () => {
        moveSelectedAsset(readMoveForm(root));
    };
    const del = root.querySelector('[data-action="delete-asset"]');
    if (del) del.onclick = () => deleteSelectedAsset();
    const enrich = root.querySelector('[data-action="enrich-asset"]');
    if (enrich) enrich.onclick = () => enrichSelectedAsset();
    const favorite = root.querySelector('[data-action="favorite-asset"]');
    if (favorite) favorite.onclick = () => toggleSelectedFavorite();
    const openFolder = root.querySelector('[data-action="open-folder"]');
    if (openFolder) openFolder.onclick = () => openSelectedFolder();
}

function bindDownloadsEvents(root) {
    const refresh = root.querySelector('[data-action="refresh-downloads"]');
    if (refresh) refresh.onclick = () => loadDownloads();
}

function bindSettingsEvents(root) {
    const save = root.querySelector('[data-action="save-settings"]');
    if (save) save.onclick = () => saveSettings(readSettingsForm(root));
    const test = root.querySelector('[data-action="test-api"]');
    if (test) test.onclick = () => testApiConnection();
    const clear = root.querySelector('[data-action="clear-api-key"]');
    if (clear) clear.onclick = () => clearApiKey();
}

function readMoveForm(root) {
    const form = {};
    root.querySelectorAll("[data-move]").forEach((input) => {
        form[input.dataset.move] = input.value;
    });
    return form;
}

function readSettingsForm(root) {
    const form = {};
    root.querySelectorAll("[data-setting]").forEach((input) => {
        form[input.dataset.setting] = input.type === "checkbox" ? input.checked : input.value;
    });
    return form;
}

function assetKindLabel(kind) {
    return ASSET_KINDS.find((item) => item.id === kind)?.label || kind || "Asset";
}

function rootKindsForAssetKind(kind) {
    const found = ASSET_KINDS.find((item) => item.id === kind);
    if (Array.isArray(found?.rootKinds)) return found.rootKinds;
    if (kind === "workflow") return ["workflows"];
    if (kind === "checkpoint") return ["checkpoints", "unet"];
    return ["loras"];
}

function compatibleRootKinds(rootKind) {
    if (["checkpoints", "unet"].includes(rootKind)) return ["checkpoints", "unet"];
    if (rootKind === "workflows") return ["workflows"];
    return ["loras"];
}

function assetMatchesKind(asset, kind = state.assetKind) {
    return rootKindsForAssetKind(kind).includes(asset.root_kind);
}

function assetCategory(asset) {
    return asset.category || inferCategoryFromPath(asset) || "Other";
}

function assetBaseModel(asset) {
    return asset.base_model || inferBaseFromPath(asset) || "Other";
}

function assetTags(asset) {
    return Array.isArray(asset?.tags)
        ? asset.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
        : [];
}

function activeFilterText() {
    const category = state.activeTab === "Discover" ? categoryFilterLabel(state.selectedCivitaiCategory) : localFolderFilterLabel(state.selectedCategory);
    return [state.selectedBaseModel, category, state.selectedTag]
        .filter(Boolean)
        .join(" · ");
}

function localFolderFilterLabel(value) {
    const folder = normalizeLocalFolderPath(value);
    if (!folder) return "";
    if (folder === ROOT_LOCAL_FOLDER) return "Root files";
    return folder;
}

function categoryFilterLabel(value) {
    if (!value) return "";
    return CIVITAI_CATEGORY_FILTERS.find((item) => item.value === value)?.label || value;
}

function ensureSelectedOption(items, selected) {
    const list = Array.isArray(items) ? items : [];
    if (!selected || list.some((item) => item.name === selected)) return list;
    return [{ name: selected, count: 0 }, ...list];
}

function currentBaseModelItems() {
    const taxonomy = currentTaxonomy();
    return state.activeTab === "Library" ? libraryBaseModelsForKind(state.assetKind) : taxonomy.baseModels;
}

function currentTagItems() {
    const taxonomy = currentTaxonomy();
    return state.activeTab === "Library" ? libraryTagsForKind(state.assetKind) : taxonomy.tags;
}

function normalizePickerChoice(value, items) {
    const clean = String(value || "").trim();
    if (!clean) return "";
    const match = (Array.isArray(items) ? items : []).find((item) => String(item?.name || "").toLowerCase() === clean.toLowerCase());
    return match?.name || clean;
}

function filteredLibraryItems() {
    const selectedFolder = normalizeLocalFolderPath(state.selectedCategory);
    return state.libraryItems.filter((item) => {
        if (!assetMatchesKind(item)) return false;
        if (state.selectedBaseModel && assetBaseModel(item).toLowerCase() !== state.selectedBaseModel.toLowerCase()) return false;
        if (selectedFolder && !assetMatchesLocalFolder(item, selectedFolder)) return false;
        if (state.selectedTag && !assetTags(item).some((tag) => tag.toLowerCase() === state.selectedTag.toLowerCase())) return false;
        return true;
    });
}

function libraryCountForKind(kind) {
    return state.libraryItems.filter((item) => assetMatchesKind(item, kind)).length;
}

function libraryFolderTreeForKind(kind) {
    const root = { count: 0, rootFileCount: 0, children: new Map() };
    state.libraryItems.filter((item) => assetMatchesKind(item, kind)).forEach((item) => {
        root.count += 1;
        const parts = itemLocalFolderParts(item);
        if (!parts.length) {
            root.rootFileCount += 1;
            return;
        }
        let children = root.children;
        let currentPath = "";
        parts.forEach((part) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            if (!children.has(part)) {
                children.set(part, { name: part, path: currentPath, count: 0, children: new Map() });
            }
            const node = children.get(part);
            node.count += 1;
            children = node.children;
        });
    });
    return {
        count: root.count,
        rootFileCount: root.rootFileCount,
        children: sortLocalFolderNodes(root.children),
    };
}

function sortLocalFolderNodes(children) {
    return Array.from(children.values())
        .map((node) => ({
            ...node,
            children: sortLocalFolderNodes(node.children),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

function assetMatchesLocalFolder(asset, selectedFolder) {
    const folder = itemLocalFolderPath(asset);
    if (selectedFolder === ROOT_LOCAL_FOLDER) return !folder;
    return folder === selectedFolder || folder.startsWith(`${selectedFolder}/`);
}

function itemLocalFolderPath(asset) {
    return itemLocalFolderParts(asset).join("/");
}

function itemLocalFolderParts(asset) {
    if (typeof asset?.folder_path === "string") return splitLocalPath(asset.folder_path);
    const parts = splitLocalPath(asset?.relative_path);
    parts.pop();
    return parts;
}

function normalizeLocalFolderPath(value) {
    if (value === ROOT_LOCAL_FOLDER) return ROOT_LOCAL_FOLDER;
    return splitLocalPath(value).join("/");
}

function splitLocalPath(value) {
    return String(value || "")
        .replaceAll("\\", "/")
        .split("/")
        .filter((part) => part && part !== ".");
}

function libraryBaseModelsForKind(kind) {
    const counts = state.libraryItems.filter((item) => assetMatchesKind(item, kind)).reduce((acc, item) => {
        const baseModel = assetBaseModel(item);
        acc[baseModel] = (acc[baseModel] || 0) + 1;
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function libraryTagsForKind(kind) {
    const counts = state.libraryItems.filter((item) => assetMatchesKind(item, kind)).reduce((acc, item) => {
        assetTags(item).forEach((tag) => {
            acc[tag] = (acc[tag] || 0) + 1;
        });
        return acc;
    }, {});
    return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function countByRoot() {
    return state.libraryItems.reduce((acc, item) => {
        acc[item.root_kind] = (acc[item.root_kind] || 0) + 1;
        return acc;
    }, {});
}

function activeDownloadCount() {
    return Object.values(state.downloads || {}).filter((job) => ["pending", "downloading"].includes(job.status)).length;
}

function isInstalled(model) {
    const modelId = String(model?.id || "");
    return state.libraryItems.some((item) => String(item.model_id || "") === modelId);
}

function inferBaseFromPath(asset) {
    if (asset.root_kind === "workflows") return "";
    const parts = String(asset.relative_path || "").split("/");
    return parts.length > 2 ? parts[0] : "Other";
}

function inferCategoryFromPath(asset) {
    const parts = String(asset.relative_path || "").split("/");
    if (asset.root_kind === "workflows") return parts.length > 1 ? parts[0] : "Other";
    return parts.length > 2 ? parts[1] : "Other";
}

function labelForRoot(rootKind) {
    return ROOT_KINDS.find((root) => root.id === rootKind)?.label || rootKind || "Asset";
}

function categoryLabel(model) {
    if (typeof model.category === "string") return model.category;
    if (model.category?.name) return model.category.name;
    return model.modelCategory || "Other";
}

function modelTagSummary(model) {
    const tags = Array.isArray(model?.tags)
        ? model.tags.map((tag) => String(tag || "").trim()).filter(Boolean)
        : [];
    return tags.slice(0, 2).join(", ");
}

function modelPreviewMedia(model, width = 450) {
    const versions = getVersions(model);
    for (const version of versions) {
        const images = Array.isArray(version.images) ? version.images : [];
        for (const image of images) {
            const media = normalizePreviewMedia(image, width);
            if (media.url) return media;
        }
    }
    const images = Array.isArray(model?.images) ? model.images : [];
    for (const image of images) {
        const media = normalizePreviewMedia(image, width);
        if (media.url) return media;
    }
    return { url: "", type: "image" };
}

function modelPreviewItems(model, version = getSelectedVersion(), width = 700) {
    const seen = new Set();
    const addImages = (images, items) => {
        if (!Array.isArray(images)) return;
        const ordered = [
            ...images.filter((image) => !isPreviewVideo(image)),
            ...images.filter((image) => isPreviewVideo(image)),
        ];
        for (const image of ordered) {
            if (items.length >= DETAIL_PREVIEW_LIMIT) break;
            const media = normalizePreviewMedia(image, width);
            if (!media.url || seen.has(media.url)) continue;
            seen.add(media.url);
            items.push(media);
        }
    };
    const items = [];
    addImages(version?.images, items);
    return items.length ? items : [modelPreviewMedia(model, width)];
}

function isPreviewVideo(image) {
    const rawUrl = typeof image === "string" ? image : image?.url || image?.videoUrl || image?.thumbnailUrl || "";
    const mediaType = String(image?.type || image?.mimeType || image?.contentType || "").toLowerCase();
    return mediaType.includes("video") || looksLikeVideoUrl(rawUrl);
}

function modelPreviewUrl(model, width = 450) {
    return modelPreviewMedia(model, width).url;
}

function normalizePreviewMedia(image, width) {
    const rawUrl = typeof image === "string" ? image : image?.url || image?.videoUrl || image?.thumbnailUrl || "";
    if (!rawUrl) return { url: "", type: "image" };
    const mediaType = String(image?.type || image?.mimeType || image?.contentType || "").toLowerCase();
    const isVideo = mediaType.includes("video") || looksLikeVideoUrl(rawUrl);
    if (isVideo) {
        return {
            url: `${API}/image?url=${encodeURIComponent(rawUrl)}&width=${width}`,
            rawUrl,
            type: "video",
        };
    }
    const optimizedUrl = optimizeCivitaiImage(rawUrl, width);
    return {
        url: `${API}/image?url=${encodeURIComponent(optimizedUrl)}&width=${width}`,
        fallbackUrl: optimizedUrl === rawUrl ? "" : `${API}/image?url=${encodeURIComponent(rawUrl)}&width=${width}`,
        rawUrl,
        type: "image",
    };
}

function looksLikeVideoUrl(url) {
    const clean = String(url || "").split("?")[0].toLowerCase();
    return /\.(mp4|webm|mov|m4v|avi)$/.test(clean) || clean.includes("/video/");
}

function optimizeCivitaiImage(url, width) {
    const text = String(url || "");
    if (!text) return "";
    const path = text.split("?")[0].toLowerCase();
    if (path.endsWith("/original")) return text;
    if (text.includes("width=")) return text.replace(/width=\d+/g, `width=${width}`);
    return `${text}${text.includes("?") ? "&" : "?"}width=${width}`;
}

function renderMedia(media, alt, options = {}) {
    const normalized = typeof media === "string" ? { url: media, type: looksLikeVideoUrl(media) ? "video" : "image" } : media || {};
    if (normalized.type === "video") return renderVideo(normalized, alt, options);
    return renderImage(normalized, alt, options);
}

function renderDetailPreview(media, alt, index = 0) {
    const items = Array.isArray(media)
        ? media
        : [typeof media === "string" ? { url: media, type: looksLikeVideoUrl(media) ? "video" : "image" } : media || {}];
    const available = items.filter((item) => item?.url);
    const list = available.length ? available : [{}];
    const selectedIndex = ((Number(index) || 0) % list.length + list.length) % list.length;
    const normalized = list[selectedIndex] || {};
    const url = normalized.url || "";
    const bg = url ? renderDetailPreviewBackground(normalized, alt) : "";
    const nav = list.length > 1 ? `
        <button class="cmgr-detail-preview-nav prev" data-preview-delta="-1" title="Previous preview">‹</button>
        <button class="cmgr-detail-preview-nav next" data-preview-delta="1" title="Next preview">›</button>
        <div class="cmgr-detail-preview-count">${selectedIndex + 1} / ${list.length}</div>
    ` : "";
    const previewKey = `${normalized.type || "image"}:${url}:${selectedIndex}`;
    return `<div class="cmgr-detail-preview" data-preview-index="${selectedIndex}" data-preview-key="${escapeAttr(previewKey)}">${bg}${renderMedia(normalized, alt, { priority: "high", detail: true })}${nav}</div>`;
}

function renderDetailPreviewBackground(media, alt) {
    const url = media?.url || "";
    if (!url) return "";
    if (media.type === "video") {
        return `<video class="cmgr-detail-preview-bg" src="${escapeAttr(url)}" muted loop playsinline autoplay preload="metadata" aria-hidden="true"></video><div class="cmgr-detail-preview-overlay"></div>`;
    }
    return `<img class="cmgr-detail-preview-bg" src="${escapeAttr(url)}" alt="" aria-hidden="true" decoding="async" /><div class="cmgr-detail-preview-overlay"></div>`;
}

function renderVideo(url, alt, options = {}) {
    if (!url) return `<div class="cmgr-no-image">No Preview</div>`;
    const sourceUrl = typeof url === "string" ? url : url?.url || "";
    const fallbackUrl = typeof url === "string" ? "" : url?.rawUrl || "";
    const loaded = window.__cmgrLoadedImageUrls?.has(sourceUrl);
    const defer = options.defer === true && !loaded;
    const src = defer ? "" : sourceUrl;
    const dataSrc = defer ? `data-cmgr-src="${escapeAttr(sourceUrl)}" data-cmgr-loaded="0"` : "";
    const fallbackAttr = fallbackUrl ? `data-fallback-src="${escapeAttr(fallbackUrl)}"` : "";
    const videoState = loaded ? "is-loaded" : (defer ? "is-pending" : "is-loading");
    return `<video class="cmgr-preview-img cmgr-preview-video ${videoState}" src="${escapeAttr(src)}" ${dataSrc} ${fallbackAttr} muted loop playsinline autoplay preload="${defer ? "none" : "metadata"}" aria-label="${escapeAttr(alt || "Preview video")}" onloadeddata="window.__cmgrMarkImageLoaded?.(this.dataset.cmgrSrc || this.currentSrc || this.src); this.classList.remove('is-pending','is-loading'); this.classList.add('is-loaded')" onerror="if(this.dataset.fallbackSrc&&!this.dataset.triedFallback){this.dataset.triedFallback='1';this.src=this.dataset.fallbackSrc;this.load();this.play?.().catch(()=>{});}else{this.replaceWith(Object.assign(document.createElement('div'),{className:'cmgr-no-image',textContent:'No Preview'}))}"></video>`;
}

function renderImage(url, alt, options = {}) {
    const sourceUrl = typeof url === "string" ? url : url?.url || "";
    const fallbackUrl = typeof url === "string" ? "" : url?.fallbackUrl || url?.rawUrl || "";
    if (!sourceUrl) return `<div class="cmgr-no-image">No Preview</div>`;
    const loaded = window.__cmgrLoadedImageUrls?.has(sourceUrl);
    const defer = options.defer === true && !loaded;
    const src = defer ? TRANSPARENT_PIXEL : sourceUrl;
    const lazyAttrs = defer ? `data-cmgr-src="${escapeAttr(sourceUrl)}" data-cmgr-loaded="0" fetchpriority="low"` : `fetchpriority="${options.priority || "auto"}"`;
    const fallbackAttr = fallbackUrl && fallbackUrl !== sourceUrl ? `data-fallback-src="${escapeAttr(fallbackUrl)}"` : "";
    const imageState = loaded ? "is-loaded" : (defer ? "is-pending" : "is-loading");
    return `<img class="cmgr-preview-img ${imageState}" src="${escapeAttr(src)}" ${lazyAttrs} ${fallbackAttr} alt="${escapeAttr(alt || "Preview")}" loading="${defer ? "lazy" : "eager"}" decoding="async" onload="if(!this.dataset.cmgrSrc || this.dataset.cmgrLoaded==='1'){window.__cmgrMarkImageLoaded?.(this.dataset.cmgrSrc || this.currentSrc || this.src); this.classList.remove('is-pending','is-loading'); this.classList.add('is-loaded')}" onerror="if(this.dataset.fallbackSrc&&!this.dataset.triedFallback){this.dataset.triedFallback='1';this.src=this.dataset.fallbackSrc;}else{this.replaceWith(Object.assign(document.createElement('div'),{className:'cmgr-no-image',textContent:'No Preview'}))}" />`;
}

function sanitizeDescriptionHtml(html) {
    const raw = String(html || "").trim();
    if (!raw) return `<span class="cmgr-muted">No description available.</span>`;
    const allowed = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "pre", "code", "blockquote", "h1", "h2", "h3", "h4"]);
    const template = document.createElement("template");
    template.innerHTML = raw
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

    const renderNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || "");
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const tag = node.tagName.toLowerCase();
        const children = Array.from(node.childNodes).map(renderNode).join("");
        if (!allowed.has(tag)) return children;
        if (tag === "br") return "<br>";
        if (tag === "a") {
            const href = String(node.getAttribute("href") || "").trim();
            const safeHref = /^(https?:)?\/\//i.test(href) || href.startsWith("#") ? href : "";
            return safeHref
                ? `<a href="${escapeAttr(safeHref)}" target="_blank" rel="noopener noreferrer">${children || escapeHtml(safeHref)}</a>`
                : children;
        }
        return `<${tag}>${children}</${tag}>`;
    };

    const cleaned = Array.from(template.content.childNodes).map(renderNode).join("").trim();
    if (cleaned) return cleaned;
    const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text ? `<p>${escapeHtml(text)}</p>` : `<span class="cmgr-muted">No description available.</span>`;
}

function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function readStatValue(source, keys) {
    if (!source || typeof source !== "object") return 0;
    for (const key of keys) {
        const value = Number(source[key]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
}

function getModelStats(model, version = {}) {
    const modelStats = model?.stats || model?.metrics || {};
    const versionStats = version?.stats || version?.metrics || {};
    const downloadKeys = ["downloadCount", "downloads", "download_count"];
    const likeKeys = ["thumbsUpCount", "likeCount", "likes", "favoriteCount", "favorites", "collectedCount"];
    return {
        downloadCount:
            readStatValue(modelStats, downloadKeys) ||
            readStatValue(versionStats, downloadKeys) ||
            readStatValue(model, downloadKeys) ||
            readStatValue(version, downloadKeys),
        likeCount:
            readStatValue(modelStats, likeKeys) ||
            readStatValue(versionStats, likeKeys) ||
            readStatValue(model, likeKeys) ||
            readStatValue(version, likeKeys),
    };
}

function formatStatCount(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return "0";
    if (number >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1).replace(/\.0$/, "")}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(Math.round(number));
}

function showToast(message) {
    state.toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        state.toast = "";
        render();
    }, 1800);
    render();
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
}

function injectStyles() {
    let style = document.getElementById("cmgr-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "cmgr-style";
    }
    style.textContent = `
        :root {
            --cmgr-bg: var(--cmgr-sampled-panel-bg, var(--comfy-menu-bg, var(--bg-color, var(--p-content-background, #202124))));
            --cmgr-panel: var(--cmgr-sampled-panel-bg, var(--comfy-menu-bg, var(--p-content-background, var(--bg-color, #202124))));
            --cmgr-panel-soft: var(--cmgr-sampled-card-bg, var(--comfy-input-bg, var(--component-node-widget-background, var(--secondary-background, #2b2d31))));
            --cmgr-panel-hover: color-mix(in srgb, var(--cmgr-control) 94%, var(--cmgr-text) 6%);
            --cmgr-control: var(--cmgr-sampled-control-bg, var(--p-button-secondary-background, var(--secondary-background, var(--comfy-input-bg, var(--cmgr-panel-soft)))));
            --cmgr-border: var(--border-color, var(--cmgr-sampled-border-color, var(--p-content-border-color, var(--p-button-secondary-border-color, #4a4a4a))));
            --cmgr-divider: var(--border-color, var(--cmgr-border));
            --cmgr-text: var(--cmgr-sampled-text-color, var(--fg-color, var(--input-text, var(--p-text-color, var(--base-foreground, #f2f3f5)))));
            --cmgr-muted: var(--cmgr-sampled-muted-color, var(--descrip-text, var(--p-text-muted-color, var(--muted-foreground, #9ca3af))));
            --cmgr-accent: var(--p-primary-color, var(--p-button-primary-background, #62a8ff));
            --cmgr-accent-text: var(--p-primary-contrast-color, #fff);
            --cmgr-good: #31d0aa;
            --cmgr-warn: #f1b84b;
            --cmgr-bad: #ff6b6b;
            --cmgr-info: var(--cmgr-accent);
            --cmgr-radius: 8px;
            --cmgr-shadow: var(--p-overlay-popover-shadow, 0 18px 48px rgba(0, 0, 0, 0.32));
            --cmgr-backdrop: color-mix(in srgb, var(--cmgr-bg) 72%, transparent);
            --cmgr-accent-soft: color-mix(in srgb, var(--cmgr-accent) 14%, transparent);
            --cmgr-accent-border: color-mix(in srgb, var(--cmgr-accent) 22%, transparent);
            --cmgr-danger: var(--cmgr-bad);
            --cmgr-success: var(--cmgr-good);
            --cmgr-warning: var(--cmgr-warn);
            --cmgr-danger-soft: color-mix(in srgb, var(--cmgr-bad) 14%, transparent);
            --cmgr-danger-border: color-mix(in srgb, var(--cmgr-bad) 22%, transparent);
        }
        .cmgr-left-entry {
            position: fixed;
            left: 8px;
            top: 46%;
            z-index: 999;
            writing-mode: vertical-rl;
            transform: translateY(-50%);
            border: 1px solid rgba(92, 180, 255, 0.45);
            background: #141922;
            color: #d8e8ff;
            padding: 10px 7px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
        }
        .cmgr-left-entry:hover {
            opacity: 1;
            background: #1d2633;
        }
        .cmgr-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: none;
            background: rgba(5, 7, 10, 0.72);
            color: #e6edf7;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .cmgr-overlay.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .cmgr-shell {
            width: min(1480px, calc(100vw - 48px));
            height: min(920px, calc(100vh - 48px));
            background: #101318;
            border: 1px solid #2b323d;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 28px 80px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
        }
        .cmgr-topbar {
            height: 68px;
            padding: 12px 18px;
            border-bottom: 1px solid #27303a;
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #151a21;
        }
        .cmgr-title {
            font-size: 20px;
            font-weight: 800;
        }
        .cmgr-subtitle {
            margin-top: 3px;
            font-size: 12px;
            color: #9aa6b6;
        }
        .cmgr-layout {
            min-height: 0;
            flex: 1;
            display: grid;
            grid-template-columns: 180px minmax(0, 1fr);
        }
        .cmgr-nav {
            border-right: 1px solid #27303a;
            background: #12171e;
            padding: 14px 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cmgr-nav-btn,
        .cmgr-segmented button,
        .cmgr-primary,
        .cmgr-secondary,
        .cmgr-danger,
        .cmgr-icon-btn,
        .cmgr-load-more,
        .cmgr-trained button,
        .cmgr-alert button {
            border: 1px solid #323b47;
            background: #1b222b;
            color: #e6edf7;
            border-radius: 7px;
            min-height: 34px;
            padding: 0 12px;
            cursor: pointer;
            font-weight: 650;
        }
        .cmgr-nav-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .cmgr-nav-btn.active,
        .cmgr-segmented button.active {
            background: #243142;
            border-color: #5ea6e8;
            color: #f7fbff;
        }
        .cmgr-nav-btn b {
            min-width: 22px;
            height: 22px;
            border-radius: 999px;
            background: #2f8cd8;
            display: grid;
            place-items: center;
            font-size: 11px;
        }
        .cmgr-body {
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            position: relative;
        }
        .cmgr-page {
            height: 100%;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }
        .cmgr-toolbar {
            min-height: 58px;
            padding: 12px;
            border-bottom: 1px solid #27303a;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }
        .cmgr-toolbar h2 {
            margin: 0;
            font-size: 18px;
        }
        .cmgr-segmented {
            display: inline-flex;
            gap: 4px;
            padding: 3px;
            border: 1px solid #2c3541;
            background: #151a21;
            border-radius: 8px;
        }
        .cmgr-segmented button {
            border-color: transparent;
            min-height: 30px;
        }
        .cmgr-input {
            min-height: 34px;
            border: 1px solid #323b47;
            background: #0f1319;
            color: #e6edf7;
            border-radius: 7px;
            padding: 0 10px;
            box-sizing: border-box;
        }
        .cmgr-input:disabled {
            opacity: 0.5;
        }
        .cmgr-search {
            min-width: min(420px, 46vw);
            flex: 1;
        }
        .cmgr-full {
            width: 100%;
        }
        .cmgr-primary {
            background: #2a6ea8;
            border-color: #4ea8e9;
        }
        .cmgr-secondary:hover,
        .cmgr-primary:hover,
        .cmgr-danger:hover,
        .cmgr-load-more:hover,
        .cmgr-trained button:hover {
            filter: brightness(1.13);
        }
        .cmgr-danger {
            background: #5b2024;
            border-color: #a5434b;
        }
        .cmgr-split {
            min-height: 0;
            flex: 1;
            position: relative;
            display: block;
            overflow: hidden;
        }
        .cmgr-results {
            height: 100%;
            min-width: 0;
            overflow: auto;
            padding: 14px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
            align-content: start;
            gap: 12px;
        }
        .cmgr-detail {
            min-width: 0;
            overflow: hidden;
            border-left: 1px solid #27303a;
            background: #12171e;
        }
        .cmgr-detail-scroll {
            height: 100%;
            overflow: auto;
            padding: 14px;
            box-sizing: border-box;
        }
        .cmgr-card {
            border: 1px solid #27303a;
            background: #151a21;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            min-width: 0;
        }
        .cmgr-card:hover,
        .cmgr-card.selected {
            border-color: #5ea6e8;
        }
        .cmgr-thumb {
            position: relative;
            aspect-ratio: 4 / 5;
            background: #0b0f14;
            overflow: hidden;
        }
        .cmgr-thumb.small {
            aspect-ratio: 16 / 10;
        }
        .cmgr-thumb img,
        .cmgr-detail-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .cmgr-no-image {
            width: 100%;
            height: 100%;
            display: grid;
            place-items: center;
            color: #8792a1;
            background: #20242c;
            font-size: 13px;
        }
        .cmgr-card-body {
            padding: 10px;
            display: grid;
            gap: 7px;
        }
        .cmgr-card-title {
            font-size: 13px;
            font-weight: 780;
            line-height: 1.28;
            min-height: 34px;
            overflow: hidden;
        }
        .cmgr-card-meta,
        .cmgr-card-tags {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            color: #9aa6b6;
            font-size: 11px;
        }
        .cmgr-card-tags span {
            border: 1px solid #323b47;
            border-radius: 999px;
            padding: 3px 7px;
            background: #10151c;
        }
        .cmgr-card-tags .installed {
            border-color: #3f9965;
            color: #98e5b2;
        }
        .cmgr-card-tags .favorite {
            border-color: #b7984a;
            color: #ffe09a;
        }
        .cmgr-card-tags .missing,
        .cmgr-warning,
        .cmgr-card-tags .warning {
            color: #ffd28a;
        }
        .cmgr-detail-head {
            display: grid;
            grid-template-columns: 108px minmax(0, 1fr);
            gap: 12px;
            align-items: center;
            margin-bottom: 14px;
        }
        .cmgr-detail-head h2 {
            margin: 0 0 6px;
            font-size: 18px;
            line-height: 1.25;
        }
        .cmgr-detail-head p {
            margin: 0;
            color: #9aa6b6;
            font-size: 12px;
        }
        .cmgr-detail-preview {
            aspect-ratio: 1 / 1;
            border: 1px solid #27303a;
            border-radius: 8px;
            overflow: hidden;
            background: #0b0f14;
        }
        .cmgr-label {
            display: block;
            margin: 12px 0 6px;
            color: #b8c4d4;
            font-size: 12px;
            font-weight: 700;
        }
        .cmgr-trained {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 12px 0;
            color: #9aa6b6;
            font-size: 12px;
        }
        .cmgr-trained button {
            min-height: 28px;
            font-size: 11px;
        }
        .cmgr-path-box {
            border: 1px solid #27303a;
            background: #151a21;
            border-radius: 8px;
            padding: 12px;
            margin: 12px 0;
        }
        .cmgr-path-title {
            font-size: 13px;
            font-weight: 800;
            margin-bottom: 10px;
        }
        .cmgr-grid2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }
        .cmgr-grid2 label {
            display: grid;
            gap: 5px;
            color: #aeb9c8;
            font-size: 11px;
            font-weight: 700;
        }
        .cmgr-path {
            margin-top: 10px;
            word-break: break-all;
            color: #aeb9c8;
            font-size: 11px;
            line-height: 1.45;
            background: #0f1319;
            border: 1px solid #27303a;
            border-radius: 7px;
            padding: 8px;
        }
        .cmgr-description {
            margin-top: 14px;
            color: #aeb9c8;
            font-size: 12px;
            line-height: 1.5;
        }
        .cmgr-empty,
        .cmgr-empty-detail {
            min-height: 240px;
            display: grid;
            place-items: center;
            color: #8e99a8;
            text-align: center;
            padding: 28px;
            border: 1px dashed #303946;
            border-radius: 8px;
        }
        .cmgr-load-more {
            grid-column: 1 / -1;
        }
        .cmgr-load-status {
            grid-column: 1 / -1;
            min-height: 40px;
            display: grid;
            place-items: center;
            color: #a1a1aa;
            font-size: 12.5px;
            font-weight: 750;
        }
        .cmgr-info-list {
            display: grid;
            gap: 7px;
            margin: 12px 0;
        }
        .cmgr-info-list div {
            display: grid;
            grid-template-columns: 100px minmax(0, 1fr);
            gap: 8px;
            font-size: 12px;
        }
        .cmgr-info-list span {
            color: #8693a3;
        }
        .cmgr-info-list b {
            color: #d6dfeb;
            word-break: break-all;
            font-weight: 650;
        }
        .cmgr-action-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .cmgr-download-list {
            overflow: auto;
            padding: 14px;
            display: grid;
            gap: 12px;
        }
        .cmgr-download {
            border: 1px solid #27303a;
            background: #151a21;
            border-radius: 8px;
            padding: 12px;
        }
        .cmgr-download-head {
            display: flex;
            align-items: start;
            justify-content: space-between;
            gap: 12px;
        }
        .cmgr-download-head strong,
        .cmgr-download-head span {
            display: block;
        }
        .cmgr-download-head span {
            margin-top: 4px;
            color: #9aa6b6;
            font-size: 12px;
        }
        .cmgr-download-head b.completed {
            color: #98e5b2;
        }
        .cmgr-download-head b.failed {
            color: #ff9aa3;
        }
        .cmgr-progress {
            height: 8px;
            border-radius: 99px;
            background: #0f1319;
            overflow: hidden;
            margin: 12px 0 8px;
        }
        .cmgr-progress div {
            height: 100%;
            background: #4ea8e9;
        }
        .cmgr-settings-grid {
            padding: 18px;
            display: grid;
            grid-template-columns: minmax(360px, 520px) minmax(320px, 1fr);
            gap: 18px;
            overflow: auto;
        }
        .cmgr-settings-form,
        .cmgr-roots {
            border: 1px solid #27303a;
            background: #151a21;
            border-radius: 8px;
            padding: 16px;
        }
        .cmgr-settings-form h2,
        .cmgr-roots h2 {
            margin: 0 0 14px;
        }
        .cmgr-check {
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 12px 0;
            color: #c5cfdd;
            font-size: 13px;
        }
        .cmgr-root-row {
            display: grid;
            grid-template-columns: 120px minmax(0, 1fr);
            gap: 10px;
            padding: 10px 0;
            border-bottom: 1px solid #27303a;
            font-size: 12px;
        }
        .cmgr-root-row:last-child {
            border-bottom: 0;
        }
        .cmgr-root-row span {
            color: #9aa6b6;
        }
        .cmgr-root-row b {
            word-break: break-all;
        }
        .cmgr-alert {
            position: absolute;
            left: 12px;
            right: 12px;
            top: 12px;
            z-index: 3;
            border: 1px solid #9f4f4f;
            background: #35181b;
            color: #ffd5d8;
            border-radius: 8px;
            padding: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .cmgr-toast {
            position: absolute;
            right: 18px;
            top: 18px;
            z-index: 4;
            background: #1d3428;
            color: #c8f8da;
            border: 1px solid #4c9b6a;
            border-radius: 8px;
            padding: 10px 12px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3);
        }
        .cmgr-muted {
            color: #8d98a8;
        }
        @media (max-width: 980px) {
            .cmgr-shell {
                width: 100vw;
                height: 100vh;
                border-radius: 0;
            }
            .cmgr-layout {
                grid-template-columns: 1fr;
            }
            .cmgr-nav {
                border-right: 0;
                border-bottom: 1px solid #27303a;
                flex-direction: row;
                overflow-x: auto;
            }
            .cmgr-split {
                grid-template-columns: 1fr;
            }
            .cmgr-detail {
                border-left: 0;
                border-top: 1px solid #27303a;
                min-height: 560px;
            }
            .cmgr-settings-grid {
                grid-template-columns: 1fr;
            }
        }

        /* Anima Clothing inspired visual pass. Keep this block last so it
           stabilizes the manager across ComfyUI frontend versions. */
        @keyframes cmgrFadeIn {
            from { opacity: 0; transform: scale(0.985) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .cmgr-overlay {
            z-index: 99999;
            background: rgba(10, 10, 15, 0.74);
            backdrop-filter: blur(15px);
            -webkit-backdrop-filter: blur(15px);
            color: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .cmgr-shell {
            width: min(1780px, calc(100vw - 24px));
            max-width: none;
            height: calc(100vh - 24px);
            max-height: none;
            background: #171718;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.58);
            animation: cmgrFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .cmgr-left-entry {
            left: 10px;
            top: 50%;
            z-index: 9999;
            border: 1px solid rgba(219,39,119,0.36);
            background: rgba(23,23,24,0.92);
            color: #f9a8d4;
            border-radius: 12px;
            padding: 12px 8px;
            box-shadow: 0 14px 34px rgba(0,0,0,0.42), 0 0 18px rgba(219,39,119,0.16);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }
        .cmgr-left-entry:hover {
            background: rgba(219,39,119,0.16);
            border-color: rgba(219,39,119,0.58);
            color: #fff;
        }
        .cmgr-topbar {
            height: auto;
            min-height: 72px;
            padding: 20px 26px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            background: linear-gradient(180deg, rgba(219,39,119,0.08), rgba(23,23,24,0));
            gap: 18px;
        }
        .cmgr-title {
            font-size: 20px;
            font-weight: 850;
            color: #fff;
            line-height: 1.2;
        }
        .cmgr-subtitle {
            font-size: 12.5px;
            color: #a1a1aa;
            margin-top: 5px;
        }
        .cmgr-layout {
            display: grid;
            grid-template-columns: clamp(260px, 16vw, 292px) minmax(0, 1fr);
            min-height: 0;
            flex: 1;
            background: rgba(10,10,15,0.18);
        }
        .cmgr-nav {
            border-right: 1px solid rgba(255,255,255,0.06);
            background: rgba(18,18,24,0.45);
            padding: 18px 12px 18px 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 7px;
        }
        .cmgr-nav::-webkit-scrollbar,
        .cmgr-results::-webkit-scrollbar,
        .cmgr-detail-scroll::-webkit-scrollbar,
        .cmgr-download-list::-webkit-scrollbar,
        .cmgr-settings-grid::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        .cmgr-nav::-webkit-scrollbar-track,
        .cmgr-results::-webkit-scrollbar-track,
        .cmgr-detail-scroll::-webkit-scrollbar-track,
        .cmgr-download-list::-webkit-scrollbar-track,
        .cmgr-settings-grid::-webkit-scrollbar-track {
            background: transparent;
        }
        .cmgr-nav::-webkit-scrollbar-thumb,
        .cmgr-results::-webkit-scrollbar-thumb,
        .cmgr-detail-scroll::-webkit-scrollbar-thumb,
        .cmgr-download-list::-webkit-scrollbar-thumb,
        .cmgr-settings-grid::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 999px;
        }
        .cmgr-nav-btn {
            min-height: 42px;
            padding: 0 12px;
            border-radius: 10px;
            color: #a1a1aa;
            background: transparent;
            border: 1px solid transparent;
            font-size: 12.5px;
            font-weight: 700;
            transition: all 0.16s ease;
            width: 100%;
            justify-content: space-between;
        }
        .cmgr-nav-group {
            display: grid;
            gap: 7px;
            padding-bottom: 14px;
            margin-bottom: 10px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .cmgr-nav-group:last-child {
            border-bottom: 0;
            margin-bottom: 0;
        }
        .cmgr-nav-title {
            color: #71717a;
            font-size: 11px;
            font-weight: 850;
            text-transform: uppercase;
            letter-spacing: 0;
            padding: 4px 2px;
        }
        .cmgr-category-group {
            padding-bottom: 0;
        }
        .cmgr-category-btn span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmgr-folder-tree,
        .cmgr-folder-children {
            display: grid;
            gap: 4px;
            min-width: 0;
        }
        .cmgr-folder-node {
            min-width: 0;
        }
        .cmgr-folder-row {
            display: grid;
            grid-template-columns: 22px minmax(0, 1fr);
            align-items: center;
            gap: 4px;
            min-width: 0;
            padding-left: calc(var(--cmgr-folder-depth, 0) * 12px);
        }
        .cmgr-folder-toggle,
        .cmgr-folder-spacer {
            width: 22px;
            height: 34px;
        }
        .cmgr-folder-toggle {
            border: 0;
            border-radius: 8px;
            background: transparent;
            color: #8d8d96;
            cursor: pointer;
            display: grid;
            place-items: center;
            padding: 0;
        }
        .cmgr-folder-toggle::before {
            content: "";
            width: 0;
            height: 0;
            border-top: 4px solid transparent;
            border-bottom: 4px solid transparent;
            border-left: 5px solid currentColor;
            transition: transform 0.12s ease;
        }
        .cmgr-folder-toggle.expanded::before {
            transform: rotate(90deg);
        }
        .cmgr-folder-toggle:hover {
            background: rgba(255,255,255,0.05);
            color: #fff;
        }
        .cmgr-folder-select {
            min-width: 0;
            padding: 0 10px;
        }
        .cmgr-folder-select span {
            min-width: 0;
            overflow: hidden;
            text-align: left;
            text-overflow: ellipsis;
        }
        .cmgr-nav-note {
            color: #8d8d96;
            font-size: 12px;
            line-height: 1.4;
            padding: 8px 4px;
        }
        .cmgr-nav-btn:hover {
            background: rgba(255,255,255,0.05);
            color: #fff;
        }
        .cmgr-nav-btn.active {
            background: rgba(219,39,119,0.14);
            border-color: rgba(219,39,119,0.34);
            color: #f9a8d4;
        }
        .cmgr-nav-btn b {
            background: #db2777;
            color: #fff;
            box-shadow: 0 0 14px rgba(219,39,119,0.52);
        }
        .cmgr-body {
            background: rgba(10,10,15,0.18);
            color: #f3f4f6;
        }
        .cmgr-toolbar {
            min-height: 64px;
            padding: 14px 26px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            background: rgba(18,18,24,0.42);
            gap: 10px;
        }
        .cmgr-nav-btn,
        .cmgr-segmented button,
        .cmgr-primary,
        .cmgr-secondary,
        .cmgr-danger,
        .cmgr-icon-btn,
        .cmgr-load-more,
        .cmgr-trained button,
        .cmgr-alert button {
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            background: rgba(255,255,255,0.05);
            color: #e5e7eb;
            min-height: 38px;
            padding: 0 14px;
            font-size: 13px;
            font-weight: 700;
            transition: all 0.18s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            white-space: nowrap;
        }
        .cmgr-nav .cmgr-nav-btn {
            justify-content: space-between;
            width: 100%;
        }
        .cmgr-primary {
            background: linear-gradient(135deg, #db2777, #9d174d);
            border-color: rgba(219,39,119,0.35);
            color: #fff;
            box-shadow: 0 8px 20px rgba(219,39,119,0.24);
        }
        .cmgr-primary:hover:not(:disabled) {
            box-shadow: 0 10px 25px rgba(219,39,119,0.36);
            transform: translateY(-1px);
        }
        .cmgr-secondary:hover:not(:disabled),
        .cmgr-icon-btn:hover:not(:disabled),
        .cmgr-load-more:hover:not(:disabled),
        .cmgr-trained button:hover:not(:disabled) {
            background: rgba(255,255,255,0.11);
            border-color: rgba(255,255,255,0.16);
            color: #fff;
            filter: none;
        }
        .cmgr-danger {
            background: rgba(239,68,68,0.08);
            border-color: rgba(239,68,68,0.22);
            color: #fca5a5;
        }
        .cmgr-danger:hover:not(:disabled) {
            background: rgba(239,68,68,0.16);
            border-color: rgba(239,68,68,0.34);
            color: #fecaca;
            filter: none;
        }
        .cmgr-segmented {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.035);
            border-radius: 14px;
            padding: 4px;
        }
        .cmgr-segmented button {
            min-height: 34px;
            border-color: transparent;
            background: transparent;
            color: #a1a1aa;
            border-radius: 10px;
        }
        .cmgr-segmented button.active {
            background: rgba(219,39,119,0.18);
            border-color: rgba(219,39,119,0.42);
            color: #f9a8d4;
        }
        .cmgr-input {
            min-height: 39px;
            background: rgba(10,10,15,0.76);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            color: #f8fafc;
            outline: none;
            font-size: 13px;
            padding: 0 13px;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .cmgr-input:focus {
            border-color: rgba(219,39,119,0.55);
            box-shadow: 0 0 0 3px rgba(219,39,119,0.12);
        }
        .cmgr-search {
            min-width: 260px;
            flex: 1;
        }
        .cmgr-nav-select {
            width: 100%;
            min-width: 0;
        }
        .cmgr-chip-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .cmgr-filter-chip {
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 999px;
            background: rgba(255,255,255,0.055);
            color: #e5e7eb;
            min-height: 30px;
            padding: 0 10px;
            font-size: 12.5px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: background 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .cmgr-filter-chip:hover {
            background: rgba(255,255,255,0.09);
            color: #fff;
        }
        .cmgr-filter-chip.active {
            background: rgba(219,39,119,0.16);
            border-color: rgba(219,39,119,0.38);
            color: #f9a8d4;
        }
        .cmgr-search-picker {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: center;
        }
        .cmgr-clear-filter {
            min-height: 39px;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            background: rgba(255,255,255,0.05);
            color: #d4d4d8;
            padding: 0 11px;
            font-size: 12px;
            font-weight: 800;
            cursor: pointer;
        }
        .cmgr-clear-filter:disabled {
            opacity: 0.45;
            cursor: default;
        }
        .cmgr-split {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            position: relative;
            overflow: hidden;
            background: rgba(10,10,15,0.18);
        }
        .cmgr-discover .cmgr-split,
        .cmgr-split.has-detail {
            grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 400px);
        }
        .cmgr-results {
            height: 100%;
            display: grid;
            padding: 24px;
            gap: 18px;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            grid-auto-rows: auto;
            justify-content: stretch;
            align-content: start;
            align-items: start;
        }
        .cmgr-card {
            position: relative;
            width: 100%;
            height: 100%;
            aspect-ratio: auto;
            min-width: 0;
            min-height: 0;
            overflow: hidden;
            box-sizing: border-box;
            border-radius: 16px;
            isolation: isolate;
            background: rgba(255,255,255,0.06);
            border: 2px solid rgba(255,255,255,0.06);
            box-shadow: 0 5px 18px rgba(0,0,0,0.25);
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .cmgr-card::before {
            content: "";
            display: none;
            width: 100%;
            padding-top: 0;
        }
        .cmgr-card.asset {
            height: 100%;
        }
        .cmgr-card:hover,
        .cmgr-card.selected {
            border-color: rgba(219,39,119,0.82);
            box-shadow: 0 12px 30px rgba(0,0,0,0.38), 0 0 18px rgba(219,39,119,0.16);
        }
        .cmgr-card.selected {
            border-color: #db2777;
            box-shadow: 0 12px 30px rgba(0,0,0,0.36), 0 0 24px rgba(219,39,119,0.24);
        }
        .cmgr-thumb,
        .cmgr-thumb.small {
            position: absolute;
            inset: 2px;
            z-index: 0;
            overflow: hidden;
            border-radius: 13px;
            clip-path: inset(0 round 13px);
            background: #0a0a10;
            aspect-ratio: auto;
        }
        .cmgr-thumb::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 2;
            background: linear-gradient(to top, rgba(10,10,16,0.99) 0%, rgba(10,10,16,0.72) 42%, rgba(10,10,16,0.16) 100%);
            pointer-events: none;
        }
        .cmgr-thumb img,
        .cmgr-thumb video,
        .cmgr-detail-preview img,
        .cmgr-detail-preview video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        .cmgr-preview-img {
            opacity: 1;
            transition: opacity 0.22s ease, transform 0.22s ease;
        }
        .cmgr-preview-img.is-pending,
        .cmgr-preview-img.is-loading {
            opacity: 0;
        }
        .cmgr-preview-img.is-loaded {
            opacity: 1;
        }
        .cmgr-no-image {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #2a1430, #101018);
            color: rgba(255,255,255,0.68);
            font-size: 18px;
            font-weight: 850;
        }
        .cmgr-card-body {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 4;
            padding: 13px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            pointer-events: none;
        }
        .cmgr-card-title {
            min-height: 0;
            color: #fff;
            font-size: 14px;
            font-weight: 850;
            line-height: 1.2;
            text-shadow: 0 2px 12px rgba(0,0,0,0.75);
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .cmgr-card-meta,
        .cmgr-card-tags {
            color: rgba(255,255,255,0.76);
            font-size: 11.5px;
            gap: 6px;
        }
        .cmgr-card-tags span {
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(0,0,0,0.32);
            color: #f4f4f5;
            border-radius: 999px;
            padding: 4px 8px;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmgr-detail {
            position: relative;
            width: 100%;
            min-width: 0;
            max-width: none;
            height: 100%;
            z-index: 8;
            border-left: 1px solid rgba(255,255,255,0.06);
            background: rgba(18,18,24,0.74);
            box-shadow: -12px 0 32px rgba(0,0,0,0.28);
        }
        .cmgr-detail-scroll {
            padding: 20px;
            position: relative;
        }
        .cmgr-detail-close {
            position: sticky;
            top: 0;
            margin-left: auto;
            margin-bottom: 10px;
            z-index: 2;
            width: 32px;
            height: 32px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.1);
            background: rgba(255,255,255,0.06);
            color: #e5e7eb;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: 800;
        }
        .cmgr-detail-close:hover {
            background: rgba(219,39,119,0.16);
            border-color: rgba(219,39,119,0.38);
            color: #fff;
        }
        .cmgr-detail-head {
            grid-template-columns: 116px minmax(0, 1fr);
            gap: 14px;
        }
        .cmgr-detail-head > div:last-child {
            min-width: 0;
        }
        .cmgr-detail-title-link {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px;
            align-items: start;
            color: inherit;
            text-decoration: none;
        }
        .cmgr-detail-head h2,
        .cmgr-settings-form h2,
        .cmgr-roots h2,
        .cmgr-toolbar h2 {
            color: #fff;
            font-weight: 850;
        }
        .cmgr-detail-title-link h2 {
            min-width: 0;
            margin: 0;
            overflow-wrap: anywhere;
        }
        .cmgr-detail-title-link:hover h2 {
            color: #f9a8d4;
        }
        .cmgr-external-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            color: #f9a8d4;
            background: rgba(219,39,119,0.1);
            font-size: 13px;
            line-height: 1;
        }
        .cmgr-detail-head p,
        .cmgr-card-meta,
        .cmgr-muted {
            color: #a1a1aa;
        }
        .cmgr-detail-preview {
            position: relative;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 16px;
            box-shadow: 0 8px 22px rgba(0,0,0,0.26);
        }
        .cmgr-path-box,
        .cmgr-settings-form,
        .cmgr-roots,
        .cmgr-download {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.045);
            border-radius: 16px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .cmgr-path-title {
            color: #fff;
            font-weight: 850;
        }
        .cmgr-label,
        .cmgr-grid2 label,
        .cmgr-check {
            color: #cbd5e1;
        }
        .cmgr-detail .cmgr-input,
        .cmgr-detail-scroll .cmgr-input {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
        }
        .cmgr-detail .cmgr-grid2 {
            grid-template-columns: 1fr;
        }
        .cmgr-grid2 label {
            min-width: 0;
        }
        .cmgr-path,
        .cmgr-info-list b {
            background: rgba(10,10,15,0.48);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 12px;
            color: #d4d4d8;
        }
        .cmgr-info-list b {
            padding: 7px 9px;
        }
        .cmgr-trained button {
            min-height: 30px;
            color: #f9a8d4;
            border-color: rgba(219,39,119,0.22);
            background: rgba(219,39,119,0.08);
            font-size: 11.5px;
        }
        .cmgr-description {
            margin-top: 14px;
            color: #d4d4d8;
            font-size: 13px;
            line-height: 1.58;
        }
        .cmgr-description p,
        .cmgr-description ul,
        .cmgr-description ol,
        .cmgr-description pre,
        .cmgr-description blockquote {
            margin: 0 0 12px;
        }
        .cmgr-description h1,
        .cmgr-description h2,
        .cmgr-description h3,
        .cmgr-description h4 {
            margin: 18px 0 8px;
            color: #fff;
            line-height: 1.25;
        }
        .cmgr-description h1 { font-size: 18px; }
        .cmgr-description h2 { font-size: 16px; }
        .cmgr-description h3,
        .cmgr-description h4 { font-size: 14px; }
        .cmgr-description ul,
        .cmgr-description ol {
            padding-left: 20px;
        }
        .cmgr-description li {
            margin: 0 0 6px;
        }
        .cmgr-description a {
            color: #f9a8d4;
            text-decoration: none;
        }
        .cmgr-description a:hover {
            text-decoration: underline;
        }
        .cmgr-description code {
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 7px;
            padding: 1px 5px;
            background: rgba(10,10,15,0.6);
            color: #fbcfe8;
            font-size: 12px;
        }
        .cmgr-description pre {
            overflow-x: auto;
            padding: 10px;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            background: rgba(10,10,15,0.64);
        }
        .cmgr-description pre code {
            border: 0;
            padding: 0;
            background: transparent;
            white-space: pre-wrap;
        }
        .cmgr-description blockquote {
            padding: 8px 12px;
            border-left: 3px solid rgba(219,39,119,0.55);
            background: rgba(255,255,255,0.04);
            border-radius: 8px;
        }
        .cmgr-empty,
        .cmgr-empty-detail {
            grid-column: 1 / -1;
            min-height: 260px;
            border: 1px dashed rgba(255,255,255,0.12);
            border-radius: 16px;
            color: #a1a1aa;
            background: rgba(255,255,255,0.025);
        }
        .cmgr-load-more {
            width: min(280px, 100%);
            justify-self: center;
        }
        .cmgr-load-status {
            border: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.035);
            border-radius: 999px;
            width: min(260px, 100%);
            justify-self: center;
        }
        .cmgr-download-list,
        .cmgr-settings-grid {
            padding: 24px 28px;
            background: rgba(10,10,15,0.18);
        }
        .cmgr-download-head b.completed {
            color: #86efac;
        }
        .cmgr-download-head b.failed {
            color: #fca5a5;
        }
        .cmgr-progress {
            position: relative;
            height: 16px;
            overflow: hidden;
            background: rgba(10,10,15,0.72);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 999px;
        }
        .cmgr-progress div {
            height: 100%;
            min-width: 0;
            border-radius: inherit;
            background: linear-gradient(90deg, #db2777, #f472b6);
            box-shadow: 0 0 18px rgba(219,39,119,0.36);
            transition: width 0.28s ease;
        }
        .cmgr-progress span {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 10.5px;
            font-weight: 850;
            text-shadow: 0 1px 6px rgba(0,0,0,0.75);
            pointer-events: none;
        }
        .cmgr-progress.indeterminate div {
            position: absolute;
            width: 38% !important;
            min-width: 38%;
            animation: cmgrProgressSlide 1.1s ease-in-out infinite;
        }
        @keyframes cmgrProgressSlide {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(280%); }
        }
        .cmgr-alert {
            border: 1px solid rgba(239,68,68,0.28);
            background: rgba(69,10,10,0.88);
            color: #fecaca;
            border-radius: 14px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
        }
        .cmgr-toast {
            background: rgba(80,7,36,0.92);
            color: #fce7f3;
            border: 1px solid rgba(219,39,119,0.36);
            border-radius: 14px;
            box-shadow: 0 14px 34px rgba(0,0,0,0.42), 0 0 18px rgba(219,39,119,0.18);
        }

        /* ComfyUI synchronized theme layer. Keep color decisions here so the
           manager follows the official frontend theme instead of a fixed skin. */
        .cmgr-overlay {
            background: var(--cmgr-backdrop);
            color: var(--cmgr-text);
        }
        .cmgr-shell {
            background: var(--cmgr-panel);
            border-color: var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            box-shadow: var(--cmgr-shadow);
        }
        .cmgr-left-entry {
            background: var(--cmgr-control);
            border-color: var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            color: var(--cmgr-text);
            box-shadow: var(--cmgr-shadow);
        }
        .cmgr-left-entry:hover {
            background: var(--cmgr-panel-hover);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
        }
        .cmgr-topbar {
            background: var(--cmgr-panel);
            border-bottom-color: var(--cmgr-border);
        }
        .cmgr-layout,
        .cmgr-body,
        .cmgr-split,
        .cmgr-download-list,
        .cmgr-settings-grid {
            background: var(--cmgr-bg);
            color: var(--cmgr-text);
        }
        .cmgr-nav,
        .cmgr-toolbar {
            background: var(--cmgr-panel);
            border-color: var(--cmgr-border);
        }
        .cmgr-nav {
            border-right-color: var(--cmgr-border);
            gap: 12px;
            padding-top: 16px;
        }
        .cmgr-nav-group {
            border-bottom-color: var(--cmgr-border);
            gap: 10px;
            padding-bottom: 16px;
            margin-bottom: 2px;
        }
        .cmgr-nav-group:last-child {
            border-bottom: 0;
            padding-bottom: 0;
            margin-bottom: 0;
        }
        .cmgr-category-group {
            gap: 12px;
        }
        .cmgr-title,
        .cmgr-toolbar h2,
        .cmgr-detail-head h2,
        .cmgr-settings-form h2,
        .cmgr-roots h2,
        .cmgr-path-title,
        .cmgr-card-title {
            color: var(--cmgr-text);
        }
        .cmgr-subtitle,
        .cmgr-nav-title,
        .cmgr-nav-note,
        .cmgr-detail-head p,
        .cmgr-card-meta,
        .cmgr-muted {
            color: var(--cmgr-muted);
        }
        .cmgr-nav-btn,
        .cmgr-segmented button,
        .cmgr-secondary,
        .cmgr-icon-btn,
        .cmgr-load-more,
        .cmgr-trained button,
        .cmgr-alert button,
        .cmgr-clear-filter,
        .cmgr-detail-close {
            background: var(--cmgr-control);
            border-radius: var(--cmgr-radius);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
        }
        .cmgr-nav-btn {
            background: transparent;
            border-color: transparent;
            color: var(--cmgr-muted);
            box-shadow: none;
            transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }
        .cmgr-folder-toggle {
            color: var(--cmgr-muted);
        }
        .cmgr-folder-toggle:hover,
        .cmgr-nav-btn:not(.active):hover,
        .cmgr-secondary:hover:not(:disabled),
        .cmgr-icon-btn:hover:not(:disabled),
        .cmgr-load-more:hover:not(:disabled),
        .cmgr-trained button:hover:not(:disabled),
        .cmgr-clear-filter:hover:not(:disabled),
        .cmgr-detail-close:hover {
            background: var(--cmgr-panel-hover);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
        }
        .cmgr-nav-btn.active,
        .cmgr-segmented button.active,
        .cmgr-filter-chip.active {
            background: var(--cmgr-accent-soft);
            border-color: var(--cmgr-accent-border);
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
        }
        .cmgr-nav-btn.active:hover,
        .cmgr-nav-btn.active:focus-visible,
        .cmgr-filter-chip.active:hover,
        .cmgr-filter-chip.active:focus-visible {
            background: var(--cmgr-accent-soft);
            border-color: var(--cmgr-accent-border);
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
            box-shadow: none;
            transform: none;
            filter: none;
        }
        .cmgr-nav-btn:active,
        .cmgr-filter-chip:active,
        .cmgr-nav-btn.active:active,
        .cmgr-filter-chip.active:active {
            transform: none;
            filter: none;
            box-shadow: none;
        }
        .cmgr-nav-btn b {
            background: var(--cmgr-accent);
            color: var(--cmgr-accent-text);
            box-shadow: none;
        }
        .cmgr-primary {
            background: var(--cmgr-control);
            border-color: var(--cmgr-border);
            color: var(--cmgr-accent-text);
            box-shadow: none;
        }
        .cmgr-primary:not(:disabled) {
            background: var(--cmgr-accent);
            border-color: color-mix(in srgb, var(--cmgr-accent) 54%, var(--cmgr-border));
        }
        .cmgr-primary:hover:not(:disabled) {
            background: color-mix(in srgb, var(--cmgr-accent) 88%, var(--cmgr-text) 12%);
            box-shadow: none;
        }
        .cmgr-danger {
            background: var(--cmgr-danger-soft);
            border-color: var(--cmgr-danger-border);
            color: var(--cmgr-danger);
        }
        .cmgr-danger:hover:not(:disabled) {
            background: color-mix(in srgb, var(--cmgr-danger) 22%, transparent);
            border-color: color-mix(in srgb, var(--cmgr-danger) 48%, transparent);
            color: var(--cmgr-danger);
        }
        .cmgr-segmented,
        .cmgr-load-status {
            background: var(--cmgr-panel-soft);
            border-color: var(--cmgr-border);
            border-radius: var(--cmgr-radius);
        }
        .cmgr-segmented button {
            background: transparent;
            border-color: transparent;
            color: var(--cmgr-muted);
        }
        .cmgr-input {
            background: var(--cmgr-control);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
        }
        select.cmgr-input,
        .cmgr-input:is(select) {
            appearance: none;
            -webkit-appearance: none;
            min-height: 39px;
            border-radius: var(--cmgr-radius);
            background-color: var(--cmgr-control);
            background-image:
                linear-gradient(45deg, transparent 50%, var(--cmgr-muted) 50%),
                linear-gradient(135deg, var(--cmgr-muted) 50%, transparent 50%);
            background-position:
                calc(100% - 16px) 52%,
                calc(100% - 10px) 52%;
            background-size: 6px 6px, 6px 6px;
            background-repeat: no-repeat;
            padding-right: 34px;
            font-size: 12.5px;
            font-weight: 680;
            line-height: 1.2;
            cursor: pointer;
        }
        select.cmgr-input:focus,
        .cmgr-input:is(select):focus {
            border-color: var(--cmgr-accent-border);
            box-shadow: 0 0 0 3px var(--cmgr-accent-soft);
            outline: 0;
        }
        select.cmgr-input option,
        .cmgr-input:is(select) option {
            background: var(--cmgr-panel);
            color: var(--cmgr-text);
        }
        .cmgr-input::placeholder {
            color: var(--cmgr-muted);
            opacity: 0.82;
        }
        .cmgr-input:focus {
            border-color: var(--cmgr-accent-border);
            box-shadow: 0 0 0 3px var(--cmgr-accent-soft);
        }
        .cmgr-combo {
            position: relative;
            min-width: 0;
            width: 100%;
            z-index: 1;
        }
        .cmgr-select-menu {
            width: 100%;
        }
        .cmgr-toolbar-select {
            flex: 0 0 180px;
            width: 180px;
        }
        .cmgr-combo.open {
            z-index: 40;
        }
        .cmgr-combo-control {
            width: 100%;
            min-width: 0;
            min-height: 39px;
            box-sizing: border-box;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-control);
            color: var(--cmgr-text);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 0 10px 0 12px;
            cursor: pointer;
            font-size: 12.5px;
            font-weight: 680;
            text-align: left;
        }
        .cmgr-combo.open .cmgr-combo-control,
        .cmgr-combo-control:focus-visible {
            border-color: var(--cmgr-accent-border);
            box-shadow: 0 0 0 3px var(--cmgr-accent-soft);
            outline: 0;
        }
        .cmgr-combo-value {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-combo-value.placeholder {
            color: var(--cmgr-muted);
            font-weight: 620;
        }
        .cmgr-combo-arrow {
            flex: 0 0 auto;
            width: 18px;
            height: 18px;
            color: transparent;
            line-height: 1;
            position: relative;
            transform: none;
            transition: transform 0.14s ease;
        }
        .cmgr-combo-arrow::before {
            content: "";
            position: absolute;
            left: 50%;
            top: 45%;
            width: 7px;
            height: 7px;
            border-right: 1.5px solid var(--cmgr-muted);
            border-bottom: 1.5px solid var(--cmgr-muted);
            transform: translate(-50%, -50%) rotate(45deg);
        }
        .cmgr-combo.open .cmgr-combo-arrow {
            transform: rotate(180deg);
        }
        .cmgr-combo-popover {
            position: absolute;
            left: 0;
            right: 0;
            top: calc(100% + 6px);
            display: none;
            padding: 7px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: color-mix(in srgb, var(--cmgr-panel) 94%, #000 6%);
            box-shadow: 0 14px 34px rgba(0, 0, 0, 0.34);
            box-sizing: border-box;
            max-height: min(360px, calc(100vh - 180px));
            min-width: 100%;
        }
        .cmgr-combo.open .cmgr-combo-popover {
            display: grid;
            gap: 7px;
        }
        .cmgr-combo-search {
            width: 100%;
            min-width: 0;
            min-height: 34px;
            box-sizing: border-box;
            border: 1px solid var(--cmgr-border);
            border-radius: calc(var(--cmgr-radius) - 2px);
            background: var(--cmgr-control);
            color: var(--cmgr-text);
            padding: 0 10px;
            outline: 0;
            font-size: 12.5px;
        }
        .cmgr-combo-search::placeholder {
            color: var(--cmgr-muted);
            opacity: 0.82;
        }
        .cmgr-combo-search:focus {
            border-color: var(--cmgr-accent-border);
        }
        .cmgr-combo-list {
            display: grid;
            gap: 3px;
            max-height: min(270px, calc(100vh - 260px));
            min-height: 32px;
            overflow: auto;
            overscroll-behavior: contain;
            padding-right: 2px;
        }
        .cmgr-combo-option {
            width: 100%;
            min-width: 0;
            min-height: 31px;
            border: 1px solid transparent;
            border-radius: calc(var(--cmgr-radius) - 3px);
            background: transparent;
            color: var(--cmgr-text);
            display: flex;
            align-items: center;
            justify-content: flex-start;
            padding: 0 9px;
            cursor: pointer;
            font-size: 12.5px;
            font-weight: 620;
            text-align: left;
        }
        .cmgr-combo-option span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-combo-option:hover,
        .cmgr-combo-option.is-key-active {
            background: var(--cmgr-panel-hover);
            border-color: var(--cmgr-border);
        }
        .cmgr-combo-option.active {
            background: var(--cmgr-accent-soft);
            border-color: var(--cmgr-accent-border);
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
        }
        .cmgr-combo-option.active:hover,
        .cmgr-combo-option.active.is-key-active {
            background: var(--cmgr-accent-soft);
            border-color: var(--cmgr-accent-border);
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
        }
        .cmgr-combo-empty {
            color: var(--cmgr-muted);
            font-size: 12px;
            line-height: 1.35;
            padding: 8px 9px;
        }
        .cmgr-search-wrap {
            position: relative;
            flex: 1 1 min(620px, 100%);
            min-width: min(460px, 100%);
            max-width: min(780px, 100%);
        }
        .cmgr-search-wrap .cmgr-search {
            width: 100%;
            min-width: 0;
            padding-left: 38px;
            padding-right: 36px;
        }
        .cmgr-search-mark {
            position: absolute;
            left: 13px;
            top: 50%;
            z-index: 1;
            color: var(--cmgr-muted);
            font-size: 18px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-52%);
            pointer-events: none;
        }
        .cmgr-search-clear {
            position: absolute;
            right: 6px;
            top: 50%;
            z-index: 1;
            width: 27px;
            height: 27px;
            border: 0;
            border-radius: var(--cmgr-radius);
            background: transparent;
            color: var(--cmgr-muted);
            cursor: pointer;
            font-size: 18px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-50%);
        }
        .cmgr-search-clear:hover {
            background: var(--cmgr-panel-hover);
            color: var(--cmgr-text);
        }
        .cmgr-filter-chip {
            background: var(--cmgr-control);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
            box-shadow: none;
            transition: background-color 0.12s ease, border-color 0.12s ease, color 0.12s ease;
        }
        .cmgr-filter-chip:not(.active):hover {
            background: var(--cmgr-panel-hover);
            color: var(--cmgr-text);
        }
        .cmgr-card {
            position: relative;
            background: var(--cmgr-panel-soft);
            border-color: var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            box-shadow: none;
            display: block;
            width: 100%;
            height: auto !important;
            min-height: 0;
            aspect-ratio: auto !important;
            align-self: start;
            overflow: hidden;
        }
        .cmgr-card::before {
            content: "";
            display: none !important;
            width: 100%;
            padding-top: 0 !important;
            pointer-events: none;
        }
        .cmgr-card-spacer {
            display: block;
            width: 100%;
            height: 0;
            padding-top: 150%;
            pointer-events: none;
        }
        .cmgr-card:hover,
        .cmgr-card.selected {
            border-color: color-mix(in srgb, var(--cmgr-accent) 54%, var(--cmgr-border));
            box-shadow: none;
        }
        .cmgr-card.selected {
            border-color: var(--cmgr-accent);
        }
        .cmgr-thumb,
        .cmgr-thumb.small {
            position: absolute;
            inset: 2px;
            width: auto;
            height: auto;
            background: var(--cmgr-panel);
        }
        .cmgr-thumb::after {
            display: none;
        }
        .cmgr-no-image {
            background: var(--cmgr-panel-soft);
            color: var(--cmgr-muted);
        }
        .cmgr-card-title {
            text-shadow: 0 1px 8px rgba(0, 0, 0, 0.32);
        }
        .cmgr-card-body {
            left: 0;
            right: 0;
            bottom: 0;
            padding: 36px 11px 11px;
            border: 0;
            border-radius: 0;
            background: linear-gradient(
                to top,
                rgba(10, 10, 15, 0.94) 0%,
                rgba(10, 10, 15, 0.62) 58%,
                rgba(10, 10, 15, 0) 100%
            );
            box-shadow: none;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
        }
        .cmgr-card-badge {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 5;
            max-width: min(72%, 210px);
            padding: 5px 8px;
            border: 1px solid color-mix(in srgb, var(--cmgr-accent) 24%, var(--cmgr-border));
            border-radius: 999px;
            background: color-mix(in srgb, var(--cmgr-panel) 62%, transparent);
            color: color-mix(in srgb, var(--cmgr-accent) 70%, var(--cmgr-text));
            font-size: 11.5px;
            font-weight: 760;
            line-height: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            pointer-events: none;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }
        .cmgr-card-title {
            color: #fff;
            font-weight: 700;
            font-size: 13.25px;
            line-height: 1.24;
            text-shadow:
                0 1px 3px rgba(0, 0, 0, 0.82),
                0 2px 8px rgba(0, 0, 0, 0.64);
        }
        .cmgr-card-stat-row {
            display: flex;
            align-items: center;
            gap: 6px;
            min-height: 20px;
            margin-top: 2px;
            overflow: hidden;
        }
        .cmgr-card-stat-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            height: 20px;
            max-width: 76px;
            padding: 0 7px;
            border: 1px solid color-mix(in srgb, #fff 13%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, var(--cmgr-panel) 72%, transparent);
            color: #f8fafc;
            font-size: 10px;
            font-weight: 700;
            line-height: 1;
            white-space: nowrap;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.34);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
        }
        .cmgr-card-stat-chip span:last-child {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .cmgr-card-meta,
        .cmgr-card-tags {
            color: color-mix(in srgb, var(--cmgr-text) 78%, transparent);
        }
        .cmgr-card-tags span {
            background: color-mix(in srgb, var(--cmgr-panel) 58%, transparent);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
        }
        .cmgr-detail {
            background: var(--cmgr-panel);
            border-color: var(--cmgr-border);
            box-shadow: none;
        }
        .cmgr-detail-head {
            display: block;
            grid-template-columns: none;
            margin: 14px 0;
        }
        .cmgr-detail-head > div:last-child {
            min-width: 0;
        }
        .cmgr-detail-preview,
        .cmgr-path-box,
        .cmgr-settings-form,
        .cmgr-roots,
        .cmgr-download {
            background: var(--cmgr-panel-soft);
            border-color: var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            box-shadow: none;
        }
        .cmgr-detail-preview {
            width: 100%;
            height: clamp(240px, 38vh, 420px);
            min-height: 220px;
            position: relative;
            overflow: hidden;
            background: color-mix(in srgb, var(--cmgr-panel) 92%, #000 8%);
            border-radius: 10px;
            isolation: isolate;
        }
        .cmgr-detail-preview-bg {
            position: absolute;
            inset: -24px;
            z-index: 0;
            width: calc(100% + 48px);
            height: calc(100% + 48px);
            object-fit: cover;
            filter: blur(22px) saturate(1.18) brightness(0.72);
            transform: scale(1.08);
            opacity: 0.82;
            pointer-events: none;
        }
        .cmgr-detail-preview-overlay {
            position: absolute;
            inset: 0;
            z-index: 1;
            background: radial-gradient(circle at center, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.42));
            pointer-events: none;
        }
        .cmgr-detail-preview > .cmgr-preview-img,
        .cmgr-detail-preview > .cmgr-preview-video,
        .cmgr-detail-preview > .cmgr-no-image {
            position: relative;
            inset: auto;
            z-index: 2;
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: transparent;
        }
        .cmgr-detail-preview-nav {
            position: absolute;
            top: 50%;
            z-index: 7;
            width: 34px;
            height: 34px;
            border: 1px solid color-mix(in srgb, var(--cmgr-text) 18%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, #000 55%, transparent);
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-50%);
            transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
        }
        .cmgr-detail-preview-nav:hover {
            background: color-mix(in srgb, #000 72%, transparent);
            border-color: color-mix(in srgb, var(--cmgr-info) 54%, var(--cmgr-border));
            transform: translateY(-50%) scale(1.04);
        }
        .cmgr-detail-preview-nav.prev {
            left: 10px;
        }
        .cmgr-detail-preview-nav.next {
            right: 10px;
        }
        .cmgr-detail-preview-count {
            position: absolute;
            right: 10px;
            bottom: 10px;
            z-index: 7;
            border: 1px solid color-mix(in srgb, var(--cmgr-text) 16%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, #000 52%, transparent);
            color: #fff;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 760;
            line-height: 1;
        }
        .cmgr-settings-grid {
            grid-template-columns: minmax(360px, 520px) minmax(420px, 1fr);
            align-content: start;
            gap: 16px;
        }
        .cmgr-settings-column {
            display: grid;
            gap: 16px;
            align-content: start;
            min-width: 0;
        }
        .cmgr-setting-card {
            display: grid;
            gap: 14px;
            padding: 18px;
        }
        .cmgr-settings-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
            min-width: 0;
        }
        .cmgr-settings-head h2 {
            margin: 0;
            color: var(--cmgr-text);
            font-size: 16px;
            line-height: 1.2;
        }
        .cmgr-settings-head p {
            margin: 5px 0 0;
            color: var(--cmgr-muted);
            font-size: 12px;
            line-height: 1.42;
        }
        .cmgr-setting-status {
            flex: 0 0 auto;
            border: 1px solid var(--cmgr-border);
            border-radius: 999px;
            background: var(--cmgr-control);
            color: var(--cmgr-muted);
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 760;
            line-height: 1;
        }
        .cmgr-setting-status.is-set {
            border-color: color-mix(in srgb, var(--cmgr-good) 30%, var(--cmgr-border));
            background: color-mix(in srgb, var(--cmgr-good) 12%, transparent);
            color: color-mix(in srgb, var(--cmgr-good) 76%, var(--cmgr-text));
        }
        .cmgr-check-list {
            display: grid;
            gap: 8px;
        }
        .cmgr-check {
            min-height: 38px;
            margin: 0;
            padding: 9px 10px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-control);
        }
        .cmgr-check input {
            accent-color: var(--cmgr-info);
        }
        .cmgr-root-list {
            display: grid;
            gap: 8px;
        }
        .cmgr-root-row {
            grid-template-columns: 116px minmax(0, 1fr);
            align-items: center;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-control);
            padding: 9px 10px;
        }
        .cmgr-root-row:last-child {
            border-bottom: 1px solid var(--cmgr-border);
        }
        .cmgr-root-row span {
            color: var(--cmgr-muted);
            font-weight: 740;
        }
        .cmgr-root-row b {
            color: var(--cmgr-text);
            font-weight: 620;
        }
        .cmgr-settings-footer {
            grid-column: 1 / -1;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
            padding: 12px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-panel-soft);
        }
        .cmgr-detail-title-link {
            display: inline-flex;
            align-items: baseline;
            gap: 6px;
            max-width: 100%;
            color: inherit;
            text-decoration: none;
        }
        .cmgr-detail-title-link h2 {
            display: inline;
        }
        .cmgr-detail-title-link:hover h2,
        .cmgr-description a {
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
        }
        .cmgr-external-icon {
            width: auto;
            height: auto;
            border: 0;
            border-radius: 0;
            background: transparent;
            color: var(--cmgr-info);
            font-size: 16px;
            font-weight: 800;
            line-height: 1;
            transform: translateY(-1px);
        }
        .cmgr-external-icon,
        .cmgr-trained button {
            background: var(--cmgr-accent-soft);
            border-color: var(--cmgr-accent-border);
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
        }
        .cmgr-external-icon {
            background: transparent;
            border-color: transparent;
            color: var(--cmgr-info);
        }
        .cmgr-section-title {
            margin: 14px 0 7px;
            color: color-mix(in srgb, var(--cmgr-text) 82%, var(--cmgr-muted));
            font-size: 11.5px;
            font-weight: 760;
            line-height: 1.2;
            text-transform: uppercase;
            letter-spacing: 0;
        }
        .cmgr-section-title + .cmgr-description {
            margin-top: 0;
        }
        .cmgr-trained {
            min-width: 0;
            max-width: 100%;
            overflow: hidden;
            align-items: flex-start;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-panel-soft);
            padding: 10px;
            box-sizing: border-box;
        }
        .cmgr-trained span {
            color: var(--cmgr-muted);
            font-size: 12px;
            line-height: 1.4;
        }
        .cmgr-detail .cmgr-trained button,
        .cmgr-detail-scroll .cmgr-trained button {
            min-width: 0;
            max-width: 100%;
            min-height: 24px;
            padding: 4px 8px;
            border-radius: calc(var(--cmgr-radius) - 2px);
            white-space: normal;
            overflow-wrap: anywhere;
            word-break: break-word;
            text-align: left;
            justify-content: flex-start;
            font-size: 10.75px;
            font-weight: 620;
            line-height: 1.22;
        }
        .cmgr-label,
        .cmgr-grid2 label,
        .cmgr-check {
            color: color-mix(in srgb, var(--cmgr-text) 86%, transparent);
        }
        .cmgr-description {
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-panel-soft);
            padding: 12px;
            box-sizing: border-box;
            color: color-mix(in srgb, var(--cmgr-text) 86%, transparent);
        }
        .cmgr-description > :last-child {
            margin-bottom: 0;
        }
        .cmgr-path,
        .cmgr-info-list b,
        .cmgr-description code,
        .cmgr-description pre {
            background: var(--cmgr-control);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
        }
        .cmgr-description h1,
        .cmgr-description h2,
        .cmgr-description h3,
        .cmgr-description h4 {
            color: var(--cmgr-text);
        }
        .cmgr-description blockquote {
            background: var(--cmgr-panel-soft);
            border-left-color: var(--cmgr-accent-border);
        }
        .cmgr-empty,
        .cmgr-empty-detail {
            background: var(--cmgr-panel-soft);
            border-color: var(--cmgr-border);
            color: var(--cmgr-muted);
        }
        .cmgr-download-head b.completed {
            color: var(--cmgr-success);
        }
        .cmgr-download-head b.failed {
            color: var(--cmgr-danger);
        }
        .cmgr-progress {
            background: color-mix(in srgb, var(--cmgr-muted) 16%, transparent);
            border-color: var(--cmgr-border);
        }
        .cmgr-progress div {
            background: var(--cmgr-good);
            box-shadow: none;
        }
        .cmgr-progress span {
            color: var(--cmgr-accent-text);
        }
        .cmgr-alert {
            background: color-mix(in srgb, var(--cmgr-bad) 14%, var(--cmgr-panel));
            border-color: var(--cmgr-danger-border);
            color: color-mix(in srgb, var(--cmgr-bad) 72%, var(--cmgr-text));
        }
        .cmgr-toast {
            background: var(--cmgr-panel);
            border-color: var(--cmgr-border);
            color: var(--cmgr-text);
            box-shadow: var(--cmgr-shadow);
        }
        .cmgr-overlay,
        .cmgr-overlay * {
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .cmgr-overlay::-webkit-scrollbar,
        .cmgr-overlay *::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
        }
        .cmgr-combo-list {
            padding-right: 0;
        }
        @media (max-width: 980px) {
            .cmgr-shell {
                width: 100vw;
                height: 100vh;
                border-radius: 0;
            }
            .cmgr-layout {
                grid-template-columns: 1fr;
            }
            .cmgr-nav {
                flex-direction: row;
                overflow-x: auto;
                overflow-y: hidden;
                border-right: 0;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                padding: 10px 12px;
            }
            .cmgr-nav-group {
                display: flex;
                flex: 0 0 auto;
                gap: 7px;
                padding: 0;
                margin: 0;
                border-bottom: 0;
            }
            .cmgr-nav-title,
            .cmgr-nav-note {
                display: none;
            }
            .cmgr-nav-btn {
                width: auto;
                flex: 0 0 auto;
            }
            .cmgr-folder-tree {
                display: flex;
                flex: 0 0 auto;
                align-items: flex-start;
                gap: 7px;
                max-width: min(70vw, 380px);
                overflow: auto;
            }
            .cmgr-folder-node {
                flex: 0 0 auto;
            }
            .cmgr-folder-row {
                padding-left: 0;
            }
            .cmgr-folder-children {
                display: flex;
                align-items: flex-start;
                gap: 7px;
            }
            .cmgr-folder-select {
                width: auto;
                max-width: 180px;
            }
            .cmgr-split {
                display: flex;
                flex-direction: column;
                grid-template-columns: none;
                overflow-y: auto;
                overflow-x: hidden;
            }
            .cmgr-detail {
                position: static;
                width: auto;
                min-width: 0;
                max-width: none;
                border-left: 0;
                border-top: 1px solid rgba(255,255,255,0.06);
                min-height: 0;
                overflow: visible;
                flex: 0 0 auto;
                box-shadow: none;
                backdrop-filter: none;
                -webkit-backdrop-filter: none;
            }
            .cmgr-detail-scroll {
                height: auto;
                overflow: visible;
            }
            .cmgr-results {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                grid-auto-rows: auto;
                padding: 18px;
                overflow: visible;
                flex: 0 0 auto;
                align-items: start;
            }
            .cmgr-card,
            .cmgr-card.asset {
                width: 100%;
                height: auto !important;
                min-height: 0;
                aspect-ratio: auto !important;
            }
            .cmgr-card::before {
                display: none !important;
                padding-top: 0 !important;
            }
            .cmgr-card-spacer {
                display: block;
                padding-top: 150%;
            }
            .cmgr-settings-grid {
                grid-template-columns: 1fr;
                padding: 18px;
            }
            .cmgr-search-wrap {
                flex-basis: 100%;
                min-width: 100%;
                max-width: none;
            }
            .cmgr-settings-footer {
                justify-content: stretch;
            }
            .cmgr-settings-footer .cmgr-primary {
                width: 100%;
            }
            .cmgr-toolbar {
                padding: 12px 16px;
            }
            .cmgr-nav {
                border-bottom-color: var(--cmgr-border);
            }
            .cmgr-detail {
                border-top-color: var(--cmgr-border);
            }
        }
    `;
    if (!style.isConnected) {
        document.head.appendChild(style);
    }
}
