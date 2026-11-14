import { useState, useRef, useEffect } from "react";
import Navigation from "../../components/Navigation/Navigation";
import "./myGear.css";

const GEAR_TYPES = [
    "Tractor",
    "Combine harvester",
    "Plough",
    "Seed drill",
    "Sprayer",
    "Fertilizer spreader",
    "Cultivator",
    "Harrow",
    "Mower",
    "Baler",
    "Trailer",
];

const STATUSES = [
    { id: "available", label: "Available" },
    { id: "unavailable", label: "Unavailable" },
];

export default function MyGear() {
    const [gear, setGear] = useState([]);
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);
    const nextId = useRef(1);

    // zamknij dropdown po kliknięciu poza nim lub po Escape
    useEffect(() => {
        const onClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    const addGear = (name) => {
        setGear((prev) => [...prev, { id: nextId.current++, name, status: "available" }]);
        setOpen(false);
    };

    const setStatus = (id, status) =>
        setGear((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));

    return (
        <div className="mg-layout">
            <Navigation />

            <main className="mg-main">
                <div className="mg">
                    <h1 className="mg-title">My Gear</h1>

                    <div className="mg-menu" ref={menuRef}>
                        <button
                            type="button"
                            className="mg-add"
                            aria-haspopup="listbox"
                            aria-expanded={open}
                            onClick={() => setOpen((o) => !o)}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 5v14M5 12h14" />
                            </svg>
                            Add gear
                            <svg className={`mg-caret${open ? " is-open" : ""}`} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </button>

                        {open && (
                            <ul className="mg-dropdown" role="listbox">
                                {GEAR_TYPES.map((name) => (
                                    <li key={name}>
                                        <button type="button" className="mg-option" onClick={() => addGear(name)}>
                                            {name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <section className="mg-card">
                        {gear.length === 0 ? (
                            <p className="mg-empty">No gear yet. Use “Add gear” to add your first machine.</p>
                        ) : (
                            <ul className="mg-list">
                                {gear.map((item) => (
                                    <li key={item.id} className="mg-row">
                                        <span className="mg-name">{item.name}</span>

                                        <div className="mg-status" role="group" aria-label={`Status of ${item.name}`}>
                                            {STATUSES.map((s) => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className={`mg-status-btn ${s.id}${item.status === s.id ? " is-active" : ""}`}
                                                    aria-pressed={item.status === s.id}
                                                    onClick={() => setStatus(item.id, s.id)}
                                                >
                                                    {s.label}
                                                </button>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
