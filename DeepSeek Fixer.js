// ==UserScript==
// @name         DeepSeek Fixer v3.2 (React Bypass & Custom Tasks)
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Автоматизация для chat.deepseek.com с надежным обходом защиты React.
// @author       You
// @match        https://chat.deepseek.com/*
// @grant        none
// @inject-into  content
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIG ---
    const CONFIG = {
        checkInterval: 700,
        badCharRegex: /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\u3130-\u318f\uac00-\ud7af\ufffd\u0900-\u097F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/,
        waitTimeout: 120000,
        startTimeout: 40000,
        brandColor: '#4d6bfe' // Синий цвет в стиле DeepSeek
    };

    let activeTimer = null;

    // --- DB & STATE ---
    const DB_NAME = 'DeepSeekInstantDB';
    const STORE_NAME = 'instantState';

    function getSessionKey() {
        const match = window.location.pathname.match(/\/a\/chat\/s\/([a-z0-9\-]+)/i);
        return match ? `appState_${match[1]}` : 'appState_new_thread';
    }

    function initDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 2);
            req.onupgradeneeded = e => {
                if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
                    e.target.result.createObjectStore(STORE_NAME);
                }
            };
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e.target.error);
        });
    }

    async function getState() {
        try {
            const db = await initDB();
            const key = getSessionKey();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const req = tx.objectStore(STORE_NAME).get(key);
                req.onsuccess = () => resolve(req.result || getDefaultState());
                req.onerror = () => resolve(getDefaultState());
            });
        } catch (e) { return getDefaultState(); }
    }

    function getDefaultState() {
        return {
            lines: [], currentIndex: 0, isRunning: false, step: 'idle',
            lastTextLen: 0, stabilityCounter: 0, stepStartTime: 0,
            lastAiTextBeforeSend: "", messageCountBeforeSend: 0,
            userDelaySetting: 2500, hasGlossary: false, glossarySkipped: false,
            glossarySent: false, glossaryText: "", postPromptSent: false,
            postPromptResponse: "", useCustomMode: false, customSearchText: "", customPromptText: ""
        };
    }

    async function saveState(state) {
        const db = await initDB();
        const key = getSessionKey();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(state, key);
            tx.oncomplete = resolve;
        });
    }

    async function clearState() {
        const db = await initDB();
        const key = getSessionKey();
        return new Promise(resolve => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(key);
            tx.oncomplete = resolve;
        });
    }

    // --- UI HELPERS ---
    function mk(tag, styles = {}, props = {}) {
        const el = document.createElement(tag);
        Object.assign(el.style, styles);
        for (let key in props) {
            if (key.startsWith('on')) {
                el.addEventListener(key.substring(2).toLowerCase(), props[key]);
            } else { el[key] = props[key]; }
        }
        return el;
    }

    async function createUI() {
        if (document.getElementById('glf-panel')) return;

        const panel = mk('div', {
            position: 'fixed', top: '20px', right: '20px', width: '950px', height: '85vh',
            background: '#121212', color: '#e3e3e3', border: `1px solid ${CONFIG.brandColor}`,
            zIndex: '99999', borderRadius: '10px', display: 'flex', flexDirection: 'column',
            fontFamily: 'sans-serif', fontSize: '13px', boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
            resize: 'both', overflow: 'hidden', display: 'none'
        }, { id: 'glf-panel' });

        const header = mk('div', { padding: '12px', background: '#1e1e1e', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' });
        header.innerHTML = `<b style="color:${CONFIG.brandColor}; font-family: monospace; font-size: 14px;">🐋 DeepSeek Fixer v3.2</b>`;
        const close = mk('span', { cursor: 'pointer', color: '#ff5252', fontWeight: 'bold', fontSize: '16px' }, { textContent: '✖' });
        close.addEventListener('click', () => panel.style.display = 'none');
        header.appendChild(close);
        panel.appendChild(header);

        const body = mk('div', { display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' });

        const sidebar = mk('div', {
            width: '280px', display: 'flex', flexDirection: 'column', background: '#181818',
            borderRight: '1px solid #333', padding: '15px', gap: '10px', overflowY: 'auto'
        });

        const statsBox = mk('div', { background: '#222', padding: '12px', borderRadius: '6px', border: '1px solid #333' }, { id: 'glf-stats' });

        // БЛОК КАСТОМНЫХ ЗАДАЧ
        const customBox = mk('div', { background: '#131826', padding: '10px', borderRadius: '6px', border: `1px solid ${CONFIG.brandColor}`, display: 'flex', flexDirection: 'column', gap: '8px' });
        const customToggleLabel = mk('label', { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: CONFIG.brandColor, fontWeight: 'bold', fontSize: '12px' });
        const customToggle = mk('input', { cursor: 'pointer' }, { type: 'checkbox', id: 'glf-custom-toggle' });
        customToggleLabel.append(customToggle, document.createTextNode('⚙ Кастомная задача'));
        const customSearchInput = mk('input', { background: '#0a0a0a', color: '#fff', border: '1px solid #444', borderRadius: '4px', padding: '6px', outline: 'none', fontSize: '11px', width: '100%', boxSizing: 'border-box' }, { id: 'glf-custom-search', placeholder: 'Искать слово (напр. Ло шу)' });
        const customPromptInput = mk('textarea', { background: '#0a0a0a', color: '#ccc', border: '1px solid #444', borderRadius: '4px', padding: '6px', resize: 'vertical', outline: 'none', fontSize: '11px', minHeight: '60px', width: '100%', boxSizing: 'border-box' }, { id: 'glf-custom-prompt', placeholder: 'Промпт: Замени Ло шу на...' });
        customBox.append(customToggleLabel, customSearchInput, customPromptInput);

        const input = mk('textarea', {
            flex: '1', minHeight: '120px', background: '#0a0a0a', color: '#ccc', border: '1px solid #333',
            borderRadius: '4px', padding: '10px', resize: 'none', outline: 'none', fontFamily: 'monospace', fontSize: '11px'
        }, { id: 'glf-input', placeholder: 'Вставьте весь текст сюда...' });

        const delayContainer = mk('div', { display: 'flex', flexDirection: 'column', gap: '4px' });
        delayContainer.innerHTML = '<span style="color:#aaa; font-size:11px;">Тишина для завершения (мс):</span>';
        const delayInput = mk('input', {
            type: 'number', background: '#0a0a0a', color: CONFIG.brandColor, border: '1px solid #333',
            padding: '6px', borderRadius: '4px', outline: 'none', fontWeight: 'bold', fontSize: '12px'
        }, { id: 'glf-delay-input', value: '2500', min: '500', step: '500' });
        delayContainer.appendChild(delayInput);

        const controls = mk('div', { display: 'flex', flexDirection: 'column', gap: '8px' });
        const btnRun = mk('button', { background: CONFIG.brandColor, color: '#fff', border:'none', padding:'10px', cursor:'pointer', borderRadius: '4px', fontWeight: 'bold' }, { id: 'glf-run', textContent: '▶ ЗАПУСТИТЬ' });
        const btnStop = mk('button', { background: '#c62828', color: '#fff', border:'none', padding:'10px', cursor:'pointer', display:'none', borderRadius: '4px', fontWeight: 'bold' }, { id: 'glf-stop', textContent: '⏹ ПАУЗА' });
        const btnCopy = mk('button', { background: '#1565c0', color: '#fff', border:'none', padding:'10px', cursor:'pointer', borderRadius: '4px', fontWeight: 'bold' }, { id: 'glf-copy', textContent: '📋 КОПИРОВАТЬ ВСЁ' });
        const btnClear = mk('button', { background:'#424242', color:'#fff', border:'none', padding:'10px', cursor:'pointer', borderRadius: '4px' }, { textContent: '🗑 ОЧИСТИТЬ СЕССИЮ' });

        controls.append(btnRun, btnStop, btnCopy, btnClear);
        sidebar.append(statsBox, customBox, input, delayContainer, controls);
        body.appendChild(sidebar);

        const list = mk('div', { flex: '1', overflowY: 'auto', background: '#0e0e0e', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px', scrollBehavior: 'smooth' }, { id: 'glf-list' });
        body.appendChild(list);

        // Модалка глоссария
        const glossaryModal = mk('div', {
            position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', background: 'rgba(0,0,0,0.85)',
            display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: '10', backdropFilter: 'blur(3px)'
        }, { id: 'glf-glossary-modal' });

        const modalContent = mk('div', { width: '60%', background: '#1e1e1e', padding: '20px', borderRadius: '8px', border: `1px solid ${CONFIG.brandColor}`, display: 'flex', flexDirection: 'column', gap: '15px' });
        modalContent.innerHTML = `<div style="color: ${CONFIG.brandColor}; font-weight: bold; font-size: 16px;">📚 Настройка Глоссария</div>`;

        const glossaryInput = mk('textarea', { height: '200px', background: '#0a0a0a', color: '#fff', border: '1px solid #444', padding: '10px', borderRadius: '4px', resize: 'none', fontFamily: 'monospace' }, { id: 'glf-glossary-input', placeholder: 'term - перевод...' });

        const modalBtns = mk('div', { display: 'flex', gap: '10px', justifyContent: 'flex-end' });
        const btnSkipGlossary = mk('button', { background: '#444', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer' }, { textContent: 'Пропустить' });
        const btnSaveGlossary = mk('button', { background: CONFIG.brandColor, color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }, { textContent: 'Сохранить и начать' });

        modalBtns.append(btnSkipGlossary, btnSaveGlossary);
        modalContent.append(glossaryInput, modalBtns);
        glossaryModal.appendChild(modalContent);
        body.appendChild(glossaryModal);

        panel.appendChild(body);
        document.body.appendChild(panel);

        const initState = await getState();
        delayInput.value = initState.userDelaySetting || 2500;
        customToggle.checked = initState.useCustomMode || false;
        customSearchInput.value = initState.customSearchText || "";
        customPromptInput.value = initState.customPromptText || "";

        const updateCustomBoxUI = () => {
            customSearchInput.style.display = customToggle.checked ? 'block' : 'none';
            customPromptInput.style.display = customToggle.checked ? 'block' : 'none';
        };
        updateCustomBoxUI();
        customToggle.addEventListener('change', updateCustomBoxUI);

        updateUI(initState);

        const saveSettings = async () => {
            let state = await getState();
            state.userDelaySetting = parseInt(delayInput.value) || 2500;
            state.useCustomMode = customToggle.checked;
            state.customSearchText = customSearchInput.value;
            state.customPromptText = customPromptInput.value;
            await saveState(state);
        };
        delayInput.addEventListener('change', saveSettings);
        customToggle.addEventListener('change', saveSettings);
        customSearchInput.addEventListener('input', saveSettings);
        customPromptInput.addEventListener('input', saveSettings);

        btnRun.addEventListener('click', async () => {
            if (activeTimer) clearTimeout(activeTimer);
            await saveSettings();
            let state = await getState();

            if (!state.isRunning && state.currentIndex === 0) {
                if (!input.value.trim()) return alert('Пусто!');
                if (state.useCustomMode && (!state.customSearchText.trim() || !state.customPromptText.trim())) {
                    return alert('Заполните поля кастомной задачи!');
                }

                state.lines = input.value.split('\n').map((l, i) => {
                    let isBad = false;
                    if (l.trim().length > 0) {
                        isBad = state.useCustomMode
                            ? l.toLowerCase().includes(state.customSearchText.toLowerCase())
                            : CONFIG.badCharRegex.test(l);
                    }
                    return { id: i, original: l, fixed: null, bad: isBad };
                });

                if (!state.hasGlossary && !state.glossarySkipped) {
                    await saveState(state);
                    glossaryModal.style.display = 'flex';
                    return;
                }
            }
            state.isRunning = true;
            state.step = 'idle';
            await saveState(state);
            updateUI(state);
            runLoopSafe();
        });

        btnSkipGlossary.addEventListener('click', async () => {
            let state = await getState();
            state.glossarySkipped = true; state.hasGlossary = false; state.isRunning = true; state.step = 'idle';
            await saveState(state); glossaryModal.style.display = 'none'; updateUI(state); runLoopSafe();
        });

        btnSaveGlossary.addEventListener('click', async () => {
            let state = await getState();
            const text = glossaryInput.value.trim();
            if (text) { state.hasGlossary = true; state.glossaryText = text; }
            else { state.glossarySkipped = true; }
            state.isRunning = true; state.step = 'idle';
            await saveState(state); glossaryModal.style.display = 'none'; updateUI(state); runLoopSafe();
        });

        btnStop.addEventListener('click', async () => {
            if (activeTimer) clearTimeout(activeTimer);
            let state = await getState(); state.isRunning = false;
            await saveState(state); updateUI(state);
        });

        btnCopy.addEventListener('click', async () => {
            const state = await getState();
            const txt = state.lines.map(l => l.fixed !== null ? l.fixed : l.original).join('\n');
            navigator.clipboard.writeText(txt);
            btnCopy.textContent = '✔ СКОПИРОВАНО'; setTimeout(() => btnCopy.textContent = '📋 КОПИРОВАТЬ ВСЁ', 1500);
        });

        btnClear.addEventListener('click', async () => {
            if (activeTimer) clearTimeout(activeTimer);
            if(confirm('Очистить прогресс?')) {
                await clearState(); input.value = ''; glossaryInput.value = ''; list.innerHTML = '';
                updateUI(await getState());
            }
        });

        const toggle = mk('div', {
            position:'fixed', bottom:'20px', left:'20px', width:'50px', height:'50px',
            background:'#1e1e1e', borderRadius:'50%', cursor:'pointer', border:`2px solid ${CONFIG.brandColor}`,
            display: 'flex', alignItems:'center', justifyContent:'center', fontSize:'24px',
            boxShadow: `0 0 15px rgba(77, 107, 254, 0.4)`, zIndex: '99998'
        }, { textContent: '🐋' });
        toggle.addEventListener('click', () => panel.style.display = panel.style.display === 'none' ? 'flex' : 'none');
        document.body.appendChild(toggle);
    }

    let lastListHTML = "";
    let lastStatsHTML = "";

    function updateUI(state) {
        const run = document.getElementById('glf-run');
        const stop = document.getElementById('glf-stop');
        const list = document.getElementById('glf-list');
        const statsBox = document.getElementById('glf-stats');

        if (!list || !statsBox) return;

        if (state.isRunning) { run.style.display = 'none'; stop.style.display = 'block'; }
        else {
            run.style.display = 'block'; stop.style.display = 'none';
            if (state.currentIndex > 0 && state.currentIndex < state.lines.length) run.textContent = '▶ ПРОДОЛЖИТЬ';
        }

        if (state.lines.length > 0) {
            const targetCount = state.lines.filter(l => l.bad).length;
            const fixed = state.lines.filter(l => l.bad && l.fixed !== null).length;
            const remaining = targetCount - fixed;
            const percent = targetCount === 0 ? 100 : Math.round((fixed / targetCount) * 100);

            const newStatsHTML = `
                <div style="font-size: 14px; font-weight: bold; color: ${CONFIG.brandColor}; margin-bottom: 10px;">📊 Статистика</div>
                <div style="color:#bbb">Найдено строк: <b style="color:#fff">${targetCount}</b></div>
                <div style="color:#bbb; margin-top:4px;">Осталось: <b style="color:#ffb300">${remaining}</b> / ${targetCount}</div>
                <div style="width: 100%; background: #111; height: 10px; border-radius: 5px; overflow: hidden; border: 1px solid #444; margin-top:5px;">
                    <div style="width: ${percent}%; background: ${percent === 100 ? '#4CAF50' : CONFIG.brandColor}; height: 100%; transition: width 0.4s ease;"></div>
                </div>
            `;
            if (lastStatsHTML !== newStatsHTML) { statsBox.innerHTML = newStatsHTML; lastStatsHTML = newStatsHTML; }
        } else {
             statsBox.innerHTML = `<div style="color:#bbb; text-align:center;">Ожидание текста...</div>`;
        }

        if (state.lines.length || state.step.includes('glossary')) {
            let html = '';
            if (state.hasGlossary && !state.glossarySent) {
                html += `<div style="padding:10px; color:${CONFIG.brandColor}; border:1px solid ${CONFIG.brandColor}; margin-bottom:10px;">⏳ Отправка глоссария...</div>`;
            }

            let upcomingShown = 0;
            for(let i = 0; i < state.lines.length; i++) {
                const line = state.lines[i];
                if (!line.bad) continue;

                let borderColor = '#333', statusText = '...', rightBoxContent = '...';

                if (i === state.currentIndex && state.isRunning && !state.step.includes('glossary')) {
                    borderColor = CONFIG.brandColor; statusText = 'Генерация...';
                } else if (line.fixed) {
                    borderColor = '#4CAF50'; statusText = 'Готово'; rightBoxContent = line.fixed;
                } else { borderColor = '#ef5350'; }

                const safeContent = rightBoxContent.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                let originalDisplay = line.original.replace(/</g, "&lt;");

                if (state.useCustomMode && state.customSearchText) {
                    const regex = new RegExp(`(${state.customSearchText})`, 'gi');
                    originalDisplay = originalDisplay.replace(regex, '<span style="background:rgba(255,179,0,0.4); border-radius:2px; padding:0 2px;">$1</span>');
                }

                html += `
                <div style="background: #181818; border: 1px solid ${borderColor}; padding: 10px; font-family: monospace; font-size: 12px; border-radius:4px;">
                    <div style="margin-bottom: 5px; color:#aaa;">Строка #${i+1} (${statusText})</div>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1; background: #222; padding: 5px; color: #bbb; max-height:100px; overflow:auto;">${originalDisplay}</div>
                        <div style="flex: 1; background: #131826; padding: 5px; color: #fff; max-height:100px; overflow:auto;">${safeContent}</div>
                    </div>
                </div>`;

                if (i > state.currentIndex) {
                    upcomingShown++; if (upcomingShown >= 2) break;
                }
            }

            if (state.postPromptResponse) { html += `<div style="background:#1d2a54; padding:10px; margin-top:10px; color:#fff;">💡 Глоссарий+: ${state.postPromptResponse}</div>`; }
            if (lastListHTML !== html) { list.innerHTML = html; lastListHTML = html; }
        }
    }

    // --- DEEPSEEK DOM SELECTORS ---
    function getEditor() { return document.querySelector('textarea'); }

    function getMessageCount() { return document.querySelectorAll('.ds-markdown').length; }

    function getCurrentAILastMessageText() {
        try {
            const aiBubbles = Array.from(document.querySelectorAll('.ds-markdown'));
            if (aiBubbles.length > 0) {
                const txt = aiBubbles[aiBubbles.length - 1].innerText.trim();
                if (txt && !txt.includes('// Ref:')) return txt;
            }
            return "";
        } catch (e) { return ""; }
    }

    // --- REACT OVERRIDE MAGIC ---
    function setReactInputValue(input, value) {
        // Безопасный вызов нативного сеттера, который игнорирует перехватчики React
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, value);
        } else {
            input.value = value;
        }
        // Уведомляем React о том, что значение изменилось
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function lexicalInsert(editor, text) {
        if (!editor) return;
        editor.focus();
        setReactInputValue(editor, text);
    }

    function triggerSend(editor) {
        if (!editor) return;

        let clicked = false;
        // Ищем все кнопки отправки (DeepSeek использует div с ролью button)
        const activeButtons = document.querySelectorAll('div[role="button"][aria-disabled="false"]');

        if (activeButtons.length > 0) {
            // Обычно кнопка "Отправить" - самая последняя активная кнопка среди контроллов
            const sendBtn = activeButtons[activeButtons.length - 1];
            if (sendBtn) {
                sendBtn.click();
                clicked = true;
            }
        }

        // Если кликнуть не удалось, симулируем Enter
        if (!clicked) {
            const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
            });
            editor.dispatchEvent(enterEvent);
        }
    }

    // --- SAFE LOOP CALLER ---
    function runLoopSafe() {
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(processLoop, 100);
    }

    // --- MAIN LOOP ---
    async function processLoop() {
        activeTimer = null;
        let state = await getState();
        if (!state.isRunning) return;

        const delayInput = document.getElementById('glf-delay-input');
        if (delayInput) state.userDelaySetting = parseInt(delayInput.value) || 2500;

        // PHASE 1: GLOSSARY
        if (state.hasGlossary && !state.glossarySent) {
            if (state.step === 'idle') {
                const editor = getEditor();
                if (!editor) { activeTimer = setTimeout(processLoop, 500); return; }

                const msg = `Глоссарий:\n${state.glossaryText}\n\nДалее буду кидать текст, правь по инструкции. Ответь "Понял".`;
                lexicalInsert(editor, msg);
                state.step = 'verify_glossary';
                state.stepStartTime = Date.now();
                await saveState(state);
                activeTimer = setTimeout(processLoop, 500); // Даем 500мс React-у обновить состояние кнопки
                return;
            }
        }
        // PHASE 2: LINES
        else if (state.currentIndex < state.lines.length) {
            let skipped = false;
            while (state.currentIndex < state.lines.length) {
                if (state.lines[state.currentIndex].bad) break;
                state.lines[state.currentIndex].fixed = state.lines[state.currentIndex].original;
                state.currentIndex++;
                skipped = true;
            }
            if (skipped) { await saveState(state); updateUI(state); }
            if (state.currentIndex >= state.lines.length) { activeTimer = setTimeout(processLoop, 100); return; }

            if (state.step === 'idle') {
                const line = state.lines[state.currentIndex];
                const editor = getEditor();
                if (!editor) { activeTimer = setTimeout(processLoop, 500); return; }

                const uid = Math.random().toString(36).substring(2, 7).toUpperCase();

                let instruction = "";
                if (state.useCustomMode && state.customPromptText) {
                    instruction = `${state.customPromptText}\nВерни ТОЛЬКО исправленный текст без лишних слов. Не ищи в интернете:\n\n${line.original}\n\n// Ref:${uid}`;
                } else {
                    instruction = `Исправь текст (убери иероглифы, почини кодировку). Верни ТОЛЬКО исправленный текст без лишних слов. Не ищи в интернете:\n\n${line.original}\n\n// Ref:${uid}`;
                }

                lexicalInsert(editor, instruction);
                state.step = 'verify_line';
                state.stepStartTime = Date.now();
                await saveState(state);
                activeTimer = setTimeout(processLoop, 500); // Ожидание включения кнопки
                return;
            }
        }
        // PHASE 3: POST PROMPT
        else if (!state.postPromptSent && state.hasGlossary) {
            if (state.step === 'idle') {
                const editor = getEditor();
                if (!editor) { activeTimer = setTimeout(processLoop, 500); return; }
                lexicalInsert(editor, `Предложи дополнения к глоссарию на основе исправленного текста.`);
                state.step = 'verify_post';
                state.stepStartTime = Date.now();
                await saveState(state);
                activeTimer = setTimeout(processLoop, 500);
                return;
            }
        }
        // FINISHED
        else {
            state.isRunning = false;
            await saveState(state); updateUI(state);
            alert('Все задачи выполнены!'); return;
        }

        // --- VERIFY SUBMISSION ---
        if (state.step.startsWith('verify_')) {
            const editor = getEditor();

            if (Date.now() - state.stepStartTime > 15000) {
                 state.step = 'idle'; await saveState(state);
                 activeTimer = setTimeout(processLoop, 1000); return;
            }

            if (editor && editor.value.trim().length < 5) {
                state.step = 'idle'; await saveState(state);
                activeTimer = setTimeout(processLoop, 1000); return;
            }

            state.lastAiTextBeforeSend = getCurrentAILastMessageText();
            state.messageCountBeforeSend = getMessageCount();

            triggerSend(editor);

            state.step = state.step.replace('verify_', 'wait_');
            state.lastTextLen = 0; state.stabilityCounter = 0; state.stepStartTime = Date.now();
            await saveState(state); updateUI(state);
            activeTimer = setTimeout(processLoop, 500); return;
        }

        // --- WAIT FOR ANSWER ---
        if (state.step.startsWith('wait_')) {
            const currentText = getCurrentAILastMessageText();
            const currentCount = getMessageCount();
            const now = Date.now();

            if (now - state.stepStartTime > CONFIG.waitTimeout) {
                if (state.step === 'wait_line') state.lines[state.currentIndex].fixed = "[TIMEOUT ERROR]";
                state.step = 'idle'; await saveState(state);
                activeTimer = setTimeout(processLoop, 1000); return;
            }

            let hasStarted = false;
            if (currentText !== state.lastAiTextBeforeSend && currentText.length > 0) hasStarted = true;
            if (currentCount > state.messageCountBeforeSend) hasStarted = true;

            if (!hasStarted) {
                if (now - state.stepStartTime > CONFIG.startTimeout) { state.step = 'idle'; await saveState(state); }
                activeTimer = setTimeout(processLoop, CONFIG.checkInterval); return;
            }

            if (currentText.length > 0 && currentText.length === state.lastTextLen) {
                state.stabilityCounter += CONFIG.checkInterval;
            } else {
                state.stabilityCounter = 0;
                state.lastTextLen = currentText.length;
            }

            if (state.stabilityCounter >= state.userDelaySetting) {
                let cleanText = currentText.replace(/^(Вот исправленный текст:|Конечно,|Результат:|Исправленный вариант:|Sure,|Here is)\s*/i, '').trim();

                if (state.step === 'wait_glossary') state.glossarySent = true;
                else if (state.step === 'wait_line') {
                    if (cleanText.length < 2) { state.stabilityCounter = 0; activeTimer = setTimeout(processLoop, 500); return; }
                    state.lines[state.currentIndex].fixed = cleanText;
                    state.currentIndex++;
                }
                else if (state.step === 'wait_post') { state.postPromptSent = true; state.postPromptResponse = cleanText; }

                state.step = 'idle'; state.lastAiTextBeforeSend = "";
                await saveState(state); updateUI(state);
                activeTimer = setTimeout(processLoop, 1000); return;
            }
            await saveState(state); updateUI(state);
            activeTimer = setTimeout(processLoop, CONFIG.checkInterval);
        }
    }

    window.addEventListener('load', () => { setTimeout(createUI, 2000); });
})();