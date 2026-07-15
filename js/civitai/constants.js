export const API = "/civitai-manager/api";
export const SEARCH_CACHE_KEY = "cmgr-civitai-search-cache";
export const SEARCH_CACHE_VERSION = "v7-base-query-fallback";
export const SEARCH_CACHE_TTL = 24 * 60 * 60 * 1000;
export const SEARCH_CACHE_LIMIT = 80;
export const INITIAL_PREVIEW_LOADS = 8;
export const HIGH_PRIORITY_PREVIEW_LOADS = 4;
export const DETAIL_PREVIEW_LIMIT = 12;
export const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export const TABS = ["Discover", "Library", "Downloads", "Settings"];

export const ASSET_KINDS = [
    { id: "checkpoint", label: "Checkpoint/UNet", rootKinds: ["checkpoints", "unet"] },
    { id: "lora", label: "LoRA" },
    { id: "workflow", label: "Workflow" },
];

export const CIVITAI_CATEGORY_FILTERS = [
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

export const ROOT_KINDS = [
    { id: "checkpoints", label: "Checkpoints" },
    { id: "unet", label: "UNet" },
    { id: "loras", label: "LoRA" },
    { id: "workflows", label: "Workflows" },
];

export const ROOT_LOCAL_FOLDER = "__cmgr_root_files__";
