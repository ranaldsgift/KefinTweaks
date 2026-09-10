// KefinTweaks Item Version Preferences
// Reorders and sanitizes media source options on item details pages

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks VersionPreferences]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks VersionPreferences]', ...args);

    const NONE_SENTINEL = 'None';
    const DEFAULT_VERSIONS = ['4k', '2160p', '1080p', '720p', '576p', '480p', '360p', NONE_SENTINEL];
    const DEFAULT_EDITIONS = ['Theatrical', "Director's Cut", 'Extended Edition', 'Fan Edit', NONE_SENTINEL];

    const SELECTOR = '.itemDetailPage:not(.hide) .selectSourceContainer select.detailTrackSelect';
    const CONTAINER_SELECTOR = '.itemDetailPage:not(.hide) .selectSourceContainer';
    const ORIGINAL_ATTR = 'data-kefin-original-label';
    const SELECTED_INDEX_ATTR = 'data-selected-index';
    const CHANGE_BOUND_ATTR = 'data-kefin-vp-change-bound';

    function isNoneSentinel(term) {
        return typeof term === 'string' && term.trim().toLowerCase() === NONE_SENTINEL.toLowerCase();
    }

    /**
     * Keep exactly one "None" sentinel (canonical casing). Missing → append at end.
     */
    function ensureNoneSentinel(list) {
        const out = [];
        let noneSeen = false;
        (Array.isArray(list) ? list : []).forEach((term) => {
            if (typeof term !== 'string' || !term.trim()) return;
            if (isNoneSentinel(term)) {
                if (!noneSeen) {
                    out.push(NONE_SENTINEL);
                    noneSeen = true;
                }
                return;
            }
            out.push(term.trim());
        });
        if (!noneSeen) out.push(NONE_SENTINEL);
        return out;
    }

    function getDefaults() {
        return {
            versions: DEFAULT_VERSIONS.slice(),
            editions: DEFAULT_EDITIONS.slice(),
            showVersionBeforeEdition: false
        };
    }

    function getPreferences() {
        const defaults = getDefaults();
        const cfg = window.KefinTweaksConfig?.versionPreferences || {};
        return {
            versions: ensureNoneSentinel(
                Array.isArray(cfg.versions) ? cfg.versions : defaults.versions
            ),
            editions: ensureNoneSentinel(
                Array.isArray(cfg.editions) ? cfg.editions : defaults.editions
            ),
            showVersionBeforeEdition: cfg.showVersionBeforeEdition === true
        };
    }

    function indexOfNone(terms) {
        const idx = (terms || []).findIndex(isNoneSentinel);
        return idx >= 0 ? idx : (terms || []).length;
    }

    /**
     * Highest-priority (earliest array index) case-insensitive substring match.
     * Skips the "None" sentinel — it is not a text match.
     * @returns {{ term: string, index: number } | null}
     */
    function findBestTerm(label, terms) {
        if (!label || !Array.isArray(terms) || !terms.length) return null;
        const haystack = String(label).toLowerCase();
        for (let i = 0; i < terms.length; i++) {
            const term = terms[i];
            if (typeof term !== 'string' || !term.trim()) continue;
            if (isNoneSentinel(term)) continue;
            if (haystack.includes(term.toLowerCase())) {
                return { term, index: i };
            }
        }
        return null;
    }

    function getOriginalLabel(option) {
        if (!option) return '';
        if (option.hasAttribute(ORIGINAL_ATTR)) {
            return option.getAttribute(ORIGINAL_ATTR) || '';
        }
        const label = option.textContent || '';
        option.setAttribute(ORIGINAL_ATTR, label);
        return label;
    }

    function sanitizeLabel(editionTerm, versionTerm, showVersionBeforeEdition = false) {
        if (editionTerm && versionTerm) {
            return showVersionBeforeEdition
                ? `${versionTerm} - ${editionTerm}`
                : `${editionTerm} - ${versionTerm}`;
        }
        if (editionTerm) return editionTerm;
        if (versionTerm) return versionTerm;
        return null;
    }

    function desiredLabel(desc) {
        if (desc.hasMatch) {
            const { showVersionBeforeEdition } = getPreferences();
            return sanitizeLabel(desc.editionTerm, desc.versionTerm, showVersionBeforeEdition) ?? desc.originalLabel;
        }
        return desc.originalLabel;
    }

    function rankOptions(options, prefs) {
        const noneEditionIndex = indexOfNone(prefs.editions);
        const noneVersionIndex = indexOfNone(prefs.versions);

        const descriptors = Array.from(options).map((option, originalIndex) => {
            const originalLabel = getOriginalLabel(option);
            const editionMatch = findBestTerm(originalLabel, prefs.editions);
            const versionMatch = findBestTerm(originalLabel, prefs.versions);
            const hasMatch = !!(editionMatch || versionMatch);
            return {
                option,
                originalIndex,
                originalLabel,
                hasMatch,
                editionIndex: editionMatch ? editionMatch.index : noneEditionIndex,
                versionIndex: versionMatch ? versionMatch.index : noneVersionIndex,
                editionTerm: editionMatch?.term || null,
                versionTerm: versionMatch?.term || null
            };
        });

        descriptors.sort((a, b) => {
            if (a.editionIndex !== b.editionIndex) return a.editionIndex - b.editionIndex;
            if (a.versionIndex !== b.versionIndex) return a.versionIndex - b.versionIndex;
            return a.originalIndex - b.originalIndex;
        });

        return descriptors;
    }

    function isSelectInExpectedState(select, ranked) {
        const options = Array.from(select.options);
        if (options.length !== ranked.length) return false;
        for (let i = 0; i < ranked.length; i++) {
            if (options[i] !== ranked[i].option) return false;
            if (options[i].textContent !== desiredLabel(ranked[i])) return false;
        }
        return true;
    }

    function parseSelectedIndexAttr(select) {
        if (!select?.hasAttribute(SELECTED_INDEX_ATTR)) return null;
        const raw = select.getAttribute(SELECTED_INDEX_ATTR);
        const idx = parseInt(raw, 10);
        return Number.isFinite(idx) ? idx : null;
    }

    function bindSelectedIndexTracker(select) {
        if (!select || select.hasAttribute(CHANGE_BOUND_ATTR)) return;
        select.setAttribute(CHANGE_BOUND_ATTR, 'true');
        select.addEventListener('change', () => {
            select.setAttribute(SELECTED_INDEX_ATTR, String(select.selectedIndex));
        });
    }

    function applyToSelect(select) {
        if (!select || !select.options?.length) return false;

        bindSelectedIndexTracker(select);

        const prefs = getPreferences();
        const previousValue = select.value;
        const savedIndex = parseSelectedIndexAttr(select);
        const ranked = rankOptions(select.options, prefs);

        if (isSelectInExpectedState(select, ranked)) {
            return false;
        }

        isApplying = true;
        try {
            ranked.forEach((desc, i) => {
                const label = desiredLabel(desc);
                if (desc.option.textContent !== label) {
                    desc.option.textContent = label;
                }
                if (select.options[i] !== desc.option) {
                    select.appendChild(desc.option);
                }
            });

            const maxIndex = select.options.length - 1;
            let targetIndex = 0;
            if (savedIndex != null && savedIndex >= 0 && savedIndex <= maxIndex) {
                targetIndex = savedIndex;
            }

            const targetValue = select.options[targetIndex]?.value;
            if (targetValue != null && targetValue !== '') {
                if (select.selectedIndex !== targetIndex) {
                    select.selectedIndex = targetIndex;
                }
                if (select.value !== targetValue) {
                    select.value = targetValue;
                }
                if (targetValue !== previousValue) {
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            select.setAttribute(SELECTED_INDEX_ATTR, String(select.selectedIndex));

            LOG('Applied version preferences to detailTrackSelect', {
                count: ranked.length,
                selectedIndex: select.selectedIndex,
                selected: select.value,
                restored: savedIndex != null
            });
            return true;
        } finally {
            isApplying = false;
        }
    }

    function findSourceSelect() {
        return document.querySelector(SELECTOR);
    }

    let observer = null;
    let applyScheduled = false;
    let isApplying = false;

    function disconnectObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        applyScheduled = false;
    }

    function tryApply() {
        if (isApplying) return false;
        const select = findSourceSelect();
        if (!select || !select.options?.length) return false;
        return applyToSelect(select);
    }

    function scheduleTryApply() {
        if (isApplying || applyScheduled) return;
        applyScheduled = true;
        requestAnimationFrame(() => {
            applyScheduled = false;
            if (!observer) return;
            tryApply();
        });
    }

    function isDetailsHash(hash) {
        const h = hash || window.location.hash || '';
        return h.includes('details.html') || h.includes('/details');
    }

    function isRelevantMutation(mutations) {
        for (const mutation of mutations) {
            if (mutation.type !== 'childList') continue;

            const target = mutation.target;
            if (target?.matches?.('select.detailTrackSelect')) return true;
            if (target?.tagName === 'OPTION' && !target.hasAttribute(ORIGINAL_ATTR)) return true;

            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                if (node.matches?.('select.detailTrackSelect')) return true;
                if (node.matches?.('option') && !node.hasAttribute(ORIGINAL_ATTR)) return true;
                if (node.querySelector?.('select.detailTrackSelect, option')) return true;
            }
        }
        return false;
    }

    function observeForSelect() {
        disconnectObserver();

        tryApply();

        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) {
            return;
        }

        observer = new MutationObserver((mutations) => {
            if (isApplying) return;
            if (!isRelevantMutation(mutations)) return;
            scheduleTryApply();
        });
        observer.observe(container, { childList: true, subtree: true });
    }

    function onDetailsPage() {
        observeForSelect();
    }

    function init() {
        if (!window.KefinTweaksUtils?.onViewPage) {
            WARN('KefinTweaksUtils.onViewPage unavailable');
            return;
        }

        window.KefinTweaksUtils.onViewPage(() => {
            try {
                onDetailsPage();
            } catch (err) {
                WARN('Failed to apply version preferences', err);
            }
        }, { pages: ['details'] });

        window.KefinTweaksUtils.onViewPage((_view, _element, hash) => {
            if (!isDetailsHash(hash)) {
                disconnectObserver();
            }
        });

        LOG('Initialized');
    }

    window.KefinVersionPreferences = {
        NONE_SENTINEL,
        getDefaults,
        getPreferences,
        ensureNoneSentinel,
        isNoneSentinel,
        findBestTerm,
        isSelectInExpectedState,
        applyToSelect
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
