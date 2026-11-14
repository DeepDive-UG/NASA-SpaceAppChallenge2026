import { useState } from "react";
import Navigation from "../../components/Navigation/Navigation";
import "./myField.css";

const STEPS = [0, 25, 50, 75, 100]; // 2 końce + 3 punkty pomiędzy

const ITEMS = [
    "Lorem ipsum dolor sit amet",
    "Consectetur adipiscing elit",
    "Sed do eiusmod tempor incididunt",
    "Ut labore et dolore magna aliqua",
    "Ut enim ad minim veniam",
];

export default function MyField() {
    const [value, setValue] = useState(50);
    const [checked, setChecked] = useState([]);

    const toggle = (item) =>
        setChecked((prev) =>
            prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
        );

    return (
        <div className="mf-layout">
            <Navigation />

            <main className="mf-main">
                <div className="mf">
                    <h1 className="mf-title">My priorities</h1>

                    <section className="mf-card">
                        <div className="mf-slider-wrap" style={{ "--p": value / 100 }}>
                            <input
                                type="range"
                                className="mf-slider"
                                min="0"
                                max="100"
                                step="25"
                                value={value}
                                onChange={(e) => setValue(Number(e.target.value))}
                                aria-label="Slider"
                            />
                            <div className="mf-ticks" aria-hidden="true">
                                {STEPS.map((p) => (
                                    <span
                                        key={p}
                                        className={`mf-tick${p <= value ? " is-on" : ""}`}
                                        style={{ "--p": p / 100 }}
                                    />
                                ))}
                            </div>
                        </div>

                        <ul className="mf-list">
                            {ITEMS.map((item) => (
                                <li key={item}>
                                    <label className="mf-check">
                                        <input
                                            type="checkbox"
                                            checked={checked.includes(item)}
                                            onChange={() => toggle(item)}
                                        />
                                        <span>{item}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </main>
        </div>
    );
}