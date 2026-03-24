// ==UserScript==
// @name         Book Downloader Pro v8.3
// @namespace    http://tampermonkey.net/
// @version      8.3
// @description  Загрузчик книг. Без лимитов памяти (IndexedDB). Настоящая общая библиотека для всех сайтов. Поддержка: yeduge.com, nnttrr.com, 69shuba.com, 101kks.com, rulate, freewebnovel и др.
// @author       You
// @match        *://freewebnovel.com/*
// @match        *://tl.rulate.ru/*
// @match        *://.syosetu.com/*
// @match        *://novel18.syosetu.com/*
// @match        *://www.69shuba.com/*
// @match        *://101kks.com/*
// @match        *://nnttrr.com/*
// @match        *://www.nnttrr.com/*
// @match        *://yeduge.com/*
// @match        *://www.yeduge.com/*
// @match        *://www.qushucheng.com/*
// @match        *://www.jwxs.org/*
// @match        *://read-novel.com/*
// @match        *://www.drxsw.com/*
// @match        *://www.shuhaixsw.com/*
// @match        *://quanben5.com/*
// @match        *://www.quanben5.com/*
// @match        *://www.kelexs.com/*
// @match        *://sudugu.org/*
// @match        *://www.sudugu.org/*
// @match        *://pinellianovel.com/*
// @match        *://www.pinellianovel.com/*
// @require      https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

// --- ОБЕРТКА INDEXEDDB (ДЛЯ ГЛАВ) ---
// Это хранилище ЛОКАЛЬНОЕ для каждого сайта. Здесь лежат тяжелые данные.
const db = {
    get: async (key, defaultValue) => {
        const val = await idbKeyval.get(key);
        return val === undefined ? defaultValue : val;
    },
    set: async (key, value) => {
        await idbKeyval.set(key, value);
    },
    del: async (key) => {
        await idbKeyval.del(key);
    },
    list: async () => {
        return await idbKeyval.keys();
    }
};

// --- КОНФИГУРАЦИЯ И СЕЛЕКТОРЫ ---
const HOST = window.location.hostname;
const path = window.location.pathname;
let SELECTORS = {};
if (HOST.includes('freewebnovel.com')) {
SELECTORS = { chapterTitle: 'span.chapter', chapterContent: 'div#article', nextChapterLink: 'a#next_url' };
} else if (HOST.includes('rulate.ru')) { SELECTORS = { chapterTitle: 'h1', chapterContent: '.content-text', nextChapterLink: '.next_page, #next_page, a:contains("Вперёд"), a:contains("Next")' }; } else if (HOST.includes('syosetu.com')) { SELECTORS = { chapterTitle: 'h1.p-novel__title', chapterContent: '.p-novel__body', nextChapterLink: 'a.c-pager__item--next' }; } else if (HOST.includes('69shuba.com')) { SELECTORS = { chapterTitle: 'h1', chapterContent: '.txtnav', nextChapterLink: '.page1 > a:last-child' }; } else if (HOST.includes('101kks.com')) { SELECTORS = { chapterTitle: 'h1', chapterContent: '#txtcontent', nextChapterLink: '.page1 > a:last-child' }; } else if (HOST.includes('nnttrr.com')) { SELECTORS = { chapterTitle: 'h1.title', chapterContent: '.chapter .content', nextChapterLink: '.chapter-page a:last-child' }; } else if (HOST.includes('yeduge.com')) { SELECTORS = { chapterTitle: 'h1.title', chapterContent: '.chapter .content', nextChapterLink: '.chapter-page a:last-child' }; } else if (HOST.includes('read-novel.com')) { SELECTORS = { chapterTitle: 'a.chapter-title', chapterContent: '.chapter-content', nextChapterLink: 'a#next_chap' }; }
  else if (HOST.includes('drxsw.com')) {
    SELECTORS = { chapterTitle: 'h1', chapterContent: '#TextContent', nextChapterLink: '#nextChapterTop' };
  } else if (HOST.includes('qushucheng.com')) {
    SELECTORS = { chapterTitle: 'h1.title', chapterContent: '#content', nextChapterLink: 'a#next_url' };
  }  else if (HOST.includes('jwxs.org')) {
    SELECTORS = { chapterTitle: 'h1.bookname', chapterContent: 'div#booktxt', nextChapterLink: 'a#next_url' };
  } else if (HOST.includes('shuhaixsw.com')) {
    SELECTORS = {
     chapterTitle: 'h1.title',
        chapterContent: '.content',
        nextChapterLink: '.btnW > a:last-child'
    };
  } else if (HOST.includes('kelexs.com')) {
    SELECTORS = {
        chapterTitle: 'h1.title',
        chapterContent: '.content',
        nextChapterLink: '.btnW > a:last-child'
    };
  } else if (HOST.includes('novel18.syosetu.com')) {
    SELECTORS = {
        chapterTitle: 'h1.p-novel__title',
        chapterContent: '.p-novel__body',
        nextChapterLink: 'a.c-pager__item--next'
    };
  } else if (HOST.includes('quanben5.com')) {
    SELECTORS = {
        chapterTitle: '.title1',
        chapterContent: '#content',
        nextChapterLink: '#page_next a'
    };
  } else if (HOST.includes('quanben5.com')) {
    SELECTORS = {
        chapterTitle: '.title1',
        chapterContent: '#content',
        nextChapterLink: '#page_next a'
    };
  } else if (HOST.includes('sudugu.org')) {
    SELECTORS = {
        chapterTitle: '.submenu h1',
        chapterContent: '.con',
        nextChapterLink: '.prenext span:last-child a'
    };
  } else if (HOST.includes('pinellianovel.com')) {
    SELECTORS = {
        chapterTitle: 'h1.reader-header__title',
        chapterContent: 'article#article',
        nextChapterLink: 'a#next_url'
    };
  } else {
    SELECTORS = { chapterTitle: 'h1', chapterContent: 'article, .chapter-content, .text', nextChapterLink: 'a.next, a.next-chapter' };
  }
// --- ГЛОБАЛЬНОЕ СОСТОЯНИЕ ---
let state = { isScraping: false, isPaused: false, currentBookId: null };
let currentBookInfo = null;
let SESSION_KEY = null;
let libraryState = { tab: 'active', search: '', sort: 'date_desc', selectedSources: [] };
let packSettings = {
    charLimit: 100000,
    splitEnabled: false,
    splitMaxChars: 20000,
    splitMinChars: 6000,
    splitUseSeparators: true,
    splitSeparators: '...,---,***'
};
// Отчет о делении глав (сессионный)
let splitReportLog = [];
const fabBottom = HOST.includes('rulate.ru') ? '150px' : '20px';


// --- [ИСПРАВЛЕНО] Управление ОБЩИМ кэшем через GM_storage ---
// Это хранилище ОБЩЕЕ для всех сайтов. Здесь лежит мета-информация.
const CACHE_KEY = 'bdp_shared_library_cache';
async function getLibraryCache() {
    const jsonString = await GM_getValue(CACHE_KEY, '{}');
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("BDP: Ошибка парсинга кэша библиотеки. Сбрасываю.", e);
        return {};
    }
}
async function setLibraryCache(cache) {
    await GM_setValue(CACHE_KEY, JSON.stringify(cache));
}
async function updateLibraryCache(bookData) {
    const cache = await getLibraryCache();
    const existingEntry = cache[bookData.id] || {};
    cache[bookData.id] = {
        title: bookData.title,
        url: bookData.url,
        chapterCount: bookData.chapters.length,
        updated: bookData.updated || Date.now(),
        isFinished: !!bookData.isFinished,
        isBookmarked: existingEntry.isBookmarked || false
    };
    await setLibraryCache(cache);
}
async function removeFromLibraryCache(bookId) {
    const cache = await getLibraryCache();
    delete cache[bookId];
    await setLibraryCache(cache);
}

// --- СТИЛИ (UI) ---
GM_addStyle(`
    #bdp-app { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #333; }
    @keyframes bdp-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes bdp-pop-in { from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
    @keyframes bdp-pulse-green { 0% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(40, 167, 69, 0); } 100% { box-shadow: 0 0 0 0 rgba(40, 167, 69, 0); } }
    #bdp-panel { position: fixed; bottom: 90px; right: 20px; z-index: 9999; background-color: #fff; border: 1px solid #ccc; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); width: 420px; max-width: 95vw; overflow: hidden; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s; transform: translateY(20px) scale(0.95); opacity: 0; pointer-events: none; }
    #bdp-panel.visible { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }
    #bdp-header { background: linear-gradient(to right, #f8f9fa, #e9ecef); padding: 12px 15px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; cursor: move; user-select: none; }
    #bdp-header h2 { margin: 0; font-size: 16px; color: #333; font-weight: 700; }
    #bdp-close-btn { background: none; border: none; font-size: 22px; cursor: pointer; color: #777; line-height: 1; transition: color 0.2s; }
    #bdp-close-btn:hover { color: #dc3545; }
    #bdp-body { padding: 15px; max-height: 500px; overflow-y: auto; }
    .bdp-section { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px; animation: bdp-fade-in 0.3s ease-out; }
    .bdp-section-title { font-weight: 600; font-size: 14px; color: #555; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .bdp-control-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .bdp-input { padding: 6px 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; transition: border 0.2s; }
    .bdp-input:focus { border-color: #007bff; outline: none; }
    .bdp-input-full { width: 100%; box-sizing: border-box; margin-bottom: 8px; }
    .bdp-btn { padding: 8px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; color: white; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .bdp-btn:active { transform: translateY(1px); box-shadow: none; }
    .bdp-btn-start { background: linear-gradient(135deg, #28a745, #218838); width: 100%; font-weight: 600; padding: 12px; font-size: 14px; }
    .bdp-btn-start:hover { filter: brightness(1.1); box-shadow: 0 4px 10px rgba(40, 167, 69, 0.3); }
    .bdp-tabs { display: flex; margin-bottom: 10px; border-bottom: 1px solid #ddd; background: #f8f9fa; border-radius: 6px 6px 0 0; }
    .bdp-tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; background: transparent; color: #666; border: none; font-weight: 500; transition: color 0.2s; }
    .bdp-tab.active { background: #fff; color: #007bff; font-weight: 700; border-bottom: 2px solid #007bff; border-radius: 6px 6px 0 0; }
    .bdp-filters { display: flex; gap: 8px; margin-bottom: 12px; }
    #bdp-search { flex-grow: 1; }
    #bdp-sort { width: 110px; }
    #bdp-saved-books-list { list-style: none; padding: 0; margin: 0; }
    .bdp-saved-book-item { padding: 12px; border: 1px solid #f0f0f0; margin-bottom: 8px; border-radius: 8px; background: #fff; transition: box-shadow 0.2s, transform 0.2s; animation: bdp-fade-in 0.3s ease-out; }
    .bdp-saved-book-item.disabled-item { background-color: #f8f9fa; border-style: dashed; }
    .bdp-saved-book-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); border-color: #e2e6ea; }
    .bdp-book-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .bdp-book-title { font-weight: 600; color: #333; text-decoration: none; font-size: 14px; flex-grow: 1; margin-right: 10px; line-height: 1.4; transition: color 0.2s; }
    .bdp-book-title:hover { color: #007bff; }
    .bdp-book-tag { font-size: 10px; padding: 3px 6px; background: #e9ecef; color: #495057; border-radius: 4px; white-space: nowrap; margin-left: 5px; height: fit-content; align-self: center; font-weight: 600; }
    .bdp-book-actions { display: flex; gap: 6px; margin-top:8px; }
    .bdp-action-btn { font-size: 11px; padding: 5px 10px; border-radius: 4px; border: none; cursor: pointer; color: white; flex: 1; font-weight: 600; transition: transform 0.1s, opacity 0.2s; text-decoration: none; text-align: center;}
    .bdp-action-btn:hover { opacity: 0.9; }
    .btn-blue { background: #17a2b8; } .btn-green { background: #007bff; } .btn-yellow { background: #ffc107; color: #333 !important; } .btn-red { background: #dc3545; }
    .btn-icon { background: none; border: none; color: #999; cursor: pointer; padding: 0; font-size: 14px; margin-left:5px; transition: color 0.2s;}
    .btn-icon:hover { color: #007bff; }
    .btn-bookmark { font-size: 16px; }
    .btn-bookmark.bookmarked { color: #ffc107; }
    #bdp-fab-container { position: fixed; bottom: ${fabBottom}; right: 20px; z-index: 10002; display: flex; flex-direction: column-reverse; gap: 12px; align-items: center; }
    .bdp-fab { width: 50px; height: 50px; border-radius: 50%; border: none; color: white; font-size: 22px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; opacity: 0; transform: scale(0.5); pointer-events: none; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .bdp-fab:hover { transform: scale(1.1) !important; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
    #bdp-fab-menu { background: linear-gradient(135deg, #007bff, #0056b3); opacity: 1; transform: scale(1); pointer-events: auto; z-index: 2; }
    .bdp-fab.visible { opacity: 1; transform: scale(1); pointer-events: auto; }
    #bdp-fab-stop { background: #dc3545; } #bdp-fab-pause { background: #ffc107; color: #333; }
    .bdp-saved-anim { animation: bdp-pulse-green 0.8s ease-out; background-color: #28a745 !important; }
    #bdp-modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; backdrop-filter: blur(2px); animation: bdp-fade-in 0.2s; }
    #bdp-modal-viewer { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 85%; height: 85vh; background: #fff; border-radius: 12px; z-index: 10001; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.3); animation: bdp-pop-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    .bdp-tm-toolbar { padding: 12px 20px; background: #f8f9fa; border-bottom: 1px solid #ddd; display: flex; flex-direction: column; gap: 10px; border-radius: 12px 12px 0 0; }
    .bdp-tm-toolbar-row { display: flex; align-items: center; gap: 15px; width: 100%;}
    .bdp-tm-label { font-size: 13px; font-weight: 600; color: #555; }
    .bdp-tm-input { width: 90px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
    #bdp-split-settings-details { display: none; flex-wrap: wrap; gap: 10px 15px; padding: 10px; background: #f0f2f5; border-radius: 6px; margin-top: 10px; }
    #bdp-split-settings-details label { display: flex; align-items: center; gap: 6px; font-size: 12px; }
    .bdp-stats-block { flex-grow:1; text-align:right; font-size:12px; color:#666; }
    .bdp-pack-list { padding: 20px; overflow-y: auto; flex-grow: 1; background: #f4f6f8; }
    .bdp-pack-card { background: #fff; border: 1px solid #eaeaea; border-left: 4px solid #aaa; border-radius: 8px; padding: 15px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.03); transition: transform 0.2s; animation: bdp-fade-in 0.3s ease-out; }
    .bdp-pack-card:hover { transform: translateX(3px); box-shadow: 0 4px 10px rgba(0,0,0,0.06); }
    .bdp-pack-card.translated { border-left-color: #28a745; background-color: #fafffb; }
    .bdp-pack-info { flex-grow: 1; }
    .bdp-pack-title { font-weight: 700; font-size: 14px; color: #333; margin-bottom: 5px; }
    .bdp-pack-meta { font-size: 12px; color: #777; }
    .bdp-pack-controls { display: flex; gap: 8px; }
    .bdp-pack-btn { padding: 6px 10px; font-size: 12px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; transition: background 0.2s; display:flex; align-items:center; gap:4px; }
    .btn-copy { background: #6c757d; color: white; } .btn-copy:hover { background: #5a6268; }
    .btn-mark { background: #fff; border: 1px solid #ddd; color: #333; } .btn-mark:hover { background: #e2e6ea; }
    .btn-mark.active { background: #28a745; color: white; border-color: #28a745; }
    .btn-read { background: #17a2b8; color: white; } .btn-read:hover { background: #138496; }
    .btn-dl { background: #007bff; color: white; } .btn-dl:hover { background: #0056b3; }
    #bdp-reader-container { display: none; flex-direction: column; height: 100%; background: #fff; border-radius: 0 0 12px 12px; }
    #bdp-reader-header { padding: 10px 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; background: #fdfdfd; gap:10px; }
    #bdp-reader-content { flex-grow: 1; padding: 30px; overflow-y: auto; font-family: 'Georgia', serif; line-height: 1.6; font-size: 18px; color: #222; white-space: pre-wrap; background: #fffcf5; }
    .bdp-back-btn { background: none; border: 1px solid #ddd; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; color: #555; }
    .bdp-back-btn:hover { background: #eee; }
    .bdp-mode-btn { background: #e9ecef; color: #333; }
    .bdp-mode-btn.active { background: #007bff; color: white; }
    .bdp-chapter-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #f0f0f0; }
    .bdp-chapter-item:last-child { border-bottom: none; }
    .bdp-chapter-title { flex-grow: 1; margin-right: 15px; font-size: 13px; }
    .bdp-source-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
    .bdp-source-tag { font-size: 11px; padding: 4px 10px; border: 1px solid #ddd; border-radius: 15px; cursor: pointer; background: #fff; color: #666; transition: all 0.2s; user-select: none; }
    .bdp-source-tag:hover { border-color: #aaa; color: #333; }
    .bdp-source-tag.active { background: #007bff; color: white; border-color: #0056b3; box-shadow: 0 2px 5px rgba(0,123,255,0.3); }

    /* Стиль для текущей выделенной книги */
    .bdp-saved-book-item.highlight-current {
        background-color: #f0f8ff !important; /* Светло-голубой фон */
        border: 2px solid #007bff !important; /* Синяя рамка */
        box-shadow: 0 0 10px rgba(0,123,255,0.2);
    }
    .bdp-saved-book-item.highlight-current::before {
        content: "📍 Текущая книга";
        display: block;
        font-size: 10px;
        font-weight: 700;
        color: #007bff;
        margin-bottom: 4px;
        text-transform: uppercase;
    }

    #bdp-transfer-panel {
        position: fixed; top: 0; right: -320px; width: 300px; height: 100vh;
        background: #fff; z-index: 10005; box-shadow: -5px 0 15px rgba(0,0,0,0.1);
        transition: right 0.3s ease; display: flex; flex-direction: column;
    }
    #bdp-transfer-panel.visible { right: 0; }
    #bdp-transfer-header {
        padding: 15px; background: #f8f9fa; border-bottom: 1px solid #ddd;
        display: flex; justify-content: space-between; align-items: center;
    }
    #bdp-transfer-body { flex-grow: 1; overflow-y: auto; padding: 15px; }
    .bdp-site-card {
        border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 12px;
        background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .bdp-site-card.active-site { border-left: 4px solid #28a745; background: #f9fff9; }
    .bdp-site-card.disabled-site { border-left: 4px solid #ccc; background: #fdfdfd; }
    .bdp-site-name { font-weight: 700; font-size: 14px; margin-bottom: 8px; display: block; }
    .bdp-site-actions { display: flex; gap: 5px; margin-top: 5px; }
    .bdp-site-btn {
        flex: 1; padding: 5px; font-size: 11px; border: none; border-radius: 4px;
        cursor: pointer; color: white; font-weight: 600; text-align: center; text-decoration: none;
    }
    .btn-exp { background: #17a2b8; } .btn-exp:hover { background: #138496; }
    .btn-imp { background: #ffc107; color: #333; } .btn-imp:hover { background: #e0a800; }
    .btn-goto { background: #6c757d; } .btn-goto:hover { background: #5a6268; }
    .bdp-site-btn:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }
    #bdp-transfer-overlay {
        display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); z-index: 10004; backdrop-filter: blur(2px);
    }
`);

// --- УТИЛИТЫ ---
function waitForElement(selector, timeout = 3000) { if (!selector) return Promise.resolve(null); return new Promise((resolve) => { const el = document.querySelector(selector); if (el) return resolve(el); const observer = new MutationObserver(() => { const el = document.querySelector(selector); if (el) { observer.disconnect(); resolve(el); } }); observer.observe(document.body, { childList: true, subtree: true }); setTimeout(() => { observer.disconnect(); resolve(null); }, timeout); }); }
function getDomainTag(url) { try { const hostname = new URL(url).hostname; return hostname.replace('www.', '').replace('m.', '').split('.')[0]; } catch (e) { return '???'; } }
function formatNumber(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function loadPackSettings() {
    const saved = localStorage.getItem('bdp_pack_settings');
    if (saved) {
        packSettings = { ...packSettings, ...JSON.parse(saved) };
    }
}
function savePackSettings() {
    localStorage.setItem('bdp_pack_settings', JSON.stringify(packSettings));
}

// --- ЛОГИКА ОПРЕДЕЛЕНИЯ КНИГИ ---
function identifyBook() {
  const url = window.location.href; const path = window.location.pathname; const syosetuMatch = path.match(/^\/([nN]\d+[a-zA-Z]+)\//);
  if (HOST.includes('freewebnovel.com')) {
    const match = path.match(/\/novel\/([a-zA-Z0-9-]+)/);
    if (match) {
        const slug = match[1];
        const id = 'book_fwn_' + slug;
        const url = `https://www.freewebnovel.com/novel/${slug}`;
        let title = null;
        const titleElement = document.querySelector('h1.tit a');
        if (titleElement) {
            title = titleElement.getAttribute('title') || titleElement.textContent.trim();
        }
        return { id: id, url: url, isAuto: true, title: title };
    }
  }
  if (syosetuMatch) { const code = syosetuMatch[1]; return { id: 'book_' + code, url: `https://${HOST}/${code}/`, isAuto: true, title: null }; } if (HOST.includes('rulate.ru') && path.includes('/book/')) { const match = path.match(/\/book\/(\d+)/); if (match) { return { id: 'book_rulate_' + match[1], url: `https://tl.rulate.ru/book/${match[1]}`, isAuto: true, title: null }; } } if (HOST.includes('69shuba.com')) { const match = path.match(/(?:\/book\/|\/txt\/)(\d+)/); if (match) { const id = match[1]; let title = null; const breadLink = document.querySelector(`.bread a[href*="/book/${id}"]`); if (breadLink) { title = breadLink.textContent.trim(); } return { id: 'book_69shuba_' + id, url: `https://www.69shuba.com/book/${id}.htm`, isAuto: true, title: title }; } } if (HOST.includes('101kks.com')) { const match = path.match(/(?:\/book\/|\/txt\/)(\d+)/); if (match) { const id = match[1]; let title = null; const navLink = document.querySelector(`.page1 a[title][href*="/book/${id}"]`); if (navLink) { let fullTitle = navLink.getAttribute('title'); title = fullTitle.replace(/最新章節列表$/, '').trim(); } return { id: 'book_101kks_' + id, url: `https://101kks.com/book/${id}/index.html`, isAuto: true, title: title }; } } if (HOST.includes('nnttrr.com')) { const match = path.match(/\/book\/(\d+)/); if (match) { const id = match[1]; let title = null; const dirLink = document.querySelector(`a[href*="/book/${id}/"][title]`); if (dirLink) { title = dirLink.getAttribute('title'); } return { id: 'book_nnttrr_' + id, url: `https://nnttrr.com/book/${id}/`, isAuto: true, title: title }; } } if (HOST.includes('yeduge.com')) { const match = path.match(/\/book\/(\d+)/); if (match) { const id = match[1]; let title = null; const ownerName = document.querySelector('.owner .name'); if (ownerName) { title = ownerName.textContent.trim(); } if (!title) { const dirLink = document.querySelector(`.chapter-page a[href*="/book/${id}/"]`); if (dirLink) { title = dirLink.getAttribute('title') || dirLink.textContent.trim(); if (title === '返回目录') title = null; } } return { id: 'book_yeduge_' + id, url: `https://www.yeduge.com/book/${id}/`, isAuto: true, title: title }; } } if (HOST.includes('read-novel.com')) { const match = path.match(/(novel\d+-[a-zA-Z0-9-]+)/); if (match) { const slug = match[1]; const id = 'book_readnovel_' + slug; const url = `https://read-novel.com/${slug}.html`; let title = null; const titleElement = document.querySelector('a.truyen-title'); if (titleElement) { title = titleElement.getAttribute('title') || titleElement.textContent.trim(); } return { id: id, url: url, isAuto: true, title: title }; } }

  if (HOST.includes('drxsw.com')) {
    let match = path.match(/\/book\/(\d+)/);

    if (!match) {
        const breadcrumbLink = document.querySelector('.path a[href*="/book/"]');
        if (breadcrumbLink) {
            match = breadcrumbLink.href.match(/\/book\/(\d+)/);
        }
    }

    if (match) {
        const id = match[1];
        let title = document.querySelector('.path a:last-of-type')?.textContent.trim() || null;
        return {
            id: 'book_drxsw_' + id,
            url: `https://www.drxsw.com/book/${id}/`,
            isAuto: true,
            title: title
        };
    }
  }

  if (HOST.includes('qushucheng.com')) {
    const match = path.match(/\/book_(\d+)/);
    if (match) {
        const id = match[1];
        let title = null;
        // Название книги часто есть в "хлебных крошках" (путь на сайте)
        const breadcrumbLink = document.querySelector(`.path a[href*="/book_${id}/"]`);
        if (breadcrumbLink) {
            title = breadcrumbLink.textContent.trim();
        }
        return {
            id: 'book_qushucheng_' + id,
            url: `https://www.qushucheng.com/book_${id}/`,
            isAuto: true,
            title: title
        };
    }
  }

    if (HOST.includes('jwxs.org')) {
      const match = window.location.pathname.match(/(?:\/book\/|\/xiaoshuo\/)(\d+)/);
      if (match) {
          const id = match[1];
          let title = null;
          const breadcrumbLink = document.querySelector(`.con_top a[href*="/book/${id}/"]`);
          if (breadcrumbLink) {
              title = breadcrumbLink.textContent.trim();
          }
          return {
              id: 'book_jwxs_' + id,
              url: `https://www.jwxs.org/book/${id}/`,
              isAuto: true,
              title: title
          };
      }
    }
    if (HOST.includes('shuhaixsw.com')) {
        // Находим ссылку внутри блока about -> dl -> dd.
        // Твоя верстка: <div class="about"><dl><dd><a href="/book/eej0gg.html">...
        const bookLink = document.querySelector('.about dl dd a[href*="/book/"]');

        if (bookLink) {
            // Получаем атрибут: "/book/eej0gg.html"
            const href = bookLink.getAttribute('href');

            // Просто вырезаем лишнее, оставляя чистый ID "eej0gg"
            const id = href.replace('/book/', '').replace('.html', '');

            // Название берем из текста ссылки (скрипт сам почистит лишние пробелы)
            const title = bookLink.textContent.trim();

            return {
                id: 'book_shuhaixsw_' + id,
                // Ссылка на оглавление формируется из ID
                url: `https://www.shuhaixsw.com/chapter/${id}.html`,
                isAuto: true,
                title: title
            };
      }
  }

  if (HOST.includes('quanben5.com')) {
      const match = path.match(/\/n\/([a-zA-Z0-9_-]+)\//);
      if (match) {
          const id = match[1];
          let title = null;
          // Попытка вытащить название книги из title или других элементов, если они есть.
          // Если скрипт не найдет - он просто спросит название при первом сохранении.
          return {
              id: 'book_quanben5_' + id,
              // Ссылка на страницу оглавления
              url: `https://www.quanben5.com/n/${id}/xiaoshuo.html`,
              isAuto: true,
              title: title
          };
      }
  }

  if (HOST.includes('kelexs.com')) {
        // Находим ссылку на книгу в блоке .about
        const bookLink = document.querySelector('.about dl dd a[href*="/book/"]');

        if (bookLink) {
            // Пример href: "/book/AAGJKAI.html"
            const href = bookLink.getAttribute('href');
            // Вырезаем ID: "AAGJKAI"
            const id = href.replace('/book/', '').replace('.html', '');
            const title = bookLink.textContent.trim();

            return {
                id: 'book_kelexs_' + id,
                // Ссылка на оглавление (в вашей верстке кнопка "Каталог" ведет на /chapter/ID.html)
                url: `https://www.kelexs.com/chapter/${id}.html`,
                isAuto: true,
                title: title
            };
        }
    }


   if (HOST.includes('sudugu.org')) {
      // Ищем ID книги в URL (например, /5420/)
      const match = path.match(/\/(\d+)\//);
      if (match) {
          const id = match[1];
          let title = null;
          // Название книги лежит в ссылке внутри заголовка ( <a href="/5420/">Название</a> )
          const titleLink = document.querySelector('.submenu h1 a');
          if (titleLink) {
              title = titleLink.textContent.trim();
          }
          return {
              id: 'book_sudugu_' + id,
              url: `https://www.sudugu.org/${id}/`, // Ссылка на оглавление
              isAuto: true,
              title: title
          };
      }
  }


  if (HOST.includes('pinellianovel.com')) {
      const match = path.match(/\/books\/([a-zA-Z0-9]+)/);
      if (match) {
          const id = match[1];
          let title = null;
          const h1 = document.querySelector('h1.reader-header__title');
          if (h1) {
              title = h1.textContent.split('_')[0].trim();
          }
          return {
              id: 'book_pinellia_' + id,
              url: `https://www.pinellianovel.com/books/${id}.html`,
              isAuto: true,
              title: title
          };
      }
  }

  return { id: null, url: window.location.href, isAuto: false, title: null }; }

// --- UI ФУНКЦИИ ---
async function createUI() {
    if (document.getElementById('bdp-app')) return;
    loadPackSettings();
    const savedDelay = await db.get('bdp_global_delay', 2000);

    const appDiv = document.createElement('div');
    appDiv.id = 'bdp-app';
    appDiv.innerHTML = `
        <div id="bdp-transfer-overlay"></div>
        <div id="bdp-transfer-panel">
            <div id="bdp-transfer-header">
                <h3 style="margin:0; font-size:15px;">Управление сайтами</h3>
                <button id="bdp-transfer-close" style="border:none; bg:none; cursor:pointer; font-size:20px;">×</button>
            </div>
            <div id="bdp-transfer-body">
                <p style="font-size:12px; color:#666; margin-bottom:15px;">
                    Из-за защиты браузера скачивать книги можно только находясь на сайте, где они были созданы.
                </p>
                <div id="bdp-sites-list"></div>
            </div>
        </div>
        <div id="bdp-fab-container">
            <button id="bdp-fab-menu" class="bdp-fab" title="Меню">📚</button>
            <button id="bdp-fab-pause" class="bdp-fab" title="Пауза">⏸️</button>
            <button id="bdp-fab-stop" class="bdp-fab" title="Стоп">⏹️</button>
        </div>
        <div id="bdp-panel">
            <div id="bdp-header"><h2>Book Downloader v8.3</h2><button id="bdp-close-btn">×</button></div>
            <div id="bdp-body">
                <div class="bdp-section" id="bdp-active-section">
                    <div class="bdp-section-title">Текущая книга</div>
                    <div id="bdp-book-info-block" style="display:none; margin-bottom:10px;"><div style="font-weight:bold; color:#007bff; margin-bottom:5px;" id="bdp-info-title"></div><div style="font-size:12px; color:#666;">ID: <span id="bdp-info-id"></span></div></div>
                    <div id="bdp-manual-input" style="display:none; margin-bottom:10px;"><p style="font-size:12px; color:#666;">Новая книга. Введите название:</p><input type="text" id="bdp-input-title" class="bdp-input bdp-input-full" placeholder="Название книги..."></div>
                    <div class="bdp-control-group"><label>Задержка (мс):</label><input type="number" id="bdp-delay" class="bdp-input" value="${savedDelay}" style="width:70px"></div>
                    <button id="bdp-start-btn" class="bdp-btn bdp-btn-start">Начать загрузку</button>
                    <div id="bdp-status-block" style="display:none; margin-top:10px; padding-top:10px; border-top:1px dashed #ddd;"><div class="bdp-control-group"><span>Статус:</span><span id="bdp-status-text" style="font-weight:bold;">Активен</span></div><div class="bdp-control-group"><span>Главы:</span><span id="bdp-stat-chapters">0</span></div></div>
                </div>
                <div class="bdp-section">
                    <div class="bdp-section-title">Библиотека</div>
                    <div class="bdp-tabs"><button class="bdp-tab active" data-tab="active">Читаемые</button><button class="bdp-tab" data-tab="bookmarks">⭐ Закладки</button><button class="bdp-tab" data-tab="finished">Завершенные</button></div>
                    <div id="bdp-source-filters" class="bdp-source-tags"></div>
                    <div class="bdp-filters"><input type="text" id="bdp-search" class="bdp-input" placeholder="Поиск..."><select id="bdp-sort" class="bdp-input"><option value="date_desc">Новые</option><option value="date_asc">Старые</option><option value="name">А-Я</option><option value="count">Размер</option><option value="source">Сайт</option></select></div>
                    <ul id="bdp-saved-books-list"></ul>
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ddd; display: flex; flex-direction: column; gap: 8px;">
                        <!-- Старые кнопки оставим как "Общий бэкап", но добавим новую -->
                        <button id="bdp-transfer-open-btn" class="bdp-btn" style="background: linear-gradient(to right, #6610f2, #6f42c1); width:100%;">🔄 Перенос данных (По сайтам)</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="bdp-modal-overlay">
            <div id="bdp-modal-viewer">
                 <div style="padding:15px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;"><h3 id="bdp-modal-title" style="margin:0;">Название книги</h3><button id="bdp-modal-close-btn" style="border:none; background:none; cursor:pointer; font-size:24px; color:#555;">×</button></div>
                <div class="bdp-tm-toolbar" id="bdp-tm-toolbar">
                    <div class="bdp-tm-toolbar-row">
                        <span class="bdp-tm-label">Лимит пака:</span><input type="number" id="bdp-pack-limit-input" class="bdp-tm-input" value="${packSettings.charLimit}" step="5000">
                        <button id="bdp-recalc-btn" class="bdp-btn btn-green">Обновить</button>
                        <details id="bdp-split-settings-toggle" style="margin-left: 10px;">
                            <summary style="cursor: pointer; font-size: 12px; font-weight: 600; color: #555;">Настройки деления глав</summary>
                            <div id="bdp-split-settings-details">
                                <label><input type="checkbox" id="bdp-split-enabled" ${packSettings.splitEnabled ? 'checked' : ''}> Включить</label>
                                <label>Max: <input type="number" id="bdp-split-max" class="bdp-tm-input" style="width:80px;" value="${packSettings.splitMaxChars}"></label>
                                <label>Min: <input type="number" id="bdp-split-min" class="bdp-tm-input" style="width:80px;" value="${packSettings.splitMinChars}"></label>
                                <label><input type="checkbox" id="bdp-split-use-separators" ${packSettings.splitUseSeparators ? 'checked' : ''}> По разделителям</label>
                                <label>Разделители (через запятую): <input type="text" id="bdp-split-separators-input" class="bdp-input" style="width:150px;" value="${packSettings.splitSeparators}"></label>
                            </div>
                        </details>
                        <button id="bdp-split-report-btn" class="bdp-btn btn-blue" style="margin-left: auto;">Отчет о делении</button>
                    </div>
                     <div class="bdp-tm-toolbar-row bdp-stats-block">
                        Всего глав: <b id="bdp-tm-total-ch">0</b> |
                        Символов: <b id="bdp-tm-total-chars">0</b> |
                        Среднее: <b id="bdp-tm-avg-chars">0</b> |
                        Самая большая: <b id="bdp-tm-max-chars">0</b> |
                        Самая малая: <b id="bdp-tm-min-chars">0</b>
                    </div>
                </div>
                <div class="bdp-view-controls" style="padding: 0 20px 10px; border-bottom: 1px solid #ddd; background: #f8f9fa; display: flex; align-items: center; gap: 15px;">
                    <div>
                        <span class="bdp-tm-label">Режим:</span>
                        <button id="bdp-view-mode-packs" class="bdp-btn bdp-mode-btn active">Паки</button>
                        <button id="bdp-view-mode-chapters" class="bdp-btn bdp-mode-btn">Главы</button>
                    </div>
                    <input type="text" id="bdp-chapter-search-input" class="bdp-input" placeholder="Поиск по названию главы..." style="display: none; flex-grow: 1;">
                </div>
                <div id="bdp-pack-list" class="bdp-pack-list"></div>
                <div id="bdp-chapter-list" class="bdp-pack-list" style="display: none;"></div>
                <div id="bdp-reader-container"><div id="bdp-reader-header"><button class="bdp-back-btn" id="bdp-reader-back">← Назад к пакам</button><span id="bdp-reader-title" style="font-weight:600;">Чтение</span></div><div id="bdp-reader-content"></div></div>
            </div>
        </div>
    `;
    document.body.appendChild(appDiv);

    // Events
    document.getElementById('bdp-fab-menu').onclick = () => document.getElementById('bdp-panel').classList.toggle('visible');
    document.getElementById('bdp-close-btn').onclick = () => document.getElementById('bdp-panel').classList.remove('visible');
    document.getElementById('bdp-start-btn').onclick = handleStartClick;
    document.getElementById('bdp-fab-pause').onclick = togglePause;
    document.getElementById('bdp-fab-stop').onclick = () => stopScraping('Остановлено');
    document.getElementById('bdp-delay').onchange = async (e) => await db.set('bdp_global_delay', e.target.value);
    document.querySelectorAll('.bdp-tab').forEach(t => t.onclick = (e) => { document.querySelectorAll('.bdp-tab').forEach(x => x.classList.remove('active')); e.target.classList.add('active'); libraryState.tab = e.target.dataset.tab; renderLibrary(); });
    document.getElementById('bdp-search').oninput = (e) => { libraryState.search = e.target.value; renderLibrary(); };
    document.getElementById('bdp-sort').onchange = (e) => { libraryState.sort = e.target.value; renderLibrary(); };
    document.getElementById('bdp-modal-close-btn').onclick = () => document.getElementById('bdp-modal-overlay').style.display='none';
    document.getElementById('bdp-recalc-btn').onclick = refreshPacksUI;
    document.getElementById('bdp-pack-limit-input').onchange = (e) => { packSettings.charLimit = parseInt(e.target.value) || 100000; savePackSettings(); };
    document.getElementById('bdp-reader-back').onclick = closeReaderView;
    document.getElementById('bdp-split-report-btn').onclick = showSplitReport;
    document.getElementById('bdp-view-mode-packs').onclick = () => switchModalView('packs');
    document.getElementById('bdp-view-mode-chapters').onclick = () => switchModalView('chapters');
    document.getElementById('bdp-chapter-search-input').oninput = refreshPacksUI;

    // Split settings events
    const splitToggle = document.getElementById('bdp-split-settings-toggle');
    splitToggle.addEventListener('toggle', () => {
        document.getElementById('bdp-split-settings-details').style.display = splitToggle.open ? 'flex' : 'none';
    });
    document.getElementById('bdp-split-enabled').onchange = (e) => { packSettings.splitEnabled = e.target.checked; savePackSettings(); };
    document.getElementById('bdp-split-max').onchange = (e) => { packSettings.splitMaxChars = parseInt(e.target.value) || 20000; savePackSettings(); };
    document.getElementById('bdp-split-min').onchange = (e) => { packSettings.splitMinChars = parseInt(e.target.value) || 6000; savePackSettings(); };
    document.getElementById('bdp-split-use-separators').onchange = (e) => { packSettings.splitUseSeparators = e.target.checked; savePackSettings(); };
    document.getElementById('bdp-split-separators-input').onchange = (e) => { packSettings.splitSeparators = e.target.value; savePackSettings(); };

    // Draggable
    const panel = document.getElementById('bdp-panel'), header = document.getElementById('bdp-header'); let isDown=false, off=[0,0]; header.onmousedown=(e)=>{isDown=true;off=[panel.offsetLeft-e.clientX,panel.offsetTop-e.clientY];}; document.onmouseup=()=>{isDown=false;}; document.onmousemove=(e)=>{if(isDown){panel.style.left=(e.clientX+off[0])+'px';panel.style.top=(e.clientY+off[1])+'px'; panel.style.right='auto'; panel.style.bottom='auto';}};

    const transferPanel = document.getElementById('bdp-transfer-panel');
    const transferOverlay = document.getElementById('bdp-transfer-overlay');

    document.getElementById('bdp-transfer-open-btn').onclick = () => {
        renderTransferList(); // Функция будет ниже
        transferPanel.classList.add('visible');
        transferOverlay.style.display = 'block';
    };

    const closeTransfer = () => {
        transferPanel.classList.remove('visible');
        transferOverlay.style.display = 'none';
    };
    document.getElementById('bdp-transfer-close').onclick = closeTransfer;
    document.getElementById('bdp-transfer-overlay').onclick = closeTransfer;

    renderLibrary();
}

// --- ГЛАВНАЯ ЛОГИКА ---
async function init() {
    await createUI();
    const detected = identifyBook();
    if (detected.id) {
        currentBookInfo = detected;
        const savedBook = await db.get(detected.id);
        if (savedBook) {
            currentBookInfo.title = savedBook.title;
            setupExistingBookUI(savedBook);
            SESSION_KEY = `bdp_session_${detected.id}`;
            const savedState = await db.get(SESSION_KEY);
            if (savedState && savedState.isScraping) {
                state = savedState; updateUIState(); scrapePage();
            }
        } else {
            setupNewBookUI(detected.id, detected.title);
        }
    } else {
        document.getElementById('bdp-start-btn').disabled = true;
        document.getElementById('bdp-start-btn').textContent = "Книга не найдена";
    }
}

  async function renderTransferList() {
    const list = document.getElementById('bdp-sites-list');
    list.innerHTML = 'Загрузка...';

    const libraryCache = await getLibraryCache();
    const books = Object.values(libraryCache);

    // Собираем уникальные домены из библиотеки
    const domainsMap = {};
    books.forEach(book => {
        try {
            const hostname = new URL(book.url).hostname;
            if (!domainsMap[hostname]) {
                domainsMap[hostname] = { count: 0, url: book.url }; // Сохраняем одну ссылку для перехода
            }
            domainsMap[hostname].count++;
        } catch(e) {}
    });

    list.innerHTML = '';
    const currentHost = window.location.hostname;

    if (Object.keys(domainsMap).length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#777">Библиотека пуста</div>';
        return;
    }

    for (const [domain, data] of Object.entries(domainsMap)) {
        const isCurrent = currentHost.includes(domain) || domain.includes(currentHost); // Простая проверка вхождения

        const card = document.createElement('div');
        card.className = `bdp-site-card ${isCurrent ? 'active-site' : 'disabled-site'}`;

        // HTML для кнопок
        let buttonsHtml = '';
        if (isCurrent) {
            buttonsHtml = `
                <button class="bdp-site-btn btn-exp" data-domain="${domain}">📤 Экспорт (${data.count})</button>
                <button class="bdp-site-btn btn-imp" data-domain="${domain}">📥 Импорт</button>
                <input type="file" class="site-import-input" style="display:none" accept=".json">
            `;
        } else {
            buttonsHtml = `
                <button class="bdp-site-btn btn-exp" disabled title="Недоступно с текущего сайта">📤 Экспорт</button>
                <button class="bdp-site-btn btn-imp" disabled title="Недоступно с текущего сайта">📥 Импорт</button>
                <a href="${data.url}" class="bdp-site-btn btn-goto">Перейти на сайт ➜</a>
            `;
        }

        card.innerHTML = `
            <span class="bdp-site-name">${domain} ${isCurrent ? '<span style="color:green;font-size:10px;margin-left:5px;">(Текущий)</span>' : ''}</span>
            <div style="font-size:11px; color:#555;">Книг в базе: ${data.count}</div>
            <div class="bdp-site-actions">${buttonsHtml}</div>
        `;

        list.appendChild(card);

        // Навешиваем события только если активен
        if (isCurrent) {
            const expBtn = card.querySelector('.btn-exp');
            const impBtn = card.querySelector('.btn-imp');
            const fileInput = card.querySelector('.site-import-input');

            expBtn.onclick = () => exportSiteData(domain);
            impBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => importSiteData(e, domain);
        }
    }
}

async function exportSiteData(targetDomain) {
    const libraryCache = await getLibraryCache();
    const exportData = {
        version: '8.3',
        sourceDomain: targetDomain,
        timestamp: Date.now(),
        books: {}
    };

    let count = 0;

    // Проходимся по библиотеке и ищем книги этого домена
    for (const [id, meta] of Object.entries(libraryCache)) {
        try {
            if (new URL(meta.url).hostname === targetDomain) {
                // Пытаемся достать полные данные из IndexedDB
                // Т.к. мы находимся на правильном домене, db.get(id) должен вернуть данные
                const fullBook = await db.get(id);
                if (fullBook) {
                    exportData.books[id] = fullBook;
                    count++;
                }
            }
        } catch (e) { console.error(e); }
    }

    if (count === 0) {
        alert('Не найдено полных данных книг для этого домена в локальном хранилище.');
        return;
    }

    const jsonString = JSON.stringify(exportData);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${targetDomain}_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    alert(`Экспортировано книг: ${count}`);
}

async function importSiteData(e, targetDomain) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);

            // Валидация
            if (!data.books) throw new Error("Неверный формат файла");

            // Если в файле указан домен, можно предупредить, если он не совпадает (опционально)
            if (data.sourceDomain && data.sourceDomain !== targetDomain) {
                if(!confirm(`Файл создан для ${data.sourceDomain}, а вы импортируете в ${targetDomain}. Продолжить?`)) return;
            }

            let importedCount = 0;
            const currentCache = await getLibraryCache();

            for (const [id, bookData] of Object.entries(data.books)) {
                // 1. Сохраняем "тяжелые" данные в IndexedDB (доступно, т.к. мы на нужном домене)
                await db.set(id, bookData);

                // 2. Обновляем мета-кэш (общая библиотека)
                currentCache[id] = {
                    title: bookData.title,
                    url: bookData.url,
                    chapterCount: bookData.chapters ? bookData.chapters.length : 0,
                    updated: bookData.updated || Date.now(),
                    isFinished: !!bookData.isFinished,
                    isBookmarked: currentCache[id]?.isBookmarked || false
                };
                importedCount++;
            }

            await setLibraryCache(currentCache);
            alert(`Успешно импортировано книг: ${importedCount}`);
            renderTransferList(); // Обновить список
            renderLibrary(); // Обновить главную библиотеку

        } catch (err) {
            alert("Ошибка импорта: " + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function setupExistingBookUI(book) { document.getElementById('bdp-book-info-block').style.display = 'block'; document.getElementById('bdp-info-title').textContent = book.title; document.getElementById('bdp-info-id').textContent = book.id; document.getElementById('bdp-start-btn').textContent = "Продолжить загрузку"; document.getElementById('bdp-manual-input').style.display = 'none'; updateStats(book); }
function setupNewBookUI(id, suggestedTitle = null) { document.getElementById('bdp-book-info-block').style.display = 'block'; document.getElementById('bdp-info-title').textContent = "Новая книга"; document.getElementById('bdp-info-id').textContent = id; document.getElementById('bdp-manual-input').style.display = 'block'; document.getElementById('bdp-start-btn').textContent = "Сохранить и начать"; if (suggestedTitle) { document.getElementById('bdp-input-title').value = suggestedTitle; document.getElementById('bdp-info-title').textContent = suggestedTitle; } }

async function handleStartClick() {
    if (!currentBookInfo || !currentBookInfo.id) return;

    let title = currentBookInfo.title;
    const input = document.getElementById('bdp-input-title');
    // Проверяем, что поле ввода названия видимо и заполнено
    if (input && input.value.trim() && input.offsetParent !== null) {
        title = input.value.trim();
    }
    if (!title) {
        return alert('Введите название книги!');
    }

    // --- НАЧАЛО ДОБАВЛЕННОГО КОДА ---
    // Проверяем, существует ли книга с таким же названием
    const libraryCache = await getLibraryCache();
    let existingBookId = null;
    let existingBookTitle = "";

    // Ищем книгу в кэше, игнорируя регистр
    for (const id in libraryCache) {
        if (libraryCache[id].title.toLowerCase() === title.toLowerCase()) {
            existingBookId = id;
            existingBookTitle = libraryCache[id].title;
            break;
        }
    }

    // Если книга найдена, и ее ID не совпадает с ID текущей страницы
    if (existingBookId && existingBookId !== currentBookInfo.id) {
        const confirmation = confirm(
            `Книга с названием "${existingBookTitle}" уже существует в библиотеке.\n\n` +
            `Хотите продолжить добавлять главы в нее, а не создавать новую?`
        );

        if (confirmation) {
            // Пользователь согласился. Меняем ID текущей книги на ID найденной.
            console.log(`BDP: Слияние. Переключаемся с ID ${currentBookInfo.id} на существующий ID ${existingBookId}`);
            currentBookInfo.id = existingBookId;
            // Также обновим URL в существующей книге на случай, если он изменился
            currentBookInfo.url = window.location.href;
        } else {
            // Пользователь отказался. Прерываем операцию.
            alert("Сохранение отменено. Пожалуйста, введите уникальное название для новой книги.");
            return;
        }
    }
    // --- КОНЕЦ ДОБАВЛЕННОГО КОДА ---

    // Дальнейший код теперь будет работать с правильным ID (либо новым, либо существующим)
    let bookData = await db.get(currentBookInfo.id, { id: currentBookInfo.id, title: title, url: currentBookInfo.url, chapters: [], created: Date.now() });

    currentBookInfo.title = title;
    bookData.title = title; // Убедимся, что название книги обновлено
    if (!bookData.url || bookData.url !== currentBookInfo.url) {
       bookData.url = currentBookInfo.url; // Обновляем URL
    }
    await db.set(currentBookInfo.id, bookData);
    await updateLibraryCache(bookData);

    SESSION_KEY = `bdp_session_${currentBookInfo.id}`;
    state = { isScraping: true, isPaused: false, currentBookId: currentBookInfo.id };
    await db.set(SESSION_KEY, state);

    updateUIState();
    document.getElementById('bdp-panel').classList.remove('visible');
    setupExistingBookUI(bookData);
    scrapePage();
}


async function scrapePage() {
    if (!state.isScraping || state.isPaused) return;

    const contentEl = await waitForElement(SELECTORS.chapterContent, 3000);
    if (!contentEl) return stopScraping('Ошибка: текст не найден');

    const titleEl = document.querySelector(SELECTORS.chapterTitle);
    const rawChapterTitle = titleEl ? titleEl.textContent.trim() : 'Chapter';
    const chapterText = contentEl.innerText;

    let bookData = await db.get(state.currentBookId);
    if (!bookData) return stopScraping('Ошибка данных');

    let isMerged = false;

    const hostsWithMerging = ['qushucheng.com', 'jwxs.org', 'shuhaixsw.com', 'kelexs.com', 'sudugu.org', 'pinellianovel.com'];
    const needsMerging = hostsWithMerging.some(h => HOST.includes(h));

    // Создаем новую переменную, чтобы не пытаться изменить константу
    let cleanTitle = rawChapterTitle;

    // На sudugu заголовок выглядит как "Название книги > 1. Глава". Отрезаем название:
    if (HOST.includes('sudugu.org') && cleanTitle.includes('>')) {
        cleanTitle = cleanTitle.split('>').pop().trim();
    }

    const chapterTitle = cleanTitle.replace(/\s*[\(（](\d+\/\d+|\d+|第\d+页)[\)）]\s*$/, '').trim();

    if (needsMerging && bookData.chapters.length > 0) {
        const lastChapter = bookData.chapters[bookData.chapters.length - 1];
        // Сравниваем нормализованный текущий заголовок с уже сохраненным (который тоже нормализован)
        if (lastChapter.title === chapterTitle) {
            console.log(`BDP: Слияние главы '${chapterTitle}' на ${HOST}`);
            lastChapter.content += '\n\n' + chapterText; // Добавляем новый текст
            bookData.updated = Date.now();
            await db.set(state.currentBookId, bookData); // Сохраняем обновленные данные

            const btn = document.getElementById('bdp-fab-menu');
            btn.classList.add('bdp-saved-anim');
            setTimeout(() => btn.classList.remove('bdp-saved-anim'), 600);

            isMerged = true; // Устанавливаем флаг, чтобы не добавлять эту главу как новую
        }
    }

    // Добавляем главу как новую, только если она не была слита и ее еще нет в списке
    if (!isMerged && !bookData.chapters.some(c => c.title === chapterTitle)) {
        // Сохраняем главу с уже нормализованным заголовком
        bookData.chapters.push({ title: chapterTitle, content: chapterText, isTranslated: false });
        bookData.updated = Date.now();
        await db.set(state.currentBookId, bookData);
        await updateLibraryCache(bookData);

        const btn = document.getElementById('bdp-fab-menu');
        btn.classList.add('bdp-saved-anim');
        setTimeout(() => btn.classList.remove('bdp-saved-anim'), 600);
    }

    updateStats(bookData);

    let nextLink = document.querySelector(SELECTORS.nextChapterLink);

    if (HOST.includes('sudugu.org')) {
        const links = document.querySelectorAll('.prenext a');
        for (let link of links) {
            if (link.textContent.includes('下一页') || link.textContent.includes('下一章')) {
                nextLink = link;
                break;
            }
        }
    }

    if (nextLink && nextLink.href) {
        const delay = parseInt(document.getElementById('bdp-delay').value) || 2000;
        document.getElementById('bdp-status-text').textContent = `Переход (${delay}ms)...`;
        setTimeout(() => {
            if (state.isScraping && !state.isPaused) window.location.href = nextLink.href;
        }, delay);
    } else {
        stopScraping('Завершено (нет ссылки)');
    }
}

async function togglePause() { state.isPaused = !state.isPaused; state.isScraping = !state.isPaused; if(SESSION_KEY) await db.set(SESSION_KEY, state); updateUIState(); if (state.isScraping) scrapePage(); }
async function stopScraping(reason) { state.isScraping = false; state.isPaused = false; if(SESSION_KEY) await db.set(SESSION_KEY, state); updateUIState(); document.getElementById('bdp-status-text').textContent = reason; document.getElementById('bdp-panel').classList.add('visible'); renderLibrary(); }
function updateUIState() { const fabPause = document.getElementById('bdp-fab-pause'); const fabStop = document.getElementById('bdp-fab-stop'); const statusBlock = document.getElementById('bdp-status-block'); if (state.isScraping || state.isPaused) { fabPause.classList.add('visible'); fabStop.classList.add('visible'); statusBlock.style.display = 'block'; fabPause.innerHTML = state.isPaused ? '▶️' : '⏸️'; document.getElementById('bdp-status-text').style.color = state.isPaused ? '#ffc107' : '#28a745'; } else { fabPause.classList.remove('visible'); fabStop.classList.remove('visible'); statusBlock.style.display = 'none'; } }
function updateStats(book) { if(!book) return; document.getElementById('bdp-stat-chapters').textContent = book.chapters.length; }

// --- БИБЛИОТЕКА И МЕНЕДЖЕР ПЕРЕВОДОВ ---
async function renderLibrary() {
    const list = document.getElementById('bdp-saved-books-list');
    const tagsContainer = document.getElementById('bdp-source-filters');
    list.innerHTML = '<li style="padding:10px;text-align:center;color:#999">Загрузка...</li>';

    const libraryCache = await getLibraryCache();
    // Превращаем кэш в массив
    let books = Object.entries(libraryCache).map(([id, meta]) => ({ id, ...meta }));

    // --- 1. ЛОГИКА ТЕГОВ ИСТОЧНИКОВ ---

    // Сначала фильтруем по табам (Читаемые/Закладки/Завершенные)
    if (libraryState.tab === 'bookmarks') {
        books = books.filter(b => b.isBookmarked);
    } else {
        const isFinTab = libraryState.tab === 'finished';
        books = books.filter(b => !!b.isFinished === isFinTab);
    }

    // Собираем домены для кнопок
    const allDomains = [...new Set(books.map(b => getDomainTag(b.url)))].sort();

    // Рендерим кнопки тегов
    tagsContainer.innerHTML = '';
    if (allDomains.length > 0) {
        allDomains.forEach(domain => {
            const tag = document.createElement('span');
            tag.className = `bdp-source-tag ${libraryState.selectedSources.includes(domain) ? 'active' : ''}`;
            tag.textContent = domain;
            tag.onclick = () => {
                // Мульти-выбор: если уже есть - убираем, если нет - добавляем
                if (libraryState.selectedSources.includes(domain)) {
                    libraryState.selectedSources = libraryState.selectedSources.filter(s => s !== domain);
                } else {
                    libraryState.selectedSources.push(domain);
                }
                renderLibrary(); // Перерисовка
            };
            tagsContainer.appendChild(tag);
        });
        // Кнопка сброса, если что-то выбрано
        if (libraryState.selectedSources.length > 0) {
            const clearBtn = document.createElement('span');
            clearBtn.className = 'bdp-source-tag';
            clearBtn.style.color = '#dc3545';
            clearBtn.style.borderColor = '#dc3545';
            clearBtn.textContent = '✕ Сброс';
            clearBtn.onclick = () => { libraryState.selectedSources = []; renderLibrary(); };
            tagsContainer.appendChild(clearBtn);
        }
        tagsContainer.style.display = 'flex';
    } else {
        tagsContainer.style.display = 'none';
    }

    // --- 2. ФИЛЬТРАЦИЯ ПО ИСТОЧНИКАМ И ПОИСКУ ---
    // Фильтр по выбранным тегам
    if (libraryState.selectedSources.length > 0) {
        books = books.filter(b => libraryState.selectedSources.includes(getDomainTag(b.url)));
    }

    // Фильтр по поиску
    if (libraryState.search) {
        books = books.filter(b => b.title.toLowerCase().includes(libraryState.search.toLowerCase()));
    }

    // --- 3. СОРТИРОВКА ---
    books.sort((a, b) => {
        const s = libraryState.sort;
        if (s === 'date_desc') return (b.updated || 0) - (a.updated || 0);
        if (s === 'date_asc') return (a.updated || 0) - (b.updated || 0);
        if (s === 'name') return a.title.localeCompare(b.title);
        if (s === 'count') return b.chapterCount - a.chapterCount;
        if (s === 'source') return getDomainTag(a.url).localeCompare(getDomainTag(b.url));
        return 0;
    });

    // --- 4. ПОДНЯТИЕ ТЕКУЩЕЙ КНИГИ (HIGHLIGHT) ---
    // Проверяем, определена ли текущая книга
    if (currentBookInfo && currentBookInfo.id) {
        const currentId = currentBookInfo.id;
        const idx = books.findIndex(b => b.id === currentId);

        // Если книга найдена в текущем списке
        if (idx > -1) {
            const [currentBook] = books.splice(idx, 1); // Вырезаем её
            books.unshift(currentBook); // Вставляем в самое начало
        }
    }

    // --- 5. РЕНДЕРИНГ СПИСКА ---
    list.innerHTML = '';
    if (books.length === 0) {
        list.innerHTML = '<li style="padding:10px;text-align:center;color:#999">Пусто</li>';
        return;
    }

    books.forEach(b => {
        const li = document.createElement('li');
        const domain = getDomainTag(b.url);

        // Определение, является ли этот сайт текущим (для кнопок действий)
        let isCurrentHost = false;
        try {
            const bookHostname = new URL(b.url).hostname;
            if (HOST.includes('syosetu.com') && bookHostname.includes('syosetu.com')) isCurrentHost = true;
            else isCurrentHost = HOST.includes(domain) || (HOST.includes('rulate.ru') && domain.includes('rulate'));
        } catch (e) { isCurrentHost = HOST.includes(domain); }

        // Проверка: является ли книга текущей открытой страницей
        const isActuallyCurrentBook = (currentBookInfo && currentBookInfo.id === b.id);

        // Классы CSS
        li.className = `bdp-saved-book-item ${!isCurrentHost ? 'disabled-item' : ''} ${isActuallyCurrentBook ? 'highlight-current' : ''}`;

        const bookmarkClass = b.isBookmarked ? 'bookmarked' : '';
        const bookmarkIcon = b.isBookmarked ? '⭐' : '☆';

        let actionsHTML = '';
        if (isCurrentHost) {
            actionsHTML = `<button class="bdp-action-btn btn-blue view-btn" data-id="${b.id}">Открыть</button><button class="bdp-action-btn btn-green dl-btn" data-id="${b.id}">TXT</button><button class="bdp-action-btn btn-yellow arc-btn" data-id="${b.id}">${b.isFinished ? 'Вернуть' : 'Архив'}</button><button class="bdp-action-btn btn-red del-btn" data-id="${b.id}">X</button>`;
        } else {
            actionsHTML = `<a href="${b.url}" target="_blank" class="bdp-action-btn btn-green" style="flex-grow:1;">Перейти на сайт</a>`;
        }

        li.innerHTML = `
            <div class="bdp-book-header">
                <a href="${b.url}" target="_blank" class="bdp-book-title">${b.title}</a>
                <span class="bdp-book-tag">${domain}</span>
                <button class="btn-icon btn-bookmark ${bookmarkClass}" data-id="${b.id}" title="Добавить в закладки">${bookmarkIcon}</button>
                <button class="btn-icon edit-title-btn" data-id="${b.id}" title="Изменить название">📝</button>
                <button class="btn-icon edit-url-btn" data-id="${b.id}" title="Править ссылку">✏️</button>
            </div>
            <div style="font-size:11px;color:#777; margin-bottom:5px;">Главы: ${b.chapterCount} | ID: ${b.id.replace('book_','')}</div>
            <div class="bdp-book-actions">${actionsHTML}</div>
        `;
        list.appendChild(li);
    });

    // Навешиваем события (как и было)
    list.querySelectorAll('.view-btn').forEach(b => b.onclick = viewBook);
    list.querySelectorAll('.dl-btn').forEach(b => b.onclick = downloadBook);
    list.querySelectorAll('.arc-btn').forEach(b => b.onclick = toggleArchive);
    list.querySelectorAll('.del-btn').forEach(b => b.onclick = deleteBook);
    list.querySelectorAll('.edit-url-btn').forEach(b => b.onclick = editUrl);
    list.querySelectorAll('.edit-title-btn').forEach(b => b.onclick = editTitle);
    list.querySelectorAll('.btn-bookmark').forEach(b => b.onclick = toggleBookmark);
}

let currentViewBookId = null;
let modalViewState = 'packs';
// --- НОВАЯ ЛОГИКА ДЕЛЕНИЯ ГЛАВ ---
function splitChapterSmartly(chapter, partIndex = 1) {
    const { splitEnabled, splitMaxChars, splitMinChars, splitUseSeparators, splitSeparators } = packSettings;
    const content = chapter.content || '';
    const totalLength = content.length;

    if (!splitEnabled || totalLength <= splitMaxChars) {
        return [chapter];
    }

    let splitPoint = -1;

    // --- Метод 1: По разделителям ---
    if (splitUseSeparators && splitSeparators.trim() !== '') {
        const separators = splitSeparators.split(',').map(s => s.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(s => s);
        if (separators.length > 0) {
            const regex = new RegExp(`\\n\\s*(${separators.join('|')})\\s*\\n`, 'g');
            let match;
            const possibleSplitPoints = [];
            while ((match = regex.exec(content)) !== null) {
                possibleSplitPoints.push(match.index + match[0].length);
            }

            // Ищем лучший разрыв: самый большой кусок < max, но > min, и чтобы остаток был > min
            let bestSplit = -1;
            for (const point of possibleSplitPoints.reverse()) { // Идем с конца, чтобы найти самый большой кусок
                if (point < splitMaxChars && (totalLength - point) >= splitMinChars) {
                    bestSplit = point;
                    break;
                }
            }
            splitPoint = bestSplit;
        }
    }

    // --- Метод 2: По абзацам (если разделители не сработали или отключены) ---
    if (splitPoint === -1) {
        const paragraphs = content.split(/(\n\s*\n)/); // сохраняем разделители
        let currentLength = 0;
        let bestSplit = -1;
        for (let i = 0; i < paragraphs.length; i++) {
            currentLength += paragraphs[i].length;
            if (currentLength > splitMaxChars) break; // Первый же кусок слишком большой
            if (currentLength >= splitMinChars && (totalLength - currentLength) >= splitMinChars) {
                 bestSplit = currentLength; // Нашли хороший разрыв между абзацами
            }
        }
         if (bestSplit !== -1) {
             splitPoint = content.indexOf(paragraphs.find(p => p.startsWith('\n')) , bestSplit);
         }
    }

    // --- Создаем разделенные части ---
    if (splitPoint > 0) {
        const part1Content = content.substring(0, splitPoint).trim();
        const part2Content = content.substring(splitPoint).trim();

        const chapterPart1 = { ...chapter, title: `${chapter.title.replace(/\s*\(\d+\)$/, '')} (${partIndex})`, content: part1Content };
        const remainingChapter = { ...chapter, content: part2Content };

        // Рекурсивно делим остаток
        const remainingParts = splitChapterSmartly(remainingChapter, partIndex + 1);

        return [chapterPart1, ...remainingParts];
    }

    // Если не удалось разделить, возвращаем как есть
    return [chapter];
}

async function viewBook(e) {
    const id = e.target.dataset.id;
    currentViewBookId = id;
    closeReaderView();
    switchModalView('packs');
    await refreshPacksUI();
    document.getElementById('bdp-modal-overlay').style.display = 'block';
}
async function renderChaptersView() {
    if (!currentViewBookId) return;
    const book = await db.get(currentViewBookId);
    const list = document.getElementById('bdp-chapter-list');
    const searchInput = document.getElementById('bdp-chapter-search-input');
    const searchTerm = searchInput.value.toLowerCase();
    list.innerHTML = '';

    const chapters = book.chapters.filter(ch => ch.title.toLowerCase().includes(searchTerm));

    if (chapters.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#777;">Главы не найдены</div>';
        return;
    }

    chapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'bdp-chapter-item';
        item.innerHTML = `
            <span class="bdp-chapter-title">${index + 1}. ${chapter.title}</span>
            <button class="bdp-pack-btn btn-read">Читать 👁️</button>
        `;
        item.querySelector('.btn-read').onclick = () => {
            openReaderView([chapter], chapter.title);
        };
        list.appendChild(item);
    });
}

// Функция переключения вида
function switchModalView(mode) {
    modalViewState = mode;
    const packsList = document.getElementById('bdp-pack-list');
    const chaptersList = document.getElementById('bdp-chapter-list');
    const toolbar = document.getElementById('bdp-tm-toolbar');
    const searchInput = document.getElementById('bdp-chapter-search-input');
    const packsBtn = document.getElementById('bdp-view-mode-packs');
    const chaptersBtn = document.getElementById('bdp-view-mode-chapters');

    const isPacks = mode === 'packs';
    packsList.style.display = isPacks ? 'block' : 'none';
    toolbar.style.display = isPacks ? 'flex' : 'none';
    chaptersList.style.display = isPacks ? 'none' : 'block';
    searchInput.style.display = isPacks ? 'none' : 'flex';

    packsBtn.classList.toggle('active', isPacks);
    chaptersBtn.classList.toggle('active', !isPacks);

    if (!isPacks) {
        renderChaptersView(); // Отрисовываем главы при переключении
    }
}

async function refreshPacksUI() {

    if (!currentViewBookId) return;
    if (modalViewState === 'chapters') {
        await renderChaptersView();
        return;
    }
    const b = await db.get(currentViewBookId);
    document.getElementById('bdp-modal-title').textContent = b.title;
    document.getElementById('bdp-tm-total-ch').textContent = b.chapters.length;
    const limit = packSettings.charLimit;
    const list = document.getElementById('bdp-pack-list');
    list.innerHTML = '';
    splitReportLog = []; // Очищаем лог

    if (!b.chapters || b.chapters.length === 0) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:#777;">Нет сохраненных глав</div>';
        return;
    }

    // --- Анализ статистики по книге ---
    let totalChars = 0, maxChars = 0, minChars = Infinity;
    b.chapters.forEach(ch => {
        const len = (ch.content || '').length;
        totalChars += len;
        if (len > maxChars) maxChars = len;
        if (len < minChars) minChars = len;
    });
    document.getElementById('bdp-tm-total-chars').textContent = formatNumber(totalChars);
    document.getElementById('bdp-tm-avg-chars').textContent = formatNumber(Math.round(totalChars / b.chapters.length));
    document.getElementById('bdp-tm-max-chars').textContent = formatNumber(maxChars);
    document.getElementById('bdp-tm-min-chars').textContent = formatNumber(minChars === Infinity ? 0 : minChars);


    // --- Обработка и деление глав ПЕРЕД созданием паков ---
    const processedChapters = [];
    b.chapters.forEach(ch => {
        const originalTitle = ch.title;
        if (ch.fixedPackId) {
            processedChapters.push(ch);
        } else {
            const parts = splitChapterSmartly(ch);
            if (parts.length > 1) {
                splitReportLog.push(`'${originalTitle}' разделена на ${parts.length} части.`);
            }
            processedChapters.push(...parts);
        }
    });


    const renderPackCard = (pack, startIdx, endIdx, isFixed) => { const isTranslated = isFixed || pack.every(c => c.isTranslated); const totalChars = pack.reduce((sum, c) => sum + (c.content?.length || 0) + (c.title?.length || 0), 0); const div = document.createElement('div'); div.className = `bdp-pack-card ${isTranslated ? 'translated' : ''}`; const icon = isFixed ? '🔒' : '📄'; const statusText = isFixed ? '<span style="color:#155724; font-weight:bold; margin-left:10px;">[ЗАФИКСИРОВАНО]</span>' : (isTranslated ? '<span style="color:#28a745; margin-left:10px;">✅ Переведено</span>' : ''); div.innerHTML = `<div class="bdp-pack-info"> <div class="bdp-pack-title">${icon} Главы ${startIdx + 1} — ${endIdx + 1}</div> <div class="bdp-pack-meta">Символов: ${formatNumber(totalChars)} | Глав: ${pack.length} ${statusText}</div></div><div class="bdp-pack-controls"><button class="bdp-pack-btn btn-read" title="Читать">👁️</button><button class="bdp-pack-btn btn-dl" title="Скачать пак">💾</button><button class="bdp-pack-btn btn-copy" title="Копировать">📋</button><button class="bdp-pack-btn btn-mark ${isTranslated?'active':''}">${isTranslated ? 'Снять' : 'Готово'}</button></div>`; div.querySelector('.btn-copy').onclick = () => { const text = pack.map(c => `${c.title}\n\n${c.content}`).join('\n\n\n'); GM_setClipboard(text); div.querySelector('.btn-copy').innerHTML = '✅'; setTimeout(() => div.querySelector('.btn-copy').innerHTML = '📋', 1500); }; div.querySelector('.btn-read').onclick = () => openReaderView(pack, `Главы ${startIdx + 1} — ${endIdx + 1}`); div.querySelector('.btn-dl').onclick = () => downloadPackText(pack, `${b.title}_pack_${startIdx+1}-${endIdx+1}`); div.querySelector('.btn-mark').onclick = async () => { const freshBook = await db.get(currentViewBookId); const newFixedId = isFixed ? null : Date.now().toString(); const newStatus = !isFixed; for (let i = startIdx; i <= endIdx; i++) { if (freshBook.chapters[i]) { freshBook.chapters[i].isTranslated = newStatus; freshBook.chapters[i].fixedPackId = newFixedId; } } await db.set(currentViewBookId, freshBook); refreshPacksUI(); }; list.appendChild(div); }; let currentPack = [], currentLen = 0, packStartIndex = 0, i = 0;
    // Используем processedChapters вместо b.chapters
    while (i < processedChapters.length) {
        const ch = processedChapters[i];
        if (ch.fixedPackId) { if (currentPack.length > 0) { renderPackCard(currentPack, packStartIndex, i - 1, false); currentPack = []; currentLen = 0; } const fixedId = ch.fixedPackId, fixedGroup = [], startFixedIndex = i; while (i < processedChapters.length && processedChapters[i].fixedPackId === fixedId) { fixedGroup.push(processedChapters[i]); i++; } renderPackCard(fixedGroup, startFixedIndex, i - 1, true); packStartIndex = i; } else { const chLen = (ch.content?.length || 0) + (ch.title?.length || 0); if (currentLen + chLen > limit && currentPack.length > 0) { renderPackCard(currentPack, packStartIndex, i - 1, false); currentPack = []; currentLen = 0; packStartIndex = i; } currentPack.push(ch); currentLen += chLen; i++; }
    }
    if (currentPack.length > 0) { renderPackCard(currentPack, packStartIndex, processedChapters.length - 1, false); }
}

function showSplitReport() {
    if (splitReportLog.length === 0) {
        alert('Отчет о делении глав:\n\nДеление глав не производилось.');
    } else {
        alert('Отчет о делении глав:\n\n' + splitReportLog.join('\n'));
    }
}


function openReaderView(pack, title) { document.getElementById('bdp-pack-list').style.display = 'none'; document.getElementById('bdp-tm-toolbar').style.display = 'none'; const container = document.getElementById('bdp-reader-container'); const content = document.getElementById('bdp-reader-content'); container.style.display = 'flex'; document.getElementById('bdp-reader-title').textContent = title; const text = pack.map(c => `<b>${c.title}</b>\n\n${c.content}`).join('\n\n<hr style="border:0; border-top:1px dashed #ccc; margin:30px 0;">\n\n'); content.innerHTML = text; }
function closeReaderView() { document.getElementById('bdp-reader-container').style.display = 'none'; document.getElementById('bdp-pack-list').style.display = 'block'; document.getElementById('bdp-tm-toolbar').style.display = 'flex'; }
function downloadPackText(pack, filename) { const txt = pack.map(c=>`${c.title}\n\n${c.content}`).join('\n\n--------------------\n\n'); const blob = new Blob([txt], {type:'text/plain'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${filename}.txt`; a.click(); }

async function downloadBook(e) { const b = await db.get(e.target.dataset.id); const txt = b.chapters.map(c=>`${c.title}\n\n${c.content}`).join('\n\n--------------------\n\n'); const blob = new Blob([`${b.title}\nСсылка: ${b.url}\n\n${txt}`], {type:'text/plain'}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${b.title}.txt`; a.click(); }
async function toggleArchive(e) { const id = e.target.dataset.id; const b = await db.get(id); b.isFinished = !b.isFinished; await db.set(id, b); await updateLibraryCache(b); renderLibrary(); }
async function toggleBookmark(e) { const id = e.target.dataset.id; const cache = await getLibraryCache(); if (cache[id]) { cache[id].isBookmarked = !cache[id].isBookmarked; await setLibraryCache(cache); renderLibrary(); } }
async function deleteBook(e) { const id = e.target.dataset.id; if(confirm(`Удалить книгу? [${id}]`)) { await db.del(id); await db.del('bdp_session_'+id); await removeFromLibraryCache(id); renderLibrary(); } }
async function editUrl(e) { const id = e.target.dataset.id; const b = await db.get(id); const cache = await getLibraryCache(); const currentUrl = b?.url || cache[id]?.url; const newUrl = prompt('Ссылка на оглавление:', currentUrl); if(newUrl) { if (b) { b.url = newUrl; await db.set(id, b); await updateLibraryCache(b); } else { if(cache[id]) { cache[id].url = newUrl; await setLibraryCache(cache); } } renderLibrary(); } }

  async function editTitle(e) {
    const id = e.target.dataset.id;
    const b = await db.get(id);
    const cache = await getLibraryCache();

    // Получаем текущее название (из базы или кэша)
    const currentTitle = b?.title || cache[id]?.title || "Без названия";

    const newTitle = prompt('Введите новое название книги:', currentTitle);

    if (newTitle && newTitle.trim() !== '') {
        const cleanTitle = newTitle.trim();

        // 1. Обновляем локальную базу, если она на этом сайте
        if (b) {
            b.title = cleanTitle;
            await db.set(id, b);
            await updateLibraryCache(b);
        } else {
            // 2. Иначе обновляем только общий кэш (для книг с других сайтов)
            if (cache[id]) {
                cache[id].title = cleanTitle;
                await setLibraryCache(cache);
            }
        }

        // 3. Обновляем заголовок в активной панели, если это текущая книга
        if (currentBookInfo && currentBookInfo.id === id) {
            currentBookInfo.title = cleanTitle;
            const infoTitleEl = document.getElementById('bdp-info-title');
            if(infoTitleEl) infoTitleEl.textContent = cleanTitle;
        }

        renderLibrary();
    }
}


if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

})();