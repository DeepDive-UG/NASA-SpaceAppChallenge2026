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
                                        : `Review the article: ${question.options[question.answer]}`}
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
