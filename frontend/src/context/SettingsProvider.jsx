import { useEffect, useState } from 'react'
import { SettingsContext } from './SettingsContext'
function preference(key, allowed, fallback) {
  try { const value = localStorage.getItem(key); return allowed.includes(value) ? value : fallback } catch { return fallback }
}
export default function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => preference('croptips-theme', ['light', 'dark'], 'light'))
  const [fontSize, setFontSize] = useState(() => preference('croptips-font-size', ['small', 'medium', 'large', 'xlarge'], 'medium'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.fontSize = fontSize
    try { localStorage.setItem('croptips-theme', theme); localStorage.setItem('croptips-font-size', fontSize) } catch { /* Storage may be unavailable in private browser contexts. */ }
  }, [theme, fontSize])
  return <SettingsContext.Provider value={{ theme, setTheme, fontSize, setFontSize }}>{children}</SettingsContext.Provider>
}
