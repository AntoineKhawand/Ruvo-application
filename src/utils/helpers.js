import { COUNTRIES } from '../constants/countries';

export const getFlag = (country) => {
    if (!country) return '🌍';

    const input = country.toLowerCase().trim();

    // 1. Try to find by name in our master list
    const found = COUNTRIES.find(c => c.name.toLowerCase() === input);
    let code = found ? found.code : null;

    // 2. Fallback for common aliases if needed
    if (!code) {
        const aliases = {
            'usa': 'US', 'uk': 'GB', 'dubai': 'AE', 'south korea': 'KR'
        };
        code = aliases[input];
    }

    // 3. If input represents a 2-letter code itself
    if (!code && input.length === 2) {
        code = input.toUpperCase();
    }

    if (!code) return '🏳️'; // Unknown

    // 4. Convert ISO Code to Emoji
    return code
        .toUpperCase()
        .replace(/./g, (char) =>
            String.fromCodePoint(char.charCodeAt(0) + 127397)
        );
};

// --- UPDATED SHOE LOGIC WITH MORE MODELS ---
const SHOE_LOGIC = [
    { limit: 400, keywords: ['vaporfly', 'alphafly', 'adios pro', 'metaspeed', 'endorphin pro', 'rocket', 'elite', 'takumi', 'streak', 'carbon', 'sc elite', 'fuelcell elite', 'prime x'] },
    { limit: 550, keywords: ['kinvara', 'mach', 'rebel', 'hyperion', 'magic speed', 'rival', 'boston', 'adíos', 'noosa', 'floatride energy', 'liberate', 'deviate'] },
    { limit: 650, keywords: ['speedgoat', 'peregrine', 'cascadia', 'terrex', 'lone peak', 'wildhorse', 'pegasus trail', 'hierro', 'catamount', 'zinal', 'cloudultra', 'tecton x', 'mafate'] },
    { limit: 750, keywords: ['invincible', 'bondi', 'more v', 'triumph', 'aurora', 'glideride', 'monster', 'cloudmonster', 'magnify nitro', 'skyward'] },
    { limit: 800, keywords: ['pegasus', 'ghost', 'clifton', 'nimbus', 'cumulus', 'glycerin', 'adrenaline', 'kayano', 'guide', 'infinity', 'novablast', 'rider', 'vomero', '880', '1080', 'ultraboost', 'velocity nitro', 'cloudsurfer', 'cloudrunner', 'wave rider'] },
    { limit: 1000, keywords: ['air force', 'stan smith', 'superstar', 'jordan', 'dunk', 'air max', 'nano', 'metcon'] }
];

export const detectShoeDistance = (name) => {
    if (!name) return null;
    const lowerName = name.toLowerCase();

    for (const category of SHOE_LOGIC) {
        if (category.keywords.some(keyword => lowerName.includes(keyword))) {
            return category.limit;
        }
    }
    return null;
};