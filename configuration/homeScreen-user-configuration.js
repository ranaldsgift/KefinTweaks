// KefinTweaks User Home Screen Configuration
// Allows users to customize their home screen by re-ordering and enabling/disabling sections

(function() {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks User HomeScreen Config]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks User HomeScreen Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks User HomeScreen Config]', ...args);

    // All Jellyfin home section base IDs (homesection0-8)
    const JELLYFIN_HOME_SECTIONS = [
        'smalllibrarytiles',
        'librarybuttons',
        'resume',
        'resumeaudio',
        'resumebook',
        'nextup',
        'latestmedia',
        'livetv',
        'activerecordings'
    ];

    // Map Jellyfin sections to their KefinTweaks equivalents
    // When a KefinTweaks section exists, it replaces the Jellyfin section in the UI
    const JELLYFIN_HOME_SECTIONS_MAP = {
        'smalllibrarytiles': 'my-media',
        'librarybuttons': 'my-media-small',
        'resume': 'continueWatching',
        'nextup': 'nextUp',
        'latestmedia': 'recently-added*' // Pattern match - any section starting with 'recently-added-'
    };

    /**
     * Flatten section groups into a flat array
     */
    function flattenSectionGroups(groups) {
        if (!Array.isArray(groups)) return [];
        const flattened = [];
        groups.forEach(group => {
            if (group && Array.isArray(group.sections)) {
                flattened.push(...group.sections);
            }
        });
        return flattened;
    }

    const SECTION_PREF_FIELD_COUNT = 21;
    const DEFAULT_PINNED_LIST_NAME = 'Pinned';
    const PINNED_LIST_ID_PREFIX = 'pinned-list-';
    const PINNED_PARENT_ID_PREFIX = 'pinned-parent-';
    /** Flex order slot for newly created pinned sections (admins can tune later). */
    const PINNED_DEFAULT_ORDER = 5;

    function createEmptyHomeScreen() {
        return {
            sections: [],
            pinnedLists: [],
            pinnedParents: []
            // pairNativeHomeSections omitted until user dirties the field
        };
    }

    function getServerPairNativeHomeSectionsDefault() {
        const settings = window.KefinHomeScreen?.getConfig?.()?.USER_HOME_SCREEN_SETTINGS
            || window.KefinHomeConfig2?.USER_HOME_SCREEN_SETTINGS
            || {};
        return settings.pairNativeHomeSections !== false;
    }

    /**
     * Effective pair-native setting: user override if present, else server default.
     */
    function resolvePairNativeHomeSections(homeScreen) {
        if (homeScreen && typeof homeScreen.pairNativeHomeSections === 'boolean') {
            return homeScreen.pairNativeHomeSections;
        }
        return getServerPairNativeHomeSectionsDefault();
    }

    /**
     * Disable all native Jellyfin home section slots (homesection0–9 = none).
     */
    function disableAllNativeHomeSections(customPrefs, { syncUi = false } = {}) {
        const prefs = customPrefs || {};
        let changed = false;
        for (let i = 0; i <= 9; i++) {
            const key = `homesection${i}`;
            const prev = prefs[key];
            const prevNorm = (!prev || prev === '') ? 'none' : String(prev).toLowerCase();
            if (prevNorm !== 'none' || prefs[key] !== 'none') {
                prefs[key] = 'none';
                if (prevNorm !== 'none' || prev !== 'none') changed = true;
            }
        }
        if (syncUi) {
            for (let i = 0; i <= 9; i++) {
                setNativeHomeSectionSelect(findNativeHomeSectionSelect(i + 1), 'none');
            }
        }
        if (changed) {
            LOG('Disabled all Jellyfin homesectionN (pair native off)');
        }
        return { slots: Array(10).fill('none'), changed };
    }

    function syncNativeHomeSectionsFromKefin(sections, customPrefs, homeScreen, { syncUi = false } = {}) {
        if (resolvePairNativeHomeSections(homeScreen)) {
            return enableJellyfinSectionsFromKefin(sections, customPrefs, { syncUi });
        }
        return disableAllNativeHomeSections(customPrefs, { syncUi });
    }

    function slugifyPinnedName(name) {
        return String(name || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'list';
    }

    function getPinnedListSectionId(listName) {
        return `${PINNED_LIST_ID_PREFIX}${slugifyPinnedName(listName)}`;
    }

    function getPinnedParentSectionId(parentId) {
        return `${PINNED_PARENT_ID_PREFIX}${parentId}`;
    }

    function parseSectionPrefString(str) {
        if (!str || typeof str !== 'string') return null;
        const parts = str.split(';');
        while (parts.length < SECTION_PREF_FIELD_COUNT) parts.push('');
        const id = parts[0];
        if (!id) return null;
        const enabledRaw = parts[1];
        const enabled = enabledRaw === '' ? true : enabledRaw === 'true';
        const result = { id, enabled };
        if (parts[2] !== '') {
            const order = parseInt(parts[2], 10);
            if (!Number.isNaN(order)) result.order = order;
        }
        if (parts[3] !== '') {
            const ttl = parseInt(parts[3], 10);
            if (!Number.isNaN(ttl)) result.ttl = ttl;
        }
        if (parts[4] !== '') result.cardFormat = parts[4];
        if (parts[5] !== '') {
            if (parts[5] === 'true') result.animationEnabled = true;
            else if (parts[5] === 'false') result.animationEnabled = false;
        }
        if (parts[6] === 'true') result.hideName = true;
        else if (parts[6] === 'false') result.hideName = false;
        if (parts[7] === 'true') result.hideCardTitles = true;
        else if (parts[7] === 'false') result.hideCardTitles = false;
        if (parts[8] !== '') result.cardTitlePosition = parts[8];
        if (parts[9] !== '') result.borderStyle = parts[9];
        if (parts[10] !== '') result.spotlightLayout = parts[10];
        if (parts[11] !== '') result.spotlightSize = parts[11];
        if (parts[12] !== '') {
            const tileCount = parseInt(parts[12], 10);
            if (!Number.isNaN(tileCount)) result.spotlightTileCount = tileCount;
        }
        // Field 13: itemsLayout row|grid (legacy true→grid, false/empty→row)
        if (parts[13] === 'true' || parts[13] === 'grid') result.itemsLayout = 'grid';
        else if (parts[13] === 'row' || parts[13] === 'false') result.itemsLayout = 'row';
        if (parts[14] !== '') result.cardTitleCapitalization = parts[14];
        if (parts[15] !== '') result.cardTitleFontFamily = parts[15];
        if (parts[16] !== '') result.cardTitleFontSize = parts[16];
        // Field 17: borderColor CSS color string
        if (parts[17] !== '') result.borderColor = parts[17];
        // Field 18: cardTitleColor CSS color string
        if (parts[18] !== '') result.cardTitleColor = parts[18];
        // Field 19: useGaplessCards
        if (parts[19] === 'true') result.useGaplessCards = true;
        else if (parts[19] === 'false') result.useGaplessCards = false;
        // Field 20: renderMode Normal|Spotlight|Random
        if (parts[20] !== '') {
            const renderMode = normalizeRenderMode(parts[20]);
            if (renderMode) result.renderMode = renderMode;
        }
        return result;
    }

    const RENDER_MODES = ['Normal', 'Spotlight', 'Random'];

    function normalizeRenderMode(value) {
        if (value == null || value === '') return null;
        const lower = String(value).trim().toLowerCase();
        return RENDER_MODES.find(mode => mode.toLowerCase() === lower) || null;
    }

    function resolveRenderMode(section) {
        return normalizeRenderMode(section?.renderMode)
            || (section?.spotlight === true ? 'Spotlight' : 'Normal');
    }

    function normalizeItemsLayout(value) {
        if (value === true || value === 'true' || value === 'grid') return 'grid';
        return 'row';
    }

    function appendBoolPrefField(fields, value, serverValue) {
        if (value === undefined) {
            fields.push('');
            return;
        }
        const normalized = value === true;
        const serverNormalized = serverValue === true;
        fields.push(normalized === serverNormalized ? '' : (normalized ? 'true' : 'false'));
    }

    function appendPrefField(fields, value, serverValue) {
        const normalized = value == null ? '' : String(value);
        const serverNormalized = serverValue == null ? '' : String(serverValue);
        fields.push(normalized !== '' && normalized !== serverNormalized ? normalized : '');
    }

    function isCustomSectionForPref(section) {
        if (!section) return false;
        if (section.isCustom === true) return true;
        if (section.dataset?.customSection === 'true') return true;
        const type = String(section.type || '').toLowerCase();
        if (type === 'custom' || type === 'custom-discovery') return true;
        return String(section.id || section.sectionId || '').startsWith('custom');
    }

    function isDiscoverySectionForPref(section) {
        if (!section) return false;
        if (section.dataset?.discoverySection === 'true') return true;
        if (section.discoveryEnabled === true || section.discoverySection === true) return true;
        if (section.discoveryType) return true;
        const type = String(section.type || '').toLowerCase();
        return type === 'discovery' || type === 'custom-discovery';
    }

    /** Home-surface sections persist layout in kefinTweaks.homeScreen; everything else uses sectionState. */
    function isHomeScreenSection(sectionOrType) {
        const t = typeof sectionOrType === 'string'
            ? sectionOrType
            : (sectionOrType?.type || '');
        const normalized = String(t).toLowerCase();
        // Unspecified type defaults to home surface (legacy sections / missing attrs)
        if (!normalized) return true;
        return ['home', 'seasonal', 'discovery'].includes(normalized);
    }

    function createEmptySectionState() {
        return { sections: [] };
    }

    function parseKefinTweaksSectionState(customPrefs) {
        if (!customPrefs) return createEmptySectionState();
        try {
            const parsed = typeof window.userHelper?.parseKefinTweaks === 'function'
                ? window.userHelper.parseKefinTweaks(customPrefs)
                : (() => {
                    const raw = customPrefs.kefinTweaks;
                    if (!raw) return null;
                    try {
                        return typeof raw === 'string' ? JSON.parse(raw) : raw;
                    } catch (e) {
                        return null;
                    }
                })();
            const ss = parsed?.sectionState;
            if (!ss || typeof ss !== 'object') return createEmptySectionState();
            return {
                sections: Array.isArray(ss.sections) ? ss.sections.filter((s) => typeof s === 'string') : []
            };
        } catch (e) {
            WARN('Failed to parse kefinTweaks sectionState:', e);
            return createEmptySectionState();
        }
    }

    async function saveKefinTweaksSectionState(sectionState, displayPrefs) {
        try {
            if (!window.userHelper?.setKefinTweaksFeature) {
                ERR('userHelper.setKefinTweaksFeature not available');
                return false;
            }
            const ok = await window.userHelper.setKefinTweaksFeature('sectionState', sectionState || createEmptySectionState());
            if (ok) LOG('kefinTweaks sectionState saved');
            return ok;
        } catch (e) {
            ERR('Error saving kefinTweaks sectionState:', e);
            return false;
        }
    }

    function findPrefStringInSections(sections, sectionId) {
        const storedId = getStoredSectionPrefId({ id: sectionId });
        if (!storedId) return null;
        return (sections || []).find((s) => {
            const pref = parseSectionPrefString(s);
            return pref?.id && getPrefDedupeKey(pref) === storedId;
        }) || null;
    }

    /**
     * Pref storage key for a section.
     * Non-custom discovery sections share one bucket keyed by the ID prefix
     * before the first hyphen (e.g. genreMovies-123-abc → genreMovies).
     * Custom discovery and all other sections keep the full ID.
     */
    function getStoredSectionPrefId(section) {
        const id = section?.id || section?.sectionId || '';
        if (!id) return id;
        if (isDiscoverySectionForPref(section) && !isCustomSectionForPref(section)) {
            const hyphen = id.indexOf('-');
            return hyphen === -1 ? id : id.slice(0, hyphen);
        }
        return id;
    }

    const DISCOVERY_INSTANCE_PREF_PATTERN = /^(.+)-(\d{10,})-([a-zA-Z0-9]+)$/;

    function isDiscoveryInstancePrefId(id) {
        if (!id || isCustomSectionForPref({ id })) return false;
        if (String(id).startsWith('pinned-')) return false;
        if (String(id).startsWith('recently-added-')) return false;
        if (String(id).startsWith('popular-genres-')) return false;
        return DISCOVERY_INSTANCE_PREF_PATTERN.test(String(id));
    }

    function getPrefDedupeKey(prefOrId) {
        const id = typeof prefOrId === 'string' ? prefOrId : prefOrId?.id;
        if (!id) return '';
        if (isDiscoveryInstancePrefId(id)) {
            return id.slice(0, id.indexOf('-'));
        }
        return id;
    }

    function prefStringRichness(prefString) {
        if (!prefString) return 0;
        const parts = String(prefString).split(';');
        let score = 0;
        for (let i = 2; i < parts.length; i++) {
            if (parts[i] !== '') score += 1;
        }
        return score;
    }

    function normalizePrefStringToDedupeKey(prefString) {
        const pref = parseSectionPrefString(prefString);
        if (!pref?.id) return prefString;
        const key = getPrefDedupeKey(pref);
        if (!key || pref.id === key) return prefString;
        const parts = prefString.split(';');
        parts[0] = key;
        return parts.join(';');
    }

    function sanitizeHomeScreenSections(homeScreen) {
        const home = homeScreen || createEmptyHomeScreen();
        const input = Array.isArray(home.sections) ? home.sections : [];
        const bestByKey = new Map();

        input.forEach((prefString, index) => {
            const pref = parseSectionPrefString(prefString);
            if (!pref?.id) return;
            const key = getPrefDedupeKey(pref);
            if (!key) return;
            const score = prefStringRichness(prefString);
            const isInstance = isDiscoveryInstancePrefId(pref.id);
            const existing = bestByKey.get(key);
            if (!existing) {
                bestByKey.set(key, { prefString, score, index, isInstance });
                return;
            }
            const better = score > existing.score
                || (score === existing.score && index > existing.index)
                || (!isInstance && existing.isInstance);
            if (better) {
                bestByKey.set(key, { prefString, score, index, isInstance });
            }
        });

        const ordered = [...bestByKey.entries()]
            .sort((a, b) => a[1].index - b[1].index)
            .map(([key, entry]) => normalizePrefStringToDedupeKey(entry.prefString));

        const removedCount = input.length - ordered.length;
        return {
            homeScreen: {
                ...home,
                sections: ordered
            },
            removedCount,
            changed: removedCount > 0
        };
    }

    function sectionConfigRichness(section) {
        if (!section) return 0;
        let score = 0;
        if (section.name) score += 1;
        if (section.queries?.length || section.items?.length) score += 2;
        if (section.jellyfinId || section.renderMode) score += 1;
        return score;
    }

    function deduplicateHomeScreenSections(sections) {
        if (!Array.isArray(sections)) return [];
        const result = [];
        const byId = new Map();
        sections.forEach((section) => {
            const id = section?.id;
            if (!id) return;
            const existing = byId.get(id);
            if (!existing) {
                byId.set(id, section);
                result.push(section);
                return;
            }
            if (sectionConfigRichness(section) > sectionConfigRichness(existing)) {
                const idx = result.indexOf(existing);
                if (idx >= 0) result[idx] = section;
                byId.set(id, section);
            }
        });
        return result;
    }

    let sanitizePersistInFlight = false;

    function serializeSectionPref(sectionId, enabled, overrides = {}, serverDefaults = {}) {
        const fields = [sectionId, enabled === false ? 'false' : 'true'];
        appendPrefField(fields, overrides.order, serverDefaults.order);
        appendPrefField(fields, overrides.ttl, serverDefaults.ttl);
        appendPrefField(fields, overrides.cardFormat, serverDefaults.cardFormat);
        let anim = overrides.animationEnabled;
        if (anim === undefined && overrides.panAnimation !== undefined) anim = overrides.panAnimation;
        const serverAnim = serverDefaults.animationEnabled ?? serverDefaults.panAnimation;
        appendBoolPrefField(fields, anim, serverAnim);
        appendBoolPrefField(fields, overrides.hideName, serverDefaults.hideName);
        appendBoolPrefField(fields, overrides.hideCardTitles, serverDefaults.hideCardTitles);
        appendPrefField(fields, overrides.cardTitlePosition, serverDefaults.cardTitlePosition);
        appendPrefField(fields, overrides.borderStyle, serverDefaults.borderStyle);
        appendPrefField(fields, overrides.spotlightLayout, serverDefaults.spotlightLayout);
        appendPrefField(fields, overrides.spotlightSize, serverDefaults.spotlightSize);
        appendPrefField(fields, overrides.spotlightTileCount, serverDefaults.spotlightTileCount);
        {
            const layout = normalizeItemsLayout(
                overrides.itemsLayout ?? (overrides.gridExpanded === true ? 'grid' : 'row')
            );
            const serverLayout = normalizeItemsLayout(
                serverDefaults.itemsLayout ?? (serverDefaults.gridExpanded === true ? 'grid' : 'row')
            );
            // Empty = default row; persist 'grid' as 'true' for legacy readers
            if (layout === serverLayout || layout === 'row') fields.push('');
            else if (layout === 'grid') fields.push('true');
            else fields.push('');
        }
        appendPrefField(fields, overrides.cardTitleCapitalization, serverDefaults.cardTitleCapitalization);
        appendPrefField(fields, overrides.cardTitleFontFamily, serverDefaults.cardTitleFontFamily);
        appendPrefField(fields, overrides.cardTitleFontSize, serverDefaults.cardTitleFontSize);
        appendPrefField(fields, overrides.borderColor, serverDefaults.borderColor);
        appendPrefField(fields, overrides.cardTitleColor, serverDefaults.cardTitleColor);
        appendBoolPrefField(fields, overrides.useGaplessCards, serverDefaults.useGaplessCards);
        appendPrefField(
            fields,
            normalizeRenderMode(overrides.renderMode),
            normalizeRenderMode(serverDefaults.renderMode) || 'Normal'
        );
        return fields.join(';');
    }

    function parsePinnedListString(str) {
        if (!str || typeof str !== 'string') return null;
        const parts = str.split(';');
        const name = parts[0];
        if (!name) return null;
        return { name, ids: parts.slice(1).filter(Boolean) };
    }

    function serializePinnedList(name, ids) {
        const uniqueIds = [...new Set((ids || []).filter(Boolean))];
        return [name, ...uniqueIds].join(';');
    }

    function parsePinnedParentString(str) {
        if (!str || typeof str !== 'string') return null;
        const parts = str.split(';');
        const name = parts[0];
        const parentId = parts[1];
        const parentType = parts[2] || null;
        if (!name || !parentId) return null;
        return { name, parentId, parentType };
    }

    function serializePinnedParent(name, parentId, parentType) {
        if (parentType) return `${name};${parentId};${parentType}`;
        return `${name};${parentId}`;
    }

    function buildPinnedParentQueryOptions(parent) {
        const parentId = parent?.parentId;
        const parentType = parent?.parentType;
        const base = {
            Limit: 16,
            SortBy: 'Random'
        };
        if (!parentId) return base;

        if (parentType === 'Genre' || parentType === 'MusicGenre') {
            const opts = { ...base, GenreIds: [parentId], Recursive: true };
            if (parentType === 'Genre') {
                opts.IncludeItemTypes = ['Movie', 'Series'];
            }
            return opts;
        }
        if (parentType === 'Studio') {
            return {
                ...base,
                StudioIds: [parentId],
                Recursive: true,
                IncludeItemTypes: ['Movie', 'Series']
            };
        }
        if (parentType === 'Person') {
            return {
                ...base,
                PersonIds: [parentId],
                Recursive: true,
                IncludeItemTypes: ['Movie', 'Series']
            };
        }
        if (parentType === 'Tag') {
            return {
                ...base,
                Tags: [parent.name].filter(Boolean),
                Recursive: true,
                IncludeItemTypes: ['Movie', 'Series']
            };
        }
        if (parentType === 'Series') {
            return { ...base, ParentId: parentId, ExcludeItemTypes: ['Season'] };
        }
        if (parentType === 'MusicArtist') {
            return { ...base, ParentId: parentId, ExcludeItemTypes: ['Audio'] };
        }
        return { ...base, ParentId: parentId };
    }

    function buildPinnedParentViewMoreUrl(parent, serverId) {
        const id = parent?.parentId;
        if (!id) return null;
        const sid = serverId != null ? String(serverId) : '';
        const type = parent?.parentType;
        if (type === 'Genre' || type === 'MusicGenre') {
            return `#/list.html?genreId=${encodeURIComponent(id)}&serverId=${encodeURIComponent(sid)}`;
        }
        if (type === 'Studio') {
            return `#/list.html?studioId=${encodeURIComponent(id)}&serverId=${encodeURIComponent(sid)}`;
        }
        return `#/details?id=${encodeURIComponent(id)}&serverId=${encodeURIComponent(sid)}`;
    }

    function migrateLegacyKefinHomeScreen(customPrefs) {
        const homeScreen = createEmptyHomeScreen();
        let legacy = [];
        if (customPrefs.kefinHomeScreen) {
            try {
                legacy = typeof customPrefs.kefinHomeScreen === 'string'
                    ? JSON.parse(customPrefs.kefinHomeScreen)
                    : (Array.isArray(customPrefs.kefinHomeScreen) ? customPrefs.kefinHomeScreen : []);
            } catch (e) {
                legacy = [];
            }
        }
        if (Array.isArray(legacy)) {
            legacy.forEach(entry => {
                if (!entry?.id) return;
                homeScreen.sections.push(serializeSectionPref(
                    entry.id,
                    entry.enabled !== false,
                    { order: entry.order },
                    {}
                ));
            });
        }
        return homeScreen;
    }

    function parseKefinTweaksHomeScreenRaw(customPrefs) {
        if (!customPrefs) return createEmptyHomeScreen();
        const parsed = typeof window.userHelper?.parseKefinTweaks === 'function'
            ? window.userHelper.parseKefinTweaks(customPrefs)
            : (() => {
                const raw = customPrefs.kefinTweaks;
                if (!raw) return null;
                try {
                    return typeof raw === 'string' ? JSON.parse(raw) : raw;
                } catch (e) {
                    WARN('Failed to parse kefinTweaks homeScreen:', e);
                    return null;
                }
            })();
        if (parsed) {
            const hs = parsed?.homeScreen || (Array.isArray(parsed?.sections) ? parsed : null);
            if (hs) {
                const result = {
                    sections: Array.isArray(hs.sections) ? [...hs.sections] : [],
                    pinnedLists: Array.isArray(hs.pinnedLists) ? [...hs.pinnedLists] : [],
                    pinnedParents: Array.isArray(hs.pinnedParents) ? [...hs.pinnedParents] : []
                };
                if (typeof hs.pairNativeHomeSections === 'boolean') {
                    result.pairNativeHomeSections = hs.pairNativeHomeSections;
                }
                return result;
            }
        }
        return migrateLegacyKefinHomeScreen(customPrefs);
    }

    function parseAndSanitizeKefinTweaksHomeScreen(customPrefs) {
        return sanitizeHomeScreenSections(parseKefinTweaksHomeScreenRaw(customPrefs));
    }

    function parseKefinTweaksHomeScreen(customPrefs) {
        return parseAndSanitizeKefinTweaksHomeScreen(customPrefs).homeScreen;
    }

    function getSectionPrefMap(homeScreen) {
        const map = new Map();
        (homeScreen?.sections || []).forEach(str => {
            const pref = parseSectionPrefString(str);
            if (!pref?.id) return;
            map.set(getPrefDedupeKey(pref), pref);
        });
        return map;
    }

    function upsertSectionPref(homeScreen, prefInput) {
        const home = homeScreen || createEmptyHomeScreen();
        const pref = typeof prefInput === 'string' ? parseSectionPrefString(prefInput) : prefInput;
        if (!pref?.id) return home;
        const storedKey = getPrefDedupeKey(pref);
        let serialized = typeof prefInput === 'string'
            ? prefInput
            : serializeSectionPref(storedKey, pref.enabled !== false, pref, pref.serverDefaults || {});
        serialized = normalizePrefStringToDedupeKey(serialized);
        const idx = home.sections.findIndex(s => {
            const existing = parseSectionPrefString(s);
            return existing?.id && getPrefDedupeKey(existing) === storedKey;
        });
        if (idx >= 0) home.sections[idx] = serialized;
        else home.sections.push(serialized);
        return home;
    }

    function removeSectionPref(homeScreen, sectionId) {
        const home = homeScreen || createEmptyHomeScreen();
        if (!sectionId) return home;
        const targetKey = getPrefDedupeKey(sectionId);
        home.sections = (home.sections || []).filter(s => {
            const pref = parseSectionPrefString(s);
            return !pref?.id || getPrefDedupeKey(pref) !== targetKey;
        });
        return home;
    }

    function setToastMessage(handle, message) {
        if (!handle?.element) return;
        const richMessage = handle.element.querySelector('.kefin-toast-message');
        if (richMessage) {
            richMessage.textContent = message;
        } else {
            handle.element.textContent = message;
        }
    }

    function createProgressToast(total) {
        const initialMessage = `Updating... (0/${total})`;
        if (!window.KefinTweaksToaster?.toast) {
            LOG(initialMessage);
            return {
                update(done) {
                    LOG(`Updating... (${done}/${total})`);
                },
                finish(done, failed) {
                    LOG(failed
                        ? `Updated ${done - failed}/${total} users (${failed} failed)`
                        : `Updated ${total} users`);
                }
            };
        }

        const handle = window.KefinTweaksToaster.toast(initialMessage, null, false);
        return {
            update(done) {
                setToastMessage(handle, `Updating... (${done}/${total})`);
            },
            finish(done, failed) {
                setToastMessage(
                    handle,
                    failed
                        ? `Updated ${done - failed}/${total} users (${failed} failed)`
                        : `Updated ${total} users`
                );
                setTimeout(() => handle?.dismiss?.(), 2500);
            }
        };
    }

    async function listServerUsers() {
        if (typeof ApiClient?.getUsers === 'function') {
            return ApiClient.getUsers();
        }
        const response = await fetch(`${ApiClient.serverAddress()}/Users`, {
            headers: { 'Authorization': window.apiHelper.getAuthHeader() }
        });
        if (!response.ok) throw new Error(`Failed to list users: ${response.status}`);
        return response.json();
    }

    async function saveHomeScreenForUser(userId, homeScreen, displayPrefs) {
        if (!displayPrefs) {
            displayPrefs = await window.userHelper.getUserDisplayPreferencesForUser(userId);
        }
        if (!displayPrefs.CustomPrefs) displayPrefs.CustomPrefs = {};
        const kefin = window.userHelper.parseKefinTweaks(displayPrefs);
        kefin.homeScreen = homeScreen;
        displayPrefs.CustomPrefs.kefinTweaks = JSON.stringify(kefin);
        const updateCache = userId === ApiClient.getCurrentUserId();
        return window.userHelper.updateDisplayPreferencesForUser(userId, displayPrefs, { updateCache });
    }

    /**
     * Remove one section override row from every user's homeScreen.sections.
     * @param {string} sectionId - Pref storage id (use getStoredSectionPrefId for discovery templates)
     * @param {{ onProgress?: Function }} [options]
     */
    async function updateUserHomeScreenSectionConfiguration(sectionId, options = {}) {
        if (!sectionId) return { done: 0, total: 0, failed: 0 };
        const users = await listServerUsers();
        const total = users.length;
        let done = 0;
        let failed = 0;
        const progressToast = createProgressToast(total);
        for (const user of users) {
            const userId = user.Id || user.id;
            const userName = user.Name || user.name || userId;
            try {
                const prefs = await window.userHelper.getUserDisplayPreferencesForUser(userId);
                let homeScreen = parseKefinTweaksHomeScreen(prefs?.CustomPrefs);
                const before = homeScreen.sections.length;
                homeScreen = removeSectionPref(homeScreen, sectionId);
                if (homeScreen.sections.length !== before) {
                    await saveHomeScreenForUser(userId, homeScreen, prefs);
                }
            } catch (e) {
                failed += 1;
                WARN(`Failed updating homeScreen section for ${userName}:`, e);
            }
            done += 1;
            options.onProgress?.({ done, total, failed, userName });
            progressToast.update(done);
        }
        progressToast.finish(done, failed);
        return { done, total, failed };
    }

    /**
     * Clear all section overrides for every user (pins preserved).
     * @param {{ onProgress?: Function }} [options]
     */
    async function updateUserHomeScreenConfiguration(options = {}) {
        const users = await listServerUsers();
        const total = users.length;
        let done = 0;
        let failed = 0;
        const progressToast = createProgressToast(total);
        for (const user of users) {
            const userId = user.Id || user.id;
            const userName = user.Name || user.name || userId;
            try {
                const prefs = await window.userHelper.getUserDisplayPreferencesForUser(userId);
                const homeScreen = parseKefinTweaksHomeScreen(prefs?.CustomPrefs);
                if ((homeScreen.sections || []).length > 0) {
                    homeScreen.sections = [];
                    await saveHomeScreenForUser(userId, homeScreen, prefs);
                }
            } catch (e) {
                failed += 1;
                WARN(`Failed clearing homeScreen sections for ${userName}:`, e);
            }
            done += 1;
            options.onProgress?.({ done, total, failed, userName });
            progressToast.update(done);
        }
        progressToast.finish(done, failed);
        return { done, total, failed };
    }

    /**
     * Resolve Jellyfin pairing id for a catalog section.
     * Prefer section.jellyfinId; fall back to map / recently-added-* pattern.
     */
    function resolveSectionJellyfinId(section) {
        if (!section) return null;
        if (section.jellyfinId) return String(section.jellyfinId).toLowerCase();
        const id = section.id || '';
        if (id.startsWith('recently-added-')) return 'latestmedia';
        for (const [jellyfinId, kefinId] of Object.entries(JELLYFIN_HOME_SECTIONS_MAP)) {
            if (jellyfinId === 'latestmedia' && id.startsWith('recently-added-')) return 'latestmedia';
            if (kefinId === id) return String(jellyfinId).toLowerCase();
        }
        return null;
    }

    /**
     * Pack enabled Kefin sections into 10 homesection slots via jellyfinId mapping.
     * kefinTweaks.homeScreen is the sole enable/order authority.
     * @returns {string[]} length 10, unused slots are 'none'
     */
    function buildHomesectionSlotsFromKefin(sections) {
        const collected = [];
        (sections || []).forEach((section) => {
            if (section.enabled !== true) return;
            const jellyfinId = resolveSectionJellyfinId(section);
            if (!jellyfinId || jellyfinId === 'none') return;

            const order = section.order || 0;
            collected.push({ jellyfinId, order });

            if (section.id === 'continueWatchingAndNextUp') {
                collected.push({ jellyfinId: 'nextup', order });
            }
        });

        collected.sort((a, b) => (a.order || 0) - (b.order || 0));
        const unique = collected.filter((entry, index, self) =>
            index === self.findIndex(s => s.jellyfinId === entry.jellyfinId)
        );

        const slots = [];
        for (let i = 0; i <= 9; i++) {
            slots.push(i < unique.length ? unique[i].jellyfinId : 'none');
        }
        return slots;
    }

    /**
     * Write homesection0–9 from enabled Kefin sections. Never enables/disables Kefin prefs.
     * @returns {{ slots: string[], changed: boolean }}
     */
    function enableJellyfinSectionsFromKefin(sections, customPrefs, { syncUi = false } = {}) {
        const prefs = customPrefs || {};
        const slots = buildHomesectionSlotsFromKefin(sections);
        let changed = false;

        for (let i = 0; i <= 9; i++) {
            const key = `homesection${i}`;
            const next = slots[i] || 'none';
            const prev = prefs[key];
            const prevNorm = (!prev || prev === '') ? 'none' : String(prev).toLowerCase();
            if (prevNorm !== next || prefs[key] !== next) {
                prefs[key] = next;
                if (prevNorm !== next || prev !== next) changed = true;
            }
        }

        if (syncUi) {
            for (let i = 0; i <= 9; i++) {
                setNativeHomeSectionSelect(findNativeHomeSectionSelect(i + 1), slots[i]);
            }
        }

        if (changed) {
            LOG('Synced Jellyfin homesectionN from Kefin homeScreen:', slots.filter(s => s !== 'none'));
        }
        return { slots, changed };
    }

    /**
     * Full home screen config for the current user (server sections + pins + overrides).
     * kefinTweaks.homeScreen is sole enable source; Jellyfin homesectionN is rewritten to match.
     * @returns {Promise<{ sections: Array, homeScreen: Object, serverSections: Array, pinnedSections: Array }>}
     */
    async function getConfig() {
        const sectionsApi = window.KefinHomeScreen?.getSections;
        if (!sectionsApi) {
            throw new Error('KefinHomeScreen.getSections is not available');
        }
        const { enabledHomeSections = [], enabledDiscoverySections = [] } = await Promise.resolve(sectionsApi());
        const serverSections = [...enabledHomeSections];

        let customPrefs = {};
        let displayPrefs = null;
        if (window.userHelper?.getUserDisplayPreferences) {
            const { promise } = await window.userHelper.getUserDisplayPreferences();
            displayPrefs = await promise;
            customPrefs = displayPrefs?.CustomPrefs || {};
        }

        const sanitizeResult = parseAndSanitizeKefinTweaksHomeScreen(customPrefs);
        const homeScreen = sanitizeResult.homeScreen;

        if (sanitizeResult.changed && displayPrefs && !sanitizePersistInFlight) {
            sanitizePersistInFlight = true;
            try {
                await saveKefinTweaksHomeScreen(homeScreen, displayPrefs);
                LOG(`Sanitized homeScreen prefs: removed ${sanitizeResult.removedCount} duplicate/stale rows`);
            } finally {
                sanitizePersistInFlight = false;
            }
        }

        const pinnedSections = buildPinnedSectionConfigs(homeScreen);
        const serverSectionsById = new Map();
        serverSections.forEach((section) => {
            if (section?.id) serverSectionsById.set(section.id, section);
        });

        let sections = deduplicateHomeScreenSections([...serverSections, ...pinnedSections]);
        sections = applyUserSectionOverrides(sections, homeScreen, { serverSectionsById });
        sections = sections.filter((section) => section.enabled || section.userConfigurable === true || section.userConfigurable === undefined);
        sections = deduplicateHomeScreenSections(sections);

        const jellyfinSync = syncNativeHomeSectionsFromKefin(sections, customPrefs, homeScreen, { syncUi: true });
        if (jellyfinSync.changed && displayPrefs && !sanitizePersistInFlight) {
            sanitizePersistInFlight = true;
            try {
                if (!displayPrefs.CustomPrefs) displayPrefs.CustomPrefs = customPrefs;
                const ok = await window.userHelper?.updateDisplayPreferences?.(displayPrefs);
                if (ok) {
                    LOG('Persisted Jellyfin homesectionN from Kefin homeScreen');
                } else {
                    WARN('Failed to persist Jellyfin homesectionN sync');
                }
            } finally {
                sanitizePersistInFlight = false;
            }
        }

        return {
            sections,
            homeScreen,
            serverSections,
            pinnedSections,
            enabledDiscoverySections
        };
    }

    function getServerSectionDefaults(section) {
        if (!section) return {};
        const spotlight = section.spotlightConfig || {};
        const id = String(section.id || '');
        const isPinned = id.startsWith(PINNED_LIST_ID_PREFIX) || id.startsWith(PINNED_PARENT_ID_PREFIX);
        return {
            renderMode: resolveRenderMode(section),
            order: isPinned ? PINNED_DEFAULT_ORDER : (section.order ?? 0),
            ttl: section.ttl,
            cardFormat: section.cardFormat,
            animationEnabled: spotlight.panAnimation !== false,
            panAnimation: spotlight.panAnimation !== false,
            hideName: section.hideName === true,
            hideCardTitles: section.cardTitleVisibility === 'hidden' || section.hideCardTitles === true,
            cardTitlePosition: section.cardTitlePosition || '',
            borderStyle: section.borderStyle || '',
            borderColor: section.borderColor || '',
            spotlightLayout: spotlight.spotlightLayout ?? 'Border',
            spotlightSize: spotlight.spotlightSize ?? 'normal',
            spotlightTileCount: parseInt(spotlight.tileCount, 10) || 1,
            itemsLayout: 'row',
            useGaplessCards: false,
            cardTitleCapitalization: section.cardTitleCapitalization || 'normal',
            cardTitleFontFamily: section.cardTitleFontFamily || 'default',
            cardTitleFontSize: section.cardTitleFontSize || 'normal',
            cardTitleColor: section.cardTitleColor || ''
        };
    }

    function applyUserSectionOverrides(sections, homeScreen, options = {}) {
        const prefMap = getSectionPrefMap(homeScreen);
        const serverById = options.serverSectionsById || new Map();

        return sections.map(section => {
            const storedId = getStoredSectionPrefId(section);
            const pref = prefMap.get(getPrefDedupeKey({ id: section.id }))
                || prefMap.get(storedId);
            let next = { ...section };

            // UI pref: apply for all sections (not gated by userConfigurable)
            if (pref?.itemsLayout && pref.itemsLayout !== 'row') next.itemsLayout = pref.itemsLayout;
            else if (pref?.gridExpanded === true) next.itemsLayout = 'grid';
            else delete next.itemsLayout;
            delete next.gridExpanded;
            if (pref?.useGaplessCards === true) next.useGaplessCards = true;
            else delete next.useGaplessCards;

            if (section.userConfigurable === false) return next;
            if (!pref) return next;
            const serverDefaults = getServerSectionDefaults(
                serverById.get(section.id) || serverById.get(storedId) || section
            );
            if (pref.enabled !== undefined) next.enabled = pref.enabled;
            if (pref.renderMode !== undefined) {
                next.renderMode = pref.renderMode;
                next.spotlight = pref.renderMode === 'Spotlight';
            }
            if (pref.order !== undefined) next.order = pref.order;
            if (pref.ttl !== undefined) next.ttl = pref.ttl;
            if (pref.cardFormat !== undefined) next.cardFormat = pref.cardFormat;
            if (pref.animationEnabled !== undefined) {
                next.spotlightConfig = {
                    ...(next.spotlightConfig || {}),
                    panAnimation: pref.animationEnabled
                };
            }
            if (pref.hideName !== undefined) {
                if (pref.hideName) next.hideName = true;
                else delete next.hideName;
            }
            if (pref.hideCardTitles !== undefined) {
                if (pref.hideCardTitles) {
                    next.cardTitleVisibility = 'hidden';
                    delete next.hideCardTitles;
                } else {
                    delete next.cardTitleVisibility;
                    delete next.hideCardTitles;
                }
            }
            if (pref.cardTitlePosition !== undefined) {
                if (pref.cardTitlePosition && pref.cardTitlePosition !== 'default') {
                    next.cardTitlePosition = pref.cardTitlePosition;
                } else {
                    delete next.cardTitlePosition;
                }
            }
            if (pref.cardTitleCapitalization !== undefined) {
                if (pref.cardTitleCapitalization && pref.cardTitleCapitalization !== 'normal') {
                    next.cardTitleCapitalization = pref.cardTitleCapitalization;
                } else {
                    delete next.cardTitleCapitalization;
                }
            }
            if (pref.cardTitleFontFamily !== undefined) {
                if (pref.cardTitleFontFamily && pref.cardTitleFontFamily !== 'default') {
                    next.cardTitleFontFamily = pref.cardTitleFontFamily;
                } else {
                    delete next.cardTitleFontFamily;
                }
            }
            if (pref.cardTitleFontSize !== undefined) {
                if (pref.cardTitleFontSize && pref.cardTitleFontSize !== 'normal') {
                    next.cardTitleFontSize = pref.cardTitleFontSize;
                } else {
                    delete next.cardTitleFontSize;
                }
            }
            if (pref.borderStyle !== undefined) {
                if (pref.borderStyle) next.borderStyle = pref.borderStyle;
                else delete next.borderStyle;
            }
            if (pref.borderColor !== undefined) {
                if (pref.borderColor) next.borderColor = pref.borderColor;
                else delete next.borderColor;
            }
            if (pref.cardTitleColor !== undefined) {
                if (pref.cardTitleColor) next.cardTitleColor = pref.cardTitleColor;
                else delete next.cardTitleColor;
            }
            if (pref.spotlightLayout !== undefined || pref.spotlightSize !== undefined || pref.spotlightTileCount !== undefined) {
                next.spotlightConfig = { ...(next.spotlightConfig || {}) };
                if (pref.spotlightLayout !== undefined) {
                    next.spotlightConfig.spotlightLayout = pref.spotlightLayout;
                }
                if (pref.spotlightSize !== undefined) {
                    next.spotlightConfig.spotlightSize = pref.spotlightSize;
                }
                if (pref.spotlightTileCount !== undefined) {
                    next.spotlightConfig.tileCount = pref.spotlightTileCount;
                }
            }
            next._userPrefDefaults = serverDefaults;
            return next;
        });
    }

    function buildPinnedSectionConfigs(homeScreen) {
        const configs = [];

        (homeScreen?.pinnedLists || []).forEach(listStr => {
            const list = parsePinnedListString(listStr);
            if (!list || !list.ids.length) return;
            const sectionId = getPinnedListSectionId(list.name);
            configs.push({
                id: sectionId,
                name: list.name,
                enabled: true,
                order: PINNED_DEFAULT_ORDER,
                userConfigurable: true,
                renderMode: 'Normal',
                cardFormat: 'Poster',
                queries: [{
                    _sourceType: 'static',
                    queryOptions: { Ids: [...list.ids] }
                }]
            });
        });

        (homeScreen?.pinnedParents || []).forEach(parentStr => {
            const parent = parsePinnedParentString(parentStr);
            if (!parent) return;
            const sectionId = getPinnedParentSectionId(parent.parentId);
            configs.push({
                id: sectionId,
                name: parent.name,
                enabled: true,
                order: PINNED_DEFAULT_ORDER,
                userConfigurable: true,
                renderMode: 'Normal',
                cardFormat: 'Poster',
                queries: [{
                    queryOptions: buildPinnedParentQueryOptions(parent)
                }]
            });
        });

        return configs;
    }

    async function loadKefinTweaksHomeScreenFromDisplayPrefs(customPrefs) {
        return parseKefinTweaksHomeScreen(customPrefs);
    }

    async function saveKefinTweaksHomeScreen(homeScreen, displayPrefs = null) {
        if (!window.userHelper?.setKefinTweaksFeature) {
            ERR('userHelper.setKefinTweaksFeature not available');
            return false;
        }
        try {
            // If caller passed displayPrefs, still use merge-safe set so siblings are preserved.
            // Refresh cache first when prefs were already loaded to avoid stale overwrites.
            if (displayPrefs?.CustomPrefs) {
                const sanitized = sanitizeHomeScreenSections(homeScreen).homeScreen;
                const kefin = window.userHelper.parseKefinTweaks(displayPrefs);
                kefin.homeScreen = sanitized;
                displayPrefs.CustomPrefs.kefinTweaks = JSON.stringify(kefin);
                displayPrefs.CustomPrefs.kefinHomeScreen = JSON.stringify(homeScreenToLegacyArray(sanitized));
                const ok = await window.userHelper.updateDisplayPreferences(displayPrefs);
                if (ok) LOG('kefinTweaks homeScreen saved');
                return ok;
            }
            const ok = await window.userHelper.setKefinTweaksFeature('homeScreen', homeScreen);
            if (ok) LOG('kefinTweaks homeScreen saved');
            return ok;
        } catch (e) {
            ERR('Error saving kefinTweaks homeScreen:', e);
            return false;
        }
    }

    /**
     * Persist items layout UI preference for a section (row|grid).
     * Home / seasonal / discovery → kefinTweaks.homeScreen; otherwise → kefinTweaks.sectionState.
     * Patches field 13 of the existing pref string so other overrides are preserved.
     * @param {string} sectionId
     * @param {string|boolean} layout - 'row'|'grid', or legacy true→grid
     * @param {{ type?: string }} [options]
     * @returns {Promise<boolean>}
     */
    async function saveSectionItemsLayout(sectionId, layout, options = {}) {
        if (!sectionId) return false;
        try {
            if (!window.userHelper?.getUserDisplayPreferences) {
                ERR('userHelper not available');
                return false;
            }
            const sectionEl = typeof document !== 'undefined'
                ? [...document.querySelectorAll('[data-section-id]')].find((el) => el.dataset.sectionId === String(sectionId))
                : null;
            const typeHint = options.type
                || sectionEl?.getAttribute?.('data-section-type')
                || sectionEl?.dataset?.sectionType
                || '';
            // series-episodes (and other non-home) must not fall through empty type → homeScreen
            const resolvedType = typeHint
                || (String(sectionId).startsWith('series-episodes-') ? 'series-episodes' : 'home');
            const storedId = getStoredSectionPrefId(sectionEl
                ? { id: sectionId, dataset: sectionEl.dataset, type: resolvedType }
                : { id: sectionId, type: resolvedType });
            const { promise } = await window.userHelper.getUserDisplayPreferences();
            const displayPrefs = await promise;
            const useHomeScreen = isHomeScreenSection(resolvedType);
            let bucket = useHomeScreen
                ? parseKefinTweaksHomeScreen(displayPrefs?.CustomPrefs)
                : parseKefinTweaksSectionState(displayPrefs?.CustomPrefs);
            const raw = findPrefStringInSections(bucket.sections, storedId)
                || findPrefStringInSections(bucket.sections, sectionId);
            const parts = (raw || `${storedId};true`).split(';');
            while (parts.length < SECTION_PREF_FIELD_COUNT) parts.push('');
            parts[0] = storedId;
            if (parts[1] === '') parts[1] = 'true';
            const normalized = normalizeItemsLayout(layout);
            // Empty = row; 'true' for grid (legacy)
            parts[13] = normalized === 'grid' ? 'true' : '';
            if (useHomeScreen) {
                bucket = upsertSectionPref(bucket, parts.join(';'));
                return await saveKefinTweaksHomeScreen(bucket, displayPrefs);
            }
            bucket = upsertSectionPref(bucket, parts.join(';'));
            return await saveKefinTweaksSectionState({ sections: bucket.sections || [] }, displayPrefs);
        } catch (e) {
            ERR('Error saving itemsLayout preference:', e);
            return false;
        }
    }

    /**
     * Persist useGaplessCards UI preference for a section (field 19).
     * @param {string} sectionId
     * @param {boolean} useGaplessCards
     * @param {{ type?: string }} [options]
     * @returns {Promise<boolean>}
     */
    async function saveSectionUseGaplessCards(sectionId, useGaplessCards, options = {}) {
        if (!sectionId) return false;
        try {
            if (!window.userHelper?.getUserDisplayPreferences) {
                ERR('userHelper not available');
                return false;
            }
            const sectionEl = typeof document !== 'undefined'
                ? [...document.querySelectorAll('[data-section-id]')].find((el) => el.dataset.sectionId === String(sectionId))
                : null;
            const typeHint = options.type
                || sectionEl?.getAttribute?.('data-section-type')
                || sectionEl?.dataset?.sectionType
                || '';
            const resolvedType = typeHint
                || (String(sectionId).startsWith('series-episodes-') ? 'series-episodes' : 'home');
            const storedId = getStoredSectionPrefId(sectionEl
                ? { id: sectionId, dataset: sectionEl.dataset, type: resolvedType }
                : { id: sectionId, type: resolvedType });
            const { promise } = await window.userHelper.getUserDisplayPreferences();
            const displayPrefs = await promise;
            const useHomeScreen = isHomeScreenSection(resolvedType);
            let bucket = useHomeScreen
                ? parseKefinTweaksHomeScreen(displayPrefs?.CustomPrefs)
                : parseKefinTweaksSectionState(displayPrefs?.CustomPrefs);
            const raw = findPrefStringInSections(bucket.sections, storedId)
                || findPrefStringInSections(bucket.sections, sectionId);
            const parts = (raw || `${storedId};true`).split(';');
            while (parts.length < SECTION_PREF_FIELD_COUNT) parts.push('');
            parts[0] = storedId;
            if (parts[1] === '') parts[1] = 'true';
            parts[19] = useGaplessCards === true ? 'true' : (useGaplessCards === false ? 'false' : '');
            if (useHomeScreen) {
                bucket = upsertSectionPref(bucket, parts.join(';'));
                return await saveKefinTweaksHomeScreen(bucket, displayPrefs);
            }
            bucket = upsertSectionPref(bucket, parts.join(';'));
            return await saveKefinTweaksSectionState({ sections: bucket.sections || [] }, displayPrefs);
        } catch (e) {
            ERR('Error saving useGaplessCards preference:', e);
            return false;
        }
    }

    /**
     * Read itemsLayout from homeScreen or sectionState for a section id.
     * @param {string} sectionId
     * @param {{ type?: string }} [options]
     * @returns {Promise<'row'|'grid'|null>}
     */
    async function loadSectionItemsLayout(sectionId, options = {}) {
        if (!sectionId) return null;
        try {
            if (!window.userHelper?.getUserDisplayPreferences) return null;
            const { promise } = await window.userHelper.getUserDisplayPreferences();
            const displayPrefs = await promise;
            const typeHint = options.type
                || (String(sectionId).startsWith('series-episodes-') ? 'series-episodes' : 'home');
            const bucket = isHomeScreenSection(typeHint)
                ? parseKefinTweaksHomeScreen(displayPrefs?.CustomPrefs)
                : parseKefinTweaksSectionState(displayPrefs?.CustomPrefs);
            const storedId = getStoredSectionPrefId({ id: sectionId, type: typeHint });
            const raw = findPrefStringInSections(bucket.sections, storedId)
                || findPrefStringInSections(bucket.sections, sectionId);
            if (!raw) return null;
            const pref = parseSectionPrefString(raw);
            return pref?.itemsLayout || null;
        } catch (e) {
            WARN('Error loading itemsLayout preference:', e);
            return null;
        }
    }

    /** @deprecated Use saveSectionItemsLayout */
    async function saveSectionGridExpanded(sectionId, gridExpanded) {
        if (gridExpanded === 'row' || gridExpanded === 'grid') {
            return saveSectionItemsLayout(sectionId, gridExpanded);
        }
        return saveSectionItemsLayout(sectionId, gridExpanded === true ? 'grid' : 'row');
    }

    function homeScreenToLegacyArray(homeScreen) {
        const seen = new Set();
        return (homeScreen?.sections || []).map(str => {
            const pref = parseSectionPrefString(str);
            if (!pref) return null;
            const key = getPrefDedupeKey(pref);
            if (!key || seen.has(key)) return null;
            seen.add(key);
            return {
                id: key,
                enabled: pref.enabled !== false,
                order: pref.order ?? 0
            };
        }).filter(Boolean);
    }

    /**
     * Get Jellyfin default sections from display preferences
     */
    function getJellyfinSectionsFromPrefs(displayPrefs) {
        const sections = [];
        const customPrefs = displayPrefs?.CustomPrefs || {};
        
        // Build a set of all base IDs that appear in any homesectionN field (0-8)
        const enabledBaseIds = new Set();
        for (let i = 0; i <= 8; i++) {
            const homesectionValue = customPrefs[`homesection${i}`];
            if (homesectionValue && homesectionValue !== '' && homesectionValue !== 'none') {
                enabledBaseIds.add(homesectionValue);
            }
        }
        
        // Parse user home screen section preferences
        const homeScreen = parseKefinTweaksHomeScreen(customPrefs);
        const kefinHomeScreen = homeScreenToLegacyArray(homeScreen);
        
        // Process each Jellyfin section
        JELLYFIN_HOME_SECTIONS.forEach((baseId, index) => {
            const homesectionKey = `homesection${index}`;
            
            // Section is enabled if its base ID appears in ANY homesectionN field (0-8)
            const isEnabled = enabledBaseIds.has(baseId);
            
            // Get order and enabled status from kefinHomeScreen if available
            let order = 0;
            let enabledFromPrefs = isEnabled; // Default to homesectionN value
            
            if (Array.isArray(kefinHomeScreen) && kefinHomeScreen.length > 0) {
                // Look for section by base ID (new format) or homesectionKey (old format for backward compatibility)
                const sectionPref = kefinHomeScreen.find(s => 
                    s.id === baseId || s.id === homesectionKey
                );
                if (sectionPref) {
                    if (sectionPref.order !== undefined) {
                        order = sectionPref.order;
                    }
                    if (sectionPref.enabled !== undefined) {
                        enabledFromPrefs = sectionPref.enabled;
                    }
                }
            }
            
            sections.push({
                id: baseId, // Use base ID directly, no -jellyfin suffix
                name: getJellyfinSectionName(baseId),
                enabled: enabledFromPrefs,
                order: order,
                hidden: false,
                isJellyfin: true,
                jellyfinBaseId: baseId, // Track the Jellyfin base ID
                homesectionKey: homesectionKey // Keep for backward compatibility
            });
        });
        
        return sections;
    }

    /**
     * Get display name for Jellyfin section
     */
    function getJellyfinSectionName(baseId) {
        const names = {
            'smalllibrarytiles': 'My Media',
            'librarybuttons': 'My Media (small)',
            'resume': 'Continue Watching',
            'resumeaudio': 'Continue Listening',
            'resumebook': 'Continue Reading',
            'nextup': 'Next Up',
            'latestmedia': 'Recently Added Media',
            'livetv': 'Live TV',
            'activerecordings': 'Active Recordings',
            'none': 'None'
        };
        return names[baseId] || baseId;
    }

    /** Label aliases for matching native select options across Jellyfin versions. */
    function getJellyfinSectionLabelAliases(baseId) {
        const primary = getJellyfinSectionName(baseId);
        const aliases = {
            resume: ['Continue Watching', 'Resume'],
            resumeaudio: ['Continue Listening', 'Resume Audio'],
            resumebook: ['Continue Reading', 'Resume Book'],
            latestmedia: ['Recently Added Media', 'Latest Media'],
            none: ['None']
        };
        const list = aliases[baseId] || (primary ? [primary] : []);
        if (primary && !list.includes(primary)) list.unshift(primary);
        return list;
    }

    function findNativeHomeSectionSelect(index1Based) {
        const id = `selectHomeSection${index1Based}`;
        const scoped = document.querySelector(`.homeScreenSettingsContainer #${id}`);
        if (scoped) return scoped;
        const page = document.querySelector('.libraryPage:not(.hide)');
        if (page) {
            const inPage = page.querySelector(`#${id}`);
            if (inPage) return inPage;
        }
        return document.getElementById(id);
    }

    /**
     * Resolve the option value to set on a native home-section select.
     * v12 often uses empty value="" for the default/selected option; match by label when needed.
     */
    function resolveNativeHomeSectionOptionValue(select, jellyfinId) {
        if (!select) return null;
        const target = (!jellyfinId || jellyfinId === 'none') ? 'none' : String(jellyfinId).toLowerCase();
        const options = Array.from(select.options || []);

        if (target !== 'none') {
            const byValue = options.find(o => o.value === target);
            if (byValue) return byValue.value;
        } else {
            const noneByValue = options.find(o => o.value === 'none');
            if (noneByValue) return noneByValue.value;
        }

        const labels = getJellyfinSectionLabelAliases(target).map(l => l.toLowerCase());
        const byLabel = options.find(o => labels.includes(String(o.textContent || '').trim().toLowerCase()));
        if (byLabel) return byLabel.value;

        if (target === 'none') return 'none';
        return null;
    }

    function setNativeHomeSectionSelect(select, jellyfinId) {
        if (!select) return;
        const value = resolveNativeHomeSectionOptionValue(select, jellyfinId);
        if (value === null) return;
        try {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        } catch (e) {
            WARN('Failed to sync native home section select UI:', e);
        }
    }

    /**
     * Load user preferences from display preferences
     * @param {Object} displayPrefs - Optional display preferences object to use instead of fetching
     */
    async function loadUserPreferences(displayPrefs = null) {
        try {
            if (!displayPrefs) {
                if (!window.userHelper || !window.userHelper.getUserDisplayPreferences) {
                    WARN('userHelper not available');
                    return { kefinHomeScreen: [], homesections: {} };
                }

                const { promise } = await window.userHelper.getUserDisplayPreferences();
                displayPrefs = await promise;
            }
            
            if (!displayPrefs || !displayPrefs.CustomPrefs) {
                return { kefinHomeScreen: [], homesections: {} };
            }

            const customPrefs = displayPrefs.CustomPrefs;
            const homeScreen = parseKefinTweaksHomeScreen(customPrefs);
            const kefinHomeScreen = homeScreenToLegacyArray(homeScreen);

            // Extract homesectionN values
            const homesections = {};
            for (let i = 0; i <= 8; i++) {
                const key = `homesection${i}`;
                homesections[key] = customPrefs[key] || 'none';
            }

            return {
                homeScreen,
                kefinHomeScreen: Array.isArray(kefinHomeScreen) ? kefinHomeScreen : [],
                homesections: homesections
            };
        } catch (error) {
            ERR('Error loading user preferences:', error);
            return { homeScreen: createEmptyHomeScreen(), kefinHomeScreen: [], homesections: {} };
        }
    }

    function mergeEditorSectionsIntoHomeScreen(homeScreen, editorSections, serverSectionsById) {
        const home = homeScreen || createEmptyHomeScreen();
        const editorIds = new Set(editorSections.map(s => getStoredSectionPrefId(s)));
        const kept = (home.sections || []).filter(str => {
            const pref = parseSectionPrefString(str);
            if (!pref?.id) return false;
            return !editorIds.has(getPrefDedupeKey(pref));
        });
        const updated = editorSections.map(section => {
            const storedId = getStoredSectionPrefId(section);
            const serverSection = serverSectionsById.get(section.id) || section;
            const existingRaw = (home.sections || []).find(s => {
                const pref = parseSectionPrefString(s);
                return pref?.id && getPrefDedupeKey(pref) === storedId;
            });
            const existing = parseSectionPrefString(existingRaw) || {};
            const serverDefaults = section._userPrefDefaults
                || getServerSectionDefaults(serverSection);
            return serializeSectionPref(
                storedId,
                section.enabled !== false,
                { ...existing, order: section.order },
                serverDefaults
            );
        });
        return sanitizeHomeScreenSections({
            ...home,
            sections: [...kept, ...updated]
        }).homeScreen;
    }

    async function buildServerSectionsById() {
        const map = new Map();
        if (!window.KefinHomeScreen?.getConfig) return map;
        try {
            const mergedConfig = await window.KefinHomeScreen.getConfig();
            const allGroups = [
                ...(mergedConfig.HOME_SECTION_GROUPS || []),
                ...(mergedConfig.SEASONAL_SECTION_GROUPS || []),
                ...(mergedConfig.DISCOVERY_SECTION_GROUPS || []),
                ...(mergedConfig.CUSTOM_SECTION_GROUPS || [])
            ];
            flattenSectionGroups(allGroups).forEach(section => {
                if (section?.id) map.set(section.id, section);
            });
        } catch (e) {
            WARN('Could not build server sections map:', e);
        }
        return map;
    }

    /**
     * Merge user preferences with sections (editor helper for Jellyfin native rows).
     * Kefin enable/disable comes from homeScreen prefs / catalog defaults only —
     * Jellyfin enable/order for native rows comes from CustomPrefs.homesectionN;
     * Kefin enable is owned by homeScreen prefs (see enableJellyfinSectionsFromKefin).
     */
    function mergeUserPreferences(sections, userPrefs, mergedConfig = null, displayPrefs = null) {
        const homeScreen = userPrefs.homeScreen || parseKefinTweaksHomeScreen(displayPrefs?.CustomPrefs);
        const prefMap = getSectionPrefMap(homeScreen);
        const customPrefs = displayPrefs?.CustomPrefs || {};

        // Build set of base IDs that appear in ANY homesectionN field (0-8) for Jellyfin sections
        const enabledJellyfinBaseIds = new Set();
        for (let i = 0; i <= 8; i++) {
            const homesectionValue = customPrefs[`homesection${i}`];
            if (homesectionValue && homesectionValue !== '' && homesectionValue !== 'none') {
                enabledJellyfinBaseIds.add(homesectionValue);
            }
        }

        // Helper to get default enabled status from config
        const getDefaultEnabled = (sectionId) => {
            if (!mergedConfig) return true; // Default to enabled if no config
            
            // Search through all section groups
            const allGroups = [
                ...(mergedConfig.HOME_SECTION_GROUPS || []),
                ...(mergedConfig.SEASONAL_SECTION_GROUPS || []),
                ...(mergedConfig.DISCOVERY_SECTION_GROUPS || []),
                ...(mergedConfig.CUSTOM_SECTION_GROUPS || [])
            ];
            
            for (const group of allGroups) {
                if (group.sections) {
                    const section = group.sections.find(s => s.id === sectionId);
                    if (section) {
                        return section.enabled !== false;
                    }
                }
            }
            
            return true; // Default to enabled if not found
        };

        // Helper to check if a section ID is a Jellyfin section
        const isJellyfinSection = (sectionId) => {
            return JELLYFIN_HOME_SECTIONS.includes(sectionId);
        };

        // Update sections with user preferences
        return sections.map(section => {
            const sectionId = section.id;
            let isEnabled;
            
            // For Jellyfin sections, check if base ID appears in any homesectionN field
            if (section.isJellyfin || isJellyfinSection(sectionId)) {
                const baseId = section.jellyfinBaseId || sectionId;
                isEnabled = enabledJellyfinBaseIds.has(baseId);
            } else {
                const pref = prefMap.get(getPrefDedupeKey({ id: sectionId }))
                    || prefMap.get(sectionId);
                const hasUserEnabledPref = pref && pref.enabled !== undefined;
                isEnabled = hasUserEnabledPref
                    ? pref.enabled
                    : getDefaultEnabled(sectionId);
            }
            
            const pref = prefMap.get(getPrefDedupeKey({ id: sectionId }))
                || prefMap.get(sectionId);
            const userOrder = pref?.order;
            
            return {
                ...section,
                enabled: isEnabled,
                order: userOrder !== undefined ? userOrder : (section.order || 0)
            };
        });
    }

    /**
     * Save user preferences to display preferences
     * @param {Array} sections
     * @param {{ pairNativeHomeSections?: boolean|null }} [options]
     *   pairNativeHomeSections: true/false to set override; null/undefined to leave unchanged;
     *   pass 'default' symbol via omitOverride to clear dirty override
     */
    async function saveUserPreferences(sections, options = {}) {
        try {
            if (!window.userHelper || !window.userHelper.getUserDisplayPreferences || !window.userHelper.updateDisplayPreferences) {
                ERR('userHelper not available');
                return false;
            }

            // Get current display preferences
            const { promise } = await window.userHelper.getUserDisplayPreferences();
            const displayPrefs = await promise;
            
            if (!displayPrefs) {
                ERR('Could not load display preferences');
                return false;
            }

            if (!displayPrefs.CustomPrefs) {
                displayPrefs.CustomPrefs = {};
            }

            const customPrefs = displayPrefs.CustomPrefs;

            // Build kefinTweaks.homeScreen with sparse section strings
            const existingHomeScreen = parseKefinTweaksHomeScreen(customPrefs);
            const serverSectionsById = await buildServerSectionsById();
            const homeScreen = sanitizeHomeScreenSections(
                mergeEditorSectionsIntoHomeScreen(existingHomeScreen, sections, serverSectionsById)
            ).homeScreen;

            // Preserve or update dirty-only pairNativeHomeSections
            if (Object.prototype.hasOwnProperty.call(options, 'pairNativeHomeSections')) {
                const serverDefault = getServerPairNativeHomeSectionsDefault();
                const next = options.pairNativeHomeSections;
                if (next === null || next === undefined) {
                    delete homeScreen.pairNativeHomeSections;
                } else if (next === serverDefault) {
                    delete homeScreen.pairNativeHomeSections;
                } else {
                    homeScreen.pairNativeHomeSections = next === true;
                }
            } else if (typeof existingHomeScreen.pairNativeHomeSections === 'boolean') {
                homeScreen.pairNativeHomeSections = existingHomeScreen.pairNativeHomeSections;
            }

            const kefin = typeof window.userHelper?.parseKefinTweaks === 'function'
                ? window.userHelper.parseKefinTweaks(customPrefs)
                : {};
            kefin.homeScreen = homeScreen;
            customPrefs.kefinTweaks = JSON.stringify(kefin);
            customPrefs.kefinHomeScreen = JSON.stringify(homeScreenToLegacyArray(homeScreen));

            // Rewrite Jellyfin homesectionN (+ native selects) from enabled Kefin sections
            syncNativeHomeSectionsFromKefin(sections, customPrefs, homeScreen, { syncUi: true });

            // Save
            const success = await window.userHelper.updateDisplayPreferences(displayPrefs);
            if (success) {
                LOG('User preferences saved successfully');
            } else {
                ERR('Failed to save user preferences');
            }
            return success;
        } catch (error) {
            ERR('Error saving user preferences:', error);
            return false;
        }
    }

    /**
     * Wait until admin homeScreen-configuration has registered getSections/getConfig.
     * Injector loads deps in parallel, so prefs can open before that API exists.
     */
    function waitForHomeScreenSectionsApi(timeoutMs = 15000, intervalMs = 100) {
        return new Promise((resolve) => {
            if (typeof window.KefinHomeScreen?.getSections === 'function'
                && typeof window.KefinHomeScreen?.getConfig === 'function') {
                resolve(true);
                return;
            }
            const start = Date.now();
            const timer = setInterval(() => {
                if (typeof window.KefinHomeScreen?.getSections === 'function'
                    && typeof window.KefinHomeScreen?.getConfig === 'function') {
                    clearInterval(timer);
                    resolve(true);
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, intervalMs);
        });
    }

    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Render user home sections editor
     */
    async function renderUserHomeSectionsEditor(container) {
        if (!container) {
            ERR('Container not provided');
            return;
        }

        try {
            container.innerHTML = '<div class="listItemBodyText secondary">Loading home sections…</div>';

            const apiReady = await waitForHomeScreenSectionsApi();
            if (!apiReady) {
                ERR('KefinHomeScreen.getSections not available');
                container.innerHTML = '<div class="listItemBodyText secondary">Error loading editor. Please refresh the page.</div>';
                return;
            }

            if (!window.KefinTweaksUI || !window.KefinTweaksUI.renderHomeSectionsOrderEditor) {
                ERR('KefinTweaksUI.renderHomeSectionsOrderEditor not available');
                container.innerHTML = '<div class="listItemBodyText secondary">Error loading editor. Please refresh the page.</div>';
                return;
            }

            // Resolved Kefin sections only (no Jellyfin-native duplicate rows)
            const userConfig = await getConfig();
            let allSections = (userConfig.sections || []).filter((s) => {
                if (s.userConfigurable === false) return false;
                if (s.type === 'discovery' || s.discoveryEnabled === true) return false;
                // Keep hidden sections only when currently enabled
                if (s.hidden === true && s.enabled === false) return false;
                return true;
            });

            // Sort by order
            allSections.sort((a, b) => (a.order || 0) - (b.order || 0));

            // Set any section types that aren't "seasonal" to "home"
            allSections.forEach(section => {
                if (section.type && section.type.toLowerCase() !== 'seasonal') {
                    section.type = 'home';
                }
            });

            // Create editor HTML
            const editorHTML = window.KefinTweaksUI.renderHomeSectionsOrderEditor(allSections, {
                showUpDownButtons: true
            });

            const serverPairDefault = getServerPairNativeHomeSectionsDefault();
            const effectivePair = resolvePairNativeHomeSections(userConfig.homeScreen);
            const pairDescOn = 'Do NOT enable this if you use the official Jellyfin for Roku or Android TV clients. When this is enabled, your Home Screen on those clients will be empty and you will need to go to your User Settings to re-enable sections.';
            const pairDescOff = 'Do NOT enable this if you use the official Jellyfin for Roku or Android TV clients. When this is enabled, your Home Screen on those clients will be empty and you will need to go to your User Settings to re-enable sections.';
            const pairToggleHTML = typeof window.KefinTweaksUI?.buildToggleCard === 'function'
                ? window.KefinTweaksUI.buildToggleCard(
                    'kefin-user-pair-native-home-sections',
                    !effectivePair,
                    'Improve Home Screen Performance',
                    !effectivePair ? pairDescOn : pairDescOff,
                    { hintKey: 'pairNativeHomeSections' }
                )
                : '';

            container.innerHTML = `
                <div class="verticalSection verticalSection-extrabottompadding">
                    <div class="sectionTitleContainer" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5em;">
                        <h2 class="sectionTitle">Home Sections Order</h2>
                        <button type="button" class="emby-button raised kefin-restore-defaults-btn" title="Restore Defaults" aria-label="Restore Defaults">
                            <span class="restoreBtn" aria-hidden="true"></span>
                        </button>
                    </div>
                    ${editorHTML}
                    ${pairToggleHTML ? `
                        <div class="verticalSection" style="margin-top: 1.5em;" id="kefin-user-pair-native-wrap">
                            ${pairToggleHTML}
                        </div>
                    ` : ''}
                </div>
            `;

            // Pair-native toggle: dirty-only persist (INVERTED UI: on in UI means flag == false)
            const pairCheckbox = container.querySelector('#kefin-user-pair-native-home-sections');
            const pairCard = pairCheckbox?.closest('.kefin-toggle-card');
            if (pairCheckbox && pairCard) {
                const pairSwitch = pairCard.querySelector('.kefin-toggle-switch, .toggle-slider, button');
                // When the toggle appears "on" in the UI, the flag is actually false (inverse)
                const updatePairDesc = (checked) => {
                    // checked (UI "on") means flag === false
                    const desc = pairCard.querySelector('.kefin-toggle-card-desc');
                    if (desc) desc.textContent = checked ? pairDescOn : pairDescOff;
                };
                const onPairToggle = async () => {
                    // checked (UI 'on') means flag should be false
                    const flagValue = !pairCheckbox.checked;
                    updatePairDesc(pairCheckbox.checked);
                    if (typeof window.KefinTweaksUI?.updateToggleSwitchUI === 'function' && pairSwitch) {
                        window.KefinTweaksUI.updateToggleSwitchUI(pairSwitch, pairCheckbox.checked);
                    }
                    // For persistence: (flagValue === serverPairDefault) ? null : flagValue
                    await saveUserPreferences(allSections, {
                        pairNativeHomeSections: flagValue === serverPairDefault ? null : flagValue
                    });
                };
                pairSwitch?.addEventListener('click', (e) => {
                    e.preventDefault();
                    pairCheckbox.checked = !pairCheckbox.checked;
                    onPairToggle();
                });
                pairCheckbox.addEventListener('change', onPairToggle);

                // On initial render, enforce the correct description and checked value
                // (in case render logic needs to set checked/unchecked based on flag)
                // (Optional: If not already being handled by upstream render logic)
                //pairCheckbox.checked = !effectivePair;
                updatePairDesc(pairCheckbox.checked);
            }

            // Restore Defaults: confirm then clear kefinHomeScreen and re-render
            const restoreBtn = container.querySelector('.kefin-restore-defaults-btn');
            if (restoreBtn && window.ModalSystem) {
                restoreBtn.addEventListener('click', () => {
                    const modalId = 'kefin-user-homescreen-restore-defaults';
                    const content = '<p class="listItemBodyText">Restoring the default Home Screen Settings will override your existing settings. Are you sure you want to proceed?</p>';
                    const footer = `
                        <button type="button" class="emby-button button-cancel button-flat" onclick="window.ModalSystem.close('${modalId}')">Cancel</button>
                        <button type="button" class="emby-button raised button-submit" id="kefin-restore-defaults-confirm">Proceed</button>
                    `;
                    window.ModalSystem.create({
                        id: modalId,
                        title: 'Restore Defaults',
                        content: content,
                        footer: footer,
                        closeOnBackdrop: true,
                        closeOnEscape: true,
                        showCloseButton: true,
                        onOpen: (modal) => {
                            const confirmBtn = modal.dialogFooter && modal.dialogFooter.querySelector('#kefin-restore-defaults-confirm');
                            if (confirmBtn) {
                                confirmBtn.addEventListener('click', async () => {
                                    try {
                                        if (!window.userHelper || !window.userHelper.getUserDisplayPreferences || !window.userHelper.updateDisplayPreferences) {
                                            WARN('userHelper not available');
                                            return;
                                        }
                                        const { promise } = await window.userHelper.getUserDisplayPreferences();
                                        const displayPrefs = await promise;
                                        if (!displayPrefs) {
                                            WARN('Could not load display preferences');
                                            return;
                                        }
                                        if (!displayPrefs.CustomPrefs) {
                                            displayPrefs.CustomPrefs = {};
                                        }
                                        const existing = parseKefinTweaksHomeScreen(displayPrefs.CustomPrefs);
                                        existing.sections = [];
                                        const kefin = typeof window.userHelper?.parseKefinTweaks === 'function'
                                            ? window.userHelper.parseKefinTweaks(displayPrefs)
                                            : {};
                                        kefin.homeScreen = existing;
                                        displayPrefs.CustomPrefs.kefinTweaks = JSON.stringify(kefin);
                                        displayPrefs.CustomPrefs.kefinHomeScreen = '[]';
                                        const ok = await window.userHelper.updateDisplayPreferences(displayPrefs);
                                        if (ok) {
                                            window.ModalSystem.close(modalId);
                                            await renderUserHomeSectionsEditor(container);
                                            if (window.KefinTweaksToaster && window.KefinTweaksToaster.toast) {
                                                window.KefinTweaksToaster.toast('Home Screen settings restored to defaults.');
                                            }
                                        } else {
                                            WARN('Failed to restore defaults');
                                        }
                                    } catch (e) {
                                        ERR('Error restoring defaults:', e);
                                    }
                                });
                            }
                        }
                    });
                });
            }

            // Setup event listeners
            // Find the sections-container which wraps both enabled and disabled lists
            const editorContainer = container.querySelector('.sections-container') || container.querySelector('.group-sections-list');
            if (editorContainer && window.KefinTweaksUI.setupOrderEditorListeners) {
                // Track current section state
                let currentSections = [...allSections];
                let isSaving = false;

                // Extract save logic into reusable function
                const performSave = async () => {
                    if (isSaving) return; // Prevent concurrent saves
                    isSaving = true;
                    
                    try {
                        // Read DOM order and update sections array
                        // Only read order from enabled sections list (disabled sections preserve their order)
                        const enabledList = container.querySelector('.enabled-sections-list') || editorContainer.querySelector('.enabled-sections-list');
                        const sectionIdToOrder = new Map();
                        
                        if (enabledList) {
                            // Get all section rows in enabled list in their current DOM order
                            const sectionRows = Array.from(enabledList.querySelectorAll('.section-row'));
                            
                            // Assign order values starting from 1, incrementing by 1 for each section in DOM order
                            sectionRows.forEach((row, index) => {
                                const sectionId = row.dataset.sectionId;
                                if (sectionId) {
                                    sectionIdToOrder.set(sectionId, index + 1);
                                }
                            });
                        }
                        
                        // Update order values in currentSections based on DOM order (only for enabled sections)
                        currentSections.forEach(section => {
                            const domOrder = sectionIdToOrder.get(section.id);
                            if (domOrder !== undefined) {
                                // Only update order if section is in enabled list
                                section.order = domOrder;
                            }
                            // Disabled sections keep their existing order value (not updated)
                        });
                        
                        await saveUserPreferences(currentSections);
                    } finally {
                        isSaving = false;
                    }
                };

                const handleToggleChange = async (sectionId, enabled) => {
                    const section = currentSections.find(s => (s.id || '') === sectionId);
                    if (section) {
                        section.enabled = enabled;
                    }
                    // Auto-save when toggle changes
                    await performSave();
                };

                // Setup listeners with auto-save on order changes
                window.KefinTweaksUI.setupOrderEditorListeners(editorContainer, {
                    onOrderChange: null, // Don't update order values during drag/drop, we'll read from DOM
                    onToggleChange: handleToggleChange,
                    getSectionOrder: null, // Not needed since we're not calculating orders
                    sections: currentSections,
                    onSave: performSave // Pass save function to be called on drag/drop and up/down
                });
            }

            LOG('User home sections editor rendered');
        } catch (error) {
            ERR('Error rendering user home sections editor:', error);
            container.innerHTML = '<div class="listItemBodyText secondary">Error loading editor. Please refresh the page.</div>';
        }
    }

    // Register onViewPage handler for mypreferenceshome page
    function registerPreferencesPageHandler() {
        if (!window.KefinTweaksUtils || !window.KefinTweaksUtils.onViewPage) {
            setTimeout(registerPreferencesPageHandler, 1000);
            return;
        }

        window.KefinTweaksUtils.onViewPage(async (view, element, hash) => {
            LOG('Preferences home page detected');

            let form = null;
            for (let attempt = 0; attempt < 20; attempt++) {
                form = document.querySelector('.libraryPage:not(.hide) .homeScreenSettingsContainer > form');
                if (form && form.firstChild) break;
                await delay(150);
            }

            if (!form || !form.firstChild) {
                WARN('Home settings form not ready');
                return;
            }

            if (form.querySelector('#kefin-user-home-sections-editor')) {
                return;
            }

            const editorContainer = document.createElement('div');
            editorContainer.id = 'kefin-user-home-sections-editor';
            form.appendChild(editorContainer);
            await renderUserHomeSectionsEditor(editorContainer);
        }, {
            pages: ['mypreferenceshome', 'userpreferences']
        });

        LOG('Registered preferences page handler');
    }

    // Initialize
    registerPreferencesPageHandler();

    // Expose render function globally
    window.KefinUserHomeScreenConfig = {
        renderUserHomeSectionsEditor,
        parseKefinTweaksHomeScreen,
        parseSectionPrefString,
        serializeSectionPref,
        getStoredSectionPrefId,
        upsertSectionPref,
        removeSectionPref,
        applyUserSectionOverrides,
        buildPinnedSectionConfigs,
        saveKefinTweaksHomeScreen,
        loadKefinTweaksHomeScreenFromDisplayPrefs,
        createEmptyHomeScreen,
        parsePinnedListString,
        serializePinnedList,
        parsePinnedParentString,
        serializePinnedParent,
        buildPinnedParentQueryOptions,
        buildPinnedParentViewMoreUrl,
        getPinnedListSectionId,
        getPinnedParentSectionId,
        getServerSectionDefaults,
        saveSectionItemsLayout,
        saveSectionUseGaplessCards,
        loadSectionItemsLayout,
        saveSectionGridExpanded,
        isHomeScreenSection,
        parseKefinTweaksSectionState,
        saveKefinTweaksSectionState,
        createEmptySectionState,
        normalizeItemsLayout,
        normalizeRenderMode,
        resolveRenderMode,
        DEFAULT_PINNED_LIST_NAME,
        PINNED_DEFAULT_ORDER,
        homeScreenToLegacyArray,
        getConfig,
        enableJellyfinSectionsFromKefin,
        syncNativeHomeSectionsFromKefin,
        resolvePairNativeHomeSections,
        getServerPairNativeHomeSectionsDefault,
        buildHomesectionSlotsFromKefin,
        resolveSectionJellyfinId,
        updateUserHomeScreenConfiguration,
        updateUserHomeScreenSectionConfiguration
    };

    LOG('User Home Screen Configuration loaded');

})();
