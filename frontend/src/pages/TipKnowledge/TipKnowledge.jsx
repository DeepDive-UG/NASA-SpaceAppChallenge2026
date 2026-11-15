import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Navigation from "../../components/Navigation/Navigation";
import DecisionDisclaimer from "../../components/DecisionDisclaimer";
import CompostingArticle from "./articles/composting/CompostingArticle";
import WateringArticle from "./articles/watering/WateringArticle";
import NitrogenFixingArticle from "./articles/nitrogen-fixing/NitrogenFixingArticle";
import CoverCropsArticle from "./articles/cover-crops/CoverCropsArticle";
import DeepRootingArticle from "./articles/deep-rooting/DeepRootingArticle";
import DroughtTolerantArticle from "./articles/drought-tolerant/DroughtTolerantArticle";
import TipQuiz from "./TipQuiz";
import "./TipKnowledge.css";
import MascotChat from "../../components/MascotChat";

const BUILT_IN_ARTICLES = [
    {
        id: "composting",
        title: "Start a simple compost pile",
        category: "Soil health",
        component: CompostingArticle,
    },
    {
        id: "watering",
        title: "Water plants more efficiently",
        category: "Water management",
        component: WateringArticle,
    },
    {
        id: "nitrogen-fixing",
        title: "Nitrogen-fixing crops feed the soil",
        category: "Soil fertility",
        component: NitrogenFixingArticle,
    },
    {
        id: "cover-crops",
        title: "Cover crops protect and build soil",
        category: "Soil cover",
        component: CoverCropsArticle,
    },
    {
        id: "deep-rooting",
        title: "Deep roots improve soil structure",
        category: "Soil structure",
        component: DeepRootingArticle,
    },
    {
        id: "drought-tolerant",
        title: "Drought-tolerant crops support resilience",
        category: "Drought resilience",
        component: DroughtTolerantArticle,
    },
];

export default function TipKnowledge() {
    const location = useLocation();
    const [selectedId, setSelectedId] = useState(null);

    const groups = useMemo(() => {
        return BUILT_IN_ARTICLES.reduce((result, article) => {
            const group = result.find((item) => item.category === article.category);
            if (group) {
                group.articles.push(article);
            } else {
                result.push({ category: article.category, articles: [article] });
            }
            return result;
        }, []);
    }, []);

    const selectedBuiltIn = BUILT_IN_ARTICLES.find(
        (article) => article.id === selectedId
    );
    const SelectedArticle = selectedBuiltIn?.component;

    if (location.hash === "#quiz") return <TipQuiz />;

    return (
        <div className="tk-layout">
            <Navigation />

            <main className="tk-main">
                <header className="tk-header">
                    <div>
                        <p className="tk-eyebrow">YOUR GROWING LIBRARY</p>
                        <h1 className="tk-title">TipKnowledge</h1>
                        <p className="tk-subtitle">
                            Keep useful growing notes together, one short article at a time.
                        </p>
                    </div>
                    <Link className="tk-new-button" to="/knowledge#quiz">
                        Take the quiz
                    </Link>
                </header>

                <div className="tk-content">
                    <aside className="tk-map" aria-label="Article map">
                        <div className="tk-map-heading">
                            <span className="tk-section-label">LIBRARY MAP</span>
                            <span className="tk-map-count">
                                {BUILT_IN_ARTICLES.length} articles
                            </span>
                        </div>
                        {groups.map((group) => (
                            <section className="tk-map-group" key={group.category}>
                                <h2>{group.category}</h2>
                                <ul>
                                    {group.articles.map((article) => (
                                        <li key={article.id}>
                                            <button
                                                className={`tk-map-link${selectedId === article.id ? " is-selected" : ""}`}
                                                type="button"
                                                onClick={() => setSelectedId(article.id)}
                                            >
                                                <span className="tk-map-dot" aria-hidden="true" />
                                                <span>{article.title}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </aside>

                    <section className="tk-article-panel" aria-live="polite">
                        {selectedBuiltIn ? (
                            <article>
                                <div className="tk-article-meta">
                                    <span>{selectedBuiltIn.category}</span>
                                    <span>FIELD NOTE</span>
                                </div>
                                <h2>{selectedBuiltIn.title}</h2>
                                <SelectedArticle />
                            </article>
                        ) : (
                            <div className="tk-empty-state">
                                <span className="tk-book-icon" aria-hidden="true">
                                    ✳
                                </span>
                                <h2>Choose an article from the map to read, or <a href="#quiz">take a quick quiz</a> to check what you have learned.</h2>
                            </div>
                        )}
                    </section>
                </div>

                <DecisionDisclaimer
                    variant="footer"
                    className="tk-disclaimer"
                    context="These tips are general. What works on one farm may not work on yours. Ask a local farming adviser when unsure."
                />
            </main>
            <MascotChat />
        </div>
    );
}
