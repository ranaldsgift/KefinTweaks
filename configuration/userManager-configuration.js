// KefinTweaks User Manager Configuration UI — User Templates

(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks UserManager Config]', ...args);
    const ERR = (...args) => console.error('[KefinTweaks UserManager Config]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks UserManager Config]', ...args);

    const CONFIG_MODAL_ID = 'kefin-usermanager-config';
    const EDITOR_MODAL_ID = 'kefin-usermanager-template-editor';
    const TAG_MODAL_ID = 'kefin-usermanager-tag-modal';
    const SCHEDULE_MODAL_ID = 'kefin-usermanager-schedule-modal';

    const DEFAULT_AUTH = 'Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider';
    const DEFAULT_PASSWORD_RESET = 'Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider';

    const UNRATED_TYPES = [
        { type: 'Book', label: 'Books' },
        { type: 'ChannelContent', label: 'Channels' },
        { type: 'LiveTvChannel', label: 'Live TV' },
        { type: 'Movie', label: 'Movies' },
        { type: 'Music', label: 'Music' },
        { type: 'Trailer', label: 'Trailers' },
        { type: 'Series', label: 'Shows' }
    ];

    const DAYS = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
        'Everyday', 'Weekday', 'Weekend'
    ];

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj ?? {}));
    }

    function getSeedPolicy() {
        return {
            IsAdministrator: false,
            IsHidden: false,
            EnableCollectionManagement: false,
            EnableSubtitleManagement: false,
            EnableLyricManagement: false,
            IsDisabled: false,
            BlockedTags: [],
            AllowedTags: [],
            EnableUserPreferenceAccess: true,
            AccessSchedules: [],
            BlockUnratedItems: [],
            EnableRemoteControlOfOtherUsers: false,
            EnableSharedDeviceControl: true,
            EnableRemoteAccess: true,
            EnableLiveTvManagement: true,
            EnableLiveTvAccess: true,
            EnableMediaPlayback: true,
            EnableAudioPlaybackTranscoding: true,
            EnableVideoPlaybackTranscoding: true,
            EnablePlaybackRemuxing: true,
            ForceRemoteSourceTranscoding: false,
            EnableContentDeletion: false,
            EnableContentDeletionFromFolders: [],
            EnableContentDownloading: true,
            EnableSyncTranscoding: true,
            EnableMediaConversion: true,
            EnabledDevices: [],
            EnableAllDevices: true,
            EnabledChannels: [],
            EnableAllChannels: true,
            EnabledFolders: [],
            EnableAllFolders: true,
            InvalidLoginAttemptCount: 0,
            LoginAttemptsBeforeLockout: -1,
            MaxActiveSessions: 0,
            EnablePublicSharing: true,
            BlockedMediaFolders: [],
            BlockedChannels: [],
            RemoteClientBitrateLimit: 0,
            AuthenticationProviderId: DEFAULT_AUTH,
            PasswordResetProviderId: DEFAULT_PASSWORD_RESET,
            SyncPlayAccess: 'CreateAndJoinGroups'
        };
    }

    function normalizeConfig(raw) {
        const cfg = raw && typeof raw === 'object' ? raw : {};
        const templates = Array.isArray(cfg.templates)
            ? cfg.templates.filter((t) => t && typeof t.name === 'string' && t.name.trim())
            : [];
        let defaultTemplateName = typeof cfg.defaultTemplateName === 'string' ? cfg.defaultTemplateName : '';
        if (defaultTemplateName && !templates.some((t) => t.name === defaultTemplateName)) {
            defaultTemplateName = '';
        }
        return { defaultTemplateName, templates };
    }

    function loadConfig() {
        return normalizeConfig(window.KefinTweaksConfig?.userManager);
    }

    async function saveConfig(next) {
        try {
            if (!window.KefinTweaksConfig) window.KefinTweaksConfig = {};
            window.KefinTweaksConfig.userManager = normalizeConfig(next);

            if (window.KefinTweaksUtils?.saveConfigToJavaScriptInjector) {
                await window.KefinTweaksUtils.saveConfigToJavaScriptInjector();
                LOG('Configuration saved');
                return true;
            }
            if (window.KefinTweaksConfiguration?.findJavaScriptInjectorPlugin) {
                const pluginId = await window.KefinTweaksConfiguration.findJavaScriptInjectorPlugin();
                if (pluginId) {
                    await window.KefinTweaksConfiguration.saveConfigToJavaScriptInjector(window.KefinTweaksConfig);
                    LOG('Configuration saved (fallback)');
                    return true;
                }
            }
            ERR('saveConfigToJavaScriptInjector not available');
            return false;
        } catch (e) {
            ERR('Error saving config:', e);
            return false;
        }
    }

    async function fetchMediaFolders() {
        try {
            const url = ApiClient.getUrl('Library/MediaFolders');
            const data = await ApiClient.getJSON(url);
            return Array.isArray(data?.Items) ? data.Items : (Array.isArray(data) ? data : []);
        } catch (e) {
            WARN('Failed to load media folders', e);
            return [];
        }
    }

    function buildCheckbox(id, checked, label, options) {
        return window.KefinTweaksUI?.buildCheckbox?.(id, checked, label, options) || '';
    }

    function hourOptions(selected) {
        const opts = [];
        for (let h = 0; h <= 24; h += 0.5) {
            const hours = Math.floor(h) % 12 || 12;
            const mins = h % 1 ? '30' : '00';
            const ampm = h < 12 || h === 24 ? 'AM' : 'PM';
            const label = h === 24 ? '12:00 AM' : `${hours}:${mins} ${ampm}`;
            opts.push(`<option value="${h}" ${Number(selected) === h ? 'selected' : ''}>${label}</option>`);
        }
        return opts.join('');
    }

    function formatScheduleTime(h) {
        const n = Number(h);
        if (!Number.isFinite(n)) return '';
        if (n === 24) return '12:00 AM';
        const hours = Math.floor(n) % 12 || 12;
        const mins = n % 1 ? '30' : '00';
        const ampm = n < 12 ? 'AM' : 'PM';
        return `${hours}:${mins} ${ampm}`;
    }

    function bitrateToMbps(bps) {
        const n = Number(bps) || 0;
        if (n <= 0) return '';
        return String(Math.round((n / 1000000) * 100) / 100);
    }

    function mbpsToBitrate(mbps) {
        const n = parseFloat(mbps);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.round(n * 1000000);
    }

    function buildTagListHTML(tags, listClass) {
        if (!tags?.length) {
            return `<div class="listItemBodyText secondary ${listClass}-empty">No tags</div>`;
        }
        return tags.map((tag, i) => `
            <div class="listItem paperList" style="margin-bottom:0.35em;">
                <div class="listItemBody"><h3 class="listItemBodyText">${escapeHtml(tag)}</h3></div>
                <button type="button" class="emby-button raised um-delete-tag" data-list="${listClass}" data-index="${i}" title="Delete">
                    <span class="material-icons" style="font-size:1.1em;">delete</span>
                </button>
            </div>`).join('');
    }

    function buildScheduleListHTML(schedules) {
        if (!schedules?.length) {
            return `<div class="listItemBodyText secondary um-schedules-empty">No access schedules</div>`;
        }
        return schedules.map((s, i) => `
            <div class="listItem paperList um-schedule-row" style="margin-bottom:0.35em;"
                data-day="${escapeHtml(s.DayOfWeek)}" data-start="${s.StartHour}" data-end="${s.EndHour}">
                <div class="listItemBody two-line">
                    <h3 class="listItemBodyText">${escapeHtml(s.DayOfWeek)}</h3>
                    <div class="listItemBodyText secondary">${formatScheduleTime(s.StartHour)} - ${formatScheduleTime(s.EndHour)}</div>
                </div>
                <button type="button" class="emby-button raised um-delete-schedule" data-index="${i}" title="Delete">
                    <span class="material-icons" style="font-size:1.1em;">delete</span>
                </button>
            </div>`).join('');
    }

    function buildEditorHTML(template, folders) {
        const policy = { ...getSeedPolicy(), ...(template?.policy || {}) };
        const name = template?.name || '';
        const enabledFolders = new Set(policy.EnabledFolders || []);
        const deleteFolders = new Set(policy.EnableContentDeletionFromFolders || []);
        const blockUnrated = new Set(policy.BlockUnratedItems || []);
        const allowedTags = policy.AllowedTags || [];
        const blockedTags = policy.BlockedTags || [];
        const schedules = policy.AccessSchedules || [];

        const folderChecks = folders.map((f) => {
            const id = f.Id || f.id;
            const label = f.Name || f.name || id;
            return buildCheckbox('', enabledFolders.has(id), label, {
                className: 'um-folder',
                wrapInSection: true,
                dataAttributes: { id }
            });
        }).join('');

        const deleteFolderChecks = folders.map((f) => {
            const id = f.Id || f.id;
            const label = f.Name || f.name || id;
            return buildCheckbox('', deleteFolders.has(id), label, {
                className: 'um-delete-folder',
                wrapInSection: true,
                dataAttributes: { id }
            });
        }).join('');

        const unratedChecks = UNRATED_TYPES.map((u) =>
            buildCheckbox('', blockUnrated.has(u.type), u.label, {
                className: 'um-unrated',
                wrapInSection: true,
                dataAttributes: { itemtype: u.type }
            })
        ).join('');

        return `
            <div class="um-template-editor" style="max-width:100%;">
                <div class="inputContainer">
                    <label class="inputLabel" for="um-template-name">Template name</label>
                    <input id="um-template-name" class="emby-input" type="text" required value="${escapeHtml(name)}" placeholder="e.g. Standard">
                </div>

                <div class="verticalSection">
                    <h2 class="paperListLabel">Permissions</h2>
                    <div class="checkboxList paperList" style="padding:0.5em 1em;">
                        ${buildCheckbox('', !!policy.EnableRemoteAccess, 'Allow remote connections to this server', { className: 'um-chk-remote', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.IsAdministrator, 'Allow this user to manage the server', { className: 'um-chk-admin', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableCollectionManagement, 'Allow this user to manage collections', { className: 'um-chk-collections', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableSubtitleManagement, 'Allow this user to edit subtitles', { className: 'um-chk-subtitles', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableLyricManagement, 'Allow this user to manage lyrics', { className: 'um-chk-lyrics', wrapInSection: true })}
                    </div>
                </div>

                <div class="verticalSection">
                    <h2 class="paperListLabel">Feature access</h2>
                    <div class="checkboxList paperList" style="padding:0.5em 1em;">
                        ${buildCheckbox('', !!policy.EnableLiveTvAccess, 'Allow Live TV access', { className: 'um-chk-livetv', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableLiveTvManagement, 'Allow Live TV recording management', { className: 'um-chk-livetv-mgmt', wrapInSection: true })}
                    </div>
                </div>

                <div class="verticalSection">
                    <h2 class="paperListLabel">Media playback</h2>
                    <div class="checkboxList paperList" style="padding:0.5em 1em;">
                        ${buildCheckbox('', !!policy.EnableMediaPlayback, 'Allow media playback', { className: 'um-chk-playback', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableAudioPlaybackTranscoding, 'Allow audio playback that requires transcoding', { className: 'um-chk-audio-tc', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableVideoPlaybackTranscoding, 'Allow video playback that requires transcoding', { className: 'um-chk-video-tc', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnablePlaybackRemuxing, 'Allow video playback that requires conversion without re-encoding', { className: 'um-chk-remux', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.ForceRemoteSourceTranscoding, 'Force transcoding of remote media sources such as Live TV', { className: 'um-chk-force-remote-tc', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableSyncTranscoding, 'Allow sync transcoding', { className: 'um-chk-sync-tc', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableMediaConversion, 'Allow media conversion', { className: 'um-chk-conversion', wrapInSection: true })}
                    </div>
                    <div class="inputContainer" style="margin-top:0.75em;">
                        <label class="inputLabel" for="um-bitrate">Internet streaming bitrate limit (Mbps)</label>
                        <input id="um-bitrate" class="emby-input" type="number" min="0" step="0.25" value="${escapeHtml(bitrateToMbps(policy.RemoteClientBitrateLimit))}">
                        <div class="fieldDescription">Leave empty or 0 for no per-user limit.</div>
                    </div>
                    <div class="selectContainer" style="margin-top:0.75em;">
                        <label class="selectLabel" for="um-syncplay">SyncPlay access</label>
                        <select id="um-syncplay" class="emby-select-withcolor emby-select">
                            <option value="CreateAndJoinGroups" ${policy.SyncPlayAccess === 'CreateAndJoinGroups' ? 'selected' : ''}>Allow user to create and join groups</option>
                            <option value="JoinGroups" ${policy.SyncPlayAccess === 'JoinGroups' ? 'selected' : ''}>Allow user to join groups</option>
                            <option value="None" ${policy.SyncPlayAccess === 'None' ? 'selected' : ''}>Disabled for this user</option>
                        </select>
                    </div>
                </div>

                <div class="verticalSection">
                    <h2 class="checkboxListLabel" style="margin-bottom:1em;">Allow media deletion from</h2>
                    <div class="checkboxList paperList checkboxList-paperList">
                        ${buildCheckbox('', !!policy.EnableContentDeletion, 'All libraries', { className: 'um-chk-delete-all', wrapInSection: true })}
                        <div class="um-delete-folders checkboxList" style="${policy.EnableContentDeletion ? 'display:none;' : ''}">
                            ${deleteFolderChecks || '<div class="fieldDescription">No libraries found</div>'}
                        </div>
                    </div>
                </div>

                <div class="verticalSection">
                    <h2 class="checkboxListLabel">Remote Control</h2>
                    <div class="checkboxList paperList" style="padding:0.5em 1em;">
                        ${buildCheckbox('', !!policy.EnableRemoteControlOfOtherUsers, 'Allow remote control of other users', { className: 'um-chk-remote-others', wrapInSection: true })}
                        ${buildCheckbox('', !!policy.EnableSharedDeviceControl, 'Allow remote control of shared devices', { className: 'um-chk-remote-shared', wrapInSection: true })}
                    </div>
                </div>

                <div class="verticalSection">
                    <h2 class="checkboxListLabel">Other</h2>
                    ${buildCheckbox('', !!policy.EnableContentDownloading, 'Allow media downloads', { className: 'um-chk-download', wrapInSection: true })}
                    ${buildCheckbox('', !!policy.EnableUserPreferenceAccess, 'Allow user preference access', { className: 'um-chk-prefs', wrapInSection: true })}
                    ${buildCheckbox('', !!policy.EnablePublicSharing, 'Allow public sharing', { className: 'um-chk-public-share', wrapInSection: true })}
                    ${buildCheckbox('', !!policy.IsDisabled, 'Disable this user', { className: 'um-chk-disabled', wrapInSection: true })}
                    ${buildCheckbox('', !!policy.IsHidden, 'Hide this user from login screens', { className: 'um-chk-hidden', wrapInSection: true })}
                    <div class="inputContainer" style="margin-top:0.75em;">
                        <label class="inputLabel" for="um-lockout">Failed login tries before user is locked out</label>
                        <input id="um-lockout" class="emby-input" type="number" min="-1" step="1" value="${escapeHtml(policy.LoginAttemptsBeforeLockout ?? -1)}">
                        <div class="fieldDescription">-1 disables lockout. 0 inherits server default.</div>
                    </div>
                    <div class="inputContainer">
                        <label class="inputLabel" for="um-max-sessions">Maximum number of simultaneous user sessions</label>
                        <input id="um-max-sessions" class="emby-input" type="number" min="0" step="1" value="${escapeHtml(policy.MaxActiveSessions ?? 0)}">
                        <div class="fieldDescription">0 disables the limit.</div>
                    </div>
                </div>

                <div class="verticalSection folderAccessContainer">
                    <h2>Library Access</h2>
                    ${buildCheckbox('', !!policy.EnableAllFolders, 'Enable access to all libraries', { className: 'um-chk-all-folders', wrapInSection: true })}
                    <div class="um-folder-list" style="${policy.EnableAllFolders ? 'display:none;' : ''}">
                        <h3 class="checkboxListLabel">Libraries</h3>
                        <div class="checkboxList paperList" style="padding:0.5em 1em;">
                            ${folderChecks || '<div class="fieldDescription">No libraries found</div>'}
                        </div>
                    </div>
                </div>

                <div class="verticalSection">
                    <h3 class="checkboxListLabel">Block items with no or unrecognized rating information</h3>
                    <div class="checkboxList paperList" style="padding:0.5em 1em;">${unratedChecks}</div>
                </div>

                <div class="verticalSection" style="margin-bottom:1.5em;">
                    <div class="sectionTitleContainer flex align-items-center" style="display:flex;align-items:center;gap:0.5em;">
                        <h2 class="sectionTitle" style="margin:0;">Allow items with tags</h2>
                        <button type="button" class="emby-button raised um-add-allowed-tag" title="Add">
                            <span class="material-icons" style="font-size:1.1em;">add</span>
                        </button>
                    </div>
                    <div class="fieldDescription">Only show media with at least one of the specified tags.</div>
                    <div class="um-allowed-tags" style="margin-top:0.5em;">${buildTagListHTML(allowedTags, 'allowed')}</div>
                </div>

                <div class="verticalSection" style="margin-bottom:1.5em;">
                    <div class="sectionTitleContainer flex align-items-center" style="display:flex;align-items:center;gap:0.5em;">
                        <h2 class="sectionTitle" style="margin:0;">Block items with tags</h2>
                        <button type="button" class="emby-button raised um-add-blocked-tag" title="Add">
                            <span class="material-icons" style="font-size:1.1em;">add</span>
                        </button>
                    </div>
                    <div class="fieldDescription">Hide media with at least one of the specified tags.</div>
                    <div class="um-blocked-tags" style="margin-top:0.5em;">${buildTagListHTML(blockedTags, 'blocked')}</div>
                </div>

                <div class="verticalSection" style="margin-bottom:1.5em;">
                    <div class="sectionTitleContainer flex align-items-center" style="display:flex;align-items:center;gap:0.5em;">
                        <h2 class="sectionTitle" style="margin:0;">Access Schedule</h2>
                        <button type="button" class="emby-button raised um-add-schedule" title="Add">
                            <span class="material-icons" style="font-size:1.1em;">add</span>
                        </button>
                    </div>
                    <p class="fieldDescription">Limit access to certain hours.</p>
                    <div class="um-schedules">${buildScheduleListHTML(schedules)}</div>
                </div>
            </div>
        `;
    }

    function collectCheckedIds(root, selector) {
        return Array.from(root.querySelectorAll(`${selector}:checked`))
            .map((el) => el.getAttribute('data-id'))
            .filter(Boolean);
    }

    function collectPolicyFromEditor(root, state) {
        const enableAllFolders = !!root.querySelector('.um-chk-all-folders')?.checked;
        const enableContentDeletion = !!root.querySelector('.um-chk-delete-all')?.checked;

        return {
            ...getSeedPolicy(),
            IsAdministrator: !!root.querySelector('.um-chk-admin')?.checked,
            IsHidden: !!root.querySelector('.um-chk-hidden')?.checked,
            EnableCollectionManagement: !!root.querySelector('.um-chk-collections')?.checked,
            EnableSubtitleManagement: !!root.querySelector('.um-chk-subtitles')?.checked,
            EnableLyricManagement: !!root.querySelector('.um-chk-lyrics')?.checked,
            IsDisabled: !!root.querySelector('.um-chk-disabled')?.checked,
            BlockedTags: state.blockedTags.slice(),
            AllowedTags: state.allowedTags.slice(),
            EnableUserPreferenceAccess: !!root.querySelector('.um-chk-prefs')?.checked,
            AccessSchedules: state.schedules.map((s) => ({ ...s })),
            BlockUnratedItems: Array.from(root.querySelectorAll('.um-unrated:checked'))
                .map((el) => el.getAttribute('data-itemtype'))
                .filter(Boolean),
            EnableRemoteControlOfOtherUsers: !!root.querySelector('.um-chk-remote-others')?.checked,
            EnableSharedDeviceControl: !!root.querySelector('.um-chk-remote-shared')?.checked,
            EnableRemoteAccess: !!root.querySelector('.um-chk-remote')?.checked,
            EnableLiveTvManagement: !!root.querySelector('.um-chk-livetv-mgmt')?.checked,
            EnableLiveTvAccess: !!root.querySelector('.um-chk-livetv')?.checked,
            EnableMediaPlayback: !!root.querySelector('.um-chk-playback')?.checked,
            EnableAudioPlaybackTranscoding: !!root.querySelector('.um-chk-audio-tc')?.checked,
            EnableVideoPlaybackTranscoding: !!root.querySelector('.um-chk-video-tc')?.checked,
            EnablePlaybackRemuxing: !!root.querySelector('.um-chk-remux')?.checked,
            ForceRemoteSourceTranscoding: !!root.querySelector('.um-chk-force-remote-tc')?.checked,
            EnableContentDeletion: enableContentDeletion,
            EnableContentDeletionFromFolders: enableContentDeletion
                ? []
                : collectCheckedIds(root, '.um-delete-folder'),
            EnableContentDownloading: !!root.querySelector('.um-chk-download')?.checked,
            EnableSyncTranscoding: !!root.querySelector('.um-chk-sync-tc')?.checked,
            EnableMediaConversion: !!root.querySelector('.um-chk-conversion')?.checked,
            EnabledDevices: [],
            EnableAllDevices: true,
            EnabledChannels: [],
            EnableAllChannels: true,
            EnabledFolders: enableAllFolders ? [] : collectCheckedIds(root, '.um-folder'),
            EnableAllFolders: enableAllFolders,
            LoginAttemptsBeforeLockout: parseInt(root.querySelector('#um-lockout')?.value ?? '-1', 10),
            MaxActiveSessions: parseInt(root.querySelector('#um-max-sessions')?.value ?? '0', 10),
            EnablePublicSharing: !!root.querySelector('.um-chk-public-share')?.checked,
            RemoteClientBitrateLimit: mbpsToBitrate(root.querySelector('#um-bitrate')?.value),
            AuthenticationProviderId: DEFAULT_AUTH,
            PasswordResetProviderId: DEFAULT_PASSWORD_RESET,
            SyncPlayAccess: root.querySelector('#um-syncplay')?.value || 'CreateAndJoinGroups'
        };
    }

    function promptText(title, placeholder) {
        return new Promise((resolve) => {
            const content = document.createElement('div');
            content.innerHTML = `
                <div class="inputContainer">
                    <label class="inputLabel" for="um-tag-input">${escapeHtml(title)}</label>
                    <input id="um-tag-input" class="emby-input" type="text" placeholder="${escapeHtml(placeholder || '')}">
                </div>`;
            const footer = document.createElement('div');
            footer.style.cssText = 'display:flex;gap:0.75em;justify-content:flex-end;';
            footer.innerHTML = `
                <button type="button" class="emby-button raised" id="um-tag-cancel">Cancel</button>
                <button type="button" class="emby-button raised button-submit" id="um-tag-ok">Add</button>`;

            const modal = window.ModalSystem.create({
                id: TAG_MODAL_ID,
                title,
                content,
                footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (m) => {
                    const input = m.dialogContent.querySelector('#um-tag-input');
                    const finish = (val) => {
                        window.ModalSystem.close(TAG_MODAL_ID);
                        resolve(val);
                    };
                    m.dialogFooter.querySelector('#um-tag-cancel')?.addEventListener('click', () => finish(null));
                    m.dialogFooter.querySelector('#um-tag-ok')?.addEventListener('click', () => {
                        finish(input?.value?.trim() || null);
                    });
                    input?.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            finish(input.value.trim() || null);
                        }
                    });
                    setTimeout(() => input?.focus(), 50);
                },
                onClose: () => resolve(null)
            });
            if (modal?.dialog) {
                modal.dialog.style.maxWidth = '420px';
                modal.dialog.style.width = '90vw';
            }
        });
    }

    function promptSchedule() {
        return new Promise((resolve) => {
            const dayOpts = DAYS.map((d) => `<option value="${d}">${d === 'Everyday' ? 'Every day' : d === 'Weekday' ? 'Weekdays' : d === 'Weekend' ? 'Weekends' : d}</option>`).join('');
            const content = document.createElement('div');
            content.innerHTML = `
                <div class="selectContainer">
                    <label class="selectLabel" for="um-sched-day">Day of week</label>
                    <select id="um-sched-day" class="emby-select-withcolor emby-select">${dayOpts}</select>
                </div>
                <div class="selectContainer">
                    <label class="selectLabel" for="um-sched-start">Start time</label>
                    <select id="um-sched-start" class="emby-select-withcolor emby-select">${hourOptions(0)}</select>
                </div>
                <div class="selectContainer">
                    <label class="selectLabel" for="um-sched-end">End time</label>
                    <select id="um-sched-end" class="emby-select-withcolor emby-select">${hourOptions(24)}</select>
                </div>`;
            const footer = document.createElement('div');
            footer.style.cssText = 'display:flex;gap:0.75em;justify-content:flex-end;';
            footer.innerHTML = `
                <button type="button" class="emby-button raised" id="um-sched-cancel">Cancel</button>
                <button type="button" class="emby-button raised button-submit" id="um-sched-ok">Add</button>`;

            let settled = false;
            const finish = (val) => {
                if (settled) return;
                settled = true;
                window.ModalSystem.close(SCHEDULE_MODAL_ID);
                resolve(val);
            };

            const modal = window.ModalSystem.create({
                id: SCHEDULE_MODAL_ID,
                title: 'Access Schedule',
                content,
                footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true,
                onOpen: (m) => {
                    m.dialogFooter.querySelector('#um-sched-cancel')?.addEventListener('click', () => finish(null));
                    m.dialogFooter.querySelector('#um-sched-ok')?.addEventListener('click', () => {
                        const DayOfWeek = m.dialogContent.querySelector('#um-sched-day')?.value;
                        const StartHour = parseFloat(m.dialogContent.querySelector('#um-sched-start')?.value);
                        const EndHour = parseFloat(m.dialogContent.querySelector('#um-sched-end')?.value);
                        if (!DayOfWeek || !Number.isFinite(StartHour) || !Number.isFinite(EndHour) || EndHour <= StartHour) {
                            window.KefinTweaksToaster?.toast?.('End time must be after start time');
                            return;
                        }
                        finish({ DayOfWeek, StartHour, EndHour });
                    });
                },
                onClose: () => finish(null)
            });
            if (modal?.dialog) {
                modal.dialog.style.maxWidth = '420px';
                modal.dialog.style.width = '90vw';
            }
        });
    }

    function refreshTagLists(root, state) {
        const allowedEl = root.querySelector('.um-allowed-tags');
        const blockedEl = root.querySelector('.um-blocked-tags');
        if (allowedEl) allowedEl.innerHTML = buildTagListHTML(state.allowedTags, 'allowed');
        if (blockedEl) blockedEl.innerHTML = buildTagListHTML(state.blockedTags, 'blocked');
    }

    function refreshSchedules(root, state) {
        const el = root.querySelector('.um-schedules');
        if (el) el.innerHTML = buildScheduleListHTML(state.schedules);
    }

    function setCheckboxesChecked(root, selector, checked) {
        root.querySelectorAll(selector).forEach((el) => {
            el.checked = checked;
            if (checked) el.setAttribute('checked', '');
            else el.removeAttribute('checked');
        });
    }

    function bindEditorInteractions(root, state) {
        const bindAllLibrariesToggle = (chkSel, listSel, itemSel) => {
            const chk = root.querySelector(chkSel);
            const list = root.querySelector(listSel);
            const sync = () => {
                const allChecked = !!chk?.checked;
                if (list) list.style.display = allChecked ? 'none' : '';
                // When leaving "all", select every library by default
                if (!allChecked) setCheckboxesChecked(root, itemSel, true);
            };
            chk?.addEventListener('change', sync);
            // Initial visibility only — do not force-select on load (preserve saved template)
            if (list) list.style.display = chk?.checked ? 'none' : '';
        };

        bindAllLibrariesToggle('.um-chk-all-folders', '.um-folder-list', '.um-folder');
        bindAllLibrariesToggle('.um-chk-delete-all', '.um-delete-folders', '.um-delete-folder');

        root.addEventListener('click', async (e) => {
            if (e.target.closest('.um-add-allowed-tag')) {
                const tag = await promptText('Allow tag', 'Enter a tag');
                if (tag && !state.allowedTags.includes(tag)) {
                    state.allowedTags.push(tag);
                    refreshTagLists(root, state);
                }
                return;
            }
            if (e.target.closest('.um-add-blocked-tag')) {
                const tag = await promptText('Block tag', 'Enter a tag');
                if (tag && !state.blockedTags.includes(tag)) {
                    state.blockedTags.push(tag);
                    refreshTagLists(root, state);
                }
                return;
            }
            if (e.target.closest('.um-add-schedule')) {
                const schedule = await promptSchedule();
                if (schedule) {
                    state.schedules.push(schedule);
                    refreshSchedules(root, state);
                }
                return;
            }
            const delTag = e.target.closest('.um-delete-tag');
            if (delTag) {
                const list = delTag.dataset.list;
                const index = parseInt(delTag.dataset.index, 10);
                if (list === 'allowed') state.allowedTags.splice(index, 1);
                if (list === 'blocked') state.blockedTags.splice(index, 1);
                refreshTagLists(root, state);
                return;
            }
            const delSched = e.target.closest('.um-delete-schedule');
            if (delSched) {
                const index = parseInt(delSched.dataset.index, 10);
                state.schedules.splice(index, 1);
                refreshSchedules(root, state);
            }
        });
    }

    function buildMainConfigHTML(config) {
        const options = [`<option value="">None</option>`]
            .concat(config.templates.map((t) =>
                `<option value="${escapeHtml(t.name)}" ${config.defaultTemplateName === t.name ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
            )).join('');

        const list = config.templates.length
            ? config.templates.map((t) => `
                <div class="listItem um-template-row" data-name="${escapeHtml(t.name)}"
                    style="border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:0.65em 0.75em;margin-bottom:0.5em;display:flex;align-items:center;gap:0.75em;cursor:pointer;">
                    <div class="listItemBody" style="flex:1;min-width:0;">
                        <div class="listItemBodyText">${escapeHtml(t.name)}</div>
                        <div class="listItemBodyText secondary" style="font-size:0.85em;">
                            Modified ${escapeHtml(t.dateModified ? new Date(t.dateModified).toLocaleString() : '—')}
                        </div>
                    </div>
                    <button type="button" class="emby-button raised um-edit-template" data-name="${escapeHtml(t.name)}" title="Edit">
                        <span class="material-icons" style="font-size:1.1em;">edit</span>
                    </button>
                    <button type="button" class="emby-button raised um-delete-template" data-name="${escapeHtml(t.name)}" title="Delete">
                        <span class="material-icons" style="font-size:1.1em;">delete</span>
                    </button>
                </div>`).join('')
            : `<div class="listItemBodyText secondary">No templates yet. Create one to get started.</div>`;

        return `
            <div class="um-config-root">
                <div class="listItemBodyText secondary" style="margin-bottom:1em;">
                    Create reusable user policy templates and apply them to new or existing accounts.
                    Import / Export user data will be added here later.
                </div>
                <div class="selectContainer" style="margin-bottom:1em;">
                    <label class="selectLabel" for="um-default-template">Default template for new users</label>
                    <select id="um-default-template" class="emby-select-withcolor emby-select">${options}</select>
                    <div class="fieldDescription">Used as the initial selection on the Add User page.</div>
                </div>
                <div style="margin-bottom:0.75em;">
                    <button type="button" class="emby-button raised button-submit" id="um-create-template">Create Template</button>
                </div>
                <div class="um-template-list">${list}</div>
            </div>`;
    }

    async function persistTemplates(mutator) {
        const config = loadConfig();
        mutator(config);
        const ok = await saveConfig(config);
        if (!ok) {
            alert('Error saving configuration. Ensure the JavaScript Injector plugin is installed and you have administrator permissions.');
        }
        return ok;
    }

    async function openTemplateEditor(existingTemplate) {
        const isEdit = !!(existingTemplate && existingTemplate.name);
        const originalName = isEdit ? existingTemplate.name : null;
        const folders = await fetchMediaFolders();

        const state = {
            allowedTags: (existingTemplate?.policy?.AllowedTags || []).slice(),
            blockedTags: (existingTemplate?.policy?.BlockedTags || []).slice(),
            schedules: clone(existingTemplate?.policy?.AccessSchedules || [])
        };

        const content = document.createElement('div');
        content.innerHTML = buildEditorHTML(
            existingTemplate || { name: '', policy: getSeedPolicy() },
            folders
        );
        bindEditorInteractions(content, state);

        const footer = document.createElement('div');
        footer.style.cssText = 'display:flex;gap:0.75em;justify-content:flex-end;';
        footer.innerHTML = `
            <button type="button" class="emby-button raised" id="um-editor-cancel">Cancel</button>
            <button type="button" class="emby-button raised button-submit" id="um-editor-save">Save Template</button>`;

        window.ModalSystem.create({
            id: EDITOR_MODAL_ID,
            title: isEdit ? `Edit Template: ${existingTemplate.name}` : 'Create Template',
            content,
            footer,
            closeOnBackdrop: true,
            closeOnEscape: true,
            showCloseButton: true,
            onOpen: (modal) => {
                if (window.innerWidth >= 900) {
                    modal.dialog.style.maxWidth = '90vw';
                    modal.dialog.style.width = '1400px';
                    modal.dialog.style.height = '90vh';
                }

                modal.dialogFooter.querySelector('#um-editor-cancel')?.addEventListener('click', () => {
                    window.ModalSystem.close(EDITOR_MODAL_ID);
                });

                modal.dialogFooter.querySelector('#um-editor-save')?.addEventListener('click', async () => {
                    const root = modal.dialogContent;
                    const name = root.querySelector('#um-template-name')?.value?.trim();
                    if (!name) {
                        window.KefinTweaksToaster?.toast?.('Template name is required');
                        return;
                    }
                    const policy = collectPolicyFromEditor(root, state);
                    const config = loadConfig();
                    if (!isEdit && config.templates.some((t) => t.name === name)) {
                        window.KefinTweaksToaster?.toast?.('A template with that name already exists');
                        return;
                    }
                    if (isEdit && name !== originalName && config.templates.some((t) => t.name === name)) {
                        window.KefinTweaksToaster?.toast?.('A template with that name already exists');
                        return;
                    }

                    const next = {
                        name,
                        dateModified: new Date().toISOString(),
                        policy
                    };
                    const ok = await persistTemplates((cfg) => {
                        if (isEdit) {
                            const idx = cfg.templates.findIndex((t) => t.name === originalName);
                            if (idx >= 0) cfg.templates[idx] = next;
                            else cfg.templates.push(next);
                            if (cfg.defaultTemplateName === originalName) cfg.defaultTemplateName = name;
                        } else {
                            cfg.templates.push(next);
                        }
                    });

                    if (ok) {
                        window.KefinTweaksToaster?.toast?.('Template saved');
                        window.ModalSystem.close(EDITOR_MODAL_ID);
                        refreshMainConfigListIfOpen();
                    }
                });
            }
        });
    }

    function refreshMainConfigListIfOpen() {
        const listRoot = document.querySelector('.um-config-root');
        if (!listRoot) return;
        const wrap = listRoot.parentElement;
        if (!wrap) return;
        wrap.innerHTML = buildMainConfigHTML(loadConfig());
        bindMainConfigActions(wrap);
    }

    function bindMainConfigActions(root) {
        if (!root) return;
        const scope = root;

        scope.querySelector('#um-create-template')?.addEventListener('click', () => {
            openTemplateEditor(null);
        });

        scope.querySelector('#um-default-template')?.addEventListener('change', async (e) => {
            const value = e.target.value || '';
            await persistTemplates((config) => {
                config.defaultTemplateName = value;
            });
        });

        scope.addEventListener('click', async (e) => {
            const del = e.target.closest('.um-delete-template');
            if (del) {
                e.stopPropagation();
                const name = del.dataset.name;
                if (!name || !confirm(`Delete template "${name}"?`)) return;
                const ok = await persistTemplates((config) => {
                    config.templates = config.templates.filter((t) => t.name !== name);
                    if (config.defaultTemplateName === name) config.defaultTemplateName = '';
                });
                if (ok) refreshMainConfigListIfOpen();
                return;
            }

            const editBtn = e.target.closest('.um-edit-template');
            const row = e.target.closest('.um-template-row');
            const target = editBtn || row;
            if (target) {
                e.stopPropagation();
                const name = target.dataset.name;
                const template = loadConfig().templates.find((t) => t.name === name);
                if (template) openTemplateEditor(clone(template));
            }
        });
    }

    async function openConfigModal() {
        try {
            const config = loadConfig();
            const content = document.createElement('div');
            content.innerHTML = buildMainConfigHTML(config);
            bindMainConfigActions(content);

            const footer = document.createElement('div');
            footer.style.cssText = 'display:flex;gap:0.75em;justify-content:flex-end;';
            footer.innerHTML = `<button class="emby-button raised" onclick="window.ModalSystem.close('${CONFIG_MODAL_ID}')">Close</button>`;

            const modal = window.ModalSystem.create({
                id: CONFIG_MODAL_ID,
                title: 'User Manager',
                content,
                footer,
                closeOnBackdrop: true,
                closeOnEscape: true,
                showCloseButton: true
            });
            if (modal?.dialog && window.innerWidth >= 900) {
                modal.dialog.style.maxWidth = '90vw';
                modal.dialog.style.width = '1400px';
                modal.dialog.style.height = '90vh';
            }
            LOG('User Manager config opened');
        } catch (e) {
            ERR('Error opening User Manager config', e);
            alert('Error opening configuration: ' + e.message);
        }
    }

    window.KefinTweaksFeatureConfigs = window.KefinTweaksFeatureConfigs || {};
    window.KefinTweaksFeatureConfigs.userManager = {
        openConfigModal,
        openTemplateEditor,
        loadConfig,
        getSeedPolicy,
        clonePolicy: clone
    };

    // Shared helpers for runtime script
    window.KefinUserManagerConfig = {
        loadConfig,
        getSeedPolicy,
        clonePolicy: clone,
        openTemplateEditor,
        openConfigModal
    };

    console.log('[KefinTweaks UserManager Config] Script loaded');
})();
