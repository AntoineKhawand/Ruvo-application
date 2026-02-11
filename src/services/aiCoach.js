// src/services/aiCoach.js
import { formatDistance } from '../utils/units';

// 1. GENERATE TODAY'S WORKOUT BASED ON HISTORY
// 1. GENERATE TODAY'S WORKOUT BASED ON HISTORY
export const getTodayWorkout = (userData) => {
    // 0. CHECK PERSISTED PLAN FIRST (Sync with Plan Tab)
    const plan = userData?.trainingPlan;
    const status = plan?.status || 'Active';

    // A. HANDLE INJURED / VACATION STATUS
    if (status === 'Injured') {
        return {
            title: "Recovery Mode",
            dist: "0 km",
            desc: "Focus on rest and recovery. We'll ease you back in when you're ready.",
            intensity: "Rest",
            isRest: true,
            icon: 'medkit'
        };
    }
    if (status === 'Vacation') {
        return {
            title: "Vacation Mode",
            dist: "Optional",
            desc: "Enjoy your trip! Fit in a short run if you can, but no pressure.",
            intensity: "Low",
            isRest: false,
            icon: 'airplane'
        };
    }

    // B. HANDLE ACTIVE PLAN
    if (plan && plan.weeks && plan.generatedAt) {
        const now = new Date();
        const start = new Date(plan.generatedAt);
        const dayIndex = now.getDay(); // 0 = Sun, 1 = Mon
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const todayName = days[dayIndex];

        // Calculate which week of the plan we are in (0-3)
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const weekIndex = Math.floor((diffDays - 1) / 7);

        if (weekIndex >= 0 && weekIndex < plan.weeks.length) {
            const currentWeek = plan.weeks[weekIndex];
            const todayWorkout = currentWeek.workouts.find(w => w.day === todayName);

            if (todayWorkout) {
                // Map plan format to Home Screen format
                return {
                    title: todayWorkout.title,
                    dist: todayWorkout.detail.split(' ')[0] + ' ' + (todayWorkout.detail.split(' ')[1] || 'km'), // Extract "5 km"
                    desc: todayWorkout.detail,
                    intensity: todayWorkout.isRest ? "Rest" : "Medium", // Simplified mapping
                    isRest: todayWorkout.isRest
                };
            }
        }
    }

    // C. FALLBACK TO GENERATIVE LOGIC (Old Logic)
    // Safety check
    const history = userData?.runHistory || [];
    const preferences = userData?.runningPreferences || {};
    const runCount = history.length;
    const lastRunDate = runCount > 0 ? new Date(history[0].date) : null;

    // Logic: Calculate days since last run
    const now = new Date();
    const daysSinceLastRun = lastRunDate
        ? Math.floor((now - lastRunDate) / (1000 * 60 * 60 * 24))
        : 100;

    // A. REST DAY LOGIC (If ran yesterday hard)
    if (daysSinceLastRun === 0) {
        return {
            title: "Active Recovery",
            dist: formatDistance(0, userData?.unitSystem || 'metric', 0),
            desc: "You ran today. Focus on hydration and stretching.",
            intensity: "Rest",
            isRest: true
        };
    }

    // B. NEW USER LOGIC
    if (runCount === 0) {
        return {
            title: "Baseline Run",
            dist: `${formatDistance(2, userData?.unitSystem || 'metric', 0).split(' ')[0]}-${formatDistance(3, userData?.unitSystem || 'metric', 0)}`,
            desc: "A gentle jog to establish your current fitness level.",
            intensity: "Low",
            isRest: false
        };
    }

    // C. ADAPTIVE LOGIC BASED ON PREFERENCES
    const favDist = preferences.favoriteDistance || '5k';
    const weeklyGoal = parseFloat(preferences.weeklyGoal) || 0;
    const unitSystem = userData.unitSystem || 'metric';

    const fmt = (val) => formatDistance(val, unitSystem, 0); // Helper for "5 km" or "3 mi"

    // Determine Long Run distance based on preference
    let longRunDist = `${fmt(8).split(' ')[0]}-${fmt(10)}`;
    if (favDist === '5k') longRunDist = `${fmt(5).split(' ')[0]}-${fmt(7)}`;
    if (favDist === '10k') longRunDist = `${fmt(8).split(' ')[0]}-${fmt(12)}`;
    if (favDist === 'half') longRunDist = `${fmt(15).split(' ')[0]}-${fmt(18)}`;
    if (favDist === 'marathon') longRunDist = `${fmt(20).split(' ')[0]}-${fmt(25)}`;

    // Determine Base Run distance
    // If weekly goal exists, aim for ~20% of goal for easy runs
    let baseRunDist = `${fmt(4).split(' ')[0]}-${fmt(5)}`;
    if (weeklyGoal > 0) {
        const dailyAvg = Math.round(weeklyGoal / 4); // Assuming 4 runs/week
        baseRunDist = fmt(dailyAvg);
    }

    // WEEKLY SCHEDULE LOGIC
    const dayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon...

    // Sunday: Long Run
    if (dayOfWeek === 0) {
        return {
            title: "Long Run",
            dist: longRunDist,
            desc: `Build endurance for your ${favDist} goal. Keep a conversational pace.`,
            intensity: "Medium",
            isRest: false
        };
    }

    // Wednesday: Speed Work
    if (dayOfWeek === 3) {
        return {
            title: "Intervals",
            dist: fmt(5),
            desc: "Warm up, then 4x400m fast with 2m rest.",
            intensity: "High",
            isRest: false
        };
    }

    // Default: Easy Run
    return {
        title: "Easy Run",
        dist: baseRunDist,
        desc: "Maintenance run to keep the legs moving.",
        intensity: "Low",
        isRest: false
    };
};

// 2. GENERATE WEEKLY PLAN (For the Plan Screen later)
export const generateWeeklyPlan = (userData) => {
    // This returns an array of 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const todayIndex = new Date().getDay();

    return days.map((day, index) => {
        let type = "Rest";
        let distance = 0;

        if (index === 0) { type = "Long Run"; distance = 10; }
        if (index === 2) { type = "Easy Run"; distance = 5; }
        if (index === 3) { type = "Intervals"; distance = 6; }
        if (index === 5) { type = "Tempo"; distance = 7; }

        let status = "upcoming";
        if (index < todayIndex) status = "missed";
        if (index === todayIndex) status = "today";

        // Check if user actually ran on past days (Advanced)
        // For now, simple logic

        return { day, type, distance, status };
    });
};

// 3. RECALCULATE PLAN AFTER BREAK (Injury/Vacation)
export const recalculatePlanAfterBreak = (daysOff, reason, currentGoal, currentPlan) => {
    // 1. Calculate regression based on time off
    let regressionWeeks = 0;
    if (daysOff > 7) regressionWeeks = 1;
    if (daysOff > 14) regressionWeeks = 2;
    if (daysOff > 30) regressionWeeks = 4; // Complete reset

    // 2. Determine new focus
    let newFocus = "Resume Training";
    if (reason === 'Injured') {
        newFocus = "Return to Running";
        // If injured > 3 days, force regression
        if (daysOff > 3 && regressionWeeks === 0) regressionWeeks = 1;
    } else {
        newFocus = "Resume Training";
    }

    // 3. Generate a new "Week 1" based on the regression
    // Ideally we would look at the *previous* plan's intensity and dial it back.
    // For this MVP, we will generate a 'Recovery Week' schedule.

    const recoveryWeek = {
        weekNum: 1,
        focus: newFocus,
        totalDist: "15 km", // Reduced volume
        workouts: [
            { day: 'Mon', title: 'Rest', detail: 'Rest', icon: 'bed', isRest: true },
            { day: 'Tue', title: 'Walk/Run', detail: '20 min alternating', icon: 'walk', isRest: false },
            { day: 'Wed', title: 'Rest', detail: 'Rest', icon: 'bed', isRest: true },
            { day: 'Thu', title: 'Easy Run', detail: '3 km very easy', icon: 'run', isRest: false },
            { day: 'Fri', title: 'Rest', detail: 'Rest', icon: 'bed', isRest: true },
            { day: 'Sat', title: 'Long Walk/Run', detail: '5 km run/walk', icon: 'timer', isRest: false },
            { day: 'Sun', title: 'Rest', detail: 'Active Recovery', icon: 'bicycle', isRest: true }
        ]
    };

    // If only a few days off, we can be more aggressive
    if (daysOff <= 5 && reason === 'Vacation') {
        recoveryWeek.focus = "Ease Back In";
        recoveryWeek.totalDist = "20 km";
        recoveryWeek.workouts[3] = { day: 'Thu', title: 'Steady Run', detail: '5 km steady', icon: 'run', isRest: false };
    }

    return {
        ...currentPlan, // Keep other metadata
        goal: currentGoal,
        status: 'Active', // <--- CRITICAL: Force Active Status
        startDate: new Date().toISOString(),
        weeks: [recoveryWeek, ...currentPlan.weeks.slice(1)] // Replace first week, keep rest
    };
};
