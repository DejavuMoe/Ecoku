export interface StoredVisitorIdentity {
  username: string
  email: string
  url: string
}

export const VISITOR_IDENTITY_TTL_MS = 7 * 24 * 60 * 60 * 1000

const DATABASE_NAME = 'ecoku-client-identity-v1'
const STORE_NAME = 'identity'
const DATABASE_VERSION = 1

interface EncryptionKeyRecord {
  id: string
  key: CryptoKey
}

interface EncryptedIdentityRecord {
  id: string
  scope: string
  iv: ArrayBuffer
  ciphertext: ArrayBuffer
  savedAt: number
  expiresAt: number
}

function normalizedScope(serverURL: string, siteId: string): string {
  const url = new URL(serverURL)
  url.hash = ''
  url.search = ''
  url.pathname = url.pathname.replace(/\/$/, '')
  return `${url.toString().replace(/\/$/, '')}::${siteId}`
}

function keyRecordID(scope: string): string {
  return `key:${scope}`
}

function valueRecordID(scope: string): string {
  return `value:${scope}`
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) {
    return Promise.reject(new Error('browser identity storage is unavailable'))
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('could not open browser identity storage'))
    request.onblocked = () => reject(new Error('browser identity storage is blocked'))
  })
}

async function readRecord<T>(id: string): Promise<T | undefined> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(id)
    request.onsuccess = () => resolve(request.result as T | undefined)
    request.onerror = () => reject(request.error ?? new Error('could not read browser identity storage'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('browser identity storage transaction failed'))
    }
    transaction.onabort = transaction.onerror
  })
}

async function writeRecord(record: EncryptionKeyRecord | EncryptedIdentityRecord, add = false): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = add ? store.add(record) : store.put(record)
    request.onerror = () => reject(request.error ?? new Error('could not write browser identity storage'))
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('browser identity storage transaction failed'))
    }
    transaction.onabort = transaction.onerror
  })
}

async function getOrCreateEncryptionKey(scope: string): Promise<CryptoKey> {
  const id = keyRecordID(scope)
  const existing = await readRecord<EncryptionKeyRecord>(id)
  if (existing?.key) return existing.key

  const generated = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  try {
    await writeRecord({ id, key: generated }, true)
    return generated
  } catch {
    // Two components for the same site may initialize together. If another
    // component won the add race, always use the key that actually persisted.
    const raced = await readRecord<EncryptionKeyRecord>(id)
    if (raced?.key) return raced.key
    throw new Error('could not persist browser identity encryption key')
  }
}

function isStoredIdentity(value: unknown): value is StoredVisitorIdentity {
  if (!value || typeof value !== 'object') return false
  const identity = value as Partial<StoredVisitorIdentity>
  return typeof identity.username === 'string'
    && typeof identity.email === 'string'
    && typeof identity.url === 'string'
}

export async function saveVisitorIdentity(
  serverURL: string,
  siteId: string,
  identity: StoredVisitorIdentity,
): Promise<boolean> {
  try {
    const scope = normalizedScope(serverURL, siteId)
    const key = await getOrCreateEncryptionKey(scope)
    const ivBytes = crypto.getRandomValues(new Uint8Array(12))
    const iv = ivBytes.buffer.slice(
      ivBytes.byteOffset,
      ivBytes.byteOffset + ivBytes.byteLength,
    ) as ArrayBuffer
    const savedAt = Date.now()
    const plaintext = new TextEncoder().encode(JSON.stringify(identity))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, plaintext)
    await writeRecord({
      id: valueRecordID(scope),
      scope,
      iv,
      ciphertext,
      savedAt,
      expiresAt: savedAt + VISITOR_IDENTITY_TTL_MS,
    })
    return true
  } catch {
    // Comment submission must remain usable when IndexedDB or Web Crypto is
    // unavailable. Identity persistence is an optional browser convenience.
    return false
  }
}

export async function loadVisitorIdentity(serverURL: string, siteId: string): Promise<StoredVisitorIdentity | null> {
  try {
    const scope = normalizedScope(serverURL, siteId)
    const stored = await readRecord<EncryptedIdentityRecord>(valueRecordID(scope))
    if (!stored
      || stored.scope !== scope
      || stored.expiresAt !== stored.savedAt + VISITOR_IDENTITY_TTL_MS
      || stored.expiresAt <= Date.now()) return null

    const key = (await readRecord<EncryptionKeyRecord>(keyRecordID(scope)))?.key
    if (!key) return null
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(stored.iv) },
      key,
      stored.ciphertext,
    )
    const identity: unknown = JSON.parse(new TextDecoder().decode(plaintext))
    return isStoredIdentity(identity) ? identity : null
  } catch {
    // Expired, corrupt, or inaccessible values are ignored. We intentionally
    // do not proactively clear browser storage; users can clear site data via
    // their browser and an expired value is never reused.
    return null
  }
}
