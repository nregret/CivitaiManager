import { app } from "../../scripts/app.js";
import {
    ASSET_KINDS,
    CIVITAI_CATEGORY_FILTERS,
    DETAIL_PREVIEW_LIMIT,
    INITIAL_PREVIEW_LOADS,
    ROOT_KINDS,
    ROOT_LOCAL_FOLDER,
    TABS,
    TRANSPARENT_PIXEL,
} from "./civitai/constants.js";
import { apiGet, apiPost, clearSearchCache, getSearchCache, setSearchCache } from "./civitai/api.js";
import { t } from "./civitai/i18n.js";
import { state } from "./civitai/state.js";
import { injectStyles } from "./civitai/styles.js";

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
    btn.title = t("Civitai Manager");
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
        <div class="cmgr-shell" role="dialog" aria-label="${escapeAttr(t("Civitai Manager"))}">
            <div class="cmgr-topbar">
                <div>
                    <div class="cmgr-title">${escapeHtml(t("Civitai Manager"))}</div>
                    <div class="cmgr-subtitle">${escapeHtml(t("Browse, download, and organize Checkpoints, UNet, LoRA, and Workflows from Civitai."))}</div>
                </div>
                <button class="cmgr-icon-btn" data-action="close" title="${escapeAttr(t("Close"))}">${escapeHtml(t("Cancel"))}</button>
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
        showToast(t("Settings saved"));
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
        showToast(t("API key cleared"));
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
            showToast(t(data.api_key_set ? "Civitai connected with saved API key" : "Civitai connected"));
        } else {
            state.error = data.error || t("Civitai test failed");
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
        results.insertAdjacentHTML("beforeend", `<div class="cmgr-load-status">${escapeHtml(t("Loading more..."))}</div>`);
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
        showToast(t("Download queued."));
        state.activeTab = "Downloads";
        await loadDownloads();
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function cancelDownload(taskId) {
    try {
        await apiPost("/download/cancel", { task_id: taskId });
        showToast(t("Cancel requested."));
        await loadDownloads();
    } catch (err) {
        state.error = err.message;
        render();
    }
}

async function retryDownload(taskId) {
    try {
        await apiPost("/download/retry", { task_id: taskId });
        showToast(t("Download retried."));
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

async function loadLibrary(force = false) {
    state.libraryLoading = true;
    render();
    try {
        const data = await apiGet(`/library${force ? "?force=true" : ""}`);
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
        showToast(t("Asset moved"));
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
        showToast(t("Asset deleted"));
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
        showToast(t("Hashing asset..."));
        const data = await apiPost("/asset/metadata", {
            root_kind: asset.root_kind,
            relative_path: asset.relative_path,
        });
        showToast(t(data.matched ? "Metadata matched from Civitai" : "SHA256 metadata saved"));
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
        showToast(t(!asset.favorite ? "Marked favorite" : "Removed favorite"));
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
        showToast(t("Folder opened"));
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
        ${state.error ? `<div class="cmgr-alert"><span>${escapeHtml(state.error)}</span><button data-action="clear-error">${escapeHtml(t("Dismiss"))}</button></div>` : ""}
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
            <div class="cmgr-nav-title">${escapeHtml(t("Views"))}</div>
            ${TABS.map((tab) => `
                <button class="cmgr-nav-btn ${state.activeTab === tab ? "active" : ""}" data-tab="${tab}">
                    <span>${escapeHtml(t(tab))}</span>
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
            <div class="cmgr-nav-title">${escapeHtml(t("Asset Type"))}</div>
            ${renderSelectMenu({
                id: "asset-kind",
                value: state.assetKind,
                options: ASSET_KINDS.map((kind) => ({
                    value: kind.id,
                    label: `${t(kind.label)}${state.activeTab === "Library" ? ` (${libraryCountForKind(kind.id)})` : ""}`,
                })),
                inputAttrs: "data-asset-kind-select",
            })}
        </div>
        <div class="cmgr-nav-group cmgr-category-group">
            <div class="cmgr-nav-title">${escapeHtml(t("Base Model"))}</div>
            <div class="cmgr-search-picker">
                ${renderSearchCombo({
                    id: "base-model",
                    value: state.selectedBaseModel,
                    items: baseModelOptions,
                    placeholder: t("Choose a base model"),
                    searchPlaceholder: t("Search base models..."),
                    emptyText: t("No base models found"),
                })}
                <button class="cmgr-clear-filter" data-clear-base-model title="${escapeAttr(t("Clear base model"))}" ${state.selectedBaseModel ? "" : "disabled"}>${escapeHtml(t("Clear"))}</button>
            </div>
            ${state.taxonomyLoading && state.activeTab === "Discover" ? `<div class="cmgr-nav-note">${escapeHtml(t("Loading base models..."))}</div>` : ""}
            ${!baseModels.length && !state.taxonomyLoading ? `<div class="cmgr-nav-note">${escapeHtml(t("Base models appear from Civitai data."))}</div>` : ""}
        </div>
        ${state.activeTab === "Discover" ? `
            <div class="cmgr-nav-group cmgr-category-group">
                <div class="cmgr-nav-title">${escapeHtml(t("Filter by Category"))}</div>
                <div class="cmgr-chip-grid">
                    <button class="cmgr-filter-chip ${!state.selectedCivitaiCategory ? "active" : ""}" data-category="">${escapeHtml(t("All"))}</button>
                    ${CIVITAI_CATEGORY_FILTERS.map((item) => `
                        <button class="cmgr-filter-chip ${state.selectedCivitaiCategory === item.value ? "active" : ""}" data-category="${escapeAttr(item.value)}">
                            ${escapeHtml(t(item.label))}
                        </button>
                    `).join("")}
                </div>
            </div>
        ` : ""}
        ${state.activeTab === "Library" ? `
            <div class="cmgr-nav-group cmgr-category-group">
                <div class="cmgr-nav-title">${escapeHtml(t("Local Folders"))}</div>
                <button class="cmgr-nav-btn ${!selectedCategory ? "active" : ""}" data-category="">
                    <span>${escapeHtml(t("All"))}</span>
                    <b>${libraryCountForKind(state.assetKind)}</b>
                </button>
                ${renderLibraryFolderTree(localFolderTree)}
                ${!localFolderTree?.count ? `<div class="cmgr-nav-note">${escapeHtml(t("Local folders appear after scanning your model files."))}</div>` : ""}
            </div>
        ` : ""}
        <div class="cmgr-nav-group cmgr-category-group">
            <div class="cmgr-nav-title">${escapeHtml(t("Search Tags"))}</div>
            <div class="cmgr-search-picker">
                ${renderSearchCombo({
                    id: "tag",
                    value: state.selectedTag,
                    items: tagOptions,
                    placeholder: t("Choose a tag"),
                    searchPlaceholder: t("Search tags..."),
                    emptyText: t("No tags found"),
                })}
                <button class="cmgr-clear-filter" data-clear-tag title="${escapeAttr(t("Clear tag"))}" ${state.selectedTag ? "" : "disabled"}>${escapeHtml(t("Clear"))}</button>
            </div>
            ${state.taxonomyLoading && state.activeTab === "Discover" ? `<div class="cmgr-nav-note">${escapeHtml(t("Loading tags from Civitai..."))}</div>` : ""}
            ${!tags.length && !state.taxonomyLoading ? `<div class="cmgr-nav-note">${escapeHtml(t("Tags appear from Civitai model and tag data."))}</div>` : ""}
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
                <button class="cmgr-nav-btn cmgr-folder-select ${state.selectedCategory === ROOT_LOCAL_FOLDER ? "active" : ""}" data-category="${ROOT_LOCAL_FOLDER}" title="${escapeAttr(t("Root files"))}">
                    <span>${escapeHtml(t("Root files"))}</span>
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
                    <input class="cmgr-input cmgr-search" data-field="query" value="${escapeAttr(state.query)}" placeholder="${escapeAttr(t("Search as you type..."))}" autocomplete="off" />
                    ${state.query ? `<button class="cmgr-search-clear" data-action="clear-search" title="${escapeAttr(t("Clear search"))}">×</button>` : ""}
                </div>
                ${renderSelectMenu({
                    id: "sort",
                    value: state.sort,
                    options: ["Highest Rated", "Most Downloaded", "Newest"].map((sort) => ({ value: sort, label: t(sort) })),
                    inputAttrs: 'data-field="sort"',
                    className: "cmgr-toolbar-select",
                })}
                <button class="cmgr-primary" data-action="search">${escapeHtml(t(state.loadingSearch ? "Searching..." : "Search"))}</button>
            </div>
            <div class="cmgr-split has-detail">
                <div class="cmgr-results">
                    ${state.searchItems.length ? state.searchItems.map(renderModelCard).join("") : renderEmptySearch()}
                    ${state.loadingSearch && state.searchItems.length ? `<div class="cmgr-load-status">${escapeHtml(t("Loading more..."))}</div>` : ""}
                </div>
                <aside class="cmgr-detail is-open">${selected ? renderModelDetail(selected) : renderEmptyModelDetail()}</aside>
            </div>
        </section>
    `;
}

function renderEmptySearch() {
    if (state.loadingSearch) return `<div class="cmgr-empty">${escapeHtml(t("Searching Civitai..."))}</div>`;
    return `<div class="cmgr-empty">${escapeHtml(t("Search {kind} from Civitai.", { kind: assetKindLabel(state.assetKind) }))}</div>`;
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
            <button class="cmgr-detail-close" data-action="close-detail" title="${escapeAttr(t("Close detail"))}">×</button>
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
            <label class="cmgr-label">${escapeHtml(t("Version"))}</label>
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
            <label class="cmgr-label">${escapeHtml(t("File"))}</label>
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
            <div class="cmgr-section-title">${escapeHtml(t("Trigger Words"))}</div>
            <div class="cmgr-trained">
                ${(Array.isArray(version.trainedWords) ? version.trainedWords : []).slice(0, 12).map((word) => `<button data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("") || `<span>${escapeHtml(t("No trained words listed."))}</span>`}
            </div>
            ${renderPathBox()}
            <button class="cmgr-primary cmgr-full" data-action="download" ${resolution?.download_url ? "" : "disabled"}>${escapeHtml(t("Queue Download"))}</button>
            <div class="cmgr-section-title">${escapeHtml(t("Description"))}</div>
            <div class="cmgr-description">${sanitizeDescriptionHtml(model.description || version.description || "")}</div>
        </div>
    `;
}

function renderEmptyModelDetail() {
    return `
        <div class="cmgr-detail-scroll">
            <div class="cmgr-empty-detail">
                <h2>${escapeHtml(t("Select a model"))}</h2>
                <p>${escapeHtml(t("Model details, versions, files, and download path will stay here."))}</p>
            </div>
        </div>
    `;
}

function renderPathEditor(resolution) {
    return `
        <div class="cmgr-grid2">
            <label>${escapeHtml(t("Type"))}${renderSelectMenu({
                id: "override-root-kind",
                value: state.pathOverrides.root_kind || "",
                options: ROOT_KINDS
                    .filter((root) => rootKindsForAssetKind(state.assetKind).includes(root.id))
                    .map((root) => ({ value: root.id, label: t(root.label) })),
                inputAttrs: 'data-override="root_kind"',
            })}</label>
            <label>${escapeHtml(t("Base Model"))}<input class="cmgr-input" data-override="base_model_dir" value="${escapeAttr(state.pathOverrides.base_model_dir || "")}" ${state.pathOverrides.root_kind === "workflows" ? "disabled" : ""} /></label>
            <label>${escapeHtml(t("Category"))}<input class="cmgr-input" data-override="category_dir" value="${escapeAttr(state.pathOverrides.category_dir || "")}" /></label>
            <label>${escapeHtml(t("Filename"))}<input class="cmgr-input" data-override="filename" value="${escapeAttr(state.pathOverrides.filename || "")}" /></label>
        </div>
        <div class="cmgr-path">${escapeHtml(resolution.absolute_path || "")}</div>
        ${resolution.exists ? `<div class="cmgr-warning">${escapeHtml(t("A file already exists at this path. The downloader will keep both by adding a numeric suffix."))}</div>` : ""}
    `;
}

function renderPathBox() {
    return `
        <div class="cmgr-path-box">
            <div class="cmgr-path-title">${escapeHtml(t("Automatic Save Path"))}</div>
            ${state.resolution ? renderPathEditor(state.resolution) : `<div class="cmgr-muted">${escapeHtml(t(state.resolvingPath ? "Resolving path..." : "No path resolved yet."))}</div>`}
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
                <h2>${escapeHtml(t("Library"))} · ${escapeHtml(assetKindLabel(state.assetKind))}${filterText ? ` · ${escapeHtml(filterText)}` : ""}</h2>
                <button class="cmgr-secondary" data-action="refresh-library">${state.libraryLoading ? escapeHtml(t("Scanning...")) : escapeHtml(t("Refresh"))}</button>
            </div>
            <div class="cmgr-split ${selected ? "has-detail" : ""}">
                <div class="cmgr-results">
                    ${items.length ? items.map(renderAssetCard).join("") : `<div class="cmgr-empty">${escapeHtml(t("No local assets found."))}</div>`}
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
            <button class="cmgr-detail-close" data-action="close-detail" title="${escapeAttr(t("Close detail"))}">×</button>
            ${renderDetailPreview(asset.thumb_url, asset.name, 0)}
            <div class="cmgr-detail-head">
                <div>
                    <h2>${escapeHtml(asset.name || asset.filename)}</h2>
                    <p>${escapeHtml(labelForRoot(asset.root_kind))} · ${escapeHtml(baseValue || "Other")} · ${escapeHtml(categoryValue || "Other")}</p>
                </div>
            </div>
            <div class="cmgr-info-list">
                <div><span>${escapeHtml(t("File"))}</span><b>${escapeHtml(asset.filename)}</b></div>
                <div><span>${escapeHtml(t("Relative Path"))}</span><b>${escapeHtml(asset.relative_path)}</b></div>
                <div><span>${escapeHtml(t("Size"))}</span><b>${formatBytes(asset.size || 0)}</b></div>
                <div><span>${escapeHtml(t("Metadata"))}</span><b>${escapeHtml(asset.metadata_status || "unknown")}</b></div>
                <div><span>${escapeHtml(t("Absolute Path"))}</span><b>${escapeHtml(asset.absolute_path || "")}</b></div>
            </div>
            <div class="cmgr-section-title">${escapeHtml(t("Trigger Words"))}</div>
            <div class="cmgr-trained">
                ${(asset.trained_words || []).slice(0, 16).map((word) => `<button data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("") || `<span>${escapeHtml(t("No trained words cached."))}</span>`}
            </div>
            <div class="cmgr-path-box">
                <div class="cmgr-path-title">${escapeHtml(t("Move / Rename"))}</div>
                <div class="cmgr-grid2">
                    <label>${escapeHtml(t("Type"))}${renderSelectMenu({
                        id: "move-root-kind",
                        value: asset.root_kind || "",
                        options: ROOT_KINDS
                            .filter((root) => compatibleRootKinds(asset.root_kind).includes(root.id))
                            .map((root) => ({ value: root.id, label: t(root.label) })),
                        inputAttrs: 'data-move="target_root_kind"',
                    })}</label>
                    <label>${escapeHtml(t("Base Model"))}<input class="cmgr-input" data-move="base_model_dir" value="${escapeAttr(baseValue || "Other")}" ${asset.root_kind === "workflows" ? "disabled" : ""}/></label>
                    <label>${escapeHtml(t("Category"))}<input class="cmgr-input" data-move="category_dir" value="${escapeAttr(categoryValue || "Other")}" /></label>
                    <label>${escapeHtml(t("Filename"))}<input class="cmgr-input" data-move="filename" value="${escapeAttr(asset.filename)}" /></label>
                </div>
                <button class="cmgr-secondary cmgr-full" data-action="move-asset">${escapeHtml(t("Move Asset"))}</button>
            </div>
            <div class="cmgr-action-row">
                <button class="cmgr-secondary" data-action="favorite-asset">${escapeHtml(t(asset.favorite ? "Unfavorite" : "Favorite"))}</button>
                <button class="cmgr-secondary" data-action="open-folder">${escapeHtml(t("Open Folder"))}</button>
                <button class="cmgr-secondary" data-action="enrich-asset">${escapeHtml(t("Hash + Fetch Metadata"))}</button>
                <button class="cmgr-danger" data-action="delete-asset">${escapeHtml(t("Delete"))}</button>
            </div>
        </div>
    `;
}

function renderDownloads() {
    const jobs = Object.values(state.downloads || {}).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    return `
        <section class="cmgr-page">
            <div class="cmgr-toolbar">
                <h2>${escapeHtml(t("Downloads"))}</h2>
                <button class="cmgr-secondary" data-action="refresh-downloads">${escapeHtml(t("Refresh"))}</button>
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
    bindDownloadsEvents(list);
    return true;
}

function renderDownloadJobs(jobs) {
    return jobs.length ? jobs.map(renderDownloadJob).join("") : `<div class="cmgr-empty">${escapeHtml(t("No downloads yet."))}</div>`;
}

function renderDownloadJob(job) {
    const total = Number(job.total || 0);
    const progress = Number(job.progress || 0);
    const pct = total > 0 ? Math.min(100, Math.round((progress / total) * 100)) : (job.status === "completed" ? 100 : 0);
    const active = ["pending", "downloading", "cancelling"].includes(job.status);
    const progressClass = total > 0 ? "" : " indeterminate";
    const statusKey = String(job.status || "pending").replace(/^./, (letter) => letter.toUpperCase());
    return `
        <article class="cmgr-download">
            <div class="cmgr-download-head">
                <div>
                    <strong>${escapeHtml(job.filename || "Download")}</strong>
                    <span>${escapeHtml(job.root_kind || "")} · ${escapeHtml(job.relative_path || "")}</span>
                </div>
                <b class="${escapeAttr(job.status || "pending")}">${escapeHtml(t(statusKey))}</b>
            </div>
            <div class="cmgr-progress${progressClass}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                <div style="width:${pct}%"></div>
                <span>${total > 0 ? `${pct}%` : (active ? escapeHtml(t("Waiting for size...")) : `${pct}%`)}</span>
            </div>
            <div class="cmgr-card-meta">
                <span>${pct}%</span>
                <span>${formatBytes(progress)} / ${total ? formatBytes(total) : escapeHtml(t("unknown"))}</span>
            </div>
            ${job.error ? `<div class="cmgr-warning">${escapeHtml(job.error)}</div>` : ""}
            ${job.target_path ? `<div class="cmgr-path">${escapeHtml(job.target_path)}</div>` : ""}
            ${active ? `<div class="cmgr-action-row"><button class="cmgr-secondary" data-action="cancel-download" data-task-id="${escapeAttr(job.id)}">${escapeHtml(t("Cancel Download"))}</button></div>` : ""}
            ${["failed", "cancelled"].includes(job.status) ? `<div class="cmgr-action-row"><button class="cmgr-secondary" data-action="retry-download" data-task-id="${escapeAttr(job.id)}">${escapeHtml(t("Retry Download"))}</button></div>` : ""}
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
                                <h2>${escapeHtml(t("Connection"))}</h2>
                                <p>${escapeHtml(t("Civitai API access and restricted content permissions."))}</p>
                            </div>
                            <span class="cmgr-setting-status ${config.api_key_set ? "is-set" : ""}">${escapeHtml(t(config.api_key_set ? "Key saved" : "No key"))}</span>
                        </div>
                        <label class="cmgr-label">${escapeHtml(t("Civitai API Key"))}</label>
                        <input class="cmgr-input cmgr-full" data-setting="civitai_api_key" type="password" value="" placeholder="${escapeAttr(t(config.api_key_set ? "Leave blank to keep the saved key" : "Optional, required for restricted downloads"))}" />
                        <div class="cmgr-action-row">
                            <button class="cmgr-secondary" data-action="test-api">${escapeHtml(t(state.apiTesting ? "Testing..." : "Test API"))}</button>
                            ${config.api_key_set ? `<button class="cmgr-secondary" data-action="clear-api-key">${escapeHtml(t("Clear Saved Key"))}</button>` : ""}
                        </div>
                    </div>

                    <div class="cmgr-settings-form cmgr-setting-card">
                        <div class="cmgr-settings-head">
                            <div>
                                <h2>${escapeHtml(t("Download Defaults"))}</h2>
                                <p>${escapeHtml(t("Defaults used when queueing models and companion files."))}</p>
                            </div>
                        </div>
                        <div class="cmgr-check-list">
                            <label class="cmgr-check"><input type="checkbox" data-setting="allow_nsfw" ${config.allow_nsfw ? "checked" : ""}/> <span>${escapeHtml(t("Allow NSFW results"))}</span></label>
                            <label class="cmgr-check"><input type="checkbox" data-setting="save_metadata" ${config.save_metadata !== false ? "checked" : ""}/> <span>${escapeHtml(t("Save companion metadata JSON"))}</span></label>
                            <label class="cmgr-check"><input type="checkbox" data-setting="save_preview" ${config.save_preview !== false ? "checked" : ""}/> <span>${escapeHtml(t("Save companion preview image"))}</span></label>
                        </div>
                    </div>
                </div>

                <div class="cmgr-settings-column">
                    <div class="cmgr-settings-form cmgr-setting-card">
                        <div class="cmgr-settings-head">
                            <div>
                                <h2>${escapeHtml(t("Workflow Storage"))}</h2>
                                <p>${escapeHtml(t("Online workflows are saved here as JSON files."))}</p>
                            </div>
                        </div>
                        <label class="cmgr-label">${escapeHtml(t("Workflow Directory"))}</label>
                        <input class="cmgr-input cmgr-full" data-setting="workflow_dir" value="${escapeAttr(config.workflow_dir || "")}" />
                    </div>

                    <div class="cmgr-roots cmgr-setting-card">
                        <div class="cmgr-settings-head">
                            <div>
                                <h2>${escapeHtml(t("Resolved Roots"))}</h2>
                                <p>${escapeHtml(t("Model roots detected from ComfyUI folder paths."))}</p>
                            </div>
                        </div>
                        <div class="cmgr-root-list">
                            ${ROOT_KINDS.map((root) => `
                                <div class="cmgr-root-row">
                                    <span>${escapeHtml(t(root.label))}</span>
                                    <b>${escapeHtml(roots[root.id] || "")}</b>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                </div>

                <div class="cmgr-settings-footer">
                    <button class="cmgr-primary" data-action="save-settings">${escapeHtml(t(state.settingsSaving ? "Saving..." : "Save Settings"))}</button>
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
                showToast(t("Copied"));
            } catch (_) {
                showToast(t("Copy failed"));
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
    if (refresh) refresh.onclick = () => loadLibrary(true);
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
    root.querySelectorAll('[data-action="cancel-download"]').forEach((button) => {
        button.onclick = () => cancelDownload(button.dataset.taskId);
    });
    root.querySelectorAll('[data-action="retry-download"]').forEach((button) => {
        button.onclick = () => retryDownload(button.dataset.taskId);
    });
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
    return t(ASSET_KINDS.find((item) => item.id === kind)?.label || kind || "Asset");
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
    return t(ROOT_KINDS.find((root) => root.id === rootKind)?.label || rootKind || "Asset");
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
    if (!url) return `<div class="cmgr-no-image">${escapeHtml(t("No Preview"))}</div>`;
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
    if (!sourceUrl) return `<div class="cmgr-no-image">${escapeHtml(t("No Preview"))}</div>`;
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
    if (!raw) return `<span class="cmgr-muted">${escapeHtml(t("No description available."))}</span>`;
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
    return text ? `<p>${escapeHtml(text)}</p>` : `<span class="cmgr-muted">${escapeHtml(t("No description available."))}</span>`;
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
