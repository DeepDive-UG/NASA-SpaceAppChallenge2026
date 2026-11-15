import { useState, useRef, useEffect } from "react";
import Navigation from "../../components/Navigation/Navigation";
import { fieldApi } from "../../lib/field";
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    // wczytaj zapisany sprzęt z backendu
    useEffect(() => {
        const controller = new AbortController();
        fieldApi("gear/", { signal: controller.signal })
            .then((result) => setGear(result.gear))
            .catch((e) => {
                if (e.name !== "AbortError") setError(e.message);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, []);

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

    const addGear = async (name) => {
        setOpen(false);
        setError("");
        try {
            const { gear: created } = await fieldApi("gear/", { method: "POST", body: { name } });
            setGear((prev) => [...prev, created]);
        } catch (e) {
            setError(e.message);
        }
    };

    // zmiana od razu na ekranie; jeśli zapis się nie uda, cofamy
    const setStatus = async (id, status) => {
        const previous = gear.find((g) => g.id === id)?.status;
        if (!previous || previous === status) return;
        setError("");
        setGear((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
        try {
            await fieldApi(`gear/${id}/`, { method: "PATCH", body: { status } });
        } catch (e) {
            setGear((prev) => prev.map((g) => (g.id === id ? { ...g, status: previous } : g)));
            setError(e.message);
        }
    };

    const removeGear = async (item) => {
        if (!window.confirm(`Remove ${item.name}?`)) return;
        setError("");
        const index = gear.findIndex((g) => g.id === item.id);
        setGear((prev) => prev.filter((g) => g.id !== item.id));
        try {
            await fieldApi(`gear/${item.id}/`, { method: "DELETE" });
        } catch (e) {
            // przywróć element na dawne miejsce
            setGear((prev) => {
                const next = [...prev];
                next.splice(Math.min(index, next.length), 0, item);
                return next;
            });
            setError(e.message);
        }
    };

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

                    {error && <p className="mg-error" role="alert">{error}</p>}

                    <section className="mg-card">
                        {loading ? (
                            <p className="mg-empty" role="status">Loading your gear…</p>
                        ) : gear.length === 0 ? (
                            <p className="mg-empty">No gear yet. Use “Add gear” to add your first machine.</p>
                        ) : (
                            <ul className="mg-list">
                                {gear.map((item) => (
                                    <li key={item.id} className="mg-row">
                                        <span className="mg-name">{item.name}</span>

                                        <div className="mg-actions">
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

                                            <button
                                                type="button"
                                                className="mg-remove"
                                                aria-label={`Remove ${item.name}`}
                                                title="Remove"
                                                onClick={() => removeGear(item)}
                                            >
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" />
                                                </svg>
                                            </button>
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