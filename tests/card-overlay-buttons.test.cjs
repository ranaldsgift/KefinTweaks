// Run from the repository: node --test tests/card-overlay-buttons.test.cjs
// Exercise the actual overlay construction block with a small DOM model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/cardBuilder.js'), 'utf8');
const start = source.indexOf('        // Overlays: desktop =');
const end = source.indexOf('        // Card text container - different structure for episodes', start);
assert.ok(start >= 0 && end > start, 'card overlay construction block exists');
const overlaySource = source.slice(start, end);

class Element {
    constructor(tagName) {
        this.tagName = tagName;
        this.children = [];
        this.attributes = {};
        this.className = '';
    }
    appendChild(child) { this.children.push(child); return child; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
}

function render(item, { mobile = false, watchlist = true, custom = false } = {}) {
    return vm.runInNewContext(`(() => {
        const itemType = item.Type || 'Folder';
        const itemId = item.Id;
        const serverId = 'test-server';
        const cardUrl = '#/details?id=test-item';
        ${overlaySource}
        return mobileOverlayPlayButton || cardOverlayContainer;
    })()`, {
        item: { Id: 'test-item', ...item },
        isCustomCard: custom,
        isMobileLayout: () => mobile,
        state: { watchlist },
        document: { createElement: tagName => new Element(tagName) }
    }, { timeout: 1000 });
}

function actions(node) {
    if (!node) return [];
    const own = node.tagName !== 'button' ? []
        : node.getAttribute('is') === 'emby-playstatebutton' ? ['played']
            : node.getAttribute('is') === 'emby-ratingbutton' ? ['favorite']
                : node.className.split(' ').includes('watchlist-button') ? ['watchlist']
                    : [node.getAttribute('data-action')];
    return own.concat(node.children.flatMap(actions));
}

for (const type of ['CollectionFolder', 'UserView']) {
    for (const mediaType of [undefined, 'Video']) {
        test(`${type}, MediaType=${mediaType}: library cards have no item action buttons`, () => {
            const overlay = render({
                Type: type,
                MediaType: mediaType,
                IsFolder: true,
                ...(mediaType ? { UserData: { Played: true, IsFavorite: true, Likes: true } } : {})
            });
            assert.deepEqual(actions(overlay), []);
            assert.equal(overlay.getAttribute('data-action'), 'link', 'library card remains navigable');
        });
    }
}

for (const type of ['Movie', 'Series', 'Season', 'BoxSet', 'Video']) {
    test(`${type}: desktop media actions remain available`, () => {
        assert.deepEqual(actions(render({
            Type: type,
            MediaType: 'Video',
            IsFolder: ['Series', 'Season', 'BoxSet'].includes(type)
        })),
            ['resume', 'watchlist', 'played', 'favorite', 'menu']);
    });
}

for (const type of ['Genre', 'Person', 'Studio']) {
    test(`${type}: favorite and menu remain available`, () => {
        assert.deepEqual(actions(render({ Type: type })), ['favorite', 'menu']);
    });
}

test('ordinary folders retain their context menu', () => {
    assert.deepEqual(actions(render({ Type: 'Folder', IsFolder: true })), ['menu']);
});

test('disabling Watchlist leaves the other movie actions available', () => {
    assert.deepEqual(actions(render({ Type: 'Movie', MediaType: 'Video' }, { watchlist: false })),
        ['resume', 'played', 'favorite', 'menu']);
});

for (const type of ['CollectionFolder', 'UserView', 'Movie', 'Series']) {
    test(`${type}: mobile overlay behavior stays the same`, () => {
        assert.deepEqual(actions(render({ Type: type }, { mobile: true })),
            ['Movie', 'Series'].includes(type) ? ['play'] : []);
    });
}

for (const type of ['Movie', 'CollectionFolder']) {
    test(`${type}: custom navigation cards have no item action buttons`, () => {
        const overlay = render({ Type: type }, { custom: true });
        assert.deepEqual(actions(overlay), []);
        assert.equal(overlay.children[0].tagName, 'a');
        assert.equal(overlay.children[0].href, '#/details?id=test-item');
    });
}
