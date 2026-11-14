import { useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "../../components/Navigation/Navigation";

const QUESTIONS = [
    {
        id: "compost-materials",
        prompt: "What combination is a good starting point for a compost pile?",
        options: [
            "Dry leaves and fresh fruit or vegetable scraps",
            "Only fresh grass clippings",
            "Plastic packaging and garden soil",
        ],
        answer: 0,
        articleTitle: "Start a simple compost pile",
    },
    {
        id: "compost-moisture",
        prompt: "How damp should a compost pile be?",
        options: [
            "Completely dry",
            "Like a wrung-out sponge",
            "Saturated with standing water",
        ],
        answer: 1,
        articleTitle: "Start a simple compost pile",
    },
    {
        id: "watering-target",
        prompt: "Where should you aim water for more efficient watering?",
        options: [
            "Across the leaves in the afternoon",
            "On the soil near the plant roots",
            "On the path around the garden",
        ],
        answer: 1,
        articleTitle: "Water plants more efficiently",
    },
    {
        id: "mulch",
        prompt: "How can mulch help a garden?",
        options: [
            "It helps soil hold moisture",
            "It replaces the need to check soil moisture",
            "It makes plants need more frequent watering",
        ],
        answer: 0,
        articleTitle: "Water plants more efficiently",
    },
    {
        id: "nitrogen-fixation",
        prompt: "How do legumes such as beans add nitrogen to a crop system?",
        options: [
            "Root-nodule bacteria convert atmospheric nitrogen into forms plants can use",
            "Their leaves absorb fertilizer directly from the air",
            "They prevent all nitrogen from leaving the soil",
        ],
        answer: 0,
        articleTitle: "Nitrogen-fixing crops feed the soil",
    },
    {
        id: "cover-crop-benefit",
        prompt: "What is one way a cover crop can protect soil between harvests?",
        options: [
            "Its leaves and roots help shield and hold soil in place",
            "It removes the need to manage crop residues",
            "It stops all water from entering the soil",
        ],
        answer: 0,
        articleTitle: "Cover crops protect and build soil",
    },
    {
        id: "deep-roots",
        prompt: "What can be left behind as deep-rooted crops grow and die back?",
        options: [
            "Root channels that may improve paths for water and air",
            "A guarantee that any compacted soil is fully repaired",
            "A permanent barrier that prevents other roots from growing",
        ],
        answer: 0,
        articleTitle: "Deep roots improve soil structure",
    },
    {
        id: "drought-tolerance",
        prompt: "How can drought-tolerant crops support soil health over time?",
        options: [
            "By maintaining roots and returning residues that cover and feed soil",
            "By creating water in dry soil",
            "By adding fertility even when all crop residues are removed",
        ],
        answer: 0,
        articleTitle: "Drought-tolerant crops support resilience",
    },
];

export default function TipQuiz() {
    const [answers, setAnswers] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const score = QUESTIONS.filter(
        (question) => answers[question.id] === question.answer
    ).length;

    function submitQuiz(event) {
        event.preventDefault();
        if (Object.keys(answers).length === QUESTIONS.length) {
            setSubmitted(true);
        }
    }

    function retryQuiz() {
        setAnswers({});
        setSubmitted(false);
    }

    return (
        <div className="tk-layout">
            <Navigation />
            <main className="tk-main">
                <header className="tk-header tk-quiz-header">
                    <div>
                        <Link className="tk-back-link" to="/knowledge">
                            ← Back to TipKnowledge
                        </Link>
                        <p className="tk-eyebrow">KNOWLEDGE CHECK</p>
                        <h1 className="tk-title">TipQuiz</h1>
                        <p className="tk-subtitle">
                            A short quiz based on the articles in your growing library.
                        </p>
                    </div>
                    <span className="tk-quiz-count">{QUESTIONS.length} questions</span>
                </header>

                <form className="tk-quiz-card" onSubmit={submitQuiz}>
                    {QUESTIONS.map((question, index) => (
                        <fieldset
                            className="tk-question"
                            key={question.id}
                            disabled={submitted}
                        >
                            <legend>
                                <span className="tk-question-number">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                {question.prompt}
                            </legend>
                            <div className="tk-options">
                                {question.options.map((option, optionIndex) => {
                                    const isCorrect = optionIndex === question.answer;
                                    const isChosen = answers[question.id] === optionIndex;
                                    const resultClass = submitted
                                        ? isCorrect
                                            ? " is-correct"
                                            : isChosen
                                                ? " is-incorrect"
                                                : ""
                                        : "";

                                    return (
                                        <label
                                            className={`tk-quiz-option${resultClass}`}
                                            key={option}
                                        >
                                            <input
                                                type="radio"
                                                name={question.id}
                                                value={optionIndex}
                                                checked={isChosen}
                                                onChange={() =>
                                                    setAnswers((current) => ({
                                                        ...current,
                                                        [question.id]: optionIndex,
                                                    }))
                                                }
                                            />
                                            <span>{option}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {submitted && (
                                <p
                                    className={`tk-answer-note${answers[question.id] === question.answer ? " is-correct" : " is-incorrect"}`}
                                >
                                    {answers[question.id] === question.answer
                                        ? "Correct"
                                        : `Review the article: ${question.articleTitle}`}
                                </p>
                            )}
                        </fieldset>
                    ))}

                    {submitted ? (
                        <div className="tk-quiz-result" role="status">
                            <div>
                                <span className="tk-section-label">QUIZ COMPLETE</span>
                                <p>
                                    You got <strong>{score} of {QUESTIONS.length}</strong> correct.
                                </p>
                            </div>
                            <button
                                className="tk-new-button"
                                type="button"
                                onClick={retryQuiz}
                            >
                                Try again
                            </button>
                        </div>
                    ) : (
                        <div className="tk-quiz-actions">
                            <span className="tk-answered-count">
                                {Object.keys(answers).length} of {QUESTIONS.length} answered
                            </span>
                            <button
                                className="tk-new-button"
                                type="submit"
                                disabled={Object.keys(answers).length !== QUESTIONS.length}
                            >
                                Check answers
                            </button>
                        </div>
                    )}
                </form>
            </main>
        </div>
    );
}
