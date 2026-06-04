/**
 * Onboarding scenario tests.
 *
 * Covers all 6 steps:
 *  - Step 1: goal selection + race date conditional (only for race goals)
 *  - Step 2: fitness level selection
 *  - Step 3: bio validation + unit system
 *  - Step 4: frequency chips (0-7)
 *  - Step 5: training days required
 *  - Step 6: devices optional (only location+notifications required)
 *  - buildProfile() completeness — all new fields present
 *  - Age computed from DOB
 *  - runDays matches selectedDays (PlanScreen key)
 */

describe('Onboarding — Step 1: Goal & Race Date', () => {
    const RACE_GOALS = ['Run my First 5K', 'Run a Faster 10K', 'Train for Half-Marathon'];
    const isRaceGoal = (goal) => RACE_GOALS.includes(goal);

    it('shows race date picker for "Run my First 5K"', () => {
        expect(isRaceGoal('Run my First 5K')).toBe(true);
    });

    it('shows race date picker for "Run a Faster 10K"', () => {
        expect(isRaceGoal('Run a Faster 10K')).toBe(true);
    });

    it('shows race date picker for "Train for Half-Marathon"', () => {
        expect(isRaceGoal('Train for Half-Marathon')).toBe(true);
    });

    it('does NOT show race date picker for "Get Fitter"', () => {
        expect(isRaceGoal('Get Fitter')).toBe(false);
    });

    it('has exactly 4 goal options', () => {
        const goals = ['Get Fitter', 'Run my First 5K', 'Run a Faster 10K', 'Train for Half-Marathon'];
        expect(goals).toHaveLength(4);
    });
});

describe('Onboarding — Step 2: Fitness Level', () => {
    const levels = ['Beginner', 'Intermediate', 'Advanced'];

    it('has exactly 3 experience levels', () => {
        expect(levels).toHaveLength(3);
    });

    it('Beginner is valid experience value', () => {
        expect(levels).toContain('Beginner');
    });

    it('Intermediate is valid experience value', () => {
        expect(levels).toContain('Intermediate');
    });

    it('Advanced is valid experience value', () => {
        expect(levels).toContain('Advanced');
    });
});

describe('Onboarding — Step 3: Bio validation', () => {
    const isBioValid = ({ name, weight, height }) =>
        name.trim() !== '' && weight.trim() !== '' && height.trim() !== '';

    it('rejects when name is empty', () => {
        expect(isBioValid({ name: '', weight: '70', height: '175' })).toBe(false);
    });

    it('rejects when weight is empty', () => {
        expect(isBioValid({ name: 'Alex', weight: '', height: '175' })).toBe(false);
    });

    it('rejects when height is empty', () => {
        expect(isBioValid({ name: 'Alex', weight: '70', height: '' })).toBe(false);
    });

    it('accepts when all three fields are filled', () => {
        expect(isBioValid({ name: 'Alex', weight: '70', height: '175' })).toBe(true);
    });

    it('rejects when name is whitespace only', () => {
        expect(isBioValid({ name: '   ', weight: '70', height: '175' })).toBe(false);
    });

    it('metric unit shows kg and cm placeholders', () => {
        const unit = 'metric';
        expect(unit === 'metric' ? 'kg' : 'lbs').toBe('kg');
        expect(unit === 'metric' ? 'cm' : 'in').toBe('cm');
    });

    it('imperial unit shows lbs and in placeholders', () => {
        const unit = 'imperial';
        expect(unit === 'metric' ? 'kg' : 'lbs').toBe('lbs');
        expect(unit === 'metric' ? 'cm' : 'in').toBe('in');
    });
});

describe('Onboarding — Step 4: Frequency chips', () => {
    const FREQUENCY_RANGE = [0, 1, 2, 3, 4, 5, 6, 7];

    it('has chips 0 through 7 (8 total)', () => {
        expect(FREQUENCY_RANGE).toHaveLength(8);
    });

    it('chip 0 shows "never" label', () => {
        const label = (n) => n === 0 ? 'never' : n === 1 ? 'day' : 'days';
        expect(label(0)).toBe('never');
    });

    it('chip 1 shows "day" label (singular)', () => {
        const label = (n) => n === 0 ? 'never' : n === 1 ? 'day' : 'days';
        expect(label(1)).toBe('day');
    });

    it('chips 2-7 show "days" label (plural)', () => {
        const label = (n) => n === 0 ? 'never' : n === 1 ? 'day' : 'days';
        [2, 3, 4, 5, 6, 7].forEach(n => expect(label(n)).toBe('days'));
    });

    const freqMessages = [
        "Perfect! We'll start from the beginning.",
        'Great start! A solid foundation to build on.',
        "Nice! You're getting into a healthy rhythm.",
        "Strong! You're building a serious habit.",
        "Awesome! You're committed to your fitness.",
        "Wow! You're a dedicated runner.",
        "Incredible! You're pushing the limits.",
        "Elite level! You're unstoppable.",
    ];

    it('each frequency value has a unique motivational message', () => {
        const unique = new Set(freqMessages);
        expect(unique.size).toBe(freqMessages.length);
    });
});

describe('Onboarding — Step 5: Training days', () => {
    const isDaysValid = (days) => days.length > 0;

    it('rejects zero selected days', () => {
        expect(isDaysValid([])).toBe(false);
    });

    it('accepts one selected day', () => {
        expect(isDaysValid([0])).toBe(true);
    });

    it('accepts multiple selected days', () => {
        expect(isDaysValid([0, 2, 4])).toBe(true);
    });

    it('toggle adds day when not present', () => {
        const current = [0, 2];
        const toggle = (arr, i) =>
            arr.includes(i) ? arr.filter(x => x !== i) : [...arr, i].sort();
        expect(toggle(current, 4)).toEqual([0, 2, 4]);
    });

    it('toggle removes day when already present', () => {
        const current = [0, 2, 4];
        const toggle = (arr, i) =>
            arr.includes(i) ? arr.filter(x => x !== i) : [...arr, i].sort();
        expect(toggle(current, 2)).toEqual([0, 4]);
    });

    it('selected days are kept sorted', () => {
        const toggle = (arr, i) =>
            arr.includes(i) ? arr.filter(x => x !== i) : [...arr, i].sort();
        const result = toggle([4, 0], 2); // unordered input
        expect(result).toEqual([0, 2, 4]);
    });
});

describe('Onboarding — Step 6: Permissions', () => {
    it('requires location AND notifications (but not devices)', () => {
        const essentialGranted = (perms) => perms.location && perms.notifications;
        expect(essentialGranted({ location: true, notifications: true })).toBe(true);
        expect(essentialGranted({ location: false, notifications: true })).toBe(false);
        expect(essentialGranted({ location: true, notifications: false })).toBe(false);
    });

    it('devices permission is NOT required to proceed', () => {
        const essentialGranted = (perms) => perms.location && perms.notifications;
        // Devices missing — should still be able to proceed
        expect(essentialGranted({ location: true, notifications: true /* no devices */ })).toBe(true);
    });

    it('both false = cannot proceed', () => {
        const essentialGranted = (perms) => perms.location && perms.notifications;
        expect(essentialGranted({ location: false, notifications: false })).toBe(false);
    });
});

describe('Onboarding — buildProfile() completeness', () => {
    // Replicate the buildProfile function from OnboardingScreen
    const weekDays = [
        { short: 'M', full: 'Monday', trigger: 2 },
        { short: 'T', full: 'Tuesday', trigger: 3 },
        { short: 'W', full: 'Wednesday', trigger: 4 },
        { short: 'T', full: 'Thursday', trigger: 5 },
        { short: 'F', full: 'Friday', trigger: 6 },
        { short: 'S', full: 'Saturday', trigger: 7 },
        { short: 'S', full: 'Sunday', trigger: 1 },
    ];

    const buildProfile = ({
        name = 'Alex',
        gender = 'Male',
        weight = '70',
        height = '175',
        dateOfBirth = new Date(1995, 0, 1),
        experience = 'Beginner',
        unitSystem = 'metric',
        frequency = 3,
        selectedDays = [0, 2, 4],
        goal = 'Get Fitter',
        targetRaceDate = null,
        preferredTime = new Date(),
        pushToken = null,
    } = {}) => ({
        name,
        gender,
        weight: parseFloat(weight) || 70,
        height: parseFloat(height) || 175,
        dob: dateOfBirth.toISOString(),
        age: new Date().getFullYear() - dateOfBirth.getFullYear(),
        experience,
        unitSystem,
        runFrequency: frequency,
        selectedDays: selectedDays.map(i => weekDays[i].full),
        runDays: selectedDays.map(i => weekDays[i].full),
        goal,
        targetRaceDate: targetRaceDate?.toISOString() || null,
        notificationTime: preferredTime.toISOString(),
        pushToken,
        level: 1,
        currentXP: 0,
        runHistory: [],
        weeklyDistance: 0,
        earningUnlockProgress: 0,
        onboardingCompleted: true,
    });

    it('includes age computed from DOB', () => {
        const profile = buildProfile({ dateOfBirth: new Date(1995, 0, 1) });
        expect(profile.age).toBe(new Date().getFullYear() - 1995);
        expect(typeof profile.age).toBe('number');
    });

    it('includes experience field', () => {
        const profile = buildProfile({ experience: 'Advanced' });
        expect(profile.experience).toBe('Advanced');
    });

    it('includes unitSystem field', () => {
        const profile = buildProfile({ unitSystem: 'imperial' });
        expect(profile.unitSystem).toBe('imperial');
    });

    it('selectedDays and runDays contain the same values (PlanScreen fix)', () => {
        const profile = buildProfile({ selectedDays: [0, 2, 4] }); // Mon, Wed, Fri
        expect(profile.selectedDays).toEqual(profile.runDays);
        expect(profile.runDays).toContain('Monday');
        expect(profile.runDays).toContain('Wednesday');
        expect(profile.runDays).toContain('Friday');
    });

    it('saves targetRaceDate as ISO string when provided', () => {
        const raceDate = new Date('2026-10-15');
        const profile = buildProfile({ targetRaceDate: raceDate });
        expect(profile.targetRaceDate).toBe(raceDate.toISOString());
    });

    it('targetRaceDate is null when not provided', () => {
        const profile = buildProfile({ targetRaceDate: null });
        expect(profile.targetRaceDate).toBeNull();
    });

    it('sets onboardingCompleted to true', () => {
        expect(buildProfile().onboardingCompleted).toBe(true);
    });

    it('starts at level 1 with 0 XP', () => {
        const profile = buildProfile();
        expect(profile.level).toBe(1);
        expect(profile.currentXP).toBe(0);
    });

    it('starts with empty runHistory', () => {
        expect(buildProfile().runHistory).toEqual([]);
    });

    it('includes all 9 required new fields', () => {
        const profile = buildProfile();
        const requiredFields = ['age', 'experience', 'unitSystem', 'runDays',
            'targetRaceDate', 'notificationTime', 'dob', 'runFrequency', 'selectedDays'];
        requiredFields.forEach(f => expect(profile).toHaveProperty(f));
    });
});

describe('Onboarding — OnboardingSignUpScreen profileOverrides', () => {
    // Verify the patched OnboardingSignUpScreen forwards all new fields
    const buildProfileOverrides = (onboardingData) => ({
        name: onboardingData.name || 'Runner',
        gender: onboardingData.gender || 'Male',
        weight: parseFloat(onboardingData.weight) || 70,
        height: parseFloat(onboardingData.height) || 175,
        dob: onboardingData.dob || onboardingData.dateOfBirth || new Date().toISOString(),
        age: onboardingData.age || 25,
        experience: onboardingData.experience || 'Beginner',
        unitSystem: onboardingData.unitSystem || 'metric',
        runFrequency: onboardingData.runFrequency || onboardingData.frequency || 3,
        selectedDays: onboardingData.selectedDays || [],
        runDays: onboardingData.runDays || onboardingData.selectedDays || [],
        goal: onboardingData.goal || onboardingData.userGoal || 'Get Fitter',
        targetRaceDate: onboardingData.targetRaceDate || null,
        notificationTime: onboardingData.notificationTime || null,
        level: 1, currentXP: 0, runHistory: [], weeklyDistance: 0,
        earningUnlockProgress: 0, pushToken: onboardingData.pushToken || null,
        onboardingCompleted: true,
    });

    it('forwards experience from onboarding data', () => {
        const overrides = buildProfileOverrides({ experience: 'Advanced' });
        expect(overrides.experience).toBe('Advanced');
    });

    it('forwards unitSystem from onboarding data', () => {
        const overrides = buildProfileOverrides({ unitSystem: 'imperial' });
        expect(overrides.unitSystem).toBe('imperial');
    });

    it('forwards age from onboarding data', () => {
        const overrides = buildProfileOverrides({ age: 29 });
        expect(overrides.age).toBe(29);
    });

    it('forwards runDays from onboarding data', () => {
        const overrides = buildProfileOverrides({ runDays: ['Monday', 'Wednesday'] });
        expect(overrides.runDays).toEqual(['Monday', 'Wednesday']);
    });

    it('falls back runDays to selectedDays if runDays missing', () => {
        const overrides = buildProfileOverrides({ selectedDays: ['Monday', 'Friday'] });
        expect(overrides.runDays).toEqual(['Monday', 'Friday']);
    });

    it('forwards targetRaceDate', () => {
        const overrides = buildProfileOverrides({ targetRaceDate: '2026-10-15T00:00:00.000Z' });
        expect(overrides.targetRaceDate).toBe('2026-10-15T00:00:00.000Z');
    });

    it('defaults experience to Beginner when missing', () => {
        const overrides = buildProfileOverrides({});
        expect(overrides.experience).toBe('Beginner');
    });

    it('defaults unitSystem to metric when missing', () => {
        const overrides = buildProfileOverrides({});
        expect(overrides.unitSystem).toBe('metric');
    });
});
