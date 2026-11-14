import { useEffect, useState } from 'react'
import './Settings.css'

async function accountRequest(path, values) {
  const headers = {}
  if (values) {
    await fetch('/api/health/')
    headers['Content-Type'] = 'application/json'
    headers['X-CSRFToken'] = document.cookie.split('; ').find(part => part.startsWith('csrftoken='))?.split('=')[1] || ''
  }
  const response = await fetch(`/api/account/${path}`, { method: values ? 'POST' : 'GET', headers, ...(values ? { body: JSON.stringify(values) } : {}) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The account service could not be reached. Please try again.')
  const result = await response.json()
  if (!response.ok) {
    const failure = new Error(result.error || 'Please correct the fields below.')
    failure.fields = result.errors || {}
    throw failure
  }
  return result
}

export default function AccountSecurity() {
  const [user, setUser] = useState(null)
  const [passwords, setPasswords] = useState({ old_password: '', new_password1: '', new_password2: '' })
  const [loading, setLoading] = useState(true)
  const [accountError, setAccountError] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let active = true
    accountRequest('').then(result => {
      if (active) setUser(result)
    }).catch(error => { if (active) setAccountError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function changePassword(event) {
    event.preventDefault()
    setBusy('password'); setPasswordStatus(''); setPasswordError(''); setErrors({})
    try {
      const result = await accountRequest('password/', passwords)
      setPasswordStatus(result.message)
      setPasswords({ old_password: '', new_password1: '', new_password2: '' })
      setVisible(false)
    } catch (error) { setPasswordError(error.message); setErrors(error.fields || {}) }
    finally { setBusy('') }
  }

  return <div className="settings-security">
    
    {loading && <p role="status">Loading account…</p>}
    {accountError && <p className="settings-notice" role="status">{accountError}</p>}
    <section className="settings-card" aria-labelledby="password-title">
      <h2 id="password-title">Change password</h2>
      <p>Enter your current password, then choose a new one.</p>
      {user && !user.password_change_available && <p>Password changes are managed by your sign-in provider.</p>}
      <form onSubmit={changePassword}><fieldset disabled={!user?.password_change_available || Boolean(busy)}>
        <input type="text" name="username" value={user?.username || ''} autoComplete="username" readOnly hidden />
        {[['old_password', 'Current password'], ['new_password1', 'New password'], ['new_password2', 'Confirm new password']].map(([key, label]) => <label key={key}>{label}
          <input id={key} type={visible ? 'text' : 'password'} autoComplete={key === 'old_password' ? 'current-password' : 'new-password'} value={passwords[key]} maxLength={1024} required aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : key === 'new_password1' ? 'password-help' : undefined} onChange={event => setPasswords(previous => ({ ...previous, [key]: event.target.value }))} />
          {errors[key] && <span id={`${key}-error`} className="settings-error">{errors[key].join(' ')}</span>}
        </label>)}
        <label className="settings-checkbox"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} /> Show passwords</label>
        <p id="password-help">Use at least 8 characters. Avoid common passwords, numbers only, and passwords similar to your account details.</p>
        <button type="submit">{busy === 'password' ? 'Changing password…' : 'Change password'}</button>
      </fieldset></form>
      {passwordError && <p role="alert" className="settings-error">{passwordError}</p>}
      {passwordStatus && <p role="status">{passwordStatus}</p>}
    </section>
  </div>
}
