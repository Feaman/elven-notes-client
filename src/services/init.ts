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
  static OFFLINE_FALLBACK_MS = 2000

  static OFFLINE_ICON_MS = 4000

  // Cold start: show skeletons, request fresh data, and progressively fall back.
  // At OFFLINE_FALLBACK_MS we render the cached blob (no offline icon yet); at
  // OFFLINE_ICON_MS, if the server is still silent, we flip to the offline icon.
  // A successful response at any moment cancels the timers and applies fresh data.
  // Fire-and-forget from boot so a hung request never blocks app mount.
  static coldStart(): void {
    const globalStore = useGlobalStore()

    // The browser already reports no network — nothing to wait for, go offline now.
    if (!globalStore.isOnline) {
      if (!this.hydrateFromOffline()) {
        this.showNoOfflineDataError()
      }
      return
    }

    const offlineDataTimer = setTimeout(() => {
      // Показали кэш, но сервер ещё отвечает — включаем плашку «Updating…»,
      // чтобы было видно, что свежие данные продолжают загружаться. Сбросит её
      // synchronizeOfflineData (при ответе сервера) или таймер ниже (если ушли в офлайн).
      if (this.hydrateFromOffline()) {
        globalStore.isUpdating = true
      }
    }, this.OFFLINE_FALLBACK_MS)

    const offlineIconTimer = setTimeout(() => {
      const isOfflineShown = this.hydrateFromOffline()
      if (isOfflineShown) {
        globalStore.isOnline = false
        // Перестали ждать сервер и ушли в офлайн — плашка «Updating…» больше не нужна.
        globalStore.isUpdating = false
      } else {
        // Nothing to render and the server is unreachable — show the error screen.
        this.showNoOfflineDataError()
      }
    }, this.OFFLINE_ICON_MS)

    // isOnline is true at start, so ApiService.getConfig hits the online branch.
    BaseService.api.getConfig()
      .then(async (data) => {
        clearTimeout(offlineDataTimer)
        clearTimeout(offlineIconTimer)
        if (!data) {
          return
        }
        globalStore.isOnline = true
        // isUpdating=true keeps skeletons from re-appearing (no flicker) while still
        // clearing them in finally; it also merges offline edits and applies fresh data.
        await this.initApplication(data, true)
      })
      .catch(async (error) => {
        const parsedError = BaseService.parseAxiosError(error as AxiosError)
        if (parsedError.statusCode === 401) {
          clearTimeout(offlineDataTimer)
          clearTimeout(offlineIconTimer)
          await UsersService.signOut()
        }
        // Otherwise the network/server is down — leave isOnline and the timers
        // untouched; they render the offline blob (2s) and the icon / error (4s).
      })
  }

  // No cached data and the server is unreachable — surface the connection-error
  // screen and stop the skeletons.
  private static showNoOfflineDataError(): void {
    const globalStore = useGlobalStore()
    globalStore.isNoOfflineDataError = true
    globalStore.isInitDataLoading = false
  }

  // Render the cached offline blob into the UI synchronously. Does NOT touch
  // isOnline — the offline icon is driven solely by coldStart's timers.
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
