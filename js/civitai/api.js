import {
    API,
    SEARCH_CACHE_KEY,
    SEARCH_CACHE_LIMIT,
    SEARCH_CACHE_TTL,
    SEARCH_CACHE_VERSION,
} from "./constants.js";

export async function apiGet(path) {
    const response = await fetch(`${API}${path}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

export async function apiPost(path, body) {
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

export function getSearchCache(path) {
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

export function setSearchCache(path, data) {
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

export function clearSearchCache() {
    try {
        localStorage.removeItem(SEARCH_CACHE_KEY);
    } catch (_) {}
}
