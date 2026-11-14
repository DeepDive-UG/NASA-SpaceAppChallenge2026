import { useState } from "react";
import Navigation from "../../components/Navigation/Navigation";
import overlayBase from "../../assets/myArea/1x/base.png";
import overlayPPT from "../../assets/myArea/1x/ppt.png";
import overlaytmax from "../../assets/myArea/1x/tmax.png";
import overlaytmean_anom from "../../assets/myArea/1x/tmean_anom.png";
import overlaytmin from "../../assets/myArea/1x/tmin.png";
import "./myArea.css";

const MASKS = [
    { id: 1, title: "Total Precipitation", image: overlayPPT },
    { id: 2, title: "Temperature Max", image: overlaytmax },
    { id: 3, title: "Temperature Anomaly", image: overlaytmean_anom },
    { id: 4, title: "Temperature Minimum", image: overlaytmin },
];

const MyArea = () => {
    const [enabledMasks, setEnabledMasks] = useState([]);

    const toggleMask = (maskId) => {
        setEnabledMasks((currentMasks) =>
            currentMasks.includes(maskId)
                ? currentMasks.filter((id) => id !== maskId)
                : [...currentMasks, maskId]
        );
    };
    
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
                                <label className="ma-toggle" key={mask.id}>
                                    <input
                                        type="checkbox"
                                        checked={enabledMasks.includes(mask.id)}
                                        onChange={() => toggleMask(mask.id)}
                                    />
                                    <span>{mask.title}</span>
                                </label>
                            ))}
                        </aside>
                    </section>
                </div>
            </main>
        </div>
    );
}

export default MyArea;