// ==UserScript==
// @name         RanobeLib Manager
// @namespace    http://tampermonkey.net/
// @version      7.3
// @description  Загрузка глав, очередь, платные главы, объединение (Merge), наценка за объем, статус на кнопке
// @author       You
// @match        *://ranobelib.me/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- КОНСТАНТЫ ---
    const STORAGE_KEY = 'rl_v7_queue';
    const STATE_KEY = 'rl_v7_state';
    const UI_POS_KEY = 'rl_v7_ui_pos';
    const SETTINGS_KEY = 'rl_v7_settings';
    const UI_MINIMIZED_KEY = 'rl_v7_minimized';

    // --- CSS ---
    GM_addStyle(`
        :root {
            --rl-bg: #1e1e1e;
            --rl-bg-header: #2d2d2d;
            --rl-bg-sec: #252525;
            --rl-text: #e0e0e0;
            --rl-text-muted: #888;
            --rl-accent: #3b82f6;
            --rl-accent-hover: #2563eb;
            --rl-border: #444;
            --rl-input-bg: #2d2d2d;
            --rl-shadow: rgba(0,0,0,0.5);
            --rl-success: #10b981;
            --rl-error: #ef4444;
            --rl-warn: #f59e0b;
            --rl-gold: #fbbf24;
            --rl-purple: #8b5cf6;
        }

        .rl-light-theme {
            --rl-bg: #ffffff;
            --rl-bg-header: #f3f4f6;
            --rl-bg-sec: #fafafa;
            --rl-text: #1f2937;
            --rl-text-muted: #6b7280;
            --rl-accent: #4f46e5;
            --rl-accent-hover: #4338ca;
            --rl-border: #e5e7eb;
            --rl-input-bg: #f9fafb;
            --rl-shadow: rgba(0,0,0,0.1);
        }

        /* --- Wrapper --- */
        #rl-wrapper {
            position: fixed; top: 100px; left: 100px;
            display: flex; align-items: flex-start;
            z-index: 100000;
            font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
            font-size: 14px;
            transition: opacity 0.2s;
        }

        /* --- Main Window --- */
        #rl-window {
            width: 500px;
            background: var(--rl-bg); color: var(--rl-text);
            border-radius: 12px;
            box-shadow: 0 10px 40px var(--rl-shadow);
            border: 1px solid var(--rl-border);
            display: flex; flex-direction: column;
            overflow: hidden; max-height: 90vh;
            position: relative;
            z-index: 2;
        }

        /* --- Report Panel --- */
        #rl-report-panel {
            width: 0; opacity: 0;
            background: var(--rl-bg-sec);
            border: 1px solid var(--rl-border);
            border-left: none;
            border-radius: 0 12px 12px 0;
            margin-left: -5px;
            height: auto; max-height: 80vh;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex; flex-direction: column;
            margin-top: 20px;
            z-index: 1;
        }
        #rl-report-panel.open {
            width: 320px; opacity: 1;
            margin-left: 0;
        }

        /* --- Header --- */
        .rl-header {
            padding: 12px 16px; background: var(--rl-bg-header);
            border-bottom: 1px solid var(--rl-border);
            display: flex; justify-content: space-between; align-items: center;
            cursor: grab; user-select: none; flex-shrink: 0;
        }
        .rl-header:active { cursor: grabbing; }
        .rl-title { font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; }

        .rl-status-badge {
            font-size: 11px; padding: 2px 8px; border-radius: 10px;
            background: var(--rl-border); color: var(--rl-text-muted);
        }
        .rl-status-active { background: var(--rl-success); color: white; }
        .rl-status-paused { background: var(--rl-warn); color: white; }

        .rl-mode-badge {
            font-size: 10px; padding: 2px 6px; border-radius: 4px;
            border: 1px solid transparent; font-weight: bold;
            margin-left: 5px; text-transform: uppercase;
        }
        .rl-mode-free { color: var(--rl-success); border-color: var(--rl-success); }
        .rl-mode-paid { color: var(--rl-gold); border-color: var(--rl-gold); background: rgba(251, 191, 36, 0.1); }

        /* --- Controls --- */
        .rl-win-controls { display: flex; gap: 8px; align-items: center; }
        .rl-icon-btn {
            background: none; border: 1px solid transparent; color: var(--rl-text-muted);
            cursor: pointer; padding: 4px; border-radius: 4px;
            transition: all 0.2s; display: flex; align-items: center; justify-content: center;
            width: 28px; height: 28px;
        }
        .rl-icon-btn:hover { background: var(--rl-border); color: var(--rl-text); }
        .rl-icon-btn.active { background: var(--rl-accent); color: white; border-color: var(--rl-accent); }

        /* --- Body --- */
        #rl-body, #rl-report-body {
            padding: 16px; display: flex; flex-direction: column; gap: 12px;
            overflow-y: auto;
        }
        #rl-report-body { padding: 10px; overflow-y: auto; height: 100%; }

        /* --- Progress Bar --- */
        .rl-progress-container {
            height: 6px; background: var(--rl-border); border-radius: 3px; overflow: hidden;
            margin-bottom: 5px; flex-shrink: 0;
        }
        #rl-progress-bar {
            height: 100%; width: 0%; background: var(--rl-accent);
            transition: width 0.3s ease;
        }
        .rl-progress-text { font-size: 12px; color: var(--rl-text-muted); text-align: right; }

        /* --- Logs --- */
        #rl-logs {
            height: 100px; background: var(--rl-input-bg);
            border: 1px solid var(--rl-border); border-radius: 6px;
            padding: 8px; overflow-y: auto; font-family: monospace; font-size: 11px;
            color: var(--rl-text); flex-shrink: 0;
        }
        .rl-log-item { margin-bottom: 3px; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 2px;}
        .rl-log-time { color: var(--rl-text-muted); margin-right: 6px; }
        .rl-log-info { color: var(--rl-accent); }
        .rl-log-success { color: var(--rl-success); }
        .rl-log-warn { color: var(--rl-warn); }
        .rl-log-error { color: var(--rl-error); }

        /* --- Input --- */
        #rl-input {
            width: 100%; height: 80px; background: var(--rl-input-bg);
            border: 1px solid var(--rl-border); border-radius: 6px;
            padding: 10px; color: var(--rl-text); resize: vertical;
            font-family: inherit; box-sizing: border-box; flex-shrink: 0;
        }
        #rl-input:focus { outline: 2px solid var(--rl-accent); border-color: transparent; }

        /* --- Merge Button Area --- */
        .rl-tools-bar { display: flex; justify-content: flex-end; gap: 8px; }

        /* --- Preview Area --- */
        #rl-preview-area {
            display: none; background: var(--rl-bg-sec);
            border: 1px solid var(--rl-border); border-radius: 6px;
            max-height: 180px; overflow-y: auto; flex-direction: column;
        }
        .rl-preview-header {
            padding: 8px 12px; font-size: 12px; font-weight: bold; color: var(--rl-text-muted);
            border-bottom: 1px solid var(--rl-border); background: var(--rl-bg-header);
            position: sticky; top: 0; display: flex; justify-content: space-between;
        }
        .rl-preview-item {
            padding: 6px 12px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex; justify-content: space-between; align-items: center;
        }
        .rl-preview-item:hover { background: rgba(255,255,255,0.03); }
        .rl-preview-item.rl-merged-item { background: rgba(139, 92, 246, 0.1); border-left: 2px solid var(--rl-purple); }
        .rl-del-btn { color: var(--rl-error); cursor: pointer; padding: 2px 6px; font-weight: bold; font-size: 14px; opacity: 0.7; }
        .rl-del-btn:hover { opacity: 1; background: rgba(239, 68, 68, 0.1); border-radius: 4px; }

        .rl-merged-badge {
            font-size: 10px; background: var(--rl-purple); color: white;
            padding: 1px 5px; border-radius: 4px; margin-right: 5px;
            cursor: help;
        }

        /* --- Settings --- */
        #rl-settings {
            padding: 10px 16px; background: var(--rl-bg); border-bottom: 1px solid var(--rl-border);
            display: none; flex-direction: column; gap: 10px; font-size: 12px; flex-shrink: 0;
            overflow-y: auto; max-height: 300px;
        }
        .rl-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
        .rl-setting-group { border: 1px solid var(--rl-border); padding: 8px; border-radius: 6px; background: var(--rl-bg-sec); margin-bottom: 5px; }
        .rl-setting-title { font-weight: bold; margin-bottom: 8px; color: var(--rl-accent); display: block; border-bottom: 1px solid var(--rl-border); padding-bottom: 4px;}
        input[type=range] { flex: 1; cursor: pointer; }
        input[type=number] { width: 60px; background: var(--rl-input-bg); border: 1px solid var(--rl-border); color: var(--rl-text); padding: 2px 5px; border-radius: 4px; }
        .rl-checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }

        .rl-radio-group { display: flex; flex-direction: column; gap: 4px; }
        .rl-radio-label { display: flex; align-items: center; gap: 6px; cursor: pointer; }

        /* --- Report Items --- */
        .rl-report-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--rl-border); font-size: 12px; }
        .rl-report-name { max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rl-badge-free { background: var(--rl-success); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
        .rl-badge-paid { background: var(--rl-gold); color: black; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; }

        /* --- Footer --- */
        #rl-footer, .rl-report-footer {
            padding: 12px 16px; border-top: 1px solid var(--rl-border);
            display: flex; gap: 10px; justify-content: flex-end;
            background: var(--rl-bg-header); flex-shrink: 0;
        }
        .rl-btn { padding: 8px 16px; border-radius: 6px; border: none; font-weight: 500; cursor: pointer; transition: transform 0.1s; font-size: 13px; }
        .rl-btn:active { transform: scale(0.97); }
        .rl-btn-primary { background: var(--rl-accent); color: white; }
        .rl-btn-primary:hover { background: var(--rl-accent-hover); }
        .rl-btn-secondary { background: var(--rl-border); color: var(--rl-text); }
        .rl-btn-purple { background: var(--rl-purple); color: white; }
        .rl-btn-purple:hover { background: #7c3aed; }
        .rl-btn-danger { background: var(--rl-error); color: white; }

        /* --- Floating Button --- */
        #rl-float-btn {
            position: fixed; bottom: 30px; right: 30px;
            height: 44px; min-width: 44px; padding: 0 10px;
            border-radius: 22px;
            background: var(--rl-accent); color: white;
            border: none; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            cursor: pointer; z-index: 99999;
            display: none;
            align-items: center; justify-content: center; gap: 8px;
            font-size: 14px; font-weight: bold;
            transition: transform 0.2s, min-width 0.3s;
            white-space: nowrap;
        }
        #rl-float-btn:hover { transform: scale(1.05); }
        #rl-float-btn .rl-spinner {
            width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3);
            border-top-color: white; border-radius: 50%;
            animation: rl-spin 1s linear infinite;
        }
        @keyframes rl-spin { to { transform: rotate(360deg); } }

        /* --- Modal --- */
        .rl-modal-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center;
            z-index: 10; padding: 20px; box-sizing: border-box; text-align: center;
        }
        .rl-modal-box {
            background: var(--rl-bg); border: 1px solid var(--rl-border);
            padding: 20px; border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.5);
        }
        .rl-modal-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: var(--rl-warn); }
        .rl-modal-actions { display: flex; gap: 10px; justify-content: center; margin-top: 15px; }

        .rl-hidden { display: none !important; }
    `);

    // --- HTML СТРУКТУРА ---
    const uiHTML = `
        <div id="rl-wrapper">
            <!-- MAIN WINDOW -->
            <div id="rl-window">
                <div id="rl-header" class="rl-header">
                    <div class="rl-title">
                        <span>🚀 RL V7.3</span>
                        <span id="rl-status-badge" class="rl-status-badge">IDLE</span>
                        <span id="rl-mode-badge" class="rl-mode-badge rl-mode-free">FREE</span>
                    </div>
                    <div class="rl-win-controls">
                        <button class="rl-icon-btn" id="rl-toggle-report-btn" title="Статистика/Отчет">📊</button>
                        <button class="rl-icon-btn" id="rl-theme-btn" title="Тема">🌗</button>
                        <button class="rl-icon-btn" id="rl-settings-btn" title="Настройки">⚙️</button>
                        <button class="rl-icon-btn" id="rl-minimize-btn" title="Свернуть">_</button>
                    </div>
                </div>

                <!-- SETTINGS PANEL -->
                <div id="rl-settings">
                    <div class="rl-setting-row">
                        <span>Прозрачность:</span>
                        <input type="range" id="rl-opacity-slider" min="20" max="100" value="100">
                    </div>
                    <div class="rl-setting-row">
                        <label class="rl-checkbox-label">
                            <input type="checkbox" id="rl-skip-title-chk">
                            Только номер главы (без названия)
                        </label>
                    </div>

                    <div class="rl-setting-group">
                        <span class="rl-setting-title">💰 Базовая цена</span>
                        <div class="rl-setting-row">
                            <label class="rl-checkbox-label">
                                <input type="checkbox" id="rl-paid-enable-chk">
                                <span style="font-weight:bold; color:var(--rl-warn)">Включить платные главы</span>
                            </label>
                        </div>
                        <div class="rl-setting-row">
                            <span>Цена (₽):</span>
                            <input type="number" id="rl-paid-price" value="5" min="0">
                        </div>
                        <div class="rl-setting-row">
                            <span>Бесплатный буфер (глав):</span>
                            <input type="number" id="rl-paid-buffer" value="0" min="0">
                        </div>
                    </div>

                    <div class="rl-setting-group">
                        <span class="rl-setting-title">🧩 Объединение и Цены</span>
                        <div style="font-size:11px;color:var(--rl-text-muted);margin-bottom:5px;">
                            Для глав вида "Глава (1)", "Глава (2)"
                        </div>

                        <div class="rl-radio-group">
                            <label class="rl-radio-label">
                                <input type="radio" name="merge_mode" value="percent" checked>
                                <span>Процент (+%) к цене</span>
                            </label>
                            <div class="rl-setting-row" style="padding-left:20px;">
                                <span>Процент:</span>
                                <input type="number" id="rl-merge-percent" value="50" min="0">%
                            </div>

                            <label class="rl-radio-label" style="margin-top:5px;">
                                <input type="radio" name="merge_mode" value="chars">
                                <span>За символы (N руб за M симв)</span>
                            </label>
                            <div class="rl-setting-row" style="padding-left:20px;">
                                <span>+ Рублей:</span>
                                <input type="number" id="rl-merge-char-price" value="2" min="0">
                            </div>
                            <div class="rl-setting-row" style="padding-left:20px;">
                                <span>За каждые (симв):</span>
                                <input type="number" id="rl-merge-char-count" value="2000" min="100">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- MAIN BODY -->
                <div id="rl-body">
                    <div>
                        <div class="rl-progress-container">
                            <div id="rl-progress-bar"></div>
                        </div>
                        <div class="rl-progress-text" id="rl-progress-label">Ожидание...</div>
                    </div>

                    <div id="rl-logs"></div>

                    <textarea id="rl-input" placeholder="Вставьте текст глав...&#10;Формат: 'Глава 12. Название (1)'&#10;Главы с (1), (2) можно объединить"></textarea>

                    <div class="rl-tools-bar">
                        <button class="rl-btn rl-btn-secondary rl-btn-purple" id="rl-merge-btn" title="Найти и объединить разделенные главы">🧩 Объединить</button>
                    </div>

                    <div id="rl-preview-area"></div>
                </div>

                <!-- FOOTER -->
                <div id="rl-footer">
                    <button class="rl-btn rl-btn-danger" id="rl-reset-btn">Сброс</button>
                    <button class="rl-btn rl-btn-primary" id="rl-start-btn">Старт</button>
                    <button class="rl-btn rl-btn-secondary rl-hidden" id="rl-pause-btn">Пауза</button>
                    <button class="rl-btn rl-btn-danger rl-hidden" id="rl-stop-btn">Стоп</button>
                </div>

                <!-- MODAL -->
                <div class="rl-modal-overlay" id="rl-confirm-modal">
                    <div class="rl-modal-box">
                        <div class="rl-modal-title">⚠️ Внимание!</div>
                        <p>Вы включаете режим платных глав.</p>
                        <p style="font-size:12px; color:var(--rl-text-muted)">Все последующие главы (кроме буфера) будут опубликованы платно.</p>
                        <div class="rl-modal-actions">
                            <button class="rl-btn rl-btn-secondary" id="rl-modal-cancel">Отмена</button>
                            <button class="rl-btn rl-btn-primary" id="rl-modal-confirm">Подтверждаю</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- REPORT PANEL -->
            <div id="rl-report-panel">
                 <div class="rl-header">
                    <div class="rl-title">📊 Отчет загрузки</div>
                 </div>
                 <div id="rl-report-body">
                    <div style="text-align:center; color:var(--rl-text-muted); margin-top:20px;">Нет данных</div>
                 </div>
                 <div class="rl-report-footer">
                    <span id="rl-report-summary" style="font-size:11px; color:var(--rl-text-muted);">0 / 0</span>
                 </div>
            </div>
        </div>

        <button id="rl-float-btn">📂</button>
    `;

    const rootDiv = document.createElement('div');
    rootDiv.innerHTML = uiHTML;
    document.body.appendChild(rootDiv);

    // --- ЭЛЕМЕНТЫ DOM ---
    const wrapper = document.getElementById('rl-wrapper');
    const win = document.getElementById('rl-window');
    const floatBtn = document.getElementById('rl-float-btn');
    const header = document.getElementById('rl-header');

    // Status Elements
    const statusBadge = document.getElementById('rl-status-badge');
    const modeBadge = document.getElementById('rl-mode-badge');
    const progressBar = document.getElementById('rl-progress-bar');
    const progressLabel = document.getElementById('rl-progress-label');
    const logs = document.getElementById('rl-logs');

    // Controls
    const reportPanel = document.getElementById('rl-report-panel');
    const toggleReportBtn = document.getElementById('rl-toggle-report-btn');
    const reportBody = document.getElementById('rl-report-body');
    const reportSummary = document.getElementById('rl-report-summary');
    const settingsPanel = document.getElementById('rl-settings');
    const settingsBtn = document.getElementById('rl-settings-btn');
    const themeBtn = document.getElementById('rl-theme-btn');
    const minimizeBtn = document.getElementById('rl-minimize-btn');
    const opacitySlider = document.getElementById('rl-opacity-slider');
    const mergeBtn = document.getElementById('rl-merge-btn');

    // Inputs & Paid
    const inputArea = document.getElementById('rl-input');
    const previewArea = document.getElementById('rl-preview-area');
    const skipTitleChk = document.getElementById('rl-skip-title-chk');
    const paidEnableChk = document.getElementById('rl-paid-enable-chk');
    const paidPriceInput = document.getElementById('rl-paid-price');
    const paidBufferInput = document.getElementById('rl-paid-buffer');
    const confirmModal = document.getElementById('rl-confirm-modal');
    const modalConfirmBtn = document.getElementById('rl-modal-confirm');
    const modalCancelBtn = document.getElementById('rl-modal-cancel');

    // Merge Settings
    const mergeModeRadios = document.getElementsByName('merge_mode');
    const mergePercentInput = document.getElementById('rl-merge-percent');
    const mergeCharPriceInput = document.getElementById('rl-merge-char-price');
    const mergeCharCountInput = document.getElementById('rl-merge-char-count');

    // Buttons
    const startBtn = document.getElementById('rl-start-btn');
    const resetBtn = document.getElementById('rl-reset-btn');
    const pauseBtn = document.getElementById('rl-pause-btn');
    const stopBtn = document.getElementById('rl-stop-btn');

    // --- СОСТОЯНИЕ ---
    let state = {
        queue: [],
        draftQueue: [],
        total: 0,
        processed: 0,
        isWorking: false,
        isPaused: false,
        uploadedLog: [],
        settings: {
            skipTitle: false,
            paidEnabled: false,
            paidPrice: 5,
            paidBuffer: 0,
            mergeMode: 'percent',
            mergePercent: 50,
            mergeCharPrice: 2,
            mergeCharCount: 2000
        }
    };

    // --- DRAG & DROP ---
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.rl-win-controls')) return;
        isDragging = true; startX = e.clientX; startY = e.clientY;
        const rect = wrapper.getBoundingClientRect();
        initialLeft = rect.left; initialTop = rect.top;
        header.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        wrapper.style.left = `${initialLeft + (e.clientX - startX)}px`;
        wrapper.style.top = `${initialTop + (e.clientY - startY)}px`;
    });
    window.addEventListener('mouseup', () => {
        if(isDragging) { isDragging = false; header.style.cursor = 'grab';
        localStorage.setItem(UI_POS_KEY, JSON.stringify({ left: wrapper.style.left, top: wrapper.style.top })); }
    });
    const savedPos = JSON.parse(localStorage.getItem(UI_POS_KEY));
    if (savedPos) { wrapper.style.left = savedPos.left; wrapper.style.top = savedPos.top; }

    // --- UI ЛОГИКА ---
    themeBtn.onclick = () => { wrapper.classList.toggle('rl-light-theme'); localStorage.setItem('rl_theme', wrapper.classList.contains('rl-light-theme') ? 'light' : 'dark'); };
    if (localStorage.getItem('rl_theme') === 'light') wrapper.classList.add('rl-light-theme');

    function toggleWindow(isMin) {
        if (isMin) {
            wrapper.style.display = 'none'; floatBtn.style.display = 'flex';
            localStorage.setItem(UI_MINIMIZED_KEY, 'true');
        } else {
            wrapper.style.display = 'flex'; floatBtn.style.display = 'none';
            localStorage.setItem(UI_MINIMIZED_KEY, 'false');
        }
    }
    minimizeBtn.onclick = () => toggleWindow(true);
    floatBtn.onclick = () => toggleWindow(false);
    if (localStorage.getItem(UI_MINIMIZED_KEY) === 'true') { wrapper.style.display = 'none'; floatBtn.style.display = 'flex'; }
    else { wrapper.style.display = 'flex'; floatBtn.style.display = 'none'; }

    toggleReportBtn.onclick = () => {
        reportPanel.classList.toggle('open'); toggleReportBtn.classList.toggle('active');
        if (reportPanel.classList.contains('open')) renderReport();
    };
    settingsBtn.onclick = () => settingsPanel.style.display = settingsPanel.style.display === 'flex' ? 'none' : 'flex';
    opacitySlider.oninput = (e) => { win.style.opacity = e.target.value / 100; localStorage.setItem('rl_opacity', e.target.value); };
    if (localStorage.getItem('rl_opacity')) { win.style.opacity = localStorage.getItem('rl_opacity') / 100; opacitySlider.value = localStorage.getItem('rl_opacity'); }

    // --- НАСТРОЙКИ ---
    paidEnableChk.addEventListener('click', (e) => {
        if (paidEnableChk.checked) { e.preventDefault(); confirmModal.style.display = 'flex'; }
        else { state.settings.paidEnabled = false; saveSettingsUI(); updateUI(); }
    });
    modalConfirmBtn.onclick = () => { paidEnableChk.checked = true; state.settings.paidEnabled = true; confirmModal.style.display = 'none'; saveSettingsUI(); updateUI(); addLog('Платный режим ВКЛЮЧЕН', 'warn'); };
    modalCancelBtn.onclick = () => { paidEnableChk.checked = false; confirmModal.style.display = 'none'; };

    function saveSettingsUI() {
        const s = {
            skipTitle: skipTitleChk.checked,
            paidEnabled: paidEnableChk.checked,
            paidPrice: parseInt(paidPriceInput.value),
            paidBuffer: parseInt(paidBufferInput.value),
            mergeMode: Array.from(mergeModeRadios).find(r => r.checked).value,
            mergePercent: parseInt(mergePercentInput.value),
            mergeCharPrice: parseInt(mergeCharPriceInput.value),
            mergeCharCount: parseInt(mergeCharCountInput.value)
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
        state.settings = s;
        updateUI();
    }
    function loadSettings() {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        if (saved) {
            state.settings = saved;
            skipTitleChk.checked = saved.skipTitle;
            paidEnableChk.checked = saved.paidEnabled;
            paidPriceInput.value = saved.paidPrice || 5;
            paidBufferInput.value = saved.paidBuffer || 0;
            // Merge settings
            Array.from(mergeModeRadios).forEach(r => r.checked = (r.value === saved.mergeMode));
            mergePercentInput.value = saved.mergePercent || 50;
            mergeCharPriceInput.value = saved.mergeCharPrice || 2;
            mergeCharCountInput.value = saved.mergeCharCount || 2000;
            updateUI();
        }
    }
    const settingsInputs = [
        skipTitleChk, paidPriceInput, paidBufferInput,
        mergePercentInput, mergeCharPriceInput, mergeCharCountInput
    ];
    settingsInputs.forEach(el => el.addEventListener('change', saveSettingsUI));
    Array.from(mergeModeRadios).forEach(el => el.addEventListener('change', saveSettingsUI));
    loadSettings();

    // --- ПАРСИНГ И ОБЪЕДИНЕНИЕ ---
    let debounceTimer;
    inputArea.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const text = inputArea.value;
            if (!text.trim()) { previewArea.style.display = 'none'; state.draftQueue = []; mergeBtn.style.display = 'none'; return; }
            state.draftQueue = parseTextToChapters(text);
            mergeBtn.style.display = 'block';
            renderPreview();
        }, 500);
    });

    function parseTextToChapters(text) {
        const chunks = text.split(/\n(?=Глава\s+\d)/i);
        const parsed = [];
        chunks.forEach(chunk => {
            const lines = chunk.trim().split('\n');
            if (lines.length < 2) return;
            const rawTitleLine = lines.shift();
            let title = rawTitleLine.replace(/^\s*Глава\s+\d+(\.\d+)?\.?[-:.]?\s*/i, '').trim();
            if (!title) title = rawTitleLine.trim();
            const body = lines.map(l=>l.trim()).filter(l=>l.length>0).join('\n');
            if (title && body) parsed.push({ title, body, isMerged: false, mergedCount: 1 });
        });
        return parsed;
    }

    // --- ЛОГИКА ОБЪЕДИНЕНИЯ ---
    mergeBtn.onclick = () => {
        if (state.draftQueue.length < 2) { addLog("Мало глав для объединения", "warn"); return; }

        const partRegex = /\s*[(\[]\s*\d+\s*[)\]]\s*$/; // Matches (1), [2] at end
        let mergedQueue = [];
        let lastItem = null;
        let mergeCount = 0;

        state.draftQueue.forEach(chap => {
            // Очищаем заголовок от (1)
            let cleanTitle = chap.title.replace(partRegex, '').trim();

            // Если предыдущая глава существует и у неё такой же чистый заголовок
            if (lastItem && lastItem.cleanTitle === cleanTitle) {
                // Объединяем
                lastItem.body += '\n\n' + chap.body;
                lastItem.mergedCount++;
                lastItem.isMerged = true;
                lastItem.title = cleanTitle; // Устанавливаем чистое название

                // Расчет цены
                lastItem.customPrice = calculateMergedPrice(lastItem.body.length);
                mergeCount++;
            } else {
                // Новая запись
                let newItem = {
                    ...chap,
                    title: chap.title, // Сначала берем оригинал, если не объединится
                    cleanTitle: cleanTitle // Храним для сравнения
                };
                // Если сама глава выглядит как часть, но первая в серии, переименуем её в чистое сразу?
                // Нет, лучше переименовывать только если произошло объединение, иначе это может быть просто название с цифрой
                // Но для консистентности, если мы запускаем Merge, мы ожидаем очистку.
                // Давайте сделаем так: если detected pattern, сохраняем cleanTitle как основной, если произойдет merge.
                // Если merge не произошел, оставляем как есть? Или очищаем?
                // Пользователь просит: "Глава 12. Название (1)" + "Глава 12. Название (2)" -> "Глава 12. Название".

                mergedQueue.push(newItem);
                lastItem = newItem;
            }
        });

        if (mergeCount > 0) {
            state.draftQueue = mergedQueue;
            addLog(`Объединено частей: ${mergeCount}`, 'success');
            renderPreview();
        } else {
            addLog("Не найдено глав для объединения", "info");
        }
    };

    function calculateMergedPrice(totalLength) {
        if (!state.settings.paidEnabled) return 0;
        const base = state.settings.paidPrice;

        if (state.settings.mergeMode === 'percent') {
            // Base + Percent
            return Math.floor(base * (1 + state.settings.mergePercent / 100));
        } else {
            // Char Count: Base + floor(Length / Step) * PricePerStep
            // Пример: 7000 симв, шаг 2000, цена 2.
            // Добавка: floor(7000/2000) * 2 = 3 * 2 = 6. Итого Base + 6.
            const extra = Math.floor(totalLength / state.settings.mergeCharCount) * state.settings.mergeCharPrice;
            return base + extra;
        }
    }

    function renderPreview() {
        if (state.draftQueue.length === 0) { previewArea.style.display = 'none'; return; }
        let html = `<div class="rl-preview-header"><span>Главы: ${state.draftQueue.length}</span></div>`;
        state.draftQueue.forEach((chap, idx) => {
            let badges = '';
            let extraInfo = '';
            let rowClass = 'rl-preview-item';

            if (chap.isMerged) {
                rowClass += ' rl-merged-item';
                let priceStr = state.settings.paidEnabled ? ` | Цена: ${chap.customPrice}₽` : '';
                badges = `<span class="rl-merged-badge" title="Объединено частей: ${chap.mergedCount}${priceStr}">🧩 ${chap.mergedCount}</span>`;
            }

            html += `<div class="${rowClass}" data-idx="${idx}">
                        <div style="display:flex;align-items:center;overflow:hidden;">
                            ${badges}
                            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">#${idx+1} ${chap.title}</span>
                        </div>
                        <span class="rl-del-btn">✖</span>
                     </div>`;
        });
        previewArea.innerHTML = html; previewArea.style.display = 'flex';
        previewArea.querySelectorAll('.rl-del-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.closest('.rl-preview-item').getAttribute('data-idx'));
                state.draftQueue.splice(idx, 1); renderPreview();
            };
        });
    }

    // --- ЗАПУСК ---
    startBtn.onclick = () => {
        if (state.draftQueue.length === 0) { addLog('Нет глав!', 'error'); return; }
        state.queue = [...state.draftQueue];
        state.total = state.queue.length;
        state.processed = 0;
        state.isWorking = true;
        state.isPaused = false;
        state.uploadedLog = [];
        inputArea.style.display = 'none'; previewArea.style.display = 'none'; mergeBtn.style.display = 'none';
        toggleWindow(true);
        saveSettingsUI(); saveState(); updateUI(); processQueue();
    };

    pauseBtn.onclick = () => { state.isPaused = !state.isPaused; updateUI(); };
    stopBtn.onclick = () => {
        if(confirm('Стоп?')) { state.isWorking = false; state.queue = []; inputArea.style.display = 'block'; updateUI(); }
    };
    resetBtn.onclick = () => { sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(STATE_KEY); window.location.reload(); };

    function updateButtonState() {
        if (state.isWorking) {
            startBtn.classList.add('rl-hidden'); resetBtn.classList.add('rl-hidden');
            pauseBtn.classList.remove('rl-hidden'); stopBtn.classList.remove('rl-hidden');
            pauseBtn.innerText = state.isPaused ? "Продолжить" : "Пауза";
            statusBadge.innerText = state.isPaused ? "PAUSED" : "WORKING";
            statusBadge.className = state.isPaused ? "rl-status-badge rl-status-paused" : "rl-status-badge rl-status-active";
        } else {
            startBtn.classList.remove('rl-hidden'); resetBtn.classList.remove('rl-hidden');
            pauseBtn.classList.add('rl-hidden'); stopBtn.classList.add('rl-hidden');
            statusBadge.innerText = "IDLE"; statusBadge.className = "rl-status-badge";
        }
    }

    // --- ПРОЦЕССИНГ ---
    async function processQueue() {
        if (!state.isWorking) return;
        if (!window.location.href.includes('/add-chapter')) {
            addLog('Переход на страницу добавления...', 'warn');
            const link = document.querySelector('a[href*="/add-chapter"]');
            if(link) link.click(); else { addLog('Ссылка не найдена!', 'error'); state.isPaused = true; updateUI(); }
            return;
        }

        while (state.queue.length > 0 && state.isWorking) {
            if (state.isPaused) { await sleep(500); continue; }
            const chapter = state.queue[0];
            const currentCount = state.uploadedLog.length + 1;
            updateUI();

            addLog(`Загрузка: "${chapter.title}"`);
            const titleInput = document.querySelector('input[placeholder="Название главы"]');
            const editor = document.querySelector('.tiptap.ProseMirror');

            if (!titleInput || !editor) { await sleep(1000); continue; }
            if (titleInput.value) {
                const addMore = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('добавить ещё главу'));
                if (addMore) { addMore.click(); return; }
                await sleep(2000); continue;
            }

            if (!state.settings.skipTitle) setInput(titleInput, chapter.title);
            await sleep(300);
            editor.innerHTML = chapter.body.split('\n').map(l => `<p>${l}</p>`).join('');
            editor.dispatchEvent(new Event('input', { bubbles: true }));

            let isPaid = false, finalPrice = 0;
            if (state.settings.paidEnabled && currentCount > state.settings.paidBuffer) {
                // Определяем цену: если есть customPrice (от объединения), берем её, иначе базовую
                finalPrice = (chapter.customPrice && chapter.customPrice > 0) ? chapter.customPrice : state.settings.paidPrice;

                const iconButtons = Array.from(document.querySelectorAll('button.btn.is-icon.is-outline.variant-light'));
                const settingsBtnElement = iconButtons.find(btn => btn.querySelector('svg[data-icon="gear"]'));
                if (settingsBtnElement) {
                    settingsBtnElement.click(); await sleep(600);
                    const tippyBox = document.querySelector('.tippy-content');
                    if (tippyBox) {
                        const paidCheckbox = tippyBox.querySelector('input[type="checkbox"]');
                        if (paidCheckbox && !paidCheckbox.checked) { paidCheckbox.click(); await sleep(200); }
                        isPaid = true;
                        const priceInput = tippyBox.querySelector('input.form-input__field[type="text"]');
                        if (priceInput) { setInput(priceInput, finalPrice); }
                        settingsBtnElement.click();
                    }
                }
            }
            await sleep(800);

            let createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Создать');
            if (createBtn && !createBtn.disabled) {
                createBtn.click();
                addLog(`Успех!`, 'success');
                state.uploadedLog.push({ title: chapter.title, isPaid, price: finalPrice, isMerged: chapter.isMerged });

                state.queue.shift();
                state.processed++;
                saveState(); updateUI(); renderReport();

                if (state.queue.length === 0) {
                    state.isWorking = false;
                    state.isPaused = false;
                    addLog('Все загружено! Финиш.', 'success');
                    saveState(); updateUI();
                    inputArea.style.display = 'block'; inputArea.value = '';
                    toggleWindow(false);
                    if(!reportPanel.classList.contains('open')) toggleReportBtn.click();
                    alert('Загрузка завершена!');
                    return;
                }

                await sleep(2500);
                for(let i=0; i<15; i++) {
                    const addMore = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('добавить ещё главу'));
                    if (addMore) { window.location.href = addMore.href; return; }
                    await sleep(500);
                }
                window.location.reload(); return;
            } else {
                state.isPaused = true; updateUI(); alert('Ошибка кнопки создания!');
            }
        }
    }

    // --- Helpers ---
    function addLog(msg, type = 'info') {
        const div = document.createElement('div'); div.className = `rl-log-item rl-log-${type}`;
        div.innerHTML = `<span class="rl-log-time">${new Date().toLocaleTimeString('ru-RU')}</span>${msg}`;
        logs.appendChild(div); logs.scrollTop = logs.scrollHeight;
    }

    function updateUI() {
        const pct = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;
        progressBar.style.width = `${pct}%`;
        progressLabel.innerText = state.total > 0 ? `${pct}% (${state.processed} / ${state.total})` : 'Ожидание...';

        if(state.settings.paidEnabled) { modeBadge.innerText = "PAID 💰"; modeBadge.className = "rl-mode-badge rl-mode-paid"; }
        else { modeBadge.innerText = "FREE"; modeBadge.className = "rl-mode-badge rl-mode-free"; }

        if(state.isWorking) {
            const icon = state.settings.paidEnabled ? '💰' : '🟢';
            const spin = state.isPaused ? '⏸️' : '<div class="rl-spinner"></div>';
            floatBtn.innerHTML = `${state.processed}/${state.total} ${icon} ${spin}`;
        } else { floatBtn.innerHTML = '📂'; }
        updateButtonState();
    }

    function renderReport() {
        if (state.uploadedLog.length === 0) { reportBody.innerHTML = '<div style="margin-top:20px;text-align:center;color:#888;">Нет данных</div>'; return; }
        let html = '', total = 0;
        state.uploadedLog.forEach((item, i) => {
            const badge = item.isPaid ? `<span class="rl-badge-paid">${item.price}₽</span>` : `<span class="rl-badge-free">FREE</span>`;
            const mergeIcon = item.isMerged ? '<span style="font-size:10px;margin-right:4px;">🧩</span>' : '';
            if(item.isPaid) total += item.price;
            html += `<div class="rl-report-item"><span style="color:#888;margin-right:5px;">${i+1}.</span>${mergeIcon}<span class="rl-report-name">${item.title}</span>${badge}</div>`;
        });
        reportBody.innerHTML = html; reportSummary.innerHTML = `Глав: ${state.uploadedLog.length} | Выручка: ~${total}₽`;
    }

    function setInput(el, val) { el.value = val; el._valueTracker?.setValue(''); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); }
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function saveState() {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.queue));
        sessionStorage.setItem(STATE_KEY, JSON.stringify({
            total: state.total, processed: state.processed, isWorking: state.isWorking,
            uploadedLog: state.uploadedLog, settings: state.settings
        }));
    }

    const savedQ = sessionStorage.getItem(STORAGE_KEY);
    const savedS = sessionStorage.getItem(STATE_KEY);
    if (savedQ && savedS) {
        state.queue = JSON.parse(savedQ);
        const meta = JSON.parse(savedS);
        Object.assign(state, meta);
        if (state.isWorking && state.queue.length > 0) {
            toggleWindow(true);
            inputArea.style.display = 'none'; previewArea.style.display = 'none'; mergeBtn.style.display = 'none';
            updateUI();
            setTimeout(processQueue, 1500);
        } else { if(state.uploadedLog.length > 0) updateUI(); }
    }
})();