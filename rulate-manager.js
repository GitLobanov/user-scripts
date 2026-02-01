// ==UserScript==
// @name         Rulate Manager
// @namespace    http://tampermonkey.net/
// @version      30.0
// @description  Добавлены напоминания, поиск, ссылки на оригинал и другие улучшения по вашему запросу.
// @author       You
// @match        *://tl.rulate.ru/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
'use strict';

if (window.top !== window.self) return;

// ==========================================
// 0. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
function getCurrentBookId() {
    const m = location.pathname.match(/\/book\/(\d+)/);
    return m ? m[1] : null;
}
const currentBookId = getCurrentBookId();

// ==========================================
// 0.1 НАСТРОЙКИ И ПЕРЕМЕННЫЕ
// ==========================================
const KEYS = {
    BOOKS: 'rulate_saved_books_v3', // v3 for originalUrl
    BLOCKED: 'rulate_blocked_books',
    STATS: 'rulate_cached_stats_v1',
    CHECKED: 'rulate_checked_ids',
    AUTO_LIKE_BOOK: 'rulate_setting_autolike_book',
    AUTO_LIKE_CHAPTER: 'rulate_setting_autolike_chapter',
    TIMER: 'rulate_setting_timer',
    THEME: 'rulate_setting_theme',
    DELAY: 'rulate_action_delay',
    AD_PRESETS: 'rulate_ad_presets',
    AD_SETTINGS: 'rulate_ad_settings',
    COVER_CACHE: 'rulate_cover_cache_v2',
    COMPLEX_OPTS_PREFIX: 'rulate_complex_opts_',
    REMINDERS: 'rulate_reminders_v1',
    REMINDER_OPTS: 'rulate_reminder_opts'
};

const SESS_KEYS = {
    AUTO_NEXT_ACTIVE: 'rulate_sess_autonext_active',
    COMPLEX_STATE_PREFIX: 'rulate_sess_state_'
};

const SIM_KEY_PREFIX = 'rulate_sim_book_';

let isAutoLikeBookActive = JSON.parse(localStorage.getItem(KEYS.AUTO_LIKE_BOOK) ?? 'true');
let isAutoLikeChapterActive = JSON.parse(localStorage.getItem(KEYS.AUTO_LIKE_CHAPTER) ?? 'true');
let waitSeconds = parseInt(localStorage.getItem(KEYS.TIMER) || '5');
let actionDelay = parseInt(localStorage.getItem(KEYS.DELAY) || '1000');
let theme = JSON.parse(localStorage.getItem(KEYS.THEME) || '{"opacity":0.95, "color":"#212529"}');
let adSettings = JSON.parse(localStorage.getItem(KEYS.AD_SETTINGS) || JSON.stringify({
    borderWidth: 3, borderColor1: '#ff00cc', borderColor2: '#3333ff', borderRadius: 4,
    watermarkText: '👑 Автор', watermarkBg: 'rgba(0,0,0,0.7)', watermarkColor: '#ffd700'
}));

let savedBooks = JSON.parse(localStorage.getItem(KEYS.BOOKS) || '[]');
let blockedBooks = JSON.parse(localStorage.getItem(KEYS.BLOCKED) || '[]');
let parsedStatsData = JSON.parse(localStorage.getItem(KEYS.STATS) || '[]');
let checkedIds = JSON.parse(localStorage.getItem(KEYS.CHECKED) || '[]');
let adPresets = JSON.parse(localStorage.getItem(KEYS.AD_PRESETS) || '[]');
let coverCache = JSON.parse(localStorage.getItem(KEYS.COVER_CACHE) || '{}');
let reminders = JSON.parse(localStorage.getItem(KEYS.REMINDERS) || '[]');
let reminderOpts = JSON.parse(localStorage.getItem(KEYS.REMINDER_OPTS) || '{"snoozeDefault": 10}');

const DEFAULT_COMPLEX_OPTS = { enabled: false, stepsNext: 10, stepsPrev: 10, cyclic: false, noBack: false };
const DEFAULT_COMPLEX_STATE = { dir: 'next', count: 0 };

function getComplexOpts() {
    if (!currentBookId) return DEFAULT_COMPLEX_OPTS;
    const key = KEYS.COMPLEX_OPTS_PREFIX + currentBookId;
    // Merge defaults with saved options to handle new properties like 'noBack'
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return { ...DEFAULT_COMPLEX_OPTS, ...saved };
}
function getComplexState() {
    if (!currentBookId) return DEFAULT_COMPLEX_STATE;
    const key = SESS_KEYS.COMPLEX_STATE_PREFIX + currentBookId;
    return JSON.parse(sessionStorage.getItem(key) || JSON.stringify(DEFAULT_COMPLEX_STATE));
}

let complexOpts = getComplexOpts();
let complexState = getComplexState();
let isSessionActive = JSON.parse(sessionStorage.getItem(SESS_KEYS.AUTO_NEXT_ACTIVE) || 'false');

let secondsLeft = waitSeconds;
let isLiked = false;
let isMenuOpen = false;
let currentSort = { col: 'rating', asc: true };

function getSimState() {
    if (!currentBookId) return { active: false };
    return JSON.parse(localStorage.getItem(SIM_KEY_PREFIX + currentBookId) || '{"active":false}');
}
let simState = getSimState();

// ==========================================
// 1. СТИЛИ (CSS)
// ==========================================
const style = document.createElement('style');
style.innerHTML = `
    .r-menu { position: fixed; bottom: 70px; right: 20px; width: 700px; max-width: 95vw; color: #fff; border-radius: 10px; border: 1px solid #444; padding: 0; display: none; z-index: 99998; font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; backdrop-filter: blur(5px); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    .r-tabs { display: flex; background: rgba(0,0,0,0.3); border-bottom: 1px solid #444; border-radius: 10px 10px 0 0; overflow: hidden; flex-wrap: wrap; }
    .r-tab { flex: 1; padding: 12px 5px; text-align: center; cursor: pointer; background: transparent; border: none; color: #aaa; font-weight: bold; font-size: 12px; transition: 0.2s; white-space: nowrap; min-width: 60px; }
    .r-tab:hover { background: rgba(255,255,255,0.05); color: #ccc; }
    .r-tab.active { background: rgba(255,255,255,0.1); color: #fff; border-bottom: 3px solid #007bff; }
    .r-content { padding: 15px; display: none; max-height: 600px; overflow-y: auto; }
    .r-content.active { display: block; }

    /* Animation Click Effect */
    .r-btn, .r-tab, .r-act-btn, .r-btn-xs, .r-preset-btn, #btn_toggle, #btn_settings { transition: transform 0.1s ease-in-out, opacity 0.2s; }
    .r-click-anim { transform: scale(0.95) !important; opacity: 0.8; }

    .r-btn { width: 100%; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; color: white; margin-top: 5px; }
    .r-btn:hover { opacity: 0.9; }
    .r-input { width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; margin-bottom: 5px; box-sizing: border-box; background: #333; color: white; }
    .r-select { width: 100%; padding: 8px; background: #333; color: white; border: 1px solid #555; border-radius: 4px; margin-bottom: 10px; }
    .r-list { max-height: 250px; overflow-y: auto; margin: 10px 0; border: 1px solid #555; padding: 5px; background: rgba(0,0,0,0.3); }
    .r-row { display: flex; align-items: center; border-bottom: 1px solid #333; padding: 5px 0; }
    .r-act-btn { cursor:pointer; padding: 2px 8px; font-weight:bold; margin-left: 5px; border-radius: 3px; font-size: 14px; text-decoration: none; }
    .r-act-del { color: #dc3545; }
    .r-act-block { color: #ffc107; }
    .r-act-restore { color: #28a745; }
    .r-stat-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    .r-stat-table th, .r-stat-table td { padding: 8px; border: 1px solid #444; text-align: center; }
    .r-stat-table th { background: #333; cursor: pointer; user-select: none; }
    .r-stat-table td a { color: #61dafb; text-decoration: none; }
    .r-stat-table tr:nth-child(even) { background: rgba(255,255,255,0.03); }
    .r-medal-container { display: flex; gap: 10px; justify-content: center; margin-bottom: 10px; }
    .r-medal-card { flex: 1; background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px 10px; text-align: center; border-top: 4px solid #555; display:flex; flex-direction:column; justify-content:space-between; height: 120px; overflow: hidden; }
    .r-medal-1 { border-color: #FFD700; background: linear-gradient(to bottom, rgba(255, 215, 0, 0.15), rgba(0,0,0,0.2)); }
    .r-medal-2 { border-color: #C0C0C0; background: linear-gradient(to bottom, rgba(192, 192, 192, 0.15), rgba(0,0,0,0.2)); }
    .r-medal-3 { border-color: #CD7F32; background: linear-gradient(to bottom, rgba(205, 127, 50, 0.15), rgba(0,0,0,0.2)); }
    .r-medal-icon { font-size: 28px; margin-bottom: 5px; }
    .r-medal-val { font-weight: bold; font-size: 16px; color: #fff; margin-top:5px; }
    .r-book-link { color: #61dafb; text-decoration: none; font-size: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .r-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .r-stat-card { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; border-left: 4px solid #555; display: flex; flex-direction: column; justify-content: center; min-height: 60px; min-width: 0; }
    .r-card-income { border-color: #28a745; background: linear-gradient(90deg, rgba(40,167,69,0.1), transparent); }
    .r-card-views { border-color: #17a2b8; background: linear-gradient(90deg, rgba(23,162,184,0.1), transparent); }
    .r-card-likes { border-color: #ffc107; background: linear-gradient(90deg, rgba(255,193,7,0.1), transparent); }
    .r-card-bm { border-color: #fd7e14; background: linear-gradient(90deg, rgba(253,126,20,0.1), transparent); }
    .r-stat-name { font-size: 11px; color: #61dafb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; display: block; max-width: 100%; }

    .r-process-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 100000; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; }
    .r-progress-bar-bg { width: 300px; height: 10px; background: #444; border-radius: 5px; margin-top: 20px; overflow: hidden; }
    .r-progress-bar-fill { height: 100%; background: #28a745; width: 0%; transition: width 0.3s; }
    .r-pulse-icon { font-size: 60px; margin-bottom: 20px; animation: pulse 1s infinite; }
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
    .pacman-loader { width: 100px; height: 30px; position: relative; margin: 20px auto; }
    .pacman { position: absolute; left: 0; top: 0; width: 30px; height: 30px; background: #FFD700; border-radius: 50%; clip-path: polygon(100% 74%, 44% 48%, 100% 21%); animation: eat 0.5s infinite linear alternate, moveRight 2s linear infinite; z-index: 2; }
    .dot { position: absolute; top: 12px; width: 6px; height: 6px; background: #fff; border-radius: 50%; z-index: 1; }
    .dot:nth-child(2) { left: 40px; } .dot:nth-child(3) { left: 70px; } .dot:nth-child(4) { left: 100px; }
    @keyframes eat { 0% { clip-path: polygon(100% 74%, 44% 48%, 100% 21%); } 100% { clip-path: polygon(100% 100%, 0% 50%, 100% 0%); } }
    @keyframes moveRight { 0% { left: 0; } 100% { left: 80px; } }

    .r-mini-tree { position: relative; width: 16px; height: 22px; margin-right: 8px; flex-shrink: 0; }
    .r-tree-body { width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 22px solid #198754; position: relative; }
    .r-tree-star { position: absolute; top: -3px; left: -3px; color: gold; font-size: 8px; z-index: 2; text-shadow: 0 0 2px orange; animation: r-twirl 4s infinite linear; }
    .r-tree-light { position: absolute; width: 3px; height: 3px; border-radius: 50%; animation: r-flash 1s infinite alternate; box-shadow: 0 0 2px currentColor; }
    .r-l1 { top: 6px; left: -1px; background: #ff0000; animation-delay: 0s; }
    .r-l2 { top: 11px; left: 2px; background: #ffd700; animation-delay: 0.3s; }
    .r-l3 { top: 11px; left: -4px; background: #00ffff; animation-delay: 0.6s; }
    .r-tree-ball { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: radial-gradient(circle at 1px 1px, #fff, #dc3545); transform-origin: 50% -2px; animation: r-sway 2.5s infinite ease-in-out; }
    .r-b1 { top: 17px; left: -6px; animation-duration: 2s; }
    .r-b2 { top: 17px; left: 3px; animation-duration: 3s; background: radial-gradient(circle at 1px 1px, #fff, #6f42c1); }
    @keyframes r-flash { 0% { opacity: 0.6; filter: brightness(1); } 100% { opacity: 1; filter: brightness(2); box-shadow: 0 0 5px currentColor; } }
    @keyframes r-sway { 0% { transform: rotate(-15deg); } 100% { transform: rotate(15deg); } }
    @keyframes r-twirl { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .r-preset-btn { background: #555; border: 1px solid #777; color: #ddd; padding: 2px 8px; border-radius: 10px; margin-right: 5px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; margin-bottom: 5px; }
    .r-preset-btn:hover { background: #666; color: #fff; }
    .r-preset-del { color: #dc3545; font-weight: bold; cursor: pointer; }

    .r-view-toggle { display: inline-flex; margin-left: auto; }
    .r-btn-xs { padding: 4px 10px; font-size: 11px; border: none; cursor: pointer; color: white; opacity: 0.7; transition:0.2s; border-radius:0; }
    .r-btn-xs:first-child { border-radius: 4px 0 0 4px; }
    .r-btn-xs:last-child { border-radius: 0 4px 4px 0; }
    .r-btn-xs.active { opacity: 1; background: #007bff !important; font-weight:bold; box-shadow: inset 0 0 5px rgba(0,0,0,0.3); }

    .r-setting-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 12px; }
    .r-setting-label { color: #ccc; }
    .r-color-picker { width: 40px; height: 25px; padding: 0; border: none; cursor: pointer; background: none; }
    .r-range { width: 100px; vertical-align: middle; }
    .r-complex-box { background: rgba(255, 255, 255, 0.05); padding: 10px; border-radius: 5px; margin-top: 10px; border-left: 3px solid #6f42c1; }

    /* REMINDER STYLES */
    .r-rem-group { margin-bottom: 15px; }
    .r-rem-header { font-size: 11px; color: #17a2b8; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #444; padding-bottom: 2px; }
    .r-rem-card { background: rgba(255,255,255,0.05); border-radius: 5px; padding: 8px; margin-bottom: 5px; border-left: 3px solid #666; display: flex; justify-content: space-between; align-items: center; }
    .r-rem-card.wait { border-color: #ffc107; }
    .r-rem-card.done { border-color: #28a745; opacity: 0.6; }
    .r-rem-time { font-weight: bold; font-size: 13px; color: #fff; margin-right: 10px; }
    .r-rem-name { font-size: 12px; color: #61dafb; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none; transition: 0.2s; }
    .r-rem-name:hover { color: #fff; text-decoration: underline; }
    .r-rem-act { display: flex; gap: 5px; }

    .r-notification { position: fixed; bottom: 85px; right: 20px; width: 300px; background: rgba(40, 44, 52, 0.95); backdrop-filter: blur(8px); border: 1px solid #17a2b8; border-radius: 8px; box-shadow: 0 5px 20px rgba(0,0,0,0.5); padding: 15px; z-index: 100000; display: none; color: white; animation: slideUp 0.3s ease-out; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .r-notif-title { font-weight: bold; font-size: 14px; margin-bottom: 5px; color: #61dafb; display: flex; align-items: center; gap: 5px; }
    .r-notif-body { font-size: 12px; color: #eee; margin-bottom: 10px; line-height: 1.4; }
    .r-notif-actions { display: flex; gap: 5px; }
    .r-side-drawer {
        position: absolute;
        top: 0;
        right: 100%; /* Слева от основного меню */
        width: 300px;
        height: 100%;
        background: rgba(30, 30, 35, 0.95);
        border: 1px solid #444;
        border-right: none;
        border-radius: 10px 0 0 10px;
        margin-right: 5px; /* Отступ от меню */
        display: none;
        flex-direction: column;
        z-index: 99997;
        backdrop-filter: blur(5px);
        box-shadow: -5px 5px 20px rgba(0,0,0,0.5);
    }
    .r-side-drawer.open { display: flex; }
    .r-drawer-header { padding: 10px; background: rgba(0,0,0,0.3); border-bottom: 1px solid #444; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
    .r-drawer-content { flex: 1; overflow-y: auto; padding: 10px; }

    .r-missing-card { background: rgba(255,255,255,0.05); padding: 5px; border-radius: 4px; margin-bottom: 5px; border-left: 3px solid #dc3545; font-size: 11px; }
    .r-missing-actions { display: flex; gap: 5px; margin-top: 5px; }

    .r-status-icon { cursor: pointer; margin-right: 5px; font-size: 14px; user-select: none; }
    .r-status-finished { opacity: 0.5; text-decoration: line-through; color: #aaa; }
`;
document.head.appendChild(style);

// ==========================================
// 3. ИНТЕРФЕЙС
// ==========================================
const menuDiv = document.createElement('div');
menuDiv.className = 'r-menu';
document.body.appendChild(menuDiv);

// Notification Element
const notifDiv = document.createElement('div');
notifDiv.className = 'r-notification';
notifDiv.style.display = 'none';
document.body.appendChild(notifDiv);

menuDiv.innerHTML = `
    <div class="r-tabs">
        <button class="r-tab active" id="tab1">📈 Продвижение</button>
        <button class="r-tab" id="tab8">⏰ Напом.</button>
        <button class="r-tab" id="tab7">📢 Реклама</button>
        <button class="r-tab" id="tab6">🏆 Топы</button>
        <button class="r-tab" id="tab3">ℹ️ Инфо</button>
        <button class="r-tab" id="tab5">⛔ Блок</button>
        <button class="r-tab" id="tab2">🤖 Бот</button>
        <button class="r-tab" id="tab4">🎨 Вид</button>
    </div>

    <div class="r-content active" id="content1">
        <input type="text" id="inp_search" placeholder="🔍 Поиск по названию..." class="r-input" style="margin-bottom:10px;">
        <div style="display:flex;gap:5px;">
            <input id="inp_id" type="number" placeholder="ID" class="r-input" style="width:70px;">
            <input id="inp_name" type="text" placeholder="Имя" class="r-input">
        </div>
        <div style="display:flex;gap:5px;">
            <button id="btn_add" class="r-btn" style="background:#28a745;">+ Добавить</button>
            <button id="btn_add_curr" class="r-btn" style="background:#17a2b8;">📥 Текущую</button>
        </div>
        <div class="r-list" id="list_container"></div>
        <div style="display:flex;gap:5px;">
            <button id="btn_sel_all" class="r-btn" style="background:#555;font-size:11px;">Выбрать все</button>
            <button id="btn_desel_all" class="r-btn" style="background:#555;font-size:11px;">Снять все</button>
        </div>
        <hr style="border-color:#444">
        <div style="display:flex;align-items:center;margin-bottom:5px;">
            <span style="font-size:11px;color:#aaa;margin-right:10px;">Задержка (мс):</span>
            <input type="number" id="inp_mass_delay" value="${actionDelay}" class="r-input" style="width:70px;">
        </div>
        <button id="btn_mass_bm" class="r-btn" style="background:#fd7e14;">🔖 Проставить закладки</button>
        <button id="btn_mass_unread" class="r-btn" style="background:#dc3545; margin-top:5px;">🗑️ Убрать из списка (Сброс)</button>
    </div>

    <div class="r-content" id="content8">
        <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:5px; margin-bottom:10px;">
            <button id="btn_toggle_missing" class="r-btn" style="background: #6f42c1; margin-bottom: 10px;">🔍 Книги без напоминаний</button>


             <div style="margin-bottom:5px; font-size:12px; color:#aaa;">Создать напоминание:</div>

             <label style="display:flex; align-items:center; font-size:12px; margin-bottom:10px; cursor:pointer;">
                 <input type="checkbox" id="chk_custom_rem">
                 <span style="margin-left:8px;">📌 Произвольное напоминание</span>
             </label>

             <div id="rem_book_selector_div">
                <input type="text" id="rem_book_search" class="r-input" placeholder="Поиск книги для напоминания..." style="margin-bottom: 5px;">
                <select id="rem_book_sel" class="r-select" style="margin-bottom:5px;"></select>
             </div>

             <div id="rem_custom_text_div" style="display:none;">
                <input type="text" id="rem_custom_text_inp" class="r-input" placeholder="Текст напоминания (напр. 'День книг с рейтингом R')">
             </div>

             <div style="display:flex; gap:5px; margin-top:5px;">
                 <input type="datetime-local" id="rem_date_inp" class="r-input">
                 <button id="btn_add_rem" class="r-btn" style="width:auto; margin:0; background:#28a745;">+</button>
             </div>
             <div style="font-size:10px; color:#777; margin-top:5px; display:flex; align-items:center;">
                <span>Кнопка отложить (мин):</span>
                <input type="number" id="inp_snooze_def" value="${reminderOpts.snoozeDefault}" class="r-input" style="width:50px; padding:2px; margin:0 5px; height:auto;">
             </div>
        </div>

        <div class="r-list" style="height:320px; max-height:320px;">
            <div id="rem_list_waiting"></div>
            <div id="rem_list_scheduled"></div>
        </div>
    </div>

    <div class="r-content" id="content7">
        <div style="display:flex; gap: 10px;">
            <div style="flex:1;">
                <div style="font-size:12px; color:#aaa; margin-bottom:5px;">Настройки стиля:</div>
                <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:4px; margin-bottom:10px;">
                    <div class="r-setting-row">
                        <span class="r-setting-label">Рамка (px): <b id="lbl_border_w">${adSettings.borderWidth}</b></span>
                        <input type="range" class="r-range" id="inp_ad_border_w" min="0" max="10" value="${adSettings.borderWidth}">
                    </div>
                    <div class="r-setting-row">
                        <span class="r-setting-label">Радиус (px): <b id="lbl_border_r">${adSettings.borderRadius}</b></span>
                        <input type="range" class="r-range" id="inp_ad_border_r" min="0" max="20" value="${adSettings.borderRadius}">
                    </div>
                    <div class="r-setting-row">
                        <span class="r-setting-label">Градиент:</span>
                        <div style="display:flex; gap:5px;">
                            <input type="color" class="r-color-picker" id="inp_ad_color_1" value="${adSettings.borderColor1}" title="Start Color">
                            <input type="color" class="r-color-picker" id="inp_ad_color_2" value="${adSettings.borderColor2}" title="End Color">
                        </div>
                    </div>
                </div>
            </div>
            <div style="flex:1; display:flex; flex-direction:column;">
                 <div style="font-size:12px; color:#aaa; margin-bottom:5px;">Пресеты:</div>
                 <div id="ad_presets_container" style="flex:1; overflow-y:auto; max-height:80px;"></div>
                 <div style="display:flex; gap:5px; margin-top:5px;">
                    <input type="text" id="inp_preset_name" class="r-input" placeholder="Название..." style="font-size:11px;">
                    <button id="btn_save_preset" class="r-btn" style="width:auto; padding:5px 10px; margin:0; background:#6f42c1;">💾</button>
                </div>
            </div>
        </div>
        <div style="font-size:12px; color:#aaa; margin-bottom:5px; margin-top:5px; display:flex; justify-content:space-between;">
            <span>Книги для рекламы:</span>
        </div>
        <div class="r-list" id="ad_list_container" style="max-height:180px;"></div>
        <button id="btn_gen_ad" class="r-btn" style="background: linear-gradient(90deg, #28a745, #17a2b8);">✨ Сгенерировать код</button>
        <button id="btn_clear_covers" class="r-btn" style="background: #dc3545; margin-top: 5px; font-size: 12px;">🗑️ Сбросить кэш обложек (искать заново)</button>
        <div style="margin-top:10px; display:flex; align-items:center;">
            <label style="font-size:12px; flex:1">Результат:</label>
            <div class="r-view-toggle">
                <button class="r-btn-xs active" id="btn_view_code" style="background:#555;">📝 Код</button>
                <button class="r-btn-xs" id="btn_view_prev" style="background:#444;">👁️ Просмотр</button>
            </div>
        </div>
        <textarea id="ad_output" class="r-input" style="height:100px; font-family:monospace; font-size:11px;"></textarea>
        <div id="ad_preview" style="display:none; height:100px; background:#fff; color:#000; padding:10px; border:1px solid #ccc; overflow:auto; border-radius:4px;"></div>
    </div>

    <div class="r-content" id="content6">
        <div id="tops_placeholder" style="text-align:center;color:#777;padding:20px;">Нет данных.<br>Обновите статистику во вкладке "Инфо".</div>
        <div id="tops_container" style="display:none;">
            <div class="r-top-section"><div class="r-top-header">🎖️ Лидеры рейтинга (Топ-3)</div><div class="r-medal-container" id="medal_container"></div></div>
            <div class="r-top-section"><div class="r-top-header">📊 Рекорды по категориям</div><div class="r-stat-grid" id="records_grid"></div></div>
        </div>
    </div>

    <div class="r-content" id="content3">
        <div style="display:flex;gap:5px;">
            <button id="btn_fetch_stats" class="r-btn" style="background:#17a2b8;">🔄 Обновить данные</button>
            <button id="btn_sync_list" class="r-btn" style="background:#28a745;">📥 Загрузить (без заблокированных)</button>
        </div>
        <div id="stats_loading" style="display:none;"><div class="pacman-loader"><div class="pacman"></div><div class="dot"></div><div class="dot"></div><div class="dot"></div></div><div style="text-align:center;color:#aaa;font-size:11px;">Поедаем данные...</div></div>
        <div style="max-height:450px;overflow:auto;margin-top:10px;"><table class="r-stat-table" id="stat_table"><thead><tr><th data-sort="name">Книга</th><th data-sort="rating">Рейт.</th><th data-sort="income">Доход</th><th data-sort="views">Просм.</th><th data-sort="thanks">Спас.</th><th data-sort="likes">Лайк</th><th data-sort="bm">Закл.</th></tr></thead><tbody id="stat_tbody"></tbody></table></div>
    </div>

    <div class="r-content" id="content5">
        <div style="color:#ccc; font-size:12px; margin-bottom:10px; text-align:center;">Книги здесь игнорируются при загрузке.</div>
        <div class="r-list" id="block_list_container"></div>
        <button id="btn_clear_block" class="r-btn" style="background:#dc3545;">Очистить весь блок-лист</button>
    </div>

    <div class="r-content" id="content2">
        <div style="background:rgba(0,0,0,0.2);padding:10px;border-radius:5px;margin-bottom:15px;">
            <div style="margin-bottom:10px;font-weight:bold;color:#61dafb;">Настройки авто-лайка:</div>
            <label style="display:flex;align-items:center;margin-bottom:5px;cursor:pointer;">
                <input type="checkbox" id="chk_autolike_book" ${isAutoLikeBookActive?'checked':''}>
                <span style="margin-left:10px;">Авто-лайк КНИГИ</span>
            </label>
            <label style="display:flex;align-items:center;margin-bottom:10px;cursor:pointer;">
                <input type="checkbox" id="chk_autolike_chapter" ${isAutoLikeChapterActive?'checked':''}>
                <span style="margin-left:10px;">Авто-лайк ГЛАВЫ</span>
            </label>

            <div style="display:flex;align-items:center;border-top:1px solid #444;padding-top:10px;">
                <span>Таймер (сек):</span>
                <input type="number" id="inp_timer" value="${waitSeconds}" class="r-input" style="width:60px;margin:0 0 0 10px;text-align:center;">
            </div>
        </div>

        <div id="complex_settings_container" class="r-complex-box" style="display:none;">
             <div style="margin-bottom:5px;font-weight:bold;color:#be85ff;">Сложный режим (ДЛЯ ЭТОЙ КНИГИ):</div>
             <label style="display:flex;align-items:center;margin-bottom:5px;cursor:pointer;font-size:12px;">
                <input type="checkbox" id="chk_complex_enable" ${complexOpts.enabled?'checked':''}>
                <span style="margin-left:10px;">Включить сложный режим</span>
            </label>
             <div style="display:flex; gap:10px; margin-bottom:5px;">
                <div style="flex:1">
                    <span style="font-size:11px;">Вперед (раз):</span>
                    <input type="number" id="inp_steps_next" value="${complexOpts.stepsNext}" class="r-input">
                </div>
                <div style="flex:1">
                    <span style="font-size:11px;">Назад (раз):</span>
                    <input type="number" id="inp_steps_prev" value="${complexOpts.stepsPrev}" class="r-input">
                </div>
             </div>
             <label style="display:flex;align-items:center;cursor:pointer;font-size:12px;margin-bottom:5px;">
                <input type="checkbox" id="chk_complex_no_back" ${complexOpts.noBack?'checked':''}>
                <span style="margin-left:10px;">Отключить ход назад</span>
            </label>
             <label style="display:flex;align-items:center;cursor:pointer;font-size:12px;margin-bottom:10px;">
                <input type="checkbox" id="chk_complex_cyclic" ${complexOpts.cyclic?'checked':''}>
                <span style="margin-left:10px;">Цикличный режим (∞)</span>
            </label>
            <button id="btn_reset_complex" class="r-btn" style="background:#555;font-size:12px;padding:5px;">↺ Сброс счетчика книги</button>
            <div id="complex_status_menu" style="font-size:11px;color:#aaa;margin-top:5px;text-align:center;"></div>
        </div>
        <div id="complex_no_book" style="display:none; text-align:center; color:#777; font-size:12px; margin-top:10px;">
            (Откройте книгу, чтобы настроить сложный режим)
        </div>

        <hr style="border-color:#444">
        <label>Расширенная симуляция (Очередь):</label>
        <select id="sim_start_select" class="r-select"></select>
        <button id="btn_start_sim" class="r-btn" style="background:#6f42c1;padding:15px;">🚀 СТАРТ СИМУЛЯЦИИ</button>
        <button id="btn_stop_sim" class="r-btn" style="background:#dc3545;padding:15px;display:${simState.active?'block':'none'}">🛑 СТОП</button>
        <div id="sim_status" style="margin-top:15px;text-align:center;color:#aaa;font-size:11px;"></div>
    </div>

    <div class="r-content" id="content4">
        <label>Прозрачность: <span id="val_opacity">${theme.opacity}</span></label>
        <input type="range" id="rng_opacity" min="0.5" max="1" step="0.05" value="${theme.opacity}" style="width:100%">
        <label style="margin-top:10px;display:block;">Цвет фона:</label>
        <input type="color" id="inp_color" value="${theme.color}" style="width:100%;height:40px;cursor:pointer;border:none;">
        <button id="btn_reset_theme" class="r-btn" style="background:#6c757d;margin-top:20px;">Сбросить тему</button>
    </div>
    <div class="r-side-drawer" id="missing_rem_drawer">
        <div class="r-drawer-header">
            <span>Без напоминаний</span>
            <button id="btn_close_drawer" style="background:none; border:none; color:#fff; cursor:pointer;">✖</button>
        </div>
        <div class="r-drawer-content" id="missing_rem_list">
            <!-- Сюда скрипт добавит книги -->
        </div>
    </div>
`;

const mainDiv = document.createElement('div');
Object.assign(mainDiv.style, { position: 'fixed', bottom: '20px', right: '20px', padding: '10px 20px', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '15px', zIndex: '99999', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', color: '#fff', transition: 'background 0.3s' });
mainDiv.innerHTML = `
    <div class="r-mini-tree">
        <div class="r-tree-body">
            <div class="r-tree-star">★</div>
            <div class="r-tree-light r-l1"></div>
            <div class="r-tree-light r-l2"></div>
            <div class="r-tree-light r-l3"></div>
            <div class="r-tree-ball r-b1"></div>
            <div class="r-tree-ball r-b2"></div>
        </div>
    </div>
    <span id="status_text">...</span><div style="width:1px;height:20px;background:rgba(255,255,255,0.4)"></div><button id="btn_toggle" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">⏯</button><div style="width:1px;height:20px;background:rgba(255,255,255,0.4)"></div><button id="btn_settings" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">⚙️</button>`;
document.body.appendChild(mainDiv);

// ==========================================
// 4. ФУНКЦИОНАЛ
// ==========================================
const toggleCheck = (id, status) => { if(status){ if(!checkedIds.includes(id)) checkedIds.push(id); } else { checkedIds=checkedIds.filter(x=>x!==id); } localStorage.setItem(KEYS.CHECKED, JSON.stringify(checkedIds)); };

const saveAdSettings = () => localStorage.setItem(KEYS.AD_SETTINGS, JSON.stringify(adSettings));
document.getElementById('inp_ad_border_w').oninput = (e) => { adSettings.borderWidth = e.target.value; document.getElementById('lbl_border_w').innerText = e.target.value; saveAdSettings(); };
document.getElementById('inp_ad_border_r').oninput = (e) => { adSettings.borderRadius = e.target.value; document.getElementById('lbl_border_r').innerText = e.target.value; saveAdSettings(); };
document.getElementById('inp_ad_color_1').oninput = (e) => { adSettings.borderColor1 = e.target.value; saveAdSettings(); };
document.getElementById('inp_ad_color_2').oninput = (e) => { adSettings.borderColor2 = e.target.value; saveAdSettings(); };

// Add animation listener
document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.r-btn, .r-tab, .r-act-btn, #btn_toggle, #btn_settings, .r-btn-xs, .r-preset-btn');
    if (btn) {
        btn.classList.add('r-click-anim');
        setTimeout(() => btn.classList.remove('r-click-anim'), 150);
    }
});

menuDiv.addEventListener('click', (e) => {
    const t = e.target;
    if (t.classList.contains('book-sel')) { toggleCheck(t.dataset.id, t.checked); return; }
    if (t.classList.contains('r-preset-del')) {
        const idx = t.dataset.index;
        if(!confirm('Удалить подборку?')) return;
        adPresets.splice(idx, 1);
        localStorage.setItem(KEYS.AD_PRESETS, JSON.stringify(adPresets));
        renderPresets();
        return;
    }
    if (t.classList.contains('r-preset-load')) {
        const idx = t.dataset.index;
        renderAdBookList(adPresets[idx].ids);
        return;
    }
    const actBtn = t.closest('.r-act-btn');
    if (actBtn) {
        const idx = parseInt(actBtn.dataset.index);
        const action = actBtn.dataset.action;

        // Reminder actions
        if (action === 'rem_del') {
            reminders.splice(idx, 1);
            localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
            renderReminders();
            return;
        }
        if (action === 'rem_finish') {
             reminders.splice(idx, 1);
             localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
             renderReminders();
             return;
        }
        if (action === 'rem_snooze_pending') {
            const reminder = reminders[idx];
            if (reminder) {
                reminder.time = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                reminder.status = 'scheduled';
                localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
                renderReminders();
            }
            return;
        }

        if (action === 'del') { savedBooks.splice(idx,1); }
        else if (action === 'block') { const b=savedBooks[idx]; if(!blockedBooks.some(x=>x.id==b.id))blockedBooks.push(b); savedBooks.splice(idx,1); localStorage.setItem(KEYS.BLOCKED,JSON.stringify(blockedBooks)); }
        else if (action === 'restore') { const b=blockedBooks[idx]; if(!savedBooks.some(x=>x.id==b.id))savedBooks.push(b); blockedBooks.splice(idx,1); localStorage.setItem(KEYS.BLOCKED,JSON.stringify(blockedBooks)); }
        else if (action === 'del_block') { blockedBooks.splice(idx,1); localStorage.setItem(KEYS.BLOCKED,JSON.stringify(blockedBooks)); }
        else if (action === 'edit_orig') {
            const book = savedBooks[idx];
            const newUrl = prompt('Введите ссылку на оригинал:', book.originalUrl || '');
            if (newUrl !== null) {
                savedBooks[idx].originalUrl = newUrl.trim();
                localStorage.setItem(KEYS.BOOKS, JSON.stringify(savedBooks));
                renderBookList();
            }
            return;
        }
        localStorage.setItem(KEYS.BOOKS,JSON.stringify(savedBooks));
        renderBookList(); renderBlockList(); updateSimSelect(); renderAdBookList(); updateRemSelect();
        return;
    }
    if (t.tagName === 'TH' && t.dataset.sort) {
        const col = t.dataset.sort;
        if(currentSort.col===col) currentSort.asc=!currentSort.asc; else {currentSort.col=col;currentSort.asc=(col==='rating');}
        renderStatsTable();
        return;
    }
    if (t.classList.contains('r-status-icon')) {
        const idx = t.dataset.index;
        const current = savedBooks[idx].status || 'process';
        savedBooks[idx].status = (current === 'process') ? 'finished' : 'process';
        localStorage.setItem(KEYS.BOOKS, JSON.stringify(savedBooks));
        renderBookList();
        renderMissingReminders(); // Обновляем список "без напоминаний"
        return;
    }
});

document.getElementById('btn_view_code').onclick = () => {
    document.getElementById('ad_output').style.display = 'block';
    document.getElementById('ad_preview').style.display = 'none';
    document.getElementById('btn_view_code').classList.add('active');
    document.getElementById('btn_view_prev').classList.remove('active');
};
document.getElementById('btn_view_prev').onclick = () => {
    const html = document.getElementById('ad_output').value;
    const prev = document.getElementById('ad_preview');
    prev.innerHTML = html;
    document.getElementById('ad_output').style.display = 'none';
    prev.style.display = 'block';
    document.getElementById('btn_view_code').classList.remove('active');
    document.getElementById('btn_view_prev').classList.add('active');
};

function renderBookList() {
    const c = document.getElementById('list_container'); c.innerHTML = '';
    const sv = document.getElementById('inp_search').value.toLowerCase();
    if(savedBooks.length===0){c.innerHTML='<div style="text-align:center;padding:10px;color:#777;">Список пуст</div>';return;}

    savedBooks.forEach((b,i)=>{
        // Default status if missing (migration)
        if(!b.status) b.status = 'process';

        if(sv && !b.name.toLowerCase().includes(sv)) return;
        const chk = checkedIds.includes(b.id);
        const isFinished = b.status === 'finished';

        const d = document.createElement('div'); d.className='r-row';

        // Status Icon logic
        const statusIcon = isFinished ? '🏁' : '🟢';
        const statusTitle = isFinished ? 'Статус: Завершена' : 'Статус: В процессе';
        const nameStyle = isFinished ? 'color:#888; text-decoration:line-through;' : 'color:#61dafb;';

        const origLinkHtml = (b.originalUrl) ? `<a href="${b.originalUrl}" target="_blank" class="r-act-btn" style="color:#61dafb;" title="Перейти к оригиналу">🔗</a>` : '';

        d.innerHTML = `
        <input type="checkbox" class="book-sel" data-id="${b.id}" ${chk?'checked':''} style="margin-right:5px;">
        <span class="r-status-icon" data-index="${i}" title="${statusTitle}">${statusIcon}</span>
        <a href="/book/${b.id}" target="_blank" style="flex:1;${nameStyle}font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.name}</a>
        ${origLinkHtml}
        <span class="r-act-btn" data-action="edit_orig" data-index="${i}" title="Ссылка на оригинал" style="color: #ccc;">✏️</span>
        <span class="r-act-btn r-act-block" data-action="block" data-index="${i}" title="В блок">⛔</span>
        <span class="r-act-btn r-act-del" data-action="del" data-index="${i}" title="Удалить">✖</span>`;
        c.appendChild(d);
    });
}
function renderAdBookList(selectedIds = []) {
    const c = document.getElementById('ad_list_container'); c.innerHTML = '';
    if(savedBooks.length===0){c.innerHTML='<div style="text-align:center;padding:10px;color:#777;">Список пуст</div>';return;}
    savedBooks.forEach((b)=>{
        const isSel = selectedIds.includes(b.id);
        const d = document.createElement('div'); d.className='r-row';
        d.innerHTML = `
            <input type="checkbox" class="ad-sel" data-id="${b.id}" data-name="${b.name.replace(/"/g, '&quot;')}" ${isSel?'checked':''} style="margin-right:10px;">
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <span style="color:#ccc;font-size:12px;">${b.name}</span>
            </div>
        `;
        c.appendChild(d);
    });
}
function renderPresets() {
    const c = document.getElementById('ad_presets_container'); c.innerHTML='';
    adPresets.forEach((p, i) => {
        const btn = document.createElement('span');
        btn.className = 'r-preset-btn';
        btn.innerHTML = `<span class="r-preset-load" data-index="${i}">${p.name} (${p.ids.length})</span> <span class="r-preset-del" data-index="${i}">×</span>`;
        c.appendChild(btn);
    });
}
const savePreset = () => {
    const name = document.getElementById('inp_preset_name').value.trim();
    if(!name) return alert('Введите название!');
    const els = document.querySelectorAll('.ad-sel:checked');
    const ids = Array.from(els).map(e => e.dataset.id);
    if(!ids.length) return alert('Ничего не выбрано!');
    adPresets.push({ name, ids });
    localStorage.setItem(KEYS.AD_PRESETS, JSON.stringify(adPresets));
    document.getElementById('inp_preset_name').value = '';
    renderPresets();
};
document.getElementById('btn_save_preset').onclick = savePreset;
document.getElementById('inp_search').onkeyup = renderBookList;

function renderBlockList() {
    const c = document.getElementById('block_list_container'); c.innerHTML='';
    if(blockedBooks.length===0){c.innerHTML='<div style="text-align:center;padding:10px;color:#777;">Блок-лист пуст</div>';return;}
    blockedBooks.forEach((b,i)=>{
        const d=document.createElement('div'); d.className='r-row';
        d.innerHTML=`<span style="flex:1;color:#999;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:10px;">${b.name} (${b.id})</span>
        <span class="r-act-btn r-act-restore" data-action="restore" data-index="${i}" title="Восстановить">♻️</span>
        <span class="r-act-btn r-act-del" data-action="del_block" data-index="${i}" title="Удалить">✖</span>`;
        c.appendChild(d);
    });
}
document.getElementById('btn_clear_block').onclick=()=>{if(confirm('Очистить?')){blockedBooks=[];localStorage.setItem(KEYS.BLOCKED,JSON.stringify(blockedBooks));renderBlockList();}};

function renderTops() {
    if(!parsedStatsData || !parsedStatsData.length) { document.getElementById('tops_placeholder').style.display='block'; document.getElementById('tops_container').style.display='none'; return; }
    document.getElementById('tops_placeholder').style.display='none'; document.getElementById('tops_container').style.display='block';
    const topRated = parsedStatsData.filter(b=>b.rating>0).sort((a,b)=>a.rating-b.rating).slice(0,3);
    const mc = document.getElementById('medal_container'); mc.innerHTML='';
    if(!topRated.length) mc.innerHTML='<div style="color:#aaa;">Нет рейтинга</div>';
    else topRated.forEach((b,i)=>{ const d=document.createElement('div'); d.className=`r-medal-card r-medal-${i+1}`; d.innerHTML=`<div><div class="r-medal-icon">${i==0?'🥇':i==1?'🥈':'🥉'}</div><a href="/book/${b.id}" target="_blank" class="r-book-link">${b.name}</a></div><div class="r-medal-val">#${b.rating}</div>`; mc.appendChild(d); });
    const maxI = parsedStatsData.reduce((p,c)=>(p.income>c.income?p:c),{income:0,name:'-'});
    const maxV = parsedStatsData.reduce((p,c)=>(p.views>c.views?p:c),{views:0,name:'-'});
    const maxL = parsedStatsData.reduce((p,c)=>(p.likes>c.likes?p:c),{likes:0,name:'-'});
    const maxB = parsedStatsData.reduce((p,c)=>(p.bm>c.bm?p:c),{bm:0,name:'-'});
    document.getElementById('records_grid').innerHTML=`<div class="r-stat-card r-card-income"><div class="r-stat-title">💰 Доход</div><div class="r-stat-value">${maxI.income.toFixed(2)}</div><div class="r-stat-name">${maxI.name}</div></div><div class="r-stat-card r-card-views"><div class="r-stat-title">👁️ Просмотры</div><div class="r-stat-value">${maxV.views}</div><div class="r-stat-name">${maxV.name}</div></div><div class="r-stat-card r-card-likes"><div class="r-stat-title">👍 Лайки</div><div class="r-stat-value">${maxL.likes}</div><div class="r-stat-name">${maxL.name}</div></div><div class="r-stat-card r-card-bm"><div class="r-stat-title">🔖 Закладки</div><div class="r-stat-value">${maxB.bm}</div><div class="r-stat-name">${maxB.name}</div></div>`;
}

async function fetchAndParseStats() {
    const btn=document.getElementById('btn_fetch_stats'), l=document.getElementById('stats_loading');
    btn.disabled=true; l.style.display='block';
    try {
        const r = await fetch('https://tl.rulate.ru/users/170114/stat'); if(!r.ok) throw new Error('Err'); const t = await r.text();
        if(t.includes('name="login[login]"')) throw new Error('Login required');
        const doc = new DOMParser().parseFromString(t,'text/html');
        const rows = doc.querySelectorAll('table.tablesorter tbody tr'); let tmp=[];
        rows.forEach(row=>{
            const c = row.querySelectorAll('td'); if(c.length<10)return;
            const a = c[0].querySelector('a'); const name = a?a.innerText.trim():'Unk'; const href=a?a.getAttribute('href'):'';
            const bid = href.match(/\/book\/(\d+)/)?href.match(/\/book\/(\d+)/)[1]:null;
            tmp.push({ id:bid, name, views:parseInt(c[1].innerText)||0, income:parseFloat(c[2].innerText)||0, likes:parseInt(c[7].innerText)||0, thanks:parseInt(c[8].innerText)||0, bm:parseInt(c[9].innerText)||0, rating:parseInt(c[10].innerText)||0 });
        });
        if(tmp.length){ parsedStatsData=tmp; localStorage.setItem(KEYS.STATS,JSON.stringify(parsedStatsData)); currentSort={col:'rating',asc:true}; renderStatsTable(); renderTops(); }
        document.getElementById('btn_sync_list').style.display='block';
    } catch(e){ console.error(e); alert('Ошибка обновления'); } finally { btn.disabled=false; l.style.display='none'; }
}

function renderStatsTable() {
    const tb=document.getElementById('stat_tbody'); tb.innerHTML='';
    if(!parsedStatsData.length){tb.innerHTML='<tr><td colspan="7">Нет данных</td></tr>';return;}
    parsedStatsData.sort((a,b)=>{ const vA=a[currentSort.col], vB=b[currentSort.col]; return (vA<vB? (currentSort.asc?-1:1) : (vA>vB? (currentSort.asc?1:-1) : 0)); });
    const ths = document.querySelectorAll('.r-stat-table th'); ths.forEach(t=>t.style.color='#ccc');
    const m = {'name':0,'rating':1,'income':2,'views':3,'thanks':4,'likes':5,'bm':6};
    if(ths[m[currentSort.col]]) { ths[m[currentSort.col]].style.color='#61dafb'; ths[m[currentSort.col]].innerText = ths[m[currentSort.col]].innerText.replace(/[▼▲]/g,'')+(currentSort.asc?' ▲':' ▼'); }
    parsedStatsData.forEach(d=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td style="text-align:left;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><a href="/book/${d.id}" target="_blank">${d.name}</a></td><td style="color:${d.rating>0?'#28a745':'#ccc'}">${d.rating}</td><td>${d.income}</td><td>${d.views}</td><td>${d.thanks}</td><td>${d.likes}</td><td>${d.bm}</td>`; tb.appendChild(tr); });
}

function syncStatsToBookList() {
    if(!parsedStatsData.length)return;
    let a=0,b=0; parsedStatsData.forEach(bk=>{ if(!bk.id)return; if(!savedBooks.some(x=>x.id==bk.id)){ if(!blockedBooks.some(x=>x.id==bk.id)){ savedBooks.push({id:bk.id,name:bk.name, originalUrl: ''}); a++; }else b++; } });
    if(a>0){localStorage.setItem(KEYS.BOOKS,JSON.stringify(savedBooks));renderBookList();updateSimSelect();renderAdBookList();updateRemSelect();alert(`Add: ${a}, Ign: ${b}`);} else alert('No new books');
}

document.getElementById('btn_clear_covers').onclick = () => {
    if(confirm('Удалить сохраненные ссылки на обложки? При следующей генерации скрипт скачает их заново.')) {
        coverCache = {};
        localStorage.removeItem(KEYS.COVER_CACHE);
        alert('Кэш очищен! Теперь при нажатии "Сгенерировать код" ссылки будут искаться заново.');
    }
};

function applyTheme() {
    const h=theme.color; let r=33,g=37,b=41; if(h.length===7){r=parseInt(h.slice(1,3),16);g=parseInt(h.slice(3,5),16);b=parseInt(h.slice(5,7),16);}
    const rgba=`rgba(${r},${g},${b},${theme.opacity})`; menuDiv.style.background=rgba;
    if(!simState.active && isSessionActive && !isLiked) mainDiv.style.backgroundColor=rgba;
}
function saveTheme(){localStorage.setItem(KEYS.THEME,JSON.stringify(theme));applyTheme();}
document.getElementById('rng_opacity').oninput=(e)=>{theme.opacity=e.target.value; document.getElementById('val_opacity').innerText = e.target.value; saveTheme();};
document.getElementById('inp_color').oninput=(e)=>{theme.color=e.target.value;saveTheme();};
document.getElementById('btn_reset_theme').onclick=()=>{theme={opacity:0.95,color:'#212529'};document.getElementById('rng_opacity').value=0.95; document.getElementById('val_opacity').innerText = '0.95'; document.getElementById('inp_color').value='#212529';saveTheme();};
document.getElementById('inp_mass_delay').onchange=(e)=>{actionDelay=parseInt(e.target.value)||1000;localStorage.setItem(KEYS.DELAY,actionDelay);};


// ==========================================
// ЛОГИКА НАПОМИНАНИЙ (REMINDERS)
// ==========================================
document.getElementById('inp_snooze_def').onchange = (e) => {
    reminderOpts.snoozeDefault = parseInt(e.target.value) || 10;
    localStorage.setItem(KEYS.REMINDER_OPTS, JSON.stringify(reminderOpts));
};

const chkCustomRem = document.getElementById('chk_custom_rem');
chkCustomRem.onchange = () => {
    const isCustom = chkCustomRem.checked;
    document.getElementById('rem_book_selector_div').style.display = isCustom ? 'none' : 'block';
    document.getElementById('rem_custom_text_div').style.display = isCustom ? 'block' : 'none';
};

function updateRemSelect(booksToShow = savedBooks) {
    const s = document.getElementById('rem_book_sel'); s.innerHTML = '';
    // Фильтруем завершенные
    const activeBooks = booksToShow.filter(b => b.status !== 'finished');

    if (!activeBooks.length) { s.innerHTML='<option value="">Нет активных книг</option>'; return; }
    activeBooks.forEach((b) => {
        // Находим реальный индекс в основном массиве
        const originalIndex = savedBooks.findIndex(sb => sb.id === b.id);
        const o = document.createElement('option');
        o.value = originalIndex;
        o.innerText = b.name;
        s.appendChild(o);
    });
}

document.getElementById('rem_book_search').onkeyup = (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = savedBooks.filter(b => b.name.toLowerCase().includes(term));
    updateRemSelect(filtered);
};

function renderMissingReminders() {
    const c = document.getElementById('missing_rem_list');
    c.innerHTML = '';

    // Фильтруем книги:
    // 1. Статус не 'finished'
    // 2. Нет активного напоминания (scheduled или pending)
    const activeBookIds = reminders.map(r => String(r.bookId)); // ID книг с напоминаниями

    const missing = savedBooks.filter(b => {
        if (b.status === 'finished') return false; // Игнорируем завершенные
        return !activeBookIds.includes(String(b.id));
    });

    if (missing.length === 0) {
        c.innerHTML = '<div style="text-align:center; color:#777; margin-top:20px;">Все активные книги имеют напоминания! 🎉</div>';
        return;
    }

    missing.forEach(b => {
        const d = document.createElement('div');
        d.className = 'r-missing-card';
        d.innerHTML = `
            <div style="color:#fff; font-weight:bold;">${b.name}</div>
            <div class="r-missing-actions">
                <input type="datetime-local" class="r-input quick-date-inp" style="padding:2px; font-size:10px; height:22px;">
                <button class="r-btn btn-quick-add" data-id="${b.id}" style="width:auto; margin:0; padding:2px 8px; font-size:11px; background:#28a745;">OK</button>
            </div>
        `;

        // Предзаполняем дату: завтра в это же время
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
        // Форматируем для input datetime-local (YYYY-MM-DDTHH:MM)
        const pad = (n) => n < 10 ? '0'+n : n;
        const dateStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
        d.querySelector('.quick-date-inp').value = dateStr;

        c.appendChild(d);
    });
}


function renderReminders() {
    const schedContainer = document.getElementById('rem_list_scheduled');
    const waitContainer = document.getElementById('rem_list_waiting');
    schedContainer.innerHTML = ''; waitContainer.innerHTML = '';

    const scheduled = reminders.filter(r => r.status === 'scheduled').sort((a,b) => new Date(a.time) - new Date(b.time));
    const waiting = reminders.filter(r => r.status === 'pending');

    // Render Waiting
    if (waiting.length) {
        waitContainer.innerHTML = '<div class="r-rem-header">⚠️ Ожидают выполнения</div>';
        waiting.forEach((r) => {
             const d = document.createElement('div'); d.className = 'r-rem-card wait';
             const realIdx = reminders.findIndex(x => x.id === r.id);
             let contentHtml;

             if (r.customText) {
                 contentHtml = `
                    <div style="display: flex; align-items: center;">
                        <span style="margin-right: 5px;">📌</span>
                        <span class="r-rem-name" style="color: #fff;" title="${r.customText}">${r.customText}</span>
                    </div>
                 `;
             } else {
                 const book = savedBooks.find(b => b.id == r.bookId);
                 const origLinkHtml = (book && book.originalUrl) ? `<a href="${book.originalUrl}" target="_blank" title="Оригинал" class="r-act-btn" style="color: #61dafb;">🔗</a>` : '';
                 contentHtml = `
                    <div style="display: flex; align-items: center;">
                        <a href="/book/${r.bookId}" target="_blank" class="r-rem-name" title="${r.bookName}">${r.bookName}</a>
                        ${origLinkHtml}
                    </div>
                 `;
             }

             d.innerHTML = `
                 <div style="flex:1; overflow:hidden; display:flex; flex-direction:column;">
                    ${contentHtml}
                    <div style="font-size:10px; color:#aaa;">Сработало: ${new Date(r.time).toLocaleTimeString()}</div>
                 </div>
                 <div class="r-rem-act">
                    <span class="r-act-btn" style="color: #17a2b8;" data-action="rem_snooze_pending" data-index="${realIdx}" title="Отложить на 24ч">➡️</span>
                    <span class="r-act-btn r-act-restore" data-action="rem_finish" data-index="${realIdx}" title="Выполнено">✅</span>
                 </div>
             `;
             waitContainer.appendChild(d);
        });
    }

    // Render Scheduled with Date Headers
    if (scheduled.length) {
        let lastDate = '';
        const today = new Date().toDateString();
        const tomorrow = new Date(Date.now() + 86400000).toDateString();

        scheduled.forEach((r) => {
            const dObj = new Date(r.time);
            const dStr = dObj.toDateString();

            if (dStr !== lastDate) {
                let headerText = dObj.toLocaleDateString();
                if (dStr === today) headerText = '📅 Сегодня';
                else if (dStr === tomorrow) headerText = '📆 Завтра';

                const h = document.createElement('div');
                h.className = 'r-rem-header';
                h.style.marginTop = '10px';
                h.innerText = headerText;
                schedContainer.appendChild(h);
                lastDate = dStr;
            }

            const realIdx = reminders.findIndex(x => x.id === r.id);
            let contentHtml;

            if (r.customText) {
                contentHtml = `
                    <span style="margin-right: 5px;">📌</span>
                    <span class="r-rem-name" style="color:#fff;" title="${r.customText}">${r.customText}</span>
                `;
            } else {
                 const book = savedBooks.find(b => b.id == r.bookId);
                 const origLinkHtml = (book && book.originalUrl) ? `<a href="${book.originalUrl}" target="_blank" title="Оригинал" class="r-act-btn" style="color: #61dafb;">🔗</a>` : '';
                 contentHtml = `
                    <a href="/book/${r.bookId}" target="_blank" class="r-rem-name" title="${r.bookName}">${r.bookName}</a>
                    ${origLinkHtml}
                 `;
            }

            const div = document.createElement('div');
            div.className = 'r-rem-card';
            div.innerHTML = `
                <div class="r-rem-time">${dObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                <div style="flex:1; overflow:hidden; display:flex; align-items:center;">
                    ${contentHtml}
                </div>
                <span class="r-act-btn r-act-del" data-action="rem_del" data-index="${realIdx}" title="Удалить">✖</span>
            `;
            schedContainer.appendChild(div);
        });
    } else if (!waiting.length) {
        schedContainer.innerHTML = '<div style="text-align:center; color:#777; font-size:12px; margin-top:20px;">Нет напоминаний</div>';
    }
}
document.getElementById('btn_add_rem').onclick = () => {
    const isCustom = document.getElementById('chk_custom_rem').checked;
    const dateVal = document.getElementById('rem_date_inp').value;
    if (!dateVal) return alert('Выберите дату и время');

    const time = new Date(dateVal).getTime();
    if (time < Date.now()) return alert('Время должно быть в будущем');

    let newReminder = {
        id: Date.now() + Math.random(),
        time: new Date(dateVal).toISOString(),
        status: 'scheduled'
    };

    if (isCustom) {
        const customText = document.getElementById('rem_custom_text_inp').value.trim();
        if (!customText) return alert('Введите текст напоминания');
        newReminder.customText = customText;
    } else {
        const sel = document.getElementById('rem_book_sel');
        if (sel.value === "" || sel.value === null) return alert('Книга не выбрана или список пуст');
        const bookIdx = parseInt(sel.value);
        const book = savedBooks[bookIdx];
        if (!book) return alert('Ошибка: не удалось найти книгу.');
        newReminder.bookId = book.id;
        newReminder.bookName = book.name;
    }

    reminders.push(newReminder);
    localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
    renderReminders();
    document.getElementById('rem_date_inp').value = '';
    document.getElementById('rem_custom_text_inp').value = '';
};
function showNotification(rem) {
    notifDiv.style.display = 'block';
    const bodyText = rem.customText
        ? `<b>${rem.customText}</b>`
        : `Пора проверить: <br><b>${rem.bookName}</b>`;

    notifDiv.innerHTML = `
        <div class="r-notif-title">🔔 Напоминание!</div>
        <div class="r-notif-body">${bodyText}</div>
        <div class="r-notif-actions">
             <button id="btn_notif_snooze" class="r-btn" style="margin:0; background:#17a2b8; font-size:11px;">💤 +${reminderOpts.snoozeDefault} мин</button>
             <button id="btn_notif_accept" class="r-btn" style="margin:0; background:#28a745; font-size:11px;">👌 Принять</button>
        </div>
    `;

    document.getElementById('btn_notif_snooze').onclick = () => {
        rem.time = new Date(Date.now() + reminderOpts.snoozeDefault * 60000).toISOString();
        localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
        notifDiv.style.display = 'none';
        renderReminders();
    };

    document.getElementById('btn_notif_accept').onclick = () => {
        rem.status = 'pending';
        localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));
        notifDiv.style.display = 'none';
        renderReminders();
        switchTab('tab8');
        if (!isMenuOpen) { isMenuOpen = true; menuDiv.style.display='block'; }
    };
}
// Background Reminder Checker
setInterval(() => {
    const now = Date.now();
    reminders.forEach(r => {
        if (r.status === 'scheduled' && new Date(r.time).getTime() <= now) {
          if (notifDiv.style.display !== 'block') {
               showNotification(r);
          }
        }
    });
}, 5000); // Check every 5 seconds



  // Открытие боковой панели
document.getElementById('btn_toggle_missing').onclick = () => {
    const drawer = document.getElementById('missing_rem_drawer');
    const isActive = drawer.classList.contains('open');
    if (!isActive) {
        renderMissingReminders();
        drawer.classList.add('open');
    } else {
        drawer.classList.remove('open');
    }
};

document.getElementById('btn_close_drawer').onclick = () => {
    document.getElementById('missing_rem_drawer').classList.remove('open');
};

// Делегирование событий для кнопок внутри боковой панели (так как они динамические)
document.getElementById('missing_rem_list').addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-quick-add')) {
        const btn = e.target;
        const bookId = btn.dataset.id;
        const dateInput = btn.previousElementSibling; // input рядом с кнопкой

        const dateVal = dateInput.value;
        if (!dateVal) return alert('Укажите время');
        const time = new Date(dateVal).getTime();
        if (time < Date.now()) return alert('Время в прошлом!');

        const book = savedBooks.find(b => String(b.id) === String(bookId));
        if (!book) return;

        reminders.push({
            id: Date.now() + Math.random(),
            time: new Date(dateVal).toISOString(),
            status: 'scheduled',
            bookId: book.id,
            bookName: book.name
        });
        localStorage.setItem(KEYS.REMINDERS, JSON.stringify(reminders));

        // Обновляем оба списка
        renderReminders();
        renderMissingReminders();
    }
});

// ==========================================
// ЛОГИКА НАВИГАЦИИ И ЛАЙКОВ
// ==========================================

const saveComplexOpts = () => {
    if(!currentBookId) return;
    localStorage.setItem(KEYS.COMPLEX_OPTS_PREFIX + currentBookId, JSON.stringify(complexOpts));
};

document.getElementById('chk_complex_enable').onchange = (e) => { complexOpts.enabled = e.target.checked; saveComplexOpts(); };
document.getElementById('chk_complex_cyclic').onchange = (e) => { complexOpts.cyclic = e.target.checked; saveComplexOpts(); };
document.getElementById('chk_complex_no_back').onchange = (e) => { complexOpts.noBack = e.target.checked; saveComplexOpts(); };
document.getElementById('inp_steps_next').onchange = (e) => { complexOpts.stepsNext = parseInt(e.target.value) || 10; saveComplexOpts(); };
document.getElementById('inp_steps_prev').onchange = (e) => { complexOpts.stepsPrev = parseInt(e.target.value) || 10; saveComplexOpts(); };

if (currentBookId) {
    document.getElementById('complex_settings_container').style.display = 'block';
    document.getElementById('complex_no_book').style.display = 'none';
} else {
    document.getElementById('complex_settings_container').style.display = 'none';
    document.getElementById('complex_no_book').style.display = 'block';
}

document.getElementById('btn_reset_complex').onclick = () => {
    if (!currentBookId) return;
    complexState = { dir: 'next', count: 0 };
    sessionStorage.setItem(SESS_KEYS.COMPLEX_STATE_PREFIX + currentBookId, JSON.stringify(complexState));
    updateVisuals();
    document.getElementById('complex_status_menu').innerText = 'Сброшено! (Дальше: 0)';
};

function findNextUrl() {
    const li = document.querySelector('li.next a'); if(li&&li.href) return li.href;
    const btns = document.querySelectorAll('a.btn, a.btn-brd');
    for(let b of btns){ const t=(b.innerText||'').toLowerCase(); if((t.includes('дальше')||t.includes('next')||t.includes('→')) && !t.includes('назад')) return b.href; }
    return null;
}
function findPrevUrl() {
    const li = document.querySelector('li.prev a'); if(li&&li.href) return li.href;
    const btns = document.querySelectorAll('a.btn, a.btn-brd');
    for(let b of btns){ const t=(b.innerText||'').toLowerCase(); if(t.includes('назад') || t.includes('prev') || t.includes('←')) return b.href; }
    return null;
}

function updateVisuals() {
    if(simState.active){
        mainDiv.style.backgroundColor='#6f42c1';
        document.getElementById('status_text').innerText=`🤖 Бот: ${secondsLeft}s`;
        document.getElementById('btn_toggle').innerHTML='⏹';
        return;
    }
    const t=document.getElementById('status_text'), b=document.getElementById('btn_toggle');
    if(!isSessionActive){
        mainDiv.style.backgroundColor='#6c757d';
        t.innerText='🛑 ПАУЗА';
        b.innerHTML='▶';
    } else {
        b.innerHTML='⏸';
        if(isLiked){
            mainDiv.style.backgroundColor='#28a745';
            t.innerText=`👍 Лайк! ${secondsLeft}`;
        } else {
            applyTheme();
            if (complexOpts.enabled) {
                t.innerText = `${complexState.dir === 'next' ? '➡️' : '⬅️'} ${complexState.count} | ${secondsLeft}s`;
                if (isMenuOpen) {
                    document.getElementById('complex_status_menu').innerText = `Сейчас: ${complexState.dir==='next'?'Вперед':'Назад'} (${complexState.count})`;
                }
            } else {
                t.innerText=`⏳ Таймер: ${secondsLeft}`;
            }
        }
    }
}

const likeInt = setInterval(() => {
    if (isLiked) return;
    if (isAutoLikeChapterActive) {
        const chapterBtn = document.querySelector('.like_btn') || document.querySelector('a[onclick^="like("]');
        if (chapterBtn) { if (chapterBtn.classList.contains('disabled')) { isLiked = true; updateVisuals(); } else { chapterBtn.click(); isLiked = true; updateVisuals(); } return; }
    }
    if (isAutoLikeBookActive) {
        const cancelBtn = document.querySelector('.unlike-btn') || document.querySelector('a[href*="cancel_like"]');
        if (cancelBtn && cancelBtn.style.display !== 'none') { isLiked = true; updateVisuals(); return; }
        const bookBtn = document.querySelector('.like-btn') || document.querySelector('[data-role="like"]');
        if (bookBtn) { if (bookBtn.classList.contains('disabled')) { isLiked = true; updateVisuals(); } else { bookBtn.click(); isLiked = true; updateVisuals(); } return; }
    }
}, 500);

// Логика "Обычной симуляции" (в рамках одной вкладки)
function runNavigationLogic() {
    if (isSessionActive && complexOpts.enabled && currentBookId) {
        // Увеличиваем счетчик при загрузке страницы, так как переход состоялся
        complexState.count++;
        sessionStorage.setItem(SESS_KEYS.COMPLEX_STATE_PREFIX + currentBookId, JSON.stringify(complexState));
    }

    const ti = setInterval(()=>{
        if(simState.active) { clearInterval(ti); return; }

        if(!isSessionActive){ updateVisuals(); return; }

        secondsLeft--;
        updateVisuals();

        if(secondsLeft<=0){
            let targetUrl = null;

            if (complexOpts.enabled && currentBookId) {
                // СЛОЖНЫЙ РЕЖИМ
                if (complexState.dir === 'next') {
                    if (complexState.count >= complexOpts.stepsNext) {
                        if (complexOpts.noBack) {
                             if (complexOpts.cyclic) {
                                complexState.count = 0;
                                targetUrl = findNextUrl();
                             } else {
                                isSessionActive = false;
                                sessionStorage.setItem(SESS_KEYS.AUTO_NEXT_ACTIVE, 'false');
                                updateVisuals();
                                clearInterval(ti);
                                alert("Цикл (только вперед) завершен.");
                                return;
                             }
                        } else {
                            complexState.dir = 'prev';
                            complexState.count = 0;
                            targetUrl = findPrevUrl();
                        }
                        sessionStorage.setItem(SESS_KEYS.COMPLEX_STATE_PREFIX + currentBookId, JSON.stringify(complexState));
                    } else {
                        targetUrl = findNextUrl();
                    }
                } else { // dir === 'prev'
                    if (complexState.count >= complexOpts.stepsPrev) {
                        if (complexOpts.cyclic) {
                            complexState.dir = 'next';
                            complexState.count = 0;
                            sessionStorage.setItem(SESS_KEYS.COMPLEX_STATE_PREFIX + currentBookId, JSON.stringify(complexState));
                            targetUrl = findNextUrl();
                        } else {
                            isSessionActive = false;
                            sessionStorage.setItem(SESS_KEYS.AUTO_NEXT_ACTIVE, 'false');
                            updateVisuals();
                            clearInterval(ti);
                            alert("Цикл завершен.");
                            return;
                        }
                    } else {
                        targetUrl = findPrevUrl();
                    }
                }
            } else {
                // ОБЫЧНЫЙ РЕЖИМ (только вперед)
                targetUrl = findNextUrl();
            }

            if(targetUrl){
                clearInterval(ti);
                document.getElementById('status_text').innerText='🚀 ...';
                window.location.assign(targetUrl);
            } else {
                clearInterval(ti);
                document.getElementById('status_text').innerText='❌ НЕТ';
                mainDiv.style.backgroundColor='#dc3545';
            }
        }
    },1000);
}

function updateSimSelect() { const s=document.getElementById('sim_start_select'); s.innerHTML=''; savedBooks.forEach((b,i)=>{const o=document.createElement('option');o.value=i;o.innerText=`${i+1}. ${b.name}`;s.appendChild(o);}); }

function processNextSimBook() {
    if (currentBookId) { localStorage.removeItem(SIM_KEY_PREFIX + currentBookId); }
    if(!simState.queue.length){
        simState.active=false;
        if (currentBookId) localStorage.removeItem(SIM_KEY_PREFIX + currentBookId);
        alert(`Done!\nBooks: ${simState.stats.booksProcessed}\nCh: ${simState.stats.chaptersRead}`);
        location.reload();
        return;
    }
    const b=simState.queue.shift();
    simState.currentBookId=b.id;
    simState.currentBookName=b.name;
    localStorage.setItem(SIM_KEY_PREFIX + b.id, JSON.stringify(simState));
    window.location.assign(`/book/${b.id}`);
}

function checkSimStatus() {
    if(!simState.active) return false;
    document.getElementById('btn_stop_sim').style.display='block';
    document.getElementById('sim_status').innerText=`${simState.currentBookName} | Ch: ${simState.stats.chaptersRead}`;
    updateVisuals();

    const p=location.pathname;
    if(p===`/book/${simState.currentBookId}` || p===`/book/${simState.currentBookId}/`) {
        document.getElementById('status_text').innerText='🤖 Вход...';
        setTimeout(()=>{
            const allA = document.querySelectorAll('a.btn, a.btn-success, a.btn-primary');
            let start = null;
            for(let b of allA) { const txt = (b.innerText || '').toLowerCase(); if(txt.includes('читать') || txt.includes('read') || txt.includes('начать') || txt.includes('start')) { if(b.href && !b.href.includes('#')) { start=b.href; break; } } }
            if(!start) { for(let b of allA){ if(b.href && b.href.includes('ready_new') && (b.classList.contains('btn-info')||b.classList.contains('btn-success'))){start=b.href;break;} } }
            if(!start){const tl=document.querySelectorAll('table.table tbody tr td a'); if(tl.length>0)start=tl[0].href;}
            if(start) window.location.assign(start);
            else { simState.stats.booksProcessed++; processNextSimBook(); }
        },2000);
        return true;
    }
    if(document.querySelector('.read_nav')||document.querySelector('.content-text')){
        const ti = setInterval(()=>{
           secondsLeft--;
           updateVisuals();
           if(secondsLeft<=0){
               const n = findNextUrl();
               if(n){
                   simState.stats.chaptersRead++;
                   localStorage.setItem(SIM_KEY_PREFIX + currentBookId, JSON.stringify(simState));
                   clearInterval(ti);
                   window.location.assign(n);
               } else {
                   clearInterval(ti);
                   document.getElementById('status_text').innerText='🤖 Конец';
                   simState.stats.booksProcessed++;
                   processNextSimBook();
               }
           }
        }, 1000);
        return true;
    }
    processNextSimBook();
    return true;
}

document.getElementById('btn_toggle').onclick = (e) => {
    e.stopPropagation();

    if (simState.active) {
        simState.active = false;
        if (currentBookId) localStorage.setItem(SIM_KEY_PREFIX + currentBookId, JSON.stringify(simState));
        location.reload();
        return;
    }

    isSessionActive = !isSessionActive;
    sessionStorage.setItem(SESS_KEYS.AUTO_NEXT_ACTIVE, JSON.stringify(isSessionActive));
    updateVisuals();
};

function switchTab(id){
    ['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8'].forEach(t=>{document.getElementById(t).classList.remove('active');});
    ['content1','content2','content3','content4','content5','content6','content7','content8'].forEach(c=>{document.getElementById(c).classList.remove('active');});
    const at=document.getElementById(id); at.classList.add('active'); document.getElementById('content'+id.replace('tab','')).classList.add('active');
    if(id==='tab6') renderTops();
}
['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8'].forEach(t=>document.getElementById(t).onclick=()=>switchTab(t));
document.getElementById('btn_settings').onclick=(e)=>{e.stopPropagation();isMenuOpen=!isMenuOpen;menuDiv.style.display=isMenuOpen?'block':'none';if(isMenuOpen){renderBookList();renderBlockList();updateSimSelect();renderStatsTable();renderTops();renderAdBookList();renderPresets();updateRemSelect();renderReminders();}};
document.getElementById('inp_timer').onchange=(e)=>{waitSeconds=parseInt(e.target.value)||5;localStorage.setItem(KEYS.TIMER,waitSeconds);secondsLeft=waitSeconds;updateVisuals();};

document.getElementById('chk_autolike_book').onchange=(e)=>{isAutoLikeBookActive=e.target.checked;localStorage.setItem(KEYS.AUTO_LIKE_BOOK,JSON.stringify(isAutoLikeBookActive));};
document.getElementById('chk_autolike_chapter').onchange=(e)=>{isAutoLikeChapterActive=e.target.checked;localStorage.setItem(KEYS.AUTO_LIKE_CHAPTER,JSON.stringify(isAutoLikeChapterActive));};

document.getElementById('btn_fetch_stats').onclick=fetchAndParseStats; document.getElementById('btn_sync_list').onclick=syncStatsToBookList;
document.getElementById('btn_add').onclick=()=>{const id=document.getElementById('inp_id').value, n=document.getElementById('inp_name').value||`Book #${id}`; if(id){savedBooks.push({id,name:n, originalUrl: ''});localStorage.setItem(KEYS.BOOKS,JSON.stringify(savedBooks));renderBookList();updateSimSelect();renderAdBookList();updateRemSelect();}};
document.getElementById('btn_add_curr').onclick=()=>{const p=location.pathname.split('/'); if(p[1]=='book'&&p[2]){let t=`Book #${p[2]}`;const h=document.querySelector('h1');if(h){const c=h.cloneNode(true);if(c.querySelector('small'))c.querySelector('small').remove();t=c.innerText.trim();}savedBooks.push({id:p[2],name:t, originalUrl: ''});localStorage.setItem(KEYS.BOOKS,JSON.stringify(savedBooks));renderBookList();updateSimSelect();renderAdBookList();updateRemSelect();}};

document.getElementById('btn_start_sim').onclick=()=>{
    if(!savedBooks.length)return alert('Пусто');
    if(!confirm('Старт?'))return;
    const idx=parseInt(document.getElementById('sim_start_select').value);
    const q=savedBooks.slice(idx);
    simState={active:true, queue:JSON.parse(JSON.stringify(q)), stats:{booksProcessed:0, chaptersRead:0}};
    processNextSimBook();
};

document.getElementById('btn_stop_sim').onclick=()=>{
    simState.active=false;
    if (currentBookId) localStorage.setItem(SIM_KEY_PREFIX + currentBookId, JSON.stringify(simState));
    location.reload();
};
const delay=ms=>new Promise(r=>setTimeout(r,ms));

async function doMass(act) {
    const els=document.querySelectorAll('.book-sel:checked'); if(!els.length)return; if(!confirm(`Go ${els.length}?`))return;
    const o=document.createElement('div'); o.className='r-process-overlay'; o.innerHTML=`<div class="r-pulse-icon">🔖</div><div id="r-proc-text" style="font-size:18px;">0/${els.length}</div><div class="r-progress-bar-bg"><div id="r-proc-fill" class="r-progress-bar-fill"></div></div>`; document.body.appendChild(o);
    let c=0; for(let el of els){
        try { await fetch(`/book/${el.dataset.id}/${act}`); } catch(e){}
        c++; document.getElementById('r-proc-fill').style.width=(c/els.length)*100+'%'; document.getElementById('r-proc-text').innerText=`${c}/${els.length}`; await delay(actionDelay);
    }
    o.innerHTML='<div style="font-size:30px;">✅</div>'; setTimeout(()=>o.remove(),1000); updateVisuals();
}
document.getElementById('btn_mass_bm').onclick=()=>doMass('bm');
document.getElementById('btn_mass_unread').onclick=()=>doMass('remove_last_readed');
document.getElementById('btn_sel_all').onclick=()=>{document.querySelectorAll('.book-sel').forEach(e=>{e.checked=true;toggleCheck(e.dataset.id,true);});};
document.getElementById('btn_desel_all').onclick=()=>{document.querySelectorAll('.book-sel').forEach(e=>{e.checked=false;toggleCheck(e.dataset.id,false);});};

// ==========================================
// 5. ГЕНЕРАТОР РЕКЛАМЫ (PRO)
// ==========================================
async function getBookCover(bookId) {
    if (coverCache[bookId] && coverCache[bookId].cover) return coverCache[bookId].cover;
    try {
        const response = await fetch(`/book/${bookId}`);
        if (!response.ok) throw new Error('Network error');
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const img = doc.querySelector('.slick img') || doc.querySelector('.images img');
        let src = '';
        if (img) {
            src = img.getAttribute('src');
            if (src && !src.startsWith('http')) { src = 'https://tl.rulate.ru' + src; }
        }
        const data = { cover: src };
        coverCache[bookId] = data;
        localStorage.setItem(KEYS.COVER_CACHE, JSON.stringify(coverCache));
        return src;
    } catch (e) { console.error("Error fetching cover for", bookId, e); }
    return '';
}

document.getElementById('btn_gen_ad').onclick = async () => {
    const selected = Array.from(document.querySelectorAll('.ad-sel:checked'));
    if (selected.length === 0) return alert('Выберите хотя бы одну книгу!');
    const o = document.createElement('div');
    o.className='r-process-overlay';
    o.innerHTML=`<div class="r-pulse-icon">✨</div><div id="r-ad-text" style="font-size:18px;">Сканируем обложки... 0/${selected.length}</div>`;
    document.body.appendChild(o);

    const booksData = [];
    const pad = adSettings.borderWidth;
    const rad = adSettings.borderRadius;
    const c1 = adSettings.borderColor1;
    const c2 = adSettings.borderColor2;

    for (let i = 0; i < selected.length; i++) {
        const el = selected[i];
        const id = el.dataset.id;
        const name = el.dataset.name;
        const link = `https://tl.rulate.ru/book/${id}`;
        const cover = await getBookCover(id);
        booksData.push({ id, name, link, cover });
        document.getElementById('r-ad-text').innerText = `Сканируем обложки... ${i+1}/${selected.length}`;
        if (!coverCache[id]) await delay(400);
    }

    let row1 = ''; let row2 = '';
    booksData.forEach(b => {
        const wrapperStyle = `padding: ${pad}px; background: linear-gradient(135deg, ${c1}, ${c2}); border-radius: ${rad}px; display: inline-block; position: relative; line-height: 0;`;
        const imgStyle = `display: block; width: 100px; height: 146px; border-radius: ${Math.max(0, rad - 1)}px;`;
        row1 += `<td style="padding: 5px; padding-bottom: 0; text-align: center;"><div style="${wrapperStyle}"><a href="${b.link}"><img src="${b.cover}" style="${imgStyle}"></a></div></td>`;
        row2 += `<td style="width: 110px; padding: 5px; vertical-align: top; text-align: center;"><a href="${b.link}" style="font-size: 11px; font-weight: bold; color: #005580; text-decoration: underline;">${b.name}</a></td>`;
    });

    const html = `<hr><div style="max-width: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 10px;"><table style="border-spacing: 0; table-layout: fixed;"><tbody><tr>${row1}</tr><tr>${row2}</tr></tbody></table></div>`;
    document.getElementById('ad_output').value = html;
    if(document.getElementById('btn_view_prev').classList.contains('active')) { document.getElementById('ad_preview').innerHTML = html; }
    o.remove();
};

applyTheme();
if(!checkSimStatus()){ updateVisuals(); runNavigationLogic(); }

})();