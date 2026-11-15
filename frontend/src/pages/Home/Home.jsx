import Navigation, { NAV_ITEMS } from "../../components/Navigation/Navigation";
import { Link } from "react-router-dom";
import { useState } from 'react';
import Alerts from '../Alerts/Alerts'
import './Home.css'
import MascotChat from "../../components/MascotChat";

const Arrow = () => (
    <svg className="home-arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const DropIcon = () => (
    <svg className="home-alert-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3.5c3.2 3.8 5.5 6.8 5.5 9.7a5.5 5.5 0 0 1-11 0C6.5 10.3 8.8 7.3 12 3.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
);

const FlameIcon = () => (
    <svg className="home-alert-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3c.6 3.2-3.5 5.2-3.5 9.2a3.5 3.5 0 0 0 7 0c0-1.7-.8-2.9-1.6-3.7-.2 1.3-.9 2-1.8 2.3.9-2.6.4-5.3-.1-7.8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
);

const Home = () => {
    const [alertsOpen, setAlertsOpen] = useState(false);

    return (
        <div className="home-environment-layout">
            <Navigation />
            <main className="home-environment">
                <section className="home-welcome" aria-labelledby="home-title">
                    <h1 id="home-title">Hey, pal! What’s <span className="home-accent">growing</span>?</h1>
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
                            <h2>{title}</h2><p>{text}</p>
                            <span className="home-card-action" aria-hidden="true">Take a look <Arrow /></span>
                        </Link>;
                    })}
                </nav>
                <div className="home-actions">
                    <button type="button" className="home-alert-banner" onClick={() => setAlertsOpen(true)} aria-haspopup="dialog">
                        <span className="home-alert-copy">
                            <strong>
                                <span className="home-alert-water"><DropIcon />Water</span>
                                <span aria-hidden="true">&amp;</span>
                                <span className="home-alert-fire"><FlameIcon />fire</span>
                                <span>alerts</span>
                            </strong>
                            <span>Check reports across California.</span>
                        </span>
                        <span className="home-alert-action">View alerts <Arrow /></span>
                    </button>
                </div>
            </main>
            {alertsOpen && <Alerts onClose={() => setAlertsOpen(false)} />}
            <MascotChat />
        </div>
    );
}

export default Home;