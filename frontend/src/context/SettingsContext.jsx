import { createContext, useContext, useEffect, useState } from "react";

const SettingsContext = createContext(null);

const FONT_SIZES = { small: "90%", medium: "100%", large: "115%", xlarge: "130%" };

const load = (key, fallback) => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

export function SettingsProvider({ children }) {
    const [theme, setTheme] = useState(() =>
        load("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
    const [fontSize, setFontSize] = useState(() => load("fontSize", "medium"));

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try { localStorage.setItem("theme", theme); } catch { }
    }, [theme]);

    useEffect(() => {
        document.documentElement.style.setProperty("--font-size", FONT_SIZES[fontSize]);
        try { localStorage.setItem("fontSize", fontSize); } catch { }
    }, [fontSize]);

    return (
        <SettingsContext.Provider value={{ theme, setTheme, fontSize, setFontSize }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);