import Navigation from "../../components/Navigation/Navigation";
import DecisionDisclaimer from "../../components/DecisionDisclaimer";
import { useState } from 'react';
import Alerts from '../Alerts/Alerts'
import './Home.css'

const Home = () => {
    const [alertsOpen, setAlertsOpen] = useState(false);
    return (
        <div className="home-environment-layout">
            <Navigation />
            <main className="home-environment">
                {/* <img src="/Scene1.gif" className="mascot" alt="CropTips mascot" />
                 */}
                <img src="/api/state-map/?state=TX&lat=30.27&lon=-97.74&label=Austin" />
                <div className="home-actions">
                    <button onClick={() => setAlertsOpen(true)}>Water & fire alerts</button>
                </div>
                <DecisionDisclaimer
                    variant="compact"
                    context="CropTips provides data-driven decision support and does not replace human agronomic expertise or official emergency guidance."
                />
            </main>
            {alertsOpen && <Alerts onClose={() => setAlertsOpen(false)} />}
        </div>
    );
}

export default Home;
