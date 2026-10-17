// Run: node --test tests/watchlist-panel-replacement.test.cjs
// Reproduce Custom Tabs replacing its panel while Watchlist queries are pending.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/watchlist.js'), 'utf8');
const render = source.match(/^\tasync function renderWatchlistProgressive\([^]*?^\t\}/m)?.[0];
assert.ok(render, 'Watchlist progressive renderer not found');

function fixture({ pauseRendering = false } = {}) {
    const original = { innerHTML: 'old content' };
    const replacement = { innerHTML: '' };
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    let releasePainting;
    const paintingReady = new Promise(resolve => { releasePainting = resolve; });
    let paintingStarted;
    const started = new Promise(resolve => { paintingStarted = resolve; });
    const state = { host: original, rendered: [], errors: [] };
    const context = vm.createContext({
        getWatchlistProgressiveHost: () => state.host,
        ERR: (...args) => state.errors.push(args[0]),
        LOG() {},
        WATCHLIST_SECTION_TYPES: [{ type: 'Movie', label: 'Movies' }],
        buildWatchlistProgressiveSection: async () => {
            await ready;
            return { itemType: 'Movie', result: { ensureData: async () => [{ Id: 'fixture-movie' }] } };
        },
        window: { cardBuilder: { renderProgressiveSections: async host => {
            state.rendered.push(host);
            paintingStarted();
            if (pauseRendering) await paintingReady;
        } } },
        resetWatchlistItemsByType() {},
        watchlistItemsByType: {},
        mergeLikedIdsFromItems() {},
        syncOverlayWatchlistButtons() {},
        updateWatchlistHeaderStats() {},
        hideEmptyWatchlistMessage() {},
        showEmptyWatchlistMessage() {}
    });
    const run = vm.runInContext('let watchlistRenderGeneration = 0;\n' + render + '\nrenderWatchlistProgressive;',
        context, { timeout: 1000 });
    return { state, original, replacement, release, run, started, releasePainting,
        supersede: () => vm.runInContext('watchlistRenderGeneration++;', context) };
}

test('query results render into the replacement panel rather than the removed panel', async () => {
    const f = fixture();
    const pending = f.run();
    f.state.host = f.replacement;
    f.release();
    await pending;
    assert.deepEqual(f.state.rendered, [f.replacement]);
    assert.equal(f.original.innerHTML, 'old content');
    assert.deepEqual(f.state.errors, []);
});

test('leaving Watchlist while queries are pending does not write into its removed panel', async () => {
    const f = fixture();
    const pending = f.run();
    f.state.host = null;
    f.release();
    await pending;
    assert.deepEqual(f.state.rendered, []);
    assert.equal(f.original.innerHTML, 'old content');
    assert.deepEqual(f.state.errors, []);
});

test('an unchanged panel still renders normally', async () => {
    const f = fixture();
    const pending = f.run();
    f.release();
    await pending;
    assert.deepEqual(f.state.rendered, [f.original]);
    assert.deepEqual(f.state.errors, []);
});

test('a panel replaced during progressive painting receives the same loaded sections', async () => {
    const f = fixture({ pauseRendering: true });
    const pending = f.run();
    f.release();
    await f.started;
    f.state.host = f.replacement;
    f.releasePainting();
    await pending;
    assert.deepEqual(f.state.rendered, [f.original, f.replacement]);
    assert.deepEqual(f.state.errors, []);
});

test('a superseded render does not repaint the replacement panel with its older results', async () => {
    const f = fixture({ pauseRendering: true });
    const pending = f.run();
    f.release();
    await f.started;
    f.state.host = f.replacement;
    f.supersede();
    f.releasePainting();
    await pending;
    assert.deepEqual(f.state.rendered, [f.original]);
    assert.deepEqual(f.state.errors, []);
});
