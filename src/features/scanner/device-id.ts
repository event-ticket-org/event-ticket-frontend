import { useCallback, useState } from 'react'

/**
 * Which device this is, in words a person at the door would use.
 *
 * requirements/007 criterion 5: an already-redeemed Ticket shows *when* and *at which device* it
 * was first redeemed, so staff can tell "you already went in" from "someone else used your
 * ticket". A `deviceId` of `8f3c1a9e-...` cannot settle that argument - the operator needs to
 * hear "Main Door, four minutes ago" and be able to point at the door.
 *
 * So the operator names the device, and the name is what travels. The name alone is not enough:
 * `nfr.md` puts up to four devices on one gate and two of them will be called Main Door by
 * different people. A short random key, generated once and kept, keeps them apart - and is also
 * what the per-device rate limit (criterion 12) counts against, which is why it must survive a
 * reload rather than being minted per session.
 */
const KEY_STORAGE = 'eventticket.deviceKey'
const NAME_STORAGE = 'eventticket.deviceName'

/** The contract caps `deviceId` at 100 characters; the key and separator take six. */
const MAX_NAME = 80

function generateKey(): string {
  // Crockford-ish: no I, L, O or U, so a key read aloud across a gate is unambiguous and
  // cannot spell anything.
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function readOrCreateKey(): string {
  try {
    const stored = localStorage.getItem(KEY_STORAGE)
    if (stored) {
      return stored
    }
    const created = generateKey()
    localStorage.setItem(KEY_STORAGE, created)
    return created
  } catch {
    // Storage refused - a private window, or a browser told to keep nothing. The scan still
    // works; this device just stops being the same device after a reload, and the operator
    // loses the ability to recognise it in a redemption record.
    return generateKey()
  }
}

function readName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE) ?? ''
  } catch {
    return ''
  }
}

/** `Main Door 7QK2`, or `Device 7QK2` until somebody says which door it is. */
export function composeDeviceId(name: string, key: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME)
  return `${trimmed || 'Device'} ${key}`
}

export function useDeviceId() {
  const [key] = useState(readOrCreateKey)
  const [name, setName] = useState(readName)

  const rename = useCallback((next: string) => {
    setName(next)
    try {
      if (next.trim()) {
        localStorage.setItem(NAME_STORAGE, next.trim().slice(0, MAX_NAME))
      } else {
        localStorage.removeItem(NAME_STORAGE)
      }
    } catch {
      // Named for this session only. Better than refusing to accept the name.
    }
  }, [])

  return { deviceId: composeDeviceId(name, key), name, named: name.trim() !== '', rename }
}
