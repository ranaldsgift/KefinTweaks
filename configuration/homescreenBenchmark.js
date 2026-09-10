// Home Screen Section Benchmarks — timed query overview for admin config
(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinHomeScreenBenchmark]', ...args);
    const STORAGE_KEY = 'kefin.homeScreen.benchmark.selectedIds';
    const DEFAULT_QUERY_LIMIT = window.KefinHomeScreenEditorConstants?.DEFAULT_SECTION_QUERY_LIMIT ?? 16;

    const CATEGORIES = [
        { id: 'default', label: 'Default', groupsKey: 'HOME_SECTION_GROUPS' },
        { id: 'custom', label: 'Custom', groupsKey: 'CUSTOM_SECTION_GROUPS' },
        { id: 'discovery', label: 'Discovery', groupsKey: 'DISCOVERY_SECTION_GROUPS' },
        { id: 'seasonal', label: 'Seasonal', groupsKey: 'SEASONAL_SECTION_GROUPS' }
    ];

    const MS_BANDS = [
        { max: 500, className: 'kefin-bench-ms-fast' },
        { max: 1000, className: 'kefin-bench-ms-mid' },
        { max: 2000, className: 'kefin-bench-ms-slow' },
        { max: Infinity, className: 'kefin-bench-ms-worst' }
    ];

    /** @type {{ aborted: boolean, controller: AbortController|null, onSkipRemaining?: Function } | null} */
    let activeRun = null;
    let navCancelBound = false;

    /**
     * Survives re-renders of the tab so results are not lost when the user
     * switches tabs or reopens the config modal.
     * @type {{ entries: Array, results: Map<string, Object> } | null}
     */
    let lastRun = null;
    let lastViewMode = 'picker';

    function hasStoredResults() {
        return !!lastRun?.entries?.length;
    }

    function flattenGroups(groups) {
        if (!Array.isArray(groups)) return [];
        const out = [];
        groups.forEach((group) => {
            if (group && Array.isArray(group.sections)) {
                out.push(...group.sections);
            }
        });
        return out;
    }

    function getSectionsForCategories(config, enabledCategoryIds) {
        const enabled = new Set(enabledCategoryIds);
        const sections = [];
        CATEGORIES.forEach((cat) => {
            if (!enabled.has(cat.id)) return;
            const groups = config?.[cat.groupsKey] || [];
            flattenGroups(groups).forEach((section) => {
                if (!section?.id) return;
                sections.push({
                    section,
                    category: cat.label,
                    categoryId: cat.id
                });
            });
        });
        return sections;
    }

    function loadStoredSelectedIds() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : null;
        } catch (e) {
            return null;
        }
    }

    function saveStoredSelectedIds(ids) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        } catch (e) {
            LOG('Could not persist selection', e);
        }
    }

    function msBandClass(ms) {
        if (ms == null || Number.isNaN(ms)) return '';
        for (const band of MS_BANDS) {
            if (ms < band.max) return band.className;
        }
        return MS_BANDS[MS_BANDS.length - 1].className;
    }

    function withBenchmarkQueryOptions(query) {
        const queryOptions = { ...(query?.queryOptions || {}) };
        if (queryOptions.Limit == null || queryOptions.Limit === '') {
            queryOptions.Limit = DEFAULT_QUERY_LIMIT;
        }
        return { ...query, queryOptions };
    }

    function uniqueItemsById(items) {
        const seen = new Set();
        const out = [];
        (items || []).forEach((item) => {
            const id = item?.Id ?? item?.id;
            if (id != null) {
                if (seen.has(id)) return;
                seen.add(id);
            }
            out.push(item);
        });
        return out;
    }

    function analyzeItemFields(items) {
        let hasMediaStreams = false;
        let hasPeople = false;
        let hasStudios = false;
        (items || []).forEach((item) => {
            if (item?.MediaStreams?.length) hasMediaStreams = true;
            if (item?.People?.length) hasPeople = true;
            if (item?.Studios?.length) hasStudios = true;
        });
        return { hasMediaStreams, hasPeople, hasStudios };
    }

    function jsonByteSize(value) {
        try {
            const json = typeof value === 'string' ? value : JSON.stringify(value);
            return new TextEncoder().encode(json || '').byteLength;
        } catch (e) {
            return 0;
        }
    }

    function formatBytes(bytes) {
        if (!Number.isFinite(bytes)) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    function getAuthHeaders() {
        if (window.apiHelper?.getAuthHeader) {
            return {
                Authorization: window.apiHelper.getAuthHeader(),
                Accept: 'application/json'
            };
        }
        return { Accept: 'application/json' };
    }

    async function timedFetchJson(url, signal) {
        const start = performance.now();
        const response = await fetch(url, { headers: getAuthHeaders(), signal });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();
        const data = JSON.parse(text);
        return { data, ms: performance.now() - start, responseBytes: jsonByteSize(text) };
    }

    async function timedDataSource(dataSource, options) {
        const start = performance.now();
        const result = await window.apiHelper.fetchFromDataSource(dataSource, options || {}, false);
        const ms = performance.now() - start;
        const items = result?.Items || result || [];
        return {
            items: Array.isArray(items) ? items : [],
            ms,
            responseBytes: jsonByteSize(result)
        };
    }

    async function fetchQueryItems(query, section, signal) {
        const userId = window.ApiClient?.getCurrentUserId?.();
        const serverUrl = window.ApiClient?.serverAddress?.();
        if (!userId || !serverUrl) {
            throw new Error('ApiClient not ready');
        }

        const previewQuery = withBenchmarkQueryOptions(query);
        const useSpotlight =
            section.renderMode === 'Spotlight' || section.spotlight === true;

        if (previewQuery.dataSource) {
            return await timedDataSource(previewQuery.dataSource, previewQuery.queryOptions);
        }

        if (!window.apiHelper?.buildQueryFromSection) {
            throw new Error('apiHelper.buildQueryFromSection not available');
        }

        const built = window.apiHelper.buildQueryFromSection(
            previewQuery,
            userId,
            serverUrl,
            useSpotlight
        );

        if (built && typeof built === 'object' && built.dataSource) {
            return await timedDataSource(built.dataSource, built.options);
        }

        if (!built || typeof built !== 'string') {
            throw new Error('Could not build query URL');
        }

        const { data, ms, responseBytes } = await timedFetchJson(built, signal);
        const items = data?.Items || (Array.isArray(data) ? data : []);
        return { items, ms, responseBytes };
    }

    /**
     * Discovery sections ship as templates without queries: their source (genre, person,
     * studio, collection, ...) is picked at render time. Reuse the home screen resolver so
     * the benchmark measures the same queries the home screen would actually issue.
     */
    async function resolveSectionQueries(entry) {
        const section = entry.section;
        const isTemplate = !section.queries?.length && !section.items?.length;
        if (!isTemplate || !section.type) return { section, error: null };

        const resolve = window.homeScreen3?.resolveDiscoverySection;
        if (!resolve) {
            return { section, error: 'Discovery resolver unavailable' };
        }

        try {
            const resolved = await resolve(section, {
                pairSpotlight: false,
                resolveViewMore: false
            });
            if (!resolved?.queries?.length) {
                return { section, error: `Could not resolve ${section.type} source` };
            }
            return { section: resolved, error: null };
        } catch (e) {
            return { section, error: `Source resolve failed: ${e?.message || e}` };
        }
    }

    async function benchmarkSection(section, signal) {
        if (section.items?.length) {
            return {
                totalMs: 0,
                items: section.items,
                responseBytes: 0,
                queryMetrics: [],
                error: null,
                skippedQueries: true
            };
        }

        const queries = section.queries || [];
        if (!queries.length) {
            return {
                totalMs: 0,
                items: [],
                responseBytes: 0,
                queryMetrics: [],
                error: 'No queries',
                skippedQueries: true
            };
        }

        let totalMs = 0;
        let responseBytes = 0;
        const allItems = [];
        const queryMetrics = [];

        for (const query of queries) {
            if (signal?.aborted) {
                return {
                    totalMs,
                    items: allItems,
                    responseBytes,
                    queryMetrics,
                    error: 'Cancelled',
                    cancelled: true
                };
            }
            const result = await fetchQueryItems(query, section, signal);
            const { items, ms } = result;
            const queryBytes = result.responseBytes || 0;
            totalMs += ms;
            responseBytes += queryBytes;
            allItems.push(...items);
            queryMetrics.push({ ms, itemCount: items.length, responseBytes: queryBytes });
        }

        return {
            totalMs,
            items: uniqueItemsById(allItems),
            responseBytes,
            queryMetrics,
            error: null
        };
    }

    function chipHtml(on, label) {
        const cls = on ? 'kefin-bench-chip-on' : 'kefin-bench-chip-off';
        const text = on ? 'On' : 'Off';
        return `<span class="kefin-bench-chip ${cls}" title="${label}">${label}: ${text}</span>`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ensureBenchmarkStyles() {
        if (document.getElementById('kefin-bench-styles')) return;
        const style = document.createElement('style');
        style.id = 'kefin-bench-styles';
        style.textContent = `
            .kefin-bench-wrap { font-size: 0.95em; }
            .kefin-bench-cats {
                display: flex;
                flex-wrap: wrap;
                gap: 1em;
                margin: 1.25em 0;
            }
            .kefin-bench-cat-btn {
                padding: 0.75em 1.75em;
                font-size: 1em;
                line-height: 1.2;
                border-radius: 999px;
                border: 2px solid rgba(255,255,255,0.18);
                background: rgba(255,255,255,0.04);
                color: rgba(255,255,255,0.5);
                cursor: pointer;
                font-weight: 600;
                transition: background 0.15s, border-color 0.15s, color 0.15s;
            }
            .kefin-bench-cat-btn:hover:not(:disabled) {
                color: rgba(255,255,255,0.85);
                border-color: rgba(255,255,255,0.4);
            }
            .kefin-bench-cat-btn.is-active {
                border-color: var(--theme-primary-color, #00a4dc);
                color: #fff;
                background: var(--theme-primary-color, #00a4dc);
            }
            .kefin-bench-cat-btn.is-active:hover:not(:disabled) {
                border-color: var(--theme-primary-color, #00a4dc);
                color: #fff;
                filter: brightness(1.1);
            }
            .kefin-bench-cat-btn:disabled { opacity: 0.5; cursor: default; }
            .kefin-bench-actions {
                display: flex; gap: 0.75em; align-items: center; flex-wrap: wrap; margin-top: 1em;
            }
            .kefin-bench-wrap [hidden] { display: none !important; }
            .kefin-bench-panel { min-height: 120px; }
            .kefin-bench-picker-toolbar {
                display: flex; align-items: center; gap: 0.5em; margin-bottom: 0.65em; flex-wrap: wrap;
            }
            .kefin-bench-picker-count {
                font-size: 0.85em; color: rgba(255,255,255,0.55); margin-left: 0.25em;
            }
            #kefin-bench-picker-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr 1fr;
                gap: 0.4em;
                max-height: 460px;
                overflow-y: auto;
                padding: 0.5em;
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 6px;
                background: rgba(0,0,0,0.15);
            }
            @media (max-width: 1100px) {
                #kefin-bench-picker-grid { grid-template-columns: 1fr 1fr 1fr; }
            }
            @media (max-width: 800px) {
                #kefin-bench-picker-grid { grid-template-columns: 1fr 1fr; }
            }
            @media (max-width: 520px) {
                #kefin-bench-picker-grid { grid-template-columns: 1fr; }
            }
            .kefin-bench-picker-cell {
                height: 24px;
                overflow: hidden;
                display: flex;
                align-items: center;
                gap: 0.5em;
                padding: 0 0.4em;
                border-radius: 4px;
                min-width: 0;
                cursor: pointer;
            }
            .kefin-bench-picker-cell:hover { background: rgba(255,255,255,0.07); }
            .kefin-bench-picker-cell input { flex-shrink: 0; margin: 0; }
            .kefin-bench-picker-label {
                flex: 1; min-width: 0;
                display: flex; align-items: center; gap: 0.4em;
                overflow: hidden;
            }
            .kefin-bench-picker-name {
                font-size: 1em;
                color: rgba(255,255,255,0.92);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .kefin-bench-picker-badge {
                flex-shrink: 0;
                font-size: 0.65em;
                padding: 0.1em 0.4em;
                border-radius: 3px;
                background: rgba(0,164,220,0.2);
                color: rgba(255,255,255,0.7);
            }
            .kefin-bench-table-wrap { overflow-x: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; }
            .kefin-bench-summary-wrap {
                overflow-x: auto;
                margin-bottom: 1em;
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 6px;
            }
            .kefin-bench-summary-table td {
                font-size: 1.1em;
                font-weight: 600;
                text-align: center;
            }
            .kefin-bench-summary-table th { text-align: center; white-space: nowrap; }
            .kefin-bench-summary-table td[title] { cursor: help; }
            .kefin-bench-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 0.9em;
                /* Fixed layout keeps column widths stable as rows fill in */
                table-layout: fixed;
            }
            .kefin-bench-table:not(.kefin-bench-summary-table) { min-width: 780px; }
            .kefin-bench-table th, .kefin-bench-table td {
                padding: 0.55em 0.65em; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.08);
                overflow: hidden; text-overflow: ellipsis;
            }
            .kefin-bench-table tbody tr { height: 2.9em; }
            .kefin-bench-col-name, .kefin-bench-col-plain { white-space: nowrap; }
            .kefin-bench-table th { font-weight: 600; color: rgba(255,255,255,0.85); background: rgba(0,0,0,0.2); }
            .kefin-bench-table tr.kefin-bench-row-running td { color: rgba(255,255,255,0.6); }
            .kefin-bench-ms-fast { background: rgba(47,158,68,0.35); }
            .kefin-bench-ms-mid { background: rgba(255,212,59,0.25); }
            .kefin-bench-ms-slow { background: rgba(253,126,20,0.3); }
            .kefin-bench-ms-worst { background: rgba(224,49,49,0.35); }
            .kefin-bench-chips { display: flex; flex-wrap: nowrap; gap: 0.35em; }
            .kefin-bench-chip {
                font-size: 0.75em; padding: 0.15em 0.45em; border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                white-space: nowrap;
            }
            .kefin-bench-chip-on { background: rgba(47,158,68,0.25); }
            .kefin-bench-chip-off { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
        `;
        document.head.appendChild(style);
    }

    function buildPickerGridHtml(sections, checkedSet) {
        if (!sections.length) {
            return '<p class="listItemBodyText secondary" style="padding:1em;text-align:center;">No sections in the selected categories.</p>';
        }
        return sections
            .map((entry) => {
                const id = entry.section.id;
                const checked = checkedSet ? checkedSet.has(id) : true;
                const name = escapeHtml(entry.section.name || id);
                const cat = escapeHtml(entry.category);
                return `
                    <label class="kefin-bench-picker-cell">
                        <input type="checkbox" class="kefin-bench-pick" value="${escapeHtml(id)}" ${checked ? 'checked' : ''} />
                        <span class="kefin-bench-picker-label">
                            <span class="kefin-bench-picker-name">${name}</span>
                            <span class="kefin-bench-picker-badge">${cat}</span>
                        </span>
                    </label>
                `;
            })
            .join('');
    }

    function buildTableShell() {
        return `
            <div class="kefin-bench-summary-wrap">
                <table class="kefin-bench-table kefin-bench-summary-table">
                    <colgroup>
                        <col style="width:16.66%" />
                        <col style="width:16.66%" />
                        <col style="width:16.66%" />
                        <col style="width:16.66%" />
                        <col style="width:16.68%" />
                        <col style="width:16.68%" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>&lt;500ms</th>
                            <th>500–1000ms</th>
                            <th>1000–2000ms</th>
                            <th>2000ms+</th>
                            <th>&gt;100 items</th>
                            <th>&gt;5 MB</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="kefin-bench-summary-row">
                            <td class="kefin-bench-ms-fast" data-summary="fast">0</td>
                            <td class="kefin-bench-ms-mid" data-summary="mid">0</td>
                            <td class="kefin-bench-ms-slow" data-summary="slow">0</td>
                            <td class="kefin-bench-ms-worst" data-summary="worst">0</td>
                            <td data-summary="large-items">0</td>
                            <td data-summary="large-response">0</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="kefin-bench-table-wrap">
                <table class="kefin-bench-table">
                    <colgroup>
                        <col style="width:24%" />
                        <col style="width:10%" />
                        <col style="width:9%" />
                        <col style="width:12%" />
                        <col style="width:7%" />
                        <col style="width:24%" />
                        <col style="width:14%" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Section</th>
                            <th>Category</th>
                            <th>Time (ms)</th>
                            <th>Response size</th>
                            <th>Items</th>
                            <th>Fields</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody class="kefin-bench-tbody"></tbody>
                </table>
            </div>
        `;
    }

    function rowHtml(entry, result) {
        const name = result?.resolvedName || entry.section.name || entry.section.id;
        const status = result?.status || 'pending';
        const ms = result?.totalMs;
        const msClass = status === 'done' ? msBandClass(ms) : '';
        const msText =
            status === 'running' ? '…' :
            status === 'skipped' ? '—' :
            status === 'error' ? '—' :
            status === 'done' ? Math.round(ms) : '—';

        const items = result?.itemCount ?? '—';
        const responseSize = status === 'done' ? formatBytes(result.responseBytes) : '—';
        const fields =
            status === 'done'
                ? `<div class="kefin-bench-chips">
                    ${chipHtml(result.hasMediaStreams, 'MediaStreams')}
                    ${chipHtml(result.hasPeople, 'People')}
                    ${chipHtml(result.hasStudios, 'Studios')}
                   </div>`
                : '—';

        const statusText =
            status === 'running' ? 'Running…' :
            status === 'skipped' ? 'Skipped' :
            status === 'error' ? (result.error || 'Error') :
            status === 'done' ? (result.skippedQueries ? 'Static / no query' : 'OK') : 'Pending';

        return `
            <tr class="kefin-bench-row kefin-bench-row-${status}" data-section-id="${entry.section.id}">
                <td class="kefin-bench-col-name" title="${escapeHtml(name)}">${escapeHtml(name)}</td>
                <td class="kefin-bench-col-plain">${escapeHtml(entry.category)}</td>
                <td class="kefin-bench-col-plain ${msClass}">${msText}</td>
                <td class="kefin-bench-col-plain">${responseSize}</td>
                <td class="kefin-bench-col-plain">${items}</td>
                <td>${fields}</td>
                <td class="kefin-bench-col-plain" title="${escapeHtml(statusText)}">${escapeHtml(statusText)}</td>
            </tr>
        `;
    }

    function cancelActiveRun(markSkipped) {
        if (!activeRun) return;
        activeRun.aborted = true;
        if (activeRun.controller) {
            try {
                activeRun.controller.abort();
            } catch (e) { /* ignore */ }
        }
        if (markSkipped && activeRun.onSkipRemaining) {
            activeRun.onSkipRemaining();
        }
        activeRun = null;
    }

    function bindNavCancel() {
        if (navCancelBound) return;
        navCancelBound = true;

        const onNavigate = () => {
            if (!activeRun) return;
            if (window.location.hash === activeRun.startHash) return;
            cancelActiveRun(true);
        };

        window.addEventListener('hashchange', onNavigate);
        if (window.KefinTweaksUtils?.onViewPage) {
            window.KefinTweaksUtils.onViewPage(() => onNavigate());
        }
    }

    function updateSummaryCells(scopeEl, entries, results) {
        const buckets = {
            fast: new Map(),
            mid: new Map(),
            slow: new Map(),
            worst: new Map(),
            'large-items': new Map(),
            'large-response': new Map()
        };

        entries.forEach((entry) => {
            const result = results.get(entry.section.id);
            if (!result?.queryMetrics?.length) return;
            const name = result.resolvedName || entry.section.name || entry.section.id;

            const tally = (key) => {
                buckets[key].set(name, (buckets[key].get(name) || 0) + 1);
            };

            result.queryMetrics.forEach((query) => {
                if (query.ms < 500) tally('fast');
                else if (query.ms < 1000) tally('mid');
                else if (query.ms < 2000) tally('slow');
                else tally('worst');
                if (query.itemCount > 100) tally('large-items');
                if (query.responseBytes > 5 * 1024 * 1024) tally('large-response');
            });
        });

        const summary = scopeEl?.querySelector('.kefin-bench-summary-row');
        if (!summary) return;

        Object.keys(buckets).forEach((key) => {
            const cell = summary.querySelector(`[data-summary="${key}"]`);
            if (!cell) return;
            const tallied = [...buckets[key].entries()];
            const total = tallied.reduce((sum, [, count]) => sum + count, 0);
            cell.textContent = total;
            if (total) {
                // One line per section, with a query count when a section contributes more than once
                cell.title = tallied
                    .map(([name, count]) => (count > 1 ? `${name} (${count} queries)` : name))
                    .join('\n');
            } else {
                cell.removeAttribute('title');
            }
        });
    }

    function renderResultsTable(resultsEl, entries, results) {
        resultsEl.innerHTML = buildTableShell();
        const tbody = resultsEl.querySelector('.kefin-bench-tbody');
        tbody.innerHTML = entries
            .map((entry) => rowHtml(entry, results.get(entry.section.id) || { status: 'pending' }))
            .join('');
        updateSummaryCells(resultsEl, entries, results);
        return tbody;
    }

    async function runBenchmarks(selectedEntries, tbody, ui, results) {
        const controller = new AbortController();
        const signal = controller.signal;

        const updateSummary = () => {
            updateSummaryCells(tbody.closest('#kefin-bench-results'), selectedEntries, results);
        };

        const updateRow = (entry, result) => {
            results.set(entry.section.id, result);
            const tr = tbody.querySelector(`tr[data-section-id="${entry.section.id}"]`);
            if (tr) {
                tr.outerHTML = rowHtml(entry, result);
            }
            updateSummary();
        };

        const skipRemaining = () => {
            selectedEntries.forEach((entry) => {
                if (results.get(entry.section.id)?.status === 'running' ||
                    !results.has(entry.section.id)) {
                    updateRow(entry, { status: 'skipped', totalMs: null, itemCount: '—' });
                }
            });
            ui.setRunning(false);
        };

        activeRun = {
            aborted: false,
            controller,
            startHash: window.location.hash,
            onSkipRemaining: skipRemaining
        };

        ui.setRunning(true);

        for (const entry of selectedEntries) {
            if (activeRun?.aborted || signal.aborted) {
                updateRow(entry, { status: 'skipped', totalMs: null, itemCount: '—' });
                continue;
            }

            updateRow(entry, { status: 'running' });

            try {
                const resolved = await resolveSectionQueries(entry);
                if (resolved.error) {
                    updateRow(entry, {
                        status: 'error',
                        error: resolved.error,
                        totalMs: null,
                        itemCount: '—'
                    });
                    continue;
                }

                const bench = await benchmarkSection(resolved.section, signal);
                if (activeRun?.aborted || signal.aborted || bench.cancelled) {
                    updateRow(entry, { status: 'skipped', totalMs: null, itemCount: '—' });
                    continue;
                }
                const fields = analyzeItemFields(bench.items);
                updateRow(entry, {
                    status: bench.error && !bench.skippedQueries ? 'error' : 'done',
                    resolvedName: resolved.section !== entry.section ? resolved.section.name : null,
                    totalMs: bench.totalMs,
                    itemCount: bench.items.length,
                    hasMediaStreams: fields.hasMediaStreams,
                    hasPeople: fields.hasPeople,
                    hasStudios: fields.hasStudios,
                    responseBytes: bench.responseBytes,
                    queryMetrics: bench.queryMetrics,
                    skippedQueries: bench.skippedQueries,
                    error: bench.error
                });
            } catch (e) {
                if (signal.aborted || activeRun?.aborted) {
                    updateRow(entry, { status: 'skipped', totalMs: null, itemCount: '—' });
                } else {
                    updateRow(entry, {
                        status: 'error',
                        error: e?.message || String(e),
                        totalMs: null,
                        itemCount: '—'
                    });
                }
            }

            await new Promise((r) => setTimeout(r, 0));
        }

        activeRun = null;
        ui.setRunning(false);
    }

    /**
     * Render benchmark UI into host element.
     * @param {HTMLElement} hostEl
     * @param {{ getConfig?: () => Object }} options
     */
    function renderHomeScreenBenchmarkUI(hostEl, options = {}) {
        if (!hostEl) return;

        cancelActiveRun(true);

        const getConfig = options.getConfig || (() => window.KefinHomeScreen?.getConfig?.() || {});

        ensureBenchmarkStyles();

        hostEl.innerHTML = `
            <div class="kefin-bench-wrap">
                <div class="listItemBodyText" style="font-weight:600; font-size:1.1em; margin-bottom:0.35em;">
                    Home Screen Section Benchmarks
                </div>
                <div class="listItemBodyText secondary" style="margin-bottom:0.5em;">
                    Test your home sections for slow queries or otherwise unintended results.
                    Timings reflect server round-trip per query (not full card render).
                </div>
                <div class="kefin-bench-cats" id="kefin-bench-cats"></div>
                <div id="kefin-bench-panel" class="kefin-bench-panel"></div>
                <div class="kefin-bench-actions">
                    <button type="button" class="emby-button raised button-submit kefin-bench-run-btn" id="kefin-bench-run">Run Benchmarks</button>
                    <button type="button" class="emby-button button-flat" id="kefin-bench-stop" hidden>Stop</button>
                    <button type="button" class="emby-button button-flat" id="kefin-bench-view-results" hidden>View Results</button>
                    <button type="button" class="emby-button button-flat" id="kefin-bench-edit" hidden>Edit Selection</button>
                </div>
                <div id="kefin-bench-results" style="margin-top:1.25em;"></div>
            </div>
        `;

        const catsEl = hostEl.querySelector('#kefin-bench-cats');
        const runBtn = hostEl.querySelector('#kefin-bench-run');
        const stopBtn = hostEl.querySelector('#kefin-bench-stop');
        const viewResultsBtn = hostEl.querySelector('#kefin-bench-view-results');
        const editBtn = hostEl.querySelector('#kefin-bench-edit');
        const panelEl = hostEl.querySelector('#kefin-bench-panel');
        const resultsEl = hostEl.querySelector('#kefin-bench-results');

        const enabledCats = new Set(CATEGORIES.map((c) => c.id));

        function getCurrentSections() {
            const config = typeof getConfig === 'function' ? getConfig() : {};
            return getSectionsForCategories(config, [...enabledCats]);
        }

        function getCheckedIdsFromPanel() {
            return Array.from(panelEl.querySelectorAll('.kefin-bench-pick:checked'))
                .map((cb) => cb.value);
        }

        function updatePickerCount() {
            const countEl = panelEl.querySelector('.kefin-bench-picker-count');
            if (!countEl) return;
            const total = panelEl.querySelectorAll('.kefin-bench-pick').length;
            const checked = panelEl.querySelectorAll('.kefin-bench-pick:checked').length;
            countEl.textContent = `${checked} of ${total} selected`;
        }

        function bindPickerToolbar() {
            panelEl.querySelector('#kefin-bench-run-top')
                ?.addEventListener('click', () => startRun());
            const selectAllBtn = panelEl.querySelector('#kefin-bench-select-all');
            const deselectAllBtn = panelEl.querySelector('#kefin-bench-deselect-all');
            selectAllBtn?.addEventListener('click', () => {
                panelEl.querySelectorAll('.kefin-bench-pick').forEach((cb) => { cb.checked = true; });
                updatePickerCount();
            });
            deselectAllBtn?.addEventListener('click', () => {
                panelEl.querySelectorAll('.kefin-bench-pick').forEach((cb) => { cb.checked = false; });
                updatePickerCount();
            });
            panelEl.querySelectorAll('.kefin-bench-pick').forEach((cb) => {
                cb.addEventListener('change', () => updatePickerCount());
            });
        }

        function showPickerPanel(preserveCheckedIds) {
            const sections = getCurrentSections();
            const stored = loadStoredSelectedIds();
            const storedSet = stored ? new Set(stored) : null;
            const checkedSet = preserveCheckedIds instanceof Set ? preserveCheckedIds : storedSet;

            panelEl.innerHTML = `
                <div class="kefin-bench-picker-toolbar">
                    <button type="button" class="emby-button raised button-submit kefin-bench-run-btn" id="kefin-bench-run-top">Run Benchmarks</button>
                    <button type="button" class="emby-button button-flat" id="kefin-bench-select-all">Select all</button>
                    <button type="button" class="emby-button button-flat" id="kefin-bench-deselect-all">Deselect all</button>
                    <span class="kefin-bench-picker-count"></span>
                </div>
                <div class="kefin-bench-picker-grid" id="kefin-bench-picker-grid">
                    ${buildPickerGridHtml(sections, checkedSet)}
                </div>
            `;
            bindPickerToolbar();
            updatePickerCount();
        }

        function showPicker() {
            cancelActiveRun(true);
            lastViewMode = 'picker';
            resultsEl.innerHTML = '';
            catsEl.hidden = false;
            panelEl.hidden = false;
            editBtn.hidden = true;
            viewResultsBtn.hidden = !hasStoredResults();
            ui.setRunning(false);
        }

        function showResults(entries, results) {
            lastViewMode = 'results';
            catsEl.hidden = true;
            panelEl.hidden = true;
            editBtn.hidden = false;
            viewResultsBtn.hidden = true;
            return renderResultsTable(resultsEl, entries, results);
        }

        const ui = {
            setRunning(running) {
                stopBtn.hidden = !running;
                hostEl.querySelectorAll('.kefin-bench-run-btn').forEach((btn) => {
                    btn.disabled = running;
                });
            }
        };

        function startRun() {
            if (activeRun) return;

            const sections = getCurrentSections();
            if (!sections.length) {
                window.KefinTweaksToaster?.toast?.('No sections in the selected categories.');
                return;
            }

            const selectedIds = getCheckedIdsFromPanel();
            if (!selectedIds.length) {
                window.KefinTweaksToaster?.toast?.('Select at least one section to benchmark.');
                return;
            }

            saveStoredSelectedIds(selectedIds);
            const idSet = new Set(selectedIds);
            const selected = sections.filter((e) => idSet.has(e.section.id));
            if (!selected.length) return;

            lastRun = { entries: selected, results: new Map() };
            const tbody = showResults(lastRun.entries, lastRun.results);
            runBenchmarks(lastRun.entries, tbody, ui, lastRun.results);
        }

        CATEGORIES.forEach((cat) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kefin-bench-cat-btn is-active';
            btn.dataset.cat = cat.id;
            btn.setAttribute('aria-pressed', 'true');
            btn.textContent = cat.label;
            btn.addEventListener('click', () => {
                if (activeRun) return;
                const prevChecked = new Set(getCheckedIdsFromPanel());
                if (enabledCats.has(cat.id)) {
                    enabledCats.delete(cat.id);
                    btn.classList.remove('is-active');
                    btn.setAttribute('aria-pressed', 'false');
                } else {
                    enabledCats.add(cat.id);
                    btn.classList.add('is-active');
                    btn.setAttribute('aria-pressed', 'true');
                }
                showPickerPanel(prevChecked);
            });
            catsEl.appendChild(btn);
        });

        stopBtn.addEventListener('click', () => cancelActiveRun(true));
        editBtn.addEventListener('click', () => showPicker());
        runBtn.addEventListener('click', () => startRun());
        viewResultsBtn.addEventListener('click', () => {
            if (!hasStoredResults()) return;
            showResults(lastRun.entries, lastRun.results);
        });

        showPickerPanel();

        if (lastViewMode === 'results' && hasStoredResults()) {
            showResults(lastRun.entries, lastRun.results);
        } else {
            showPicker();
        }
    }

    window.KefinHomeScreenBenchmark = {
        renderHomeScreenBenchmarkUI,
        cancelActiveRun
    };

    bindNavCancel();

    LOG('loaded');
})();
