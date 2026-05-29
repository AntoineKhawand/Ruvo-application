import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleTheme = useCallback(() => setIsDarkMode(prev => !prev), []);

  const theme = useMemo(() => ({
    dark: isDarkMode,
    colors: {
      background: isDarkMode ? '#000000' : '#F2F2F7',
      card: isDarkMode ? '#1C1C1E' : '#FFFFFF',
      text: isDarkMode ? '#FFFFFF' : '#000000',
      subText: isDarkMode ? '#888888' : '#666666',
      border: isDarkMode ? '#333333' : '#E5E5EA',
      accent: '#CCFF00',
      tint: isDarkMode ? '#FFFFFF' : '#000000'
    }
  }), [isDarkMode]);

  const contextValue = useMemo(() => ({ theme, toggleTheme, isDarkMode }), [theme, toggleTheme, isDarkMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
