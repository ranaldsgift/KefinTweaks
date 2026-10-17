// Run: node --test tests/watchlist-menu-ownership.test.cjs
// Execute the actual drawer injection and mutation filter with DOM-shaped fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/utils.js'), 'utf8');
function extract(name) {
    const fn = source.match(new RegExp('^([ \\t]*)function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?^\\1\\}', 'm'))?.[0];
    assert.ok(fn, name + ' not found');
    return fn;
}

function fixture({ customTabs = [], nativeOwned = false, modern = true } = {}) {
    const list = { children: [], querySelectorAll: () => list.children.filter(r => r.native).map(r => r.anchor) };
    function row(kind, href, owned = false) {
        const r = { kind, native: kind === 'customTab', owned, href,
            anchor: { getAttribute: () => href },
            closest: () => r,
            querySelector: selector => selector.includes('customTabDrawerButton_') ? (r.native ? r.anchor : null) : (owned ? r.anchor : null),
            remove: () => list.children.splice(list.children.indexOf(r), 1),
            insertAdjacentElement: (_, child) => list.children.splice(list.children.indexOf(r) + 1, 0, child)
        };
        Object.defineProperty(r, 'nextElementSibling', { get: () => list.children[list.children.indexOf(r) + 1] });
        return r;
    }
    const favorites = row('favorites', '#/home?tab=1');
    favorites.parentElement = list;
    list.children.push(favorites);
    const addTab = href => list.children.push(row('customTab', href, nativeOwned));
    customTabs.forEach(addTab);
    const inject = vm.runInNewContext(extract('injectIntoV12Drawer') + '\ninjectIntoV12Drawer;', {
        findFavoritesDrawerLi: () => modern ? favorites : null,
        entryKey: e => e.url,
        getCustomMenuLinkHref: e => e.url,
        findByDataAttr: (_, attr, key) => list.children.find(r => r.owned && r.href === key),
        createMuiDrawerListItem: e => row('kefin', e.url, true)
    }, { timeout: 1000 });
    return { inject: (entry = {}) => inject({ name: 'Watchlist', url: '#/home?tab=2', ...entry }),
        addTab, rows: () => list.children.filter(r => r !== favorites).map(r => r.kind) };
}

test('an existing Custom Tabs Watchlist entry is reused', () => {
    const f = fixture({ customTabs: ['#/home?tab=2'] });
    assert.equal(f.inject(), true);
    assert.deepEqual(f.rows(), ['customTab']);
});

test('a late Custom Tabs entry replaces only the Kefin fallback and stays idempotent', () => {
    const f = fixture();
    f.inject();
    assert.deepEqual(f.rows(), ['kefin']);
    f.addTab('#/home?tab=2');
    for (let i = 0; i < 4; i++) f.inject();
    assert.deepEqual(f.rows(), ['customTab']);
});

test('without a Custom Tabs entry the Kefin link remains available', () => {
    const f = fixture();
    f.inject(); f.inject();
    assert.deepEqual(f.rows(), ['kefin']);
});

test('a different Custom Tab does not suppress the Watchlist entry', () => {
    const f = fixture({ customTabs: ['#/home?tab=3'] });
    f.inject();
    assert.deepEqual(f.rows(), ['kefin', 'customTab']);
});

test('the internal Watchlist fallback is retained', () => {
    const f = fixture({ customTabs: ['#/home?tab=2'] });
    f.inject({ url: '#/watchlist' });
    assert.deepEqual(f.rows(), ['kefin', 'customTab']);
});

test('a native Custom Tabs row is never removed if it inherited Kefin attributes', () => {
    const f = fixture({ customTabs: ['#/home?tab=2'], nativeOwned: true });
    f.inject(); f.inject();
    assert.deepEqual(f.rows(), ['customTab']);
});

test('other custom links keep their own entry even when the URL matches', () => {
    const f = fixture({ customTabs: ['#/home?tab=2'] });
    f.inject({ name: 'Another shortcut' });
    assert.deepEqual(f.rows(), ['kefin', 'customTab']);
});

test('a shortcut explicitly opening a new tab keeps its own entry', () => {
    const f = fixture({ customTabs: ['#/home?tab=2'] });
    f.inject({ openInNewTab: true });
    assert.deepEqual(f.rows(), ['kefin', 'customTab']);
});

test('Legacy and TV menus are left to the existing injection path', () => {
    const f = fixture({ modern: false });
    assert.equal(f.inject(), false);
    assert.deepEqual(f.rows(), []);
});

test('hiding the side-menu link preserves header and user-menu placement', () => {
    const calls = [];
    const inject = vm.runInNewContext(extract('injectOneCustomMenuLink') + '\ninjectOneCustomMenuLink;', {
        injectSideMenuOnly: () => { calls.push('side'); return true; },
        injectTopNavOnly: () => { calls.push('top'); return true; },
        injectUserMenuOnly: () => { calls.push('user'); return true; }
    }, { timeout: 1000 });
    assert.equal(inject({ sideMenu: false, topNavigation: 'right', userMenu: true }), true);
    assert.deepEqual(calls, ['top', 'user']);
});

const hosts = source.match(/    const ANY_CUSTOM_MENU_HOST_SEL = \[[\s\S]*?\]\.join\(', '\);/)?.[0];
assert.ok(hosts);
const filter = vm.runInNewContext(hosts + '\n' + extract('addedNodeMatchesHost') + '\n'
    + extract('mutationShouldTriggerCustomMenuReapply') + '\nmutationShouldTriggerCustomMenuReapply;', {
    isKefinCustomMenuOwnedNode: node => !!node.owned
}, { timeout: 1000 });
const mutationFilter = mutation => filter({ removedNodes: [], ...mutation });
function node(selector, owned = false) {
    return { nodeType: 1, owned, matches: selectors => selectors.split(',').map(s => s.trim()).includes(selector), querySelector: () => null };
}

test('late Custom Tabs drawer additions and drawer remounts trigger reconciliation', () => {
    const link = node('[id^="customTabDrawerButton_"]');
    const li = { ...node('li'), closest: () => ({}), querySelector: selectors => link.matches(selectors) ? link : null };
    assert.equal(mutationFilter({ addedNodes: [li] }), true);
    assert.equal(mutationFilter({ addedNodes: [node('.MuiDrawer-paper')] }), true);
});

test('unrelated and Kefin-owned additions do not create a reapply loop', () => {
    assert.equal(mutationFilter({ addedNodes: [node('.unrelated')] }), false);
    assert.equal(mutationFilter({ addedNodes: [node('.MuiDrawer-paper', true)] }), false);
    assert.equal(mutationFilter({ addedNodes: [] }), false);
});
