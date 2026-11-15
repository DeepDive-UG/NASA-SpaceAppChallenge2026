import './DecisionDisclaimer.css';

const DEFAULT_TITLE = 'Remember: this is a decision-support tool, it does not replace human expertise.';

// variant: 'card' | 'compact' | 'footer' | 'mini'
// title: domyślnie standardowy nagłówek; przekaż null/false, żeby go ukryć.
export default function DecisionDisclaimer({
  variant = 'card',
  context,
  title = DEFAULT_TITLE,
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
        {title && <strong>{title}</strong>}
        <p>
          {context ||
            'Insights, estimates, and suggestions are meant to support farm planning. Always verify conditions on-site and consult a qualified agronomist, soil specialist, or local extension advisor before making operational decisions.'}
        </p>
      </div>
    </aside>
  );
}