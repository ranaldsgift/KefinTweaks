// Run: node --test tests/watchlist-hash-navigation.test.cjs
// Exercise the actual private functions with a fake API and DOM, without loading
// the injector or starting Jellyfin. These are isolated checks, not browser tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const utilsSource = fs.readFileSync(path.join(root, 'scripts/utils.js'), 'utf8');
const watchlistSource = fs.readFileSync(path.join(root, 'scripts/watchlist.js'), 'utf8');
const resolverStart = utilsSource.indexOf('    let _watchlistTabIndex = null;');
const resolverEnd = utilsSource.indexOf('    // ----- Custom pages', resolverStart);
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart, 'Watchlist URL resolver block not found');
const resolverCode = utilsSource.slice(resolverStart, resolverEnd);
const listenerCode = watchlistSource.match(/^([ \t]*)function setupHashChangeListener\(\) \{[\s\S]*?^\1\}/m)?.[0];
assert.ok(listenerCode, 'Watchlist hash-change listener not found');

const cases = [
    { name: 'internal page', hash: '#/watchlist', sync: true },
    { name: 'internal history pagination', hash: '#/watchlist?pageTab=history&page=2', sync: true },
    { name: 'internal progress', hash: '#/watchlist?pageTab=progress', sync: true },
    { name: 'internal statistics', hash: '#/watchlist?pageTab=statistics', sync: true },
    { name: 'Custom Tabs page', tabs: 1, hash: '#/home?tab=2', sync: true },
    { name: 'Custom Tabs history pagination', tabs: 1, hash: '#/home?tab=2&pageTab=history&page=2', sync: true },
    { name: 'Custom Tabs progress search', tabs: 1, hash: '#/home?tab=2&pageTab=progress&search=example', sync: true },
    { name: 'Custom Tabs reordered parameters', tabs: 1, hash: '#/home?pageTab=statistics&tab=2', sync: true },
    { name: 'different tab 20', tabs: 1, hash: '#/home?tab=20', sync: false },
    { name: 'different tab 3', tabs: 1, hash: '#/home?tab=3', sync: false },
    { name: 'home without selected tab', tabs: 1, hash: '#/home', sync: false },
    { name: 'unrelated search', tabs: 1, hash: '#/search?tab=2', sync: false },
    { name: 'second configured custom tab', tabs: 2, hash: '#/home?tab=3&pageTab=history', sync: true },
    { name: 'wrong first custom tab', tabs: 2, hash: '#/home?tab=2', sync: false },
    { name: 'Legacy Custom Tabs navigation', tabs: 1, modern: false, hash: '#/home?tab=2&pageTab=progress', sync: true },
    { name: 'Custom Tabs unavailable internal fallback', unavailable: true, hash: '#/watchlist?pageTab=history', sync: true },
    { name: 'different home-like route', tabs: 1, hash: '#/homebrew?tab=2', sync: false },
    { name: 'different watchlist-like route', hash: '#/watchlist-other', sync: false },
    { name: 'unresolved empty route', skipResolution: true, hash: '', sync: false },
    { name: 'unresolved Watchlist route', skipResolution: true, hash: '#/watchlist', sync: false }
];

for (const scenario of cases) {
    test(scenario.name, async () => {
        const result = { renders: 0, content: [], errors: [] };
        const buttons = new Map(['watchlist', 'history', 'progress', 'statistics'].map(tab => [tab, {
            active: false,
            classList: {
                add() { buttons.get(tab).active = true; },
                remove() { buttons.get(tab).active = false; }
            }
        }]));
        const contents = new Map([...buttons.keys()].map(tab => [tab, { style: { display: 'none' } }]));
        const section = {
            querySelectorAll(selector) {
                return selector.includes('button') ? [...buttons.values()] : [...contents.values()];
            },
            querySelector(selector) {
                const tab = selector.match(/data-tab="([^"]+)"/)?.[1];
                return selector.includes('button') ? buttons.get(tab) : contents.get(tab);
            }
        };
        const handlers = {};
        const watchlistTab = { ContentHtml: '<div class="sections watchlist"></div>' };
        const tabs = scenario.tabs === 2
            ? [{ ContentHtml: 'Requests' }, watchlistTab]
            : scenario.tabs === 1 ? [watchlistTab] : [];
        const context = vm.createContext({
            URLSearchParams,
            window: {
                location: { hash: scenario.hash },
                KefinTweaksUtils: { isModernUI: () => scenario.modern !== false },
                addEventListener(name, handler) { handlers[name] = handler; }
            },
            ApiClient: { _serverAddress: 'https://example.invalid' },
            getAuthHeader: () => '',
            fetch: async () => {
                if (scenario.unavailable) throw new Error('plugin unavailable');
                return { json: async () => tabs };
            },
            WARN: () => {},
            LOG: () => {},
            ERR: (...args) => result.errors.push(args[0]),
            renderWatchlist: async () => { result.renders++; },
            getUrlParams: () => Object.fromEntries(new URLSearchParams(scenario.hash.split('?')[1] || '')),
            getWatchlistSection: () => section,
            initProgressTab: async () => {},
            renderProgressContent: () => result.content.push('progress'),
            initHistoryTab: async () => {},
            renderHistoryContent: () => result.content.push('history'),
            initStatisticsTab: async () => {},
            renderStatisticsContent: () => result.content.push('statistics'),
            renderWatchlistContent: () => result.content.push('watchlist')
        });
        vm.runInContext(resolverCode + '\n' + listenerCode + '\nsetupHashChangeListener();', context, { timeout: 1000 });
        if (!scenario.skipResolution) {
            await vm.runInContext('getWatchlistUrl()', context, { timeout: 1000 });
            const expectedUrl = scenario.tabs ? `#/home?tab=${scenario.tabs + 1}` : '#/watchlist';
            assert.equal(context.window.KefinTweaksUtils._watchlistUrl, expectedUrl);
        }
        await handlers.hashchange();
        await Promise.resolve();
        assert.equal(result.renders, scenario.sync ? 1 : 0, 'Watchlist synchronization count');
        assert.deepEqual(result.errors, []);
        if (scenario.sync) {
            const tab = new URLSearchParams(scenario.hash.split('?')[1] || '').get('pageTab') || 'watchlist';
            assert.equal(buttons.get(tab).active, true, 'selected sub-tab button');
            assert.equal(contents.get(tab).style.display, 'block', 'selected sub-tab content');
            assert.deepEqual(result.content, [tab], 'selected sub-tab renderer');
        } else {
            assert.deepEqual(result.content, [], 'unrelated routes must not render sub-tab content');
        }
    });
}
