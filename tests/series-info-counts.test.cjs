// Run: node --test tests/series-info-counts.test.cjs
// Exercise the real module and query helper with fake responses and DOM-shaped
// elements. These isolated checks do not change a Jellyfin installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const seriesSource = fs.readFileSync(path.join(root, 'scripts/seriesInfo.js'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'scripts/apiHelper.js'), 'utf8');
const queryStart = apiSource.indexOf('        getQuery: function(');
const queryEnd = apiSource.indexOf('        invalidateCache: function(', queryStart);
assert.ok(queryStart >= 0 && queryEnd > queryStart, 'Query helper not found');
const queryCode = apiSource.slice(queryStart, queryEnd).trim().replace(/,$/, '');
const moduleCode = seriesSource.replace(/\}\)\(\);\s*$/, `
    window.testSeriesInfo = { getSeasonsCount, getEpisodesCount, addSeriesInfo, addSeasonInfo };
})();`);
assert.notEqual(moduleCode, seriesSource, 'Module test entry point not inserted');

class Element {
    constructor(className = '', textContent = '') {
        this.className = className;
        this.textContent = textContent;
        this.dataset = {};
        this.style = {};
        this.children = [];
        this.classList = { contains: () => false, remove() {} };
    }
    appendChild(child) {
        child.parent = this;
        this.children.push(child);
    }
    remove() {
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    querySelectorAll(selector) {
        const name = selector.slice(1);
        return this.children.filter(child => child.className.split(' ').includes(name));
    }
    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }
}

function fixture({ seasons = [], episodes = [], staleSeasons, staleEpisodes } = {}) {
    const current = { Seasons: seasons, Episodes: episodes };
    const stale = { Seasons: staleSeasons, Episodes: staleEpisodes };
    const requests = [];
    const persisted = new Map();
    const runtimeRows = [];
    const endpoint = url => url.endsWith('/Seasons') ? 'Seasons' : 'Episodes';
    const runtimeList = { querySelectorAll: () => runtimeRows };
    const activePage = {
        querySelector: () => ({ querySelector: () => runtimeList })
    };
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        LOG() {}, WARN() {}, ERR() {},
        ensureApiClient() {}, getCachedQuery() { return null; }, setCachedQuery() {},
        getAuthHeader() { return 'fixture'; },
        ApiClient: { serverAddress: () => 'https://example.invalid' },
        fetch: async url => {
            requests.push(endpoint(url));
            return { ok: true, json: async () => ({ Items: current[endpoint(url)] }) };
        },
        window: {
            KefinTweaksUtils: { onViewPage() {} },
            IndexedDBCache: {
                async getCacheEntry(url) {
                    const rows = stale[endpoint(url)];
                    return rows ? { payload: { Items: rows }, timestamp: Date.now() - 3600000, ttl: 60000 } : null;
                },
                async set(url, data) { persisted.set(endpoint(url), data); }
            }
        },
        document: { createElement: () => new Element() }
    });
    vm.runInContext('const apiHelper = {' + queryCode + '};\n' + moduleCode, context, { timeout: 1000 });
    return {
        api: context.window.testSeriesInfo, current, requests, persisted, activePage,
        setRuntimes(values) {
            runtimeRows.splice(0, runtimeRows.length, ...values.map(text => ({
                querySelector: () => ({ querySelector: () => ({ textContent: text }) })
            })));
        }
    };
}

const regularSeasons = [1, 2, 3, 4].map(IndexNumber => ({ IndexNumber }));
const episode = (ParentIndexNumber, IndexNumber = 1, IndexNumberEnd) => ({ ParentIndexNumber, IndexNumber, IndexNumberEnd });
const series = { Id: 'show', ChildCount: 5, RecursiveItemCount: 76 };
const texts = container => container.children.flatMap(child => child.children.length
    ? child.children.map(node => node.textContent) : [child.textContent]);

test('expired season and episode data cannot supply the series header counts', async () => {
    const f = fixture({
        seasons: [{ IndexNumber: 0 }, ...regularSeasons],
        episodes: [episode(0), episode(1), episode(2, 19, 20)],
        staleSeasons: [{ IndexNumber: 0 }, { IndexNumber: 1 }],
        staleEpisodes: [episode(1)]
    });
    const container = new Element();
    await f.api.addSeriesInfo(series, container);
    assert.deepEqual(texts(container), ['4 Seasons', '2 Episodes']);
    assert.deepEqual(f.requests, ['Seasons', 'Episodes']);
    assert.equal(f.persisted.get('Episodes').Items.length, 3);
});

test('revisiting the same series container refreshes counts without duplicate or native-label removal', async () => {
    const f = fixture({ seasons: regularSeasons, episodes: [episode(1)] });
    const container = new Element();
    const native = new Element('mediaInfoItem', '2014');
    container.appendChild(native);
    await f.api.addSeriesInfo(series, container);
    assert.deepEqual(texts(container), ['2014', '4 Seasons', '1 Episode']);
    f.current.Seasons = [{ IndexNumber: 1 }, { IndexNumber: 2 }];
    f.current.Episodes = [episode(1), episode(2)];
    await f.api.addSeriesInfo(series, container);
    assert.deepEqual(texts(container), ['2014', '2 Seasons', '2 Episodes']);
    assert.equal(container.children[0], native);
    assert.deepEqual(f.requests, ['Seasons', 'Episodes', 'Seasons', 'Episodes']);
});

test('revisiting Specials refreshes its count and replaces only the owned season information', async () => {
    const f = fixture({ episodes: [episode(0), episode(0), episode(1)] });
    const item = { SeriesId: 'show', IndexNumber: 0 };
    const container = new Element();
    const native = new Element('mediaInfoItem', 'English');
    container.appendChild(native);
    f.setRuntimes(['22m', '44m']);
    await f.api.addSeasonInfo(item, container, f.activePage);
    assert.equal(texts(container)[1], '2 Episodes');
    assert.match(texts(container)[2], /^Ends at /);
    f.current.Episodes = [episode(0), episode(1)];
    await f.api.addSeasonInfo(item, container, f.activePage);
    assert.equal(texts(container)[1], '1 Episode');
    assert.match(texts(container)[2], /^Ends at /);
    assert.equal(container.children.length, 2);
    assert.equal(container.children[0], native);
    assert.deepEqual(f.requests, ['Episodes', 'Episodes']);
});

test('successive count queries see additions and removals for the same series', async () => {
    const f = fixture({ episodes: [episode(1)] });
    assert.equal(await f.api.getEpisodesCount('show'), 1);
    f.current.Episodes = [episode(1), episode(2)];
    assert.equal(await f.api.getEpisodesCount('show'), 2);
    f.current.Episodes = [];
    assert.equal(await f.api.getEpisodesCount('show'), 0);
});

test('specials exclusion, season selection and combined-file counting keep their existing meaning', async () => {
    const f = fixture({
        seasons: [{ IndexNumber: 0 }, ...regularSeasons],
        episodes: [episode(0), episode(0, 2), episode(1), episode(2, 19, 20), episode(4, 15, 16)]
    });
    assert.equal(await f.api.getSeasonsCount(series), 4);
    assert.equal(await f.api.getSeasonsCount(series, true), 5);
    assert.equal(await f.api.getEpisodesCount('show'), 3);
    assert.equal(await f.api.getEpisodesCount('show', null, true), 5);
    assert.equal(await f.api.getEpisodesCount('show', 0), 2);
    assert.equal(await f.api.getEpisodesCount('show', 2), 1);
    assert.equal(await f.api.getEpisodesCount('show', 3), 0);
});

test('an empty season list and episode list return zero counts', async () => {
    const f = fixture();
    assert.equal(await f.api.getSeasonsCount(series), 0);
    assert.equal(await f.api.getEpisodesCount('show'), 0);
    assert.equal(await f.api.getEpisodesCount('show', 0), 0);
});
