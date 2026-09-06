import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { ReadableError } from '~/api/errors'
import type { CoverUpload, Event } from '~/api/types'

/**
 * Uploading a cover, which is three steps and one intention (ADR-0006).
 *
 * The file does not pass through our API at all: the server signs a form, the browser posts
 * the image straight to the store, and the server is then asked to adopt what landed. Kept as
 * one mutation because a caller who could do two of the three has done nothing useful - an
 * uploaded file nobody adopted is an orphan the store expires, not a cover.
 */

export function useSetCover(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, alt }: { file: File; alt?: string }) => {
      const upload = await api.post<CoverUpload>(`/events/${eventId}/cover-uploads`, undefined)

      // Refused here rather than sent and refused there. The ceiling is the store's to
      // enforce - it is signed into the form - but a file we already know is too large is a
      // minute of somebody's upload spent to be told so.
      if (upload.maxBytes !== undefined && file.size > upload.maxBytes) {
        throw new ReadableError(
          `That image is ${megabytes(file.size)} MB. The most a cover can be is ` +
            `${megabytes(upload.maxBytes)} MB.`,
        )
      }

      await postDirectly(upload, file)
      return api.put<Event>(`/events/${eventId}/cover`, {
        uploadId: upload.uploadId,
        alt: alt?.trim() ? alt.trim() : null,
      })
    },
    // Everything: a cover shows on the event's own page, in the manager's list and in the
    // public listing, and naming them one at a time is how one of them gets forgotten.
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

export function useRemoveCover(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<void>(`/events/${eventId}/cover`),
    onSuccess: () => queryClient.invalidateQueries(),
  })
}

/**
 * The upload itself, which deliberately does not go through `api.ts`.
 *
 * A different origin, no bearer token, and a body that is a multipart form rather than JSON -
 * every reason that client exists is a reason not to use it here. Sending our access token to
 * a storage host would be handing a credential to a service that has no business holding one.
 *
 * The signed fields go in first and the file goes last, because S3 reads form fields in order
 * and stops at the file; a form built the other way round is refused for reasons that sound
 * like nothing in particular.
 */
async function postDirectly(upload: CoverUpload, file: File): Promise<void> {
  const form = new FormData()
  for (const [name, value] of Object.entries(upload.fields)) {
    form.append(name, value)
  }
  form.append(upload.fileField, file)

  const response = await fetch(upload.url, { method: 'POST', body: form })
  if (!response.ok) {
    // The store answers in XML, which is not something to put in front of a person. The
    // status is what distinguishes "too large" from "this form has expired", and both are
    // things somebody can act on.
    throw new ReadableError(
      response.status === 400
        ? 'The store would not take that file. It may be too large, or the upload may have ' +
          'expired — try again.'
        : `The image could not be uploaded (${response.status}). Try again.`,
    )
  }
}

const megabytes = (bytes: number) => (bytes / 1_048_576).toFixed(1)
