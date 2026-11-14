import Navigation from "../../components/Navigation/Navigation";
import { useState } from 'react';
import Alerts from '../Alerts';

const Home = () => {
    const [alertsOpen, setAlertsOpen] = useState(false);
    return (
        <div className="home-environment-layout">
            <Navigation />
            <main className="home-environment">
                <button onClick={() => setAlertsOpen(true)}>Water & fire alerts</button>
            </main>
            {alertsOpen && <Alerts onClose={() => setAlertsOpen(false)} />}
        </div>
    );
}

export default Home;
