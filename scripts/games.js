// KefinTweaks Games
// Hosts Games hub + Movie LUT + 3x3 via addCustomPage
// Requires: utils.js

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks Games]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Games]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks Games]', ...args);

    LOG('Script loaded');

    function getRoot() {
        const raw = window.KefinTweaksConfig?.kefinTweaksRoot;
        if (!raw) return null;
        return raw.endsWith('/') ? raw : `${raw}/`;
    }

    /**
     * Build custom-page HTML from a full document: styles + head scripts + body
     * (scripts kept). Rewrites `body {` to a scope class for non-full-page host.
     */
    function buildContentHtmlFromDocument(htmlString, scopeClass) {
        const doc = new DOMParser().parseFromString(htmlString, 'text/html');
        const chunks = [];

        doc.querySelectorAll('style').forEach((el) => {
            let css = el.textContent || '';
            if (scopeClass) {
                css = css.replace(/(^|})\s*body\s*\{/g, `$1.${scopeClass}{`);
            }
            chunks.push(`<style>${css}</style>`);
        });

        doc.head.querySelectorAll('script').forEach((el) => {
            chunks.push(el.outerHTML);
        });

        const wrap = document.createElement('div');
        const bodyClass = (doc.body && doc.body.className) || '';
        wrap.className = [scopeClass, bodyClass].filter(Boolean).join(' ').trim();

        Array.from(doc.body.childNodes).forEach((node) => {
            if (node.nodeName === 'STYLE') return;
            wrap.appendChild(node.cloneNode(true));
        });
        chunks.push(wrap.outerHTML);

        return chunks.join('\n');
    }

    async function fetchPageHtml(root, relativePath) {
        const url = `${root}${relativePath.replace(/^\//, '')}`;
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) {
            throw new Error(`Failed to fetch ${url}: ${res.status}`);
        }
        return res.text();
    }

    async function registerGamesPages() {
        const utils = window.KefinTweaksUtils;
        if (!utils?.addCustomMenuLink || !utils?.addCustomPage) {
            ERR('addCustomMenuLink / addCustomPage not available');
            return false;
        }

        const root = getRoot();
        if (!root) {
            WARN('kefinTweaksRoot not configured; cannot register Games pages');
            return false;
        }

        try {
            const [gamesRaw, movieLutRaw, threeRaw] = await Promise.all([
                fetchPageHtml(root, 'pages/games.html'),
                fetchPageHtml(root, 'pages/movieLut.html'),
                fetchPageHtml(root, 'pages/3x3.html'),
            ]);

            const gamesHtml = buildContentHtmlFromDocument(gamesRaw, 'kefin-custom-page-games');
            const movieLutHtml = buildContentHtmlFromDocument(movieLutRaw, 'kefin-custom-page-movielut');
            const threeByThreeHtml = buildContentHtmlFromDocument(threeRaw, 'kefin-custom-page-3x3');

            utils.addCustomPage('#/games', 'Games', gamesHtml);
            utils.addCustomPage('#/movieLut', 'Movie LUT', movieLutHtml);
            utils.addCustomPage('#/3x3', '3x3', threeByThreeHtml);

            const ok = await utils.addCustomMenuLink('Games', 'sports_esports', '#/games', false);
            if (ok) LOG('Games menu link + custom pages registered');
            else WARN('Custom pages registered but menu link failed');
            return !!ok;
        } catch (e) {
            ERR('Error registering Games pages:', e);
            return false;
        }
    }

    function waitForUtilsAndInitialize() {
        const ready = () =>
            window.KefinTweaksUtils?.addCustomMenuLink && window.KefinTweaksUtils?.addCustomPage;

        if (ready()) {
            registerGamesPages();
            return;
        }

        LOG('Waiting for KefinTweaksUtils…');
        const checkInterval = setInterval(() => {
            if (ready()) {
                clearInterval(checkInterval);
                registerGamesPages();
            }
        }, 100);

        setTimeout(() => {
            clearInterval(checkInterval);
            if (!ready()) {
                WARN('KefinTweaksUtils not available after 10 seconds');
            }
        }, 10000);
    }

    waitForUtilsAndInitialize();
})();
