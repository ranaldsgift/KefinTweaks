// Run: node --test tests/collection-progress.test.cjs
// Exercise the actual progress renderer with DOM-shaped elements, not a copy of it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../scripts/collections.js'), 'utf8');
const renderer = source.match(/^([ \t]*)async function updateCollectionPage\(item\) \{[\s\S]*?^\1\}/m)?.[0];
assert.ok(renderer, 'Collection progress renderer not found');

function fixture({ video = false, active = true } = {}) {
    const page = { dataset: {} };
    const info = { children: [], appendChild(child) { this.children.push(child); } };
    // querySelector returns one Element or null. An Element has no list length.
    const videoCollection = video ? { tagName: 'DIV' } : null;
    const document = {
        querySelector(selector) {
            if (selector === '.libraryPage:not(.hide)') return active ? page : null;
            if (selector.endsWith(' .collectionItems:has(.card[data-mediatype="Video"])')) return videoCollection;
            if (selector.endsWith(' .itemMiscInfo-primary')) return info;
            throw new Error('Unexpected selector: ' + selector);
        },
        createElement(tagName) { return { tagName, className: '', textContent: '' }; }
    };
    const render = vm.runInNewContext(renderer + '\nupdateCollectionPage;', { document }, { timeout: 1000 });
    return { page, render, texts: () => info.children.map(child => child.textContent) };
}

test('an empty collection finishes without throwing or adding progress counts', async () => {
    const f = fixture();
    await f.render({ ChildCount: 0, UserData: { UnplayedItemCount: 0 } });
    assert.deepEqual(f.texts(), []);
    assert.equal(f.page.dataset.kefinCollectionPage, 'true');
});

test('video collections show watched and unwatched counts', async () => {
    const f = fixture({ video: true });
    await f.render({ RecursiveItemCount: 3, UserData: { UnplayedItemCount: 2 } });
    assert.deepEqual(f.texts(), ['1 watched', '2 unwatched']);
});

test('collections without video cards retain complete and incomplete counts', async () => {
    const f = fixture();
    await f.render({ ChildCount: 4, UserData: { UnplayedItemCount: 2 } });
    assert.deepEqual(f.texts(), ['2 complete', '2 incomplete']);
});

test('fully watched video collections add no extra progress counts', async () => {
    const f = fixture({ video: true });
    await f.render({ ChildCount: 3, UserData: { UnplayedItemCount: 0 } });
    assert.deepEqual(f.texts(), []);
    assert.equal(f.page.dataset.kefinCollectionPage, 'true');
});

test('repeated rendering does not duplicate the progress counts', async () => {
    const f = fixture({ video: true });
    const item = { ChildCount: 2, UserData: { UnplayedItemCount: 1 } };
    await f.render(item);
    const first = f.texts();
    await f.render(item);
    assert.equal(first.length, 2);
    assert.deepEqual(f.texts(), first);
});

test('leaving the collection page does not add progress counts', async () => {
    const f = fixture({ active: false, video: true });
    await f.render({ ChildCount: 2, UserData: { UnplayedItemCount: 1 } });
    assert.deepEqual(f.texts(), []);
    assert.equal(f.page.dataset.kefinCollectionPage, undefined);
});
