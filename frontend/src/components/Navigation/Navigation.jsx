import { Link, NavLink } from "react-router-dom";
import { useState } from 'react';
import "./Navigation.css";

const Icon = ({ children }) => (
    <svg
        className="sb-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        {children}
    </svg>
);

export const NAV_ITEMS = [
    {
        id: "home",
        path: "/",
        label: "Home",
        icon: (
            <Icon>
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9.5V20h14V9.5" />
                <path d="M10 20v-6h4v6" />
            </Icon>
        ),
    },
    {
        id: "crop-rotation",
        path: "/crop-rotation",
        label: "Crop rotation",
        icon: (
            <Icon>
                <path d="M20 12a8 8 0 0 1-13.7 5.6" />
                <path d="M4 12A8 8 0 0 1 17.7 6.4" />
                <path d="M18 3v4h-4" />
                <path d="M6 21v-4h4" />
            </Icon>
        ),
    },
    {
        id: "my-field",
        path: "/myField",
        label: "My field",
        icon: (
            <Icon>
                <path d="M3 8 12 4l9 4-9 4-9-4Z" />
                <path d="m3 12 9 4 9-4" />
                <path d="m3 16 9 4 9-4" />
            </Icon>
        ),
    },
    {
        id: "my-gear",
        path: "/myGear",
        label: "My gear",
        icon: (
            <Icon>
                <path d="M3 17h3m5 0h6" />
                <circle cx="8.5" cy="17" r="2.5" />
                <circle cx="19" cy="17" r="2" />
                <path d="M6 17V9h6l3 4h3v4" />
                <path d="M9 9V6h3" />
            </Icon>
        ),
    },
    {
        id: "my-area",
        path: "/myArea",
        label: "My area",
        icon: (
            <Icon>
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
            </Icon>
        ),
    },
    {
        id: "knowledge",
        path: "/knowledge",
        label: "Knowledge",
        icon: (
            <Icon>
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v14H5.5A1.5 1.5 0 0 0 4 19.5v-14Z" />
                <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3" />
                <path d="M9 9h7" />
            </Icon>
        ),
    },
    {
        id: "faq",
        path: "/faq",
        label: "FAQ",
        icon: (
            <Icon>
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 1.5-2.5 3.5" />
                <path d="M12 16h.01" />
            </Icon>
        ),
    },
    {
        id: "settings",
        path: "/settings",
        label: "Settings",
        icon: (
            <Icon>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </Icon>
        ),
    },
];

export default function Navigation({ items = NAV_ITEMS }) {
    const [signingOut, setSigningOut] = useState(false);
    const [signOutError, setSignOutError] = useState('');

    async function signOut() {
        setSigningOut(true);
        setSignOutError('');
        try {
            await fetch('/api/health/');
            const token = document.cookie.split('; ').find(part => part.startsWith('csrftoken='))?.split('=')[1] || '';
            const response = await fetch('/api/account/logout/', {
                method: 'POST', headers: { 'X-CSRFToken': token },
            });
            if (!response.ok) throw new Error('Could not sign out. Please try again.');
            window.location.assign('/');
        } catch {
            setSignOutError('Could not sign out. Please try again.');
            setSigningOut(false);
        }
    }
    return (
        <aside className="sb" aria-label="Main navigation">
            <Link to="/" className="sb-brand" aria-label="CropTips — Go to Home">
                <img className="sb-logo-img" src="/logo.png" alt="" />
                <span className="sb-brand-name">CropTips</span>
            </Link>

            <nav>
                <ul className="sb-list">
                    {items.map((item) => (
                        <li key={item.id}>
                            <NavLink
                                to={item.path}
                                end={item.path === "/"}
                                className={({ isActive }) => `sb-item${isActive ? " is-active" : ""}`}
                            >
                                {item.icon}
                                <span className="sb-label">{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="sb-session">
                <button className="sb-item sb-signout" type="button" onClick={signOut} disabled={signingOut} aria-label={signingOut ? 'Signing out' : 'Sign out'} title="Sign out">
                    <Icon><path d="M9 4H4v16h5M14 8l4 4-4 4M8 12h10" /></Icon>
                    <span className="sb-label">{signingOut ? 'Signing out…' : 'Sign out'}</span>
                </button>
                {signOutError && <p role="alert" className="sb-session-error">{signOutError}</p>}
            </div>
        </aside>
    );
}
