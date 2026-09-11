import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Field, Problem, inputClass } from '~/shared/ui'
import {
  useRegister,
  useRequestPasswordReset,
  useResetPassword,
  useSignIn,
  useVerifyEmail,
} from './session-hooks'

export function SignInPage() {
  const navigate = useNavigate()
  const signIn = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <form
      className="mx-auto mt-16 w-full max-w-sm space-y-4"
      onSubmit={(submit) => {
        submit.preventDefault()
        signIn.mutate({ email, password }, { onSuccess: () => void navigate('/') })
      }}
    >
      <h1 className="text-title">Sign in</h1>
      <Problem error={signIn.error} />
      <Field label="Email">
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(change) => setEmail(change.target.value)}
          required
        />
      </Field>
      <Field label="Password">
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(change) => setPassword(change.target.value)}
          required
        />
      </Field>
      <Button pending={signIn.isPending}>Sign in</Button>
      <p className="text-body text-ink-soft">
        No account? <Link className="underline underline-offset-4" to="/register">Create one</Link>
      </p>
      <p className="text-body text-ink-soft">
        <Link className="underline underline-offset-4" to="/forgot-password">
          Forgotten your password?
        </Link>
      </p>
    </form>
  )
}

export function RegisterPage() {
  const register = useRegister()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  // Registering does not sign you in: the email has to be confirmed first, and
  // requirements/004 criterion 4 means an unverified account cannot buy anything.
  if (register.isSuccess) {
    return (
      <div className="mx-auto mt-16 w-full max-w-sm space-y-4">
        <h1 className="text-title">Check your email</h1>
        <p className="text-ink-soft">
          We sent a link to <strong>{email}</strong>. Confirming it finishes your account and
          signs you in.
        </p>
        <p className="text-body text-ink-soft">
          Running locally? The email is in the backend console, and in the
          <code className="mx-1 bg-paper-sunk px-1 font-numeric text-code">email_delivery</code> table.
        </p>
      </div>
    )
  }

  return (
    <form
      className="mx-auto mt-16 w-full max-w-sm space-y-4"
      onSubmit={(submit) => {
        submit.preventDefault()
        register.mutate({ email, password, displayName })
      }}
    >
      <h1 className="text-title">Create an account</h1>
      <Problem error={register.error} />
      <Field label="Name">
        <input
          className={inputClass}
          value={displayName}
          onChange={(change) => setDisplayName(change.target.value)}
          required
        />
      </Field>
      <Field label="Email">
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(change) => setEmail(change.target.value)}
          required
        />
      </Field>
      <Field label="Password">
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(change) => setPassword(change.target.value)}
          required
        />
      </Field>
      <Button pending={register.isPending}>Create account</Button>
      <p className="text-body text-ink-soft">
        Already have one? <Link className="underline underline-offset-4" to="/sign-in">Sign in</Link>
      </p>
    </form>
  )
}

/**
 * The destination of the emailed link. Verifying signs the person in and moves them on.
 *
 * This page acts on arrival, which makes it the one place in the app where a repeated effect is
 * a repeated *side effect*. React invokes effects twice in development, so this sent the same
 * token twice about five milliseconds apart; a verification token may only be spent once, so the
 * second request was always refused, and the refusal is what rendered - both requests share one
 * mutation's state and the loser settles last. Someone who had just clicked a working link was
 * told it "has expired or has already been used", on a page whose header had already switched to
 * the signed-in navigation.
 *
 * `sentFor` makes it one request per token. A ref rather than state because it must not itself
 * cause a render, and keyed by the token rather than a bare boolean so that arriving with a
 * different link still verifies.
 *
 * Worth being clear that the server was not at fault and was not changed for this: it answered
 * one 200 and one 410, and the 410 was true - that token really had just been spent. Nor is this
 * only a development-mode artefact. A double click, a mail client prefetching the link, and a
 * browser retrying all produce two requests in a production build. The page has to send one.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const verify = useVerifyEmail()
  const token = params.get('token')

  const { mutate } = verify
  const sentFor = useRef<string | null>(null)
  useEffect(() => {
    if (!token || sentFor.current === token) return
    sentFor.current = token
    mutate(token, { onSuccess: () => void navigate('/', { replace: true }) })
  }, [token, mutate, navigate])

  return (
    <div className="mx-auto mt-16 w-full max-w-sm space-y-4">
      <h1 className="text-title">Confirming your email</h1>
      {!token && <Problem error={new Error('That link is missing its token.')} />}
      <Problem error={verify.error} />
      {verify.isPending && <p className="text-ink-soft">One moment…</p>}
    </div>
  )
}

/**
 * requirements/001 criterion 17.
 *
 * <p>The success screen says "if that address has an account", and the conditional is load
 * bearing rather than hedging: the server answers the same for an address it has never seen,
 * and a screen reading "we have sent you an email" would report what the endpoint deliberately
 * will not. It is also the honest thing to show somebody who has mistyped their own address,
 * which is the common case and the one worth wording for.
 */
export function ForgotPasswordPage() {
  const request = useRequestPasswordReset()
  const [email, setEmail] = useState('')

  if (request.isSuccess) {
    return (
      <div className="mx-auto mt-16 w-full max-w-sm space-y-4">
        <h1 className="text-title">Check your email</h1>
        <p className="text-ink-soft">
          If <strong>{email}</strong> has an account, a link to set a new password is on its
          way. It expires in an hour and can be used once.
        </p>
        <p className="text-body text-ink-soft">
          Nothing arrived? Check the address for a typo, then{' '}
          <Link className="underline underline-offset-4" to="/sign-in">
            try signing in
          </Link>{' '}
          — asking again sends a new link and stops the old one working.
        </p>
      </div>
    )
  }

  return (
    <form
      className="mx-auto mt-16 w-full max-w-sm space-y-4"
      onSubmit={(submit) => {
        submit.preventDefault()
        request.mutate(email)
      }}
    >
      <h1 className="text-title">Reset your password</h1>
      <p className="text-ink-soft">
        Give us the address on the account and we will send a link to set a new password.
      </p>
      <Problem error={request.error} />
      <Field label="Email">
        <input
          className={inputClass}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(change) => setEmail(change.target.value)}
          required
        />
      </Field>
      <Button pending={request.isPending}>Send the link</Button>
      <p className="text-body text-ink-soft">
        Remembered it?{' '}
        <Link className="underline underline-offset-4" to="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  )
}

/**
 * The destination of the emailed link. Setting the password signs the person in, so this ends
 * in the application rather than back at a form (criterion 19).
 *
 * <p>Unlike VerifyEmailPage this does not act on arrival - there is a password to type first -
 * so a missing token is reported here rather than after a pointless request.
 *
 * <p>The confirmation field is a courtesy the server does not need and a person does: the new
 * password takes effect immediately and every other session has just been revoked, so a typo
 * that nobody catches is a second lockout, arrived at from inside the recovery from the first.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reset = useResetPassword()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const mismatch = confirmation.length > 0 && confirmation !== password

  if (!token) {
    return (
      <div className="mx-auto mt-16 w-full max-w-sm space-y-4">
        <h1 className="text-title">That link is incomplete</h1>
        <p className="text-ink-soft">
          It is missing the part that identifies your account, which usually means it was cut
          short by the email program that displayed it.
        </p>
        <p className="text-body text-ink-soft">
          <Link className="underline underline-offset-4" to="/forgot-password">
            Ask for a new link
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form
      className="mx-auto mt-16 w-full max-w-sm space-y-4"
      onSubmit={(submit) => {
        submit.preventDefault()
        if (mismatch) return
        reset.mutate({ token, password }, { onSuccess: () => void navigate('/', { replace: true }) })
      }}
    >
      <h1 className="text-title">Set a new password</h1>
      <p className="text-ink-soft">
        Everywhere else this account is signed in will be signed out.
      </p>
      <Problem error={reset.error} />
      <Field label="New password">
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(change) => setPassword(change.target.value)}
          required
        />
      </Field>
      <Field label="New password again" problem={mismatch ? 'These two do not match.' : undefined}>
        <input
          className={inputClass}
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(change) => setConfirmation(change.target.value)}
          required
        />
      </Field>
      <Button pending={reset.isPending}>Set the password</Button>
      <p className="text-body text-ink-soft">
        Link expired?{' '}
        <Link className="underline underline-offset-4" to="/forgot-password">
          Ask for a new one
        </Link>
      </p>
    </form>
  )
}
