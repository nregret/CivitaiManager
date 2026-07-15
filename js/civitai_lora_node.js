import { app } from "../../scripts/app.js";
import {
    API,
    CIVITAI_CATEGORY_FILTERS,
    HIGH_PRIORITY_PREVIEW_LOADS,
    INITIAL_PREVIEW_LOADS,
    ROOT_LOCAL_FOLDER,
    TRANSPARENT_PIXEL,
} from "./civitai/constants.js";
import { apiGet, apiPost, getSearchCache, setSearchCache } from "./civitai/api.js";
import {
    bindSearchCombo,
    ensureNotificationHost,
    renderFileActions,
    renderPromoLinks,
    renderSearchCombo,
    renderSearchToolbar,
    renderToolbarSearchField,
    updateNotificationHost,
} from "./civitai/components.js";
import { t } from "./civitai/i18n.js";
import {
    createPreviewMedia,
    findModelPreviewSource,
    isModelPreviewFiltered,
} from "./civitai/media.js";
import { injectStyles } from "./civitai/styles.js";

const NODE_NAME = "CivitaiMultiLoraLoader";
const ACTIVE_DOWNLOAD_STATUSES = new Set(["pending", "downloading", "cancelling"]);
const TERMINAL_DOWNLOAD_STATUSES = new Set(["completed", "failed", "cancelled"]);
const NODE_CONTROL_HEIGHT = 28;
const NODE_SIDE_MARGIN = 14;
const NODE_SWITCH_WIDTH = 34;
const NODE_SWITCH_HEIGHT = 18;
const NODE_REMOVE_SIZE = 22;

let overlay = null;
let popupBody = null;
let notificationHost = null;
let pollTimer = null;
let pollBusy = false;
let searchController = null;
let searchSequence = 0;
let toastTimer = null;
let renderedPopupTab = "";
let previewObserver = null;
let popupPreviewSetupFrame = 0;

const popup = {
    node: null,
    tab: "discover",
    discoverQuery: "",
    localQuery: "",
    sort: "Highest Rated",
    selectedBaseModel: "",
    selectedCategory: "",
    selectedTag: "",
    selectedLocalFolder: "",
    expandedLocalFolders: {},
    taxonomy: { baseModels: [], tags: [] },
    remoteItems: [],
    contentFilterActive: false,
    nextCursor: "",
    remoteLoading: false,
    remoteResetting: false,
    selectedRemote: null,
    selectedVersionId: "",
    selectedFileName: "",
    libraryItems: [],
    libraryLoading: false,
    selectedAssetId: "",
    downloads: {},
    pendingApply: new Map(),
    scroll: {
        nav: 0,
        discover: 0,
        local: 0,
        applied: 0,
        downloads: 0,
    },
    error: "",
    toast: "",
};

app.registerExtension({
    name: "CivitaiManager.multiLoraLoader",
    async setup() {
        injectStyles();
    },
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_NAME) return;

        const originalCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = originalCreated?.apply(this, arguments);
            this._cmgrLoras = readJsonWidget(this) || [];
            syncNodeWidgets(this, this._cmgrLoras);
            return result;
        };

        const originalConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            const restored = findSerializedLoraList(info?.widgets_values);
            if (restored) syncNodeWidgets(this, restored);
            const result = originalConfigure?.apply(this, arguments);
            syncNodeWidgets(this, readJsonWidget(this) || restored || this._cmgrLoras || []);
            return result;
        };

        const originalResize = nodeType.prototype.onResize;
        nodeType.prototype.onResize = function () {
            const result = originalResize?.apply(this, arguments);
            updateNodeLoraLabels(this);
            return result;
        };

        const originalDrawForeground = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function () {
            const result = originalDrawForeground?.apply(this, arguments);
            const width = Number(this.size?.[0] || 0);
            if (width && Math.abs(width - Number(this._cmgrLastLoraWidth || 0)) >= 8) updateNodeLoraLabels(this);
            return result;
        };
    },
});

function normalizeLoraEntry(value) {
    if (!value || typeof value !== "object") return null;
    const name = String(value.name || "").trim().replaceAll("\\", "/");
    if (!name) return null;
    const strength = Number(value.strength_model);
    const normalized = {
        name,
        strength_model: Number.isFinite(strength) ? strength : 1,
        enabled: value.enabled !== false,
    };
    [
        "display_name",
        "storage_root_id",
        "model_id",
        "version_id",
        "version_name",
        "preview_url",
        "civitai_url",
        "base_model",
    ].forEach((key) => {
        if (value[key] !== undefined && value[key] !== null && String(value[key]) !== "") {
            normalized[key] = value[key];
        }
    });
    if (Array.isArray(value.trained_words)) {
        normalized.trained_words = value.trained_words.map(String).filter(Boolean);
    }
    return normalized;
}

function normalizeLoraList(value) {
    return (Array.isArray(value) ? value : []).map(normalizeLoraEntry).filter(Boolean);
}

function parseLoraJson(value) {
    if (typeof value !== "string" || !value.trim().startsWith("[")) return null;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? normalizeLoraList(parsed) : null;
    } catch (_) {
        return null;
    }
}

function findSerializedLoraList(values) {
    if (!Array.isArray(values)) return null;
    for (const value of values) {
        const parsed = parseLoraJson(value);
        if (parsed) return parsed;
    }
    return null;
}

function readJsonWidget(node) {
    return parseLoraJson(node?.widgets?.find((widget) => widget.name === "lora_list_json")?.value);
}

function setWidgetProperty(widget, name, value) {
    try {
        widget[name] = value;
    } catch (_) {}
}

function hideWidgetElement(element) {
    if (!element?.style || element === document.body || element === document.documentElement) return;
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    element.style.setProperty("pointer-events", "none", "important");
    element.style.setProperty("width", "0", "important");
    element.style.setProperty("height", "0", "important");
    element.setAttribute?.("aria-hidden", "true");
}

function hideJsonWidget(node) {
    const widget = node?.widgets?.find((item) => item.name === "lora_list_json");
    if (!widget) return;
    setWidgetProperty(widget, "type", "hidden");
    setWidgetProperty(widget, "serialize", true);
    setWidgetProperty(widget, "options", { ...(widget.options || {}), hidden: true });
    setWidgetProperty(widget, "computeSize", () => [0, 0]);
    setWidgetProperty(widget, "draw", () => {});
    setWidgetProperty(widget, "mouse", () => false);
    setWidgetProperty(widget, "computedHeight", 0);
    [widget.element, widget.inputEl, widget.el, widget.domElement].forEach(hideWidgetElement);
}

function writeNodeData(node, loras = node?._cmgrLoras || []) {
    if (!node) return;
    node._cmgrLoras = normalizeLoraList(loras);
    const widget = node.widgets?.find((item) => item.name === "lora_list_json");
    if (widget) widget.value = JSON.stringify(node._cmgrLoras);
    node.setDirtyCanvas?.(true, true);
}

function shortLoraName(entry, maxLength = 30) {
    const label = String(entry?.display_name || entry?.name || "LoRA").split("/").pop();
    return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function loraBaseName(entry) {
    const raw = String(entry?.display_name || entry?.name || "LoRA").replaceAll("\\", "/");
    return raw.split("/").pop().replace(/\.safetensors$/i, "") || "LoRA";
}

function adaptiveLoraName(entry, nodeWidth) {
    const name = loraBaseName(entry);
    const maxChars = Math.max(12, Math.floor((Math.max(180, Number(nodeWidth || 300)) - 112) / 7));
    if (name.length <= maxChars) return name;
    const head = Math.ceil((maxChars - 3) * 0.68);
    const tail = Math.max(0, maxChars - 3 - head);
    return `${name.slice(0, head)}...${tail ? name.slice(-tail) : ""}`;
}

function roundedNodeRect(ctx, x, y, width, height, radius) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
        ctx.roundRect(x, y, width, height, safeRadius);
        return;
    }
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
}

function createNodeLoraControl({ entry, nodeWidth, onToggle, onRemove }) {
    let enabled = entry.enabled !== false;
    const widget = {
        type: "custom",
        name: `cmgr_lora_control:${entry.name}`,
        value: enabled,
        options: {},
        serialize: false,
        computedHeight: NODE_CONTROL_HEIGHT,
        __cmgrLoraWidget: true,
        __cmgrLoraControl: true,
        __cmgrLoraEntry: entry,
        __cmgrDisplayName: adaptiveLoraName(entry, nodeWidth),
        tooltip: entry.name,
        computeSize(width) {
            return [width || 300, NODE_CONTROL_HEIGHT];
        },
        draw(ctx, node, width, y, height) {
            const rowHeight = Math.min(NODE_CONTROL_HEIGHT, Math.max(24, height || NODE_CONTROL_HEIGHT));
            const rowY = y + Math.max(0, ((height || NODE_CONTROL_HEIGHT) - rowHeight) / 2);
            const rowWidth = Math.max(120, width - NODE_SIDE_MARGIN * 2);
            widget.last_y = y;
            widget.__cmgrDrawWidth = width;

            ctx.save();
            roundedNodeRect(ctx, NODE_SIDE_MARGIN, rowY, rowWidth, rowHeight, 8);
            ctx.fillStyle = enabled ? "rgba(55, 145, 255, 0.12)" : "rgba(255, 255, 255, 0.035)";
            ctx.fill();
            ctx.strokeStyle = enabled ? "rgba(89, 166, 255, 0.42)" : "rgba(255, 255, 255, 0.11)";
            ctx.lineWidth = 1;
            ctx.stroke();

            const switchX = NODE_SIDE_MARGIN + 7;
            const switchY = rowY + (rowHeight - NODE_SWITCH_HEIGHT) / 2;
            roundedNodeRect(ctx, switchX, switchY, NODE_SWITCH_WIDTH, NODE_SWITCH_HEIGHT, NODE_SWITCH_HEIGHT / 2);
            ctx.fillStyle = enabled ? "#3b93f6" : "#4b5563";
            ctx.fill();
            ctx.beginPath();
            ctx.arc(enabled ? switchX + NODE_SWITCH_WIDTH - 9 : switchX + 9, switchY + NODE_SWITCH_HEIGHT / 2, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = "#ffffff";
            ctx.fill();

            const removeX = width - NODE_SIDE_MARGIN - NODE_REMOVE_SIZE - 6;
            const removeY = rowY + (rowHeight - NODE_REMOVE_SIZE) / 2;
            roundedNodeRect(ctx, removeX, removeY, NODE_REMOVE_SIZE, NODE_REMOVE_SIZE, 6);
            ctx.fillStyle = "rgba(239, 68, 68, 0.10)";
            ctx.fill();
            ctx.strokeStyle = "rgba(239, 68, 68, 0.30)";
            ctx.stroke();
            ctx.fillStyle = "#f87171";
            ctx.font = "600 17px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("×", removeX + NODE_REMOVE_SIZE / 2, removeY + NODE_REMOVE_SIZE / 2 + 0.5);

            const textX = switchX + NODE_SWITCH_WIDTH + 10;
            const textRight = removeX - 9;
            ctx.beginPath();
            ctx.rect(textX, rowY, Math.max(0, textRight - textX), rowHeight);
            ctx.clip();
            ctx.fillStyle = enabled ? "#e5f2ff" : "#8b94a3";
            ctx.font = enabled ? "600 12px Arial" : "500 12px Arial";
            ctx.textAlign = "left";
            ctx.fillText(widget.__cmgrDisplayName, textX, rowY + rowHeight / 2 + 0.5);
            ctx.restore();
        },
        mouse(event, pointerOffset, node) {
            if (event?.type && !["pointerdown", "mousedown"].includes(event.type)) return false;
            const width = widget.__cmgrDrawWidth || node?.size?.[0] || 300;
            const x = Number(pointerOffset?.[0] || 0);
            const y = Number(pointerOffset?.[1] || 0);
            const rowY = Number(widget.last_y || 0);
            if (y < rowY || y > rowY + NODE_CONTROL_HEIGHT) return false;
            const switchRight = NODE_SIDE_MARGIN + 7 + NODE_SWITCH_WIDTH;
            const removeLeft = width - NODE_SIDE_MARGIN - NODE_REMOVE_SIZE - 6;
            if (x >= NODE_SIDE_MARGIN && x <= switchRight + 5) {
                enabled = !enabled;
                widget.value = enabled;
                onToggle?.(enabled);
                node?.setDirtyCanvas?.(true, true);
                return true;
            }
            if (x >= removeLeft - 4 && x <= removeLeft + NODE_REMOVE_SIZE + 4) {
                onRemove?.();
                return true;
            }
            return false;
        },
    };
    return widget;
}

function updateNodeLoraLabels(node) {
    const width = Number(node?.size?.[0] || 300);
    let changed = false;
    (node?.widgets || []).forEach((widget) => {
        if (!widget?.__cmgrLoraControl) return;
        const next = adaptiveLoraName(widget.__cmgrLoraEntry, width);
        if (next !== widget.__cmgrDisplayName) {
            widget.__cmgrDisplayName = next;
            changed = true;
        }
    });
    node._cmgrLastLoraWidth = width;
    if (changed) node.setDirtyCanvas?.(true, true);
}

function removeDynamicNodeWidgets(node) {
    if (!Array.isArray(node?.widgets)) return;
    for (let index = node.widgets.length - 1; index >= 0; index -= 1) {
        const widget = node.widgets[index];
        if (!widget?.__cmgrLoraWidget) continue;
        const element = widget.element || widget.inputEl || widget.el;
        element?.remove?.();
        node.widgets.splice(index, 1);
    }
}

function syncNodeWidgets(node, value) {
    if (!node) return;
    const width = Math.max(Number(node.size?.[0] || 0), 300);
    const loras = normalizeLoraList(value);
    removeDynamicNodeWidgets(node);
    node._cmgrLoras = loras;

    loras.forEach((entry, index) => {
        let strength = null;
        const control = node.addCustomWidget(createNodeLoraControl({
            entry,
            nodeWidth: width,
            onToggle: (enabled) => {
            const current = node._cmgrLoras[index];
            if (!current) return;
            current.enabled = Boolean(enabled);
                if (strength) strength.disabled = !current.enabled;
            writeNodeData(node);
            },
            onRemove: () => {
                const next = node._cmgrLoras.filter((_, itemIndex) => itemIndex !== index);
                writeNodeData(node, next);
                syncNodeWidgets(node, next);
                if (popup.node === node && overlay?.classList.contains("show")) renderPopup();
            },
        }));

        strength = node.addWidget("slider", `   ${t("Strength")}${"\u200B".repeat(index)}`, entry.strength_model, (next) => {
            const current = node._cmgrLoras[index];
            const number = Number(next);
            if (!current || !Number.isFinite(number)) return;
            current.strength_model = Number(number.toFixed(2));
            writeNodeData(node);
        }, { min: -4, max: 4, step: 0.05, precision: 2 });
        strength.__cmgrLoraWidget = true;
        strength.serialize = false;
        strength.computedHeight = 18;
        strength.disabled = entry.enabled === false;
        control.__cmgrStrengthWidget = strength;
    });

    const openButton = node.addWidget("button", t("Open LoRA Manager"), null, () => openPopup(node));
    openButton.__cmgrLoraWidget = true;
    openButton.serialize = false;
    hideJsonWidget(node);
    writeNodeData(node, loras);

    const computed = node.computeSize?.() || [width, 120];
    node.setSize?.([width, Math.max(100, computed[1])]);
    updateNodeLoraLabels(node);
}

function loraKey(entry) {
    return `${String(entry?.storage_root_id || "")}::${String(entry?.name || "").toLocaleLowerCase()}`;
}

function addLoraToNode(entry) {
    addLoraToTargetNode(popup.node, entry, true);
}

function addLoraToTargetNode(node, entry, notify = false) {
    if (!node) return;
    const normalized = normalizeLoraEntry(entry);
    if (!normalized) return;
    const next = [...normalizeLoraList(node._cmgrLoras)];
    const existingIndex = next.findIndex((item) => loraKey(item) === loraKey(normalized));
    if (existingIndex >= 0) {
        next[existingIndex] = {
            ...next[existingIndex],
            ...normalized,
            strength_model: next[existingIndex].strength_model,
            enabled: true,
        };
        if (notify) showToast(t("LoRA already applied; it has been enabled."));
    } else {
        next.push(normalized);
        if (notify) showToast(t("LoRA applied to node."));
    }
    writeNodeData(node, next);
    syncNodeWidgets(node, next);
    if (popup.node === node && overlay?.classList.contains("show")) renderPopup();
}

function removeLoraFromNode(index) {
    if (!popup.node) return;
    const next = normalizeLoraList(popup.node._cmgrLoras).filter((_, itemIndex) => itemIndex !== index);
    writeNodeData(popup.node, next);
    syncNodeWidgets(popup.node, next);
    renderPopup();
}

function updateLoraOrder(index, delta) {
    if (!popup.node) return;
    const next = normalizeLoraList(popup.node._cmgrLoras);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    writeNodeData(popup.node, next);
    syncNodeWidgets(popup.node, next);
    renderPopup();
}

function openPopup(node) {
    popup.node = node;
    popup.error = "";
    createOverlay();
    overlay.classList.add("show");
    renderPopup();
    void hydratePopup();
}

function createOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "cmgr-overlay cmgr-lora-overlay";
    overlay.innerHTML = `
        <div class="cmgr-shell cmgr-lora-shell" role="dialog" aria-modal="true" aria-label="${escapeAttr(t("LoRA Manager"))}">
            <div class="cmgr-topbar">
                <div>
                    <div class="cmgr-title">${escapeHtml(t("LoRA Manager"))}</div>
                    <div class="cmgr-subtitle">${escapeHtml(t("Search, download, apply, and manage LoRAs for this node."))}</div>
                </div>
                <div class="cmgr-topbar-actions">
                    ${renderPromoLinks()}
                    <button class="cmgr-icon-btn" data-action="close-lora-manager">${escapeHtml(t("Close"))}</button>
                </div>
            </div>
            <div class="cmgr-layout cmgr-lora-layout">
                <nav class="cmgr-nav cmgr-lora-nav"></nav>
                <main class="cmgr-body cmgr-lora-body"></main>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    popupBody = overlay.querySelector(".cmgr-lora-body");
    notificationHost = ensureNotificationHost(overlay.querySelector(".cmgr-lora-shell"));
    overlay.querySelector('[data-action="close-lora-manager"]').onclick = closePopup;
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closePopup();
    });
}

function closePopup() {
    overlay?.classList.remove("show");
}

async function hydratePopup() {
    await Promise.allSettled([
        loadLibrary(false),
        loadDownloads(false),
        loadLoraTaxonomy(),
        popup.remoteItems.length ? Promise.resolve() : searchRemote(true),
    ]);
}

function normalizeTaxonomyItems(value) {
    return (Array.isArray(value) ? value : [])
        .map((item) => ({ name: String(item?.name || "").trim(), count: Number(item?.count || 0) }))
        .filter((item) => item.name);
}

async function loadLoraTaxonomy() {
    try {
        const data = await apiGet("/taxonomy?kind=lora");
        popup.taxonomy = {
            baseModels: normalizeTaxonomyItems(data?.baseModels),
            tags: normalizeTaxonomyItems(data?.tags),
        };
        if (overlay?.classList.contains("show")) renderNav();
    } catch (_) {
        popup.taxonomy = popup.taxonomy || { baseModels: [], tags: [] };
    }
}

function filterOptions(items, selected = "") {
    const names = (Array.isArray(items) ? items : []).map((item) => String(item?.name || item || "").trim()).filter(Boolean);
    if (selected && !names.some((name) => name.toLocaleLowerCase() === selected.toLocaleLowerCase())) names.unshift(selected);
    return Array.from(new Set(names));
}

function loraBaseModelOptions() {
    const local = popup.libraryItems.map((item) => item.base_model).filter(Boolean);
    return filterOptions([...(popup.taxonomy?.baseModels || []), ...local], popup.selectedBaseModel);
}

function navCount(tab) {
    if (tab === "local") return popup.libraryItems.length;
    if (tab === "applied") return popup.node?._cmgrLoras?.length || 0;
    if (tab === "downloads") {
        return loraDownloads().filter((job) => ACTIVE_DOWNLOAD_STATUSES.has(job.status)).length;
    }
    return "";
}

function renderNav() {
    const nav = overlay?.querySelector(".cmgr-lora-nav");
    if (!nav) return;
    const items = [
        ["discover", "Discover"],
        ["local", "Local LoRAs"],
        ["applied", "Applied to Node"],
        ["downloads", "Downloads"],
    ];
    nav.innerHTML = `
        <div class="cmgr-nav-group">
            <div class="cmgr-nav-title">${escapeHtml(t("LoRA"))}</div>
            ${items.map(([id, label]) => `
                <button class="cmgr-nav-btn ${popup.tab === id ? "active" : ""}" data-lora-tab="${id}">
                    <span>${escapeHtml(t(label))}</span>
                    ${navCount(id) !== "" ? `<b>${navCount(id)}</b>` : ""}
                </button>
            `).join("")}
        </div>
        ${popup.tab === "local" ? renderLocalFolderSidebar() : ""}
        ${["discover", "local"].includes(popup.tab) ? `
            <div class="cmgr-nav-group cmgr-category-group cmgr-lora-filter-group">
                <div class="cmgr-nav-title">${escapeHtml(t("Base Model"))}</div>
                <div class="cmgr-search-picker">
                    ${renderSearchCombo({
                        id: "lora-base-model",
                        value: popup.selectedBaseModel,
                        items: loraBaseModelOptions(),
                        placeholder: t("Choose a base model"),
                        searchPlaceholder: t("Search base models..."),
                        emptyText: t("No base models found"),
                    })}
                    <button class="cmgr-clear-filter" data-clear-lora-base-model title="${escapeAttr(t("Clear base model"))}" ${popup.selectedBaseModel ? "" : "disabled"}>${escapeHtml(t("Clear"))}</button>
                </div>
            </div>
        ` : ""}
        ${popup.tab === "discover" ? `
            <div class="cmgr-nav-group cmgr-category-group cmgr-lora-filter-group">
                <div class="cmgr-nav-title">${escapeHtml(t("Filter by Category"))}</div>
                <div class="cmgr-chip-grid cmgr-lora-category-grid">
                    <button class="cmgr-filter-chip ${popup.selectedCategory ? "" : "active"}" data-lora-category="">${escapeHtml(t("All"))}</button>
                    ${CIVITAI_CATEGORY_FILTERS.map((item) => `
                        <button class="cmgr-filter-chip ${popup.selectedCategory === item.value ? "active" : ""}" data-lora-category="${escapeAttr(item.value)}">${escapeHtml(t(item.label))}</button>
                    `).join("")}
                </div>
            </div>
            <div class="cmgr-nav-group cmgr-category-group cmgr-lora-filter-group">
                <div class="cmgr-nav-title">${escapeHtml(t("Search Tags"))}</div>
                <div class="cmgr-search-picker">
                    ${renderSearchCombo({
                        id: "lora-tag",
                        value: popup.selectedTag,
                        items: filterOptions(popup.taxonomy?.tags, popup.selectedTag),
                        placeholder: t("Choose a tag"),
                        searchPlaceholder: t("Search tags..."),
                        emptyText: t("No tags found"),
                    })}
                    <button class="cmgr-clear-filter" data-clear-lora-tag title="${escapeAttr(t("Clear tag"))}" ${popup.selectedTag ? "" : "disabled"}>${escapeHtml(t("Clear"))}</button>
                </div>
            </div>
        ` : ""}
        <div class="cmgr-lora-nav-summary">
            <span>${escapeHtml(t("Execution order"))}</span>
            <b>${escapeHtml(t("Top to bottom"))}</b>
        </div>
    `;
    nav.querySelectorAll("[data-lora-tab]").forEach((button) => {
        button.onclick = () => switchTab(button.dataset.loraTab);
    });
    bindLocalFolderControls(nav);
    const selectBaseModel = (value) => {
        if (popup.selectedBaseModel === value) return;
        popup.selectedBaseModel = value;
        popup.selectedRemote = null;
        if (popup.tab === "discover") void searchRemote(true);
        else {
            popup.selectedAssetId = "";
            popup.scroll.local = 0;
            if (!updateLocalFolderView()) renderPopup({ preserveScroll: false });
        }
    };
    bindSearchCombo(nav.querySelector('[data-combo="lora-base-model"]'), selectBaseModel);
    const clearBaseModel = nav.querySelector("[data-clear-lora-base-model]");
    if (clearBaseModel) clearBaseModel.onclick = () => selectBaseModel("");
    nav.querySelectorAll("[data-lora-category]").forEach((button) => {
        button.onclick = () => {
            if (popup.selectedCategory === button.dataset.loraCategory) return;
            popup.selectedCategory = button.dataset.loraCategory || "";
            popup.selectedRemote = null;
            void searchRemote(true);
        };
    });
    const selectTag = (value) => {
        if (popup.selectedTag === value) return;
        popup.selectedTag = value;
        popup.selectedRemote = null;
        void searchRemote(true);
    };
    bindSearchCombo(nav.querySelector('[data-combo="lora-tag"]'), selectTag);
    const clearTag = nav.querySelector("[data-clear-lora-tag]");
    if (clearTag) clearTag.onclick = () => selectTag("");
}

function renderLocalFolderSidebar() {
    const tree = localFolderTree();
    return `
        <div class="cmgr-nav-group cmgr-category-group cmgr-lora-filter-group cmgr-lora-folder-group">
            <div class="cmgr-nav-title">${escapeHtml(t("Local Folders"))}</div>
            <button class="cmgr-nav-btn cmgr-lora-folder-all ${popup.selectedLocalFolder ? "" : "active"}" data-lora-folder="">
                <span class="cmgr-lora-folder-label"><i class="cmgr-lora-folder-glyph is-library" aria-hidden="true"></i>${escapeHtml(t("All LoRAs"))}</span>
                <b>${tree.count}</b>
            </button>
            ${renderLocalFolderTree(tree)}
            ${!tree.count ? `<div class="cmgr-nav-note">${escapeHtml(t("Local folders appear after scanning your model files."))}</div>` : ""}
        </div>
    `;
}

function renderLocalFolderTree(tree) {
    if (!tree?.count) return "";
    return `
        <div class="cmgr-folder-tree cmgr-lora-folder-tree">
            ${tree.rootFileCount ? renderLocalRootFilesNode(tree.rootFileCount) : ""}
            ${tree.children.map((node) => renderLocalFolderNode(node, 0)).join("")}
        </div>
    `;
}

function renderLocalRootFilesNode(count) {
    return `
        <div class="cmgr-folder-node" style="--cmgr-folder-depth: 0">
            <div class="cmgr-folder-row">
                <span class="cmgr-folder-spacer" aria-hidden="true"></span>
                <button class="cmgr-nav-btn cmgr-folder-select cmgr-lora-folder-select ${popup.selectedLocalFolder === ROOT_LOCAL_FOLDER ? "active" : ""}" data-lora-folder="${ROOT_LOCAL_FOLDER}" title="${escapeAttr(t("Root files"))}">
                    <span class="cmgr-lora-folder-label"><i class="cmgr-lora-folder-glyph is-file" aria-hidden="true"></i>${escapeHtml(t("Root files"))}</span>
                    <b>${count}</b>
                </button>
            </div>
        </div>
    `;
}

function renderLocalFolderNode(node, depth) {
    const expanded = isLocalFolderExpanded(node.path);
    const hasChildren = node.children.length > 0;
    const selected = popup.selectedLocalFolder === node.path;
    const inPath = !selected && popup.selectedLocalFolder.startsWith(`${node.path}/`);
    return `
        <div class="cmgr-folder-node" style="--cmgr-folder-depth: ${Math.min(depth, 8)}">
            <div class="cmgr-folder-row">
                ${hasChildren ? `
                    <button class="cmgr-folder-toggle ${expanded ? "expanded" : ""}" data-lora-folder-toggle="${escapeAttr(node.path)}" aria-label="${escapeAttr(`${expanded ? "Collapse" : "Expand"} ${node.path}`)}" aria-expanded="${expanded ? "true" : "false"}"></button>
                ` : `<span class="cmgr-folder-spacer" aria-hidden="true"></span>`}
                <button class="cmgr-nav-btn cmgr-folder-select cmgr-lora-folder-select ${selected ? "active" : ""} ${inPath ? "is-ancestor" : ""}" data-lora-folder="${escapeAttr(node.path)}" title="${escapeAttr(node.path)}">
                    <span class="cmgr-lora-folder-label"><i class="cmgr-lora-folder-glyph" aria-hidden="true"></i>${escapeHtml(node.name)}</span>
                    <b>${node.count}</b>
                </button>
            </div>
            ${hasChildren && expanded ? `<div class="cmgr-folder-children">${node.children.map((child) => renderLocalFolderNode(child, depth + 1)).join("")}</div>` : ""}
        </div>
    `;
}

function bindLocalFolderControls(root) {
    root?.querySelectorAll("[data-lora-folder]").forEach((button) => {
        button.onclick = () => selectLocalFolder(button.dataset.loraFolder || "");
    });
    root?.querySelectorAll("[data-lora-folder-toggle]").forEach((button) => {
        button.onclick = (event) => {
            event.stopPropagation();
            toggleLocalFolder(button.dataset.loraFolderToggle || "", button.classList.contains("expanded"));
        };
    });
}

function rerenderNavPreservingScroll() {
    const nav = overlay?.querySelector(".cmgr-lora-nav");
    if (!nav) return;
    const scrollTop = nav.scrollTop;
    renderNav();
    nav.scrollTop = scrollTop;
}

function selectLocalFolder(value) {
    const folder = normalizeLocalFolderPath(value);
    if (popup.selectedLocalFolder === folder) return;
    popup.selectedLocalFolder = folder;
    popup.selectedAssetId = "";
    popup.scroll.local = 0;
    expandLocalFolderAncestors(folder);
    rerenderNavPreservingScroll();
    if (!updateLocalFolderView()) renderPopup({ preserveScroll: false });
}

function toggleLocalFolder(value, expanded) {
    const folder = normalizeLocalFolderPath(value);
    if (!folder || folder === ROOT_LOCAL_FOLDER) return;
    popup.expandedLocalFolders[folder] = !expanded;
    rerenderNavPreservingScroll();
}

function expandLocalFolderAncestors(value) {
    const folder = normalizeLocalFolderPath(value);
    if (!folder || folder === ROOT_LOCAL_FOLDER) return;
    const parts = splitLocalPath(folder);
    for (let index = 1; index <= parts.length; index += 1) {
        popup.expandedLocalFolders[parts.slice(0, index).join("/")] = true;
    }
}

function isLocalFolderExpanded(path) {
    if (Object.prototype.hasOwnProperty.call(popup.expandedLocalFolders, path)) return Boolean(popup.expandedLocalFolders[path]);
    return false;
}

function switchTab(tab) {
    popup.tab = tab;
    popup.error = "";
    renderPopup();
    if (tab === "local" && !popup.libraryItems.length) void loadLibrary(false);
    if (tab === "downloads") void loadDownloads(true);
}

function popupScrollElement() {
    if (!popupBody) return null;
    if (popup.tab === "applied") return popupBody.querySelector(".cmgr-lora-applied-list");
    if (popup.tab === "downloads") return popupBody.querySelector(".cmgr-lora-download-list");
    return popupBody.querySelector(".cmgr-lora-results");
}

function rememberPopupScroll() {
    const nav = overlay?.querySelector(".cmgr-lora-nav");
    if (nav) popup.scroll.nav = nav.scrollTop;
    if (!renderedPopupTab || !popupBody) return;
    let element = null;
    if (renderedPopupTab === "applied") element = popupBody.querySelector(".cmgr-lora-applied-list");
    else if (renderedPopupTab === "downloads") element = popupBody.querySelector(".cmgr-lora-download-list");
    else element = popupBody.querySelector(".cmgr-lora-results");
    if (element) popup.scroll[renderedPopupTab] = element.scrollTop;
}

function restorePopupScroll() {
    const apply = () => {
        const nav = overlay?.querySelector(".cmgr-lora-nav");
        if (nav) nav.scrollTop = Number(popup.scroll.nav || 0);
        const element = popupScrollElement();
        if (element) element.scrollTop = Number(popup.scroll[popup.tab] || 0);
    };
    apply();
    requestAnimationFrame(() => {
        apply();
        if (popup.tab === "discover") maybeAutoLoadMoreLoras(popupScrollElement());
    });
}

function bindPopupScroll() {
    const nav = overlay?.querySelector(".cmgr-lora-nav");
    if (nav) nav.onscroll = () => { popup.scroll.nav = nav.scrollTop; };
    const element = popupScrollElement();
    if (!element) return;
    element.onscroll = () => {
        popup.scroll[popup.tab] = element.scrollTop;
        if (popup.tab === "discover") maybeAutoLoadMoreLoras(element);
    };
}

function setupPopupLazyPreviews() {
    previewObserver?.disconnect();
    previewObserver = null;
    const pending = [...(popupBody?.querySelectorAll("img[data-cmgr-lora-src], video[data-cmgr-lora-src]") || [])];
    if (!pending.length) return;

    const loadMedia = (element) => {
        const src = element.dataset.cmgrLoraSrc;
        if (!src || element.dataset.cmgrLoaded === "1") return;
        element.dataset.cmgrLoaded = "1";
        element.src = src;
        if (element.tagName === "VIDEO") {
            element.load();
            element.play?.().catch(() => {});
        }
    };

    const scrollRoot = popupScrollElement();
    if ("IntersectionObserver" in window) {
        previewObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                previewObserver?.unobserve(entry.target);
                loadMedia(entry.target);
            });
        }, { root: scrollRoot, rootMargin: "100% 0px" });
        pending.forEach((element) => previewObserver.observe(element));
    } else {
        pending.forEach(loadMedia);
    }
}

function schedulePopupLazyPreviews() {
    if (popupPreviewSetupFrame) cancelAnimationFrame(popupPreviewSetupFrame);
    popupPreviewSetupFrame = requestAnimationFrame(() => {
        popupPreviewSetupFrame = requestAnimationFrame(() => {
            popupPreviewSetupFrame = 0;
            if (popupBody?.isConnected && overlay?.classList.contains("show")) setupPopupLazyPreviews();
        });
    });
}

function maybeAutoLoadMoreLoras(element) {
    if (!element || popup.tab !== "discover" || popup.remoteLoading || !popup.nextCursor) return;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining > Math.max(720, element.clientHeight * 0.8)) return;
    void searchRemote(false);
}

function capturePopupFocus() {
    const active = document.activeElement;
    if (!popupBody?.contains(active) || !active?.matches?.("input[data-field], textarea[data-field]")) return null;
    return {
        field: active.dataset.field || "",
        start: Number.isInteger(active.selectionStart) ? active.selectionStart : null,
        end: Number.isInteger(active.selectionEnd) ? active.selectionEnd : null,
        direction: active.selectionDirection || "none",
    };
}

function restorePopupFocus(snapshot) {
    if (!popupBody || !snapshot?.field) return;
    const apply = () => {
        const input = Array.from(popupBody.querySelectorAll("input[data-field], textarea[data-field]"))
            .find((item) => item.dataset.field === snapshot.field);
        if (!input) return;
        try {
            input.focus({ preventScroll: true });
        } catch (_) {
            input.focus();
        }
        if (snapshot.start !== null && snapshot.end !== null) {
            const length = String(input.value || "").length;
            input.setSelectionRange?.(
                Math.min(snapshot.start, length),
                Math.min(snapshot.end, length),
                snapshot.direction,
            );
        }
    };
    apply();
    requestAnimationFrame(apply);
}

function renderPopup(options = {}) {
    if (!overlay || !popupBody) return;
    const focusedField = capturePopupFocus();
    if (options.preserveScroll !== false) rememberPopupScroll();
    else popup.scroll[popup.tab] = 0;
    renderNav();
    const content = popup.tab === "local"
        ? renderLocal()
        : popup.tab === "applied"
            ? renderApplied()
            : popup.tab === "downloads"
                ? renderDownloads()
                : renderDiscover();
    popupBody.innerHTML = content;
    renderedPopupTab = popup.tab;
    updatePopupMessages();
    bindPopupEvents();
    bindPopupScroll();
    schedulePopupLazyPreviews();
    restorePopupScroll();
    restorePopupFocus(focusedField);
}

function updatePopupMessages() {
    return updateNotificationHost(notificationHost, {
        error: popup.error,
        toast: popup.toast,
        onDismissError: () => {
            popup.error = "";
            updatePopupMessages();
        },
    });
}

function updateSelectedCard(selector, selectedId) {
    popupBody?.querySelectorAll(selector).forEach((card) => {
        card.classList.toggle("selected", String(card.dataset.remoteId || card.dataset.localId || "") === String(selectedId || ""));
    });
}

function updateRemoteDetail() {
    if (popup.tab !== "discover") return false;
    const detail = popupBody?.querySelector(".cmgr-lora-detail");
    if (!detail) return false;
    updateSelectedCard("[data-remote-id]", popup.selectedRemote?.id);
    detail.innerHTML = renderRemoteDetail();
    bindPopupEvents();
    return true;
}

function updateLocalDetail() {
    if (popup.tab !== "local") return false;
    const detail = popupBody?.querySelector(".cmgr-lora-detail");
    if (!detail) return false;
    const asset = popup.libraryItems.find((item) => String(item.id) === String(popup.selectedAssetId)) || null;
    const assetId = String(asset?.id || "");
    const previousPreview = assetId && detail.dataset.localAssetId === assetId
        ? detail.querySelector(".cmgr-lora-detail-preview")
        : null;
    previousPreview?.remove();
    updateSelectedCard("[data-local-id]", popup.selectedAssetId);
    detail.innerHTML = asset
        ? renderLocalDetail(asset)
        : renderEmptyDetail(t("Select a local LoRA"), t("Apply it to this node or manage its local file and Civitai metadata."), "library");
    const nextPreview = detail.querySelector(".cmgr-lora-detail-preview");
    if (previousPreview && nextPreview && previousPreview.dataset.previewKey === nextPreview.dataset.previewKey) {
        nextPreview.replaceWith(previousPreview);
    }
    if (assetId) detail.dataset.localAssetId = assetId;
    else delete detail.dataset.localAssetId;
    bindPopupEvents();
    return true;
}

function updateSelectedLocalCard() {
    if (popup.tab !== "local") return false;
    const asset = popup.libraryItems.find((item) => String(item.id) === String(popup.selectedAssetId));
    const card = [...(popupBody?.querySelectorAll("[data-local-id]") || [])]
        .find((item) => String(item.dataset.localId || "") === String(popup.selectedAssetId || ""));
    if (!asset || !card) return false;
    const index = Math.max(0, filteredLocalItems().findIndex((item) => String(item.id) === String(asset.id)));
    const template = document.createElement("template");
    template.innerHTML = renderLocalCard(asset, index).trim();
    const replacement = template.content.firstElementChild;
    if (!replacement) return false;
    if (card.dataset.previewKey === replacement.dataset.previewKey) {
        const currentThumb = card.querySelector(".cmgr-thumb");
        const nextThumb = replacement.querySelector(".cmgr-thumb");
        if (currentThumb && nextThumb) {
            currentThumb.remove();
            nextThumb.replaceWith(currentThumb);
        }
    }
    card.replaceWith(replacement);
    bindPopupEvents();
    schedulePopupLazyPreviews();
    return true;
}

function setRemoteLoadingMore(visible) {
    if (popup.tab !== "discover") return false;
    const results = popupBody?.querySelector(".cmgr-lora-results");
    if (!results) return false;
    results.querySelectorAll(".cmgr-load-more-skeleton").forEach((item) => item.remove());
    if (visible) results.insertAdjacentHTML("beforeend", renderLoadingMoreSkeletons());
    return true;
}

function appendRemoteItems(items, startIndex) {
    if (popup.tab !== "discover") return false;
    const results = popupBody?.querySelector(".cmgr-lora-results");
    if (!results) return false;
    results.querySelectorAll(".cmgr-load-more-skeleton").forEach((item) => item.remove());
    if (items.length) {
        results.insertAdjacentHTML("beforeend", items.map((model, index) => renderRemoteCard(model, startIndex + index)).join(""));
        bindPopupEvents();
        schedulePopupLazyPreviews();
    }
    maybeAutoLoadMoreLoras(results);
    return true;
}

function renderDiscover() {
    const toolbar = renderSearchToolbar({
        title: t("Discover LoRAs"),
        subtitle: "Civitai",
        className: "cmgr-lora-toolbar",
        searchHtml: renderToolbarSearchField({
            value: popup.discoverQuery,
            inputAttrs: 'data-field="remote-query"',
            className: "cmgr-lora-search",
            placeholder: t("Search Civitai LoRAs..."),
            clearAction: "clear-lora-search",
        }),
        actionsHtml: `
            <select class="cmgr-input cmgr-lora-sort" data-field="remote-sort">
                ${["Highest Rated", "Most Downloaded", "Newest"].map((item) => `<option value="${item}" ${popup.sort === item ? "selected" : ""}>${escapeHtml(t(item))}</option>`).join("")}
            </select>
            <button class="cmgr-primary cmgr-search-submit" data-action="search-loras">${escapeHtml(t(popup.remoteLoading ? "Searching..." : "Search"))}</button>
        `,
    });
    return `
        <section class="cmgr-page cmgr-lora-page">
            ${toolbar}
            <div class="cmgr-split has-detail cmgr-lora-split">
                <div class="cmgr-results cmgr-lora-results">
                    ${renderRemoteResults()}
                </div>
                <aside class="cmgr-detail cmgr-lora-detail">${renderRemoteDetail()}</aside>
            </div>
        </section>
    `;
}

function renderRemoteResults() {
    if (!popup.remoteItems.length && popup.remoteLoading) return renderSkeletons();
    if (!popup.remoteItems.length) return `<div class="cmgr-empty">${escapeHtml(t("No LoRAs found."))}</div>`;
    return `
        ${popup.remoteItems.map((model, index) => renderRemoteCard(model, index)).join("")}
        ${popup.remoteLoading && !popup.remoteResetting ? renderLoadingMoreSkeletons() : ""}
    `;
}

function renderSkeletons(count = 10) {
    return Array.from({ length: count }, () => `
        <article class="cmgr-card cmgr-lora-card cmgr-skeleton-card">
            <div class="cmgr-skeleton-media"></div>
            <div class="cmgr-skeleton-content"><div class="cmgr-skeleton-line cmgr-skeleton-title"></div></div>
        </article>
    `).join("");
}

function renderLoadingMoreSkeletons(count = 4) {
    return Array.from({ length: count }, (_, index) => `
        <article
            class="cmgr-card cmgr-lora-card cmgr-skeleton-card cmgr-load-more-skeleton"
            ${index === 0 ? `role="status" aria-label="${escapeAttr(t("Loading more..."))}"` : 'aria-hidden="true"'}
        >
            <div class="cmgr-skeleton-media"></div>
            <div class="cmgr-skeleton-content"><div class="cmgr-skeleton-line ${index % 2 ? "is-medium" : ""}"></div></div>
        </article>
    `).join("");
}

function versionsFor(model) {
    return Array.isArray(model?.modelVersions) ? model.modelVersions : [];
}

function selectedVersion() {
    const versions = versionsFor(popup.selectedRemote);
    return versions.find((item) => String(item.id) === String(popup.selectedVersionId)) || versions[0] || null;
}

function filesFor(version) {
    return Array.isArray(version?.files) ? version.files : [];
}

function selectedFile() {
    const files = filesFor(selectedVersion());
    return files.find((item) => String(item.name || item.id) === String(popup.selectedFileName))
        || files.find((item) => item.primary)
        || files[0]
        || null;
}

function rawPreview(model, version = versionsFor(model)[0]) {
    const image = findModelPreviewSource(model, version, { preferImage: true });
    return typeof image === "string" ? image : image?.url || image?.thumbnailUrl || "";
}

function remotePreviewMedia(model, version = versionsFor(model)[0], width = 450) {
    const source = findModelPreviewSource(model, version);
    if (source) return createPreviewMedia(source, width);
    const messageKey = isModelPreviewFiltered(model, popup.contentFilterActive)
        ? "Preview hidden by content settings"
        : "No Preview";
    return { url: "", type: "image", emptyText: t(messageKey) };
}

function renderPreview(media, label, rawUrl = "", options = {}) {
    const descriptor = typeof media === "string" ? { url: media, type: "image" } : media || {};
    if (!descriptor.url) return renderUnavailablePreview(descriptor.emptyText);
    const content = descriptor.type === "video"
        ? renderRemoteVideo(descriptor, label, options)
        : renderRemoteImage(descriptor, label, options);
    return rawUrl
        ? `<a href="${escapeAttr(rawUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Open original image"))}">${content}</a>`
        : content;
}

function renderRemoteImage(media, label, options = {}) {
    const defer = options.defer === true;
    const src = defer ? TRANSPARENT_PIXEL : media.url;
    const lazyAttrs = defer ? `data-cmgr-lora-src="${escapeAttr(media.url)}" data-cmgr-loaded="0"` : "";
    const priority = options.priority || "auto";
    const stateClass = defer ? "is-pending" : options.instant ? "is-loaded" : "is-loading";
    return `<img class="cmgr-preview-img ${options.className || ""} ${stateClass}" src="${escapeAttr(src)}" ${lazyAttrs} ${previewFallbackAttr(media.fallbackUrls || [])} alt="${escapeAttr(label || "LoRA")}" loading="${defer ? "lazy" : "eager"}" fetchpriority="${priority}" decoding="async" onload="if(!this.dataset.cmgrLoraSrc||this.dataset.cmgrLoaded==='1'){this.classList.remove('is-pending','is-loading');this.classList.add('is-loaded')}" onerror="let q=[];try{q=JSON.parse(this.dataset.fallbackSrcs||'[]')}catch(_){};const next=q.shift();this.dataset.fallbackSrcs=JSON.stringify(q);if(next){this.src=next;}else{this.replaceWith(Object.assign(document.createElement('div'),{className:'cmgr-no-preview',textContent:'No Preview'}))}" />`;
}

function renderRemoteVideo(media, label, options = {}) {
    const poster = media.posterUrl
        ? renderRemoteImage({ url: media.posterUrl, fallbackUrls: media.posterFallbackUrls || [] }, "", { ...options, className: "cmgr-video-poster" })
        : "";
    const defer = options.defer === true;
    const src = defer ? "" : media.url;
    const lazyAttrs = defer ? `data-cmgr-lora-src="${escapeAttr(media.url)}" data-cmgr-loaded="0"` : "";
    const stateClass = defer ? "is-pending" : "is-loading";
    const hasPoster = media.posterUrl ? 'data-has-poster="1"' : "";
    return `${poster}<video class="cmgr-preview-img cmgr-preview-video ${stateClass}" src="${escapeAttr(src)}" ${lazyAttrs} ${previewFallbackAttr(media.fallbackUrls || [])} ${hasPoster} muted loop playsinline autoplay preload="${defer ? "none" : "metadata"}" aria-label="${escapeAttr(label || "LoRA preview video")}" onloadeddata="this.classList.remove('is-pending','is-loading');this.classList.add('is-loaded')" onerror="let q=[];try{q=JSON.parse(this.dataset.fallbackSrcs||'[]')}catch(_){};const next=q.shift();this.dataset.fallbackSrcs=JSON.stringify(q);if(next){this.src=next;this.load();this.play?.().catch(()=>{});}else if(this.dataset.hasPoster==='1'){this.remove();}else{this.replaceWith(Object.assign(document.createElement('div'),{className:'cmgr-no-preview',textContent:'No Preview'}))}"></video>`;
}

function previewFallbackAttr(urls) {
    const unique = [...new Set((Array.isArray(urls) ? urls : []).map((url) => String(url || "").trim()).filter(Boolean))];
    return unique.length ? `data-fallback-srcs="${escapeAttr(JSON.stringify(unique))}"` : "";
}

function renderDetailPreviewMedia(media, label, rawUrl = "") {
    const descriptor = typeof media === "string" ? { url: media, type: "image" } : media || {};
    if (!descriptor.url) return renderUnavailablePreview(descriptor.emptyText);
    const backgroundUrl = descriptor.type === "video" && descriptor.posterUrl ? descriptor.posterUrl : descriptor.url;
    return `
        <img class="cmgr-detail-preview-bg" src="${escapeAttr(backgroundUrl)}" alt="" aria-hidden="true" decoding="async" />
        <div class="cmgr-detail-preview-overlay" aria-hidden="true"></div>
        ${renderPreview(descriptor, label, "", { instant: true, priority: "high" })}
        ${rawUrl ? `<a class="cmgr-detail-preview-open-original" href="${escapeAttr(rawUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Open original image"))}" aria-label="${escapeAttr(t("Open original image"))}"></a>` : ""}
    `;
}

function renderUnavailablePreview(text) {
    const label = String(text || t("No Preview"));
    const filteredClass = label === t("Preview hidden by content settings") ? " cmgr-filtered-preview" : "";
    return `<div class="cmgr-no-preview${filteredClass}">${escapeHtml(label)}</div>`;
}

function renderRemoteCard(model, index = 0) {
    const version = versionsFor(model)[0] || {};
    const media = remotePreviewMedia(model, version);
    const selected = String(popup.selectedRemote?.id || "") === String(model.id || "");
    const installed = findLocalForRemote(model, version);
    const preview = media.url
        ? `<span class="cmgr-media-skeleton" aria-hidden="true"></span>${renderPreview(media, model.name, "", {
            defer: true,
            priority: index < HIGH_PRIORITY_PREVIEW_LOADS ? "high" : "auto",
        })}`
        : renderUnavailablePreview(media.emptyText);
    return `
        <article class="cmgr-card cmgr-lora-card ${selected ? "selected" : ""}" data-remote-id="${escapeAttr(model.id)}">
            <div class="cmgr-thumb">${preview}</div>
            ${version.baseModel ? `<div class="cmgr-card-badge">${escapeHtml(version.baseModel)}</div>` : ""}
            <div class="cmgr-card-body">
                <div class="cmgr-card-title">${escapeHtml(model.name || "Untitled")}</div>
                <div class="cmgr-card-tags">${installed ? `<span class="installed">${escapeHtml(t("Installed"))}</span>` : ""}</div>
            </div>
        </article>
    `;
}

function renderRemoteDetail() {
    const model = popup.selectedRemote;
    if (!model) return renderEmptyDetail(t("Select a LoRA"), t("Choose a LoRA to view versions, trigger words, and apply it to this node."), "discover");
    const version = selectedVersion() || {};
    const files = filesFor(version);
    const file = selectedFile();
    const media = remotePreviewMedia(model, version);
    const raw = media.rawUrl || rawPreview(model, version);
    const local = findLocalForRemote(model, version);
    const pending = pendingForRemote(model, version);
    const words = Array.isArray(version.trainedWords) ? version.trainedWords : [];
    const stats = modelStats(model, version);
    const modelUrl = `https://civitai.red/models/${encodeURIComponent(model.id || "")}${version.id ? `?modelVersionId=${encodeURIComponent(version.id)}` : ""}`;
    return `
        <div class="cmgr-detail-scroll">
            <div class="cmgr-detail-preview cmgr-lora-detail-preview">${renderDetailPreviewMedia(media, model.name, raw)}</div>
            <div class="cmgr-detail-head">
                <div>
                    <a class="cmgr-detail-title-link" href="${escapeAttr(modelUrl)}" target="_blank" rel="noopener noreferrer"><h2>${escapeHtml(model.name || "Untitled")}</h2><span class="cmgr-external-icon" aria-hidden="true">↗</span></a>
                    <p>${escapeHtml(model.creator?.username || t("Unknown creator"))} · LoRA · ${escapeHtml(version.baseModel || "Other")}</p>
                </div>
            </div>
            <div class="cmgr-detail-stat-row">
                <span><b>↓ ${escapeHtml(formatStatCount(stats.downloadCount))}</b><small>${escapeHtml(t("Downloads"))}</small></span>
                <span><b>♥ ${escapeHtml(formatStatCount(stats.likeCount))}</b><small>${escapeHtml(t("Likes"))}</small></span>
                <span><b>${escapeHtml(version.baseModel || "Other")}</b><small>${escapeHtml(t("Base Model"))}</small></span>
            </div>
            <label class="cmgr-label">${escapeHtml(t("Version"))}</label>
            <select class="cmgr-input cmgr-full" data-field="remote-version">
                ${versionsFor(model).map((item) => `<option value="${escapeAttr(item.id)}" ${String(item.id) === String(version.id) ? "selected" : ""}>${escapeHtml(`${item.name || item.id} · ${item.baseModel || "Other"}`)}</option>`).join("")}
            </select>
            <label class="cmgr-label">${escapeHtml(t("File"))}</label>
            <select class="cmgr-input cmgr-full" data-field="remote-file">
                ${files.map((item) => `<option value="${escapeAttr(item.name || item.id)}" ${String(item.name || item.id) === String(file?.name || file?.id || "") ? "selected" : ""}>${escapeHtml(`${item.name || String(item.id)}${item.sizeKB ? ` · ${formatBytes(item.sizeKB * 1024)}` : ""}`)}</option>`).join("")}
            </select>
            <div class="cmgr-info-list cmgr-lora-file-info">
                <div><span>${escapeHtml(t("Type"))}</span><b>LoRA</b></div>
                <div><span>${escapeHtml(t("Version"))}</span><b>${escapeHtml(version.name || version.id || "—")}</b></div>
                <div><span>${escapeHtml(t("File"))}</span><b>${escapeHtml(file?.name || "—")}</b></div>
                <div><span>${escapeHtml(t("Size"))}</span><b>${escapeHtml(file?.sizeKB ? formatBytes(file.sizeKB * 1024) : "—")}</b></div>
            </div>
            <div class="cmgr-section-title">${escapeHtml(t("Trigger Words"))}</div>
            <div class="cmgr-trained">${words.length ? words.slice(0, 16).map((word) => `<button data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("") : `<span>${escapeHtml(t("No trained words listed."))}</span>`}</div>
            ${pending ? renderPendingDownload(pending.job) : ""}
            <div class="cmgr-lora-detail-actions">
                ${local
                    ? `<button class="cmgr-primary cmgr-full" data-action="apply-installed">${escapeHtml(t(isAppliedAsset(local) ? "Applied" : "Apply to Node"))}</button>`
                    : `<button class="cmgr-primary cmgr-full" data-action="download-apply" ${pending || !file ? "disabled" : ""}>${escapeHtml(t(pending ? "Downloading..." : file ? "Download and Apply" : "No downloadable file"))}</button>`}
            </div>
            <div class="cmgr-section-title">${escapeHtml(t("Description"))}</div>
            <div class="cmgr-description">${sanitizeDescriptionHtml(model.description || version.description || "")}</div>
        </div>
    `;
}

function renderEmptyDetail(title, description, kind = "model") {
    return `
        <div class="cmgr-detail-scroll cmgr-empty-detail-scroll">
            <div class="cmgr-empty-detail" data-empty-kind="${escapeAttr(kind)}">
                <div class="cmgr-empty-detail-art" aria-hidden="true">
                    <span class="cmgr-empty-detail-orbit orbit-one"></span>
                    <span class="cmgr-empty-detail-orbit orbit-two"></span>
                    <span class="cmgr-empty-detail-card card-back"></span>
                    <span class="cmgr-empty-detail-card card-front"><i></i><i></i><i></i></span>
                    <span class="cmgr-empty-detail-spark spark-one"></span>
                    <span class="cmgr-empty-detail-spark spark-two"></span>
                </div>
                <div class="cmgr-empty-detail-copy">
                    <span class="cmgr-empty-detail-kicker">${escapeHtml(t("Details"))}</span>
                    <h2>${escapeHtml(title)}</h2>
                    <p>${escapeHtml(description)}</p>
                </div>
                <div class="cmgr-empty-detail-features" aria-hidden="true"><span>${escapeHtml(t("Preview"))}</span><span>${escapeHtml(t("Metadata"))}</span><span>${escapeHtml(t("Actions"))}</span></div>
            </div>
        </div>
    `;
}

async function searchRemote(reset = true) {
    if (!reset && (popup.remoteLoading || !popup.nextCursor)) return;
    if (reset) {
        searchController?.abort();
        searchSequence += 1;
        if (!popup.remoteItems.length) {
            popup.nextCursor = "";
            popup.selectedRemote = null;
        }
    }
    const params = new URLSearchParams({
        kind: "lora",
        query: popup.discoverQuery,
        sort: popup.sort,
        limit: "40",
    });
    if (popup.selectedBaseModel) params.set("base_model", popup.selectedBaseModel);
    if (popup.selectedCategory) params.set("category", popup.selectedCategory);
    if (popup.selectedTag) params.set("tag", popup.selectedTag);
    if (!reset) params.set("cursor", popup.nextCursor);
    const path = `/search?${params.toString()}`;
    const cached = getSearchCache(path);
    if (cached) {
        popup.remoteLoading = false;
        popup.remoteResetting = false;
        const applied = applyRemoteSearch(cached, reset);
        if (!reset && appendRemoteItems(applied.items, applied.startIndex)) return;
        renderPopup({ preserveScroll: !reset });
        return;
    }

    const controller = new AbortController();
    const sequence = ++searchSequence;
    searchController = controller;
    popup.remoteLoading = true;
    popup.remoteResetting = reset;
    popup.error = "";
    if (reset || !setRemoteLoadingMore(true)) renderPopup({ preserveScroll: !reset });
    let applied = null;
    try {
        const data = await apiGet(path, { signal: controller.signal });
        if (sequence !== searchSequence) return;
        setSearchCache(path, data);
        applied = applyRemoteSearch(data, reset);
    } catch (error) {
        if (error?.name !== "AbortError" && sequence === searchSequence) popup.error = error.message;
    } finally {
        if (sequence === searchSequence) {
            popup.remoteLoading = false;
            popup.remoteResetting = false;
        }
        if (searchController === controller) searchController = null;
    }
    if (sequence !== searchSequence) return;
    if (!reset) {
        if (applied && appendRemoteItems(applied.items, applied.startIndex)) return;
        setRemoteLoadingMore(false);
        updatePopupMessages();
        return;
    }
    renderPopup({ preserveScroll: false });
}

function applyRemoteSearch(data, reset) {
    const items = Array.isArray(data?.items) ? data.items : [];
    const startIndex = reset ? 0 : popup.remoteItems.length;
    popup.remoteItems = reset ? items : [...popup.remoteItems, ...items];
    popup.contentFilterActive = data?.content_filter_active === true;
    if (reset) popup.selectedRemote = null;
    popup.nextCursor = data?.metadata?.nextCursor || "";
    return { items, startIndex };
}

async function selectRemote(model) {
    popup.selectedRemote = model;
    const version = versionsFor(model)[0] || {};
    popup.selectedVersionId = String(version.id || "");
    popup.selectedFileName = String(filesFor(version).find((item) => item.primary)?.name || filesFor(version)[0]?.name || "");
    if (!updateRemoteDetail()) renderPopup();
    try {
        const data = await apiGet(`/model-detail?id=${encodeURIComponent(model.id)}`);
        if (String(popup.selectedRemote?.id || "") !== String(model.id || "") || !data?.model) return;
        popup.selectedRemote = data.model;
        const detailVersion = versionsFor(data.model).find((item) => String(item.id) === popup.selectedVersionId) || versionsFor(data.model)[0] || {};
        popup.selectedVersionId = String(detailVersion.id || "");
        popup.selectedFileName = String(filesFor(detailVersion).find((item) => item.primary)?.name || filesFor(detailVersion)[0]?.name || "");
        if (!updateRemoteDetail()) renderPopup();
    } catch (_) {
        // Search data is sufficient when the detail request is unavailable.
    }
}

function findLocalForRemote(model, version) {
    const modelId = String(model?.id || "");
    const versionId = String(version?.id || "");
    return popup.libraryItems.find((item) => {
        if (String(item.model_id || "") !== modelId) return false;
        return !versionId || !item.version_id || String(item.version_id) === versionId;
    }) || null;
}

function pendingForRemote(model, version) {
    for (const [taskId, value] of popup.pendingApply.entries()) {
        if (String(value.modelId) === String(model?.id || "") && String(value.versionId) === String(version?.id || "")) {
            const job = popup.downloads[taskId];
            if (job && ACTIVE_DOWNLOAD_STATUSES.has(job.status)) return { taskId, value, job };
        }
    }
    return null;
}

async function downloadAndApply() {
    const model = popup.selectedRemote;
    const version = selectedVersion();
    const file = selectedFile();
    if (!model || !version || !file) return;
    popup.error = "";
    try {
        const queued = await apiPost("/download", { kind: "lora", model, version, file, overrides: {} });
        popup.pendingApply.set(queued.task_id, {
            node: popup.node,
            modelId: model.id,
            versionId: version.id,
            displayName: model.name,
            previewUrl: rawPreview(model, version),
            trainedWords: Array.isArray(version.trainedWords) ? version.trainedWords : [],
            baseModel: version.baseModel || "",
            resolution: queued.resolution || {},
        });
        popup.downloads[queued.task_id] = {
            id: queued.task_id,
            status: "pending",
            progress: 0,
            total: 0,
            root_kind: "loras",
            filename: queued.resolution?.filename || file.name,
        };
        showToast(t("Download queued; it will be applied when complete."));
        startDownloadPolling();
        renderPopup();
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

function renderLocal() {
    const selected = popup.libraryItems.find((item) => item.id === popup.selectedAssetId) || null;
    const toolbar = renderSearchToolbar({
        title: t("Local LoRAs"),
        className: "cmgr-lora-toolbar cmgr-lora-local-toolbar cmgr-local-search-toolbar",
        headingHtml: `
            <div class="cmgr-lora-local-heading">
                <h2>${escapeHtml(t("Local LoRAs"))}</h2>
                <div class="cmgr-lora-folder-context" data-lora-folder-context>${renderLocalFolderBreadcrumb()}</div>
            </div>
        `,
        searchHtml: renderToolbarSearchField({
            value: popup.localQuery,
            inputAttrs: 'data-field="local-query"',
            className: "cmgr-lora-search",
            placeholder: t("Filter local LoRAs..."),
            clearAction: "clear-lora-local-search",
        }),
        actionsHtml: `<button class="cmgr-secondary cmgr-search-submit" data-action="refresh-local-loras">${escapeHtml(t(popup.libraryLoading ? "Scanning..." : "Refresh"))}</button>`,
    });
    return `
        <section class="cmgr-page cmgr-lora-page">
            ${toolbar}
            <div class="cmgr-split has-detail cmgr-lora-split">
                <div class="cmgr-results cmgr-lora-results">
                    ${renderLocalResults()}
                </div>
                <aside class="cmgr-detail cmgr-lora-detail">${selected ? renderLocalDetail(selected) : renderEmptyDetail(t("Select a local LoRA"), t("Apply it to this node or manage its local file and Civitai metadata."), "library")}</aside>
            </div>
        </section>
    `;
}

function renderLocalResults() {
    const items = filteredLocalItems();
    if (popup.libraryLoading && !items.length) return renderSkeletons();
    if (!items.length) return `<div class="cmgr-empty">${escapeHtml(t("No local LoRAs found."))}</div>`;
    return items.map(renderLocalCard).join("");
}

function renderLocalFolderBreadcrumb() {
    const folder = normalizeLocalFolderPath(popup.selectedLocalFolder);
    const parts = folder && folder !== ROOT_LOCAL_FOLDER ? splitLocalPath(folder) : [];
    const crumbs = [{ path: "", label: t("All LoRAs") }];
    if (folder === ROOT_LOCAL_FOLDER) crumbs.push({ path: ROOT_LOCAL_FOLDER, label: t("Root files") });
    else {
        parts.forEach((part, index) => {
            crumbs.push({ path: parts.slice(0, index + 1).join("/"), label: part });
        });
    }
    return `
        <span class="cmgr-lora-folder-context-label">${escapeHtml(t("Current folder"))}</span>
        <div class="cmgr-lora-breadcrumb" aria-label="${escapeAttr(t("Current folder"))}">
            ${crumbs.map((crumb, index) => `
                ${index ? `<span class="cmgr-lora-breadcrumb-separator" aria-hidden="true">›</span>` : ""}
                <button class="${index === crumbs.length - 1 ? "active" : ""}" data-lora-folder="${escapeAttr(crumb.path)}" title="${escapeAttr(crumb.path || t("All LoRAs"))}">${escapeHtml(crumb.label)}</button>
            `).join("")}
        </div>
    `;
}

function updateLocalFolderView(options = {}) {
    if (popup.tab !== "local") return false;
    const results = popupBody?.querySelector(".cmgr-lora-results");
    const detail = popupBody?.querySelector(".cmgr-lora-detail");
    const context = popupBody?.querySelector("[data-lora-folder-context]");
    if (!results || !detail || !context) return false;
    const preserveSelection = options.preserveSelection === true && Boolean(popup.selectedAssetId);
    const scrollTop = options.preserveScroll === true ? results.scrollTop : 0;
    context.innerHTML = renderLocalFolderBreadcrumb();
    results.innerHTML = renderLocalResults();
    results.scrollTop = scrollTop;
    if (preserveSelection) updateLocalDetail();
    else {
        detail.innerHTML = renderEmptyDetail(t("Select a local LoRA"), t("Apply it to this node or manage its local file and Civitai metadata."), "library");
        delete detail.dataset.localAssetId;
    }
    bindPopupEvents();
    schedulePopupLazyPreviews();
    return true;
}

function filteredLocalItems() {
    const query = popup.localQuery.trim().toLocaleLowerCase();
    const selectedFolder = normalizeLocalFolderPath(popup.selectedLocalFolder);
    return popup.libraryItems.filter((item) => {
        if (popup.selectedBaseModel && String(item.base_model || "").toLocaleLowerCase() !== popup.selectedBaseModel.toLocaleLowerCase()) return false;
        if (selectedFolder && !assetMatchesLocalFolder(item, selectedFolder)) return false;
        if (!query) return true;
        return [item.name, item.filename, item.relative_path, item.creator, ...(item.tags || [])]
            .some((value) => String(value || "").toLocaleLowerCase().includes(query));
    });
}

function renderLocalCard(asset, index = 0) {
    return `
        <article class="cmgr-card cmgr-lora-card asset ${popup.selectedAssetId === asset.id ? "selected" : ""}" data-local-id="${escapeAttr(asset.id)}" data-preview-key="${escapeAttr(asset.thumb_url || "")}">
            <div class="cmgr-thumb">${renderPreview(asset.thumb_url, asset.name, "", { defer: index >= INITIAL_PREVIEW_LOADS, priority: index < HIGH_PRIORITY_PREVIEW_LOADS ? "high" : "auto" })}</div>
            ${asset.base_model ? `<div class="cmgr-card-badge">${escapeHtml(asset.base_model)}</div>` : ""}
            <div class="cmgr-card-body">
                <div class="cmgr-card-title">${escapeHtml(asset.name || asset.filename)}</div>
                <div class="cmgr-card-tags">
                    ${asset.favorite ? `<span class="favorite">${escapeHtml(t("Favorite"))}</span>` : ""}
                    ${isAppliedAsset(asset) ? `<span class="installed">${escapeHtml(t("Applied"))}</span>` : ""}
                </div>
            </div>
        </article>
    `;
}

function localFolderTree() {
    const root = { count: 0, rootFileCount: 0, children: new Map() };
    popup.libraryItems.forEach((item) => {
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
            if (!children.has(part)) children.set(part, { name: part, path: currentPath, count: 0, children: new Map() });
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
        .map((node) => ({ ...node, children: sortLocalFolderNodes(node.children) }))
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }));
}

function assetMatchesLocalFolder(asset, selectedFolder) {
    const folder = itemLocalFolderParts(asset).join("/");
    if (selectedFolder === ROOT_LOCAL_FOLDER) return !folder;
    return folder === selectedFolder || folder.startsWith(`${selectedFolder}/`);
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

function renderLocalDetail(asset) {
    const matched = Boolean(asset.model_id || asset.metadata_match_status === "matched");
    const civitaiUrl = asset.civitai_url || (asset.model_id ? `https://civitai.red/models/${encodeURIComponent(asset.model_id)}${asset.version_id ? `?modelVersionId=${encodeURIComponent(asset.version_id)}` : ""}` : "");
    return `
        <div class="cmgr-detail-scroll">
            <div class="cmgr-detail-preview cmgr-lora-detail-preview" data-preview-key="${escapeAttr(asset.thumb_url || "")}">${renderDetailPreviewMedia(asset.thumb_url, asset.name)}</div>
            <div class="cmgr-detail-head"><div>
                ${civitaiUrl ? `<a class="cmgr-detail-title-link" href="${escapeAttr(civitaiUrl)}" target="_blank" rel="noopener noreferrer"><h2>${escapeHtml(asset.name || asset.filename)}</h2><span class="cmgr-external-icon" aria-hidden="true">↗</span></a>` : `<h2>${escapeHtml(asset.name || asset.filename)}</h2>`}
                <p>${escapeHtml(asset.creator || t("Unknown creator"))} · ${escapeHtml(asset.base_model || "Other")} · ${formatBytes(asset.size)}</p>
            </div></div>
            <div class="cmgr-detail-match-row ${matched ? "is-matched" : ""}">
                <div><b>${escapeHtml(t(matched ? "Civitai matched" : "Civitai not matched"))}</b><span>${escapeHtml(matched ? `${asset.version_name || asset.version_id || ""}` : t("Use the model file hash to find its Civitai page and metadata."))}</span></div>
                <button class="cmgr-primary" data-action="match-local">${escapeHtml(t(matched ? "Refresh Civitai info" : "Match Civitai info"))}</button>
            </div>
            <div class="cmgr-info-list cmgr-lora-file-info">
                <div><span>${escapeHtml(t("File"))}</span><b>${escapeHtml(asset.filename || "")}</b></div>
                <div><span>${escapeHtml(t("Relative Path"))}</span><b>${escapeHtml(asset.relative_path || asset.filename)}</b></div>
                <div><span>${escapeHtml(t("Size"))}</span><b>${escapeHtml(formatBytes(asset.size))}</b></div>
                <div><span>${escapeHtml(t("Version"))}</span><b>${escapeHtml(asset.version_name || asset.version_id || "—")}</b></div>
                <div><span>${escapeHtml(t("Absolute Path"))}</span><b>${escapeHtml(asset.absolute_path || "")}</b></div>
            </div>
            <div class="cmgr-section-title">${escapeHtml(t("Trigger Words"))}</div>
            <div class="cmgr-trained">${asset.trained_words?.length ? asset.trained_words.slice(0, 16).map((word) => `<button data-copy="${escapeAttr(word)}">${escapeHtml(word)}</button>`).join("") : `<span>${escapeHtml(t("No trained words cached."))}</span>`}</div>
            <div class="cmgr-lora-detail-actions">
                <button class="cmgr-primary cmgr-full" data-action="apply-local">${escapeHtml(t(isAppliedAsset(asset) ? "Applied" : "Apply to Node"))}</button>
                ${renderFileActions({
                    favorite: asset.favorite,
                    actions: { favorite: "favorite-local", open: "open-local-folder", delete: "delete-local" },
                })}
            </div>
        </div>
    `;
}

function assetPayload(asset) {
    return {
        root_kind: "loras",
        relative_path: asset.relative_path,
        storage_root_id: asset.storage_root_id || "",
    };
}

function entryFromAsset(asset) {
    return {
        name: asset.relative_path || asset.filename,
        display_name: asset.name || asset.filename,
        storage_root_id: asset.storage_root_id || "",
        strength_model: 1,
        enabled: true,
        model_id: asset.model_id || "",
        version_id: asset.version_id || "",
        version_name: asset.version_name || "",
        preview_url: asset.thumb_url || "",
        civitai_url: asset.civitai_url || "",
        base_model: asset.base_model || "",
        trained_words: Array.isArray(asset.trained_words) ? asset.trained_words : [],
    };
}

function isAppliedAsset(asset) {
    const key = loraKey(entryFromAsset(asset));
    return normalizeLoraList(popup.node?._cmgrLoras).some((entry) => loraKey(entry) === key);
}

async function loadLibrary(force = false, shouldRender = true) {
    const previousSignature = localLibrarySignature(popup.libraryItems);
    popup.libraryLoading = true;
    if (shouldRender && overlay?.classList.contains("show")) updateLocalLibraryLoadingState();
    try {
        const data = await apiGet(`/library${force ? "?force=true" : ""}`);
        popup.libraryItems = (Array.isArray(data?.items) ? data.items : []).filter((item) => item.root_kind === "loras");
        const selectedFolder = normalizeLocalFolderPath(popup.selectedLocalFolder);
        if (selectedFolder && !popup.libraryItems.some((item) => assetMatchesLocalFolder(item, selectedFolder))) popup.selectedLocalFolder = "";
        if (popup.selectedAssetId && !popup.libraryItems.some((item) => item.id === popup.selectedAssetId)) popup.selectedAssetId = "";
    } catch (error) {
        popup.error = error.message;
    }
    popup.libraryLoading = false;
    if (!shouldRender || !overlay?.classList.contains("show")) return;
    const libraryChanged = previousSignature !== localLibrarySignature(popup.libraryItems);
    rerenderNavPreservingScroll();
    if (popup.tab !== "local") return;
    updateLocalLibraryLoadingState();
    updatePopupMessages();
    const waitingForFirstPaint = Boolean(popupBody?.querySelector(".cmgr-lora-results .cmgr-skeleton-card"));
    if (libraryChanged || waitingForFirstPaint) updateLocalFolderView({ preserveSelection: true, preserveScroll: true });
}

function localLibrarySignature(items) {
    return (Array.isArray(items) ? items : []).map((item) => [
        item.id,
        item.name,
        item.relative_path,
        item.thumb_url,
        item.base_model,
        item.metadata_match_status,
        item.model_id,
        item.version_id,
        item.favorite ? 1 : 0,
    ].join("\u001f")).join("\u001e");
}

function updateLocalLibraryLoadingState() {
    if (popup.tab !== "local") return;
    const refresh = popupBody?.querySelector('[data-action="refresh-local-loras"]');
    if (!refresh) return;
    refresh.textContent = t(popup.libraryLoading ? "Scanning..." : "Refresh");
    refresh.disabled = popup.libraryLoading;
}

async function manageSelectedAsset(action) {
    const asset = popup.libraryItems.find((item) => item.id === popup.selectedAssetId);
    if (!asset) return;
    popup.error = "";
    let deleted = false;
    const matchButton = popupBody?.querySelector('[data-action="match-local"]');
    if (action === "match" && matchButton) {
        matchButton.disabled = true;
        matchButton.textContent = t("Hashing asset...");
    }
    try {
        if (action === "apply") {
            addLoraToNode(entryFromAsset(asset));
            return;
        }
        if (action === "match") {
            showToast(t("Hashing asset..."));
            const data = await apiPost("/asset/metadata", assetPayload(asset));
            await loadLibrary(true, false);
            showToast(t(data.matched ? "Civitai metadata and preview updated" : "No Civitai match found; SHA256 saved"));
        } else if (action === "favorite") {
            await apiPost("/asset/favorite", { ...assetPayload(asset), favorite: !asset.favorite });
            await loadLibrary(false, false);
            showToast(t(asset.favorite ? "Removed favorite" : "Marked favorite"));
        } else if (action === "open") {
            await apiPost("/asset/open-folder", assetPayload(asset));
            showToast(t("Folder opened"));
        } else if (action === "delete") {
            if (!confirm(t("Delete this LoRA file and its companion metadata?"))) return;
            await apiPost("/asset/delete", assetPayload(asset));
            const next = normalizeLoraList(popup.node?._cmgrLoras).filter((entry) => loraKey(entry) !== loraKey(entryFromAsset(asset)));
            writeNodeData(popup.node, next);
            syncNodeWidgets(popup.node, next);
            popup.selectedAssetId = "";
            await loadLibrary(true, false);
            deleted = true;
            showToast(t("Asset deleted"));
        }
    } catch (error) {
        popup.error = error.message;
    }
    if (popup.tab === "local") {
        if (deleted) {
            rerenderNavPreservingScroll();
            updateLocalFolderView({ preserveScroll: true });
        } else {
            updateSelectedLocalCard();
            updateLocalDetail();
            updatePopupMessages();
        }
        return;
    }
    renderPopup();
}

function renderApplied() {
    const loras = normalizeLoraList(popup.node?._cmgrLoras);
    return `
        <section class="cmgr-page cmgr-lora-page">
            <div class="cmgr-toolbar cmgr-lora-toolbar">
                <h2>${escapeHtml(t("Applied to Node"))}</h2>
                <span class="cmgr-lora-toolbar-note">${escapeHtml(t("LoRAs run from top to bottom."))}</span>
                ${loras.length ? `<button class="cmgr-danger" data-action="clear-applied">${escapeHtml(t("Remove All"))}</button>` : ""}
            </div>
            <div class="cmgr-lora-applied-list">
                ${loras.length ? loras.map(renderAppliedItem).join("") : `<div class="cmgr-empty">${escapeHtml(t("No LoRAs applied to this node."))}</div>`}
            </div>
        </section>
    `;
}

function renderAppliedItem(entry, index) {
    return `
        <article class="cmgr-lora-applied-item ${entry.enabled ? "" : "is-disabled"}" data-applied-index="${index}">
            <div class="cmgr-lora-applied-preview">${renderPreview(entry.preview_url, entry.display_name || entry.name)}</div>
            <div class="cmgr-lora-applied-main">
                <div class="cmgr-lora-applied-head">
                    <div><b>${escapeHtml(entry.display_name || shortLoraName(entry, 60))}</b><span>${escapeHtml(entry.name)}</span></div>
                    <label class="cmgr-lora-toggle"><input type="checkbox" data-applied-enabled="${index}" ${entry.enabled ? "checked" : ""} /> ${escapeHtml(t("Enabled"))}</label>
                </div>
                <label class="cmgr-lora-strength">
                    <span>${escapeHtml(t("Model Strength"))}</span>
                    <input type="range" min="-4" max="4" step="0.05" value="${escapeAttr(entry.strength_model)}" data-applied-strength="${index}" />
                    <output>${Number(entry.strength_model).toFixed(2)}</output>
                </label>
            </div>
            <div class="cmgr-lora-order-actions">
                <button class="cmgr-secondary" data-action="move-applied-up" data-index="${index}" ${index === 0 ? "disabled" : ""} title="${escapeAttr(t("Move Up"))}">↑</button>
                <button class="cmgr-secondary" data-action="move-applied-down" data-index="${index}" ${index === normalizeLoraList(popup.node?._cmgrLoras).length - 1 ? "disabled" : ""} title="${escapeAttr(t("Move Down"))}">↓</button>
                <button class="cmgr-danger" data-action="remove-applied" data-index="${index}">${escapeHtml(t("Remove"))}</button>
            </div>
        </article>
    `;
}

function renderDownloads() {
    const jobs = loraDownloads();
    return `
        <section class="cmgr-page cmgr-lora-page">
            <div class="cmgr-toolbar cmgr-lora-toolbar">
                <h2>${escapeHtml(t("LoRA Downloads"))}</h2>
                <button class="cmgr-secondary" data-action="refresh-lora-downloads">${escapeHtml(t("Refresh"))}</button>
            </div>
            <div class="cmgr-lora-download-list">
                ${jobs.length ? jobs.map(renderDownloadJob).join("") : `<div class="cmgr-empty">${escapeHtml(t("No LoRA downloads yet."))}</div>`}
            </div>
        </section>
    `;
}

function loraDownloads() {
    return Object.values(popup.downloads || {})
        .filter((job) => job.root_kind === "loras")
        .sort((left, right) => Number(right.created_at || 0) - Number(left.created_at || 0));
}

function downloadPercent(job) {
    if (job.status === "completed") return 100;
    const total = Number(job.total || 0);
    return total > 0 ? Math.min(100, Math.round((Number(job.progress || 0) / total) * 100)) : 0;
}

function renderPendingDownload(job) {
    return `
        <div class="cmgr-lora-pending">
            <div><b>${escapeHtml(t(downloadStatusLabel(job.status)))}</b><span>${downloadPercent(job)}%</span></div>
            <div class="cmgr-progress"><div style="width:${downloadPercent(job)}%"></div><span>${downloadPercent(job)}%</span></div>
        </div>
    `;
}

function renderDownloadJob(job) {
    return `
        <article class="cmgr-lora-download-item">
            <div class="cmgr-lora-download-head"><b>${escapeHtml(job.filename || job.relative_path || "LoRA")}</b><span>${escapeHtml(t(downloadStatusLabel(job.status)))}</span></div>
            <div class="cmgr-progress"><div style="width:${downloadPercent(job)}%"></div><span>${downloadPercent(job)}%</span></div>
            <div class="cmgr-lora-download-foot">
                <span>${formatBytes(job.progress)}${job.total ? ` / ${formatBytes(job.total)}` : ""}${job.error ? ` · ${escapeHtml(job.error)}` : ""}</span>
                <div>
                    ${ACTIVE_DOWNLOAD_STATUSES.has(job.status) ? `<button class="cmgr-secondary" data-action="cancel-lora-download" data-task-id="${escapeAttr(job.id)}">${escapeHtml(t("Cancel"))}</button>` : ""}
                    ${["failed", "cancelled"].includes(job.status) ? `<button class="cmgr-primary" data-action="retry-lora-download" data-task-id="${escapeAttr(job.id)}">${escapeHtml(t("Retry Download"))}</button>` : ""}
                </div>
            </div>
        </article>
    `;
}

function downloadStatusLabel(status) {
    return ({
        pending: "Pending",
        downloading: "Downloading",
        cancelling: "Cancelling",
        completed: "Completed",
        failed: "Failed",
        cancelled: "Cancelled",
    })[status] || status || "Pending";
}

async function loadDownloads(shouldRender = true) {
    try {
        popup.downloads = await apiGet("/download-status");
    } catch (_) {
        popup.downloads = popup.downloads || {};
    }
    if (hasActiveDownloads()) startDownloadPolling();
    if (shouldRender && overlay?.classList.contains("show")) renderPopup();
}

function startDownloadPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => void pollDownloads(), 800);
}

async function pollDownloads() {
    if (pollBusy) return;
    pollBusy = true;
    try {
        popup.downloads = await apiGet("/download-status");
        for (const [taskId, pending] of [...popup.pendingApply.entries()]) {
            const job = popup.downloads[taskId];
            if (!job || !TERMINAL_DOWNLOAD_STATUSES.has(job.status)) continue;
            if (job.status === "completed") {
                popup.pendingApply.delete(taskId);
                await finishPendingApply(job, pending);
            } else if (job.status === "failed" && !pending.failureNotified) {
                pending.failureNotified = true;
                popup.error = job.error || t("Download failed.");
            }
        }
        const active = hasActiveDownloads();
        if (!active && pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        if (overlay?.classList.contains("show") && (popup.tab === "downloads" || popup.selectedRemote)) renderPopup();
    } catch (_) {
        // Keep the existing state and retry on the next poll.
    } finally {
        pollBusy = false;
    }
}

async function finishPendingApply(job, pending) {
    await loadLibrary(true, false);
    const normalizedTarget = String(job.target_path || "").replaceAll("\\", "/").toLocaleLowerCase();
    const asset = popup.libraryItems.find((item) => String(item.absolute_path || "").replaceAll("\\", "/").toLocaleLowerCase() === normalizedTarget)
        || popup.libraryItems.find((item) => String(item.model_id || "") === String(pending.modelId) && String(item.version_id || "") === String(pending.versionId))
        || popup.libraryItems.find((item) => String(item.relative_path || "").toLocaleLowerCase() === String(job.relative_path || "").toLocaleLowerCase());
    if (!asset) {
        popup.error = t("Download completed, but the LoRA was not found in the refreshed local library.");
        return;
    }
    addLoraToTargetNode(pending.node || popup.node, {
        ...entryFromAsset(asset),
        display_name: pending.displayName || asset.name,
        preview_url: asset.thumb_url || pending.previewUrl || "",
        trained_words: asset.trained_words?.length ? asset.trained_words : pending.trainedWords,
        base_model: asset.base_model || pending.baseModel || "",
    }, false);
    showToast(t("Download completed and LoRA applied."));
}

function hasActiveDownloads() {
    return loraDownloads().some((job) => ACTIVE_DOWNLOAD_STATUSES.has(job.status))
        || [...popup.pendingApply.keys()].some((taskId) => ACTIVE_DOWNLOAD_STATUSES.has(popup.downloads[taskId]?.status || ""));
}

async function cancelDownload(taskId) {
    try {
        await apiPost("/download/cancel", { task_id: taskId });
        await loadDownloads(true);
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

async function retryDownload(taskId) {
    try {
        const pending = popup.pendingApply.get(taskId);
        const data = await apiPost("/download/retry", { task_id: taskId });
        if (pending) {
            popup.pendingApply.delete(taskId);
            popup.pendingApply.set(data.task_id, pending);
        }
        await loadDownloads(true);
    } catch (error) {
        popup.error = error.message;
        renderPopup();
    }
}

function bindPopupEvents() {
    bindLocalFolderControls(popupBody);
    popupBody?.querySelectorAll("[data-remote-id]").forEach((card) => {
        card.onclick = () => {
            const model = popup.remoteItems.find((item) => String(item.id) === String(card.dataset.remoteId));
            if (model) void selectRemote(model);
        };
    });
    popupBody?.querySelectorAll("[data-local-id]").forEach((card) => {
        card.onclick = () => {
            popup.selectedAssetId = card.dataset.localId;
            if (!updateLocalDetail()) renderPopup();
        };
    });

    const remoteQuery = popupBody?.querySelector('[data-field="remote-query"]');
    const clearSearch = popupBody?.querySelector('[data-action="clear-lora-search"]');
    if (remoteQuery) {
        remoteQuery.oninput = () => {
            popup.discoverQuery = remoteQuery.value;
            if (clearSearch) clearSearch.hidden = !popup.discoverQuery;
        };
        remoteQuery.onkeydown = (event) => { if (event.key === "Enter") void searchRemote(true); };
    }
    const remoteSort = popupBody?.querySelector('[data-field="remote-sort"]');
    if (remoteSort) remoteSort.onchange = () => { popup.sort = remoteSort.value; void searchRemote(true); };
    const search = popupBody?.querySelector('[data-action="search-loras"]');
    if (search) search.onclick = () => void searchRemote(true);
    if (clearSearch) clearSearch.onclick = () => {
        popup.discoverQuery = "";
        if (remoteQuery) remoteQuery.value = "";
        clearSearch.hidden = true;
        void searchRemote(true);
    };

    const version = popupBody?.querySelector('[data-field="remote-version"]');
    if (version) version.onchange = () => {
        popup.selectedVersionId = version.value;
        const nextVersion = selectedVersion();
        popup.selectedFileName = String(filesFor(nextVersion).find((item) => item.primary)?.name || filesFor(nextVersion)[0]?.name || "");
        if (!updateRemoteDetail()) renderPopup();
    };
    const file = popupBody?.querySelector('[data-field="remote-file"]');
    if (file) file.onchange = () => { popup.selectedFileName = file.value; };
    const installed = popupBody?.querySelector('[data-action="apply-installed"]');
    if (installed) installed.onclick = () => {
        const asset = findLocalForRemote(popup.selectedRemote, selectedVersion());
        if (asset) addLoraToNode(entryFromAsset(asset));
    };
    const download = popupBody?.querySelector('[data-action="download-apply"]');
    if (download) download.onclick = () => void downloadAndApply();
    popupBody?.querySelectorAll("[data-copy]").forEach((button) => {
        button.onclick = async () => {
            try {
                await navigator.clipboard.writeText(button.dataset.copy || "");
                showToast(t("Copied"));
            } catch (_) {
                showToast(t("Copy failed"));
            }
        };
    });

    const updateLocalSearchResults = () => {
        const results = popupBody?.querySelector(".cmgr-lora-results");
        if (!results) return;
        results.innerHTML = renderLocalResults();
        results.querySelectorAll("[data-local-id]").forEach((card) => {
            card.onclick = () => {
                popup.selectedAssetId = card.dataset.localId;
                if (!updateLocalDetail()) renderPopup();
            };
        });
        schedulePopupLazyPreviews();
    };
    const localQuery = popupBody?.querySelector('[data-field="local-query"]');
    const clearLocalQuery = popupBody?.querySelector('[data-action="clear-lora-local-search"]');
    if (localQuery) localQuery.oninput = () => {
        popup.localQuery = localQuery.value;
        if (clearLocalQuery) clearLocalQuery.hidden = !popup.localQuery;
        updateLocalSearchResults();
    };
    if (clearLocalQuery) clearLocalQuery.onclick = () => {
        popup.localQuery = "";
        if (localQuery) {
            localQuery.value = "";
            localQuery.focus();
        }
        clearLocalQuery.hidden = true;
        updateLocalSearchResults();
    };
    const refreshLocal = popupBody?.querySelector('[data-action="refresh-local-loras"]');
    if (refreshLocal) refreshLocal.onclick = () => void loadLibrary(true);
    const localActions = {
        "apply-local": "apply",
        "match-local": "match",
        "favorite-local": "favorite",
        "open-local-folder": "open",
        "delete-local": "delete",
    };
    Object.entries(localActions).forEach(([selector, action]) => {
        const button = popupBody?.querySelector(`[data-action="${selector}"]`);
        if (button) button.onclick = () => void manageSelectedAsset(action);
    });

    popupBody?.querySelectorAll("[data-applied-enabled]").forEach((input) => {
        input.onchange = () => {
            const index = Number(input.dataset.appliedEnabled);
            const next = normalizeLoraList(popup.node?._cmgrLoras);
            if (!next[index]) return;
            next[index].enabled = input.checked;
            writeNodeData(popup.node, next);
            syncNodeWidgets(popup.node, next);
            renderPopup();
        };
    });
    popupBody?.querySelectorAll("[data-applied-strength]").forEach((input) => {
        input.oninput = () => {
            const index = Number(input.dataset.appliedStrength);
            const next = normalizeLoraList(popup.node?._cmgrLoras);
            if (!next[index]) return;
            next[index].strength_model = Number(input.value);
            writeNodeData(popup.node, next);
            const output = input.parentElement?.querySelector("output");
            if (output) output.value = Number(input.value).toFixed(2);
        };
        input.onchange = () => syncNodeWidgets(popup.node, popup.node?._cmgrLoras || []);
    });
    popupBody?.querySelectorAll('[data-action="move-applied-up"]').forEach((button) => { button.onclick = () => updateLoraOrder(Number(button.dataset.index), -1); });
    popupBody?.querySelectorAll('[data-action="move-applied-down"]').forEach((button) => { button.onclick = () => updateLoraOrder(Number(button.dataset.index), 1); });
    popupBody?.querySelectorAll('[data-action="remove-applied"]').forEach((button) => { button.onclick = () => removeLoraFromNode(Number(button.dataset.index)); });
    const clearApplied = popupBody?.querySelector('[data-action="clear-applied"]');
    if (clearApplied) clearApplied.onclick = () => {
        if (!confirm(t("Remove all LoRAs from this node?"))) return;
        writeNodeData(popup.node, []);
        syncNodeWidgets(popup.node, []);
        renderPopup();
    };

    const refreshDownloads = popupBody?.querySelector('[data-action="refresh-lora-downloads"]');
    if (refreshDownloads) refreshDownloads.onclick = () => void loadDownloads(true);
    popupBody?.querySelectorAll('[data-action="cancel-lora-download"]').forEach((button) => { button.onclick = () => void cancelDownload(button.dataset.taskId); });
    popupBody?.querySelectorAll('[data-action="retry-lora-download"]').forEach((button) => { button.onclick = () => void retryDownload(button.dataset.taskId); });
}

function showToast(message) {
    popup.toast = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        popup.toast = "";
        if (overlay?.classList.contains("show") && !updatePopupMessages()) renderPopup();
    }, 2600);
    if (overlay?.classList.contains("show") && !updatePopupMessages()) renderPopup();
}

function formatBytes(value) {
    const size = Number(value || 0);
    if (!size) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(units.length - 1, Math.floor(Math.log(size) / Math.log(1024)));
    return `${(size / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function readStatValue(source, keys) {
    if (!source || typeof source !== "object") return 0;
    for (const key of keys) {
        const value = Number(source[key]);
        if (Number.isFinite(value) && value > 0) return value;
    }
    return 0;
}

function modelStats(model, version = {}) {
    const downloadKeys = ["downloadCount", "downloads", "download_count"];
    const likeKeys = ["thumbsUpCount", "likeCount", "likes", "favoriteCount", "favorites", "collectedCount"];
    const modelStatsValue = model?.stats || model?.metrics || {};
    const versionStatsValue = version?.stats || version?.metrics || {};
    return {
        downloadCount: readStatValue(modelStatsValue, downloadKeys) || readStatValue(versionStatsValue, downloadKeys) || readStatValue(model, downloadKeys),
        likeCount: readStatValue(modelStatsValue, likeKeys) || readStatValue(versionStatsValue, likeKeys) || readStatValue(model, likeKeys),
    };
}

function formatStatCount(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number) || number <= 0) return "0";
    if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1)}m`;
    if (number >= 1_000) return `${(number / 1_000).toFixed(number >= 10_000 ? 0 : 1)}k`;
    return String(Math.round(number));
}

function sanitizeDescriptionHtml(html) {
    const raw = String(html || "").trim();
    if (!raw) return `<span class="cmgr-muted">${escapeHtml(t("No description available."))}</span>`;
    const allowed = new Set(["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "pre", "code", "blockquote", "h1", "h2", "h3", "h4"]);
    const template = document.createElement("template");
    template.innerHTML = raw.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
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
            return safeHref ? `<a href="${escapeAttr(safeHref)}" target="_blank" rel="noopener noreferrer">${children || escapeHtml(safeHref)}</a>` : children;
        }
        return `<${tag}>${children}</${tag}>`;
    };
    const cleaned = Array.from(template.content.childNodes).map(renderNode).join("").trim();
    if (cleaned) return cleaned;
    const text = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text ? `<p>${escapeHtml(text)}</p>` : `<span class="cmgr-muted">${escapeHtml(t("No description available."))}</span>`;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function escapeAttr(value) {
    return escapeHtml(value);
}
