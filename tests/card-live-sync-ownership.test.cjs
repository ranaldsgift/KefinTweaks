// Run: node --test tests/card-live-sync-ownership.test.cjs
// Exercise the actual live-sync functions with an in-memory API and DOM model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/cardBuilder.js'), 'utf8');
const start = source.indexOf('    let cardUserDataListenerStarted = false;');
const end = source.indexOf('    let cardEditorCloseLiveSyncStarted = false;', start);
assert.ok(start >= 0 && end > start, 'Card live-sync functions not found');
const liveSyncCode = source.slice(start, end);
const itemId = '0123456789abcdef0123456789abcdef';
const dashedId = '01234567-89ab-cdef-0123-456789abcdef';

function fixture() {
    const cards = [];
    const requests = [];
    const builds = [];
    const registered = [];
    const watchlistButton = { dataset: {}, title: '' };
    const favoriteButton = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } };
    let freshItem = {
        Id: itemId, Type: 'Episode', Name: 'Updated episode',
        ImageTags: { Primary: 'new-image' }, UserData: {}
    };

    function card({ owned = false, id = itemId, skeleton = false, section = null, name = 'Old episode', imageTag = 'old-image' } = {}) {
        const attrs = { 'data-id': id, 'data-index': '3', 'data-type': 'Episode' };
        if (owned) attrs['data-kefin-card'] = 'true';
        const image = {
            getAttribute(name) {
                if (name === 'aria-label') return attrs.title;
                if (name === 'data-src') return 'https://example.invalid/Items/' + id + '/Images/Primary?tag=' + imageTag;
                return null;
            }
        };
        attrs.title = name;
        const element = {
            className: 'card overflowPortraitCard' + (skeleton ? ' skeleton-card' : ''),
            attrs,
            section,
            getAttribute: name => attrs[name] ?? null,
            setAttribute(name, value) { attrs[name] = String(value); },
            removeAttribute(name) { delete attrs[name]; },
            querySelector(selector) { return selector.startsWith('.cardImageContainer') ? image : null; },
            closest() { return this.section; },
            replaceWith(next) {
                const index = cards.indexOf(element);
                assert.ok(index >= 0, 'Only mounted cards can be replaced');
                next.section = element.section;
                cards[index] = next;
            }
        };
        return element;
    }

    const context = vm.createContext({
        window: {},
        state: { watchlist: true },
        console: { log() {}, warn() {}, error(...args) { assert.fail(args.join(' ')); } },
        setTimeout: () => 1,
        clearTimeout() {},
        requestAnimationFrame: callback => callback(),
        document: {
            activeElement: null,
            querySelectorAll(selector) {
                if (selector.startsWith('.watchlist-button')) return [watchlistButton];
                if (selector.startsWith('[is="emby-ratingbutton"]')) return [favoriteButton];
                assert.ok(selector.startsWith('.card'), 'Unexpected selector: ' + selector);
                const id = selector.match(/\[data-id="([^"]+)"\]/)?.[1];
                return cards.filter(element =>
                    element.getAttribute('data-id') === id &&
                    (!selector.includes('[data-kefin-card="true"]') || element.getAttribute('data-kefin-card') === 'true') &&
                    (!selector.includes(':not(.skeleton-card)') || !element.className.includes('skeleton-card'))
                );
            }
        },
        ApiClient: {
            getCurrentUserId: () => 'primary-user',
            async getItems(userId, options) {
                requests.push({ userId, ...options });
                return { Items: [freshItem] };
            }
        },
        createCardElement(item, overflowCard, cardFormat, footer, useParentCard, borderStyle) {
            builds.push({ item, overflowCard, cardFormat, footer, useParentCard, borderStyle });
            return card({ owned: true, id: item.Id, name: item.Name, imageTag: item.ImageTags.Primary });
        },
        registerLazyImagesIn(element) { registered.push(element); }
    });
    vm.runInContext(liveSyncCode, context, { timeout: 1000 });
    const run = expression => vm.runInContext(expression, context, { timeout: 1000 });
    return {
        cards, requests, builds, registered, card, run, watchlistButton, favoriteButton,
        setFreshItem(item) { freshItem = item; },
        async update(ids = [itemId]) {
            context.message = { MessageType: 'LibraryChanged', Data: { ItemsUpdated: ids } };
            run('handleLibraryChangedMessage(message)');
            await run('flushVisibleCardLibraryUpdates()');
        }
    };
}

test('native and other-plugin cards do not trigger a metadata fetch or rebuild', async () => {
    const f = fixture();
    const native = f.card();
    const otherPlugin = f.card();
    otherPlugin.setAttribute('data-plugin-card', 'true');
    f.cards.push(native, otherPlugin);
    await f.update();
    assert.equal(f.requests.length, 0);
    assert.deepEqual(f.cards, [native, otherPlugin]);
    assert.equal(f.builds.length, 0);
});

test('an update shared by native and Kefin cards rebuilds only the Kefin card', async () => {
    const f = fixture();
    const native = f.card();
    const owned = f.card({ owned: true });
    f.cards.push(native, owned);
    await f.update();
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].Ids, itemId);
    assert.equal(f.cards[0], native);
    assert.equal(native.className, 'card overflowPortraitCard');
    assert.equal(native.getAttribute('title'), 'Old episode');
    assert.notEqual(f.cards[1], owned);
    assert.equal(f.cards[1].getAttribute('title'), 'Updated episode');
    assert.equal(f.cards[1].getAttribute('data-index'), '3');
    assert.equal(f.registered[0], f.cards[1]);
});

test('Kefin cards retain their section format and continue refreshing after replacement', async () => {
    const f = fixture();
    const section = {
        dataset: {},
        getAttribute(name) {
            return { 'data-section-id': 'recentlyAdded', 'data-card-format': 'portrait' }[name] ?? null;
        }
    };
    f.cards.push(f.card({ owned: true, section }));
    await f.update();
    assert.equal(f.builds[0].cardFormat, 'portrait');
    assert.equal(f.builds[0].overflowCard, true);
    assert.equal(f.cards[0].getAttribute('data-kefin-card'), 'true');
    f.setFreshItem({ Id: itemId, Type: 'Episode', Name: 'Updated again', ImageTags: { Primary: 'newer-image' }, UserData: {} });
    await f.update();
    assert.equal(f.requests.length, 2);
    assert.equal(f.builds.length, 2);
    assert.equal(f.builds[1].cardFormat, 'portrait');
    assert.equal(f.cards[0].getAttribute('title'), 'Updated again');
});

test('unchanged metadata does not replace an already current Kefin card', async () => {
    const f = fixture();
    f.cards.push(f.card({ owned: true }));
    await f.update();
    const current = f.cards[0];
    await f.update();
    assert.equal(f.requests.length, 2);
    assert.equal(f.builds.length, 1);
    assert.equal(f.cards[0], current);
});

test('dashed notifications still find owned cards and ignore skeletons', async () => {
    const f = fixture();
    const skeleton = f.card({ owned: true, skeleton: true });
    const owned = f.card({ owned: true });
    f.cards.push(skeleton, owned);
    await f.update([dashedId]);
    assert.equal(f.requests.length, 1);
    assert.equal(f.cards[0], skeleton);
    assert.notEqual(f.cards[1], owned);
    assert.equal(f.builds.length, 1);
});

test('a skeleton or non-true ownership marker does not qualify for live rebuilding', async () => {
    const f = fixture();
    const unowned = f.card();
    unowned.setAttribute('data-kefin-card', 'false');
    f.cards.push(unowned, f.card({ owned: true, skeleton: true }));
    await f.update();
    assert.equal(f.requests.length, 0);
    assert.equal(f.builds.length, 0);
});

test('user-data updates still enhance native resume, Watchlist and favorite controls', () => {
    const f = fixture();
    const native = f.card();
    const owned = f.card({ owned: true });
    f.cards.push(native, owned);
    f.run(`applyUserDataEntriesToCards([{ ItemId: '${itemId}', PlaybackPositionTicks: 42, Likes: true, IsFavorite: true }], 'primary-user')`);
    assert.equal(native.getAttribute('data-positionticks'), '42');
    assert.equal(owned.getAttribute('data-positionticks'), '42');
    assert.equal(f.watchlistButton.dataset.active, 'true');
    assert.equal(f.favoriteButton.attrs['data-isfavorite'], 'true');
    f.run(`applyUserDataEntriesToCards([{ ItemId: '${itemId}', Played: true }], 'primary-user')`);
    assert.equal(native.getAttribute('data-positionticks'), null);
    assert.equal(owned.getAttribute('data-positionticks'), null);
});
