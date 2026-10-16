// Run: node --test tests/custom-menu-order.test.cjs
// Actual placement/reapply functions with a small DOM model, not a Jellyfin browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/utils.js'), 'utf8');
const start = source.indexOf('    function insertOrderedCustomMenuLink(');
const placement = source.slice(start >= 0 ? start : source.indexOf('    function insertByMainOrder('),
    source.indexOf('    function injectIntoTopNavV12('));
function extract(name) {
    const match = source.match(new RegExp(`^([ \\t]*)function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?^\\1\\}`, 'm'));
    assert.ok(match, `${name} exists`);
    return match[0];
}
const functions = ['injectIntoTopNavV12', 'injectIntoTopNavLegacyTabs', 'injectIntoTopNavRightV12',
    'injectIntoTopNavRightLegacy', 'reapplyAllCustomMenuLinks', 'mutationShouldTriggerCustomMenuReapply',
    'isKefinCustomMenuOwnedNode', 'addedNodeMatchesHost'];
const selectors = ['KEFIN_CUSTOM_MENU_OWNED_SEL', 'ANY_CUSTOM_MENU_HOST_SEL'].map(name => {
    const match = source.match(new RegExp(`    const ${name} = \\[[\\s\\S]*?    \\]\\.join\\(', '\\);`));
    assert.ok(match, `${name} exists`);
    return match[0];
}).join('\n');

class Element {
    constructor(id, attributes = {}, classes = []) {
        this.id = id;
        this.attributes = attributes;
        this.children = [];
        this.parentNode = null;
        this.nodeType = 1;
        this.moves = [];
        this.classes = new Set(classes);
    }
    get parentElement() { return this.parentNode; }
    get nextElementSibling() {
        const siblings = this.parentNode?.children || [];
        return siblings[siblings.indexOf(this) + 1] || null;
    }
    get nextSibling() { return this.nextElementSibling; }
    get firstChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children.at(-1) || null; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
    matches(selector) {
        const simple = (node, token) => {
            if (token.startsWith('.')) return token.slice(1).split('.').every(name => node.classes.has(name));
            if (token.startsWith('#')) return node.id === token.slice(1);
            const attribute = token.match(/^\[([\w-]+)\]$/)?.[1];
            assert.ok(attribute, `unsupported selector in DOM model: ${token}`);
            return node.hasAttribute(attribute);
        };
        return selector.split(',').some(part => {
            const tokens = part.trim().split(/\s+/);
            let node = this;
            if (!simple(node, tokens.pop())) return false;
            while (tokens.length) {
                const token = tokens.pop();
                node = node.parentElement;
                while (node && !simple(node, token)) node = node.parentElement;
                if (!node) return false;
            }
            return true;
        });
    }
    closest(selector) {
        for (let node = this; node; node = node.parentElement) {
            if (node.matches(selector)) return node;
        }
        return null;
    }
    querySelector(selector) {
        for (const child of this.children) {
            if (child.matches(selector)) return child;
            const match = child.querySelector(selector);
            if (match) return match;
        }
        return null;
    }
    insertBefore(node, reference) {
        if (node === reference) return node;
        if (node.parentNode) {
            const siblings = node.parentNode.children;
            siblings.splice(siblings.indexOf(node), 1);
        }
        const index = reference == null ? this.children.length : this.children.indexOf(reference);
        assert.ok(index >= 0, 'reference belongs to parent');
        this.children.splice(index, 0, node);
        node.parentNode = this;
        this.moves.push(node.id);
        return node;
    }
    appendChild(node) { return this.insertBefore(node, null); }
}

function fixture(mode, modern = true) {
    const parent = new Element('header');
    for (const id of modern ? ['native-search', 'native-user'] : ['native-search', 'native-cast', 'native-user']) {
        parent.appendChild(new Element(id));
    }
    const entries = [];
    const attribute = mode === 'main' ? 'data-kefin-custom-menu-top-link' : 'data-kefin-custom-menu-top-right';
    const document = {
        querySelector: selector => selector === '.headerRight' ? parent
            : parent.children.find(n => n.id === 'native-search') || {}
    };
    const context = vm.createContext({
        customMenuLinkOrders: new WeakMap(),
        customMenuLinkRegistry: entries,
        isModernUI: () => modern,
        document,
        entryKey: entry => entry.name,
        findTopNavStack: () => parent,
        findLegacyTabsSlider: () => parent,
        ensureTopNavDivider: () => null,
        findByDataAttr: (root, attr, key) => (root === document ? parent.children : root.children)
            .find(node => node.getAttribute(attr) === key) || null,
        withCustomMenuReapplySuppressed: fn => fn(),
        removeLegacyTopNavCustomTabLinks: () => {},
        syncCustomTopNavActiveState: () => {},
        ERR: (...args) => { throw new Error(args.join(' ')); }
    });
    vm.runInContext(selectors + '\n' + placement + '\n' + functions.map(extract).join('\n'), context, { timeout: 1000 });
    const injectName = mode === 'main'
        ? modern ? 'injectIntoTopNavV12' : 'injectIntoTopNavLegacyTabs'
        : modern ? 'injectIntoTopNavRightV12' : 'injectIntoTopNavRightLegacy';
    context.injectOneCustomMenuLink = entry => context[injectName](entry);
    return {
        parent, context, entries,
        add(order, name = `custom-${order}`) {
            const node = new Element(name, { [attribute]: name });
            const entry = { name, order, topNavigation: mode };
            entries.push(entry);
            context[mode === 'main' ? 'insertByMainOrder' : 'insertByRightOrder'](parent, node, order);
            return { node, entry };
        },
        ids() { return parent.children.map(node => node.id); },
        reapply() { context.reapplyAllCustomMenuLinks(); }
    };
}

const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
for (const modern of [true, false]) {
    for (const mode of ['main', 'right']) {
        const label = `${modern ? 'Modern' : 'Legacy'} ${mode}`;
        const native = modern ? ['native-search', 'native-user'] : ['native-search', 'native-cast', 'native-user'];
        const expected = mode === 'main' ? ['custom-0', 'custom-1', 'custom-2', ...native]
            : modern ? [...native, 'custom-2', 'custom-1', 'custom-0']
                : ['native-search', 'custom-2', 'custom-1', 'custom-0', 'native-cast', 'native-user'];
        for (const orders of permutations) {
            test(`${label}: registration order ${orders}`, () => {
                const f = fixture(mode, modern);
                for (const order of orders) f.add(order);
                assert.deepEqual(f.ids(), expected);
            });
        }
        test(`${label}: repeated reapply does not move or duplicate nodes`, () => {
            const f = fixture(mode, modern);
            for (const order of [0, 1, 2]) f.add(order);
            f.parent.moves = [];
            for (let i = 0; i < 3; i++) f.reapply();
            assert.deepEqual(f.ids(), expected);
            assert.deepEqual(f.parent.moves, []);
        });
        test(`${label}: reapply respects an edited order`, () => {
            const f = fixture(mode, modern);
            const item = f.add(0, 'edited');
            item.entry.order = 1;
            f.reapply();
            const position = mode === 'main' ? f.parent.children.indexOf(item.node)
                : f.parent.children.length - 1 - f.parent.children.indexOf(item.node) - (modern ? 0 : 2);
            assert.equal(position, 1);
        });
        test(`${label}: clearing another order settles in one reapply`, () => {
            const f = fixture(mode, modern);
            const first = f.add(1, 'first');
            const second = f.add(0, 'second');
            first.entry.order = 0;
            second.entry.order = undefined;
            f.reapply();
            const position = mode === 'main' ? f.parent.children.indexOf(first.node)
                : f.parent.children.length - 1 - f.parent.children.indexOf(first.node) - (modern ? 0 : 2);
            assert.equal(position, 0);
        });
        test(`${label}: reapply repairs positions after a native icon is added`, () => {
            const f = fixture(mode, modern);
            f.add(0);
            f.add(1);
            const extra = new Element('native-extra');
            f.parent.insertBefore(extra, mode === 'main' ? f.parent.firstChild
                : modern ? null : f.parent.children.find(node => node.id === 'native-cast'));
            const nativeOrder = f.ids().filter(id => id.startsWith('native-'));
            f.parent.moves = [];
            f.reapply();
            const customPositions = f.parent.children.flatMap((node, index) => node.id.startsWith('custom-')
                ? [[node.id, mode === 'main' ? index : f.parent.children.length - 1 - index - (modern ? 0 : 2)]] : []);
            assert.deepEqual(Object.fromEntries(customPositions), { 'custom-0': 0, 'custom-1': 1 });
            assert.deepEqual(f.ids().filter(id => id.startsWith('native-')), nativeOrder);
            assert.ok(f.parent.moves.every(id => id.startsWith('custom-')), 'only custom nodes move');
        });
        test(`${label}: equal order is stable across reapplication`, () => {
            const f = fixture(mode, modern);
            f.add(0, 'first');
            f.add(0, 'second');
            const before = f.ids();
            f.parent.moves = [];
            f.reapply();
            f.reapply();
            assert.deepEqual(f.ids(), before);
            assert.deepEqual(f.parent.moves, []);
        });
        test(`${label}: reapply repairs positions after a native icon is removed`, () => {
            const f = fixture(mode, modern);
            if (!modern && mode === 'right') {
                f.parent.insertBefore(new Element('native-extra'),
                    f.parent.children.find(node => node.id === 'native-cast'));
            }
            const { node } = f.add(1);
            const removed = f.parent.children.find(child => child.id === (mode === 'main'
                ? 'native-search' : modern ? 'native-user' : 'native-extra'));
            f.parent.children.splice(f.parent.children.indexOf(removed), 1);
            removed.parentNode = null;
            f.parent.moves = [];
            f.reapply();
            const position = mode === 'main' ? f.parent.children.indexOf(node)
                : f.parent.children.length - 1 - f.parent.children.indexOf(node) - (modern ? 0 : 2);
            assert.equal(position, 1);
            assert.ok(f.parent.moves.every(id => id.startsWith('custom-')));
        });
    }
}

for (const modern of [true, false]) {
    for (const registrations of [
        ['main-0', 'right-0', 'main-1', 'right-1'],
        ['right-1', 'main-1', 'right-0', 'main-0'],
        ['main-1', 'main-0', 'right-1', 'right-0'],
        ['right-0', 'right-1', 'main-0', 'main-1']
    ]) {
        test(`${modern ? 'Modern' : 'Legacy'} shared header: ${registrations}`, () => {
            const f = fixture('main', modern);
            const links = registrations.map(name => ({
                node: new Element(name), order: Number(name.at(-1)), right: name.startsWith('right')
            }));
            for (const { node, order, right } of links) {
                f.context[right ? 'insertByRightOrder' : 'insertByMainOrder'](f.parent, node, order);
            }
            assert.deepEqual(f.ids(), modern
                ? ['main-0', 'main-1', 'native-search', 'native-user', 'right-1', 'right-0']
                : ['main-0', 'main-1', 'native-search', 'right-1', 'right-0', 'native-cast', 'native-user']);
            f.parent.moves = [];
            for (const { node, order, right } of links) {
                f.context[right ? 'insertByRightOrder' : 'insertByMainOrder'](f.parent, node, order);
            }
            assert.deepEqual(f.parent.moves, []);
        });
    }
}

test('out-of-range and fractional orders clamp while native controls keep their order', () => {
    const f = fixture('main');
    f.add(100, 'last');
    f.add(-2, 'first');
    f.add(1.9, 'middle');
    assert.deepEqual(f.ids(), ['first', 'middle', 'native-search', 'native-user', 'last']);
});

for (const classes of [['headerRight'], ['headerTabs', 'sectionTabs'], ['MuiToolbar-root']]) {
    for (const removed of [false, true]) {
        test(`${classes.join('.')}: native ${removed ? 'removal' : 'insertion'} schedules reapplication`, () => {
            const f = fixture('main');
            const host = new Element('host', {}, classes);
            const target = classes.includes('headerTabs') ? host.appendChild(new Element('slider', {}, ['emby-tabs-slider'])) : host;
            const native = new Element('native');
            assert.equal(f.context.mutationShouldTriggerCustomMenuReapply({
                target, addedNodes: removed ? [] : [native], removedNodes: removed ? [native] : []
            }), true);
        });
    }
}

for (const headerClass of ['MuiStack-root', 'MuiBox-root']) {
    test(`Modern ${headerClass}: native icon changes schedule reapplication`, () => {
        const f = fixture('right');
        const toolbar = new Element('toolbar', {}, ['MuiToolbar-root']);
        const target = toolbar.appendChild(new Element('buttons', {}, [headerClass]));
        assert.equal(f.context.mutationShouldTriggerCustomMenuReapply({
            target, addedNodes: [new Element('native-icon')], removedNodes: []
        }), true);
    });
    test(`non-header ${headerClass}: content changes do not schedule reapplication`, () => {
        const f = fixture('right');
        assert.equal(f.context.mutationShouldTriggerCustomMenuReapply({
            target: new Element('content', {}, [headerClass]), addedNodes: [new Element('unrelated')], removedNodes: []
        }), false);
    });
}

test('own DOM moves and unrelated content do not schedule reapplication', () => {
    const f = fixture('main');
    const { node } = f.add(0);
    assert.equal(f.context.mutationShouldTriggerCustomMenuReapply({
        target: new Element('toolbar', {}, ['MuiToolbar-root']), addedNodes: [node], removedNodes: [node]
    }), false);
    assert.equal(f.context.mutationShouldTriggerCustomMenuReapply({
        target: new Element('content'), addedNodes: [new Element('unrelated')], removedNodes: []
    }), false);
});
