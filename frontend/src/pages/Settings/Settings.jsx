import Navigation from "../../components/Navigation/Navigation";
import { useSettings } from "../../context/SettingsContext.jsx";
import "./Settings.css";
import AccountSecurity from "../Settings.jsx";

const THEMES = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
];

const CONTRASTS = [
    { id: "low", label: "Low" },
    { id: "normal", label: "Normal" },
    { id: "high", label: "High" },
];

const FONT_SIZES = [
    { id: "small", label: "Small" },
    { id: "medium", label: "Medium" },
    { id: "large", label: "Large" },
    { id: "xlarge", label: "Extra large" },
];

function Segmented({ label, options, value, onChange }) {
    return (
        <div className="st-seg" role="group" aria-label={label}>
            {options.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    className={`st-seg-btn${value === o.id ? " is-active" : ""}`}
                    aria-pressed={value === o.id}
                    onClick={() => onChange(o.id)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function Settings() {
    const { theme, setTheme, contrast, setContrast, fontSize, setFontSize } = useSettings();

    return (
        <div className="st-layout">
            <Navigation />

            <main className="st-main">
                <div className="st">
                    <h1 className="st-title">Settings</h1>

                    <section className="st-card">
                        <h2 className="st-section">Accessibility</h2>

                        <div className="st-row">
                            <div className="st-text">
                                <span className="st-label">Theme</span>
                                <span className="st-desc">Choose a light or dark appearance.</span>
                            </div>
                            <Segmented label="Theme" options={THEMES} value={theme} onChange={setTheme} />
                        </div>

                        <div className="st-row">
                            <div className="st-text">
                                <span className="st-label">Contrast</span>
                                <span className="st-desc">Adjust visual contrast across text, surfaces, and borders.</span>
                            </div>
                            <Segmented label="Contrast" options={CONTRASTS} value={contrast} onChange={setContrast} />
                        </div>

                        <div className="st-row">
                            <div className="st-text">
                                <span className="st-label">Font size</span>
                                <span className="st-desc">Makes text across the app smaller or larger.</span>
                            </div>
                            <Segmented label="Font size" options={FONT_SIZES} value={fontSize} onChange={setFontSize} />
                        </div>
                    </section>
                    <AccountSecurity />
                </div>
            </main>
        </div>
    );
}