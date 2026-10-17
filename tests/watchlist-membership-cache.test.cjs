// Run: node --test tests/watchlist-membership-cache.test.cjs
// Load the real API helper and Watchlist query/membership functions. The server,
// persistent cache and absent Watchlist panel are controlled by the fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scripts = path.join(__dirname, '../scripts');
const apiSource = fs.readFileSync(path.join(scripts, 'apiHelper.js'), 'utf8');
const watchlistSource = fs.readFileSync(path.join(scripts, 'watchlist.js'), 'utf8');
function extract(name, optional = false) {
    const result = watchlistSource.match(new RegExp('^\\t(?:async )?function ' + name + '\\([^]*?^\\t\\}', 'm'))?.[0];
    if (!optional) assert.ok(result, name + ' not found');
    return result || '';
}
const functions = [
    extract('getWatchlistQueryOptions', true),
    extract('postProcessWatchlistItems'),
    extract('buildWatchlistProgressiveSection'),
    extract('invalidateAllWatchlistQueries'),
    extract('updateWatchlistCacheOnToggle')
].join('\n');

function fixture(cacheLayer) {
    const database = new Map();
    const server = new Map();
    const calls = [];
    const errors = [];
    const api = {
        serverAddress: () => 'https://example.invalid',
        getCurrentUserId: () => 'test-user',
        accessToken: () => null,
        deviceId: () => 'test-device'
    };
    const context = vm.createContext({
        window: {
            ApiClient: api,
            userHelper: { waitForLogin: () => new Promise(() => {}) },
            IndexedDBCache: {
                getCacheEntry: async key => database.get(key) || null,
                set: async (key, payload, unused, ttl) => database.set(key, {
                    payload, timestamp: Date.now(), ttl
                }),
                clear: async key => database.delete(key)
            }
        },
        ApiClient: api,
        navigator: { userAgent: 'Chrome' },
        localStorage: { getItem: () => null },
        console: { log() {}, warn() {}, error() {} },
        URL, URLSearchParams,
        fetch: async url => {
            const type = new URL(url).searchParams.get('IncludeItemTypes');
            calls.push(type);
            return { ok: true, json: async () => ({ Items: structuredClone(server.get(type) || []) }) };
        },
        WATCHLIST_CACHE_TTL: 300000,
        WATCHLIST_SECTION_TYPES: ['Movie', 'Series'].map(type => ({ type })),
        LOG() {},
        ERR: (...args) => errors.push(args),
        getWatchlistSection: () => null,
        setLikedIdInCache() {},
        syncOverlayWatchlistButtons() {},
        tabStates: { watchlist: { isDataFetched: false } },
        initWatchlistTab: async () => { throw new Error('Off-page mutation should defer rendering'); }
    });
    function loadApi() { vm.runInContext(apiSource, context, { timeout: 1000 }); }
    loadApi();
    vm.runInContext(functions, context, { timeout: 1000 });
    return {
        server, calls, errors,
        async read(type) {
            const section = await context.buildWatchlistProgressiveSection(type, type, 0);
            return Array.from(await section.result.ensureData(), item => item.Id);
        },
        coldMemory() { if (cacheLayer === 'IndexedDB') loadApi(); },
        toggle: (type, added) => context.updateWatchlistCacheOnToggle('fixture-item', type, added),
        invalidateAll: () => context.invalidateAllWatchlistQueries()
    };
}

for (const layer of ['memory', 'IndexedDB']) {
    for (const [type, label] of [['Movie', 'movie'], ['Series', 'finished series']]) {
        test(`${label} removed off-page is absent on return with ${layer} cache`, async () => {
            const f = fixture(layer);
            f.server.set(type, [{ Id: 'fixture-item' }]);
            assert.deepEqual(await f.read(type), ['fixture-item']);
            f.coldMemory();
            f.server.set(type, []);
            await f.toggle(type, false);
            assert.deepEqual(await f.read(type), []);
            assert.equal(f.calls.length, 2, 'return must query the updated membership');
            assert.deepEqual(f.errors, []);
        });
    }

    test(`adding an item off-page updates a previously empty ${layer} result`, async () => {
        const f = fixture(layer);
        assert.deepEqual(await f.read('Movie'), []);
        f.coldMemory();
        f.server.set('Movie', [{ Id: 'fixture-item' }]);
        await f.toggle('Movie', true);
        assert.deepEqual(await f.read('Movie'), ['fixture-item']);
        assert.equal(f.calls.length, 2);
        assert.deepEqual(f.errors, []);
    });

    test(`movie membership changes preserve the unrelated series ${layer} cache`, async () => {
        const f = fixture(layer);
        f.server.set('Movie', [{ Id: 'fixture-item' }]);
        f.server.set('Series', [{ Id: 'series' }]);
        await f.read('Movie');
        await f.read('Series');
        f.coldMemory();
        f.server.set('Movie', []);
        await f.toggle('Movie', false);
        assert.deepEqual(await f.read('Series'), ['series']);
        assert.deepEqual(await f.read('Movie'), []);
        assert.deepEqual(f.calls, ['Movie', 'Series', 'Movie']);
        assert.deepEqual(f.errors, []);
    });

    test(`full invalidation clears the rendered movie and series ${layer} queries`, async () => {
        const f = fixture(layer);
        for (const type of ['Movie', 'Series']) {
            f.server.set(type, [{ Id: type }]);
            await f.read(type);
            f.server.set(type, []);
        }
        f.coldMemory();
        await f.invalidateAll();
        assert.deepEqual(await f.read('Movie'), []);
        assert.deepEqual(await f.read('Series'), []);
        assert.equal(f.calls.length, 4);
    });
}
