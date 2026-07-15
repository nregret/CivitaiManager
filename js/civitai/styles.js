export function injectStyles() {
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
            position: relative;
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
            grid-auto-rows: max-content !important;
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
        .cmgr-library-toolbar-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-left: auto;
        }
        .cmgr-library-match-status {
            flex: 1 0 100%;
            display: grid;
            grid-template-columns: minmax(140px, 240px) auto minmax(0, 1fr);
            align-items: center;
            gap: 10px;
            min-width: 0;
            color: var(--cmgr-muted);
            font-size: 12px;
        }
        .cmgr-library-match-status > span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-library-match-progress {
            height: 7px;
            overflow: hidden;
            border-radius: 999px;
            background: color-mix(in srgb, var(--cmgr-muted) 18%, transparent);
        }
        .cmgr-library-match-progress span {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: var(--cmgr-good);
            transition: width 0.2s ease;
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
            max-height: min(360px, var(--cmgr-combo-available-height, calc(100vh - 180px)));
            min-width: 100%;
        }
        .cmgr-combo.open-up .cmgr-combo-popover {
            top: auto;
            bottom: calc(100% + 6px);
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
            max-height: min(270px, calc(var(--cmgr-combo-available-height, calc(100vh - 180px)) - 56px));
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
            min-height: auto;
            aspect-ratio: 2 / 3 !important;
            align-self: start;
            overflow: hidden;
            contain: paint;
        }
        .cmgr-card::before {
            content: "";
            display: none !important;
            width: 100%;
            padding-top: 0 !important;
            pointer-events: none;
        }
        .cmgr-card-spacer {
            display: none !important;
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
        .cmgr-skeleton-card,
        .cmgr-skeleton-card:hover {
            cursor: progress;
            pointer-events: none;
            background: var(--cmgr-panel-soft);
            border-color: var(--cmgr-border);
            box-shadow: none;
        }
        .cmgr-skeleton-card::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 8;
            pointer-events: none;
            background: linear-gradient(
                105deg,
                transparent 24%,
                color-mix(in srgb, var(--cmgr-text) 11%, transparent) 43%,
                transparent 62%
            );
            transform: translateX(-115%);
            animation: cmgrSkeletonShimmer 1.35s ease-in-out infinite;
        }
        .cmgr-skeleton-media {
            position: absolute;
            inset: 2px;
            z-index: 0;
            border-radius: calc(var(--cmgr-radius) - 2px);
            background: color-mix(in srgb, var(--cmgr-panel-soft) 90%, var(--cmgr-text) 10%);
        }
        .cmgr-skeleton-badge,
        .cmgr-skeleton-line,
        .cmgr-skeleton-stats span {
            background: color-mix(in srgb, var(--cmgr-panel-soft) 74%, var(--cmgr-text) 26%);
        }
        .cmgr-skeleton-badge {
            position: absolute;
            top: 11px;
            left: 11px;
            z-index: 2;
            width: 34%;
            height: 22px;
            border-radius: 999px;
        }
        .cmgr-skeleton-content {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 2;
            display: grid;
            gap: 10px;
            padding: 48px 12px 13px;
            background: linear-gradient(to top, color-mix(in srgb, var(--cmgr-panel) 94%, transparent), transparent);
        }
        .cmgr-skeleton-line {
            width: 82%;
            height: 13px;
            border-radius: 999px;
        }
        .cmgr-skeleton-line.is-medium {
            width: 68%;
        }
        .cmgr-skeleton-line.is-short {
            width: 54%;
        }
        .cmgr-skeleton-stats {
            display: flex;
            gap: 7px;
        }
        .cmgr-skeleton-stats span {
            width: 52px;
            height: 19px;
            border-radius: 999px;
        }
        .cmgr-skeleton-stats span:last-child {
            width: 44px;
        }
        @keyframes cmgrSkeletonShimmer {
            0% { transform: translateX(-115%); }
            65%, 100% { transform: translateX(115%); }
        }
        .cmgr-media-skeleton {
            position: absolute;
            inset: 0;
            z-index: 1;
            overflow: hidden;
            background: color-mix(in srgb, var(--cmgr-panel-soft) 86%, var(--cmgr-text) 14%);
            opacity: 1;
            pointer-events: none;
            transition: opacity 0.18s ease;
        }
        .cmgr-media-skeleton::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
                105deg,
                transparent 22%,
                color-mix(in srgb, var(--cmgr-text) 15%, transparent) 44%,
                transparent 66%
            );
            transform: translateX(-115%);
            animation: cmgrSkeletonShimmer 1.35s ease-in-out infinite;
        }
        .cmgr-thumb:has(.cmgr-preview-img.is-loaded) .cmgr-media-skeleton,
        .cmgr-thumb:has(.cmgr-no-image) .cmgr-media-skeleton,
        .cmgr-thumb:has(.cmgr-no-preview) .cmgr-media-skeleton {
            opacity: 0;
        }
        .cmgr-filtered-preview {
            box-sizing: border-box;
            padding: 24px;
            color: color-mix(in srgb, var(--cmgr-muted) 88%, var(--cmgr-text) 12%);
            font-size: 13px;
            font-weight: 720;
            line-height: 1.55;
            text-align: center;
        }
        @media (prefers-reduced-motion: reduce) {
            .cmgr-skeleton-card::after,
            .cmgr-media-skeleton::after {
                animation: none;
                transform: none;
                opacity: 0.45;
            }
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
        .cmgr-detail-match-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin: 0 0 14px;
            padding: 12px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-panel-soft);
        }
        .cmgr-detail-match-row.is-matched {
            border-color: color-mix(in srgb, var(--cmgr-good) 42%, var(--cmgr-border));
        }
        .cmgr-detail-match-row > div {
            min-width: 0;
            display: grid;
            gap: 3px;
        }
        .cmgr-detail-match-row b {
            color: var(--cmgr-text);
        }
        .cmgr-detail-match-row span {
            color: var(--cmgr-muted);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-detail-match-row .cmgr-primary {
            flex: 0 0 auto;
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
        .cmgr-detail-preview-open-original {
            position: absolute;
            inset: 0;
            z-index: 6;
            display: block;
            cursor: zoom-in;
        }
        .cmgr-detail-preview-open-original:focus-visible {
            outline: 2px solid var(--cmgr-info);
            outline-offset: -3px;
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
        .cmgr-download-head b.cancelled {
            color: var(--cmgr-muted);
        }
        .cmgr-download-head b.cancelling {
            color: var(--cmgr-warning);
        }
        .cmgr-download > .cmgr-action-row {
            margin-top: 10px;
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
                min-height: auto;
                aspect-ratio: 2 / 3 !important;
            }
            .cmgr-card::before {
                display: none !important;
                padding-top: 0 !important;
            }
            .cmgr-card-spacer {
                display: none !important;
                padding-top: 0;
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
            .cmgr-library-toolbar-actions {
                width: 100%;
                margin-left: 0;
                flex-wrap: wrap;
            }
            .cmgr-library-match-status {
                grid-template-columns: 1fr;
            }
            .cmgr-detail-match-row {
                align-items: stretch;
                flex-direction: column;
            }
            .cmgr-nav {
                border-bottom-color: var(--cmgr-border);
            }
            .cmgr-detail {
                border-top-color: var(--cmgr-border);
            }
        }
        /* Multi-LoRA node selector. It deliberately reuses the manager theme
           while keeping a smaller, LoRA-only information architecture. */
        .cmgr-lora-shell {
            width: min(1480px, 96vw);
            height: min(900px, 94vh);
            position: relative;
        }
        .cmgr-lora-layout {
            grid-template-columns: 210px minmax(0, 1fr);
        }
        .cmgr-lora-nav {
            min-width: 0;
        }
        .cmgr-lora-nav-summary {
            margin-top: auto;
            padding: 14px 12px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-control);
            color: var(--cmgr-muted);
            font-size: 11px;
        }
        .cmgr-lora-nav-summary b {
            color: var(--cmgr-text);
            font-size: 12px;
        }
        .cmgr-lora-folder-group {
            gap: 6px;
        }
        .cmgr-lora-folder-all,
        .cmgr-lora-folder-select {
            min-height: 34px;
        }
        .cmgr-lora-folder-label {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
        }
        .cmgr-lora-folder-glyph {
            position: relative;
            flex: 0 0 auto;
            width: 13px;
            height: 9px;
            border: 1.5px solid currentColor;
            border-radius: 2px;
            opacity: 0.75;
        }
        .cmgr-lora-folder-glyph::before {
            content: "";
            position: absolute;
            left: -1.5px;
            top: -5px;
            width: 6px;
            height: 4px;
            border: 1.5px solid currentColor;
            border-bottom: 0;
            border-radius: 2px 2px 0 0;
            background: var(--cmgr-panel);
        }
        .cmgr-lora-folder-glyph.is-library {
            box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--cmgr-accent) 35%, transparent);
        }
        .cmgr-lora-folder-glyph.is-file {
            width: 10px;
            height: 13px;
            border-radius: 2px;
        }
        .cmgr-lora-folder-glyph.is-file::before {
            display: none;
        }
        .cmgr-lora-folder-select.is-ancestor:not(.active) {
            background: color-mix(in srgb, var(--cmgr-accent) 7%, transparent);
            color: color-mix(in srgb, var(--cmgr-text) 84%, var(--cmgr-muted));
        }
        .cmgr-lora-local-toolbar {
            grid-template-columns: minmax(250px, auto) minmax(220px, 1fr) auto;
        }
        .cmgr-lora-local-heading {
            display: grid;
            gap: 5px;
            min-width: 0;
        }
        .cmgr-lora-local-heading h2 {
            margin: 0;
        }
        .cmgr-lora-folder-context {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
            color: var(--cmgr-muted);
            font-size: 10.5px;
        }
        .cmgr-lora-folder-context-label {
            flex: 0 0 auto;
        }
        .cmgr-lora-breadcrumb {
            display: flex;
            align-items: center;
            min-width: 0;
            overflow-x: auto;
            scrollbar-width: none;
        }
        .cmgr-lora-breadcrumb::-webkit-scrollbar {
            display: none;
        }
        .cmgr-lora-breadcrumb button {
            flex: 0 0 auto;
            max-width: 150px;
            overflow: hidden;
            border: 0;
            border-radius: 5px;
            background: transparent;
            color: var(--cmgr-muted);
            cursor: pointer;
            padding: 2px 4px;
            font: inherit;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-lora-breadcrumb button:hover,
        .cmgr-lora-breadcrumb button.active {
            background: color-mix(in srgb, var(--cmgr-accent) 10%, transparent);
            color: var(--cmgr-text);
        }
        .cmgr-lora-breadcrumb-separator {
            flex: 0 0 auto;
            color: color-mix(in srgb, var(--cmgr-muted) 70%, transparent);
            padding: 0 1px;
        }
        .cmgr-lora-body,
        .cmgr-lora-page {
            min-width: 0;
            min-height: 0;
            height: 100%;
            overflow: hidden;
        }
        .cmgr-lora-page {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
        }
        .cmgr-lora-toolbar {
            display: grid;
            grid-template-columns: auto minmax(220px, 1fr) minmax(150px, 190px) auto;
            align-items: center;
            gap: 10px;
        }
        .cmgr-lora-toolbar h2 {
            white-space: nowrap;
        }
        .cmgr-lora-search {
            min-width: 0;
        }
        .cmgr-lora-split {
            min-height: 0;
            grid-template-columns: minmax(0, 1fr) clamp(330px, 27vw, 410px) !important;
        }
        .cmgr-lora-results {
            min-width: 0;
            min-height: 0;
            overflow-y: auto;
            grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
            grid-auto-rows: 280px !important;
            gap: 14px;
            padding: 18px;
        }
        .cmgr-lora-card,
        .cmgr-lora-card.asset {
            height: 280px !important;
            min-height: 280px;
            cursor: pointer;
        }
        .cmgr-lora-card .cmgr-thumb {
            inset: 2px;
        }
        .cmgr-lora-detail {
            min-width: 0;
            overflow: hidden;
        }
        .cmgr-lora-detail-preview {
            height: 260px;
        }
        .cmgr-lora-detail-preview a,
        .cmgr-lora-applied-preview a {
            display: block;
            width: 100%;
            height: 100%;
        }
        .cmgr-no-preview {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--cmgr-control);
            color: var(--cmgr-muted);
        }
        .cmgr-lora-info-block {
            display: grid;
            gap: 8px;
            margin: 16px 0;
            color: var(--cmgr-muted);
            font-size: 12px;
        }
        .cmgr-lora-info-block em {
            color: var(--cmgr-muted);
        }
        .cmgr-lora-detail-actions {
            display: grid;
            gap: 10px;
            margin-top: 18px;
        }
        .cmgr-file-actions {
            display: grid;
            gap: 10px;
            margin-top: 16px;
            padding-top: 2px;
        }
        .cmgr-file-actions-title {
            margin: 0;
        }
        .cmgr-file-action-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .cmgr-file-action {
            min-width: 0;
            min-height: 62px;
            display: grid;
            grid-template-columns: 30px minmax(0, 1fr);
            align-items: center;
            gap: 9px;
            border: 1px solid var(--cmgr-border);
            border-radius: calc(var(--cmgr-radius) + 1px);
            background: var(--cmgr-control);
            color: var(--cmgr-text);
            cursor: pointer;
            padding: 9px 10px;
            text-align: left;
            transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .cmgr-file-action:hover {
            border-color: color-mix(in srgb, var(--cmgr-accent) 34%, var(--cmgr-border));
            background: color-mix(in srgb, var(--cmgr-accent) 7%, var(--cmgr-control));
            transform: translateY(-1px);
        }
        .cmgr-file-action.is-active {
            border-color: color-mix(in srgb, #f59e0b 38%, var(--cmgr-border));
            background: color-mix(in srgb, #f59e0b 8%, var(--cmgr-control));
        }
        .cmgr-file-action > span {
            min-width: 0;
            display: grid;
            gap: 3px;
        }
        .cmgr-file-action b,
        .cmgr-file-action small {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-file-action b {
            color: var(--cmgr-text);
            font-size: 11.5px;
        }
        .cmgr-file-action small {
            color: var(--cmgr-muted);
            font-size: 9.5px;
            font-weight: 560;
        }
        .cmgr-file-action-icon {
            width: 30px;
            height: 30px;
            display: grid;
            place-items: center;
            box-sizing: border-box;
            border-radius: 9px;
            background: color-mix(in srgb, var(--cmgr-accent) 11%, transparent);
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
            font-size: 15px;
            font-style: normal;
        }
        .cmgr-file-action.is-active .is-favorite {
            background: color-mix(in srgb, #f59e0b 16%, transparent);
            color: #f59e0b;
        }
        .cmgr-file-action-icon.is-folder::before {
            content: "";
            width: 14px;
            height: 10px;
            box-sizing: border-box;
            border: 1.5px solid currentColor;
            border-radius: 2px;
            box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--cmgr-accent) 22%, transparent);
        }
        .cmgr-file-danger-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 12px;
            padding: 10px 0 0;
            border-top: 1px solid var(--cmgr-border);
        }
        .cmgr-file-danger-row > span {
            min-width: 0;
            display: grid;
            gap: 3px;
        }
        .cmgr-file-danger-row b {
            color: var(--cmgr-text);
            font-size: 11px;
        }
        .cmgr-file-danger-row small {
            color: var(--cmgr-muted);
            font-size: 9.5px;
        }
        .cmgr-file-danger-row .cmgr-danger {
            min-height: 34px;
            padding: 0 13px;
        }
        .cmgr-lora-file-info b {
            overflow-wrap: anywhere;
            text-align: right;
        }
        .cmgr-notification-host {
            position: absolute;
            top: 42px;
            left: 50%;
            z-index: 220;
            width: min(520px, calc(100% - 32px));
            display: grid;
            gap: 8px;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }
        .cmgr-notification-host:empty {
            display: none;
        }
        .cmgr-notification-host .cmgr-notice {
            position: relative;
            top: auto;
            right: auto;
            display: grid;
            grid-template-columns: 24px minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
            min-height: 46px;
            box-sizing: border-box;
            margin: 0;
            padding: 9px 14px 9px 11px;
            border: 1px solid color-mix(in srgb, var(--cmgr-accent) 30%, var(--cmgr-border));
            border-radius: 14px;
            background: color-mix(in srgb, var(--cmgr-panel) 93%, var(--cmgr-accent) 7%);
            color: var(--cmgr-text);
            box-shadow: 0 16px 42px rgba(0, 0, 0, 0.34), 0 3px 10px rgba(0, 0, 0, 0.18);
            backdrop-filter: blur(18px) saturate(1.12);
            -webkit-backdrop-filter: blur(18px) saturate(1.12);
            font-size: 12.5px;
            font-weight: 680;
            line-height: 1.42;
            animation: cmgrNoticeDrop 0.28s cubic-bezier(0.2, 0.82, 0.24, 1) both;
        }
        .cmgr-notification-host .cmgr-notice.cmgr-error {
            border-color: color-mix(in srgb, var(--cmgr-bad) 42%, var(--cmgr-border));
            background: color-mix(in srgb, var(--cmgr-panel) 90%, var(--cmgr-bad) 10%);
        }
        .cmgr-notice-icon {
            width: 24px;
            height: 24px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: color-mix(in srgb, var(--cmgr-accent) 18%, transparent);
            color: color-mix(in srgb, var(--cmgr-accent) 82%, var(--cmgr-text));
            font-size: 12px;
            font-style: normal;
            font-weight: 900;
        }
        .cmgr-notice.cmgr-error .cmgr-notice-icon {
            background: color-mix(in srgb, var(--cmgr-bad) 18%, transparent);
            color: color-mix(in srgb, var(--cmgr-bad) 76%, var(--cmgr-text));
        }
        .cmgr-lora-detail [data-action="match-local"]:disabled {
            opacity: 1;
            cursor: wait;
            background: color-mix(in srgb, var(--cmgr-accent) 78%, var(--cmgr-panel));
            border-color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
            color: #fff;
            box-shadow: 0 5px 16px color-mix(in srgb, var(--cmgr-accent) 22%, transparent);
        }
        .cmgr-lora-detail [data-action="match-local"]:disabled::before {
            content: "";
            width: 12px;
            height: 12px;
            flex: 0 0 auto;
            box-sizing: border-box;
            border: 2px solid rgba(255, 255, 255, 0.42);
            border-top-color: #fff;
            border-radius: 50%;
            animation: cmgrLoraMatchSpin 0.72s linear infinite;
        }
        @keyframes cmgrLoraMatchSpin {
            to { transform: rotate(360deg); }
        }
        .cmgr-notice-dismiss {
            width: 26px;
            height: 26px;
            display: grid;
            place-items: center;
            pointer-events: auto;
            border: 0;
            border-radius: 50%;
            background: color-mix(in srgb, var(--cmgr-text) 8%, transparent);
            color: var(--cmgr-text);
            cursor: pointer;
            padding: 0;
            font-size: 17px;
            line-height: 1;
        }
        .cmgr-notice-dismiss:hover {
            background: color-mix(in srgb, var(--cmgr-text) 14%, transparent);
        }
        @keyframes cmgrNoticeDrop {
            from {
                opacity: 0;
                transform: translateY(-18px) scale(0.98);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        .cmgr-lora-pending {
            display: grid;
            gap: 8px;
            margin: 16px 0;
            padding: 12px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-control);
        }
        .cmgr-lora-pending > div:first-child {
            display: flex;
            justify-content: space-between;
            color: var(--cmgr-text);
            font-size: 12px;
        }
        .cmgr-lora-applied-list,
        .cmgr-lora-download-list {
            min-height: 0;
            overflow-y: auto;
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .cmgr-lora-toolbar-note {
            grid-column: 2 / -2;
            color: var(--cmgr-muted);
            font-size: 12px;
        }
        .cmgr-lora-applied-item {
            display: grid;
            grid-template-columns: 88px minmax(0, 1fr) auto;
            gap: 14px;
            align-items: center;
            padding: 12px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-panel);
        }
        .cmgr-lora-applied-item.is-disabled {
            opacity: 0.58;
        }
        .cmgr-lora-applied-preview {
            width: 88px;
            height: 88px;
            overflow: hidden;
            border-radius: calc(var(--cmgr-radius) - 3px);
            background: var(--cmgr-control);
        }
        .cmgr-lora-applied-preview img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .cmgr-lora-applied-main,
        .cmgr-lora-applied-head > div {
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .cmgr-lora-applied-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 14px;
        }
        .cmgr-lora-applied-head b,
        .cmgr-lora-applied-head span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-lora-applied-head span,
        .cmgr-lora-toggle,
        .cmgr-lora-strength span {
            color: var(--cmgr-muted);
            font-size: 11px;
        }
        .cmgr-lora-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }
        .cmgr-lora-strength {
            display: grid;
            grid-template-columns: auto minmax(120px, 1fr) 44px;
            align-items: center;
            gap: 10px;
        }
        .cmgr-lora-strength input {
            width: 100%;
            accent-color: var(--cmgr-accent);
        }
        .cmgr-lora-strength output {
            color: var(--cmgr-text);
            font-variant-numeric: tabular-nums;
            text-align: right;
        }
        .cmgr-lora-order-actions {
            display: grid;
            grid-template-columns: repeat(2, 38px);
            gap: 6px;
        }
        .cmgr-lora-order-actions .cmgr-danger {
            grid-column: 1 / -1;
        }
        .cmgr-lora-download-item {
            display: grid;
            gap: 10px;
            padding: 14px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-panel);
        }
        .cmgr-lora-download-head,
        .cmgr-lora-download-foot {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .cmgr-lora-download-head b,
        .cmgr-lora-download-foot > span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-lora-download-head span,
        .cmgr-lora-download-foot {
            color: var(--cmgr-muted);
            font-size: 12px;
        }
        .cmgr-lora-download-foot > div {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }

        /* A calm, informative placeholder keeps the permanent detail rail
           useful even before a card is selected. */
        .cmgr-empty-detail-scroll {
            overflow: hidden;
            padding: 20px;
        }
        .cmgr-empty-detail {
            position: relative;
            width: 100%;
            height: 100%;
            min-height: 0;
            overflow: hidden;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 24px;
            padding: clamp(24px, 4vh, 42px) 24px;
            border: 1px solid color-mix(in srgb, var(--cmgr-border) 82%, transparent);
            border-radius: calc(var(--cmgr-radius) + 4px);
            background:
                radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--cmgr-accent) 13%, transparent), transparent 35%),
                linear-gradient(155deg, color-mix(in srgb, var(--cmgr-panel-soft) 92%, transparent), color-mix(in srgb, var(--cmgr-panel) 97%, transparent));
            color: var(--cmgr-muted);
            text-align: center;
        }
        .cmgr-empty-detail::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.28;
            background-image: radial-gradient(color-mix(in srgb, var(--cmgr-text) 18%, transparent) 0.7px, transparent 0.7px);
            background-size: 15px 15px;
            mask-image: linear-gradient(to bottom, #000, transparent 72%);
        }
        .cmgr-empty-detail-art {
            position: relative;
            width: 146px;
            height: 132px;
            flex: 0 0 auto;
        }
        .cmgr-empty-detail-orbit {
            position: absolute;
            inset: 12px;
            border: 1px solid color-mix(in srgb, var(--cmgr-accent) 26%, transparent);
            border-radius: 50%;
            transform: rotate(-18deg) scaleY(0.48);
        }
        .cmgr-empty-detail-orbit.orbit-two {
            inset: 27px 5px;
            border-style: dashed;
            transform: rotate(27deg) scaleY(0.55);
            opacity: 0.65;
        }
        .cmgr-empty-detail-card {
            position: absolute;
            left: 50%;
            top: 50%;
            width: 82px;
            height: 96px;
            border: 1px solid color-mix(in srgb, var(--cmgr-border) 78%, var(--cmgr-accent));
            border-radius: 11px;
            background: color-mix(in srgb, var(--cmgr-panel-soft) 92%, var(--cmgr-accent) 8%);
            box-shadow: 0 18px 34px color-mix(in srgb, #000 24%, transparent);
        }
        .cmgr-empty-detail-card.card-back {
            transform: translate(-40%, -48%) rotate(9deg);
            opacity: 0.48;
        }
        .cmgr-empty-detail-card.card-front {
            transform: translate(-58%, -55%) rotate(-4deg);
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
            padding: 12px;
            box-sizing: border-box;
        }
        .cmgr-empty-detail-card.card-front::before {
            content: "";
            height: 45px;
            border-radius: 7px;
            background: linear-gradient(145deg, color-mix(in srgb, var(--cmgr-accent) 28%, transparent), color-mix(in srgb, var(--cmgr-accent) 7%, transparent));
        }
        .cmgr-empty-detail-card.card-front i {
            height: 4px;
            border-radius: 999px;
            background: color-mix(in srgb, var(--cmgr-text) 22%, transparent);
        }
        .cmgr-empty-detail-card.card-front i:nth-child(2) { width: 74%; }
        .cmgr-empty-detail-card.card-front i:nth-child(3) { width: 48%; }
        .cmgr-empty-detail-spark {
            position: absolute;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--cmgr-accent);
            box-shadow: 0 0 14px color-mix(in srgb, var(--cmgr-accent) 72%, transparent);
        }
        .cmgr-empty-detail-spark.spark-one { top: 20px; right: 22px; }
        .cmgr-empty-detail-spark.spark-two { left: 17px; bottom: 28px; width: 4px; height: 4px; opacity: 0.65; }
        .cmgr-empty-detail-copy {
            position: relative;
            z-index: 1;
            display: grid;
            justify-items: center;
            gap: 8px;
            max-width: 290px;
        }
        .cmgr-empty-detail-kicker {
            color: color-mix(in srgb, var(--cmgr-accent) 74%, var(--cmgr-text));
            font-size: 10px;
            font-weight: 850;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }
        .cmgr-empty-detail h2 {
            margin: 0;
            color: var(--cmgr-text);
            font-size: 20px;
            line-height: 1.25;
        }
        .cmgr-empty-detail p {
            margin: 0;
            color: var(--cmgr-muted);
            font-size: 12px;
            line-height: 1.65;
        }
        .cmgr-empty-detail-features {
            position: relative;
            z-index: 1;
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 7px;
        }
        .cmgr-empty-detail-features span {
            border: 1px solid var(--cmgr-border);
            border-radius: 999px;
            background: color-mix(in srgb, var(--cmgr-control) 82%, transparent);
            color: color-mix(in srgb, var(--cmgr-text) 72%, var(--cmgr-muted));
            padding: 5px 9px;
            font-size: 10.5px;
            font-weight: 720;
        }

        /* The LoRA-only manager now follows the exact outer geometry and
           detail hierarchy of the full CivitaiManager popup. */
        .cmgr-lora-shell {
            width: min(1780px, calc(100vw - 24px));
            height: calc(100vh - 24px);
        }
        .cmgr-lora-layout {
            grid-template-columns: clamp(260px, 16vw, 292px) minmax(0, 1fr);
        }
        .cmgr-lora-nav {
            overflow-x: hidden;
            overflow-y: auto;
        }
        .cmgr-lora-filter-group {
            gap: 9px;
        }
        .cmgr-lora-category-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
        }
        .cmgr-lora-category-grid .cmgr-filter-chip {
            min-width: 0;
            min-height: 36px;
            padding: 7px 8px;
            font-size: 12.5px;
            font-weight: 720;
            line-height: 1.2;
        }
        .cmgr-lora-nav-summary {
            flex: 0 0 auto;
        }
        .cmgr-lora-split {
            grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 400px) !important;
        }
        .cmgr-lora-detail-preview {
            height: clamp(240px, 38vh, 420px);
        }
        .cmgr-detail-stat-row {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
            margin: 0 0 14px;
        }
        .cmgr-detail-stat-row > span {
            min-width: 0;
            display: grid;
            gap: 3px;
            padding: 9px;
            border: 1px solid var(--cmgr-border);
            border-radius: var(--cmgr-radius);
            background: var(--cmgr-panel-soft);
        }
        .cmgr-detail-stat-row b {
            overflow: hidden;
            color: var(--cmgr-text);
            font-size: 12px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-detail-stat-row small {
            color: var(--cmgr-muted);
            font-size: 10px;
        }
        .cmgr-lora-detail .cmgr-description {
            margin-bottom: 6px;
        }
        @media (max-width: 900px) {
            .cmgr-lora-shell {
                width: 100vw;
                height: 100vh;
            }
            .cmgr-lora-layout {
                display: grid;
                grid-template-columns: 1fr;
                grid-template-rows: auto minmax(0, 1fr);
            }
            .cmgr-lora-nav {
                display: flex;
                overflow-x: auto;
                padding: 8px;
            }
            .cmgr-lora-nav .cmgr-nav-group {
                display: flex;
                flex-direction: row;
                padding: 0;
                margin: 0;
                border: 0;
            }
            .cmgr-lora-nav .cmgr-nav-title,
            .cmgr-lora-nav-summary,
            .cmgr-lora-filter-group {
                display: none;
            }
            .cmgr-lora-split {
                display: grid;
                grid-template-columns: 1fr !important;
                grid-template-rows: minmax(380px, 1fr) auto;
                overflow-y: auto;
            }
            .cmgr-lora-detail {
                max-height: none;
                border-left: 0;
                border-top: 1px solid var(--cmgr-border);
            }
            .cmgr-lora-toolbar {
                grid-template-columns: 1fr auto;
            }
            .cmgr-lora-toolbar h2,
            .cmgr-lora-search,
            .cmgr-lora-toolbar-note {
                grid-column: 1 / -1;
            }
            .cmgr-lora-applied-item {
                grid-template-columns: 64px minmax(0, 1fr);
            }
            .cmgr-lora-applied-preview {
                width: 64px;
                height: 64px;
            }
            .cmgr-lora-order-actions {
                grid-column: 1 / -1;
                display: flex;
                justify-content: flex-end;
            }
        }

        /* Shared discovery toolbar used by both manager surfaces. */
        .cmgr-search-toolbar,
        .cmgr-lora-toolbar.cmgr-search-toolbar {
            min-height: 74px;
            display: grid;
            grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 400px);
            align-items: stretch;
            gap: 0;
            box-sizing: border-box;
            padding: 0;
            flex-wrap: nowrap;
        }
        .cmgr-search-toolbar-main {
            min-width: 0;
            display: grid;
            grid-template-columns: 148px minmax(220px, 1fr);
            align-items: center;
            gap: 14px;
            box-sizing: border-box;
            padding: 11px 18px 11px 24px;
        }
        .cmgr-lora-toolbar.cmgr-search-toolbar .cmgr-search-toolbar-main {
            padding-left: 18px;
        }
        .cmgr-search-toolbar-heading {
            min-width: 0;
            display: grid;
            align-content: center;
            gap: 2px;
            padding-left: 2px;
        }
        .cmgr-search-toolbar-heading > span {
            overflow: hidden;
            color: var(--cmgr-muted);
            font-size: 9.5px;
            font-weight: 760;
            letter-spacing: 0.08em;
            line-height: 1.1;
            text-overflow: ellipsis;
            text-transform: uppercase;
            white-space: nowrap;
        }
        .cmgr-search-toolbar .cmgr-search-toolbar-heading h2 {
            min-width: 0;
            overflow: hidden;
            grid-column: auto;
            margin: 0;
            color: var(--cmgr-text);
            font-size: 17px;
            font-weight: 780;
            line-height: 1.2;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-search-toolbar .cmgr-search-wrap {
            width: 100%;
            min-width: 0;
            max-width: none;
            flex: none;
        }
        .cmgr-search-toolbar .cmgr-search,
        .cmgr-search-toolbar .cmgr-combo-control,
        .cmgr-search-toolbar select.cmgr-input,
        .cmgr-search-toolbar .cmgr-search-submit {
            min-height: 40px;
            height: 40px;
            box-sizing: border-box;
            border-radius: calc(var(--cmgr-radius) - 1px);
        }
        .cmgr-search-toolbar .cmgr-search {
            width: 100%;
            min-width: 0;
            padding-left: 38px;
            padding-right: 38px;
            background: var(--cmgr-control);
            font-size: 13px;
        }
        .cmgr-search-toolbar .cmgr-search-mark {
            left: 13px;
            width: 14px;
            height: 14px;
            box-sizing: border-box;
            border: 2px solid var(--cmgr-muted);
            border-radius: 50%;
            font-size: 0;
            opacity: 0.82;
        }
        .cmgr-search-toolbar .cmgr-search-mark::after {
            content: "";
            position: absolute;
            right: -4px;
            bottom: -2px;
            width: 6px;
            height: 2px;
            border-radius: 999px;
            background: var(--cmgr-muted);
            transform: rotate(45deg);
            transform-origin: left center;
        }
        .cmgr-search-toolbar .cmgr-search-clear {
            right: 7px;
            width: 28px;
            height: 28px;
            border-radius: 8px;
        }
        .cmgr-search-toolbar-actions {
            display: grid;
            grid-template-columns: 190px 68px;
            align-items: center;
            justify-content: end;
            gap: 8px;
            box-sizing: border-box;
            padding: 11px 18px;
            border-left: 1px solid var(--cmgr-border);
        }
        .cmgr-search-toolbar-actions > :only-child {
            grid-column: 2;
        }
        .cmgr-library > .cmgr-library-match-status {
            flex: 0 0 auto;
            box-sizing: border-box;
            padding: 9px 24px;
            border-bottom: 1px solid var(--cmgr-border);
            background: var(--cmgr-panel-soft);
        }
        .cmgr-local-search-toolbar .cmgr-lora-local-heading {
            gap: 3px;
            overflow: hidden;
        }
        .cmgr-local-search-toolbar .cmgr-lora-folder-context {
            overflow: hidden;
        }
        .cmgr-settings-footer [data-action="save-settings"][aria-busy="true"] {
            opacity: 1;
            cursor: wait;
            background: color-mix(in srgb, var(--cmgr-accent) 78%, var(--cmgr-panel));
            border-color: color-mix(in srgb, var(--cmgr-accent) 58%, var(--cmgr-border));
            color: #fff;
        }
        .cmgr-settings-footer [data-action="save-settings"][aria-busy="true"]::before {
            content: "";
            width: 12px;
            height: 12px;
            flex: 0 0 auto;
            box-sizing: border-box;
            border: 2px solid rgba(255, 255, 255, 0.38);
            border-top-color: #fff;
            border-radius: 50%;
            animation: cmgrLoraMatchSpin 0.72s linear infinite;
        }
        .cmgr-sidebar-launcher {
            min-height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            box-sizing: border-box;
            padding: 24px;
            color: var(--cmgr-text);
            text-align: center;
        }
        .cmgr-sidebar-launcher-icon {
            width: 48px;
            height: 48px;
            display: grid;
            place-items: center;
            border: 1px solid color-mix(in srgb, var(--cmgr-accent) 28%, var(--cmgr-border));
            border-radius: 15px;
            background: color-mix(in srgb, var(--cmgr-accent) 12%, var(--cmgr-control));
            color: color-mix(in srgb, var(--cmgr-accent) 78%, var(--cmgr-text));
            font-size: 21px;
        }
        .cmgr-sidebar-launcher h3 {
            margin: 4px 0 0;
            color: var(--cmgr-text);
            font-size: 16px;
        }
        .cmgr-sidebar-launcher p {
            max-width: 260px;
            margin: 0 0 6px;
            color: var(--cmgr-muted);
            font-size: 12px;
            line-height: 1.55;
        }
        .cmgr-search-toolbar .cmgr-toolbar-select,
        .cmgr-search-toolbar .cmgr-lora-sort {
            width: 190px;
            min-width: 190px;
            max-width: 190px;
        }
        .cmgr-search-toolbar .cmgr-search-submit {
            width: 68px;
            min-width: 68px;
            padding: 0 12px;
        }
        @media (max-width: 900px) {
            .cmgr-search-toolbar,
            .cmgr-lora-toolbar.cmgr-search-toolbar {
                grid-template-columns: minmax(0, 1fr);
                align-items: center;
                gap: 8px;
                padding: 10px 16px;
            }
            .cmgr-search-toolbar-main {
                grid-template-columns: minmax(118px, 148px) minmax(220px, 1fr);
                gap: 12px;
                padding: 0;
            }
            .cmgr-lora-toolbar.cmgr-search-toolbar .cmgr-search-toolbar-main {
                padding-left: 0;
            }
            .cmgr-search-toolbar-heading {
                display: grid;
            }
            .cmgr-search-toolbar-actions {
                grid-template-columns: 190px 68px;
                justify-content: end;
                padding: 0;
                border-left: 0;
            }
        }
        @media (max-width: 720px) {
            .cmgr-search-toolbar-main {
                grid-template-columns: minmax(0, 1fr);
            }
            .cmgr-search-toolbar-heading {
                grid-template-columns: auto minmax(0, 1fr);
                align-items: baseline;
                gap: 8px;
            }
            .cmgr-search-toolbar-heading > span {
                order: 2;
            }
            .cmgr-search-toolbar-actions {
                grid-template-columns: minmax(0, 1fr) auto;
            }
            .cmgr-search-toolbar .cmgr-toolbar-select,
            .cmgr-search-toolbar .cmgr-lora-sort {
                width: 100%;
                max-width: none;
            }
        }

        /* Shared project links in both popup title bars. */
        .cmgr-topbar > :first-child {
            min-width: 0;
        }
        .cmgr-topbar-actions,
        .cmgr-promo-links {
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .cmgr-topbar-actions {
            flex: 0 0 auto;
            gap: 10px;
        }
        .cmgr-promo-links {
            gap: 8px;
        }
        .cmgr-promo-link {
            width: 34px;
            height: 34px;
            box-sizing: border-box;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
            border: 1px solid color-mix(in srgb, currentColor 36%, var(--cmgr-border));
            border-radius: 12px;
            background: color-mix(in srgb, var(--cmgr-control) 88%, transparent);
            box-shadow: inset 0 1px 0 color-mix(in srgb, var(--cmgr-text) 6%, transparent);
            color: color-mix(in srgb, var(--cmgr-accent) 78%, var(--cmgr-text));
            text-decoration: none;
            user-select: none;
            transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease, box-shadow 0.16s ease;
        }
        .cmgr-promo-link:hover,
        .cmgr-promo-link:focus-visible {
            border-color: color-mix(in srgb, currentColor 58%, var(--cmgr-border));
            background: color-mix(in srgb, currentColor 14%, var(--cmgr-control));
            color: var(--cmgr-text);
            transform: translateY(-1px);
            box-shadow: 0 8px 22px color-mix(in srgb, currentColor 16%, transparent), inset 0 1px 0 color-mix(in srgb, var(--cmgr-text) 7%, transparent);
            outline: none;
        }
        .cmgr-promo-afdian {
            width: 54px;
            color: #f472b6;
        }
        .cmgr-promo-afdian span {
            font-size: 12px;
            font-weight: 850;
            letter-spacing: -0.02em;
            white-space: nowrap;
        }
        @media (max-width: 640px) {
            .cmgr-topbar {
                padding-inline: 14px;
                gap: 10px;
            }
            .cmgr-topbar-actions {
                gap: 6px;
            }
            .cmgr-promo-links {
                gap: 5px;
            }
            .cmgr-promo-link {
                width: 32px;
                height: 32px;
                border-radius: 10px;
            }
            .cmgr-promo-afdian {
                width: 50px;
            }
        }

        /* Shared sidebar count badges. Keep them quiet until their row is active. */
        .cmgr-nav .cmgr-nav-btn > span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cmgr-nav .cmgr-nav-btn > b {
            flex: 0 0 auto;
            min-width: 23px;
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            margin-left: 10px;
            padding: 0 7px;
            border: 1px solid color-mix(in srgb, var(--cmgr-border) 86%, transparent);
            border-radius: 999px;
            background: color-mix(in srgb, var(--cmgr-control) 82%, transparent);
            color: color-mix(in srgb, var(--cmgr-text) 68%, var(--cmgr-muted));
            box-shadow: none;
            font-size: 10px;
            font-weight: 760;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.01em;
            line-height: 1;
        }
        .cmgr-nav .cmgr-nav-btn:hover:not(.active) > b {
            border-color: color-mix(in srgb, var(--cmgr-text) 14%, var(--cmgr-border));
            background: var(--cmgr-panel-hover);
            color: var(--cmgr-text);
        }
        .cmgr-nav .cmgr-nav-btn.active > b {
            border-color: color-mix(in srgb, var(--cmgr-accent) 28%, var(--cmgr-border));
            background: color-mix(in srgb, var(--cmgr-accent) 12%, var(--cmgr-control));
            color: color-mix(in srgb, var(--cmgr-accent) 72%, var(--cmgr-text));
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cmgr-accent) 5%, transparent);
        }
    `;
    if (!style.isConnected) {
        document.head.appendChild(style);
    }
}
