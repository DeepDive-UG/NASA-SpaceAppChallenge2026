import { useId, useRef, useState } from 'react';
import './login.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_STORAGE_KEY = 'authToken';

function validateEmail(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Email is required.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address.';
  return '';
}

function validatePassword(value) {
  if (!value) return 'Password is required.';
  return '';
}

function persistToken(token, rememberMe) {
  try {
    const target = rememberMe ? window.localStorage : window.sessionStorage;
    const other = rememberMe ? window.sessionStorage : window.localStorage;
    other.removeItem(TOKEN_STORAGE_KEY);
    target.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
  }
}

function getServerErrorMessage(status, data) {
  if (status === 400 || status === 401 || status === 403) {
    return 'Incorrect email or password. Please try again.';
  }
  if (status === 429) {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  if (data && typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }
  return 'Something went wrong on our end. Please try again.';
}

export default function Login({
  onLogin,
  onDemoLogin,
  apiUrl = '/api/auth/login',
  forgotPasswordHref = '/forgot-password',
  signUpHref = '/signup',
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const id = useId();
  const emailId = `${id}-email`;
  const emailErrorId = `${id}-email-error`;
  const passwordId = `${id}-password`;
  const passwordErrorId = `${id}-password-error`;
  const capsLockId = `${id}-caps-lock`;
  const rememberId = `${id}-remember`;

  // ---------- Field handlers ----------

  const handleEmailChange = (event) => {
    const { value } = event.target;
    setEmail(value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: validateEmail(value) }));
    }
    if (serverError) setServerError('');
  };

  const handleEmailBlur = () => {
    if (email) {
      setErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    }
  };

  const handlePasswordChange = (event) => {
    const { value } = event.target;
    setPassword(value);
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: validatePassword(value) }));
    }
    if (serverError) setServerError('');
  };

  const handlePasswordKeyEvent = (event) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
    passwordRef.current?.focus();
  };

  // ---------- Submit ----------

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLoading) return;

    setServerError('');

    const nextErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(nextErrors);

    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe,
        }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setServerError(getServerErrorMessage(response.status, data));
        return;
      }

      if (!data || typeof data.token !== 'string' || !data.token) {
        setServerError('We received an unexpected response. Please try again.');
        return;
      }

      persistToken(data.token, rememberMe);
      setPassword('');
      onLogin?.(data);
    } catch {
      setServerError(
        "We couldn't connect to the server. Check your internet connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    if (isLoading) return;
    setServerError('');
    setErrors({ email: '', password: '' });
    onDemoLogin?.();
  };

  // ---------- Render ----------

  const passwordDescribedBy =
    [errors.password && passwordErrorId, capsLockOn && capsLockId]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-card__body">
          <header className="login-header">
            <h1 className="login-title">Sign in</h1>
            <p className="login-subtitle">Enter your credentials to access your account</p>
          </header>

          <form className="login-form" onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
            {serverError && (
              <div className="login-alert" role="alert">
                <span className="login-alert__icon" aria-hidden="true">!</span>
                <p className="login-alert__text">{serverError}</p>
              </div>
            )}

            {/* Email */}
            <div className="form-field">
              <label className="form-label" htmlFor={emailId}>
                Email
              </label>
              <input
                ref={emailRef}
                id={emailId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@example.com"
                className={`form-input${errors.email ? ' form-input--invalid' : ''}`}
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                disabled={isLoading}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? emailErrorId : undefined}
                required
              />
              {errors.email && (
                <p id={emailErrorId} className="field-error">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="form-field">
              <div className="form-label-row">
                <label className="form-label" htmlFor={passwordId}>
                  Password
                </label>
                <a className="login-link login-link--small" href={forgotPasswordHref}>
                  Forgot password?
                </a>
              </div>
              <div className="password-wrapper">
                <input
                  ref={passwordRef}
                  id={passwordId}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`form-input${errors.password ? ' form-input--invalid' : ''}`}
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={handlePasswordKeyEvent}
                  onKeyUp={handlePasswordKeyEvent}
                  onBlur={() => setCapsLockOn(false)}
                  disabled={isLoading}
                  aria-invalid={errors.password ? 'true' : 'false'}
                  aria-describedby={passwordDescribedBy}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading}
                  aria-controls={passwordId}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && (
                <p id={passwordErrorId} className="field-error">
                  {errors.password}
                </p>
              )}
              {capsLockOn && (
                <p id={capsLockId} className="field-warning" role="status">
                  Caps Lock is on.
                </p>
              )}
            </div>

            {/* Remember me */}
            <label
              htmlFor={rememberId}
              className={`checkbox-field${isLoading ? ' checkbox-field--disabled' : ''}`}
            >
              <input
                id={rememberId}
                name="rememberMe"
                type="checkbox"
                className="checkbox-field__input"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                disabled={isLoading}
              />
              <span>Remember me</span>
            </label>

            {/* Primary submit */}
            <button type="submit" className="btn btn--primary" disabled={isLoading}>
              {isLoading && <span className="btn__spinner" aria-hidden="true" />}
              <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
            </button>

            <div className="login-divider" role="separator" aria-hidden="true">
              or
            </div>

            {/* Secondary demo */}
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleDemoLogin}
              disabled={isLoading}
            >
              Continue as Guest (Demo)
            </button>
          </form>
        </div>

        <footer className="login-card__footer">
          <p className="login-footer-text">
            Don&apos;t have an account?{' '}
            <a className="login-link" href={signUpHref}>
              Sign up
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}