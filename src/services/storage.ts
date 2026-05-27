import { LocalStorage, WebStorageGetMethodReturnType } from 'quasar'
import BaseService from './base'

type StorageCache = { [index: string]: WebStorageGetMethodReturnType }

// Persist at most once per window. Writes within the same window are coalesced
// into a single trailing write. Hidden-tab / unload events flush synchronously
// to guarantee durability on close.
const PERSIST_THROTTLE_MS = 300

export default class StorageService extends BaseService {
  private static key = '__ELVEN-NOTES__'

  private static cache: StorageCache | null = null

  private static throttleTimer: ReturnType<typeof setTimeout> | null = null

  private static isWritePending = false

  private static isFlushSubscribed = false

  static set(data: object) {
    const cache = StorageService.loadCache()
    Object.assign(cache, data)
    StorageService.schedulePersist()
  }

  // The return is intentionally `any`: callers across the codebase narrow it
  // to specific shapes (ConfigObject, auth token, etc.) on a per-key basis.
  // The previous implementation also implicitly returned `any` via JSON.parse.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static get(key = ''): any {
    const cache = StorageService.loadCache()
    return key ? cache[key] : cache
  }

  static flush() {
    if (StorageService.throttleTimer !== null) {
      clearTimeout(StorageService.throttleTimer)
      StorageService.throttleTimer = null
    }
    StorageService.isWritePending = false
    StorageService.persist()
  }

  private static loadCache(): StorageCache {
    if (StorageService.cache !== null) {
      return StorageService.cache
    }
    const raw: StorageCache | string = LocalStorage.getItem(StorageService.key) || {}
    StorageService.cache = typeof raw === 'string'
      ? JSON.parse(raw) as StorageCache
      : raw
    StorageService.subscribeFlushOnHide()
    return StorageService.cache
  }

  private static persist() {
    if (StorageService.cache === null) {
      return
    }
    LocalStorage.set(StorageService.key, StorageService.cache)
  }

  // Leading-edge throttle: the first set after a quiet window persists
  // immediately so isolated writes (e.g. sign-in token) are durable right
  // away. Subsequent writes within the window collapse into a single
  // trailing persist at the end.
  private static schedulePersist() {
    if (StorageService.throttleTimer !== null) {
      StorageService.isWritePending = true
      return
    }
    StorageService.persist()
    StorageService.throttleTimer = setTimeout(() => {
      StorageService.throttleTimer = null
      if (StorageService.isWritePending) {
        StorageService.isWritePending = false
        StorageService.persist()
      }
    }, PERSIST_THROTTLE_MS)
  }

  private static subscribeFlushOnHide() {
    if (StorageService.isFlushSubscribed) {
      return
    }
    StorageService.isFlushSubscribed = true
    const handleFlush = () => StorageService.flush()
    // `pagehide` is the modern, mobile-safe replacement for `beforeunload`;
    // keep both for browsers that prefer one. `visibilitychange` covers the
    // "swipe away the tab" path that neither unload event fires on.
    window.addEventListener('pagehide', handleFlush)
    window.addEventListener('beforeunload', handleFlush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        StorageService.flush()
      }
    })
  }
}
