// Run: node --test tests/watchlist-detail-visibility.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/watchlist.js'), 'utf8');
const start = source.indexOf('\tfunction getVisiblePlayButton()');
const end = source.indexOf('\t// Function to add watchlist button to item detail page', start);
assert.ok(start >= 0 && end > start, 'detail visibility functions exist');
const visibilitySource = source.slice(start, end);

function fixture({ play = 'hidden', hidden = true, connected = true, host = true } = {}) {
    let writes = 0;
    let queries = 0;
    const pending = new Set();
    const observers = [];
    const tokens = new Set(hidden ? ['hide'] : []);
    const changed = () => observers.filter(observer => observer.active).forEach(observer => pending.add(observer));
    const write = () => { writes++; changed(); };
    const icon = {
        isConnected: connected,
        classList: {
            contains: token => tokens.has(token),
            // DOMTokenList.add/remove run their update steps even when membership
            // is unchanged. Forced toggle skips that write when already correct.
            // https://dom.spec.whatwg.org/#interface-domtokenlist
            add(token) { tokens.add(token); write(); },
            remove(token) { tokens.delete(token); write(); },
            toggle(token, force) {
                const wanted = force === undefined ? !tokens.has(token) : !!force;
                if (tokens.has(token) !== wanted) {
                    if (wanted) tokens.add(token); else tokens.delete(token);
                    write();
                }
                return wanted;
            }
        }
    };
    const root = {};
    class MutationObserver {
        constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
        observe(target, options) {
            assert.equal(target, root);
            assert.equal(options.attributes, true);
            assert.equal(options.subtree, true);
            assert.equal(options.childList, true);
            assert.deepEqual(Array.from(options.attributeFilter), ['class']);
            this.active = true;
        }
        disconnect() { this.active = false; pending.delete(this); }
    }
    const context = vm.createContext({
        MutationObserver,
        document: {
            querySelector(selector) {
                queries++;
                if (selector.endsWith('.btnPlay:not(.hide)')) return play === 'visible' ? {} : null;
                if (selector.endsWith('.mainDetailButtons')) return host ? root : null;
                throw new Error(`Unexpected selector: ${selector}`);
            }
        }
    });
    vm.runInContext(visibilitySource, context, { timeout: 1000 });
    return {
        icon,
        sync() { context.syncWatchlistDetailVisibility(icon); },
        observe(button = icon) { context.observeWatchlistRevealWithPlay(button); },
        mutate: changed,
        setPlay(value) { play = value; changed(); },
        writes: () => writes,
        queries: () => queries,
        active: () => observers.filter(observer => observer.active).length,
        flush() {
            let delivered = 0;
            while (pending.size) {
                assert.ok(delivered++ < 32, 'observer must settle without starving later work');
                const batch = Array.from(pending);
                pending.clear();
                for (const observer of batch) {
                    if (observer.active) observer.callback([], observer);
                }
            }
            return delivered;
        }
    };
}

test('already hidden while Play is hidden does not rewrite class', () => {
    const f = fixture();
    f.sync(); f.sync();
    assert.equal(f.writes(), 0);
    assert.equal(f.icon.classList.contains('hide'), true);
});

test('revealing Watchlist updates its class only once', () => {
    const f = fixture({ play: 'visible' });
    f.sync(); f.sync();
    assert.equal(f.writes(), 1);
    assert.equal(f.icon.classList.contains('hide'), false);
});

test('hiding Watchlist while Play is absent updates its class only once', () => {
    const f = fixture({ play: 'missing', hidden: false });
    f.sync(); f.sync();
    assert.equal(f.writes(), 1);
    assert.equal(f.icon.classList.contains('hide'), true);
});

test('detached buttons are ignored', () => {
    const f = fixture({ connected: false, play: 'visible' });
    f.sync();
    assert.equal(f.writes(), 0);
    assert.equal(f.queries(), 0);
});

test('mutations while Play is hidden settle without a feedback loop', () => {
    const f = fixture();
    f.observe(); f.mutate();
    assert.equal(f.flush(), 1);
    assert.equal(f.writes(), 0);
    assert.equal(f.active(), 1);
});

test('Play can become visible after a settled mutation and release the observer', () => {
    const f = fixture();
    f.observe(); f.mutate(); f.flush();
    f.setPlay('visible'); f.flush();
    assert.equal(f.icon.classList.contains('hide'), false);
    assert.equal(f.writes(), 1);
    assert.equal(f.active(), 0);
});

test('a Play button inserted later reveals Watchlist', () => {
    const f = fixture({ play: 'missing' });
    f.observe(); f.mutate(); f.flush();
    f.setPlay('visible'); f.flush();
    assert.equal(f.icon.classList.contains('hide'), false);
    assert.equal(f.active(), 0);
});

test('already visible Play does not cause redundant writes during observation', () => {
    const f = fixture({ play: 'visible' });
    f.observe(); f.mutate(); f.flush();
    assert.equal(f.writes(), 1);
    assert.equal(f.active(), 0);
});

test('missing detail button container does not start an observer', () => {
    const f = fixture({ host: false });
    f.observe();
    assert.equal(f.active(), 0);
    assert.equal(f.writes(), 0);
});

test('missing Watchlist button does not start an observer', () => {
    const f = fixture();
    f.observe(null);
    assert.equal(f.active(), 0);
    assert.equal(f.writes(), 0);
});
