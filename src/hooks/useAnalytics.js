import { useMemo } from 'react';
import { formatDistance, formatPace } from '../utils/units';

// --- HELPER: Week Start Date ---
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff); d.setHours(0, 0, 0, 0); return d;
};

// --- HELPER: Time String to Seconds ---
const timeToSec = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return 0;
};

export const useAnalytics = (runHistory = [], userData = {}) => {
    const unitSystem = userData.unitSystem || 'metric';
    // Forced update for analytics calculation

    const analytics = useMemo(() => {
        const history = runHistory || [];
        // Filter out invalid runs (0 distance or 0 duration)
        const validRuns = history.filter(r => parseFloat(r.distance) > 0 && r.duration !== "00:00");
        const sortedRuns = [...validRuns].sort((a, b) => new Date(b.date) - new Date(a.date)); // Newest first

        // --- 1. LIFETIME STATS ---
        const totalDistance = validRuns.reduce((acc, r) => acc + parseFloat(r.distance), 0);
        const totalDurationSec = validRuns.reduce((acc, r) => acc + timeToSec(r.duration), 0);
        const totalRuns = validRuns.length;
        const totalCalories = validRuns.reduce((acc, r) => acc + (parseFloat(r.calories) || 0), 0);
        const totalElevation = validRuns.reduce((acc, r) => acc + (parseFloat(r.elevationGain) || 0), 0);

        // --- 2. VO2 MAX ESTIMATION ---
        // Formula: 15 + (Speed_kmh * 3.5) + (200 - AvgHR) * 0.15 (Rough Estimate)
        // We use the last 5 runs for a current estimate
        const last5Runs = sortedRuns.slice(0, 5).filter(r => parseFloat(r.heartRate) > 0);
        let vo2Max = "N/A";
        if (last5Runs.length > 0) {
            const fiveRunDist = last5Runs.reduce((acc, r) => acc + parseFloat(r.distance), 0);
            const fiveRunTime = last5Runs.reduce((acc, r) => acc + (timeToSec(r.duration) / 3600), 0); // Hours
            const avgSpeedKmh = fiveRunTime > 0 ? fiveRunDist / fiveRunTime : 0;
            const avgHR = last5Runs.reduce((acc, r) => acc + parseFloat(r.heartRate), 0) / last5Runs.length;

            if (avgSpeedKmh > 0 && avgHR > 0) {
                const rawVo2 = 15 + (avgSpeedKmh * 3.5) + (200 - avgHR) * 0.15;
                vo2Max = Math.round(rawVo2).toString();
            }
        }

        // --- 3. RACE PREDICTOR ---
        // Based on Best 5k Effort
        let best5kTime = Infinity;
        validRuns.forEach(r => {
            const d = parseFloat(r.distance);
            if (d >= 5) {
                const sec = timeToSec(r.duration);
                // Normalized purely to 5k
                const projected5k = (sec / d) * 5;
                if (projected5k < best5kTime) best5kTime = projected5k;
            }
        });

        let predictions = null;
        if (best5kTime !== Infinity) {
            // Riegel's Formula: T2 = T1 * (D2 / D1)^1.06
            const predict = (dist) => {
                const t = best5kTime * Math.pow((dist / 5), 1.06);
                const h = Math.floor(t / 3600);
                const m = Math.floor((t % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            };
            predictions = {
                '5k': predict(5),
                '10k': predict(10),
                'Half': predict(21.1),
                'Marathon': predict(42.2)
            };
        }

        // --- 4. HEART RATE ZONES ---
        // Simplified calculation based on run average HR distribution
        const maxHR = 220 - (userData.age || 30);
        const zones = [0, 0, 0, 0, 0]; // Z1 ... Z5
        validRuns.forEach(r => {
            const hr = parseFloat(r.heartRate);
            if (hr > 0) {
                const pct = hr / maxHR;
                if (pct < 0.6) zones[0]++;
                else if (pct < 0.7) zones[1]++;
                else if (pct < 0.8) zones[2]++;
                else if (pct < 0.9) zones[3]++;
                else zones[4]++;
            }
        });
        const maxZoneCount = Math.max(...zones, 1);
        const zoneHeights = zones.map(z => (z / maxZoneCount) * 80 + 10); // Scaled for UI (max 80px)

        // --- 5. RECOVERY STATUS ---
        // Based on time since last run
        const lastRunDate = sortedRuns.length > 0 ? new Date(sortedRuns[0].date) : null;
        let recovery = { text: "Ready to Train", color: "#4CD964", pct: "100%" };

        if (lastRunDate) {
            const hoursSince = (new Date() - lastRunDate) / (1000 * 60 * 60);
            if (hoursSince < 24) {
                recovery = { text: "Recovering", color: "#FF9500", pct: "40%" };
            } else if (hoursSince < 48) {
                recovery = { text: "Almost Ready", color: "#CCFF00", pct: "80%" };
            }
        }

        // --- 6. VOLUME LOAD (Last 4 Weeks) ---
        const weeks = [0, 0, 0, 0];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        validRuns.forEach(run => {
            const runDate = new Date(run.date);
            runDate.setHours(0, 0, 0, 0);
            const diffTime = Math.abs(now - runDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const weekIndex = Math.floor(diffDays / 7);
            if (weekIndex < 4) {
                weeks[3 - weekIndex] += parseFloat(run.distance);
            }
        });
        const maxVol = Math.max(...weeks, 10);

        // --- 7. PERSONAL RECORDS ---
        const pbs = { '1k': null, '5k': null, '10k': null, 'Half': null, 'Longest': 0 };
        validRuns.forEach(run => {
            const dist = parseFloat(run.distance);
            const sec = timeToSec(run.duration);
            const paceSec = sec / dist; // sec per km

            if (dist > pbs.Longest) pbs.Longest = dist;

            // Calculate formatted pace string from seconds
            const paceMin = Math.floor(paceSec / 60);
            const paceSecRem = Math.round(paceSec % 60);
            const formattedPace = `${paceMin}:${paceSecRem < 10 ? '0' : ''}${paceSecRem}`;

            if (dist >= 1 && (pbs['1k'] === null || paceSec < pbs['1k'].sec)) pbs['1k'] = { str: formattedPace, sec: paceSec };
            if (dist >= 5 && (pbs['5k'] === null || paceSec < pbs['5k'].sec)) pbs['5k'] = { str: formattedPace, sec: paceSec };
            if (dist >= 10 && (pbs['10k'] === null || paceSec < pbs['10k'].sec)) pbs['10k'] = { str: formattedPace, sec: paceSec };
            if (dist >= 21.09 && (pbs['Half'] === null || paceSec < pbs['Half'].sec)) pbs['Half'] = { str: formattedPace, sec: paceSec };
        });

        // Format PBs
        const formattedPbs = {
            '1k': pbs['1k'] ? pbs['1k'].str : '--:--',
            '5k': pbs['5k'] ? pbs['5k'].str : '--:--',
            '10k': pbs['10k'] ? pbs['10k'].str : '--:--',
            'Half': pbs['Half'] ? pbs['Half'].str : '--:--',
            'Longest': formatDistance(pbs.Longest, unitSystem)
        };
        // Debug Log


        // --- 8. CONSISTENCY SCORE ---
        // Avg runs per week over last 4 weeks
        const consistencyScore = (validRuns.filter(r => {
            const d = new Date(r.date);
            return (now - d) / (1000 * 60 * 60 * 24) <= 28;
        }).length / 4).toFixed(1);


        // --- TRENDS (For Home Screen Dashboard) ---
        // Compare "This Week" vs "Last Week"
        const startOfThisWeek = getStartOfWeek(now);
        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
        const endOfLastWeek = new Date(startOfThisWeek);

        const thisWeekRuns = validRuns.filter(r => new Date(r.date) >= startOfThisWeek);
        const lastWeekRuns = validRuns.filter(r => new Date(r.date) >= startOfLastWeek && new Date(r.date) < endOfLastWeek);

        const getTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        const thisWeekCals = thisWeekRuns.reduce((acc, r) => acc + (parseFloat(r.calories) || 0), 0);
        const lastWeekCals = lastWeekRuns.reduce((acc, r) => acc + (parseFloat(r.calories) || 0), 0);
        const calTrend = getTrend(thisWeekCals, lastWeekCals);

        const getAvgBpm = (runs) => runs.length ? runs.reduce((acc, r) => acc + (parseFloat(r.heartRate) || 0), 0) / runs.length : 0;
        const bpmTrend = getTrend(getAvgBpm(thisWeekRuns), getAvgBpm(lastWeekRuns));

        // 30-Day Avg Pace
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const recentRuns = validRuns.filter(r => new Date(r.date) >= thirtyDaysAgo).sort((a, b) => new Date(a.date) - new Date(b.date));

        const avgPaceSec = recentRuns.length ? recentRuns.reduce((acc, r) => acc + timeToSec(r.pace), 0) / recentRuns.length : 0;
        const avgPaceMin = Math.floor(avgPaceSec / 60);
        const avgPaceRem = Math.round(avgPaceSec % 60);
        const avgPaceStr = avgPaceSec > 0 ? formatPace(`${avgPaceMin}:${avgPaceRem < 10 ? '0' : ''}${avgPaceRem}`, unitSystem) : "--:--";

        const chartData = recentRuns.length > 1
            ? recentRuns.map(r => parseFloat(r.heartRate) || 0).filter(hr => hr > 40)
            : [70, 75, 72, 80, 78, 85, 82]; // Placeholder pattern if not enough data

        return {
            vo2Max,
            predictions,
            zones,
            zoneHeights,
            recovery,
            weeks,
            maxVol,
            pbs: formattedPbs,
            lifetime: {
                distance: formatDistance(totalDistance, unitSystem),
                duration: Math.floor(totalDurationSec / 3600), // Hours
                runs: totalRuns,
                elevation: Math.floor(totalElevation)
            },
            consistencyScore,
            trends: {
                calText: calTrend >= 0 ? `+${calTrend}% vs last week` : `${calTrend}% vs last week`,
                calIcon: calTrend >= 0 ? "trending-up" : "trending-down",
                calColor: calTrend >= 0 ? "#4CD964" : "#FF3B30",
                bpmText: bpmTrend >= 0 ? `+${bpmTrend}% vs last week` : `${bpmTrend}% vs last week`,
                bpmIcon: bpmTrend >= 0 ? "trending-up" : "trending-down",
                bpmColor: bpmTrend >= 0 ? "#4CD964" : "#FF3B30",
                avgPaceStr,
                runCount30: recentRuns.length,
                chartData
            }
        };

    }, [runHistory, userData.unitSystem, userData.age]);

    return analytics;
};
