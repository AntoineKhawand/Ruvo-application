import { createContext } from 'react';

// Exported separately to avoid require cycles (App.js ↔ Screen imports)
export const SecurityContext = createContext({ isCompromised: false });
