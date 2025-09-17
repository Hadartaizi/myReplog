// SettingsContext.js
import React, { createContext, useState } from 'react';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [fontSize, setFontSize] = useState(16);
  const [language, setLanguage] = useState('he'); // 'he' או 'en'

  return (
    <SettingsContext.Provider value={{ fontSize, setFontSize, language, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
};
