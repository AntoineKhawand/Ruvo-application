export const getFlag = (country) => {
    if (!country) return '🌍';

    const input = country.toLowerCase().trim();

    // 1. Map common full names/aliases to ISO codes
    const nameToCode = {
        'lebanon': 'LB', 'usa': 'US', 'united states': 'US', 'uk': 'GB', 'united kingdom': 'GB',
        'france': 'FR', 'germany': 'DE', 'italy': 'IT', 'spain': 'ES', 'canada': 'CA',
        'australia': 'AU', 'japan': 'JP', 'china': 'CN', 'india': 'IN', 'brazil': 'BR',
        'argentina': 'AR', 'uae': 'AE', 'dubai': 'AE', 'saudi arabia': 'SA', 'qatar': 'QA',
        'egypt': 'EG', 'russia': 'RU', 'mexico': 'MX', 'south africa': 'ZA', 'turkey': 'TR',
        'switzerland': 'CH', 'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK',
        'belgium': 'BE', 'austria': 'AT', 'portugal': 'PT', 'greece': 'GR', 'jordan': 'JO',
        'kuwait': 'KW', 'bahrain': 'BH', 'oman': 'OM', 'cyprus': 'CY', 'ireland': 'IE'
    };

    // Determine the 2-letter code
    let code = '';
    if (input.length === 2) {
        code = input.toUpperCase(); // Already a code (e.g., "LB")
    } else {
        code = nameToCode[input]; // Look up the code from the name
    }

    if (!code) return '🏳️'; // Fallback if name is not in the alias map

    // 2. CONVERT ISO CODE TO EMOJI (The "Universal" way for all 250+ countries)
    // This converts "LB" -> 🇱🇧 automatically
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