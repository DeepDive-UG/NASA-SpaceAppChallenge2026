import Navigation, { NAV_ITEMS } from "../../components/Navigation/Navigation";
import { Link } from "react-router-dom";
import { useState } from 'react';
import Alerts from '../Alerts/Alerts'
import './Home.css'
import MascotChat from "../../components/MascotChat";

const Home = () => {
    const [alertsOpen, setAlertsOpen] = useState(false);

    return (
        <div className="home-environment-layout">
            <Navigation />
            <main className="home-environment">
                <section className="home-welcome" aria-labelledby="home-title">
                    <h1 id="home-title">Hey, pal! What’s growing?</h1>
                    <p>Let’s find your next crop.</p>
                </section>
                <nav className="home-cards" aria-label="Explore CropTips">
                    {[
                        ['crop-rotation', 'Plan your next crop', 'Find crops that fit your field.'],
                        ['my-field', 'Know your field', 'Your soil, past crops and water.'],
                        ['knowledge', 'Pick up a tip', 'Simple advice for better growing.'],
                    ].map(([id, title, text]) => {
                        const page = NAV_ITEMS.find(item => item.id === id);
                        return <Link key={id} to={page.path} className={`home-card home-card--${id}`}>
                            <span className="home-card-icon" aria-hidden="true">{page.icon}</span>
                            <h2>{title}</h2><p>{text}</p><span className="home-card-action" aria-hidden="true">Take a look <span>→</span></span>
                        </Link>;
                    })}
                </nav>
                <div className="home-actions">
                    <button type="button" className="home-alert-banner" onClick={() => setAlertsOpen(true)} aria-haspopup="dialog">
                        <span className="home-alert-copy"><strong><span>Water</span> & <span>fire</span> alerts</strong><span>Check reports across California.</span></span>
                        <span className="home-alert-action">View alerts <span aria-hidden="true">→</span></span>
                    </button>
                </div>

            </main>
            {alertsOpen && <Alerts onClose={() => setAlertsOpen(false)} />}
            <MascotChat />
        </div>
    );
}

export default Home;