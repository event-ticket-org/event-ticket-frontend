import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMe } from '~/features/auth/session-hooks'
import { Button, Field, Problem, inputClass } from '~/shared/ui'
import { useCreateOrganization } from './organization-hooks'

export function CreateOrganizationPage() {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const create = useCreateOrganization()
  const [name, setName] = useState('')

  // requirements/001: the server refuses this outright, so saying it here saves a round trip
  // and, more usefully, says what to do about it.
  if (me && !me.emailVerified) {
    return (
      <div className="mx-auto max-w-[640px] space-y-4">
        <h1 className="text-title">Confirm your email first</h1>
        <p className="text-body">
          We sent a link to <strong className="text-body-strong">{me.email}</strong>. An
          organization cannot be created until that address is confirmed.
        </p>
      </div>
    )
  }

  return (
    <form
      className="mx-auto max-w-[640px] space-y-6"
      onSubmit={(submit) => {
        submit.preventDefault()
        create.mutate({ name }, { onSuccess: () => void navigate('/manage') })
      }}
    >
      <h1 className="text-title">Create an organization</h1>
      <p className="max-w-[68ch] text-body text-ink-soft">
        You will be its Owner. A new organization is reviewed before it can sell tickets, and
        you will be emailed when that is decided — everything else can be set up meanwhile.
      </p>
      <Problem error={create.error} />
      <Field label="Organization name" hint="The name buyers will see on your events.">
        <input
          className={inputClass}
          value={name}
          onChange={(change) => setName(change.target.value)}
          maxLength={200}
          required
          autoFocus
        />
      </Field>
      <Button pending={create.isPending} disabled={name.trim().length === 0}>
        Create organization
      </Button>
    </form>
  )
}
