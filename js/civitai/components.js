import { t } from "./i18n.js";

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

export function ensureNotificationHost(shell) {
    if (!shell) return null;
    let host = shell.querySelector(":scope > .cmgr-notification-host");
    if (host) return host;
    host = document.createElement("div");
    host.className = "cmgr-notification-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-atomic", "true");
    const topbar = shell.querySelector(":scope > .cmgr-topbar");
    if (topbar) topbar.insertAdjacentElement("afterend", host);
    else shell.prepend(host);
    return host;
}

export function updateNotificationHost(host, options = {}) {
    if (!host) return false;
    const error = String(options.error || "").trim();
    const toast = String(options.toast || "").trim();
    host.innerHTML = `
        ${error ? `
            <div class="cmgr-notice cmgr-error" role="alert">
                <i class="cmgr-notice-icon" aria-hidden="true">!</i>
                <span>${escapeHtml(error)}</span>
                ${typeof options.onDismissError === "function" ? `<button class="cmgr-notice-dismiss" type="button" aria-label="${escapeAttr(t("Dismiss"))}">×</button>` : ""}
            </div>
        ` : ""}
        ${toast ? `
            <div class="cmgr-notice cmgr-toast" role="status">
                <i class="cmgr-notice-icon" aria-hidden="true">i</i>
                <span>${escapeHtml(toast)}</span>
            </div>
        ` : ""}
    `;
    const dismiss = host.querySelector(".cmgr-notice-dismiss");
    if (dismiss) dismiss.onclick = options.onDismissError;
    return true;
}

export function renderToolbarSearchField(options = {}) {
    const value = String(options.value || "");
    const inputAttrs = options.inputAttrs ? ` ${String(options.inputAttrs).trim()}` : "";
    const inputClass = String(options.className || "").replace(/[^a-z0-9_-]+/gi, " ").trim();
    const clearAction = String(options.clearAction || "clear-search");
    return `
        <div class="cmgr-search-wrap">
            <span class="cmgr-search-mark" aria-hidden="true"></span>
            <input class="cmgr-input cmgr-search${inputClass ? ` ${escapeAttr(inputClass)}` : ""}"${inputAttrs} value="${escapeAttr(value)}" placeholder="${escapeAttr(options.placeholder || t("Search"))}" autocomplete="off" />
            <button class="cmgr-search-clear" type="button" data-action="${escapeAttr(clearAction)}" title="${escapeAttr(t("Clear search"))}" aria-label="${escapeAttr(t("Clear search"))}" ${value ? "" : "hidden"}>×</button>
        </div>
    `;
}

export function renderSearchToolbar(options = {}) {
    const title = String(options.title || "");
    const subtitle = String(options.subtitle || "");
    const headingHtml = options.headingHtml == null ? "" : String(options.headingHtml);
    const className = String(options.className || "").replace(/[^a-z0-9_-]+/gi, " ").trim();
    return `
        <div class="cmgr-toolbar cmgr-search-toolbar${className ? ` ${escapeAttr(className)}` : ""}">
            <div class="cmgr-search-toolbar-main">
                <div class="cmgr-search-toolbar-heading" title="${escapeAttr([title, subtitle].filter(Boolean).join(" · "))}">
                    ${headingHtml || `
                        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
                        <h2>${escapeHtml(title)}</h2>
                    `}
                </div>
                ${String(options.searchHtml || "")}
            </div>
            <div class="cmgr-search-toolbar-actions">${String(options.actionsHtml || "")}</div>
        </div>
    `;
}

export function renderSearchCombo(options = {}) {
    const id = String(options.id || "combo");
    const value = String(options.value || "").trim();
    const items = (Array.isArray(options.items) ? options.items : [])
        .map((item) => String(item?.name || item || "").trim())
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

export function bindSearchCombo(combo, applyValue) {
    if (!combo || typeof applyValue !== "function") return;
    const toggle = combo.querySelector("[data-combo-toggle]");
    const searchInput = combo.querySelector("[data-combo-search]");
    const options = Array.from(combo.querySelectorAll("[data-combo-option]"));
    const empty = combo.querySelector("[data-combo-empty]");
    let activeIndex = Math.max(0, options.findIndex((option) => option.classList.contains("active")));

    const visibleOptions = () => options.filter((option) => !option.hidden);
    const positionPopover = () => {
        const bounds = (combo.closest(".cmgr-nav") || document.documentElement).getBoundingClientRect();
        const rect = combo.getBoundingClientRect();
        const spaceAbove = Math.max(0, rect.top - bounds.top - 8);
        const spaceBelow = Math.max(0, bounds.bottom - rect.bottom - 8);
        const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
        const available = Math.max(120, Math.floor(openUp ? spaceAbove : spaceBelow));
        combo.classList.toggle("open-up", openUp);
        combo.style.setProperty("--cmgr-combo-available-height", `${available}px`);
    };
    const setOpen = (open) => {
        if (open) {
            document.querySelectorAll(".cmgr-combo.open").forEach((item) => {
                if (item !== combo) {
                    item.classList.remove("open");
                    item.querySelector("[data-combo-toggle]")?.setAttribute("aria-expanded", "false");
                }
            });
            positionPopover();
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

export function renderFileActions(options = {}) {
    const actions = options.actions || {};
    const favorite = options.favorite === true;
    return `
        <section class="cmgr-file-actions" aria-label="${escapeAttr(t("File Actions"))}">
            <div class="cmgr-section-title cmgr-file-actions-title">${escapeHtml(t("File Actions"))}</div>
            <div class="cmgr-file-action-grid">
                <button class="cmgr-file-action ${favorite ? "is-active" : ""}" data-action="${escapeAttr(actions.favorite || "favorite-asset")}">
                    <i class="cmgr-file-action-icon is-favorite" aria-hidden="true">★</i>
                    <span><b>${escapeHtml(t(favorite ? "Unfavorite" : "Favorite"))}</b><small>${escapeHtml(t(favorite ? "Remove from favorites" : "Keep this asset easy to find"))}</small></span>
                </button>
                <button class="cmgr-file-action" data-action="${escapeAttr(actions.open || "open-folder")}">
                    <i class="cmgr-file-action-icon is-folder" aria-hidden="true"></i>
                    <span><b>${escapeHtml(t("Open Folder"))}</b><small>${escapeHtml(t("Show in File Explorer"))}</small></span>
                </button>
            </div>
            <div class="cmgr-file-danger-row">
                <span><b>${escapeHtml(t("Delete local file"))}</b><small>${escapeHtml(t("Also removes companion metadata"))}</small></span>
                <button class="cmgr-danger" data-action="${escapeAttr(actions.delete || "delete-asset")}">${escapeHtml(t("Delete"))}</button>
            </div>
        </section>
    `;
}
