// ==UserScript==
// @name         Renovels Manager
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Автоматизирует загрузку глав на renovels.org с надежным методом вставки текста и сворачиваемым интерфейсом.
// @author       ChatGPT & User
// @match        *://renovels.org/novel/*
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Вспомогательные функции ---

    /** Ждет появления элемента на странице */
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const interval = 100;
            let attempts = 0;
            const maxAttempts = timeout / interval;
            const check = () => {
                const element = document.querySelector(selector);
                if (element) {
                    clearInterval(intervalId);
                    resolve(element);
                } else if (attempts++ > maxAttempts) {
                    clearInterval(intervalId);
                    reject(new Error(`Элемент "${selector}" не найден за ${timeout} мс`));
                }
            };
            const intervalId = setInterval(check, interval);
            check();
        });
    }

    /** Простая задержка */
    const delay = ms => new Promise(res => setTimeout(res, ms));

    /** Симулирует ввод текста в input */
    function simulateInput(element, value) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * **НОВЫЙ НАДЕЖНЫЙ МЕТОД**
     * Симулирует вставку текста из буфера обмена в редактор.
     * Это самый надежный способ для работы с фреймворками вроде React/Lexical.
     * @param {HTMLElement} editorElement - Контейнер редактора.
     * @param {string} text - Текст главы для вставки.
     */
    function simulatePaste(editorElement, text) {
        // 1. Устанавливаем фокус на редактор. Это критически важно.
        editorElement.focus();

        // 2. Создаем объект DataTransfer, который будет "хранить" наши данные для вставки.
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);

        // 3. Создаем событие вставки (paste), используя наш DataTransfer.
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
        });

        // 4. Отправляем событие в редактор. Он обработает его как настоящую вставку.
        editorElement.dispatchEvent(pasteEvent);
    }


    // --- Логика парсинга и обработки ---

    /** Парсит большой текст на отдельные главы */
    function parseChapters(rawText) {
        const chapters = [];
        const chapterRegex = /^Глава \d+.*$/gm;
        const rawChapters = rawText.split(chapterRegex).slice(1);
        const titles = rawText.match(chapterRegex);
        if (!titles || rawChapters.length === 0) return [];
        titles.forEach((fullTitle, i) => {
            const title = fullTitle.trim().replace(/Глава \d+\.?\s*/, '').trim();
            const content = rawChapters[i] ? rawChapters[i].trim() : '';
            if (title && content) {
                chapters.push({ title, content });
            }
        });
        console.log(`Найдено глав: ${chapters.length}`, chapters);
        return chapters;
    }

    /** Основная асинхронная функция обработки глав */
    async function startProcessing() {
        ui.setButtonState(true, 'В процессе...');
        ui.updateProgress(0, 1, 'Инициализация...');

        try {
            const rawText = document.getElementById('renovels-uploader-text').value;
            const chapters = parseChapters(rawText);
            if (chapters.length === 0) {
                throw new Error("Не удалось найти главы. Проверьте формат ('Глава X. Название' в начале строки).");
            }

            const totalChapters = chapters.length;
            const freeCount = parseInt(document.getElementById('renovels-uploader-free-count').value, 10) || 0;
            const allFree = document.getElementById('renovels-uploader-all-free').checked;

            for (let i = 0; i < totalChapters; i++) {
                const chapter = chapters[i];
                ui.updateProgress(i, totalChapters, `Глава ${i + 1}: ${chapter.title}`);

                const isPaid = allFree ? false : i >= freeCount;

                // --- ЗАПОЛНЕНИЕ ПОЛЕЙ ---
                const titleInput = await waitForElement('input[placeholder="Название"]');
                simulateInput(titleInput, chapter.title);
                await delay(300);

                const contentBox = await waitForElement('div[data-lexical-editor="true"]');
                simulatePaste(contentBox, chapter.content); // Используем новый метод вставки
                await delay(500); // Даем редактору время обработать вставленный текст

                // --- УСТАНОВКА СТАТУСА "ПЛАТНАЯ" ---
                const paidSwitch = await waitForElement('button[role="switch"]');
                const currentState = paidSwitch.getAttribute('data-state');
                if ((isPaid && currentState === 'unchecked') || (!isPaid && currentState === 'checked')) {
                    paidSwitch.click();
                    await delay(300);
                }

                // --- ВЫБОР ПАБЛИШЕРА ---
                const publisherTrigger = await waitForElement('input[placeholder="Паблишеры"]');
                publisherTrigger.parentElement.parentElement.click();
                await delay(500);
                const publisherItem = await waitForElement('div[cmdk-item][data-value="Zabaichen Bank Selector"]');
                publisherItem.click();
                await delay(300);

                // --- ВЫБОР ДАТЫ ---
                const dateTriggerSpan = Array.from(document.querySelectorAll('button > span')).find(span => span.textContent.trim() === 'Выберите дату');
                if (dateTriggerSpan) {
                    dateTriggerSpan.parentElement.click();
                    await delay(500);
                    const today = new Date().getDate().toString();
                    const todayButton = Array.from(document.querySelectorAll('button[name="day"]:not([disabled])')).find(btn => btn.textContent === today);
                    if (todayButton) {
                        todayButton.click();
                        await delay(300);
                    } else {
                        document.body.click();
                        await delay(200);
                    }
                }

                // --- ДОБАВЛЕНИЕ СЛЕДУЮЩЕЙ ГЛАВЫ ---
                if (i < totalChapters - 1) {
                    const addButton = Array.from(document.querySelectorAll('button')).find(btn => {
                        const hasCorrectText = Array.from(btn.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() === 'Добавить');
                        const hasPlusIcon = btn.querySelector('svg > path[d="M5 10H15"]');
                        return hasCorrectText && hasPlusIcon;
                    });

                    if (addButton) {
                        addButton.click();
                        await delay(1500);

                        // --- ВЫБОР СЛЕДУЮЩЕЙ ГЛАВЫ В МЕНЮ ---
                        const menuItems = document.querySelectorAll('div[class*="md:border-r"] p.cursor-pointer');
                        const nextMenuItem = menuItems[i + 1];
                        if (nextMenuItem) {
                            nextMenuItem.click();
                            await delay(1000);
                        } else {
                            throw new Error(`Не удалось найти ${i + 2}-й элемент главы в меню слева.`);
                        }
                    } else {
                        throw new Error('Не найдена кнопка "Добавить"');
                    }
                }
            }

            ui.updateProgress(totalChapters, totalChapters, `Готово! Обработано ${totalChapters} глав.`);
        } catch (error) {
            console.error('Ошибка в процессе загрузки:', error);
            ui.updateProgress(0, 1, `Ошибка: ${error.message}`, true);
        } finally {
            ui.setButtonState(false, 'Начать загрузку');
        }
    }

    // --- Управление UI ---
    const ui = {
        elements: {},
        init: function() {
            this.elements.startButton = document.getElementById('renovels-uploader-start');
            this.elements.progressText = document.getElementById('renovels-uploader-progress-text');
            this.elements.progressBarFill = document.getElementById('renovels-uploader-progress-bar');
        },
        updateProgress: function(current, total, text, isError = false) {
            this.elements.progressText.textContent = text;
            const percentage = total > 0 ? (current / total) * 100 : 0;
            this.elements.progressBarFill.style.width = `${percentage}%`;
            this.elements.progressBarFill.style.backgroundColor = isError ? '#e06c75' : '#61afef';
        },
        setButtonState: function(disabled, text) {
            this.elements.startButton.disabled = disabled;
            this.elements.startButton.textContent = text;
        }
    };

    // --- Создание UI ---
    function createUI() {
        const panelHTML = `
            <div id="renovels-uploader-panel">
                <div id="renovels-uploader-header">
                    <h3>Uploader Pro</h3>
                    <div class="renovels-uploader-header-buttons">
                        <button id="renovels-uploader-toggle" title="Свернуть">–</button>
                        <button id="renovels-uploader-close" title="Закрыть">&times;</button>
                    </div>
                </div>
                <div id="renovels-uploader-content">
                    <label for="renovels-uploader-text">Вставьте текст глав:</label>
                    <textarea id="renovels-uploader-text" rows="10" placeholder="Глава 1. Название...\nТекст...\n\nГлава 2. Другое название...\nТекст..."></textarea>
                    <div class="renovels-uploader-controls">
                        <div>
                            <label for="renovels-uploader-free-count">Бесплатных глав:</label>
                            <input type="number" id="renovels-uploader-free-count" value="3" min="0">
                        </div>
                        <div>
                            <input type="checkbox" id="renovels-uploader-all-free">
                            <label for="renovels-uploader-all-free">Все бесплатные</label>
                        </div>
                    </div>
                    <button id="renovels-uploader-start">Начать загрузку</button>
                    <div id="renovels-uploader-progress-container">
                        <div id="renovels-uploader-progress-bar"></div>
                    </div>
                    <p id="renovels-uploader-progress-text">Готов к работе</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        ui.init();

        GM_addStyle(`
            :root {
                --uploader-bg: rgba(40, 44, 52, 0.9);
                --uploader-header-bg: rgba(30, 33, 39, 0.95);
                --uploader-border: #3e4451;
                --uploader-text: #abb2bf;
                --uploader-text-light: #c8ccd4;
                --uploader-accent: #61afef;
                --uploader-accent-hover: #5295c9;
                --uploader-error: #e06c75;
                --uploader-input-bg: #1e2127;
            }
            #renovels-uploader-panel {
                position: fixed; top: 20px; right: 20px; width: 420px;
                background-color: var(--uploader-bg);
                color: var(--uploader-text);
                border: 1px solid var(--uploader-border);
                border-radius: 12px;
                z-index: 9999;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                display: flex; flex-direction: column;
                transition: transform 0.2s ease-out;
            }
            #renovels-uploader-header {
                padding: 12px 20px; background-color: var(--uploader-header-bg); cursor: move;
                border-top-left-radius: 12px; border-top-right-radius: 12px;
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 1px solid var(--uploader-border);
            }
            #renovels-uploader-header h3 { margin: 0; font-size: 18px; color: var(--uploader-text-light); }
            .renovels-uploader-header-buttons { display: flex; align-items: center; }
            #renovels-uploader-toggle, #renovels-uploader-close {
                background: none; border: none; color: var(--uploader-text); font-size: 26px;
                cursor: pointer; padding: 0 5px; line-height: 1; transition: color 0.2s;
            }
            #renovels-uploader-toggle { font-weight: bold; padding-bottom: 8px; font-size: 24px; }
            #renovels-uploader-toggle:hover, #renovels-uploader-close:hover { color: var(--uploader-text-light); }

            #renovels-uploader-content {
                padding: 20px; display: flex; flex-direction: column; gap: 15px;
                overflow: hidden;
                transition: max-height 0.3s ease-out, padding-top 0.3s ease-out, padding-bottom 0.3s ease-out, opacity 0.2s ease-out;
                max-height: 80vh; /* Достаточно большое значение для анимации */
                opacity: 1;
            }
            #renovels-uploader-panel.collapsed #renovels-uploader-content {
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                opacity: 0;
            }
            #renovels-uploader-panel.collapsed #renovels-uploader-header {
                border-bottom-color: transparent; /* Скрываем границу в свернутом состоянии */
            }

            #renovels-uploader-content label { font-size: 14px; font-weight: 500; margin-bottom: 2px; display: block; }
            #renovels-uploader-text {
                width: 100%; box-sizing: border-box; background-color: var(--uploader-input-bg);
                color: var(--uploader-text); border: 1px solid var(--uploader-border);
                border-radius: 6px; padding: 10px; resize: vertical; min-height: 120px;
            }
            .renovels-uploader-controls { display: flex; justify-content: space-between; align-items: center; gap: 20px; }
            .renovels-uploader-controls > div { display: flex; align-items: center; gap: 8px; }
            .renovels-uploader-controls label { margin-bottom: 0; font-size: 13px; }
            #renovels-uploader-free-count {
                width: 60px; background-color: var(--uploader-input-bg); color: var(--uploader-text);
                border: 1px solid var(--uploader-border); border-radius: 6px; padding: 6px; text-align: center;
            }
            #renovels-uploader-all-free { accent-color: var(--uploader-accent); transform: scale(1.1); }
            #renovels-uploader-start {
                padding: 12px; background-color: var(--uploader-accent); color: #fff; border: none;
                border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;
                transition: background-color 0.2s, transform 0.1s;
            }
            #renovels-uploader-start:hover:not(:disabled) { background-color: var(--uploader-accent-hover); }
            #renovels-uploader-start:active:not(:disabled) { transform: scale(0.98); }
            #renovels-uploader-start:disabled { background-color: #4b5263; color: #9ca3af; cursor: not-allowed; }
            #renovels-uploader-progress-container {
                width: 100%; height: 8px; background-color: var(--uploader-input-bg);
                border-radius: 4px; overflow: hidden; border: 1px solid var(--uploader-border);
            }
            #renovels-uploader-progress-bar {
                height: 100%; width: 0%; background-color: var(--uploader-accent);
                border-radius: 4px; transition: width 0.4s ease-in-out, background-color 0.4s;
            }
            #renovels-uploader-progress-text {
                margin: 0; font-size: 12px; color: var(--uploader-text); min-height: 16px; text-align: center;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-top: 5px;
            }
        `);

        // --- Логика UI ---
        const panel = document.getElementById('renovels-uploader-panel');
        const header = document.getElementById('renovels-uploader-header');
        const toggleButton = document.getElementById('renovels-uploader-toggle');
        const closeButton = document.getElementById('renovels-uploader-close');
        const allFreeCheckbox = document.getElementById('renovels-uploader-all-free');
        const freeCountInput = document.getElementById('renovels-uploader-free-count');

        document.getElementById('renovels-uploader-start').addEventListener('click', startProcessing);
        closeButton.addEventListener('click', () => panel.remove());

        // **НОВОЕ: Логика сворачивания/разворачивания**
        toggleButton.addEventListener('click', () => {
            panel.classList.toggle('collapsed');
            const isCollapsed = panel.classList.contains('collapsed');
            toggleButton.textContent = isCollapsed ? '□' : '–';
            toggleButton.title = isCollapsed ? 'Развернуть' : 'Свернуть';
        });

        allFreeCheckbox.addEventListener('change', () => {
            freeCountInput.disabled = allFreeCheckbox.checked;
        });

        // Логика перетаскивания окна
        let isDragging = false, offset = { x: 0, y: 0 };
        header.addEventListener('mousedown', (e) => {
            // Не начинать перетаскивание, если клик был на кнопке
            if (e.target.closest('button')) return;
            isDragging = true;
            offset = { x: e.clientX - panel.offsetLeft, y: e.clientY - panel.offsetTop };
            header.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            panel.style.left = `${e.clientX - offset.x}px`;
            panel.style.top = `${e.clientY - offset.y}px`;
        });
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
            }
        });
    }

    window.addEventListener('load', createUI);
})();