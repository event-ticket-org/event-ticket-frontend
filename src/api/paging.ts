/**
 * Keyset pagination, which every paged response in this contract uses.
 *
 * `null` and absent both mean there are no further pages, and only a string continues.
 * Worth a shared function rather than a line repeated per feature: TanStack Query treats
 * *any* value that is not `undefined` as another page, so returning the body's `null`
 * straight through asks for the same page for ever - and the backend really does answer
 * `"nextCursor": null` on the last one.
 */
export type Paged = { nextCursor?: string | null }

export function nextPageParam(page: Paged): string | undefined {
  return page.nextCursor ?? undefined
}

/** `?limit=&cursor=`, with the cursor omitted on the first page rather than sent empty. */
export function pageQuery(cursor: string | undefined, limit = 20): string {
  return `limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
}
