import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Field, Problem, inputClass } from '~/shared/ui'
import { useRegister, useSignIn, useVerifyEmail } from './session-hooks'

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

/** The destination of the emailed link. Verifying signs the person in and moves them on. */
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const verify = useVerifyEmail()
  const token = params.get('token')

  const { mutate } = verify
  useEffect(() => {
    if (token) {
      mutate(token, { onSuccess: () => void navigate('/', { replace: true }) })
    }
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
