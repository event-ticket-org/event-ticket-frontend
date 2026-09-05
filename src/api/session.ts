import type { TokenPair } from './types'

const REFRESH_KEY = 'eventticket.refresh'

type Listener = () => void

/**
 * Where the two tokens live, and why they live in different places.
 *
 * The **access token stays in memory**. It is irrevocable for its fifteen minutes -
 * nothing the server can do will stop one that has leaked - so the less durable its
 * storage the better. Losing it on reload costs one silent refresh.
 *
 * The **refresh token goes in localStorage**, because a session that ends every time
 * you reload the page is not a session. It is the safer of the two to store: it is
 * revocable server-side at any moment (ADR-0005), so a leak is containable.
 *
 * Worth being straight about the size of that win. Script running on this origin can
 * read localStorage, and script that can do that can also simply use the app while you
 * are in it. What this buys is that the *irrevocable* credential is not sitting in
 * storage, and the one that is can be killed.
 *
 * The properly secure version is httpOnly cookies, which needs the backend to set them
 * on login and refresh, plus CSRF handling - a contract change, not a frontend one.
 */
class Session {
  private accessToken: string | null = null
  private activeOrganizationId: string | null = null
  private listeners = new Set<Listener>()

  /** In-flight refresh, so twenty parallel 401s produce one refresh and not twenty. */
  private refreshing: Promise<boolean> | null = null

  get access(): string | null {
    return this.accessToken
  }

  get organizationId(): string | null {
    return this.activeOrganizationId
  }

  get refresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_KEY)
    } catch {
      // Private browsing, or storage disabled. Sign-in still works for this tab.
      return null
    }
  }

  /** True when there is any credential worth trying - not that it is still valid. */
  get maybeSignedIn(): boolean {
    return this.accessToken !== null || this.refresh !== null
  }

  adopt(tokens: TokenPair): void {
    this.accessToken = tokens.accessToken
    this.activeOrganizationId = tokens.activeOrganizationId ?? null
    try {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
    } catch {
      // Nothing to do: the session simply will not survive a reload.
    }
    this.announce()
  }

  clear(): void {
    this.accessToken = null
    this.activeOrganizationId = null
    try {
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      // Already gone, or never storable.
    }
    this.announce()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Runs `attempt` at most once, whoever asks first. Callers that arrive while a
   * refresh is in flight wait for its answer instead of starting another - four
   * requests failing together must not spend four refresh tokens, and the backend
   * would be right to reject the losers.
   */
  refreshOnce(attempt: () => Promise<boolean>): Promise<boolean> {
    this.refreshing ??= attempt().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private announce(): void {
    this.listeners.forEach((listener) => listener())
  }
}

export const session = new Session()
