// src/services/aiCoach.js

// 1. GENERATE TODAY'S WORKOUT BASED ON HISTORY
export const getTodayWorkout = (userData) => {
    // Safety check
    const history = userData?.runHistory || [];
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
            dist: "0 km",
            desc: "You ran today. Focus on hydration and stretching.",
            intensity: "Rest",
            isRest: true
        };
    }

    // B. NEW USER LOGIC
    if (runCount === 0) {
        return {
            title: "Baseline Run",
            dist: "2-3 km",
            desc: "A gentle jog to establish your current fitness level.",
            intensity: "Low",
            isRest: false
        };
    }

    // C. WEEKLY SCHEDULE LOGIC (Simple Pattern)
    const dayOfWeek = new Date().getDay(); // 0 = Sun, 1 = Mon...
    
    // Sunday: Long Run
    if (dayOfWeek === 0) {
        return {
            title: "Long Run",
            dist: "8-10 km",
            desc: "Build endurance. Keep a conversational pace.",
            intensity: "Medium",
            isRest: false
        };
    }
    
    // Wednesday: Speed Work
    if (dayOfWeek === 3) {
        return {
            title: "Intervals",
            dist: "5 km",
            desc: "Warm up, then 4x400m fast with 2m rest.",
            intensity: "High",
            isRest: false
        };
    }

    // Default: Easy Run
    return {
        title: "Easy Run",
        dist: "4-5 km",
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
