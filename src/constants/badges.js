
export const BADGES = [
    // --- DISTANCE MILESTONES ---
    {
        id: 'b_first_run',
        name: 'First Steps',
        description: 'Completed your first run!',
        icon: 'footsteps', // Ionicons
        color: '#CCFF00', // Neon
        category: 'milestone',
        condition: (run, history) => history.length === 0 // First run ever
    },
    {
        id: 'b_5k',
        name: 'High Five',
        description: 'Ran 5km in a single session.',
        icon: 'hand-left',
        color: '#CCFF00',
        category: 'milestone',
        condition: (run) => run.distance >= 5
    },
    {
        id: 'b_10k',
        name: '10K Finisher',
        description: 'Ran 10km in a single session.',
        icon: 'ribbon',
        color: '#FF4500', // OrangeRed
        category: 'milestone',
        condition: (run) => run.distance >= 10
    },
    {
        id: 'b_half',
        name: 'Half Marathon',
        description: 'Ran 21.1km in a single session.',
        icon: 'medal',
        color: '#FFD700', // Gold
        category: 'milestone',
        condition: (run) => run.distance >= 21.097
    },

    // --- TIME OF DAY ---
    {
        id: 'b_early_bird',
        name: 'Early Bird',
        description: 'Finished a run before 7 AM.',
        icon: 'sunny',
        color: '#FDD835', // Yellow
        category: 'lifestyle',
        condition: (run) => {
            const date = new Date(run.date); // run.date is ISO string or timestamp
            const hour = date.getHours();
            return hour < 7;
        }
    },
    {
        id: 'b_night_owl',
        name: 'Night Owl',
        description: 'Finished a run after 8 PM.',
        icon: 'moon',
        color: '#536DFE', // Indigo
        category: 'lifestyle',
        condition: (run) => {
            const date = new Date(run.date);
            const hour = date.getHours();
            return hour >= 20;
        }
    },

    // --- STREAK & CONSISTENCY ---
    {
        id: 'b_10_runs',
        name: 'Dedicated',
        description: 'Completed 10 total runs.',
        icon: 'flame',
        color: '#FF5722', // Deep Orange
        category: 'consistency',
        condition: (run, history) => history.length === 9 // +1 current run = 10
    },
    {
        id: 'b_perfect_week',
        name: 'Perfect Week',
        description: 'Ran 7 days in a row.',
        icon: 'calendar',
        color: '#00E676', // Green
        category: 'consistency',
        condition: (run, history) => {
            // Check if user has runs on 7 consecutive days
            const allRuns = [...history, run];
            const sortedDates = allRuns.map(r => new Date(r.date).toDateString()).sort();

            let streak = 1;
            for (let i = 1; i < sortedDates.length; i++) {
                const prev = new Date(sortedDates[i - 1]);
                const curr = new Date(sortedDates[i]);
                const diffDays = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    streak++;
                    if (streak >= 7) return true;
                } else if (diffDays > 1) {
                    streak = 1;
                }
            }
            return false;
        }
    },

    // --- DISTANCE ACCUMULATION ---
    {
        id: 'b_century_club',
        name: 'Century Club',
        description: 'Ran 100km total distance.',
        icon: 'trophy',
        color: '#9C27B0', // Purple
        category: 'milestone',
        condition: (run, history) => {
            const totalKm = history.reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0) + (parseFloat(run.distance) || 0);
            return totalKm >= 100;
        }
    },

    // --- WEEKLY PATTERNS ---
    {
        id: 'b_weekend_warrior',
        name: 'Weekend Warrior',
        description: 'Ran on both Saturday and Sunday.',
        icon: 'beer',
        color: '#FF9800', // Orange
        category: 'lifestyle',
        condition: (run, history) => {
            // Get runs from the current weekend
            const currentDate = new Date(run.date);
            const currentDay = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

            // Find the most recent Saturday and Sunday
            const recentRuns = [...history, run].filter(r => {
                const runDate = new Date(r.date);
                const daysDiff = Math.floor((currentDate - runDate) / (1000 * 60 * 60 * 24));
                return daysDiff <= 7; // Within last week
            });

            const hasSaturday = recentRuns.some(r => new Date(r.date).getDay() === 6);
            const hasSunday = recentRuns.some(r => new Date(r.date).getDay() === 0);

            return hasSaturday && hasSunday;
        }
    },

    // --- ELEVATION CHALLENGES ---
    {
        id: 'b_hill_hunter',
        name: 'Hill Hunter',
        description: 'Completed 10 runs with 100m+ elevation.',
        icon: 'trending-up',
        color: '#795548', // Brown
        category: 'elevation',
        condition: (run, history) => {
            const hillRuns = history.filter(r => (parseFloat(r.elevation) || 0) >= 100);
            const currentIsHill = (parseFloat(run.elevation) || 0) >= 100;
            return currentIsHill && hillRuns.length >= 9; // +1 current = 10
        }
    },

    // --- SPEED PERFORMANCE ---
    {
        id: 'b_sub4_specialist',
        name: 'Sub-4 Specialist',
        description: 'Completed 5 runs under 4:00/km pace.',
        icon: 'flash',
        color: '#00BCD4', // Cyan
        category: 'performance',
        condition: (run, history) => {
            // Convert pace string "4:30" to minutes
            const paceToMinutes = (paceStr) => {
                if (!paceStr || typeof paceStr !== 'string') return 999;
                const parts = paceStr.split(':');
                return parseInt(parts[0]) + parseInt(parts[1]) / 60;
            };

            const sub4Runs = history.filter(r => paceToMinutes(r.pace) < 4.0);
            const currentIsSub4 = paceToMinutes(run.pace) < 4.0;

            return currentIsSub4 && sub4Runs.length >= 4; // +1 current = 5
        }
    }
];
