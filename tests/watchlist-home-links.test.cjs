// Run: node --test tests/watchlist-home-links.test.cjs
// Use the actual resolver and section module with delayed, fake Custom Tabs responses.
// These isolated checks do not start Jellyfin or exercise a browser layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const utilsSource = fs.readFileSync(path.join(root, 'scripts/utils.js'), 'utf8');
const sectionSource = fs.readFileSync(path.join(root, 'scripts/sectionHelper.js'), 'utf8');
const resolverStart = utilsSource.indexOf('    let _watchlistTabIndex = null;');
const resolverEnd = utilsSource.indexOf('    // ----- Custom pages', resolverStart);
assert.ok(resolverStart >= 0 && resolverEnd > resolverStart, 'Watchlist URL resolver block not found');
const resolverCode = utilsSource.slice(resolverStart, resolverEnd);

const cases = [];
for (const layout of ['modern', 'legacy', 'tv']) {
    for (const warm of [false, true]) {
        cases.push({ name: `${layout}: configured tab with ${warm ? 'ready' : 'pending'} configuration`, layout, warm });
    }
}
for (const layout of ['modern', 'legacy']) {
    for (const unavailable of [false, true]) {
        cases.push({ name: `${layout}: ${unavailable ? 'missing plugin' : 'no Watchlist tab'} uses the internal fallback`,
            layout, noTabs: true, unavailable });
    }
}
for (const warm of [false, true]) {
    cases.push({ name: `Watch Again: configured tab with ${warm ? 'ready' : 'pending'} configuration`,
        layout: 'modern', warm, history: true });
}
cases.push({ name: 'Watch Again: internal fallback', layout: 'modern', history: true, noTabs: true });
cases.push({ name: 'explicit section URL remains authoritative', layout: 'modern', override: '#/my-custom-link' });
cases.push({ name: 'a later Custom Tab retains its index', layout: 'modern', tabIndex: 3 });
cases.push({ name: 'Watch Again retains a later Custom Tab index', layout: 'modern', tabIndex: 3, warm: true, history: true });

for (const scenario of cases) {
    test(scenario.name, async () => {
        const tabIndex = scenario.tabIndex || 2;
        const expectedMenu = scenario.noTabs ? '#/watchlist' : `#/home?tab=${tabIndex}`;
        const expectedUrl = new URL(expectedMenu.slice(1), 'https://fixture.invalid');
        if (scenario.history) expectedUrl.searchParams.set('pageTab', 'history');
        const expectedHome = scenario.override || `#${expectedUrl.pathname}${expectedUrl.search}`;

        let releaseConfig;
        const configReady = new Promise(resolve => { releaseConfig = resolve; });
        let requests = 0;
        const utils = { isModernUI: () => scenario.layout === 'modern' };
        if (scenario.warm) utils._watchlistUrl = expectedMenu;
        const window = { KefinTweaksUtils: utils, addEventListener() {} };
        const api = { _serverAddress: 'https://fixture.invalid', serverId: () => 'fixture-server' };
        const tabs = Array.from({ length: tabIndex - 2 }, () => ({ ContentHtml: 'Other tab' }));
        tabs.push({ ContentHtml: '<div class="sections watchlist"></div>' });
        const context = vm.createContext({
            window, ApiClient: api, console: { log() {}, warn() {}, error() {} },
            getAuthHeader: () => '', WARN() {},
            fetch: async () => {
                requests++;
                await configReady;
                return {
                    ok: !scenario.unavailable,
                    status: scenario.unavailable ? 404 : 200,
                    json: async () => {
                        if (scenario.unavailable) throw new SyntaxError('Fixture empty 404 response');
                        return scenario.noTabs ? [] : tabs;
                    }
                };
            }
        });
        vm.runInContext(resolverCode + '\nwindow.KefinTweaksUtils.getWatchlistUrl = getWatchlistUrl;', context, { timeout: 1000 });
        vm.runInContext(sectionSource, context, { timeout: 1000 });

        const config = { id: scenario.history ? 'watchAgain' : 'watchlist' };
        if (scenario.override) config.viewMoreUrl = scenario.override;
        let homeSettled = false;
        const homePromise = window.sectionHelper.resolveViewMoreUrl(config).then(url => {
            homeSettled = true;
            return url;
        });
        const menuPromise = utils.getWatchlistUrl();
        await new Promise(resolve => setImmediate(resolve));
        const settledBeforeConfig = homeSettled;
        releaseConfig();
        const [home, menu] = await Promise.all([homePromise, menuPromise]);

        assert.equal(menu, expectedMenu, 'menu follows Custom Tabs-first routing');
        assert.equal(home, expectedHome, 'home link uses the same destination and correct sub-tab');
        if (!scenario.warm && !scenario.noTabs && !scenario.override) {
            assert.equal(settledBeforeConfig, false, 'home waits for unresolved Custom Tabs configuration');
        }
        if (scenario.warm) assert.equal(requests, 0, 'cached URLs avoid another configuration request');
        if (scenario.history) {
            const params = new URLSearchParams(home.split('?')[1] || '');
            assert.equal(params.get('pageTab'), 'history', 'history is a separate query parameter');
            assert.equal(params.get('tab'), scenario.noTabs ? null : String(tabIndex), 'Custom Tab index is preserved');
        }
    });
}
