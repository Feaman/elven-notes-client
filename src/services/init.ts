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
}
