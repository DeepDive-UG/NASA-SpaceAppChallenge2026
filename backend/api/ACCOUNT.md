# Account settings

The `/settings` page uses Django session authentication. Sign out is a separate action at the bottom of the sidebar, not a settings section. The login/onboarding owner must establish a Django session; the account page does not create users or introduce a separate login flow. Unauthenticated users see disabled forms and a sign-in notice.

- `GET /api/account/`: username and whether a usable local password exists. Names and email are not returned.
- `POST /api/account/password/`: accepts `old_password`, `new_password1`, `new_password2`. Uses Django PasswordChangeForm and configured password validators. Validation messages are returned in English. Passwords are never stored in browser storage or included in responses.
- `POST /api/account/logout/`: ends the current browser session.

All writes retain Django CSRF protection. Password changes preserve the current browser session with `update_session_auth_hash`; other Django sessions are invalidated when subsequently used. Federated accounts without a local password cannot change a password here. Password reset by email and email-address verification are not implemented.

The current checkout did not contain an accessibility settings page. Account sections are separate frontend sections that can be composed with that work when it arrives.

Reference: https://docs.djangoproject.com/en/5.2/topics/auth/default/

The settings interface does not collect or edit personal names. No profile-write endpoint is exposed. Existing Django auth model fields are not migrated or purged by this UI change.
