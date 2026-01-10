// ==UserScript==
// @name         Rulate Super-Инструмент v6.4 (Счетчик символов и Live-обновление)
// @namespace    http://tampermonkey.net/
// @version      6.4
// @description  Умный отчет, интерактивное разделение глав, live-обновление, проверка на дубли, настройка прозрачности, чек-листы и гибкая группировка ошибок.
// @author       LobanovKeanu & AI fix
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
`);

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
                <div class="rst-control-group rst-checkbox-group"><label title="Выравнивает нумерацию всех глав, начиная с номера первой главы. Игнорирует пропуски в оригинальной нумерации."><input type="checkbox" id="fmt-align-numbers">Выравнить номера глав</label></div>
            </div>
            <div class="rst-row">
                <div class="rst-col" style="flex: 3;">
                    <div class="rst-label-group">
                         <div class="rst-sub-tabs">
                            <button class="rst-sub-tab rst-active" data-sub-view="fmt-source-sub-view">Исходный текст</button>
                            <button class="rst-sub-tab" data-sub-view="fmt-interactive-sub-view">Интерактивная работа</button>
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
    const fileInputId = button.dataset.input, targetTextareaId = button.dataset.target;
    const fileInput = document.getElementById(fileInputId), targetTextarea = document.getElementById(targetTextareaId);
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
        } else { // 'replace' mode
            resultOutput = chaptersToProcess.map(c => {
                const newHeader = `# [Глава ${c.finalNumber}. ${c.finalTitle}]`;
                const body = c.content.replace(chapterRegex, '').trim();
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

    const initializeAll = () => {
        splitPoints.clear();
        parseSourceText();
        renderInteractiveView();
        recalculateAndRenderAll();
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
        groupingRadios = document.querySelectorAll('input[name="validator-grouping"]'),
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

    // --- ИСПРАВЛЕННАЯ ПРОВЕРКА ГРАММАТИКИ ---
    const checkGrammarErrors = (text, lineIdCounter) => {
        if (!azLoaded) return [];
        const errors = [];

        // !!! ИСПРАВЛЕНИЕ ЗДЕСЬ !!!
        // Сначала .done() превращает объект Az в обычный массив, потом .filter()
        const tokens = Az.Tokens(text).done().filter(t => t.type === Az.Tokens.WORD);

        for (let i = 0; i < tokens.length - 1; i++) {
            const word1 = tokens[i];
            const word2 = tokens[i + 1];
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
        const totalProblems = currentErrors.reduce((sum, errGroup) => sum + errGroup.errors.length, 0);

        if (totalProblems === 0) {
            resultsEl.innerHTML = '<div class="rst-success-message">✅ Проблем не найдено! Файл чист.</div>';
            return;
        }

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

    loadSettings();
    [ignoreWordsEl, stopWordsEl].forEach(el => el.addEventListener('input', saveSettings));
    Object.values(checks).forEach(el => el.addEventListener('change', saveSettings));
    processBtn.addEventListener('click', runValidation);
    clearBtn.addEventListener('click', () => { sourceTextEl.value = ''; });
    groupingRadios.forEach(radio => radio.addEventListener('change', () => { if (currentErrors.length > 0) displayResults(); }));

})();
})();