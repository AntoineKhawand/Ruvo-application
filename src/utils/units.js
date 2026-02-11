export const formatDistance = (distanceInKm, unitSystem = 'metric', decimals = 2) => {
    const dist = parseFloat(distanceInKm) || 0;

    if (unitSystem === 'imperial') {
        const miles = dist * 0.621371;
        return `${miles.toFixed(decimals)} mi`;
    }
    return `${dist.toFixed(decimals)} km`;
};

export const formatPace = (paceInMinPerKm, unitSystem = 'metric') => {
    if (!paceInMinPerKm || paceInMinPerKm === '--:--') return '--:--';

    // Parse "MM:SS" string to total minutes
    const parts = paceInMinPerKm.split(':');
    let totalMinutes = parseInt(parts[0]) + (parseInt(parts[1]) / 60);

    if (unitSystem === 'imperial') {
        // Convert pace: min/km * 1.60934 = min/mile
        totalMinutes = totalMinutes * 1.60934;
    }

    const min = Math.floor(totalMinutes);
    const sec = Math.round((totalMinutes - min) * 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

export const getUnitLabel = (unitSystem = 'metric') => {
    return unitSystem === 'imperial' ? 'mi' : 'km';
};

// Helper just for the raw number if components handle labels separately
export const convertDistanceValue = (distanceInKm, unitSystem = 'metric') => {
    const dist = parseFloat(distanceInKm) || 0;
    if (unitSystem === 'imperial') {
        return dist * 0.621371;
    }
    return dist;
};
