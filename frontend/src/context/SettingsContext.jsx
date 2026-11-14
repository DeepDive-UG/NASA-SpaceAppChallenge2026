import { createContext, useContext, useEffect, useState } from "react";

const SettingsContext = createContext(null);

const FONT_SIZES = { small: "90%", medium: "100%", large: "115%", xlarge: "130%" };
const VALID_CONTRASTS = ["low", "normal", "high"];

const load = (key, fallback) => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
};

function getInitialContrast() {
    const saved = load("contrast", "");
    if (VALID_CONTRASTS.includes(saved)) return saved;
    if (window.matchMedia?.("(prefers-contrast: more)").matches) return "high";
    if (window.matchMedia?.("(prefers-contrast: less)").matches) return "low";
    return "normal";
}

export function SettingsProvider({ children }) {
    const [theme, setTheme] = useState(() =>
        load("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    );
    const [contrast, setContrast] = useState(getInitialContrast);
    const [fontSize, setFontSize] = useState(() => load("fontSize", "medium"));

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        try { localStorage.setItem("theme", theme); } catch { }
    }, [theme]);

    useEffect(() => {
        document.documentElement.dataset.contrast = contrast;
        try { localStorage.setItem("contrast", contrast); } catch { }
    }, [contrast]);

    useEffect(() => {
        document.documentElement.style.setProperty("--font-size", FONT_SIZES[fontSize]);
        try { localStorage.setItem("fontSize", fontSize); } catch { }
    }, [fontSize]);

    return (
        <SettingsContext.Provider value={{ theme, setTheme, contrast, setContrast, fontSize, setFontSize }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => useContext(SettingsContext);