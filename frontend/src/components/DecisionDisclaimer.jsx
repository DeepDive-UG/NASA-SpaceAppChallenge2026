import './DecisionDisclaimer.css';

export default function DecisionDisclaimer({
  variant = 'card',
  context,
  className = '',
}) {
  return (
    <aside
      className={`decision-disclaimer decision-disclaimer--${variant} ${className}`.trim()}
      role="note"
      aria-label="Decision-support disclaimer"
    >
      <span className="decision-disclaimer__badge" aria-hidden="true">
        i
      </span>
      <div className="decision-disclaimer__body">
        <strong>Remember: this is a decision-support tool, it does not replace human expertise.</strong>
        <p>
          {context ||
            'Insights, estimates, and suggestions are meant to support farm planning. Always verify conditions on-site and consult a qualified agronomist, soil specialist, or local extension advisor before making operational decisions.'}
        </p>
      </div>
    </aside>
  );
}
