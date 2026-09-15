// KefinTweaks Watchlist Statistics — activity charts + lists (Chart.js)
(function () {
    'use strict';

    const LOG = (...args) => console.log('[KefinTweaks Statistics]', ...args);
    const WARN = (...args) => console.warn('[KefinTweaks Statistics]', ...args);

    // Tunable thresholds (ms / ticks)
    const BULK_MARK_WINDOW_MS = 60 * 1000; // ±1 minute consecutive cluster
    const BINGE_MAX_SPAN_MS = 12 * 60 * 60 * 1000; // 12 hours watch span
    const BINGE_MIN_RUNTIME_MS = 4 * 60 * 60 * 1000; // 4 hours of content
    const BINGE_MAX_IDLE_GAP_MS = 4 * 60 * 60 * 1000; // max gap between end of one and start of next
    const TICKS_PER_MS = 10000; // 1 tick = 100 ns → 10_000 ticks per ms
    const BINGE_MIN_RUNTIME_TICKS = BINGE_MIN_RUNTIME_MS * TICKS_PER_MS;
    const FALLBACK_MOVIE_RUNTIME_TICKS = 2 * 60 * 60 * 1000 * TICKS_PER_MS; // 2h
    const FALLBACK_EPISODE_RUNTIME_TICKS = 1 * 60 * 60 * 1000 * TICKS_PER_MS; // 1h
    const MIN_STREAK_DAYS = 2;
    const MAX_STREAKS_SHOWN = 10;
    const MAX_BINGES_SHOWN = 10;
    const MAX_FAVORITES_SHOWN = 12;

    const ACTIVITY_RANGES = [
        { key: '30d', label: '30d', days: 30 },
        { key: '90d', label: '90d', days: 90 },
        { key: '1y', label: '1y', days: 365 },
        { key: 'all', label: 'All', days: null }
    ];
    const DEFAULT_ACTIVITY_RANGE = '30d';

    let selectedActivityRange = DEFAULT_ACTIVITY_RANGE;
    let lastActivityEvents = [];
    let overTimeChartRoot = null;

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const CHART_COLORS = {
        primary: 'rgba(100, 181, 246, 0.85)',
        primaryFill: 'rgba(100, 181, 246, 0.25)',
        grid: 'rgba(255, 255, 255, 0.08)',
        text: 'rgba(255, 255, 255, 0.7)'
    };

    /** @type {import('chart.js').Chart[]} */
    let chartInstances = [];

    function ticksToMs(ticks) {
        return (Number(ticks) || 0) / TICKS_PER_MS;
    }

    function effectiveRunTimeTicks(event) {
        const ticks = Number(event.runTimeTicks) || 0;
        if (ticks > 0) return ticks;
        return event.type === 'Movie' ? FALLBACK_MOVIE_RUNTIME_TICKS : FALLBACK_EPISODE_RUNTIME_TICKS;
    }

    function localDayKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function parseLocalDayKey(key) {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatDayKey(key) {
        const dt = parseLocalDayKey(key);
        return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatHours(ticks) {
        const hours = ticksToMs(ticks) / (60 * 60 * 1000);
        return `${hours.toFixed(1)} hours`;
    }

    function formatHoursValue(hours) {
        return `${Number(hours).toFixed(1)} hours`;
    }

    function formatDayMonth(date) {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    function formatTimeOnly(date) {
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    function mediaTypeIcon(type) {
        if (type === 'Movie') return 'movie';
        if (type === 'Series') return 'tv';
        return 'tv'; // Episode
    }

    function buildRawEvents(progressList, movies) {
        const events = [];

        (movies || []).forEach((movie) => {
            const key = movie?.UserData?.LastPlayedDate;
            if (!key) return;
            const at = new Date(key);
            if (Number.isNaN(at.getTime())) return;
            events.push({
                at,
                itemId: movie.Id,
                name: movie.Name || 'Movie',
                type: 'Movie',
                lastPlayedKey: String(key),
                runTimeTicks: movie.RunTimeTicks || 0
            });
        });

        (progressList || []).forEach((progress) => {
            const seriesId = progress?.series?.Id;
            const seriesName = progress?.series?.Name || '';
            const source = Array.isArray(progress.episodes) && progress.episodes.length
                ? progress.episodes
                : (progress.playEvents || []);

            source.forEach((ep) => {
                const key = ep?.UserData?.LastPlayedDate || ep?.LastPlayedDate;
                const played = ep?.UserData ? ep.UserData.Played === true : !!key;
                if (!played || !key) return;
                const at = new Date(key);
                if (Number.isNaN(at.getTime())) return;
                events.push({
                    at,
                    itemId: ep.Id,
                    name: ep.Name || 'Episode',
                    type: 'Episode',
                    seriesId,
                    seriesName,
                    season: ep.ParentIndexNumber != null ? ep.ParentIndexNumber : null,
                    episode: ep.IndexNumber != null ? ep.IndexNumber : null,
                    lastPlayedKey: String(key),
                    runTimeTicks: ep.RunTimeTicks || 0
                });
            });
        });

        events.sort((a, b) => a.at - b.at);
        return events;
    }

    /**
     * Drop clusters of 2+ events within BULK_MARK_WINDOW_MS of consecutive neighbors.
     */
    function stripBulkMarkClusters(events) {
        if (!events.length) return [];
        const sorted = events.slice().sort((a, b) => a.at - b.at);
        const kept = [];
        let cluster = [sorted[0]];

        const flush = () => {
            if (cluster.length === 1) kept.push(cluster[0]);
            // size >= 2 → bulk mark anomaly, discard
            cluster = [];
        };

        for (let i = 1; i < sorted.length; i++) {
            const prev = cluster[cluster.length - 1];
            const cur = sorted[i];
            if (cur.at - prev.at <= BULK_MARK_WINDOW_MS) {
                cluster.push(cur);
            } else {
                flush();
                cluster = [cur];
            }
        }
        flush();
        return kept;
    }

    function startOfLocalDay(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function startOfLocalWeek(date) {
        const d = startOfLocalDay(date);
        d.setDate(d.getDate() - d.getDay()); // Sunday start
        return d;
    }

    function startOfLocalMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    function resolveActivityRange(rangeKey) {
        const def = ACTIVITY_RANGES.find((r) => r.key === rangeKey) || ACTIVITY_RANGES[0];
        const end = startOfLocalDay(new Date());
        if (def.days == null) {
            return { key: def.key, start: null, end, label: def.label };
        }
        return {
            key: def.key,
            start: addDays(end, -(def.days - 1)),
            end,
            label: def.label
        };
    }

    function filterEventsByRange(events, range) {
        if (!range.start) return events.slice();
        const startMs = range.start.getTime();
        const endMs = range.end.getTime() + (24 * 60 * 60 * 1000) - 1;
        return events.filter((e) => {
            const t = e.at.getTime();
            return t >= startMs && t <= endMs;
        });
    }

    /**
     * Adaptive buckets: ≤90d daily, ≤2y weekly, else monthly.
     */
    function resolveBucket(rangeKey, filteredEvents, rangeEnd) {
        const def = ACTIVITY_RANGES.find((r) => r.key === rangeKey);
        let spanDays;
        if (def?.days != null) {
            spanDays = def.days;
        } else if (filteredEvents.length) {
            const oldest = filteredEvents.reduce((min, e) => (e.at < min ? e.at : min), filteredEvents[0].at);
            spanDays = Math.max(1, Math.round((rangeEnd - startOfLocalDay(oldest)) / (24 * 60 * 60 * 1000)) + 1);
        } else {
            spanDays = 30;
        }
        if (spanDays <= 90) return 'day';
        if (spanDays <= 730) return 'week';
        return 'month';
    }

    function bucketStart(date, bucket) {
        if (bucket === 'week') return startOfLocalWeek(date);
        if (bucket === 'month') return startOfLocalMonth(date);
        return startOfLocalDay(date);
    }

    function nextBucket(date, bucket) {
        if (bucket === 'week') return addDays(date, 7);
        if (bucket === 'month') return new Date(date.getFullYear(), date.getMonth() + 1, 1);
        return addDays(date, 1);
    }

    function formatBucketLabel(date, bucket) {
        if (bucket === 'month') {
            return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
        }
        if (bucket === 'week') {
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function bucketSubtitle(bucket) {
        if (bucket === 'week') return 'Items by last played week';
        if (bucket === 'month') return 'Items by last played month';
        return 'Items by last played day';
    }

    function buildPlaysOverTimeSeries(events, rangeKey = selectedActivityRange) {
        const range = resolveActivityRange(rangeKey);
        const filtered = filterEventsByRange(events, range);
        const bucket = resolveBucket(range.key, filtered, range.end);

        if (!filtered.length && !range.start) {
            return { labels: [], values: [], bucket, rangeKey: range.key };
        }

        const end = range.end;
        let start = range.start;
        if (!start) {
            if (!filtered.length) {
                return { labels: [], values: [], bucket, rangeKey: range.key };
            }
            const oldest = filtered.reduce((min, e) => (e.at < min ? e.at : min), filtered[0].at);
            start = bucketStart(oldest, bucket);
        } else {
            start = bucketStart(start, bucket);
        }

        const counts = Object.create(null);
        filtered.forEach((e) => {
            const key = localDayKey(bucketStart(e.at, bucket));
            counts[key] = (counts[key] || 0) + 1;
        });

        const labels = [];
        const values = [];
        let cursor = new Date(start);
        const endBucket = bucketStart(end, bucket);
        while (cursor <= endBucket) {
            const key = localDayKey(cursor);
            labels.push(formatBucketLabel(cursor, bucket));
            values.push(counts[key] || 0);
            cursor = nextBucket(cursor, bucket);
        }

        return { labels, values, bucket, rangeKey: range.key };
    }

    function buildWeekdayCounts(events) {
        const values = new Array(7).fill(0);
        events.forEach((e) => {
            values[e.at.getDay()] += 1;
        });
        return values;
    }

    function buildHourCounts(events) {
        const values = new Array(24).fill(0);
        events.forEach((e) => {
            values[e.at.getHours()] += 1;
        });
        return values;
    }

    function hourLabel(h) {
        if (h === 0) return '12am';
        if (h === 12) return '12pm';
        if (h < 12) return `${h}am`;
        return `${h - 12}pm`;
    }

    function buildMonthCounts(events) {
        const values = new Array(12).fill(0);
        events.forEach((e) => {
            values[e.at.getMonth()] += 1;
        });
        return values;
    }

    function formatSeasonEpisode(season, episode) {
        if (season == null || episode == null) return null;
        const e = String(Number(episode)).padStart(2, '0');
        return `${Number(season)}x${e}`;
    }

    function eventDisplayName(e) {
        if (e.type === 'Episode' || e.seriesName) {
            const se = formatSeasonEpisode(e.season, e.episode);
            const series = e.seriesName || 'Series';
            const epName = e.name || 'Episode';
            if (se) return `${series} - ${se} - ${epName}`;
            return `${series} - ${epName}`;
        }
        return e.name;
    }

    function formatDurationShort(ticks) {
        const ms = ticksToMs(ticks);
        const minutes = Math.round(ms / 60000);
        if (minutes < 60) return `${minutes}m`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m ? `${h}h ${m}m` : `${h}h`;
    }

    function computeStreaks(events) {
        if (!events.length) return [];
        const byDay = Object.create(null);
        events.forEach((e) => {
            const key = localDayKey(e.at);
            if (!byDay[key]) byDay[key] = [];
            byDay[key].push(e);
        });
        const days = Object.keys(byDay).sort();
        const streaks = [];
        let start = days[0];
        let prev = days[0];
        let len = 1;

        const flush = (endKey, length, startKey) => {
            if (length < MIN_STREAK_DAYS) return;
            const dayKeys = [];
            const cursor = parseLocalDayKey(startKey);
            const endDate = parseLocalDayKey(endKey);
            while (cursor <= endDate) {
                dayKeys.push(localDayKey(cursor));
                cursor.setDate(cursor.getDate() + 1);
            }
            const items = [];
            dayKeys.forEach((dk) => {
                (byDay[dk] || []).forEach((e) => {
                    items.push({
                        name: eventDisplayName(e),
                        at: e.at,
                        dayKey: dk
                    });
                });
            });
            items.sort((a, b) => b.at - a.at);
            streaks.push({
                startKey: startKey,
                endKey: endKey,
                days: length,
                items
            });
        };

        for (let i = 1; i < days.length; i++) {
            const prevDate = parseLocalDayKey(prev);
            const curDate = parseLocalDayKey(days[i]);
            const diffDays = Math.round((curDate - prevDate) / (24 * 60 * 60 * 1000));
            if (diffDays === 1) {
                len += 1;
                prev = days[i];
            } else {
                flush(prev, len, start);
                start = days[i];
                prev = days[i];
                len = 1;
            }
        }
        flush(prev, len, start);

        streaks.sort((a, b) => b.days - a.days || b.endKey.localeCompare(a.endKey));
        return streaks.slice(0, MAX_STREAKS_SHOWN);
    }

    function estimatedStartMs(event) {
        return event.at.getTime() - ticksToMs(effectiveRunTimeTicks(event));
    }

    function idleGapMs(prevEvent, nextEvent) {
        // Gap from when prev finished (LastPlayedDate) to when next started (LastPlayedDate − runtime)
        return estimatedStartMs(nextEvent) - prevEvent.at.getTime();
    }

    /**
     * Greedy binge windows: consecutive idle ≤ 4h, overall span ≤ 12h, content runtime ≥ 4h.
     */
    function computeBinges(events) {
        if (!events.length) return [];
        const sorted = events.slice().sort((a, b) => a.at - b.at);
        const binges = [];
        let i = 0;

        while (i < sorted.length) {
            let end = i;
            let runtimeTicks = effectiveRunTimeTicks(sorted[i]);

            while (end + 1 < sorted.length) {
                const next = sorted[end + 1];
                if ((next.at - sorted[i].at) > BINGE_MAX_SPAN_MS) break;
                if (idleGapMs(sorted[end], next) > BINGE_MAX_IDLE_GAP_MS) break;
                end += 1;
                runtimeTicks += effectiveRunTimeTicks(sorted[end]);
            }

            if (runtimeTicks >= BINGE_MIN_RUNTIME_TICKS) {
                const slice = sorted.slice(i, end + 1);
                binges.push({
                    start: slice[0].at,
                    end: slice[slice.length - 1].at,
                    itemCount: slice.length,
                    runtimeTicks,
                    items: slice.map((e) => ({
                        name: eventDisplayName(e),
                        at: e.at,
                        type: e.type,
                        runTimeTicks: effectiveRunTimeTicks(e)
                    }))
                });
                i = end + 1;
            } else {
                i += 1;
            }
        }

        binges.sort((a, b) => b.end - a.end);
        return binges.slice(0, MAX_BINGES_SHOWN);
    }

    function computeFavoriteRecents(progressList, movies) {
        const items = [];

        (movies || []).forEach((movie) => {
            if (!movie?.UserData?.IsFavorite) return;
            const key = movie.UserData.LastPlayedDate;
            if (!key) return;
            const at = new Date(key);
            if (Number.isNaN(at.getTime())) return;
            items.push({
                id: movie.Id,
                name: movie.Name || 'Movie',
                type: 'Movie',
                at
            });
        });

        (progressList || []).forEach((progress) => {
            if (!progress?.series?.UserData?.IsFavorite) return;
            const series = progress.series;
            let at = null;
            const source = Array.isArray(progress.episodes) && progress.episodes.length
                ? progress.episodes
                : (progress.playEvents || []);
            source.forEach((ep) => {
                const key = ep?.UserData?.LastPlayedDate || ep?.LastPlayedDate;
                if (!key) return;
                const d = new Date(key);
                if (Number.isNaN(d.getTime())) return;
                if (!at || d > at) at = d;
            });
            if (!at && series.UserData?.LastPlayedDate) {
                const d = new Date(series.UserData.LastPlayedDate);
                if (!Number.isNaN(d.getTime())) at = d;
            }
            if (!at) return;
            items.push({
                id: series.Id,
                name: series.Name || 'Series',
                type: 'Series',
                at
            });
        });

        items.sort((a, b) => b.at - a.at);
        return items.slice(0, MAX_FAVORITES_SHOWN);
    }

    function destroyCharts() {
        chartInstances.forEach((chart) => {
            try {
                chart.destroy();
            } catch (_) { /* ignore */ }
        });
        chartInstances = [];
    }

    function baseChartOptions(extra = {}) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(20, 20, 20, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff'
                }
            },
            scales: {
                x: {
                    ticks: { color: CHART_COLORS.text, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
                    grid: { color: CHART_COLORS.grid }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: CHART_COLORS.text, precision: 0 },
                    grid: { color: CHART_COLORS.grid }
                }
            },
            ...extra
        };
    }

    function createLineChart(canvas, labels, values, label) {
        if (!window.Chart || !canvas) return null;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.parentElement?.clientHeight || 220);
        gradient.addColorStop(0, 'rgba(100, 181, 246, 0.45)');
        gradient.addColorStop(1, 'rgba(100, 181, 246, 0.02)');
        const lastIndex = Math.max(0, labels.length - 1);

        const chart = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label,
                    data: values,
                    borderColor: 'rgba(100, 181, 246, 1)',
                    backgroundColor: gradient,
                    fill: 'origin',
                    tension: 0.35,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderWidth: 2.5,
                    cubicInterpolationMode: 'monotone'
                }]
            },
            options: baseChartOptions({
                interaction: { mode: 'index', intersect: false },
                elements: { line: { borderJoinStyle: 'round' } },
                scales: {
                    x: {
                        ticks: {
                            color: CHART_COLORS.text,
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12
                        },
                        grid: { color: CHART_COLORS.grid },
                        afterBuildTicks(axis) {
                            if (lastIndex <= 0) return;
                            const byValue = new Map();
                            (axis.ticks || []).forEach((t) => byValue.set(t.value, t));
                            byValue.set(0, { value: 0 });
                            byValue.set(lastIndex, { value: lastIndex });
                            axis.ticks = Array.from(byValue.values()).sort((a, b) => a.value - b.value);
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: CHART_COLORS.text, precision: 0 },
                        grid: { color: CHART_COLORS.grid }
                    }
                }
            })
        });
        chartInstances.push(chart);
        return chart;
    }

    function createBarChart(canvas, labels, values, label) {
        if (!window.Chart || !canvas) return null;
        const chart = new window.Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label,
                    data: values,
                    backgroundColor: CHART_COLORS.primary,
                    borderRadius: 3,
                    maxBarThickness: 28
                }]
            },
            options: baseChartOptions()
        });
        chartInstances.push(chart);
        return chart;
    }

    function calculateSummary(progressData, movies) {
        const list = progressData || [];
        const seriesStarted = list.length;
        const seriesWatched = list.filter((p) => p.percentage === 100).length;
        const episodesWatched = list.reduce((total, p) => total + (p.watchedCount || 0), 0);
        const moviesWatched = (movies || []).length;
        const topShows = list
            .map((progress) => ({
                name: progress.series?.Name || 'Unknown',
                episodesWatched: progress.watchedCount || 0,
                totalEpisodes: progress.totalEpisodes || 0,
                percentage: progress.percentage || 0,
                seriesId: progress.series?.Id
            }))
            .sort((a, b) => {
                const percentageDiff = b.percentage - a.percentage;
                if (percentageDiff !== 0) return percentageDiff;
                return b.totalEpisodes - a.totalEpisodes;
            })
            .slice(0, 5);

        return { seriesStarted, seriesWatched, episodesWatched, moviesWatched, topShows };
    }

    function updateSummaryCards(root, stats) {
        const setText = (id, value) => {
            const el = root.querySelector(`#${id}`) || document.getElementById(id);
            if (el) el.textContent = Number(value).toLocaleString();
        };
        setText('stat-series-started', stats.seriesStarted);
        setText('stat-series-watched', stats.seriesWatched);
        setText('stat-episodes-watched', stats.episodesWatched);
        setText('stat-movies-watched', stats.moviesWatched);

        const topShowsList = root.querySelector('#top-shows-list') || document.getElementById('top-shows-list');
        if (!topShowsList) return;
        if (!stats.topShows.length) {
            topShowsList.innerHTML = '<div class="top-show-item"><div class="top-show-name">No shows watched yet</div></div>';
            return;
        }
        topShowsList.innerHTML = stats.topShows.map((show, index) => {
            const rank = index + 1;
            const rankClass = rank <= 3 ? ` rank-${rank}` : '';
            const episodesText = show.episodesWatched === 1 ? 'episode' : 'episodes';
            return `
                <div class="top-show-item${rankClass}">
                    <div class="show-rank">${rank}</div>
                    <div class="top-show-name" title="${escapeHtml(show.name)}">${escapeHtml(show.name)}</div>
                    <div class="top-show-episodes">${show.episodesWatched} of ${show.totalEpisodes} ${episodesText} (${show.percentage}%)</div>
                </div>
            `;
        }).join('');
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function chartsGridHtml() {
        const chips = ACTIVITY_RANGES.map((r) => `
            <button type="button" class="stats-range-chip${r.key === selectedActivityRange ? ' is-active' : ''}" data-range="${r.key}">${r.label}</button>
        `).join('');
        return `
            <div class="stats-chart-card stats-chart-wide">
                <div class="stats-chart-header">
                    <div>
                        <div class="stats-chart-title">Activity over time</div>
                        <div class="stats-chart-subtitle" id="stats-over-time-subtitle">Items by last played day</div>
                    </div>
                    <div class="stats-range-chips" id="stats-over-time-range" role="group" aria-label="Activity range">${chips}</div>
                </div>
                <div class="stats-chart-canvas-wrap"><canvas id="stats-chart-over-time"></canvas></div>
            </div>
            <div class="stats-chart-card">
                <div class="stats-chart-title">Activity by day</div>
                <div class="stats-chart-canvas-wrap"><canvas id="stats-chart-by-day"></canvas></div>
            </div>
            <div class="stats-chart-card">
                <div class="stats-chart-title">Activity by month</div>
                <div class="stats-chart-canvas-wrap"><canvas id="stats-chart-by-month"></canvas></div>
            </div>
            <div class="stats-chart-card stats-chart-wide">
                <div class="stats-chart-title">Activity by hour</div>
                <div class="stats-chart-canvas-wrap"><canvas id="stats-chart-by-hour"></canvas></div>
            </div>
        `;
    }

    function ensureExtendedMarkup(root) {
        let container = root.querySelector('#stats-activity-section');
        if (!container) {
            container = document.createElement('div');
            container.id = 'stats-activity-section';
            container.className = 'stats-activity-section';
            container.innerHTML = `
                <div class="stats-charts-grid"></div>
                <div class="stats-lists-grid">
                    <div class="stats-list-card">
                        <div class="stats-list-header">
                            <span class="material-icons local_fire_department"></span>
                            <span>Watch streaks</span>
                        </div>
                        <div class="stats-list-body" id="stats-streaks-list"></div>
                    </div>
                    <div class="stats-list-card">
                        <div class="stats-list-header">
                            <span class="material-icons weekend"></span>
                            <span>Binge sessions</span>
                        </div>
                        <div class="stats-list-body" id="stats-binges-list"></div>
                    </div>
                    <div class="stats-list-card">
                        <div class="stats-list-header">
                            <span class="material-icons favorite"></span>
                            <span>Recently watched favorites</span>
                        </div>
                        <div class="stats-list-body" id="stats-favorites-list"></div>
                    </div>
                </div>
            `;
            const statsContainer = root.querySelector('.progress-stats-container') || root;
            statsContainer.appendChild(container);
        }

        const grid = container.querySelector('.stats-charts-grid');
        if (grid) grid.innerHTML = chartsGridHtml();
        bindActivityRangeChips(root);
    }

    function syncRangeChipActive(root) {
        root.querySelectorAll('#stats-over-time-range .stats-range-chip').forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.range === selectedActivityRange);
        });
    }

    function renderOverTimeChart(root, events) {
        const canvas = root.querySelector('#stats-chart-over-time');
        if (!canvas || !window.Chart) return;

        // Destroy only the over-time chart instance if present
        chartInstances = chartInstances.filter((chart) => {
            if (chart.canvas === canvas) {
                try { chart.destroy(); } catch (_) { /* ignore */ }
                return false;
            }
            return true;
        });

        const overTime = buildPlaysOverTimeSeries(events, selectedActivityRange);
        const subtitle = root.querySelector('#stats-over-time-subtitle');
        if (subtitle) subtitle.textContent = bucketSubtitle(overTime.bucket);
        createLineChart(canvas, overTime.labels, overTime.values, 'Last played');
    }

    function bindActivityRangeChips(root) {
        const group = root.querySelector('#stats-over-time-range');
        if (!group || group.dataset.bound === 'true') return;
        group.dataset.bound = 'true';
        group.addEventListener('click', (e) => {
            const btn = e.target.closest('.stats-range-chip');
            if (!btn || !group.contains(btn)) return;
            const next = btn.dataset.range;
            if (!next || next === selectedActivityRange) return;
            selectedActivityRange = next;
            syncRangeChipActive(root);
            renderOverTimeChart(root, lastActivityEvents);
        });
    }

    function bindExpandableRows(listEl) {
        if (!listEl || listEl.dataset.expandBound === 'true') return;
        listEl.dataset.expandBound = 'true';
        listEl.addEventListener('click', (e) => {
            const header = e.target.closest('.stats-expandable-header');
            if (!header || !listEl.contains(header)) return;
            const row = header.closest('.stats-expandable');
            if (!row) return;
            const open = row.classList.toggle('is-open');
            header.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    function renderStreaksList(root, streaks) {
        const el = root.querySelector('#stats-streaks-list');
        if (!el) return;
        if (!streaks.length) {
            el.innerHTML = '<div class="stats-list-empty">No streaks of 2+ consecutive days yet</div>';
            return;
        }
        el.innerHTML = streaks.map((s, idx) => {
            const cards = (s.items || []).map((item) => `
                <div class="stats-detail-card">
                    <div class="stats-detail-card-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                    <div class="stats-detail-card-meta">${escapeHtml(formatDayMonth(item.at))}</div>
                </div>
            `).join('');
            return `
                <div class="stats-list-item stats-expandable" data-streak-index="${idx}">
                    <button type="button" class="stats-expandable-header" aria-expanded="false">
                        <span class="material-icons stats-expand-icon">expand_more</span>
                        <span class="stats-expandable-text">
                            <span class="stats-list-item-title">${s.days} day${s.days === 1 ? '' : 's'}</span>
                            <span class="stats-list-item-meta">${escapeHtml(formatDayKey(s.startKey))} → ${escapeHtml(formatDayKey(s.endKey))} · ${(s.items || []).length} items</span>
                        </span>
                    </button>
                    <div class="stats-expandable-body">
                        <div class="stats-streak-list">${cards || '<div class="stats-list-empty">No items</div>'}</div>
                    </div>
                </div>
            `;
        }).join('');
        bindExpandableRows(el);
    }

    function renderBingesList(root, binges) {
        const el = root.querySelector('#stats-binges-list');
        if (!el) return;
        if (!binges.length) {
            el.innerHTML = '<div class="stats-list-empty">No binge sessions (≥4h content within 12h) yet</div>';
            return;
        }
        el.innerHTML = binges.map((b, idx) => {
            const spanHours = (b.end - b.start) / (60 * 60 * 1000);
            const dateLabel = b.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const meta = `${dateLabel}, ${formatTimeOnly(b.start)} → ${formatTimeOnly(b.end)} spanning ${formatHoursValue(spanHours)}`;
            const grid = (b.items || []).map((item) => `
                <div class="stats-binge-item">
                    <span class="material-icons stats-media-icon">${mediaTypeIcon(item.type)}</span>
                    <div class="stats-binge-item-body">
                        <div class="stats-binge-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
                        <div class="stats-binge-item-meta">${escapeHtml(formatDurationShort(item.runTimeTicks))} · ${escapeHtml(formatTimeOnly(item.at))}</div>
                    </div>
                </div>
            `).join('');
            return `
                <div class="stats-list-item stats-expandable" data-binge-index="${idx}">
                    <button type="button" class="stats-expandable-header" aria-expanded="false">
                        <span class="material-icons stats-expand-icon">expand_more</span>
                        <span class="stats-expandable-text">
                            <span class="stats-list-item-title">${formatHours(b.runtimeTicks)} · ${b.itemCount} items</span>
                            <span class="stats-list-item-meta">${escapeHtml(meta)}</span>
                        </span>
                    </button>
                    <div class="stats-expandable-body">
                        <div class="stats-binge-grid">${grid}</div>
                    </div>
                </div>
            `;
        }).join('');
        bindExpandableRows(el);
    }

    function renderFavoritesList(root, favorites) {
        const el = root.querySelector('#stats-favorites-list');
        if (!el) return;
        if (!favorites.length) {
            el.innerHTML = '<div class="stats-list-empty">No recently watched favorites</div>';
            return;
        }
        el.innerHTML = favorites.map((f) => `
            <div class="stats-list-item stats-favorite-item" data-item-id="${escapeHtml(f.id)}" data-item-type="${escapeHtml(f.type)}">
                <span class="material-icons stats-media-icon">${mediaTypeIcon(f.type)}</span>
                <div class="stats-favorite-item-body">
                    <div class="stats-list-item-title">${escapeHtml(f.name)}</div>
                    <div class="stats-list-item-meta">${escapeHtml(f.type)} · ${escapeHtml(f.at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))}</div>
                </div>
            </div>
        `).join('');
    }

    function render(root, { progress, movies } = {}) {
        if (!root) {
            WARN('render called without root');
            return;
        }

        destroyCharts();
        ensureExtendedMarkup(root);

        const progressList = progress || [];
        const movieList = movies || [];

        const summary = calculateSummary(progressList, movieList);
        updateSummaryCards(root, summary);

        const raw = buildRawEvents(progressList, movieList);
        const events = stripBulkMarkClusters(raw);
        LOG(`Activity events: ${raw.length} raw → ${events.length} after bulk-strip`);

        lastActivityEvents = events;
        overTimeChartRoot = root;

        if (!window.Chart) {
            WARN('Chart.js not available; skipping charts');
        } else {
            renderOverTimeChart(root, events);
            createBarChart(
                root.querySelector('#stats-chart-by-day'),
                DAY_LABELS,
                buildWeekdayCounts(events),
                'By day'
            );
            createBarChart(
                root.querySelector('#stats-chart-by-hour'),
                Array.from({ length: 24 }, (_, h) => hourLabel(h)),
                buildHourCounts(events),
                'By hour'
            );
            createBarChart(
                root.querySelector('#stats-chart-by-month'),
                MONTH_LABELS,
                buildMonthCounts(events),
                'By month'
            );
        }

        renderStreaksList(root, computeStreaks(events));
        renderBingesList(root, computeBinges(events));
        renderFavoritesList(root, computeFavoriteRecents(progressList, movieList));

        resizeCharts();
        LOG(`Statistics updated: ${summary.seriesStarted} started, ${summary.seriesWatched} watched, ${summary.episodesWatched} episodes, ${summary.moviesWatched} movies`);
    }

    function resizeCharts() {
        chartInstances.forEach((chart) => {
            try {
                chart.resize();
            } catch (_) { /* ignore */ }
        });
    }

    function destroy() {
        destroyCharts();
    }

    window.KefinWatchlistStats = {
        render,
        destroy,
        resize: resizeCharts,
        // exposed for tests / tuning
        constants: {
            BULK_MARK_WINDOW_MS,
            BINGE_MAX_SPAN_MS,
            BINGE_MIN_RUNTIME_MS,
            BINGE_MAX_IDLE_GAP_MS,
            FALLBACK_MOVIE_RUNTIME_TICKS,
            FALLBACK_EPISODE_RUNTIME_TICKS
        }
    };

    LOG('Module loaded');
})();
