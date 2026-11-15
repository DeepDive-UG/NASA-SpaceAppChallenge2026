import { useEffect, useState } from "react";
import Navigation from "../../components/Navigation/Navigation";
import DecisionDisclaimer from "../../components/DecisionDisclaimer";
import { useField } from "../../lib/field";
import "./myArea.css";
// import { LEGENDS } from "./LEGENDS"; -- API pulls the legend from images
// gradients were hardcoded in LEGENDS.js and needed to be updated manually, the pulled legend seems more readable

const MASKS = [
    {
        id: 1,
        title: "Total Precipitation",
        variable: "ppt",
        description:
            "Total rain and snowfall across California. Shows which regions get the most water.",
    },
    {
        id: 2,
        title: "Temperature Max",
        variable: "tmax",
        description:
            "Highest daily temperatures across California. Hot areas face more crop heat stress.",
    },
    {
        id: 3,
        title: "Temperature Minimum",
        variable: "tmin",
        description:
            "Lowest daily temperatures across California. Helps spot frost risk.",
    },
    // tmean, tdmean, vpdmax, vpdmin: bez wpisu w LEGENDS.js legenda jest wycinana z mapy PRISM (/api/state-legend/)
    {
        id: 4,
        title: "Temperature Mean",
        variable: "tmean",
        description:
            "Average daily temperature across California. Shows the general growing climate.",
    },
    {
        id: 5,
        title: "Dew Point Mean",
        variable: "tdmean",
        description:
            "Average air moisture across California. Higher values mean more humid air.",
    },
    {
        id: 6,
        title: "Vapor Pressure Deficit Max",
        variable: "vpdmax",
        description:
            "Peak dryness of the air, usually in the afternoon. High values mean higher drought stress for crops.",
    },
    {
        id: 7,
        title: "Vapor Pressure Deficit Min",
        variable: "vpdmin",
        description:
            "Lowest dryness of the air, usually at night. Shows when crops can recover.",
    },
];

const DEFAULT_STATE = "CA"; // pokazywany, gdy pole nie ma jeszcze współrzędnych

// Mapa PRISM wycięta do stanu; ze współrzędnych backend sam wykrywa stan i stawia znacznik pola
const mapUrl = (variable, field) => {
    const params = new URLSearchParams({ variable });
    const lat = parseFloat(field?.latitude);
    const lon = parseFloat(field?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        params.set("lat", lat);
        params.set("lon", lon);
        if (field.name) params.set("label", field.name);
    } else {
        params.set("state", DEFAULT_STATE);
    }
    return `/api/state-map/?${params}`;
};

/* const Legend = ({ legend }) => {
    const { colors, edges, unit } = legend;
    const n = colors.length;
    const stops = colors.join(", ");
    const step = Math.ceil(edges.length / 6); // label roughly every 6th edge
    return (
        <div className="ma-legend">
            <div className="ma-legend-unit">{unit}</div>
            <div
                className="ma-legend-bar"
                style={{ background: `linear-gradient(to right, ${stops})` }}
            />
            <div className="ma-legend-ticks">
                {edges.map((edge, i) =>
                    i % step === 0 ? (
                        <span key={edge} style={{ left: `${((i + 1) / n) * 100}%` }}>
                            {edge}
                        </span>
                    ) : null
                )}
            </div>
        </div>
    );
}; -- reduntant, see line 6 */

const MyArea = () => {
    const [enabledMasks, setEnabledMasks] = useState([MASKS[0].id]);
    const activeMask = MASKS.find((mask) => enabledMasks.includes(mask.id));
    const toggleMask = (maskId) => setEnabledMasks([maskId]);

    const field = useField()?.record?.field;
    const [legendFailed, setLegendFailed] = useState(null); // zmienna, której legendy nie udało się pobrać
    const [map, setMap] = useState({ src: null, date: null, error: false });
    const url = activeMask ? mapUrl(activeMask.variable, field) : null;

    useEffect(() => {
        if (!url) return;
        const controller = new AbortController();
        let objectUrl = null;
        setMap({ src: null, date: null, error: false });
        fetch(url, { signal: controller.signal })
            .then((res) => {
                if (!res.ok) throw new Error("map unavailable");
                const date = res.headers.get("X-Prism-Date");
                return res.blob().then((blob) => ({ blob, date }));
            })
            .then(({ blob, date }) => {
                if (controller.signal.aborted) return;
                objectUrl = URL.createObjectURL(blob);
                setMap({ src: objectUrl, date, error: false });
            })
            .catch((e) => {
                if (e.name !== "AbortError") setMap({ src: null, date: null, error: true });
            });
        return () => {
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [url]);

    return (
        <div className="ma-layout">
            <Navigation />
            <main className="ma-main">
                <div className="ma-content">
                    <h1 className="ma-title">My area</h1>

                    <section className="ma-viewer" aria-label="Map gallery">
                        <div className="ma-map-column">
                            {activeMask && (
                                <div className="ma-overlay-description" aria-live="polite">
                                    <h2 className="ma-overlay-title">{activeMask.title}</h2>
                                    <p className="ma-overlay-text">{activeMask.description}</p>
                                </div>
                            )}

                            <div className="ma-image-frame">
                                <div className="ma-image-date">
                                    {map.date}
                                </div>
                                <div className="ma-image-copyright">
                                    Copyright &copy; 2026 PRISM/NACSE, Oregon State University
                                </div>
                                {map.src && (
                                    <img
                                        src={map.src}
                                        alt={`${activeMask.title} map`}
                                        className="ma-image ma-base-layer"
                                    />
                                )}
                                {!map.src && !map.error && <p role="status">Loading map…</p>}
                                {map.error && <p role="alert">The map is unavailable right now. Please try again later.</p>}
                            </div>
                        </div>

                        <aside className="ma-controls" aria-label="Map overlays">
                            <h2 className="ma-controls-title">Overlays</h2>
                            {MASKS.map((mask) => (
                                <button
                                    key={mask.id}
                                    type="button"
                                    className={`ma-toggle${enabledMasks.includes(mask.id) ? " is-active" : ""}`}
                                    aria-pressed={enabledMasks.includes(mask.id)}
                                    onClick={() => toggleMask(mask.id)}
                                >
                                    {mask.title}
                                </button>
                            ))}
                            <aside className="ma-legend" aria-label="Map Legend">
                                <h2 className="ma-controls-title">Legend</h2>
                                {activeMask?.legend ? (
                                    <Legend legend={activeMask.legend} />
                                ) : (
                                    activeMask &&
                                    (legendFailed === activeMask.variable ? (
                                        <p role="status">Legend unavailable.</p>
                                    ) : (
                                        <img
                                            className="ma-legend-image"
                                            src={`/api/state-legend/?variable=${activeMask.variable}`}
                                            alt={`${activeMask.title} legend`}
                                            onError={() => setLegendFailed(activeMask.variable)}
                                        />
                                    ))
                                )}
                            </aside>
                        </aside>
                    </section>

                    <DecisionDisclaimer
                        variant="footer"
                        context="Regional climate and precipitation overlays support macro-level field planning and do not replace on-site weather monitoring, soil moisture sensors, or human agronomic expertise."
                    />
                </div>
            </main>
        </div>
    );
}

export default MyArea;