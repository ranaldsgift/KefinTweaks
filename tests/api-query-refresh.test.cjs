// Run: node --test tests/api-query-refresh.test.cjs
// Load the real API helper; only the server and browser cache are faked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/apiHelper.js'), 'utf8');
const url = 'https://example.invalid/Users/test-user/Items?Filters=Likes';
const oldData = { Items: [{ Id: 'old' }] };
const freshData = { Items: [{ Id: 'old' }, { Id: 'new' }] };

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function fixture(entry) {
    const entries = new Map(entry ? [[url, entry]] : []);
    const started = deferred();
    const network = deferred();
    let requests = 0;
    let warming = false;
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
                getCacheEntry: async key => entries.get(key) || null,
                set: async (key, payload, unused, ttl) => {
                    entries.set(key, { payload, timestamp: Date.now(), ttl });
                },
                clear: async key => entries.delete(key)
            }
        },
        ApiClient: api,
        navigator: { userAgent: 'Chrome' },
        localStorage: { getItem: () => null },
        console: { log() {}, warn() {}, error() {} },
        URL, URLSearchParams,
        fetch: async requestedUrl => {
            assert.equal(requestedUrl, url);
            requests++;
            if (warming) return { ok: true, json: async () => oldData };
            started.resolve();
            const data = await network.promise;
            return { ok: true, json: async () => data };
        }
    });
    vm.runInContext(source, context, { timeout: 1000 });
    return {
        helper: context.window.apiHelper,
        started: started.promise,
        network,
        requests: () => requests,
        async warmMemory() {
            warming = true;
            await this.helper.getQuery(url);
            warming = false;
        }
    };
}

for (const cache of ['memory', 'IndexedDB']) {
    test(`forced refresh waits for the server with ${cache} data available`, async () => {
        const f = fixture(cache === 'IndexedDB'
            ? { payload: oldData, timestamp: Date.now(), ttl: 300000 } : null);
        if (cache === 'memory') await f.warmMemory();
        const result = await f.helper.getQuery(url, { useCache: true, forceRefresh: true });
        let settled = false;
        const pending = result.ensureData().then(data => { settled = true; return data; });
        await f.started;
        await new Promise(resolve => setImmediate(resolve));
        const settledBeforeServer = settled;
        f.network.resolve(freshData);
        assert.deepEqual(await pending, freshData);
        assert.equal(settledBeforeServer, false, 'refresh must not complete with cached items');
    });
}

for (const [name, response] of [
    ['empty result', { Items: [] }],
    ['array response', [{ Id: 'new' }]]
]) {
    test(`forced refresh returns the server's ${name}`, async () => {
        const f = fixture({ payload: oldData, timestamp: Date.now(), ttl: 300000 });
        const result = await f.helper.getQuery(url, { useCache: true, forceRefresh: true });
        const pending = result.dataPromise;
        await f.started;
        f.network.resolve(response);
        assert.deepEqual(await pending, response);
    });
}

test('forced refresh reports a failed request instead of succeeding with cached items', async () => {
    const f = fixture({ payload: oldData, timestamp: Date.now(), ttl: 300000 });
    const raw = f.helper.getQuery(url, { useCache: true, forceRefresh: true });
    const result = await raw;
    const pending = result.ensureData();
    await f.started;
    // On the old implementation a detached background refresh rejects here.
    if (raw._refreshPromise) raw._refreshPromise.catch(() => {});
    const check = assert.rejects(pending, /server unavailable/);
    f.network.reject(new Error('server unavailable'));
    await check;
});

test('a valid ordinary cache hit does not request the server', async () => {
    const f = fixture({ payload: oldData, timestamp: Date.now(), ttl: 300000 });
    const result = await f.helper.getQuery(url, { useCache: true, ttl: 300000 });
    assert.deepEqual(await result.ensureData(), oldData);
    assert.equal(f.requests(), 0);
});

test('an expired ordinary query can still return cached items while refreshing', async () => {
    const f = fixture({ payload: oldData, timestamp: Date.now() - 600000, ttl: 300000 });
    const raw = f.helper.getQuery(url, { useCache: true, ttl: 300000 });
    const result = await raw;
    const pending = result.ensureData();
    await f.started;
    assert.deepEqual(await pending, oldData);
    assert.equal(f.requests(), 1);
    f.network.resolve(freshData);
    assert.deepEqual(await raw._refreshPromise, freshData);
});

test('a cold ordinary query waits for server data', async () => {
    const f = fixture();
    const result = await f.helper.getQuery(url, { useCache: true });
    const pending = result.ensureData();
    await f.started;
    f.network.resolve(freshData);
    assert.deepEqual(await pending, freshData);
});
