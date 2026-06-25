import { AxiosError } from 'axios'
import NotesService from '~/composables/services/notes'
import StatusesService from '~/composables/services/statuses'
import TypesService from '~/composables/services/types'
import UsersService from '~/composables/services/users'
import { ROUTE_EXISTED_NOTE } from '~/router/routes'
import BaseService from '~/services//base'
import StorageService from '~/services/storage'
import { useGlobalStore } from '~/stores/global'
import { ConfigObject } from './api/interface'
import SyncService from './sync'

export default class InitService extends BaseService {
  static OFFLINE_ICON_MS = 4000

  // Cold start: render the cached blob immediately (no skeletons, no «Updating…»
  // toast — the startup reconcile is silent), then refresh from the server in
  // the background. If the server stays silent past OFFLINE_ICON_MS we flip to
  // the offline icon; a successful response applies fresh data and cancels the
  // timer. With no cached data we keep skeletons until the server answers (or
  // show the error screen at OFFLINE_ICON_MS).
  // Fire-and-forget from boot so a hung request never blocks app mount.
  static coldStart(): void {
    const globalStore = useGlobalStore()

    // First paint shows real cached data, never skeletons — whenever a cache exists.
    const isOfflineShown = this.hydrateFromOffline()

    // The browser already reports no network — nothing to fetch.
    if (!globalStore.isOnline) {
      if (!isOfflineShown) {
        this.showNoOfflineDataError()
      }
      return
    }

    // Fallback if the server stays silent (no response, no error): flip to the
    // offline icon without waiting out getConfig's own 10s timeout.
    const offlineIconTimer = setTimeout(() => {
      this.goOfflineOrShowError(isOfflineShown)
    }, this.OFFLINE_ICON_MS)

    // isOnline is true at start, so ApiService.getConfig hits the online branch.
    BaseService.api.getConfig()
      .then(async (data) => {
        clearTimeout(offlineIconTimer)
        if (!data) {
          return
        }
        globalStore.isOnline = true
        // isUpdating=true keeps skeletons from re-appearing (no flicker) while
        // still clearing them in finally; it also merges offline edits and
        // applies fresh data — silently, since synchronizeOfflineData no longer
        // raises the «Updating…» toast on its own.
        await this.initApplication(data, true)
      })
      .catch(async (error) => {
        // The request failed fast — react now instead of waiting out the timer.
        clearTimeout(offlineIconTimer)
        const parsedError = BaseService.parseAxiosError(error as AxiosError)
        if (parsedError.statusCode === 401) {
          await UsersService.signOut()
          return
        }
        // Network/server is down — offline icon over the cache, or the error
        // screen if there was nothing to render.
        this.goOfflineOrShowError(isOfflineShown)
      })
  }

  // Server is unreachable: drop to offline mode over the cached data, or show
  // the connection-error screen if nothing was cached to render. Shared by the
  // OFFLINE_ICON_MS timer (server stayed silent) and the getConfig catch
  // (request failed fast) — both react identically.
  private static goOfflineOrShowError(isOfflineShown: boolean): void {
    const globalStore = useGlobalStore()
    if (isOfflineShown || this.hydrateFromOffline()) {
      globalStore.isOnline = false
    } else {
      this.showNoOfflineDataError()
    }
  }

  // No cached data and the server is unreachable — surface the connection-error
  // screen and stop the skeletons.
  private static showNoOfflineDataError(): void {
    const globalStore = useGlobalStore()
    globalStore.isNoOfflineDataError = true
    globalStore.isInitDataLoading = false
  }

  // Render the cached offline blob into the UI synchronously. Does NOT touch
  // isOnline — the offline icon is driven solely by coldStart.
  static hydrateFromOffline(): boolean {
    const globalStore = useGlobalStore()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME)
    if (!offlineData || !offlineData.user || !offlineData.types
      || !offlineData.statuses || !this.isValidOfflineData(offlineData)) {
      return false
    }
    // Order matters: NotesService.filtered relies on StatusesService.active.
    TypesService.generateTypes(offlineData.types)
    StatusesService.generateStatuses(offlineData.statuses)
    NotesService.generateNotes(offlineData.notes)
    globalStore.setUser(offlineData.user)
    globalStore.isNoOfflineDataError = false
    globalStore.isInitDataLoading = false
    return true
  }

  static async initApplication(data?: ConfigObject, isUpdating = false): Promise<void> {
    const globalStore = useGlobalStore()

    try {
      if (!isUpdating) {
        globalStore.isInitDataLoading = true
      }

      if (!data) {
        try {
          data = await BaseService.api.getConfig()
        } catch (error) {
          const parsedError = BaseService.parseAxiosError(error as AxiosError)
          if (parsedError.statusCode === 401) {
            throw error
          }
          if (globalStore.isOnline) {
            globalStore.isOnline = false
          }
          data = await BaseService.api.getConfig()
        }
      }

      if (!data) {
        globalStore.isNoOfflineDataError = true
        return
      }
      globalStore.isNoOfflineDataError = false

      TypesService.generateTypes(data.types)
      StatusesService.generateStatuses(data.statuses)

      if (globalStore.isOnline) {
        const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME)
        if (!offlineData) {
          StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: data })
        } else if (!this.isValidOfflineData(offlineData)) {
          // Offline data is corrupted; discard it and start fresh from server
          StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: data })
        } else {
          // Wait for the merge so offline-only changes (e.g. a list item added
          // while offline) are pushed to the server and promoted from
          // `offline-*` to real ids before we rebuild the UI. Otherwise
          // generateNotes runs against the unmerged server snapshot and
          // filters out the in-memory `offline-*` item — it disappears until
          // the next focus-driven re-sync brings it back.
          await SyncService.synchronizeOfflineData(data)
          const syncedOfflineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject
          data.notes = syncedOfflineData.notes
        }
      }

      NotesService.generateNotes(data.notes)

      globalStore.setUser(data.user)
      // synchronizeOfflineData already runs clearRemovedOfflineNotesAndListItems
      // at its start, so no second pass is needed here.

      const currentNoteId = NotesService.currentNote.value?.id
      if (this.router.currentRoute.value.name === ROUTE_EXISTED_NOTE && currentNoteId) {
        const currentNote = NotesService.notes.value.find((note) => note.id === currentNoteId)
        if (!currentNote) {
          throw new Error('Current note id not found in new notes')
        }
        if (NotesService.currentNote.value) {
          NotesService.currentNote.value = currentNote
        }
      }
    } catch (error) {
      const initError = BaseService.parseAxiosError(error as AxiosError)
      if (initError.statusCode === 401) {
        await UsersService.signOut()
      } else {
        globalStore.initError = initError
      }
    } finally {
      globalStore.isInitDataLoading = false
    }
  }

  static clearApplication() {
    StorageService.set({ [UsersService.AUTH_TOKEN_NAME]: undefined })
    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: undefined })
    const globalStore = useGlobalStore()
    NotesService.notes.value = []
    globalStore.user = null
  }

  static async clearLocalNotesData(): Promise<void> {
    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: undefined })
    NotesService.notes.value = []
    NotesService.removingNotes.value = []
    NotesService.currentNote.value = null

    const globalStore = useGlobalStore()
    if (globalStore.isOnline) {
      await this.initApplication()
    }
  }

  // Validate offline blob structure to detect corruption
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static isValidOfflineData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false
    }
    if (!Array.isArray(data.notes)) {
      return false
    }
    // Check that notes array contains valid note objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notesValid = data.notes.every((note: any) => {
      if (!note.id) {
        return false
      }
      if (!Array.isArray(note.list)) {
        return false
      }
      // Check list items have required fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return note.list.every((item: any) => item.id && item.noteId)
    })
    return notesValid
  }
}
