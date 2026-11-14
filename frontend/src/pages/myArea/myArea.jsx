import { useState } from "react";
import Navigation from "../../components/Navigation/Navigation";
import overlayBase from "../../assets/myArea/1x/base.png";
import overlayPPT from "../../assets/myArea/1x/ppt.png";
import overlaytmax from "../../assets/myArea/1x/tmax.png";
import overlaytmean_anom from "../../assets/myArea/1x/tmean_anom.png";
import overlaytmin from "../../assets/myArea/1x/tmin.png";
import "./myArea.css";
import { LEGENDS } from "./LEGENDS";

const MASKS = [
    { id: 1, title: "Total Precipitation", image: overlayPPT, legend: LEGENDS.ppt },
    { id: 2, title: "Temperature Max", image: overlaytmax, legend: LEGENDS.tmax },
    { id: 3, title: "Temperature Anomaly", image: overlaytmean_anom, legend: LEGENDS.tmean_anom },
    { id: 4, title: "Temperature Minimum", image: overlaytmin, legend: LEGENDS.tmin },
];

const Legend = ({ legend }) => {
    const { colors, edges, unit } = legend;
    const n = colors.length;
    const stops = colors
        .map((c, i) => `${c} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
        .join(", ");
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
};

const MyArea = () => {
    const [enabledMasks, setEnabledMasks] = useState([MASKS[0].id]);
    const activeMask = MASKS.find((mask) => enabledMasks.includes(mask.id));
    const toggleMask = (maskId) => setEnabledMasks([maskId]);
    
    /*TODO for ma-image-legend: add a legend that updates to show the relevant overlays, show said legends as gradients for readability
    PLAN: also show information in numbers when hovering over with mouse?*/
    return (
        <div className="ma-layout">
            <Navigation />
            <main className="ma-main">
                <div className="ma-content">
                    <h1 className="ma-title">My area</h1>

                    <section className="ma-viewer" aria-label="Map gallery">
                        <div className="ma-image-frame">
                            <img
                                src={overlayBase}
                                alt="Base map"
                                className="ma-image ma-base-layer"
                            />
                            {MASKS.map((mask) =>
                                enabledMasks.includes(mask.id) ? (
                                    <img
                                        key={mask.id}
                                        src={mask.image}
                                        alt={`${mask.title} mask overlay`}
                                        className="ma-image ma-mask-layer"
                                    />
                                ) : null
                            )}
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
                            {activeMask && <Legend legend={activeMask.legend} />}
                        </aside>
                        </aside>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default MyArea;