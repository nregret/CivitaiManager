import { t } from "./i18n.js";

export const PROMO_LINKS = Object.freeze({
    github: "https://github.com/nregret/CivitaiManager",
    afdian: "https://www.ifdian.net/a/nnegret?utm_source=copylink&utm_medium=link",
});

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

function githubIcon() {
    return `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.72.5.1.68-.22.68-.49v-1.88c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.98c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.8c0 .27.18.59.69.49A10.13 10.13 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z"/>
        </svg>
    `;
}

export function renderPromoLinks() {
    return `
        <div class="cmgr-promo-links" aria-label="${escapeAttr(t("Project Links"))}">
            <a class="cmgr-promo-link cmgr-promo-github" href="${escapeAttr(PROMO_LINKS.github)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Open GitHub"))}" aria-label="${escapeAttr(t("Open GitHub"))}">
                ${githubIcon()}
            </a>
            <a class="cmgr-promo-link cmgr-promo-afdian" href="${escapeAttr(PROMO_LINKS.afdian)}" target="_blank" rel="noopener noreferrer" title="${escapeAttr(t("Support on Afdian"))}" aria-label="${escapeAttr(t("Support on Afdian"))}">
                <span>爱发电</span>
            </a>
        </div>
    `;
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
                ${options.showFavorite === false ? "" : `<button class="cmgr-file-action ${favorite ? "is-active" : ""}" data-action="${escapeAttr(actions.favorite || "favorite-asset")}">
                    <i class="cmgr-file-action-icon is-favorite" aria-hidden="true">★</i>
                    <span><b>${escapeHtml(t(favorite ? "Unfavorite" : "Favorite"))}</b><small>${escapeHtml(t(favorite ? "Remove from favorites" : "Keep this asset easy to find"))}</small></span>
                </button>`}
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

export function renderFavoriteControls(options = {}) {
    const favorite = options.favorite === true;
    const folders = Array.isArray(options.folders) ? options.folders : [];
    const folderId = String(options.folderId || "");
    const toggleAction = String(options.toggleAction || "toggle-favorite");
    const folderAction = String(options.folderAction || "assign-favorite-folder");
    return `
        <section class="cmgr-favorite-controls ${favorite ? "is-active" : ""}" aria-label="${escapeAttr(t("Favorite"))}">
            <button class="cmgr-favorite-toggle ${favorite ? "is-active" : ""}" data-action="${escapeAttr(toggleAction)}" type="button" title="${escapeAttr(t(favorite ? "Unfavorite" : "Favorite"))}">
                <span class="cmgr-favorite-toggle-star" aria-hidden="true">${favorite ? "★" : "☆"}</span>
                <span class="cmgr-favorite-toggle-copy">
                    <b>${escapeHtml(t(favorite ? "Favorited" : "Favorite"))}</b>
                    <small>${escapeHtml(t(favorite ? "Click to remove from favorites" : "Save for later without downloading"))}</small>
                </span>
            </button>
            ${favorite ? `
                <label class="cmgr-favorite-folder-select">
                    <span>${escapeHtml(t("Favorite Folder"))}</span>
                    <select class="cmgr-input" data-action="${escapeAttr(folderAction)}">
                        <option value="" ${folderId ? "" : "selected"}>${escapeHtml(t("No folder"))}</option>
                        ${folders.map((folder) => `<option value="${escapeAttr(folder.id)}" ${folderId === String(folder.id) ? "selected" : ""}>${escapeHtml(folder.name)}</option>`).join("")}
                    </select>
                </label>
            ` : `<span class="cmgr-favorite-hint">${escapeHtml(t("Remote models can be favorited before downloading."))}</span>`}
        </section>
    `;
}

export function renderFavoriteCardMark(favorite) {
    return favorite
        ? `<span class="cmgr-card-favorite-mark" title="${escapeAttr(t("Favorited"))}" aria-label="${escapeAttr(t("Favorited"))}"><span aria-hidden="true">★</span>${escapeHtml(t("Favorite"))}</span>`
        : "";
}

export function syncFavoriteCardMark(card, favorite) {
    if (!card) return false;
    const current = [...card.children].find((child) => child.classList?.contains("cmgr-card-favorite-mark"));
    if (!favorite) {
        current?.remove();
        return true;
    }
    if (!current) card.insertAdjacentHTML("afterbegin", renderFavoriteCardMark(true));
    return true;
}

export function renderFavoriteFolderSidebar(options = {}) {
    const folders = Array.isArray(options.folders) ? options.folders : [];
    const items = Array.isArray(options.items) ? options.items : [];
    const selectedId = String(options.selectedId || "");
    const editor = options.editor && typeof options.editor === "object" ? options.editor : null;
    const countFor = (folderId) => items.filter((item) => String(item?.folder_id || "") === folderId).length;
    return `
        <div class="cmgr-nav-group cmgr-favorite-folder-group">
            <div class="cmgr-favorite-folder-head">
                <div class="cmgr-nav-title">${escapeHtml(t("Local Favorites"))}</div>
                <button class="cmgr-favorite-folder-add" data-favorite-folder-add type="button" title="${escapeAttr(t("New Favorite Folder"))}" aria-label="${escapeAttr(t("New Favorite Folder"))}">＋</button>
            </div>
            ${editor ? `
                <div class="cmgr-favorite-folder-editor" data-favorite-folder-editor data-mode="${escapeAttr(editor.mode || "create")}" data-folder-id="${escapeAttr(editor.id || "")}">
                    <input class="cmgr-input" data-favorite-folder-name value="${escapeAttr(editor.value || "")}" placeholder="${escapeAttr(t(editor.mode === "rename" ? "Rename Favorite Folder" : "New Favorite Folder"))}" maxlength="80" autocomplete="off" />
                    <button data-favorite-folder-save type="button" title="${escapeAttr(t("Save"))}">✓</button>
                    <button data-favorite-folder-cancel type="button" title="${escapeAttr(t("Cancel"))}">×</button>
                </div>
            ` : ""}
            <button class="cmgr-nav-btn ${selectedId ? "" : "active"}" data-favorite-folder="">
                <span>${escapeHtml(t("All Favorites"))}</span><b>${items.length}</b>
            </button>
            <div class="cmgr-favorite-folder-list">
                ${folders.map((folder) => `
                    <div class="cmgr-favorite-folder-row">
                        <button class="cmgr-nav-btn ${selectedId === String(folder.id) ? "active" : ""}" data-favorite-folder="${escapeAttr(folder.id)}" title="${escapeAttr(folder.name)}">
                            <span>${escapeHtml(folder.name)}</span><b>${countFor(String(folder.id))}</b>
                        </button>
                        <div class="cmgr-favorite-folder-actions">
                            <button data-favorite-folder-rename="${escapeAttr(folder.id)}" data-folder-name="${escapeAttr(folder.name)}" type="button" title="${escapeAttr(t("Rename"))}" aria-label="${escapeAttr(t("Rename"))}">✎</button>
                            <button data-favorite-folder-delete="${escapeAttr(folder.id)}" type="button" title="${escapeAttr(t("Delete"))}" aria-label="${escapeAttr(t("Delete"))}">×</button>
                        </div>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

export function bindFavoriteFolderSidebar(root, callbacks = {}) {
    if (!root) return;
    root.querySelectorAll("[data-favorite-folder]").forEach((button) => {
        button.onclick = () => callbacks.onSelect?.(button.dataset.favoriteFolder || "");
    });
    const add = root.querySelector("[data-favorite-folder-add]");
    if (add) add.onclick = () => callbacks.onEdit?.({ mode: "create", id: "", value: "" });
    root.querySelectorAll("[data-favorite-folder-rename]").forEach((button) => {
        button.onclick = (event) => {
            event.stopPropagation();
            callbacks.onEdit?.({
                mode: "rename",
                id: button.dataset.favoriteFolderRename || "",
                value: button.dataset.folderName || "",
            });
        };
    });
    root.querySelectorAll("[data-favorite-folder-delete]").forEach((button) => {
        button.onclick = (event) => {
            event.stopPropagation();
            callbacks.onDelete?.(button.dataset.favoriteFolderDelete || "");
        };
    });
    const editor = root.querySelector("[data-favorite-folder-editor]");
    const input = editor?.querySelector("[data-favorite-folder-name]");
    const save = editor?.querySelector("[data-favorite-folder-save]");
    const cancel = editor?.querySelector("[data-favorite-folder-cancel]");
    const submit = () => callbacks.onSave?.({
        mode: editor?.dataset.mode || "create",
        id: editor?.dataset.folderId || "",
        value: input?.value || "",
    });
    if (save) save.onclick = submit;
    if (cancel) cancel.onclick = () => callbacks.onEdit?.(null);
    if (input) {
        input.onkeydown = (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                submit();
            } else if (event.key === "Escape") {
                event.preventDefault();
                callbacks.onEdit?.(null);
            }
        };
        requestAnimationFrame(() => {
            input.focus({ preventScroll: true });
            input.select();
        });
    }
}
