import { TListItem } from '~/composables/models/list-item'
import { TNote } from '~/composables/models/note'
import ListItemsService from '~/composables/services/list-items'
import NotesService from '~/composables/services/notes'
import StatusesService from '~/composables/services/statuses'
import TypesService from '~/composables/services/types'
import { ROUTE_EXISTED_NOTE, ROUTE_NEW, ROUTE_SIGN } from '~/router/routes'
import { useGlobalStore } from '~/stores/global'
import { ConfigObject } from './api/interface'
import OnlineApiService from './api/online-api'
import BaseService from './base'
import InitService from './init'
import StorageService from './storage'

export default class SyncService extends BaseService {
  static async synchronizeOfflineData(data?: ConfigObject) {
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME)
    const onlineApi = new OnlineApiService()
    let onlineNotesToRemove: TNote[] = []
    let offlineNotesToRemove: TNote[] = []
    let offlineListItemsToRemove: TListItem[] = []
    let onlineListItemsToRemove: TListItem[] = []

    this.clearRemovedOfflineNotesAndListItems()

    const globalStore = useGlobalStore()
    globalStore.isUpdating = true
    try {
      const onlineData = data || (await BaseService.api.getConfig())

      if (!data) {
        TypesService.generateTypes(onlineData.types)
        StatusesService.generateStatuses(onlineData.statuses)
      }

      // Apply statuses and types without checking
      offlineData.statuses = onlineData.statuses
      offlineData.types = onlineData.types

      // Handle offline notes
      for (
        let noteIndex = 0;
        noteIndex < offlineData.notes.length;
        noteIndex++
      ) {
        const offlineNote = offlineData.notes[noteIndex] as TNote

        // Handle Note entity
        const onlineNote = onlineData.notes.find(
          (onlineNote) => onlineNote.id === offlineNote.id,
        )
        if (!onlineNote) {
          // Create online note
          if (String(offlineNote.id).indexOf('offline') === 0) {
            const offlineNoteList = offlineNote.list
            offlineNote.list = []
            // eslint-disable-next-line no-await-in-loop
            const newNote = await onlineApi.addNote(
              offlineNote.list || [],
              offlineNote.title || '',
              offlineNote.text || '',
              offlineNote.typeId || 0,
              offlineNote.order,
              !!offlineNote.isCompletedListExpanded,
              !!offlineNote.isCountable,
              !!offlineNote.isShowCheckedCheckboxes,
            )
            offlineNote.id = newNote.id
            offlineNote.updated = newNote.updated
            if (
              [ROUTE_EXISTED_NOTE, ROUTE_NEW].includes(
                String(this.router.currentRoute.value.name),
              )
            ) {
              this.router.push(`/note/${newNote.id}`)
              if (NotesService.currentNote.value?.id) {
                NotesService.currentNote.value.id = newNote.id
              }
            }

            // Create online list items
            if (offlineNoteList) {
              for (
                let offlineListItemIndex = 0;
                offlineListItemIndex < offlineNoteList.length;
                offlineListItemIndex++
              ) {
                const offlineListItem = offlineNoteList[offlineListItemIndex]
                offlineListItem.noteId = newNote.id
                // eslint-disable-next-line no-await-in-loop
                const onlineListItem = await onlineApi.addListItem(offlineListItem)
                offlineListItem.id = onlineListItem.id
                offlineListItem.updated = onlineListItem.updated
                offlineNote.list.push(offlineListItem)
              }
            }
          } else {
            offlineNotesToRemove.push(offlineNote)
          }

          // eslint-disable-next-line no-continue
          continue
        } else {
          if (!offlineNote.updated || !onlineNote.updated) {
            throw new Error(
              '"updated" or "created" field not found in offline note',
            )
          }
          if (new Date(offlineNote.updated) < new Date(onlineNote.updated)) {
            // Update offline note
            Object.assign(offlineNote, onlineNote)
          } else if (
            new Date(offlineNote.updated) > new Date(onlineNote.updated)
          ) {
            // Remove both offline and online note
            if (offlineNote.statusId === StatusesService.inactive.value.id) {
              onlineApi.removeNote(offlineNote)
              offlineNotesToRemove.push(offlineNote)
              onlineNotesToRemove.push(onlineNote)
              // eslint-disable-next-line no-continue
              continue
            } else {
              // Update online note
              // eslint-disable-next-line no-await-in-loop
              const updatedOnlineNote = await onlineApi.updateNote(
                Number(offlineNote.id),
                offlineNote.title || '',
                offlineNote.text || '',
                Number(offlineNote.typeId),
                !!offlineNote.isCompletedListExpanded,
                !!offlineNote.isCountable,
                !!offlineNote.isShowCheckedCheckboxes,
              )
              offlineNote.updated = updatedOnlineNote.updated
            }
          }
        }

        // Handle offline list items
        if (offlineNote.list) {
          for (
            let listItemIndex = 0;
            listItemIndex < offlineNote.list.length;
            listItemIndex++
          ) {
            const offlineListItem = offlineNote.list[listItemIndex]
            const onlineListItem = onlineNote?.list
              && onlineNote.list.find(
                (listItem) => listItem.id === offlineListItem.id,
              )
            if (!onlineListItem) {
              if (String(offlineListItem.id).indexOf('offline') === 0) {
                // Add online list item
                // eslint-disable-next-line no-await-in-loop
                const newListItem = await onlineApi.addListItem(offlineListItem)
                offlineListItem.id = newListItem.id
                offlineListItem.updated = newListItem.updated
              } else {
                // Remove offline list item
                offlineNote.list.splice(listItemIndex, 1)
              }
            } else {
              if (!offlineListItem.updated || !onlineListItem.updated) {
                throw new Error(
                  '"updated" or "created" field not found in offline note',
                )
              }
              if (
                new Date(offlineListItem.updated)
                < new Date(onlineListItem.updated)
              ) {
                // Update offline list item
                Object.assign(offlineListItem, onlineListItem)
              } else if (
                new Date(offlineListItem.updated)
                > new Date(onlineListItem.updated)
              ) {
                if (
                  offlineListItem.statusId === StatusesService.inactive.value.id
                ) {
                  // Remove both offline and online list item
                  // eslint-disable-next-line no-await-in-loop
                  await onlineApi.removeListItem(offlineListItem)
                  offlineListItemsToRemove.push(offlineListItem)
                  onlineListItemsToRemove.push(onlineListItem)
                } else {
                  // Update online list item
                  // eslint-disable-next-line no-await-in-loop
                  const updatedOnlineListItem = await onlineApi.updateListItem(offlineListItem)
                  offlineListItem.updated = updatedOnlineListItem.updated
                }
              }
            }
          }

          // Remove online list items marked to remove
          onlineListItemsToRemove.forEach((onlineListItem) => {
            if (onlineNote.list) {
              onlineNote.list.splice(
                onlineNote.list.indexOf(onlineListItem),
                1,
              )
            }
          })
          onlineListItemsToRemove = []

          // Remove offline list items marked to remove
          offlineListItemsToRemove.forEach((offlineListItem) => {
            if (offlineNote.list) {
              offlineNote.list.splice(
                offlineNote.list.indexOf(offlineListItem),
                1,
              )
            }
          })
          offlineListItemsToRemove = []

          // Handle online list items
          if (onlineNote?.list) {
            const offlineListItemsIds = offlineNote.list.map(
              (offlineNoteListItem: TListItem) => offlineNoteListItem.id,
            )
            const newListItems = onlineNote.list.filter(
              (onlineNoteListItem) =>
                !offlineListItemsIds.includes(onlineNoteListItem.id),
            )
            newListItems.forEach((newListItem) => {
              if (offlineNote.list) {
                offlineNote.list.push(newListItem)
              }
            })
          }
        }
      }

      // Remove online notes marked to remove
      onlineNotesToRemove.forEach((onlineNoteToRemove) => {
        onlineData.notes.splice(
          onlineData.notes.indexOf(onlineNoteToRemove),
          1,
        )
      })
      onlineNotesToRemove = []

      // Remove offline notes marked to remove
      offlineNotesToRemove.forEach((offlineNoteToRemove) => {
        offlineData.notes.splice(
          offlineData.notes.indexOf(offlineNoteToRemove),
          1,
        )
      })
      offlineNotesToRemove = []

      // Handle online notes
      const offlineNoteIds = offlineData.notes.map(
        (offlineNote: TNote) => offlineNote.id,
      )
      const newNotes = onlineData.notes.filter(
        (onlineNote) => !offlineNoteIds.includes(onlineNote.id),
      )
      newNotes.forEach((onlineNote) => {
        offlineData.notes.push(onlineNote)
      })

      StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })
      if (!data) {
        NotesService.generateNotes(offlineData.notes)
      }
    } finally {
      globalStore.isUpdating = false
    }
  }

  static clearRemovedOfflineNotesAndListItems() {
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME)
    const offlineNotesIndicesToRemove: number[] = []
    const offlineListItemsIndicesToRemove: number[] = []
    offlineData.notes.forEach((offlineNote: TNote, index: number) => {
      if (
        String(offlineNote.id).indexOf('offline') === 0
        && offlineNote.statusId === StatusesService.inactive.value.id
        && new Date().getTime() - new Date(String(offlineNote.updated)).getTime()
          > 5000
      ) {
        offlineNotesIndicesToRemove.push(index)
      } else if (offlineNote.list) {
        offlineNote.list.forEach((offlineListItem) => {
          if (
            String(offlineListItem.id).indexOf('offline') === 0
            && offlineListItem.statusId === StatusesService.inactive.value.id
            && new Date().getTime()
              - new Date(String(offlineListItem.updated)).getTime()
              > 5000
          ) {
            offlineListItemsIndicesToRemove.push(index)
          }
        })
      }
    })
    offlineNotesIndicesToRemove.forEach((offlineNoteIndex) =>
      offlineData.notes.splice(offlineNoteIndex, 1),
    )
    offlineListItemsIndicesToRemove.forEach((offlineListItemIndex) =>
      offlineData.notes.splice(offlineListItemIndex, 1),
    )

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })
  }

  static async handleApplicationUpdate(isUpdating = false) {
    const globalStore = useGlobalStore()
    try {
      if (
        !globalStore.isOnline
        || this.router.currentRoute.value.name === ROUTE_SIGN
      ) {
        return
      }

      globalStore.isUpdating = true
      await InitService.initApplication(undefined, isUpdating)
    } finally {
      globalStore.isSocketErrorOnce = false
      // globalStore.isUpdating = false
    }
  }

  static removeRemovedEntities() {
    NotesService.removingNotes.value = []
    ListItemsService.removingListItems.value = []
  }
}
