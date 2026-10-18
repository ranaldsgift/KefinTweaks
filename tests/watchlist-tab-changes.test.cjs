// Run: node --test tests/watchlist-tab-changes.test.cjs
// Exercise the actual URL resolver with changed Custom Tabs responses and
// navigation in one browser session. No Jellyfin server or browser is started.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/utils.js'), 'utf8');
const start = source.indexOf('    let _watchlistTabIndex = null;');
const end = source.indexOf('    // ----- Custom pages', start);
assert.ok(start >= 0 && end > start, 'Watchlist resolver block not found');
const resolver = source.slice(start, end);
const watchlist = { Id: 'watch123', ContentHtml: '<div class="sections watchlist"></div>' };
const other = { Id: 'other123', ContentHtml: '<p>Another tab</p>' };

function fixture({ tabs = [watchlist], hash = '#/home?tab=2', unavailable = false, deferred = false } = {}) {
    const state = { tabs, requests: [], unavailable };
    const window = {
        location: { hash },
        KefinTweaksUtils: { isModernUI: () => true }
    };
    const context = vm.createContext({
        window,
        ApiClient: { _serverAddress: 'https://fixture.invalid' },
        getAuthHeader: () => '',
        WARN() {},
        fetch: async () => {
            const snapshot = JSON.parse(JSON.stringify(state.tabs));
            const missing = state.unavailable;
            let release;
            const ready = new Promise(resolve => { release = resolve; });
            state.requests.push({ release });
            if (deferred) await ready;
            if (missing) throw new Error('Custom Tabs unavailable');
            return { json: async () => snapshot };
        }
    });
    vm.runInContext(resolver + '\nObject.assign(window.KefinTweaksUtils, { getWatchlistUrl, getWatchlistTabIndex });',
        context, { timeout: 1000 });
    return {
        state, window,
        url: options => window.KefinTweaksUtils.getWatchlistUrl(options),
        index: () => window.KefinTweaksUtils.getWatchlistTabIndex(),
        async visit(nextHash) {
            window.location.hash = nextHash;
            return this.url();
        }
    };
}

test('links retain the Custom Tabs stable ID when it is available', async () => {
    const f = fixture();
    assert.equal(await f.url({ stable: true }), '#/home?tab=2&ctTab=watch123');
    assert.equal(await f.index(), 2);
});

test('older Custom Tabs responses keep numeric links and cached reads', async () => {
    const f = fixture({ tabs: [{ ContentHtml: watchlist.ContentHtml }] });
    assert.equal(await f.url(), '#/home?tab=2');
    assert.equal(await f.url(), '#/home?tab=2');
    assert.equal(await f.index(), 2);
    assert.equal(f.state.requests.length, 1);
});

test('numeric-only Custom Tabs links also follow a changed position', async () => {
    const olderWatchlist = { ContentHtml: watchlist.ContentHtml };
    const f = fixture({ tabs: [olderWatchlist] });
    assert.equal(await f.url(), '#/home?tab=2');
    await f.visit('#/configurationpage?name=Custom%20Tabs');
    f.state.tabs = [other, olderWatchlist];
    assert.equal(await f.visit('#/home?tab=3'), '#/home?tab=3');
    assert.equal(await f.index(), 3);
});

test('rendering keeps its numeric URL even when menu shortcuts use stable IDs', async () => {
    const f = fixture();
    assert.equal(await f.url({ stable: true }), '#/home?tab=2&ctTab=watch123');
    assert.equal(await f.url(), '#/home?tab=2');
    assert.equal(f.window.KefinTweaksUtils._watchlistUrl, '#/home?tab=2');
    assert.equal(f.state.requests.length, 1);
});

test('repeated Home callbacks and sub-tab changes share the cached result', async () => {
    const f = fixture();
    const first = await f.url();
    assert.equal(await f.visit('#/home?tab=2&pageTab=history'), first);
    assert.equal(await f.visit('#/home?tab=2&pageTab=progress'), first);
    assert.equal(f.state.requests.length, 1);
});

for (const home of ['#/home', '#/home.html', '#/']) {
    test('Watchlist follows a reorder on returning to ' + home, async () => {
        const f = fixture();
        await f.url();
        await f.visit('#/configurationpage?name=Custom%20Tabs');
        f.state.tabs = [other, watchlist];
        assert.equal(await f.visit(home + '?tab=3&ctTab=watch123'), '#/home?tab=3');
        assert.equal(await f.url({ stable: true }), '#/home?tab=3&ctTab=watch123');
        assert.equal(await f.index(), 3);
        assert.equal(f.state.requests.length, 2);
    });
}

test('removing the preceding tab refreshes the URL and numeric index together', async () => {
    const f = fixture({ tabs: [other, watchlist], hash: '#/home?tab=3' });
    await f.url();
    await f.visit('#/configurationpage?name=Custom%20Tabs');
    f.state.tabs = [watchlist];
    assert.equal(await f.visit('#/home?tab=2&ctTab=watch123'), '#/home?tab=2');
    assert.equal(await f.index(), 2);
});

test('a regular viewer also sees changes made by an administrator elsewhere', async () => {
    const f = fixture();
    await f.url();
    await f.visit('#/details?id=fixture');
    f.state.tabs = [other, watchlist];
    assert.equal(await f.visit('#/home?tab=3&ctTab=watch123'), '#/home?tab=3');
    assert.equal(f.state.requests.length, 2);
});

test('removing Watchlist selects the internal fallback on the next Home visit', async () => {
    const f = fixture();
    await f.url();
    await f.visit('#/configurationpage?name=Custom%20Tabs');
    f.state.tabs = [other];
    assert.equal(await f.visit('#/home'), '#/watchlist');
    assert.equal(await f.index(), null);
});

test('adding Watchlist after an internal fallback is detected without a reload', async () => {
    const f = fixture({ tabs: [] });
    assert.equal(await f.url(), '#/watchlist');
    await f.visit('#/details?id=fixture');
    f.state.tabs = [watchlist];
    assert.equal(await f.visit('#/home?tab=2'), '#/home?tab=2');
});

test('an unavailable plugin keeps the fallback and can recover on a later Home visit', async () => {
    const f = fixture({ unavailable: true });
    assert.equal(await f.url(), '#/watchlist');
    await f.visit('#/details?id=fixture');
    f.state.unavailable = false;
    assert.equal(await f.visit('#/home?tab=2'), '#/home?tab=2');
});

test('simultaneous callers share one configuration request', async () => {
    const f = fixture({ deferred: true });
    const calls = [f.url(), f.url(), f.index()];
    assert.equal(f.state.requests.length, 1);
    f.state.requests.forEach(request => request.release());
    const [a, b, index] = await Promise.all(calls);
    assert.equal(a, '#/home?tab=2');
    assert.equal(b, a);
    assert.equal(index, 2);
});

test('an earlier response cannot overwrite a later Home visit', async () => {
    const f = fixture({ deferred: true });
    const first = f.url();
    const away = f.visit('#/details?id=fixture');
    f.state.tabs = [other, watchlist];
    const current = f.visit('#/home?tab=3&ctTab=watch123');
    f.state.requests.at(-1).release();
    await current;
    for (const request of f.state.requests) request.release();
    await Promise.all([first, away]);
    assert.equal(f.window.KefinTweaksUtils._watchlistUrl, '#/home?tab=3');
    assert.equal(await f.url({ stable: true }), '#/home?tab=3&ctTab=watch123');
    assert.equal(await f.index(), 3);
});

test('stable IDs are encoded as one query parameter', async () => {
    const f = fixture({ tabs: [{ ...watchlist, Id: 'id with & symbols' }] });
    assert.equal(await f.url({ stable: true }), '#/home?tab=2&ctTab=id%20with%20%26%20symbols');
});
