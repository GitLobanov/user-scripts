// ==UserScript==
// @name         RanobeLib Uploader V5.2 (Live Preview)
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Предпросмотр глав, отчет, настройки и современный UI
// @author       You
// @match        *://ranobelib.me/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- КОНСТАНТЫ ---
    const STORAGE_KEY = 'rl_v5_queue';
    const STATE_KEY = 'rl_v5_state';
    const UI_POS_KEY = 'rl_v5_ui_pos';
    const SETTINGS_SKIP_TITLE_KEY = 'rl_skip_title';

    // --- CSS (MODERN UI) ---
    GM_addStyle(`
        :root {
            --rl-bg: #1e1e1e;
            --rl-bg-header: #2d2d2d;
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
        }

        .rl-light-theme {
            --rl-bg: #ffffff;
            --rl-bg-header: #f3f4f6;
            --rl-text: #1f2937;
            --rl-text-muted: #6b7280;
            --rl-accent: #4f46e5;
            --rl-accent-hover: #4338ca;
            --rl-border: #e5e7eb;
            --rl-input-bg: #f9fafb;
            --rl-shadow: rgba(0,0,0,0.1);
        }

        /* --- Main Window --- */
        #rl-window {
            position: fixed; top: 100px; left: 100px; width: 500px;
            background: var(--rl-bg); color: var(--rl-text);
            border-radius: 12px; box-shadow: 0 10px 40px var(--rl-shadow);
            border: 1px solid var(--rl-border);
            z-index: 100000; display: none; flex-direction: column;
            font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
            font-size: 14px; transition: opacity 0.2s, box-shadow 0.2s;
            overflow: hidden;
            max-height: 90vh; /* Limit height */
        }

        /* --- Header (Draggable) --- */
        #rl-header {
            padding: 12px 16px; background: var(--rl-bg-header);
            border-bottom: 1px solid var(--rl-border);
            display: flex; justify-content: space-between; align-items: center;
            cursor: grab; user-select: none;
            flex-shrink: 0;
        }
        #rl-header:active { cursor: grabbing; }
        .rl-title { font-weight: 600; font-size: 15px; display: flex; align-items: center; gap: 8px; }
        .rl-status-badge {
            font-size: 11px; padding: 2px 8px; border-radius: 10px;
            background: var(--rl-border); color: var(--rl-text-muted);
        }
        .rl-status-active { background: var(--rl-success); color: white; }
        .rl-status-paused { background: var(--rl-warn); color: white; }

        /* --- Controls --- */
        .rl-win-controls { display: flex; gap: 10px; align-items: center; }
        .rl-icon-btn {
            background: none; border: none; color: var(--rl-text-muted);
            cursor: pointer; padding: 4px; border-radius: 4px;
            transition: color 0.2s, background 0.2s;
            display: flex; align-items: center; justify-content: center;
        }
        .rl-icon-btn:hover { background: var(--rl-border); color: var(--rl-text); }

        /* --- Body --- */
        #rl-body {
            padding: 16px; display: flex; flex-direction: column; gap: 12px;
            overflow-y: auto;
        }

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
            padding: 8px; overflow-y: auto; font-family: monospace; font-size: 12px;
            color: var(--rl-text); flex-shrink: 0;
        }
        .rl-log-item { margin-bottom: 4px; line-height: 1.4; border-bottom: 1px dashed var(--rl-border); padding-bottom: 2px;}
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

        /* --- Preview Area (NEW) --- */
        #rl-preview-area {
            display: none; /* Hidden by default */
            background: var(--rl-bg-header);
            border: 1px solid var(--rl-border);
            border-radius: 6px;
            max-height: 150px;
            overflow-y: auto;
            padding: 5px 0;
        }
        .rl-preview-header {
            padding: 0 10px 5px 10px;
            font-size: 12px; font-weight: bold;
            color: var(--rl-text-muted);
            border-bottom: 1px solid var(--rl-border);
            margin-bottom: 5px;
            display: flex; justify-content: space-between;
        }
        .rl-preview-item {
            padding: 4px 10px;
            font-size: 13px;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex; justify-content: space-between; align-items: center;
        }
        .rl-preview-item:last-child { border-bottom: none; }
        .rl-preview-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%; }
        .rl-preview-meta { font-size: 11px; color: var(--rl-text-muted); }

        /* --- Settings Panel --- */
        #rl-settings {
            padding: 10px 16px; background: var(--rl-bg); border-bottom: 1px solid var(--rl-border);
            display: none; flex-direction: column; gap: 10px; font-size: 12px; flex-shrink: 0;
        }
        .rl-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        input[type=range] { flex: 1; cursor: pointer; }
        .rl-checkbox-label { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }

        /* --- Footer --- */
        #rl-footer {
            padding: 12px 16px; border-top: 1px solid var(--rl-border);
            display: flex; gap: 10px; justify-content: flex-end;
            background: var(--rl-bg-header); flex-shrink: 0;
        }
        .rl-btn {
            padding: 8px 16px; border-radius: 6px; border: none; font-weight: 500;
            cursor: pointer; transition: transform 0.1s, opacity 0.2s; font-size: 13px;
        }
        .rl-btn:active { transform: scale(0.97); }
        .rl-btn-primary { background: var(--rl-accent); color: white; }
        .rl-btn-primary:hover { background: var(--rl-accent-hover); }
        .rl-btn-secondary { background: var(--rl-border); color: var(--rl-text); }
        .rl-btn-secondary:hover { opacity: 0.8; }
        .rl-btn-danger { background: var(--rl-error); color: white; }
        .rl-btn-danger:hover { opacity: 0.9; }

        /* --- Floating Button --- */
        #rl-float-btn {
            position: fixed; bottom: 30px; right: 30px;
            width: 50px; height: 50px; border-radius: 50%;
            background: var(--rl-accent); color: white;
            border: none; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            cursor: pointer; z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; transition: transform 0.2s;
        }
        #rl-float-btn:hover { transform: scale(1.1); }
    `);

    // --- HTML СТРУКТУРА ---
    const uiHTML = `
        <div id="rl-window">
            <div id="rl-header">
                <div class="rl-title">
                    <span>🚀 RL Uploader V5.2</span>
                    <span id="rl-status-badge" class="rl-status-badge">IDLE</span>
                </div>
                <div class="rl-win-controls">
                    <button class="rl-icon-btn" id="rl-theme-btn" title="Тема">🌗</button>
                    <button class="rl-icon-btn" id="rl-settings-btn" title="Настройки">⚙️</button>
                    <button class="rl-icon-btn" id="rl-minimize-btn" title="Свернуть">_</button>
                </div>
            </div>

            <div id="rl-settings">
                <div class="rl-setting-row">
                    <span>Прозрачность:</span>
                    <input type="range" id="rl-opacity-slider" min="20" max="100" value="100">
                </div>
                <div class="rl-setting-row">
                    <label class="rl-checkbox-label">
                        <input type="checkbox" id="rl-skip-title-chk">
                        Не заполнять название главы
                    </label>
                </div>
            </div>

            <div id="rl-body">
                <div>
                    <div class="rl-progress-container">
                        <div id="rl-progress-bar"></div>
                    </div>
                    <div class="rl-progress-text" id="rl-progress-label">Готов к работе</div>
                </div>

                <div id="rl-logs"></div>

                <textarea id="rl-input" placeholder="Вставьте текст глав...&#10;Разделитель: строка начинающаяся с 'Глава X'"></textarea>

                <div id="rl-preview-area">
                    <!-- Сюда попадет список глав -->
                </div>
            </div>

            <div id="rl-footer">
                <button class="rl-btn rl-btn-danger" id="rl-reset-btn">Сброс</button>
                <button class="rl-btn rl-btn-secondary" id="rl-pause-btn">Пауза</button>
                <button class="rl-btn rl-btn-primary" id="rl-start-btn">Старт</button>
            </div>
        </div>

        <button id="rl-float-btn">📂</button>
    `;

    const rootDiv = document.createElement('div');
    rootDiv.innerHTML = uiHTML;
    document.body.appendChild(rootDiv);

    // --- ЭЛЕМЕНТЫ ---
    const win = document.getElementById('rl-window');
    const floatBtn = document.getElementById('rl-float-btn');
    const header = document.getElementById('rl-header');

    const settingsPanel = document.getElementById('rl-settings');
    const settingsBtn = document.getElementById('rl-settings-btn');
    const opacitySlider = document.getElementById('rl-opacity-slider');
    const skipTitleChk = document.getElementById('rl-skip-title-chk');
    const themeBtn = document.getElementById('rl-theme-btn');
    const minimizeBtn = document.getElementById('rl-minimize-btn');

    const logs = document.getElementById('rl-logs');
    const progressBar = document.getElementById('rl-progress-bar');
    const progressLabel = document.getElementById('rl-progress-label');
    const statusBadge = document.getElementById('rl-status-badge');

    const inputArea = document.getElementById('rl-input');
    const previewArea = document.getElementById('rl-preview-area');

    const startBtn = document.getElementById('rl-start-btn');
    const pauseBtn = document.getElementById('rl-pause-btn');
    const resetBtn = document.getElementById('rl-reset-btn');

    // --- СОСТОЯНИЕ ---
    let state = {
        queue: [],
        total: 0,
        processed: 0,
        totalChars: 0,
        isWorking: false,
        isPaused: false
    };

    // --- ЛОГИКА ИНТЕРФЕЙСА ---

    // 1. Drag & Drop
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.rl-win-controls')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = win.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        header.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        win.style.left = `${initialLeft + dx}px`;
        win.style.top = `${initialTop + dy}px`;
    });
    window.addEventListener('mouseup', () => {
        if(isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';
            localStorage.setItem(UI_POS_KEY, JSON.stringify({ left: win.style.left, top: win.style.top }));
        }
    });
    const savedPos = JSON.parse(localStorage.getItem(UI_POS_KEY));
    if (savedPos) { win.style.left = savedPos.left; win.style.top = savedPos.top; }

    // 2. Тема
    themeBtn.onclick = () => {
        win.classList.toggle('rl-light-theme');
        localStorage.setItem('rl_theme', win.classList.contains('rl-light-theme') ? 'light' : 'dark');
    };
    if (localStorage.getItem('rl_theme') === 'light') win.classList.add('rl-light-theme');

    // 3. Настройки
    settingsBtn.onclick = () => settingsPanel.style.display = settingsPanel.style.display === 'flex' ? 'none' : 'flex';
    opacitySlider.oninput = (e) => {
        win.style.opacity = e.target.value / 100;
        localStorage.setItem('rl_opacity', e.target.value);
    };
    if (localStorage.getItem('rl_opacity')) {
        win.style.opacity = localStorage.getItem('rl_opacity') / 100;
        opacitySlider.value = localStorage.getItem('rl_opacity');
    }
    skipTitleChk.onchange = (e) => localStorage.setItem(SETTINGS_SKIP_TITLE_KEY, e.target.checked);
    skipTitleChk.checked = localStorage.getItem(SETTINGS_SKIP_TITLE_KEY) === 'true';

    // 4. Окна
    floatBtn.onclick = () => { win.style.display = 'flex'; floatBtn.style.display = 'none'; };
    minimizeBtn.onclick = () => { win.style.display = 'none'; floatBtn.style.display = 'flex'; };

    // --- ПАРСИНГ И PREVIEW (ОБНОВЛЕНО) ---

    function cleanTitle(rawTitle) {
        return rawTitle.replace(/^\s*Глава\s+\d+(\.\d+)?\.?\s*/i, '').trim();
    }

    function cleanBody(rawBody) {
        return rawBody.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
    }

    // Универсальная функция парсинга
    function parseTextToChapters(text) {
        const chunks = text.split(/\n(?=Глава\s+\d)/i);
        const parsed = [];
        let totalChars = 0;

        chunks.forEach(chunk => {
            const lines = chunk.trim().split('\n');
            if (lines.length < 2) return;

            const rawTitleLine = lines.shift();
            const title = cleanTitle(rawTitleLine);
            const body = cleanBody(lines.join('\n'));

            if (title && body) {
                parsed.push({ title, body, fullTitle: rawTitleLine.trim() });
                totalChars += body.length;
            }
        });
        return { chapters: parsed, totalChars };
    }

    // Слушатель ввода для Live Preview
    let debounceTimer;
    inputArea.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const text = inputArea.value;
            if (!text.trim()) {
                previewArea.style.display = 'none';
                previewArea.innerHTML = '';
                return;
            }

            const { chapters, totalChars } = parseTextToChapters(text);

            if (chapters.length > 0) {
                let html = `
                    <div class="rl-preview-header">
                        <span>Найдено глав: <span style="color:var(--rl-accent)">${chapters.length}</span></span>
                        <span>Всего символов: ${totalChars}</span>
                    </div>
                `;

                chapters.forEach((chap, idx) => {
                    html += `
                        <div class="rl-preview-item">
                            <span class="rl-preview-title" title="${chap.fullTitle}">
                                <span style="color:var(--rl-text-muted); margin-right:5px;">#${idx+1}</span>
                                ${chap.fullTitle}
                            </span>
                            <span class="rl-preview-meta">${chap.body.length} симв.</span>
                        </div>
                    `;
                });

                previewArea.innerHTML = html;
                previewArea.style.display = 'block';
                // Авто-скролл к превью
                previewArea.scrollTop = 0;
            } else {
                previewArea.style.display = 'none';
            }
        }, 300); // 300ms delay
    });

    // Функция запуска
    function startParsing() {
        const text = inputArea.value;
        if (!text.trim()) return addLog('Пустое поле ввода!', 'error');

        const { chapters, totalChars } = parseTextToChapters(text);

        if (chapters.length > 0) {
            state.queue = chapters;
            state.total = chapters.length;
            state.processed = 0;
            state.totalChars = totalChars;
            state.isWorking = true;
            state.isPaused = false;

            saveState();
            addLog(`Загружено глав: ${state.total}`, 'success');

            // Скрываем превью и очищаем инпут при старте
            inputArea.value = '';
            previewArea.style.display = 'none';

            updateUI();
            processQueue();
        } else {
            addLog('Не найдено глав. Формат: "Глава 1. Название"', 'error');
        }
    }

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

    function addLog(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `rl-log-item rl-log-${type}`;
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'});
        div.innerHTML = `<span class="rl-log-time">${time}</span>${msg}`;
        logs.appendChild(div);
        logs.scrollTop = logs.scrollHeight;
    }

    function updateUI() {
        if (state.total === 0) {
            progressBar.style.width = '0%';
            progressLabel.innerText = 'Нет задач';
            return;
        }
        const pct = Math.round((state.processed / state.total) * 100);
        progressBar.style.width = `${pct}%`;
        progressLabel.innerText = `${pct}% (${state.processed} / ${state.total})`;

        if (state.isPaused) {
            statusBadge.className = 'rl-status-badge rl-status-paused';
            statusBadge.innerText = 'PAUSED';
            pauseBtn.innerText = 'Продолжить';
        } else if (state.isWorking) {
            statusBadge.className = 'rl-status-badge rl-status-active';
            statusBadge.innerText = 'WORKING';
            pauseBtn.innerText = 'Пауза';
        } else {
            statusBadge.className = 'rl-status-badge';
            statusBadge.innerText = 'IDLE';
            pauseBtn.innerText = 'Пауза';
        }
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function setInput(el, val) {
        if(!el) return;
        let lastVal = el.value;
        el.value = val;
        let tracker = el._valueTracker;
        if (tracker) tracker.setValue(lastVal);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // --- ПРОЦЕССИНГ ---
    async function processQueue() {
        if (!state.isWorking) return;

        if (!window.location.href.includes('/add-chapter')) {
            addLog('Переход на страницу добавления...', 'warn');
            const link = document.querySelector('a[href*="/add-chapter"]');
            if(link) link.click();
            else {
                addLog('Ссылка на добавление не найдена!', 'error');
                state.isPaused = true;
                updateUI();
            }
            return;
        }

        while (state.queue.length > 0 && state.isWorking) {
            if (state.isPaused) {
                await sleep(500);
                continue;
            }

            const chapter = state.queue[0];
            addLog(`Обработка: "${chapter.title}"`);

            const titleInput = document.querySelector('input[placeholder="Название главы"]');
            const editor = document.querySelector('.tiptap.ProseMirror');
            let createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Создать');

            if (!titleInput || !editor || !createBtn) {
                addLog('Жду загрузку формы...', 'warn');
                await sleep(1500);
                continue;
            }

            if (titleInput.value) {
                addLog('Форма не пустая. Жду...', 'warn');
                const addMore = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('добавить ещё главу'));
                if (addMore) { addMore.click(); return; }
                await sleep(2000);
                continue;
            }

            // Настройка пропуска названия
            const shouldSkipTitle = skipTitleChk.checked;
            if (!shouldSkipTitle) setInput(titleInput, chapter.title);
            await sleep(300);

            const htmlContent = chapter.body.split('\n').map(l => `<p>${l}</p>`).join('');
            editor.innerHTML = htmlContent;
            editor.dispatchEvent(new Event('input', { bubbles: true }));

            await sleep(1500);

            if (createBtn.disabled) {
                addLog('Попытка активации кнопки...', 'warn');
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                if (!shouldSkipTitle) {
                    setInput(titleInput, chapter.title + ' ');
                    await sleep(100);
                    setInput(titleInput, chapter.title);
                }
                await sleep(1000);
            }

            if (!createBtn.disabled) {
                createBtn.click();
                addLog('Создано!', 'success');
                state.queue.shift();
                state.processed++;
                saveState();
                updateUI();

                await sleep(3000);
                let attempts = 0;
                while (attempts < 20) {
                    const addMore = Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('добавить ещё главу'));
                    if (addMore) { window.location.href = addMore.href; return; }
                    await sleep(500);
                    attempts++;
                }
                window.location.reload();
                return;
            } else {
                addLog('Ошибка: Кнопка "Создать" не активна.', 'error');
                state.isPaused = true;
                updateUI();
                alert('Ошибка формы!');
            }
        }

        if (state.queue.length === 0) {
            state.isWorking = false;
            const report = `🎉 Готово!\n\n📚 Глав: ${state.processed}\n📝 Символов: ${state.totalChars}`;
            addLog(report.replace(/\n/g, '<br>'), 'success');
            saveState();
            updateUI();
            setTimeout(() => alert(report), 100);
        }
    }

    // --- КНОПКИ ---
    startBtn.onclick = () => {
        if (state.queue.length > 0 && state.isPaused) {
            state.isPaused = false;
            updateUI();
        } else {
            startParsing();
        }
    };
    pauseBtn.onclick = () => {
        if (!state.isWorking) return;
        state.isPaused = !state.isPaused;
        updateUI();
        addLog(state.isPaused ? 'Пауза...' : 'Продолжаем...', 'info');
    };
    resetBtn.onclick = () => {
        if(confirm('Сбросить?')) {
            state = { queue: [], total: 0, processed: 0, totalChars: 0, isWorking: false, isPaused: false };
            sessionStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(STATE_KEY);
            updateUI();
            previewArea.style.display = 'none';
            inputArea.value = '';
            addLog('Сброс.', 'error');
            window.location.reload();
        }
    };

    // --- ВОССТАНОВЛЕНИЕ ---
    function saveState() {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.queue));
        sessionStorage.setItem(STATE_KEY, JSON.stringify({
            total: state.total, processed: state.processed, totalChars: state.totalChars, isWorking: state.isWorking
        }));
    }
    const savedQ = sessionStorage.getItem(STORAGE_KEY);
    const savedS = sessionStorage.getItem(STATE_KEY);
    if (savedQ && savedS) {
        state.queue = JSON.parse(savedQ);
        const meta = JSON.parse(savedS);
        state.total = meta.total; state.processed = meta.processed; state.totalChars = meta.totalChars || 0; state.isWorking = meta.isWorking;
        if (state.isWorking && state.queue.length > 0) {
            win.style.display = 'flex'; floatBtn.style.display = 'none'; updateUI();
            setTimeout(processQueue, 1500);
        }
    }

})();