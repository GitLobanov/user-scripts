// ==UserScript==
// @name         Rulate Super
// @namespace    http://tampermonkey.net/
// @version      6.5
// @description  Умный отчет, интерактивное разделение глав, live-обновление, проверка на дубли, настройка прозрачности, чек-листы и гибкая группировка ошибок.
// @author       Lobanov
// @match        *://tl.rulate.ru/*
// @require      https://unpkg.com/az@0.2.3/dist/az.min.js
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
'use strict';

if (window.top !== window.self) return;

// --- Стили ---
GM_addStyle(`
    /* Переменные стилей, изолированные в контейнере инструмента */
    #rst-menu-container {
        --bg-main: #282c34;
        --bg-secondary: #21252b;
        --bg-header: #1c1f24;
        --bg-input: #2c313a;
        --text-primary: #abb2bf;
        --text-secondary: #828a99;
        --accent-color: #61afef;
        --accent-hover: #5295cf;
        --success-color: #98c379;
        --warning-color: #e5c07b;
        --error-color: #e06c75;
        --border-color: #3e4451;
        --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        --font-mono: "Fira Code", "Courier New", monospace;
    }

    #rst-open-btn {
        position: fixed; top: 10px; right: 15px; z-index: 9999;
        background-color: var(--accent-color);
        color: white;
        padding: 8px 15px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        font-family: var(--font-family);
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease-in-out;
    }
    #rst-open-btn:hover {
        background-color: var(--accent-hover);
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0,0,0,0.3);
    }

    #rst-menu-container {
        position: fixed; top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 95%;
        max-width: 1600px; /* Увеличено для нового столбца */
        height: 90vh;
        background-color: var(--bg-secondary);
        color: var(--text-primary);
        border-radius: 12px;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        display: none;
        flex-direction: column;
        font-family: var(--font-family);
        border: 1px solid var(--border-color);
        transition: opacity 0.2s;
    }

    .rst-header {
        padding: 12px 20px;
        background-color: var(--bg-header);
        cursor: move;
        border-top-left-radius: 12px;
        border-top-right-radius: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--border-color);
    }
    .rst-header-main { display: flex; align-items: center; gap: 25px; }
    .rst-header h3 { margin: 0; font-size: 1.1em; font-weight: 600; color: white; white-space: nowrap;}
    .rst-tabs { display: flex; gap: 8px; }
    .rst-tab {
        padding: 8px 16px;
        background-color: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
        position: relative;
    }
    .rst-tab:hover { color: white; background-color: var(--bg-main); }
    .rst-tab.rst-active {
        color: white;
        background-color: var(--accent-color);
    }

    .rst-header-controls { display: flex; align-items: center; gap: 15px; }
    .rst-opacity-control { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); }
    .rst-opacity-control input[type="range"] { width: 80px; }

    .rst-close-btn {
        background: none; border: none; color: var(--text-secondary); font-size: 28px;
        cursor: pointer; line-height: 1; transition: color 0.2s ease;
    }
    .rst-close-btn:hover { color: white; }

    .rst-body {
        padding: 20px;
        display: flex; flex-direction: column; gap: 20px;
        flex-grow: 1;
        overflow-y: auto;
        background-color: var(--bg-main);
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
        min-height: 0;
    }
    .rst-view { display: none; }
    .rst-view.rst-active { display: flex; flex-direction: column; gap: 20px; height: 100%; }

    .rst-row { display: flex; gap: 20px; flex-grow: 1; min-height: 0; }
    .rst-col { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }

    .rst-controls {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 20px; background-color: var(--bg-secondary); padding: 15px; border-radius: 8px;
        align-items: end; border: 1px solid var(--border-color);
    }
    .rst-control-group { display: flex; flex-direction: column; gap: 8px; }

    #rst-menu-container label, #rst-menu-container .rst-label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
    .rst-label-group { display: flex; justify-content: space-between; align-items: center; }

    #rst-menu-container textarea, #rst-menu-container input[type="number"], #rst-menu-container input[type="text"] {
        width: 100%;
        background-color: var(--bg-input);
        color: var(--text-primary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 10px;
        box-sizing: border-box;
        font-family: var(--font-mono);
        font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    #rst-menu-container textarea:focus, #rst-menu-container input:focus { outline: none; border-color: var(--accent-color); box-shadow: 0 0 0 2px rgba(97, 175, 239, 0.3); }
    #rst-menu-container textarea { flex-grow: 1; resize: vertical; }

    .rst-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .rst-actions button, .rst-btn-upload, .rst-btn-clear {
        padding: 10px 18px; border: none; border-radius: 6px; cursor: pointer; color: white;
        font-size: 14px; font-weight: 500; transition: all 0.2s ease;
    }
    .rst-label-actions { display: flex; gap: 8px; }
    .rst-btn-upload, .rst-btn-clear {
         background: none; border: 1px solid var(--border-color); color: var(--text-secondary); padding: 4px 8px; font-size: 12px;
    }
    .rst-btn-upload:hover { background-color: var(--border-color); color: white; }
    .rst-btn-clear { border-color: var(--error-color); color: var(--error-color); }
    .rst-btn-clear:hover { background-color: var(--error-color); color: white; }

    .rst-checkbox-group label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
    .rst-checkbox-group input[type="checkbox"] { accent-color: var(--accent-color); }
    .rst-radio-group label { font-size: 14px; display: flex; align-items: center; gap: 8px; }
    .rst-radio-group input[type="radio"] { accent-color: var(--accent-color); }

    .rst-settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .rst-results-wrapper { position: relative; flex-grow: 1; min-height: 0; }
    #validation-results { background-color: var(--bg-input); border: 1px solid var(--border-color); border-radius: 6px; padding: 15px; height: 100%; width: 100%; overflow-y: auto; font-size: 14px; position: absolute; top: 0; left: 0; box-sizing: border-box; }
    #validation-results details { border-bottom: 1px solid var(--border-color); }
    #validation-results details:last-of-type { border-bottom: none; }
    #validation-results summary { padding: 12px 8px; cursor: pointer; font-weight: bold; color: var(--accent-color); list-style: none; display: flex; align-items: center; gap: 8px; }
    #validation-results summary::-webkit-details-marker { display: none; }
    #validation-results summary::before { content: '▶'; display: inline-block; font-size: 0.8em; margin-right: 8px; transition: transform 0.2s; }
    #validation-results details[open] > summary::before { transform: rotate(90deg); }
    .rst-error-list { list-style-type: none; padding: 0 0 10px 25px; margin: 0; }
    .rst-error-item { padding: 10px 8px; border-top: 1px solid var(--border-color); }
    .rst-error-line { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 8px; }
    .rst-error-line-num { color: var(--warning-color); font-weight: bold; cursor: pointer; flex-shrink: 0; background-color: var(--bg-main); padding: 2px 6px; border-radius: 4px; }
    .rst-error-line-text { color: var(--text-primary); white-space: pre-wrap; word-break: break-word; font-family: var(--font-mono); }
    .rst-error-details { list-style-type: none; padding-left: 0; margin: 0; }
    .rst-error-details li { color: var(--error-color); display: flex; align-items: center; justify-content: space-between; padding: 4px 0; }
    .rst-error-details li.rst-sequence-error, .rst-error-details li.rst-duplicate-error { color: var(--accent-color); }
    .rst-error-resolve-btn { background: none; border: 1px solid var(--border-color); color: var(--text-secondary); border-radius: 4px; cursor: pointer; font-size: 12px; padding: 2px 6px; margin-left: 10px; transition: all 0.2s; }
    .rst-error-resolve-btn:hover { background-color: var(--success-color); color: white; border-color: var(--success-color);}
    .rst-success-message { color: var(--success-color); font-weight: bold; font-size: 1.2em; text-align: center; padding: 20px; }
    .rst-error-summary { color: var(--warning-color); margin-bottom: 15px; font-weight: bold; font-size: 1.1em; }

    #fmt-report-block { margin-left: auto; font-size: 13px; color: var(--text-secondary); display: flex; gap: 20px; }
    #fmt-report-block span { font-weight: 500; color: var(--text-primary); }

    .rst-btn-process { background-color: #2a6496; } .rst-btn-process:hover { background-color: #3b8bce; }
    .rst-btn-copy { background-color: var(--success-color); } .rst-btn-copy:hover { filter: brightness(1.1); }
    .rst-btn-download { background-color: var(--error-color); } .rst-btn-download:hover { filter: brightness(1.1); }
    .rst-btn-validate { background-color: var(--accent-color); } .rst-btn-validate:hover { background-color: var(--accent-hover); }

    /* --- Стили для Интерактивного Форматтера --- */
    .rst-sub-tabs { display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 8px; }
    .rst-sub-tab { background: none; border: none; color: var(--text-secondary); padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 2px solid transparent; }
    .rst-sub-tab.rst-active { color: var(--accent-color); border-bottom-color: var(--accent-color); }
    .rst-sub-view-container { flex-grow: 1; position: relative; min-height: 0; }
    .rst-sub-view { display: none; height: 100%; }
    .rst-sub-view.rst-active { display: flex; }
    .rst-sub-view textarea { height: 100%; }

    .interactive-wrapper { display: flex; flex-grow: 1; min-height: 0; gap: 5px; }

    .char-count-line { text-align: right; padding: 0 8px; white-space: pre; }
    .char-count-line.is-chapter-header { color: var(--accent-color); font-weight: bold; }

    #fmt-interactive-view {
        height: 100%; overflow-y: auto; background-color: var(--bg-input);
        border-radius: 6px; border: 1px solid var(--border-color);
        font-family: var(--font-mono); font-size: 14px; white-space: pre-wrap;
        flex-grow: 1; min-width: 0;
    }
    .interactive-line { padding: 0 10px; cursor: pointer; position: relative; transition: background-color 0.1s; }
    .interactive-line:hover { background-color: rgba(97, 175, 239, 0.1); }
    .interactive-line.is-chapter-header { color: var(--accent-color); font-weight: bold; }
    .interactive-line.split-marker::before {
        content: '✂︎----------'; color: var(--warning-color); position: absolute;
        left: 10px; right: 10px; top: -7px; font-size: 12px;
        text-align: center; letter-spacing: 2px;
    }
    #fmt-summary-block {
        height: 100%; overflow-y: auto; background-color: var(--bg-input);
        border-radius: 6px; border: 1px solid var(--border-color); padding: 10px;
        font-size: 13px;
    }
    .summary-item { padding: 4px 8px; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; }
    .summary-item-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .summary-item-chars { color: var(--text-secondary); margin-left: 10px; flex-shrink: 0; }
    .rst-btn-validate { background-color: var(--accent-color); } .rst-btn-validate:hover { background-color: var(--accent-hover); }
    .rst-fix-session-overlay {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background-color: var(--bg-main); z-index: 100;
        display: none; flex-direction: column;
    }
    .rst-fix-session-overlay.active { display: flex; }

    .fix-header {
        padding: 10px 20px; background-color: var(--bg-header); border-bottom: 1px solid var(--border-color);
        display: flex; justify-content: space-between; align-items: center;
    }
    .fix-header h4 { margin: 0; color: white; display: flex; align-items: center; gap: 10px; }
    .fix-workspace { display: flex; flex-grow: 1; overflow: hidden; }

    /* Левая колонка - Список задач и Настройки */
    .fix-sidebar-left { width: 25%; min-width: 280px; border-right: 1px solid var(--border-color); display: flex; flex-direction: column; background-color: var(--bg-secondary); }

    .fix-sidebar-tabs { display: flex; border-bottom: 1px solid var(--border-color); }
    .fix-sidebar-tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; color: var(--text-secondary); background: rgba(0,0,0,0.2); font-size: 12px; }
    .fix-sidebar-tab.active { background: var(--bg-secondary); color: var(--accent-color); font-weight: bold; border-bottom: 2px solid var(--accent-color); }

    .fix-panel { display: none; flex-direction: column; height: 100%; }
    .fix-panel.active { display: flex; }

    /* Панель списка */
    .fix-filters { padding: 10px; border-bottom: 1px solid var(--border-color); display: flex; gap: 5px; flex-wrap: wrap; }
    .fix-filter-tag {
        font-size: 11px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color);
        cursor: pointer; color: var(--text-secondary); user-select: none;
    }
    .fix-filter-tag.active { background-color: var(--accent-color); color: white; border-color: var(--accent-color); }
    .fix-list { flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .fix-item {
        padding: 10px; background-color: var(--bg-input); border-radius: 6px; cursor: pointer;
        border-left: 3px solid var(--warning-color); transition: background 0.2s;
    }
    .fix-item:hover { background-color: #353b45; }
    .fix-item.active { background-color: #3a404a; border-left-color: var(--accent-color); box-shadow: 0 0 0 1px var(--accent-color); }
    .fix-item.resolved { opacity: 0.5; border-left-color: var(--success-color); text-decoration: line-through; }
    .fix-item-line { font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; display: flex; justify-content: space-between; }
    .fix-item-preview { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Панель настроек списков */
    .fix-settings-content { padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
    .fix-settings-group label { display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 12px; }
    .fix-settings-group textarea { height: 150px; font-size: 12px; }

    /* Центральная область - Редактор 3-х строк */
    .fix-editor-area { flex-grow: 1; padding: 20px; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; }
    .fix-error-desc { color: var(--warning-color); font-size: 13px; padding: 10px; background: rgba(229, 192, 123, 0.1); border-radius: 4px; border: 1px solid rgba(229, 192, 123, 0.3); }

    .fix-unified-container { display: flex; flex-direction: column; flex-grow: 1; gap: 5px; }
    .fix-unified-header { font-size: 12px; color: var(--text-secondary); display: flex; justify-content: space-between; }
    .fix-unified-textarea {
        flex-grow: 1;
        width: 100%;
        box-sizing: border-box;
        resize: none;
        padding: 15px;
        font-size: 14px;
        line-height: 1.6;
        background-color: var(--bg-input);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        font-family: var(--font-mono);
        border-radius: 6px;
        min-height: 200px;
    }
    .fix-unified-textarea:focus {
        border-color: var(--accent-color);
        outline: none;
        box-shadow: 0 0 0 2px rgba(97, 175, 239, 0.2);
    }

    .fix-controls { display: flex; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color); }

    /* Правая колонка */
    .fix-sidebar-right { width: 20%; min-width: 200px; border-left: 1px solid var(--border-color); background-color: var(--bg-secondary); display: flex; flex-direction: column; }
    .fix-stats { padding: 15px; border-bottom: 1px solid var(--border-color); text-align: center; }
    .fix-stat-circle {
        width: 80px; height: 80px; border-radius: 50%; border: 4px solid var(--border-color);
        margin: 0 auto 10px; display: flex; align-items: center; justify-content: center;
        font-size: 20px; font-weight: bold; color: var(--accent-color);
    }
    .fix-history { flex-grow: 1; overflow-y: auto; padding: 10px; }
    .fix-history-item { font-size: 12px; padding: 8px; border-bottom: 1px solid var(--border-color); color: var(--success-color); }
    .fix-history-item span { color: var(--text-secondary); display: block; font-size: 10px; margin-top: 2px;}
    .rst-btn-fix-start { background-color: var(--warning-color); color: #282c34; font-weight: bold; margin-left: 10px; display: none; }
    .merge-controls {
        display: flex; gap: 10px; padding: 10px; background: var(--bg-input);
        border-bottom: 1px solid var(--border-color); align-items: center;
    }
    .merge-controls input { width: 80px !important; }
    .merge-list-container {
        flex-grow: 1; overflow-y: auto; padding: 10px; position: relative;
    }
    .merge-item {
        display: flex; align-items: center; padding: 8px 12px;
        border-bottom: 1px solid var(--border-color); cursor: pointer;
        transition: background 0.2s; user-select: none;
    }
    .merge-item:hover { background-color: rgba(255,255,255,0.05); }
    .merge-item.selected {
        background-color: rgba(97, 175, 239, 0.2);
        border-left: 3px solid var(--accent-color);
    }
    .merge-item-checkbox {
        margin-right: 15px; transform: scale(1.2); pointer-events: none;
    }
    .merge-item-info { flex-grow: 1; }
    .merge-item-title { font-weight: bold; font-size: 13px; display: block;}
    .merge-item-meta { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    .merge-item-size-warn { color: var(--warning-color); }

    #merge-action-btn {
        position: absolute; bottom: 20px; right: 20px;
        background-color: var(--accent-color); color: white;
        padding: 12px 24px; border-radius: 30px; border: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: bold;
        cursor: pointer; z-index: 10; display: none;
        transition: transform 0.2s;
    }
    #merge-action-btn:hover { transform: translateY(-2px); background-color: var(--accent-hover); }
    #merge-action-btn span { background: rgba(0,0,0,0.2); padding: 2px 6px; border-radius: 10px; margin-left: 8px; font-size: 0.9em; }
    .rst-duplicate-alert {
        background-color: rgba(224, 108, 117, 0.15);
        border: 1px solid var(--error-color);
        border-radius: 6px;
        padding: 15px;
        margin-bottom: 20px;
    }
    .rst-duplicate-header {
        color: var(--error-color);
        font-weight: bold;
        font-size: 1.1em;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .rst-dup-item {
        background-color: var(--bg-main);
        padding: 10px;
        border-radius: 4px;
        margin-bottom: 8px;
        font-size: 13px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-left: 3px solid var(--warning-color);
    }
    .rst-dup-info { display: flex; flex-direction: column; gap: 4px; }
    .rst-dup-snippet { color: var(--text-secondary); font-style: italic; font-size: 12px; max-width: 600px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Модальное окно сравнения */
    #dup-compare-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.85); z-index: 11000;
        display: none; justify-content: center; align-items: center;
    }
    #dup-compare-modal.active { display: flex; }
    .dup-modal-content {
        width: 90%; height: 90%; background-color: var(--bg-secondary);
        border-radius: 8px; display: flex; flex-direction: column;
        border: 1px solid var(--border-color);
        box-shadow: 0 0 50px rgba(0,0,0,0.5);
    }
    .dup-modal-header {
        padding: 15px; background-color: var(--bg-header);
        border-bottom: 1px solid var(--border-color);
        display: flex; justify-content: space-between; align-items: center;
    }
    .dup-modal-body {
        flex-grow: 1; display: flex; gap: 10px; padding: 15px; overflow: hidden;
    }
    .dup-pane {
        flex: 1; display: flex; flex-direction: column; gap: 10px;
        background-color: var(--bg-main); padding: 10px; border-radius: 6px;
    }
    .dup-pane-title { font-weight: bold; color: var(--accent-color); border-bottom: 1px solid var(--border-color); padding-bottom: 5px; }
    .dup-pane-text {
        flex-grow: 1; overflow-y: auto; white-space: pre-wrap;
        font-family: var(--font-mono); font-size: 13px; line-height: 1.5;
        color: var(--text-secondary);
    }
    .dup-highlight {
        background-color: rgba(229, 192, 123, 0.2);
        color: var(--text-primary);
        border-bottom: 2px solid var(--warning-color);
        cursor: pointer;
    }
    .dup-highlight:hover { background-color: rgba(229, 192, 123, 0.4); }
    .dup-target-highlight {
        background-color: rgba(224, 108, 117, 0.3);
        color: white;
        border: 1px solid var(--error-color);
    }
    #arts-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background-color: rgba(0,0,0,0.85); z-index: 11000;
        display: none; justify-content: center; align-items: center;
    }
    #arts-modal.active { display: flex; }
`);


    // Находим все строки в теле таблицы
    const rows = document.querySelectorAll('table.tablesorter tbody tr');

    // Проходим по каждой строке
    rows.forEach(row => {
        // Находим первую ячейку (td) и ссылку в ней
        const firstCell = row.querySelector('td:first-child');
        const statLink = firstCell ? firstCell.querySelector('a[href*="/stat"]') : null;

        if (statLink) {
            // Создаем новую ссылку-кнопку
            const bookLink = document.createElement('a');

            // Убираем '/stat' из URL, чтобы получить ссылку на книгу
            bookLink.href = statLink.href.replace('/stat', '');

            // Добавляем класс, как вы просили
            bookLink.className = 'support-link';

            // Добавляем текст или иконку для кнопки
            bookLink.textContent = '📖 Перейти '; // Можете изменить на "К книге", "Перейти" и т.д.

            // Добавляем стили, чтобы кнопка выглядела аккуратно
            bookLink.style.margin = '0px 8px';
            bookLink.style.textDecoration = 'none';
            bookLink.style.fontSize = '1.2em';
            bookLink.style.border = '1px solid';
            bookLink.style.borderRadius = '10%';
            bookLink.style.padding = '5px';

            // Вставляем новую кнопку перед ссылкой на статистику
            firstCell.insertBefore(bookLink, statLink);
        }
    });

// --- HTML структура ---
const openBtn = document.createElement('button');
openBtn.id = 'rst-open-btn';
openBtn.textContent = 'Super-Инструмент';
document.body.appendChild(openBtn);

const menu = document.createElement('div');
menu.id = 'rst-menu-container';
menu.innerHTML = `
    <div class="rst-header">
        <div class="rst-header-main">
             <h3>Rulate Super-Инструмент v6.4</h3>
             <div class="rst-tabs">
                <button class="rst-tab rst-active" data-view="formatter-view">Форматтер глав</button>
                <button class="rst-tab" data-view="validator-view">Проверка текста</button>
                <button class="rst-tab" data-view="summary-view">Матем. пересказ</button>
             </div>
        </div>
        <div class="rst-header-controls">
            <div class="rst-opacity-control">
                <span>Прозрачность</span>
                <input type="range" id="rst-opacity-slider" min="0.5" max="1" step="0.05" value="1">
            </div>
            <button class="rst-close-btn">&times;</button>
        </div>
    </div>
    <div class="rst-body">
        <!-- VIEW 1: FORMATTER -->
        <div id="formatter-view" class="rst-view rst-active">
             <div class="rst-controls">
                <div class="rst-control-group"><label for="fmt-offset-input">Смещение нумерации (+n / -n)</label><input type="number" id="fmt-offset-input" value="0"></div>
                <div class="rst-control-group"><label for="fmt-limit-input">Количество глав для обработки</label><input type="number" id="fmt-limit-input" placeholder="Все главы"></div>
                <div class="rst-control-group">
                    <label>Режим обработки:</label>
                    <div class="rst-radio-group" style="display: flex; gap: 15px; margin-top: 5px;">
                        <label><input type="radio" id="fmt-mode-titles" name="fmt-mode" value="titles" checked>Только заголовки</label>
                        <label><input type="radio" id="fmt-mode-replace" name="fmt-mode" value="replace">Заменить в тексте</label>
                    </div>
                </div>
                <div class="rst-control-group rst-checkbox-group"><label title="Работает только в режиме 'Заменить в тексте'"><input type="checkbox" id="fmt-replace-brackets">Заменить [] на 【】 в тексте (игнорируя главы)</label></div>
                <div class="rst-control-group rst-checkbox-group"><label title="Добавляет пустую строку после каждого абзаца, если ее нет. Работает только в режиме 'Заменить в тексте'"><input type="checkbox" id="fmt-add-spacing">Добавить отступы между абзацами</label></div>
                <div class="rst-control-group rst-checkbox-group"><label title="Выравнивает нумерацию всех глав..."><input type="checkbox" id="fmt-align-numbers">Выравнить номера глав</label></div>
               <div class="rst-control-group rst-checkbox-group"><label title="Убирает пробелы и спец-отступы в начале и конце каждой строки"><input type="checkbox" id="fmt-trim-lines" checked>Убрать отступы строк</label></div>

            </div>
            <div class="rst-row">
                <div class="rst-col" style="flex: 3;">
                    <div class="rst-label-group">
                         <div class="rst-sub-tabs">
                            <button class="rst-sub-tab rst-active" data-sub-view="fmt-source-sub-view">Исходный текст</button>
                            <button class="rst-sub-tab" data-sub-view="fmt-interactive-sub-view">Интерактивная нарезка</button>
                            <button class="rst-sub-tab" data-sub-view="fmt-merge-sub-view">Объединение глав</button>
                        </div>
                        <div class="rst-label-actions">
                            <button class="rst-btn-upload" data-target="fmt-source-text" data-input="fmt-file-input">Загрузить</button>
                            <button id="fmt-clear-btn" class="rst-btn-clear">Очистить</button>
                        </div>
                        <input type="file" id="fmt-file-input" accept=".txt,.md,text/plain,text/markdown" style="display: none;">
                    </div>
                    <div class="rst-sub-view-container">
                        <div id="fmt-source-sub-view" class="rst-sub-view rst-active">
                            <textarea id="fmt-source-text" placeholder="Вставьте сюда текст с главами..."></textarea>
                        </div>
                         <div id="fmt-interactive-sub-view" class="rst-sub-view">
                            <div class="interactive-wrapper">
                                <div id="fmt-interactive-view"></div>
                            </div>
                        </div>
                        <div id="fmt-merge-sub-view" class="rst-sub-view" style="flex-direction: column;">
                            <div class="merge-controls">
                                <label>Фильтр (макс. симв):</label>
                                <input type="number" id="merge-filter-size" value="4000" step="500">
                                <label>Соседи (+/-):</label>
                                <input type="number" id="merge-filter-neighbors" value="1" min="0" max="5">
                                <button id="merge-apply-filter" class="rst-btn-upload">Применить</button>
                                <button id="merge-reset-filter" class="rst-btn-clear" style="margin-left:auto">Показать все</button>
                            </div>
                            <div class="merge-list-container">
                                <button id="merge-action-btn">Объединить выделенное <span id="merge-count-badge">0</span></button>
                                <div id="merge-list-view"></div>
                            </div>
                        </div>

                    </div>
                </div>
                <div class="rst-col" style="flex: 1;">
                     <label class="rst-label">Краткая сводка:</label>
                     <div id="fmt-summary-block"></div>
                </div>
                <div class="rst-col" style="flex: 2;">
                    <label for="fmt-result-text" class="rst-label">Результат:</label>
                    <textarea id="fmt-result-text" readonly></textarea>
                </div>
            </div>
            <div class="rst-actions">
                <button id="fmt-process-btn" class="rst-btn-process">Применить опции</button>
                <button id="fmt-copy-btn" class="rst-btn-copy">Копировать</button>
                <button id="fmt-download-txt-btn" class="rst-btn-download">Скачать .txt</button>
                <button id="fmt-download-md-btn" class="rst-btn-download">Скачать .md</button>
                <div class="rst-checkbox-group" style="margin-left: 20px; border-left: 2px solid var(--border-color); padding-left: 20px; display: flex; gap: 15px;">
                     <label><input type="checkbox" id="fmt-check-formatted">Отформатировано?</label>
                     <label><input type="checkbox" id="fmt-check-verified">Проверено?</label>
                </div>
                <div id="fmt-report-block"></div>
            </div>
        </div>
        <!-- VIEW 2: VALIDATOR -->
        <div id="validator-view" class="rst-view">
             <div class="rst-settings-grid">
                <div class="rst-control-group"><label for="validator-ignore-words">Игнор-слова (используйте * для поиска по части слова)</label><textarea id="validator-ignore-words" rows="8"></textarea></div>
                <div class="rst-control-group"><label for="validator-stop-words">Стоп-слова (используйте * для поиска по части слова)</label><textarea id="validator-stop-words" rows="8"></textarea></div>
            </div>
            <div class="rst-controls rst-checkbox-group">
                <label><input type="checkbox" id="check-latin" checked>Латиница</label>
                <label><input type="checkbox" id="check-asian" checked>Иероглифы</label>
                <label><input type="checkbox" id="check-arabic" checked>Араб. вязь</label>
                <label><input type="checkbox" id="check-formatting" checked>Форматирование</label>
                <label><input type="checkbox" id="check-stopwords" checked>Стоп-слова</label>
                <label><input type="checkbox" id="check-sequence" checked>Порядок глав</label>
                <label><input type="checkbox" id="check-duplicates" checked>Дубликаты глав</label>
                <label><input type="checkbox" id="check-grammar" checked>Грамматика (beta)</label>
            </div>
             <div class="rst-row">
                <div class="rst-col">
                    <div class="rst-label-group">
                         <label for="validator-source-text" class="rst-label">Текст для проверки:</label>
                         <div class="rst-label-actions">
                             <button class="rst-btn-upload" data-target="validator-source-text" data-input="validator-file-input">Загрузить файл</button>
                             <button id="validator-copy-text-btn" class="rst-btn-upload" style="border-color: var(--success-color); color: var(--success-color);">Копировать текст</button>
                             <button id="validator-clear-btn" class="rst-btn-clear">Очистить</button>
                         </div>
                         <input type="file" id="validator-file-input" accept=".txt,.md,text/plain,text/markdown" style="display: none;">
                    </div>
                    <textarea id="validator-source-text" placeholder="Вставьте сюда текст для проверки или загрузите файл..."></textarea>
                </div>
                <div class="rst-col">
                    <div class="rst-label-group">
                        <label class="rst-label">Результаты проверки:</label>
                        <div class="rst-radio-group" style="font-size: 13px; gap: 15px;">
                            <label><input type="radio" name="validator-grouping" value="by-type" checked> По типу ошибки</label>
                            <label><input type="radio" name="validator-grouping" value="by-chapter"> По главам</label>
                        </div>
                    </div>
                    <div class="rst-results-wrapper">
                        <div id="validation-results"></div>
                    </div>
                </div>
            </div>
             <div class="rst-actions">
                <button id="validator-process-btn" class="rst-btn-validate">Проверить текст</button>
                <button id="validator-fix-btn" class="rst-btn-fix-start">⚡ Исправить (Интерактив)</button>
                <button id="validator-extract-arts-btn" class="rst-btn-clear" style="border-color: #c678dd; color: #c678dd;">✂️ Извлечь Арты</button>
                <button id="validator-copy-llm-btn" class="rst-btn-llm" style="display: none;">Копировать ошибки</button>
             </div>

              <div id="validator-fix-overlay" class="rst-fix-session-overlay">
                 <div class="fix-header">
                     <h4>⚡ Интерактивное исправление</h4>
                     <div>
                         <button id="fix-finish-btn" class="rst-btn-process">Завершить и сохранить</button>
                         <button id="fix-cancel-btn" class="rst-btn-clear">Отмена</button>
                     </div>
                 </div>
                 <div class="fix-workspace">
                     <!-- ЛЕВАЯ КОЛОНКА -->
                     <div class="fix-sidebar-left">
                         <div class="fix-sidebar-tabs">
                             <div class="fix-sidebar-tab active" data-tab="fix-panel-list">Ошибки</div>
                             <div class="fix-sidebar-tab" data-tab="fix-panel-settings">Словари</div>
                         </div>

                         <!-- Панель 1: Список ошибок -->
                         <div id="fix-panel-list" class="fix-panel active">
                             <div class="fix-filters" id="fix-category-filters"></div>
                             <div class="fix-list" id="fix-queue-list"></div>
                         </div>

                         <!-- Панель 2: Настройки словарей -->
                         <div id="fix-panel-settings" class="fix-panel">
                             <div class="fix-settings-content">
                                 <div class="fix-settings-group">
                                     <label>Ignore List (Слова-исключения):</label>
                                     <textarea id="fix-ignore-edit"></textarea>
                                 </div>
                                 <div class="fix-settings-group">
                                     <label>Stop List (Стоп-слова):</label>
                                     <textarea id="fix-stop-edit"></textarea>
                                 </div>
                                 <button id="fix-save-lists-btn" class="rst-btn-validate" style="width:100%">Сохранить словари</button>
                                 <div style="font-size:11px; color:var(--text-secondary); margin-top:5px;">
                                     * Изменения применятся к следующим проверкам.
                                 </div>
                             </div>
                         </div>
                     </div>

                     <!-- ЦЕНТРАЛЬНАЯ КОЛОНКА -->
                     <div class="fix-editor-area">
                         <div id="fix-empty-state" style="text-align: center; color: var(--text-secondary); margin-top: 50px;">
                             Выберите строку с ошибкой слева.
                         </div>
                         <div id="fix-editor-container" style="display: none; height: 100%; flex-direction: column;">
                              <div class="fix-error-desc" id="fix-current-errors-desc" style="flex-shrink: 0; margin-bottom: 15px;"></div>

                             <div class="fix-unified-container">
                                 <div class="fix-unified-header">
                                     <span id="fix-unified-info">Редактирование контекста (±2 строки)</span>
                                 </div>
                                 <textarea id="fix-unified-input" class="fix-unified-textarea" tabindex="1"></textarea>
                             </div>

                             <div class="fix-controls">
                                 <button id="fix-apply-btn" class="rst-btn-validate">Применить (Ctrl+Enter)</button>
                                 <button id="fix-skip-btn" class="rst-btn-clear" style="border-color: var(--text-secondary); color: var(--text-secondary);">Пропустить</button>
                             </div>
                         </div>
                     </div>

                     <!-- ПРАВАЯ КОЛОНКА -->
                     <div class="fix-sidebar-right">
                         <div class="fix-stats">
                             <div class="fix-stat-circle" id="fix-progress-circle">0%</div>
                             <div style="font-size: 12px; color: var(--text-secondary);">Исправлено: <span id="fix-count-done">0</span> / <span id="fix-count-total">0</span></div>
                         </div>
                         <div class="fix-label" style="padding: 0 10px;">История сессии:</div>
                         <div class="fix-history" id="fix-history-list"></div>
                     </div>
                 </div>
             </div>
        </div>
        <div id="summary-view" class="rst-view">
    <div class="rst-controls">
        <div class="rst-control-group">
            <div class="rst-label-group">
                <label for="sum-ratio-slider">Степень сжатия (оставить % текста): <span id="sum-ratio-val" style="color:var(--accent-color)">30%</span></label>
            </div>
            <input type="range" id="sum-ratio-slider" min="5" max="90" value="30" step="5">
        </div>
        <div class="rst-control-group">
             <label>Алгоритм:</label>
             <div style="font-size: 12px; color: var(--text-secondary); margin-top: 5px;">
                 Частотный анализ (Frequency Weighing)
             </div>
        </div>
    </div>

    <div class="rst-row">
        <div class="rst-col">
            <div class="rst-label-group">
                <label class="rst-label">Исходный текст</label>
                <div class="rst-label-actions">
                     <button id="sum-paste-btn" class="rst-btn-upload">Вставить из буфера</button>
                </div>
            </div>
            <textarea id="sum-source-text" placeholder="Вставьте длинный текст сюда..."></textarea>
        </div>
        <div class="rst-col">
            <div class="rst-label-group">
                <label class="rst-label">Краткое содержание (Выжимка)</label>
                <div class="rst-label-actions">
                    <button id="sum-copy-btn" class="rst-btn-copy">Копировать</button>
                </div>
            </div>
            <textarea id="sum-result-text" readonly placeholder="Здесь появится результат..." style="background-color: var(--bg-secondary);"></textarea>
            <div id="sum-stats" style="font-size: 12px; color: var(--text-secondary); text-align: right; margin-top: 5px;"></div>
        </div>
        </div>
        <div class="rst-actions">
            <button id="sum-process-btn" class="rst-btn-process" style="width: 100%;">⚡ Выполнить математическое сжатие</button>
        </div>
    </div>
        <div id="dup-compare-modal">
            <div class="dup-modal-content">
                <div class="dup-modal-header">
                    <h3>⚔️ Сравнение дубликатов</h3>
                    <button class="rst-close-btn" id="dup-close-btn">&times;</button>
                </div>
                <div class="dup-modal-body">
                    <div class="dup-pane">
                        <div class="dup-pane-title">Оригинал (Первое появление)</div>
                        <div class="dup-pane-text" id="dup-text-orig"></div>
                    </div>
                    <div class="dup-pane">
                        <div class="dup-pane-title">Дубликат (Повтор)</div>
                        <div class="dup-pane-text" id="dup-text-copy"></div>
                    </div>
                </div>
                <div class="rst-actions" style="padding: 15px; justify-content: flex-end; background-color: var(--bg-header);">
                     <span style="margin-right: auto; color: var(--text-secondary); font-size: 12px;">* Удаление пока недоступно в этом окне, используйте редактор.</span>
                     <button class="rst-btn-clear" id="dup-cancel-btn">Закрыть</button>
                </div>
            </div>
        </div>
        <div id="arts-modal">
            <div class="dup-modal-content">
                <div class="dup-modal-header">
                    <h3>🎨 Извлеченные арты</h3>
                    <button class="rst-close-btn" id="arts-close-btn">&times;</button>
                </div>
                <div class="dup-modal-body" style="flex-direction: column;">
                    <textarea id="arts-result-textarea" style="flex-grow: 1; width: 100%; resize: none; border: none; background: var(--bg-main); color: var(--text-primary); font-family: var(--font-mono); padding: 15px;" readonly></textarea>
                </div>
                <div class="rst-actions" style="padding: 15px; justify-content: flex-end; background-color: var(--bg-header);">
                     <span style="margin-right: auto; color: var(--text-secondary); font-size: 12px;">* Арты скопированы в это окно. Их можно вырезать из исходника кнопкой.</span>
                     <button class="rst-btn-download" id="arts-cut-btn">✂️ Вырезать из текста</button>
                     <button class="rst-btn-copy" id="arts-copy-btn">Копировать всё</button>
                     <button class="rst-btn-clear" id="arts-cancel-btn">Закрыть</button>
                </div>
            </div>
        </div>
    </div>
`;
document.body.appendChild(menu);

// --- ОБЩАЯ ЛОГИКА ОКНА ---
const closeBtn = menu.querySelector('.rst-close-btn');
const opacitySlider = document.getElementById('rst-opacity-slider');
const toggleMenu = () => { menu.style.display = menu.style.display === 'none' || '' ? 'flex' : 'none'; };
openBtn.addEventListener('click', toggleMenu);
closeBtn.addEventListener('click', toggleMenu);
const tabs = menu.querySelectorAll('.rst-tab'), views = menu.querySelectorAll('.rst-view');
tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('rst-active'));
    tab.classList.add('rst-active');
    views.forEach(v => v.classList.remove('rst-active'));
    menu.querySelector(`#${tab.dataset.view}`).classList.add('rst-active');
}));
const header = menu.querySelector('.rst-header'); let isDragging = false, offsetX, offsetY;
header.addEventListener('mousedown', e => { if (!['BUTTON', 'INPUT'].includes(e.target.tagName)) { isDragging = true; offsetX = e.clientX - menu.offsetLeft; offsetY = e.clientY - menu.offsetTop; menu.style.userSelect = 'none'; }});
document.addEventListener('mousemove', e => { if (isDragging) { menu.style.left = `${e.clientX - offsetX}px`; menu.style.top = `${e.clientY - offsetY}px`; } });
document.addEventListener('mouseup', () => { isDragging = false; menu.style.userSelect = 'auto'; });
const applyOpacity = (value) => { menu.style.opacity = value; };
const loadOpacity = () => { const savedOpacity = localStorage.getItem('rst_opacity') || '1'; opacitySlider.value = savedOpacity; applyOpacity(savedOpacity); };
opacitySlider.addEventListener('input', (e) => { applyOpacity(e.target.value); localStorage.setItem('rst_opacity', e.target.value); });
loadOpacity();
document.querySelectorAll('.rst-btn-upload').forEach(button => {
    // Получаем ID, но проверяем, существуют ли они
    const fileInputId = button.dataset.input;
    const targetTextareaId = button.dataset.target;

    // Если у кнопки нет атрибута data-input (например, это кнопка "Копировать"), пропускаем её
    if (!fileInputId || !targetTextareaId) return;

    const fileInput = document.getElementById(fileInputId);
    const targetTextarea = document.getElementById(targetTextareaId);

    // Дополнительная защита: проверяем, найдены ли элементы в DOM
    if (fileInput && targetTextarea) {
        button.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                targetTextarea.value = e.target.result;
                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            };
            reader.onerror = () => { alert('Не удалось прочитать файл.'); };
            reader.readAsText(file);
            event.target.value = '';
        });
    }
});


// --- ЛОГИКА ФОРМАТТЕРА ГЛАВ (с интерактивным разделением) ---
(() => {
    const sourceTextarea = document.getElementById('fmt-source-text');
    const resultTextarea = document.getElementById('fmt-result-text');
    const offsetInput = document.getElementById('fmt-offset-input');
    const limitInput = document.getElementById('fmt-limit-input');
    const replaceBracketsCheckbox = document.getElementById('fmt-replace-brackets');
    const addSpacingCheckbox = document.getElementById('fmt-add-spacing');
    const alignNumbersCheckbox = document.getElementById('fmt-align-numbers');
    const clearBtn = document.getElementById('fmt-clear-btn');
    const processBtn = document.getElementById('fmt-process-btn');
    const copyBtn = document.getElementById('fmt-copy-btn');
    const downloadTxtBtn = document.getElementById('fmt-download-txt-btn');
    const downloadMdBtn = document.getElementById('fmt-download-md-btn');
    const reportBlock = document.getElementById('fmt-report-block');
    const interactiveView = document.getElementById('fmt-interactive-view');
    const summaryBlock = document.getElementById('fmt-summary-block');
    // --- НОВОЕ: Чекбоксы верификации ---
    const checkFormatted = document.getElementById('fmt-check-formatted');
    const checkVerified = document.getElementById('fmt-check-verified');


    const chapterRegex = /^Глава\s+(\d+)([\.:])?\s*([^\r\n]*)/;
    let originalChapters = [];
    let splitPoints = new Set();
    let processedChapters = [];

    const subTabs = document.querySelectorAll('#formatter-view .rst-sub-tab');
    const subViews = document.querySelectorAll('#formatter-view .rst-sub-view');
    subTabs.forEach(tab => tab.addEventListener('click', () => {
        subTabs.forEach(t => t.classList.remove('rst-active'));
        tab.classList.add('rst-active');
        subViews.forEach(v => v.classList.remove('rst-active'));
        document.getElementById(tab.dataset.subView).classList.add('rst-active');
    }));

    const loadSettings = () => {
        replaceBracketsCheckbox.checked = localStorage.getItem('formatter_replaceBrackets') === 'true';
        addSpacingCheckbox.checked = localStorage.getItem('formatter_addSpacing') === 'true';
    };
    const saveSettings = () => {
        localStorage.setItem('formatter_replaceBrackets', replaceBracketsCheckbox.checked);
        localStorage.setItem('formatter_addSpacing', addSpacingCheckbox.checked);
    };

    // --- НОВОЕ: Логика управления кнопками скачивания ---
    const updateDownloadButtonState = () => {
        const isReady = checkFormatted.checked && checkVerified.checked;
        const buttons = [downloadTxtBtn, downloadMdBtn];
        buttons.forEach(btn => {
            btn.disabled = !isReady;
            btn.style.opacity = isReady ? '1' : '0.5';
            btn.style.cursor = isReady ? 'pointer' : 'not-allowed';
            btn.title = isReady ? '' : 'Необходимо отметить оба чекбокса для скачивания';
        });
    };

    const resetFinalChecks = () => {
        checkFormatted.checked = false;
        checkVerified.checked = false;
        updateDownloadButtonState();
    };

    checkFormatted.addEventListener('change', updateDownloadButtonState);
    checkVerified.addEventListener('change', updateDownloadButtonState);
    // --- Конец новой логики ---

    const parseSourceText = () => {
        const lines = sourceTextarea.value.split('\n');
        originalChapters = [];
        let currentChapterContent = [];
        let chapterHeaderFound = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(chapterRegex);
            if (match) {
                if (chapterHeaderFound) {
                    originalChapters[originalChapters.length - 1].content = currentChapterContent.join('\n');
                }
                originalChapters.push({
                    originalNumber: parseInt(match[1], 10),
                    originalTitle: match[3].trim(),
                    startLine: i,
                    content: ''
                });
                currentChapterContent = [line];
                chapterHeaderFound = true;
            } else {
                currentChapterContent.push(line);
            }
        }
        if (chapterHeaderFound) {
            originalChapters[originalChapters.length - 1].content = currentChapterContent.join('\n');
        } else if (lines.join('').trim()) {
            originalChapters.push({ originalNumber: 1, originalTitle: "Неопознанная глава", startLine: 0, content: lines.join('\n') });
        }
    };

    const renderInteractiveView = () => {
        const lines = sourceTextarea.value.split('\n');
        const interactiveFragment = document.createDocumentFragment();
        interactiveView.innerHTML = '';

        lines.forEach((line, index) => {
            const lineEl = document.createElement('div');
            lineEl.className = 'interactive-line';
            lineEl.textContent = line || ' ';
            lineEl.dataset.lineNumber = index;

            if (splitPoints.has(index)) lineEl.classList.add('split-marker');
            if (line.match(chapterRegex)) lineEl.classList.add('is-chapter-header');

            lineEl.addEventListener('click', () => toggleSplitPoint(index));
            interactiveFragment.appendChild(lineEl);
        });
        interactiveView.appendChild(interactiveFragment);
    };
    const toggleSplitPoint = (lineNumber) => {
        if (splitPoints.has(lineNumber)) {
            splitPoints.delete(lineNumber);
        } else {
            splitPoints.add(lineNumber);
        }
        // Вызываем перерисовку интерактивного вида, чтобы обновить счетчики и маркеры
        renderInteractiveView();
        // А затем пересчитываем результат
        recalculateAndRenderAll();
    };

    const recalculateAndRenderAll = () => {
        const offset = parseInt(offsetInput.value, 10) || 0;
        const alignNumbers = alignNumbersCheckbox.checked; // <--- НОВАЯ ПРОВЕРКА
        const lines = sourceTextarea.value.split('\n');
        let tempChapters = JSON.parse(JSON.stringify(originalChapters));
        processedChapters = [];

        const sortedSplits = [...splitPoints].sort((a, b) => a - b);
        sortedSplits.forEach(splitLine => {
            const chapterIndex = tempChapters.findIndex((ch, idx) => {
                const nextCh = tempChapters[idx + 1];
                return splitLine >= ch.startLine && (nextCh ? splitLine < nextCh.startLine : true);
            });
            if (chapterIndex !== -1) {
                const chapterToSplit = tempChapters[chapterIndex];
                const splitIndexInContent = splitLine - chapterToSplit.startLine;
                const contentLines = chapterToSplit.content.split('\n');
                const part1Content = contentLines.slice(0, splitIndexInContent).join('\n');
                const part2Content = contentLines.slice(splitIndexInContent).join('\n');
                if (part1Content.trim() === '' && part2Content.trim() === '') return;
                chapterToSplit.content = part1Content;
                const newPart = { ...chapterToSplit, content: part2Content, startLine: splitLine, isSplitPart: true };
                tempChapters.splice(chapterIndex + 1, 0, newPart);
            }
        });

        let currentNumber = (tempChapters.length > 0 ? tempChapters[0].originalNumber : 1) + offset;
        const partCounters = new Map();
        const getBaseTitle = (title) => title.replace(/\s*\(\d+\)$/, '').trim();

        tempChapters.forEach((chap, index) => {
            let newTitle = chap.originalTitle;
            const baseTitle = getBaseTitle(chap.originalTitle);

            const prevBaseTitle = index > 0 ? getBaseTitle(tempChapters[index - 1].originalTitle) : null;
            const nextBaseTitle = index < tempChapters.length - 1 ? getBaseTitle(tempChapters[index + 1].originalTitle) : null;

            if (baseTitle === prevBaseTitle || baseTitle === nextBaseTitle) {
                const currentCount = (partCounters.get(baseTitle) || 0) + 1;
                partCounters.set(baseTitle, currentCount);
                newTitle = `${baseTitle} (${currentCount})`;
            }

            processedChapters.push({ ...chap, finalNumber: currentNumber, finalTitle: newTitle });

            // --- ОБНОВЛЕННАЯ ЛОГИКА НУМЕРАЦИИ ---
            if (alignNumbers) {
                currentNumber++; // Просто увеличиваем на 1, если включено выравнивание
            } else {
                // Старая логика, учитывающая "прыжки" в нумерации
                if (!chap.isSplitPart) {
                    const nextChap = tempChapters[index + 1];
                    if (nextChap && !nextChap.isSplitPart) {
                         // Проверяем, что следующая глава не является частью той же, что и текущая (например, Глава 10(1) и Глава 10(2))
                        if (getBaseTitle(nextChap.originalTitle) !== getBaseTitle(chap.originalTitle)) {
                            currentNumber += (nextChap.originalNumber - chap.originalNumber);
                        } else {
                             currentNumber++;
                        }
                    } else {
                        currentNumber++;
                    }
                } else {
                    currentNumber++;
                }
            }
        });

        renderSummary();
        processFinalText();
    };

    const renderSummary = () => {
        summaryBlock.innerHTML = '';
        const fragment = document.createDocumentFragment();
        processedChapters.forEach(chap => {
            const itemEl = document.createElement('div');
            itemEl.className = 'summary-item';
            itemEl.innerHTML = `<span class="summary-item-title" title="Глава ${chap.finalNumber}. ${chap.finalTitle}">Глава ${chap.finalNumber}. ${chap.finalTitle}</span> <span class="summary-item-chars">[${chap.content.length.toLocaleString('ru-RU')}]</span>`;
            fragment.appendChild(itemEl);
        });
        summaryBlock.appendChild(fragment);
        const totalChars = processedChapters.reduce((sum, chap) => sum + chap.content.length, 0);
        updateReport(processedChapters.length, totalChars);
    };

    const updateReport = (chapters, chars) => {
        if (chapters === 0 && chars === 0) { reportBlock.innerHTML = ''; return; }
        const avgChars = chapters > 0 ? Math.round(chars / chapters) : 0;
        reportBlock.innerHTML = `<div>Всего глав: <span>${chapters}</span></div><div>Всего символов: <span>${chars.toLocaleString('ru-RU')}</span></div><div>Символов/глава: <span>~${avgChars.toLocaleString('ru-RU')}</span></div>`;
    };

    const processFinalText = () => {
        const limit = limitInput.value !== '' ? parseInt(limitInput.value, 10) : null;
        const selectedMode = document.querySelector('input[name="fmt-mode"]:checked').value;
        let resultOutput = '';
        const chaptersToProcess = limit ? processedChapters.slice(0, limit) : processedChapters;

        if (selectedMode === 'titles') {
            resultOutput = chaptersToProcess.map(c => `# [Глава ${c.finalNumber}. ${c.finalTitle}]`).join('\n');
        } else {
            resultOutput = chaptersToProcess.map(c => {
              const newHeader = `# [Глава ${c.finalNumber}. ${c.finalTitle}]`;
              let body = c.content.replace(chapterRegex, '').trim();

              const trimCheckbox = document.getElementById('fmt-trim-lines');
              if (trimCheckbox && trimCheckbox.checked) {
                  body = body.split('\n').map(line => line.trim()).join('\n');
              }
              // -----------------------------------

              return newHeader + (body ? '\n' + body : '');
          }).join('\n\n');

            if (replaceBracketsCheckbox.checked) {
                resultOutput = resultOutput.split('\n').map(line => line.startsWith('# [') ? line : line.replace(/\[/g, '【').replace(/\]/g, '】')).join('\n');
            }
            if (addSpacingCheckbox.checked) {
                const lines = resultOutput.split('\n');
                const newLines = [];
                // --- ОБНОВЛЕННАЯ ЛОГИКА ---
                const isDialogue = (line) => line.trim().startsWith('—');
                const isListItem = (line) => /^\s*[\w\d\s-]+:\s+/.test(line.trim()); // Проверка на элементы списка типа "Имя: текст"

                for (let i = 0; i < lines.length; i++) {
                    newLines.push(lines[i]);
                    if (i < lines.length - 1) {
                        const currentLine = lines[i];
                        const nextLine = lines[i + 1];
                        if (currentLine.trim().startsWith('# [') || currentLine.trim() === '' || nextLine.trim() === '' || (isDialogue(currentLine) && isDialogue(nextLine)) || (isListItem(currentLine) && isListItem(nextLine))) {
                            continue;
                        }
                        newLines.push('');
                    }
                }
                resultOutput = newLines.join('\n');
            }
        }
        resultTextarea.value = resultOutput;
    };

    const mergeListView = document.getElementById('merge-list-view');
    const mergeActionBtn = document.getElementById('merge-action-btn');
    const mergeCountBadge = document.getElementById('merge-count-badge');
    const mergeFilterSize = document.getElementById('merge-filter-size');
    const mergeFilterNeighbors = document.getElementById('merge-filter-neighbors');
    const mergeApplyFilterBtn = document.getElementById('merge-apply-filter');
    const mergeResetFilterBtn = document.getElementById('merge-reset-filter');

    let mergeSelectedIndices = new Set(); // Хранит индексы из originalChapters

    // Рендер списка объединения
    const renderMergeView = (filterSize = null, neighborsCount = 0) => {
        mergeListView.innerHTML = '';
        if (originalChapters.length === 0) {
            mergeListView.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-secondary)">Нет глав для обработки. Загрузите текст.</div>';
            return;
        }

        // Логика фильтрации
        let visibleIndices = new Set();
        if (filterSize !== null) {
            originalChapters.forEach((chap, idx) => {
                if (chap.content.length <= filterSize) {
                    visibleIndices.add(idx);
                    // Добавляем соседей
                    for (let n = 1; n <= neighborsCount; n++) {
                        if (idx - n >= 0) visibleIndices.add(idx - n);
                        if (idx + n < originalChapters.length) visibleIndices.add(idx + n);
                    }
                }
            });
        } else {
            // Если фильтра нет, показываем все
            originalChapters.forEach((_, idx) => visibleIndices.add(idx));
        }

        // Сортируем индексы для вывода
        const sortedIndices = Array.from(visibleIndices).sort((a, b) => a - b);
        let lastIdx = -1;

        sortedIndices.forEach(index => {
            const chap = originalChapters[index];
            if (!chap) return;

            // Разделитель, если есть разрыв в нумерации (скрытые главы)
            if (lastIdx !== -1 && index > lastIdx + 1) {
                const sep = document.createElement('div');
                sep.style.padding = '5px';
                sep.style.textAlign = 'center';
                sep.style.fontSize = '12px';
                sep.style.color = 'var(--text-secondary)';
                sep.textContent = `... скрыто ${index - lastIdx - 1} глав ...`;
                mergeListView.appendChild(sep);
            }
            lastIdx = index;

            const el = document.createElement('div');
            el.className = 'merge-item';
            if (mergeSelectedIndices.has(index)) el.classList.add('selected');
            el.dataset.index = index;

            const sizeClass = chap.content.length < 3000 ? 'merge-item-size-warn' : '';

            el.innerHTML = `
                <input type="checkbox" class="merge-item-checkbox" ${mergeSelectedIndices.has(index) ? 'checked' : ''}>
                <div class="merge-item-info">
                    <span class="merge-item-title">${'Глава ' + chap.originalNumber + '. ' + chap.originalTitle}</span>
                    <div class="merge-item-meta">
                        Символов: <span class="${sizeClass}">${chap.content.length.toLocaleString()}</span>
                    </div>
                </div>
            `;

            // Обработчик клика (toggle selection)
            el.addEventListener('click', (e) => {
                // Если клик с Shift - выделение диапазона
                if (e.shiftKey && lastClickedIndex !== null) {
                    const start = Math.min(lastClickedIndex, index);
                    const end = Math.max(lastClickedIndex, index);
                    for (let i = start; i <= end; i++) {
                         // Проверяем, есть ли этот индекс в текущем видимом списке (чтобы не выделить скрытое)
                         if (visibleIndices.has(i)) {
                             mergeSelectedIndices.add(i);
                             const row = mergeListView.querySelector(`.merge-item[data-index="${i}"]`);
                             if(row) {
                                 row.classList.add('selected');
                                 row.querySelector('input').checked = true;
                             }
                         }
                    }
                } else {
                    // Обычный клик
                    if (mergeSelectedIndices.has(index)) {
                        mergeSelectedIndices.delete(index);
                        el.classList.remove('selected');
                        el.querySelector('input').checked = false;
                    } else {
                        mergeSelectedIndices.add(index);
                        el.classList.add('selected');
                        el.querySelector('input').checked = true;
                    }
                    lastClickedIndex = index;
                }
                updateMergeButton();
            });

            mergeListView.appendChild(el);
        });
    };

    let lastClickedIndex = null;

    const updateMergeButton = () => {
        const count = mergeSelectedIndices.size;
        mergeCountBadge.textContent = count;
        if (count >= 2) {
            mergeActionBtn.style.display = 'block';
            // Проверка на последовательность (опционально, но желательно объединять только соседей)
            const sorted = Array.from(mergeSelectedIndices).sort((a,b)=>a-b);
            let isSequence = true;
            for(let i=0; i<sorted.length-1; i++) {
                if(sorted[i+1] !== sorted[i]+1) isSequence = false;
            }
            if(!isSequence) {
                mergeActionBtn.style.backgroundColor = 'var(--warning-color)';
                mergeActionBtn.title = "Внимание: Выделенные главы не идут подряд!";
            } else {
                mergeActionBtn.style.backgroundColor = 'var(--accent-color)';
                mergeActionBtn.title = "";
            }
        } else {
            mergeActionBtn.style.display = 'none';
        }
    };

    const executeMerge = () => {
        if (mergeSelectedIndices.size < 2) return;

        const indices = Array.from(mergeSelectedIndices).sort((a, b) => a - b);

        // 1. Находим целевую главу (последнюю, как вы просили: 101 + 102 -> останется 102)
        const targetIndex = indices[indices.length - 1];
        const targetChapter = originalChapters[targetIndex];

        // 2. Нам нужно сохранить оригинальную строку заголовка целевой главы (например "Глава 102. Дух (2)")
        // Мы ищем её регуляркой в контенте или восстанавливаем вручную
        let targetHeaderLine = targetChapter.content.match(chapterRegex);
        targetHeaderLine = targetHeaderLine ? targetHeaderLine[0] : `Глава ${targetChapter.originalNumber}. ${targetChapter.originalTitle}`;

        // 3. Собираем ЧИСТЫЙ текст (без заголовков "Глава ...")
        let combinedBody = '';

        indices.forEach(idx => {
            let text = originalChapters[idx].content;

            // ВОТ ТУТ ИСПРАВЛЕНИЕ:
            // Удаляем первую строку, если она похожа на заголовок главы.
            // replace заменит только первое вхождение (то есть заголовок в начале)
            text = text.replace(chapterRegex, '').trim();

            if (text) {
                combinedBody += text + '\n\n'; // Добавляем отступы между кусками
            }
        });

        // 4. Записываем результат в целевую главу:
        // Сначала идет заголовок целевой главы, потом перенос, потом весь склеенный текст
        targetChapter.content = targetHeaderLine + '\n' + combinedBody.trim();

        // 5. Удаляем влитые главы (все кроме последней)
        // Идем с конца списка (кроме самого последнего элемента), чтобы индексы не сместились при удалении
        for (let i = indices.length - 2; i >= 0; i--) {
            originalChapters.splice(indices[i], 1);
        }

        // 6. Сброс выделения и интерфейса
        mergeSelectedIndices.clear();
        updateMergeButton();

        // Обновляем все отображения
        renderInteractiveView();
        recalculateAndRenderAll();

        // Обновляем список объединения (чтобы удаленные главы пропали)
        mergeApplyFilterBtn.click();
    };

    // Слушатели для Merge View
    mergeApplyFilterBtn.addEventListener('click', () => {
        const size = parseInt(mergeFilterSize.value, 10) || 4000;
        const neighbors = parseInt(mergeFilterNeighbors.value, 10) || 0;
        renderMergeView(size, neighbors);
    });

    mergeResetFilterBtn.addEventListener('click', () => {
        renderMergeView(null, 0);
    });

    mergeActionBtn.addEventListener('click', () => {
        if(confirm(`Объединить выбранные главы (${mergeSelectedIndices.size} шт)?\nЗаголовок будет взят от последней главы в списке.`)) {
            executeMerge();
        }
    });


    const initializeAll = () => {
        splitPoints.clear();
        parseSourceText();
        renderInteractiveView();
        recalculateAndRenderAll();
        renderMergeView(null, 0);
    };

    sourceTextarea.addEventListener('input', () => {
        resetFinalChecks(); // Сброс чекбоксов при изменении текста
        initializeAll();
    });
    offsetInput.addEventListener('input', recalculateAndRenderAll);
    processBtn.addEventListener('click', processFinalText);
    limitInput.addEventListener('input', processFinalText);
    document.querySelectorAll('input[name="fmt-mode"]').forEach(radio => radio.addEventListener('change', processFinalText));


    loadSettings();
    replaceBracketsCheckbox.addEventListener('change', () => { saveSettings(); processFinalText(); });
    addSpacingCheckbox.addEventListener('change', () => { saveSettings(); processFinalText(); });
    alignNumbersCheckbox.addEventListener('change', recalculateAndRenderAll);
    document.getElementById('fmt-trim-lines').addEventListener('change', processFinalText);
    copyBtn.addEventListener('click', () => { resultTextarea.select(); document.execCommand('copy'); copyBtn.textContent = 'Скопировано!'; setTimeout(() => copyBtn.textContent = 'Копировать', 2000); });
    const downloadFile = (filename, content) => { const a = document.createElement('a'); a.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`); a.setAttribute('download', filename); a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); };
    downloadTxtBtn.addEventListener('click', () => downloadFile('chapters.txt', resultTextarea.value));
    downloadMdBtn.addEventListener('click', () => downloadFile('chapters.md', resultTextarea.value));
    clearBtn.addEventListener('click', () => {
        sourceTextarea.value = '';
        resultTextarea.value = '';
        resetFinalChecks(); // Сброс чекбоксов при очистке
        initializeAll();
    });

    updateDownloadButtonState(); // Установить начальное состояние кнопок
})();

// --- ЛОГИКА ВАЛИДАТОРА ТЕКСТА ---
(() => {
    const ignoreWordsEl = document.getElementById('validator-ignore-words'), stopWordsEl = document.getElementById('validator-stop-words'), sourceTextEl = document.getElementById('validator-source-text'), resultsEl = document.getElementById('validation-results'), processBtn = document.getElementById('validator-process-btn'), clearBtn = document.getElementById('validator-clear-btn'),
        groupingRadios = document.querySelectorAll('input[name="validator-grouping"]'), copyLLMBtn = document.getElementById('validator-copy-llm-btn'),
        checks = {
            latin: document.getElementById('check-latin'),
            asian: document.getElementById('check-asian'),
            arabic: document.getElementById('check-arabic'),
            formatting: document.getElementById('check-formatting'),
            stopwords: document.getElementById('check-stopwords'),
            sequence: document.getElementById('check-sequence'),
            duplicates: document.getElementById('check-duplicates'),
            grammar: document.getElementById('check-grammar')
        };

    // --- Инициализация Az.js ---
    let azLoaded = false;
    const originalBtnText = processBtn.textContent;

    if (typeof Az !== 'undefined') {
        processBtn.textContent = "Загрузка словарей...";
        processBtn.disabled = true;
        processBtn.style.opacity = "0.7";

        Az.Morph.init('https://unpkg.com/az@0.2.3/dicts', function() {
            azLoaded = true;
            processBtn.textContent = originalBtnText;
            processBtn.disabled = false;
            processBtn.style.opacity = "1";
            console.log('Rulate Tool: Морфологический словарь готов.');
        });
    } else {
        console.warn('Rulate Tool: Библиотека Az.js не найдена.');
    }

    let currentErrors = [];
    let contentDuplicates = [];
    const DEFAULTS = {
        ignoreWords: ["NPC", "жестокая", "VIP", "ASMR", "Система"].join('\n'),
        stopWords: ["Причинно-след*", "NB:", "TODO", "благостно", "troublesome", "ó", "осклабился", "кривотолки", "Разделительная линия", "чресла", "амплифици*", "промурлыкал", "токая", "янская ци", "НАЧАЛО ПЕРЕВОДА"].join('\n'),
        checkLatin: true, checkAsian: true, checkArabic: true, checkFormatting: true, checkStopwords: true, checkSequence: true, checkDuplicates: true, checkGrammar: true
    };

    const loadSettings = () => {
        ignoreWordsEl.value = localStorage.getItem('validator_ignoreWords') || DEFAULTS.ignoreWords; stopWordsEl.value = localStorage.getItem('validator_stopWords') || DEFAULTS.stopWords;
        Object.keys(checks).forEach(key => { const checkKey = `validator_check${key.charAt(0).toUpperCase() + key.slice(1)}`; checks[key].checked = (localStorage.getItem(checkKey) ?? String(DEFAULTS[checkKey])) === 'true'; });
    };
    const saveSettings = () => {
        localStorage.setItem('validator_ignoreWords', ignoreWordsEl.value); localStorage.setItem('validator_stopWords', stopWordsEl.value);
        Object.keys(checks).forEach(key => { const checkKey = `validator_check${key.charAt(0).toUpperCase() + key.slice(1)}`; localStorage.setItem(checkKey, checks[key].checked); });
    };
    const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const checkGrammarErrors = (text, lineIdCounter) => {
    if (!azLoaded) return [];
    const errors = [];

    const all_tokens = Az.Tokens(text).done();

    for (let i = 0; i < all_tokens.length; i++) {
        const token1 = all_tokens[i];

        if (token1.type !== Az.Tokens.WORD) continue;

        let nextWordToken = null;
        for (let j = i + 1; j < all_tokens.length; j++) {
            const potentialNextToken = all_tokens[j];

            if (potentialNextToken.type === Az.Tokens.PUNCT) {
                break;
            }

            // Если нашли следующее слово, сохраняем его и выходим из поиска
            if (potentialNextToken.type === Az.Tokens.WORD) {
                nextWordToken = potentialNextToken;
                break;
            }
        }

        // 4. Если второе слово не найдено (или разделено пунктуацией), переходим к следующему токену
        if (!nextWordToken) continue;

        // 5. Выполняем оригинальную проверку для найденной пары слов
        const word1 = token1;
        const word2 = nextWordToken;
        const str1 = word1.toString();
        const str2 = word2.toString();

        if (str1.length < 2 || str2.length < 2) continue;
        if (!/[а-яё]+/i.test(str1) || !/[а-яё]+/i.test(str2)) continue;

        const morphs1 = Az.Morph(str1);
        const morphs2 = Az.Morph(str2);
        if (!morphs1.length || !morphs2.length) continue;

        let perfectMatchFound = false;
        let partialMatchFound = false;

        for (let m1 of morphs1) {
            for (let m2 of morphs2) {
                const isAdj = (m1.tag.POS === 'ADJF' || m1.tag.POS === 'APRO' || (m1.tag.POS === 'NPRO' && m1.tag.GNdr));
                const isNoun = m2.tag.POS === 'NOUN';

                if (isAdj && isNoun) {
                    if (m1.tag.NMbr === 'sing' && m2.tag.NMbr === 'sing') {
                        const caseMatch = m1.tag.CAse === m2.tag.CAse;
                        const genderMatch = m1.tag.GNdr === m2.tag.GNdr;

                        if (caseMatch && genderMatch) perfectMatchFound = true;
                        if (caseMatch && !genderMatch) partialMatchFound = true;
                    }
                }
            }
        }

        if (!perfectMatchFound && partialMatchFound) {
            errors.push({
                id: lineIdCounter++,
                category: 'grammar',
                message: `Несогласование рода: "${str1} ${str2}"`
            });
        }
        }
        return errors;
    };

    const findContentDuplicates = (text, minLength = 200) => {
        const seenChunks = new Map();
        const results = [];
        const lengthText = text.length;
        let i = 0;

        while (i < lengthText - minLength) {
            const chunk = text.substr(i, minLength);

            if (seenChunks.has(chunk)) {
                const firstFoundIndex = seenChunks.get(chunk);

                // Проверяем реальную длину совпадения
                let matchLen = 0;
                while (i + matchLen < lengthText && text[firstFoundIndex + matchLen] === text[i + matchLen]) {
                    matchLen++;
                }

                // Избегаем пересечений (например "ааааа")
                if (i >= firstFoundIndex + matchLen) {
                    results.push({
                        origStart: firstFoundIndex,
                        dupStart: i,
                        length: matchLen,
                        snippet: text.substr(firstFoundIndex, Math.min(100, matchLen)).replace(/\n/g, ' ') + '...'
                    });

                    // Пропускаем найденный кусок
                    i += matchLen;
                    continue;
                }
            } else {
                seenChunks.set(chunk, i);
            }
            i++;
        }
        return results;
    };

    // Хелпер для поиска номера строки по индексу символа
    const getLineByCharIndex = (lines, charIndex) => {
        let count = 0;
        for (let k = 0; k < lines.length; k++) {
            // +1 для учета символа переноса строки (примерно)
            let lineLen = lines[k].length + 1;
            if (charIndex < count + lineLen) {
                return { lineNum: k + 1, text: lines[k] };
            }
            count += lineLen;
        }
        return { lineNum: lines.length, text: lines[lines.length-1] };
    };

    const runValidation = () => {
        const ignoreWords = ignoreWordsEl.value.split('\n').map(w => w.trim()).filter(Boolean);
        const stopWords = stopWordsEl.value.split('\n').map(w => w.trim()).filter(Boolean);
        const textLines = sourceTextEl.value.split('\n');

        const WORD_CHARS = 'a-zA-Zа-яА-ЯёЁ0-9';
        const createWordRegex = (word) => {
            const escapedWord = escapeRegExp(word.endsWith('*') ? word.slice(0, -1) : word);
            const startBoundary = `(^|[^${WORD_CHARS}])`;
            const endBoundary = `(?![${WORD_CHARS}])`;
            const pattern = word.endsWith('*') ? startBoundary + escapedWord : startBoundary + escapedWord + endBoundary;
            return new RegExp(pattern, 'gi');
        };

        let allErrors = [];
        let errorIdCounter = 0;
        let currentChapter = { fullTitle: "Пролог / Текст вне глав", lineNum: 1 };

        contentDuplicates = [];
        if (checks.duplicates.checked) {
            // Ищем повторы длиннее 200 символов
            const rawDups = findContentDuplicates(sourceTextEl.value, 200);

            // Превращаем индексы в номера строк и главы
            contentDuplicates = rawDups.map(d => {
                const origInfo = getLineByCharIndex(textLines, d.origStart);
                const dupInfo = getLineByCharIndex(textLines, d.dupStart);

                // Ищем заголовки глав для контекста
                let origChapter = "Начало текста";
                let dupChapter = "Начало текста";

                for(let l = origInfo.lineNum - 1; l >= 0; l--) {
                    if(textLines[l].match(/^(Глава\s+\d+)/)) { origChapter = textLines[l].trim(); break; }
                }
                for(let l = dupInfo.lineNum - 1; l >= 0; l--) {
                    if(textLines[l].match(/^(Глава\s+\d+)/)) { dupChapter = textLines[l].trim(); break; }
                }

                return {
                    ...d,
                    origLine: origInfo.lineNum,
                    dupLine: dupInfo.lineNum,
                    origChapter,
                    dupChapter
                };
            });
        }

        textLines.forEach((line, index) => {
            const lineNum = index + 1;
            const chapterMatch = line.match(/^(Глава\s+\d+[\.:]?\s*[^\r\n]*)/);
            if (chapterMatch) {
                currentChapter = { fullTitle: chapterMatch[1].trim(), lineNum: lineNum };
            }

            if (!line.trim()) return;
            const lineErrors = [];
            let cleanedLine = line;

            ignoreWords.forEach(word => { cleanedLine = cleanedLine.replace(createWordRegex(word), '$1'); });

            if (checks.latin.checked && /[a-zA-Z]/.test(cleanedLine)) lineErrors.push({ id: errorIdCounter++, category: 'latin', message: `Найдена латиница: ${[...new Set(cleanedLine.match(/[a-zA-Z]/g))].join(', ')}` });
            if (checks.asian.checked && /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(cleanedLine)) lineErrors.push({ id: errorIdCounter++, category: 'asian', message: `Найдены азиатские иероглифы`});
            if (checks.asian.checked && /[\u0900-\u0dff\u0e00-\u0e7f]/.test(cleanedLine)) lineErrors.push({ id: errorIdCounter++, category: 'asian', message: `Найдены символы Южной Азии (бенгали, хинди и др.)`});
            if (checks.arabic.checked && /[\u0600-\u06ff\u0750-\u077f]/.test(cleanedLine)) lineErrors.push({ id: errorIdCounter++, category: 'arabic', message: `Найдены арабские символы`});
            if (checks.formatting.checked) {
                if (/^\s*[а-яё]/.test(line)) lineErrors.push({ id: errorIdCounter++, category: 'formatting', message: "Строка начинается с маленькой буквы" });
                if (/,\s*$/.test(line)) lineErrors.push({ id: errorIdCounter++, category: 'formatting', message: "Строка обрывается запятой" });
            }
            if (checks.stopwords.checked) {
                stopWords.forEach(word => { if (createWordRegex(word).test(cleanedLine)) { lineErrors.push({ id: errorIdCounter++, category: 'stopwords', message: `Найдено стоп-слово: '${word}'` }); } });
            }

            if (checks.grammar.checked && azLoaded) {
                const grammarErrors = checkGrammarErrors(cleanedLine, errorIdCounter);
                if (grammarErrors.length > 0) {
                    grammarErrors.forEach(err => { err.id = errorIdCounter++; });
                    lineErrors.push(...grammarErrors);
                }
            }

            if (lineErrors.length > 0) allErrors.push({ lineNum: lineNum, lineText: line, errors: lineErrors, chapter: currentChapter });
        });

        const chapterMentions = textLines.reduce((acc, line, index) => {
            const match = line.match(/^(Глава\s+\d+[\.:]?\s*[^\r\n]*)/);
            if (match) acc.push({ fullTitle: match[1].trim(), num: parseInt(match[1].match(/\d+/)[0], 10), lineNum: index + 1 });
            return acc;
        }, []);

        if (checks.sequence.checked && chapterMentions.length > 1) {
            for (let i = 0; i < chapterMentions.length - 1; i++) {
                const current = chapterMentions[i], next = chapterMentions[i + 1];
                if (next.num > current.num + 1) {
                    for (let missingNum = current.num + 1; missingNum < next.num; missingNum++) {
                        const error = { lineNum: current.lineNum, lineText: textLines[current.lineNum - 1], errors: [{ id: errorIdCounter++, category: 'sequence', message: `Пропущена глава: ${missingNum}` }], chapter: { fullTitle: current.fullTitle, lineNum: current.lineNum } };
                        allErrors.push(error);
                    }
                }
            }
        }

        if (checks.duplicates.checked && chapterMentions.length > 1) {
            const titlesMap = new Map();
            chapterMentions.forEach(ch => {
                if (!titlesMap.has(ch.fullTitle)) titlesMap.set(ch.fullTitle, []);
                titlesMap.get(ch.fullTitle).push(ch.lineNum);
            });
            titlesMap.forEach((lineNums, title) => {
                if (lineNums.length > 1) {
                    for (let i = 1; i < lineNums.length; i++) {
                        const lineNum = lineNums[i];
                        const dupChapterInfo = chapterMentions.find(ch => ch.lineNum === lineNum);
                        const otherLines = lineNums.filter(ln => ln !== lineNum).join(', ');
                        const error = { lineNum: lineNum, lineText: textLines[lineNum - 1], errors: [{ id: errorIdCounter++, category: 'duplicates', message: `Дубликат главы. Также найдена на строке(ах): ${otherLines}` }], chapter: { fullTitle: dupChapterInfo.fullTitle, lineNum: dupChapterInfo.lineNum } };
                        allErrors.push(error);
                    }
                }
            });
        }
        currentErrors = allErrors.sort((a,b) => a.lineNum - b.lineNum);
        displayResults();
    };

    const displayResults = () => {
        resultsEl.innerHTML = '';

        if (typeof contentDuplicates !== 'undefined' && contentDuplicates.length > 0) {
            const dupAlert = document.createElement('div');
            dupAlert.className = 'rst-duplicate-alert';

            const header = document.createElement('div');
            header.className = 'rst-duplicate-header';
            header.innerHTML = `<span>⚠️ Найдены крупные повторы текста (${contentDuplicates.length})</span>`;
            dupAlert.appendChild(header);

            contentDuplicates.forEach((dup, idx) => {
                const item = document.createElement('div');
                item.className = 'rst-dup-item';
                item.innerHTML = `
                    <div class="rst-dup-info">
                        <strong>Повтор #${idx + 1} (Длина: ${dup.length} симв.)</strong>
                        <span style="font-size:11px">Оригинал: стр. ${dup.origLine} [${dup.origChapter}]</span>
                        <span style="color:var(--error-color); font-size:11px">Дубль: стр. ${dup.dupLine} [${dup.dupChapter}]</span>
                        <div class="rst-dup-snippet">"${dup.snippet}"</div>
                    </div>
                    <button class="rst-btn-upload" style="border-color:var(--accent-color); color:var(--accent-color)">🔍 Сравнить</button>
                `;
                item.querySelector('button').addEventListener('click', () => openCompareModal(dup));
                dupAlert.appendChild(item);
            });
            resultsEl.appendChild(dupAlert);
        }

        const totalProblems = currentErrors.reduce((sum, errGroup) => sum + errGroup.errors.length, 0);

        if (totalProblems === 0) {
            resultsEl.innerHTML = '<div class="rst-success-message">✅ Проблем не найдено! Файл чист.</div>';
            copyLLMBtn.style.display = 'none';
            return;
        }

        copyLLMBtn.style.display = 'block';
        const summaryEl = document.createElement('div');
        summaryEl.className = 'rst-error-summary';
        summaryEl.textContent = `⚠️ Найдено проблем: ${totalProblems}`;
        resultsEl.appendChild(summaryEl);

        const groupingMode = document.querySelector('input[name="validator-grouping"]:checked').value;

        if (groupingMode === 'by-chapter') {
            displayResultsByChapter();
        } else {
            displayResultsByType();
        }

        resultsEl.querySelectorAll('.rst-error-resolve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const errorIdToRemove = parseInt(e.target.dataset.errorId, 10);
                currentErrors.forEach(group => {
                    group.errors = group.errors.filter(err => err.id !== errorIdToRemove);
                });
                currentErrors = currentErrors.filter(group => group.errors.length > 0);
                displayResults();
            });
        });
    };

    const createErrorLineElement = (errorGroup) => {
        const li = document.createElement('li');
        li.className = 'rst-error-item';

        const lineDiv = document.createElement('div');
        lineDiv.className = 'rst-error-line';
        lineDiv.innerHTML = `<span class="rst-error-line-num" title="Нажмите, чтобы перейти к строке">Строка ${errorGroup.lineNum}</span><span class="rst-error-line-text">${errorGroup.lineText}</span>`;
        lineDiv.querySelector('.rst-error-line-num').addEventListener('click', () => {
            const lines = sourceTextEl.value.split('\n');
            const pos = lines.slice(0, errorGroup.lineNum - 1).join('\n').length + (errorGroup.lineNum > 1 ? 1 : 0);
            sourceTextEl.focus();
            sourceTextEl.setSelectionRange(pos, pos + lines[errorGroup.lineNum - 1].length);
        });

        const detailsUl = document.createElement('ul');
        detailsUl.className = 'rst-error-details';
        errorGroup.errors.forEach(err => {
            const detailLi = document.createElement('li');
            detailLi.innerHTML = `<span>• ${err.message}</span><button class="rst-error-resolve-btn" data-error-id="${err.id}" title="Отметить как исправленное">[x]</button>`;
            if (err.category === 'sequence') detailLi.classList.add('rst-sequence-error');
            if (err.category === 'duplicates') detailLi.classList.add('rst-duplicate-error');
            if (err.category === 'grammar') detailLi.style.color = '#e5c07b';
            detailsUl.appendChild(detailLi);
        });

        li.appendChild(lineDiv);
        li.appendChild(detailsUl);
        return li;
    };

    const displayResultsByChapter = () => {
        const errorsByChapter = new Map();
        currentErrors.forEach(errorGroup => {
            const chapterTitle = errorGroup.chapter.fullTitle;
            if (!errorsByChapter.has(chapterTitle)) {
                errorsByChapter.set(chapterTitle, { lineNum: errorGroup.chapter.lineNum, errors: [] });
            }
            errorsByChapter.get(chapterTitle).errors.push(errorGroup);
        });

        const sortedChapters = [...errorsByChapter.entries()].sort((a, b) => a[1].lineNum - b[1].lineNum);

        sortedChapters.forEach(([chapterTitle, chapterData]) => {
            const details = document.createElement('details');
            details.open = true;
            const totalChapterErrors = chapterData.errors.reduce((sum, eg) => sum + eg.errors.length, 0);
            const summary = document.createElement('summary');
            summary.innerHTML = `${chapterTitle} <span style="color: var(--warning-color);">[${totalChapterErrors}]</span>`;
            details.appendChild(summary);

            const ul = document.createElement('ul');
            ul.className = 'rst-error-list';
            chapterData.errors.forEach(errorGroup => {
                ul.appendChild(createErrorLineElement(errorGroup));
            });
            details.appendChild(ul);
            resultsEl.appendChild(details);
        });
    };

    const displayResultsByType = () => {
        const errorsByCategory = new Map();
        const categoryNames = { latin: 'Латиница', asian: 'Иероглифы', arabic: 'Арабская вязь', formatting: 'Форматирование', stopwords: 'Стоп-слова', sequence: 'Порядок глав', duplicates: 'Дубликаты глав', grammar: 'Грамматика (Beta)' };

        currentErrors.forEach(group => {
            group.errors.forEach(error => {
                if (!errorsByCategory.has(error.category)) errorsByCategory.set(error.category, []);
                errorsByCategory.get(error.category).push({ ...group, error: error });
            });
        });

        const sortedCategories = [...errorsByCategory.keys()].sort((a, b) => Object.keys(categoryNames).indexOf(a) - Object.keys(categoryNames).indexOf(b));

        sortedCategories.forEach(category => {
            const errors = errorsByCategory.get(category);
            const details = document.createElement('details');
            details.open = true;
            const summary = document.createElement('summary');
            summary.innerHTML = `${categoryNames[category] || category} <span style="color: var(--warning-color);">[${errors.length}]</span>`;
            details.appendChild(summary);

            const ul = document.createElement('ul');
            ul.className = 'rst-error-list';
            const errorsByLine = new Map();
            errors.forEach(err => {
                if (!errorsByLine.has(err.lineNum)) errorsByLine.set(err.lineNum, []);
                errorsByLine.get(err.lineNum).push(err);
            });
            const sortedLines = [...errorsByLine.keys()].sort((a,b) => a-b);
            sortedLines.forEach(lineNum => {
                const lineErrors = errorsByLine.get(lineNum);
                ul.appendChild(createErrorLineElement({ lineNum: lineNum, lineText: lineErrors[0].lineText, errors: lineErrors.map(e => e.error)}));
            });
            details.appendChild(ul);
            resultsEl.appendChild(details);
        });
    };

    copyLLMBtn.addEventListener('click', () => {
        if (currentErrors.length === 0) return;

        let reportText = "Пожалуйста, исправь ошибки в следующих фрагментах текста. Не меняй смысл, исправь только грамматику, стилистику и указанные недочеты:\n\n";

        currentErrors.forEach(group => {
            const errorDescriptions = group.errors.map(e => `[${e.message}]`).join('; ');
            // Формат: Строка N: Текст // Ошибки
            reportText += `Строка ${group.lineNum}: ${group.lineText}\n>>> КОММЕНТАРИЙ: ${errorDescriptions}\n\n`;
        });

        navigator.clipboard.writeText(reportText).then(() => {
            const originalText = copyLLMBtn.textContent;
            copyLLMBtn.textContent = "Скопировано в буфер!";
            setTimeout(() => copyLLMBtn.textContent = originalText, 2000);
        }).catch(err => {
            console.error('Ошибка копирования:', err);
            alert('Не удалось скопировать текст.');
        });
    });

    const fixOverlay = document.getElementById('validator-fix-overlay');
    const startFixBtn = document.getElementById('validator-fix-btn');
    const fixQueueList = document.getElementById('fix-queue-list');
    const fixEditorContainer = document.getElementById('fix-editor-container');
    const fixEmptyState = document.getElementById('fix-empty-state');

    // Элементы
    const fixErrorDesc = document.getElementById('fix-current-errors-desc');
    const fixCategoryFilters = document.getElementById('fix-category-filters');
    const fixHistoryList = document.getElementById('fix-history-list');
    const fixProgressCircle = document.getElementById('fix-progress-circle');
    const fixCountDone = document.getElementById('fix-count-done');
    const fixCountTotal = document.getElementById('fix-count-total');

    // Элементы настроек списков
    const fixIgnoreEdit = document.getElementById('fix-ignore-edit');
    const fixStopEdit = document.getElementById('fix-stop-edit');
    const fixSaveListsBtn = document.getElementById('fix-save-lists-btn');

    let fixSessionLines = [];
    let fixTasks = [];
    let currentTaskIndex = -1;
    let resolvedCount = 0;
    let activeCategories = new Set();

    // Табы в сайдбаре
    document.querySelectorAll('.fix-sidebar-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.fix-sidebar-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.fix-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    // Сохранение списков из интерактива
    fixSaveListsBtn.addEventListener('click', () => {
        ignoreWordsEl.value = fixIgnoreEdit.value;
        stopWordsEl.value = fixStopEdit.value;
        saveSettings(); // Функция из основного скрипта валидатора
        fixSaveListsBtn.textContent = "Сохранено!";
        setTimeout(() => fixSaveListsBtn.textContent = "Сохранить словари", 1500);
    });

    const initFixSession = () => {
        if (currentErrors.length === 0) return;

        fixSessionLines = sourceTextEl.value.split('\n');
        fixTasks = [];
        resolvedCount = 0;
        fixHistoryList.innerHTML = '';

        // Загрузка списков в редактор
        fixIgnoreEdit.value = ignoreWordsEl.value;
        fixStopEdit.value = stopWordsEl.value;

        // Группировка
        const errorsByLine = new Map();
        const allCategories = new Set();

        currentErrors.forEach(group => {
            if (!errorsByLine.has(group.lineNum)) {
                errorsByLine.set(group.lineNum, {
                    lineNum: group.lineNum,
                    originalText: group.lineText,
                    errors: []
                });
            }
            group.errors.forEach(err => {
                errorsByLine.get(group.lineNum).errors.push(err);
                allCategories.add(err.category);
            });
        });

        fixTasks = Array.from(errorsByLine.values()).sort((a, b) => a.lineNum - b.lineNum);
        activeCategories = new Set(allCategories);
        renderFixFilters(Array.from(allCategories));
        renderFixList();

        fixOverlay.classList.add('active');
        updateFixStats();

        if(fixTasks.length > 0) selectFixTask(0);
    };

    const renderFixFilters = (categories) => {
        fixCategoryFilters.innerHTML = '';
        const catNames = { latin: 'Латиница', asian: 'Иероглифы', arabic: 'Араб.', formatting: 'Формат', stopwords: 'Стоп', sequence: 'Порядок', duplicates: 'Дубли', grammar: 'Грамматика' };

        categories.forEach(cat => {
            const el = document.createElement('div');
            el.className = 'fix-filter-tag active';
            el.textContent = catNames[cat] || cat;
            el.dataset.cat = cat;
            el.onclick = () => {
                el.classList.toggle('active');
                if (el.classList.contains('active')) activeCategories.add(cat);
                else activeCategories.delete(cat);
                renderFixList();
            };
            fixCategoryFilters.appendChild(el);
        });
    };

    const renderFixList = () => {
        fixQueueList.innerHTML = '';

        fixTasks.forEach((task, index) => {
            const hasActiveError = task.errors.some(e => activeCategories.has(e.category));
            if (!hasActiveError) return;

            const el = document.createElement('div');
            el.className = `fix-item ${task.resolved ? 'resolved' : ''} ${index === currentTaskIndex ? 'active' : ''}`;
            el.dataset.index = index;

            const errTypes = [...new Set(task.errors.map(e => e.category))].join(', ');

            el.innerHTML = `
                <div class="fix-item-line">
                    <span>Стр. ${task.lineNum}</span>
                    <span style="color: var(--warning-color)">${errTypes}</span>
                </div>
                <div class="fix-item-preview">${task.resolved ? '✅ Исправлено' : task.originalText}</div>
            `;
            el.onclick = () => selectFixTask(index);
            fixQueueList.appendChild(el);
        });
    };

    const fixUnifiedInput = document.getElementById('fix-unified-input');
    const fixUnifiedInfo = document.getElementById('fix-unified-info');
    let currentContextRange = { start: 0, end: 0 }; // Хранит индексы строк, которые сейчас в редакторе

    const selectFixTask = (index) => {
        currentTaskIndex = index;
        const task = fixTasks[index];

        // Подсветка в списке
        document.querySelectorAll('.fix-item').forEach(el => el.classList.remove('active'));
        const listItem = fixQueueList.querySelector(`.fix-item[data-index="${index}"]`);
        if (listItem) {
            listItem.classList.add('active');
            listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        fixEmptyState.style.display = 'none';
        fixEditorContainer.style.display = 'flex'; // Flex для растягивания

        const lineIdx = task.lineNum - 1; // 0-based index

        // Описание ошибок
        const messages = task.errors.filter(e => activeCategories.has(e.category)).map(e => `• ${e.message}`).join('<br>');
        fixErrorDesc.innerHTML = messages || 'Ошибки в скрытых категориях';

        // Вычисляем диапазон (Текущая - 2 ... Текущая + 2)
        // Учитываем границы файла
        const startIdx = Math.max(0, lineIdx - 2);
        const endIdx = Math.min(fixSessionLines.length - 1, lineIdx + 2);

        currentContextRange = { start: startIdx, end: endIdx };

        // Собираем текст из массива строк
        const textBlock = fixSessionLines.slice(startIdx, endIdx + 1).join('\n');

        fixUnifiedInput.value = textBlock;
        fixUnifiedInfo.textContent = `Редактирование строк ${startIdx + 1} - ${endIdx + 1} (Ошибка на ${task.lineNum})`;

        fixUnifiedInput.focus();
    };

    const applyFix = () => {
        if (currentTaskIndex === -1) return;
        const task = fixTasks[currentTaskIndex];

        // Получаем новый текст и разбиваем на строки
        const newText = fixUnifiedInput.value;
        // Разбиваем по переносу строки, учитывая разные форматы (CRLF, LF)
        const newLines = newText.split(/\r?\n/);

        const { start, end } = currentContextRange;
        const oldLength = end - start + 1;
        const newLength = newLines.length;
        const lengthDiff = newLength - oldLength;

        // 1. Внедряем изменения в основной массив (SPLICE заменяет старый кусок на новый)
        fixSessionLines.splice(start, oldLength, ...newLines);

        // 2. Если количество строк изменилось, нужно сдвинуть lineNum у всех ПОСЛЕДУЮЩИХ задач
        if (lengthDiff !== 0) {
            // Проходим по всем задачам
            for (let i = 0; i < fixTasks.length; i++) {
                // Если задача ссылается на строку, которая идет ПОСЛЕ текущего диапазона редактирования
                if (fixTasks[i].lineNum > (end + 1)) {
                    fixTasks[i].lineNum += lengthDiff;
                }
                // (Опционально) Если задача была внутри удаленного диапазона, она может стать некорректной,
                // но для простоты мы просто сдвигаем "хвост".
            }
            // Обновляем текущую задачу тоже, если вдруг мы решили вернуться к ней позже,
            // хотя логика "следующая задача" переключит нас дальше.
        }

        // Маркируем как решенное
        if (!task.resolved) {
            task.resolved = true;
            resolvedCount++;
            const histItem = document.createElement('div');
            histItem.className = 'fix-history-item';
            histItem.innerHTML = `Стр. ${task.lineNum} (исходная) изменена <span>${new Date().toLocaleTimeString()}</span>`;
            fixHistoryList.prepend(histItem);
        }

        updateFixStats();
        // Перерисовываем список, так как номера строк могли измениться (визуально можно не обновлять текст, но лучше обновить данные)
        // Чтобы не сбрасывать скролл, можно просто обновить lineNum внутри DOM, но проще перерисовать при следующем открытии.
        // Для текущей сессии просто идем дальше.

        findNextTask();
    };

    // Обработчик Ctrl+Enter
    fixUnifiedInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            applyFix();
        }
    });

    const findNextTask = () => {
        let nextIndex = -1;
        for (let i = currentTaskIndex + 1; i < fixTasks.length; i++) {
            const task = fixTasks[i];
            const hasActiveError = task.errors.some(e => activeCategories.has(e.category));
            if (!task.resolved && hasActiveError) {
                nextIndex = i;
                break;
            }
        }
        if (nextIndex !== -1) selectFixTask(nextIndex);
        else alert('Все видимые ошибки проверены!');
    };

    const updateFixStats = () => {
        const filteredTasks = fixTasks.filter(t => t.errors.some(e => activeCategories.has(e.category)));
        const total = filteredTasks.length;
        const done = filteredTasks.filter(t => t.resolved).length;

        fixCountDone.textContent = done;
        fixCountTotal.textContent = total;
        const percent = total > 0 ? Math.round((done / total) * 100) : 100;
        fixProgressCircle.textContent = `${percent}%`;
        fixProgressCircle.style.background = `conic-gradient(var(--accent-color) ${percent * 3.6}deg, transparent 0deg)`;
    };

    // Слушатели
    startFixBtn.addEventListener('click', initFixSession);

    document.getElementById('fix-cancel-btn').addEventListener('click', () => {
        if (confirm('Закрыть без сохранения изменений в исходном поле?')) {
            fixOverlay.classList.remove('active');
        }
    });

    document.getElementById('fix-finish-btn').addEventListener('click', () => {
        sourceTextEl.value = fixSessionLines.join('\n');
        fixOverlay.classList.remove('active');
        sourceTextEl.dispatchEvent(new Event('input'));
        // При желании можно перезапустить runValidation() здесь
    });

    document.getElementById('fix-apply-btn').addEventListener('click', applyFix);
    document.getElementById('fix-skip-btn').addEventListener('click', () => findNextTask());

    // Наблюдатель для кнопки старта (чтобы она появлялась только если есть ошибки)
    const observer = new MutationObserver(() => {
         if (resultsEl.innerHTML.includes('Найдено проблем')) {
             startFixBtn.style.display = 'inline-block';
         } else {
             startFixBtn.style.display = 'none';
         }
    });
    observer.observe(resultsEl, { childList: true, subtree: true });

    const validatorCopyBtn = document.getElementById('validator-copy-text-btn');

    validatorCopyBtn.addEventListener('click', async () => {
        const textLength = sourceTextEl.value.length;
        if (textLength === 0) return;

        const originalText = validatorCopyBtn.textContent;
        validatorCopyBtn.textContent = "⏳ Копирование...";
        validatorCopyBtn.disabled = true;

        try {
            await navigator.clipboard.writeText(sourceTextEl.value);

            validatorCopyBtn.textContent = `✅ Скопировано (${(textLength / 1000000).toFixed(1)} млн симв.)`;
            validatorCopyBtn.style.backgroundColor = 'var(--success-color)';
            validatorCopyBtn.style.color = 'white';
        } catch (err) {
            console.error('Ошибка копирования:', err);
            validatorCopyBtn.textContent = "❌ Ошибка (см. консоль)";
            sourceTextEl.select();
            document.execCommand('copy');
        }

        setTimeout(() => {
            validatorCopyBtn.textContent = originalText;
            validatorCopyBtn.disabled = false;
            validatorCopyBtn.style.backgroundColor = '';
            validatorCopyBtn.style.color = 'var(--success-color)';
        }, 2000);
    });





    loadSettings();
    [ignoreWordsEl, stopWordsEl].forEach(el => el.addEventListener('input', saveSettings));
    Object.values(checks).forEach(el => el.addEventListener('change', saveSettings));
    processBtn.addEventListener('click', runValidation);
    clearBtn.addEventListener('click', () => { sourceTextEl.value = ''; });
    groupingRadios.forEach(radio => radio.addEventListener('change', () => { if (currentErrors.length > 0) displayResults(); }));

    const dupModal = document.getElementById('dup-compare-modal');
    const dupCloseBtn = document.getElementById('dup-close-btn');
    const dupCancelBtn = document.getElementById('dup-cancel-btn');
    const dupTextOrig = document.getElementById('dup-text-orig');
    const dupTextCopy = document.getElementById('dup-text-copy');

    const closeDupModal = () => dupModal.classList.remove('active');
    dupCloseBtn.addEventListener('click', closeDupModal);
    dupCancelBtn.addEventListener('click', closeDupModal);

    const openCompareModal = (dupData) => {
        const fullText = sourceTextEl.value;
        const contextPadding = 500; // Символов контекста до и после

        // Функция для подсветки
        const formatContext = (start, length, isTarget) => {
            const contextStart = Math.max(0, start - contextPadding);
            const contextEnd = Math.min(fullText.length, start + length + contextPadding);

            const before = fullText.substring(contextStart, start);
            const target = fullText.substr(start, length);
            const after = fullText.substring(start + length, contextEnd);

            const div = document.createElement('div');
            // Экранируем HTML
            const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

            div.innerHTML = `
                <span style="opacity:0.6">${escape(before)}</span>
                <span class="${isTarget ? 'dup-target-highlight' : 'dup-highlight'}">
                    <b>${escape(target)}</b>
                </span>
                <span style="opacity:0.6">${escape(after)}</span>
            `;
            return div;
        };

        dupTextOrig.innerHTML = '';
        dupTextCopy.innerHTML = '';

        dupTextOrig.appendChild(formatContext(dupData.origStart, dupData.length, false));
        dupTextCopy.appendChild(formatContext(dupData.dupStart, dupData.length, true));

        // Скролл к выделению
        setTimeout(() => {
            dupTextOrig.querySelector('.dup-highlight').scrollIntoView({block: "center"});
            dupTextCopy.querySelector('.dup-target-highlight').scrollIntoView({block: "center"});
        }, 100);

        dupModal.classList.add('active');
    };

    (() => {
    const sourceEl = document.getElementById('sum-source-text');
    const resultEl = document.getElementById('sum-result-text');
    const slider = document.getElementById('sum-ratio-slider');
    const sliderVal = document.getElementById('sum-ratio-val');
    const processBtn = document.getElementById('sum-process-btn');
    const pasteBtn = document.getElementById('sum-paste-btn');
    const copyBtn = document.getElementById('sum-copy-btn');
    const statsEl = document.getElementById('sum-stats');

    // Обновление значения слайдера
    slider.addEventListener('input', () => {
        sliderVal.textContent = slider.value + '%';
    });

    // Вставка из буфера
    pasteBtn.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            sourceEl.value = text;
        } catch (err) {
            alert('Нет доступа к буферу обмена. Вставьте текст вручную (Ctrl+V).');
        }
    });

    // Копирование результата
    copyBtn.addEventListener('click', () => {
        resultEl.select();
        document.execCommand('copy');
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "Скопировано!";
        setTimeout(() => copyBtn.textContent = oldText, 2000);
    });


    // === ЛОГИКА ИЗВЛЕЧЕНИЯ АРТОВ ===
    const extractArtsBtn = document.getElementById('validator-extract-arts-btn');
    const artsModal = document.getElementById('arts-modal');
    const artsCloseBtn = document.getElementById('arts-close-btn');
    const artsCancelBtn = document.getElementById('arts-cancel-btn');
    const artsCopyBtn = document.getElementById('arts-copy-btn');
    const artsCutBtn = document.getElementById('arts-cut-btn'); // Получаем новую кнопку
    const artsTextarea = document.getElementById('arts-result-textarea');

    let textWithoutArts = ""; // Глобальная переменная для хранения текста БЕЗ артов

    const closeArtsModal = () => artsModal.classList.remove('active');
    artsCloseBtn.addEventListener('click', closeArtsModal);
    artsCancelBtn.addEventListener('click', closeArtsModal);

    artsCopyBtn.addEventListener('click', () => {
        artsTextarea.select();
        document.execCommand('copy');
        const origText = artsCopyBtn.textContent;
        artsCopyBtn.textContent = 'Скопировано!';
        setTimeout(() => artsCopyBtn.textContent = origText, 2000);
    });

    // Событие для новой кнопки "Вырезать из текста"
    artsCutBtn.addEventListener('click', () => {
        if (!textWithoutArts) return;

        // Применяем очищенный текст
        sourceTextEl.value = textWithoutArts;
        sourceTextEl.dispatchEvent(new Event('input')); // Обновляем UI валидатора

        const origText = artsCutBtn.textContent;
        artsCutBtn.textContent = 'Успешно вырезано!';
        artsCutBtn.disabled = true; // Блокируем от повторного нажатия
        setTimeout(() => {
            artsCutBtn.textContent = origText;
            artsCutBtn.disabled = false;
        }, 2000);
    });

    extractArtsBtn.addEventListener('click', () => {
        const text = sourceTextEl.value;
        if (!text) return;

        const lines = text.split('\n');
        let currentChapter = "Текст вне глав";
        let extractedData = new Map(); // Ключ: Глава, Значение: массив строк артов
        let newTextLines = [];
        let artsFound = 0;

        const chapterRegex = /^(Глава\s+\d+[\.:]?\s*[^\r\n]*)/;
        const artRegex = /^\[ДОБАВИТЬ АРТ\]:?\s*(.*)/i;

        lines.forEach(line => {
            const chapterMatch = line.match(chapterRegex);
            if (chapterMatch) {
                currentChapter = chapterMatch[1].trim();
            }

            // Проверяем начинается ли строка с [ДОБАВИТЬ АРТ]
            if (artRegex.test(line.trim())) {
                if (!extractedData.has(currentChapter)) {
                    extractedData.set(currentChapter, []);
                }
                extractedData.get(currentChapter).push(line.trim());
                artsFound++;
                // В newTextLines эту строку НЕ добавляем (таким образом готовим текст для вырезания)
            } else {
                newTextLines.push(line);
            }
        });

        if (artsFound === 0) {
            alert("Абзацы начинающиеся с [ДОБАВИТЬ АРТ] не найдены.");
            return;
        }

        // Формируем текст для модального окна
        let outputText = "";
        extractedData.forEach((arts, chapter) => {
            outputText += `${chapter}\n\n`;
            arts.forEach(art => {
                outputText += `${art}\n\n`;
            });
            outputText += `\n`; // Доп отступ между главами
        });

        // Сохраняем текст без артов в память, но НЕ вставляем в окно редактора
        textWithoutArts = newTextLines.join('\n');

        // Заполняем и показываем модальное окно
        artsTextarea.value = outputText.trim();
        artsModal.classList.add('active');
    });

    // === АЛГОРИТМ ПЕРЕСКАЗА ===
    const generateSummary = () => {
        const text = sourceEl.value.trim();
        if (!text) return;

        processBtn.textContent = "Обработка...";
        processBtn.disabled = true;

        // Даем браузеру отрисовать интерфейс перед тяжелой задачей
        setTimeout(() => {
            const ratio = parseInt(slider.value, 10) / 100;

            // 1. Разбивка на предложения (учитываем сокращения - это упрощенная регулярка)
            // Ищем точку, воскл или вопр знак, за которыми следует пробел и заглавная буква или конец строки
            const rawSentences = text.match(/[^.!?\n]+[.!?\n]+(\s|$)/g) || text.split('\n');

            // Очищаем предложения
            const sentences = rawSentences.map((s, index) => ({
                id: index,
                text: s.trim(),
                words: [],
                score: 0
            })).filter(s => s.text.length > 20); // Игнорируем слишком короткий мусор

            // 2. Список стоп-слов (русский + английский) для фильтрации шума
            const stopWords = new Set([
                "и", "в", "во", "не", "на", "я", "с", "он", "что", "а", "по", "к", "она", "мы", "о", "об",
                "они", "за", "у", "вы", "же", "то", "из", "но", "ты", "от", "мне", "еще", "нет", "да",
                "или", "только", "если", "для", "уже", "бы", "был", "была", "были", "было", "себя",
                "как", "так", "когда", "где", "эта", "этот", "эти", "том", "там", "тут", "ну", "со",
                "the", "a", "an", "in", "on", "at", "to", "is", "are", "was", "were", "of", "and", "or"
            ]);

            // 3. Токенизация и подсчет частот слов (TF)
            const wordFrequencies = {};

            sentences.forEach(s => {
                // Разбиваем на слова, убираем знаки препинания, приводим к нижнему регистру
                const tokens = s.text.toLowerCase().match(/[a-zа-яё0-9]+/g);
                if (tokens) {
                    s.words = tokens.filter(w => !stopWords.has(w) && w.length > 2);
                    s.words.forEach(w => {
                        // Если есть библиотека AZ.js, можно приводить к начальной форме (стемминг),
                        // но для скорости пока берем как есть
                        wordFrequencies[w] = (wordFrequencies[w] || 0) + 1;
                    });
                }
            });

            // 4. Взвешивание предложений
            sentences.forEach(s => {
                s.words.forEach(w => {
                    // Вес предложения = сумма частот входящих в него слов
                    if (wordFrequencies[w]) {
                        s.score += wordFrequencies[w];
                    }
                });
                // Нормализация: делим на количество слов, чтобы длинные предложения не побеждали всегда.
                // Но делаем мягкую нормализацию (делим не на N, а на корень из N),
                // чтобы длинные насыщенные предложения все же имели преимущество.
                if (s.words.length > 0) {
                    s.score = s.score / Math.pow(s.words.length, 0.5);
                }
            });

            // 5. Отбор лучших предложений
            // Сортируем по весу убывания
            const sortedByScore = [...sentences].sort((a, b) => b.score - a.score);

            // Вычисляем, сколько оставить
            const countToKeep = Math.max(1, Math.ceil(sentences.length * ratio));
            const topSentences = sortedByScore.slice(0, countToKeep);

            // 6. Восстановление хронологии
            // Сортируем выбранные предложения обратно по их индексу в исходном тексте
            topSentences.sort((a, b) => a.id - b.id);

            // 7. Сборка результата
            // Добавляем двойной перенос строки, если предложения были далеко друг от друга (абзацы)
            let resultText = "";
            let lastIdx = -1;

            topSentences.forEach(s => {
                 // Если разрыв между предложениями большой, добавляем пустую строку для читаемости
                if (lastIdx !== -1 && s.id > lastIdx + 1) {
                    resultText += "\n\n[...] ";
                } else if (lastIdx !== -1) {
                    resultText += " ";
                }
                resultText += s.text;
                lastIdx = s.id;
            });

            resultEl.value = resultText;

            // Статистика
            const inputChars = text.length;
            const outputChars = resultText.length;
            const compression = Math.round((1 - (outputChars / inputChars)) * 100);
            statsEl.textContent = `Исходно: ${sentences.length} предложений. Оставлено: ${countToKeep}. Сжато на ${compression}% по объему.`;

            processBtn.textContent = "⚡ Выполнить математическое сжатие";
            processBtn.disabled = false;
        }, 50); // Небольшая задержка для рендера UI
    };

    processBtn.addEventListener('click', generateSummary);
    })();

})();
})();