import './DecisionDisclaimer.css';

const DEFAULT_TITLE = 'A guide, not a guarantee.';

// variant: 'card' | 'compact' | 'footer' | 'mini'
// Pass a falsy title to hide the heading.
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
            'Use these suggestions to plan. Check your field and ask a local farming adviser before making big decisions.'}
        </p>
      </div>
    </aside>
  );
}