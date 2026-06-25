import { TListItem } from '~/composables/models/list-item'
import noteModel, { TNote, TNoteModel } from '~/composables/models/note'
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
  // Reconcile offline changes with the server snapshot.
  //
  // The `updated` timestamp is server-generated at the time of modification,
  // so it is the authoritative source for conflict resolution. We use
  // last-write-wins: whichever version has the newer `updated` timestamp is
  // treated as the authoritative state and overwrites the other.
  //
  // This is safe within a single-user context (no concurrent edits from
  // different devices in the microsecond window) but is vulnerable if two
  // devices update the same note within a very tight time window. For
  // multi-device scenarios, consider upgrading to CRDT-based resolution.
  static async synchronizeOfflineData(data?: ConfigObject) {
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME)
    if (!offlineData || !offlineData.notes) {
      // Nothing to reconcile; bootstrapping from the server is InitService's job.
      return
    }
    const onlineApi = new OnlineApiService()
    let onlineNotesToRemove: TNote[] = []
    let offlineNotesToRemove: TNote[] = []
    let offlineListItemsToRemove: TListItem[] = []
    let onlineListItemsToRemove: TListItem[] = []

    // Clear expired tombstones before starting the sync. Offline-only deletes
    // (entities marked inactive) are in the storage, and we'll handle them
    // during the sync loop. Only after we've had a chance to push them to
    // the server will we prune the deletion records (via the 15s expiration
    // window). This prevents losing deletions if sync takes longer than 5s.
    this.clearRemovedOfflineNotesAndListItems()

    const globalStore = useGlobalStore()
    // The «Updating…» toast is owned by the visible-refresh trigger
    // (handleApplicationUpdate on focus/online), not by this reconcile: the
    // cold-start sync must stay silent, so we don't raise the flag here — we
    // only clear it in `finally` as a safety net if a caller set it.
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
            const previousOfflineNoteId = offlineNote.id
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
              !!offlineNote.isPrioritySort,
            )
            offlineNote.id = newNote.id
            offlineNote.updated = newNote.updated
            offlineNote.created = newNote.created

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
                offlineListItem.created = onlineListItem.created
                offlineNote.list.push(offlineListItem)
              }
            }

            // Rebuild the UI model from the synced offline data. The model that
            // was created offline holds Vue refs whose `id`/`noteId` still point
            // at the old `offline-*` values across the note and every list item;
            // patching them one-by-one races with the reactive merge in
            // generateNotes and ends up dropping items from the visible list.
            // A wholesale rebuild keeps reactivity coherent and lets
            // generateNotes match by the new numeric ids without any migration.
            const uiNoteIndex = NotesService.notes.value.findIndex(
              (note) => note.id === previousOfflineNoteId,
            )
            if (uiNoteIndex !== -1) {
              const wasCurrentNote = NotesService.currentNote.value
                === NotesService.notes.value[uiNoteIndex]
              const replacementNote = noteModel(offlineNote) as unknown as TNoteModel
              replacementNote.handleDataTransformation()
              NotesService.notes.value.splice(uiNoteIndex, 1, replacementNote)
              if (wasCurrentNote) {
                NotesService.currentNote.value = replacementNote
              }
            }

            if (
              [ROUTE_EXISTED_NOTE, ROUTE_NEW].includes(
                String(this.router.currentRoute.value.name),
              )
            ) {
              this.router.push(`/note/${newNote.id}`)
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
            // Server has a newer version of the note (including its list);
            // accept the server snapshot wholesale and skip the per-item loop —
            // Object.assign aliases offlineNote.list to onlineNote.list, so any
            // subsequent per-item processing would be a no-op anyway.
            Object.assign(offlineNote, onlineNote)
            // eslint-disable-next-line no-continue
            continue
          } else if (
            new Date(offlineNote.updated) > new Date(onlineNote.updated)
          ) {
            // Remove both offline and online note
            if (offlineNote.statusId === StatusesService.inactive.value.id) {
              // eslint-disable-next-line no-await-in-loop
              await onlineApi.removeNote(offlineNote)
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
                !!offlineNote.isPrioritySort,
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
                // Promote this offline-only list item to the server. After we get
                // the real id, mirror it into the in-memory model so subsequent
                // edits hit the real endpoint (not PUT /list-items/offline-*)
                // and incoming socket events with the server id match by id.
                const previousOfflineListItemId = offlineListItem.id
                // eslint-disable-next-line no-await-in-loop
                const newListItem = await onlineApi.addListItem(offlineListItem)
                offlineListItem.id = newListItem.id
                offlineListItem.updated = newListItem.updated
                offlineListItem.created = newListItem.created
                const inMemoryNote = NotesService.notes.value.find(
                  (memoryNote) => memoryNote.id === offlineNote.id,
                )
                const inMemoryListItem = inMemoryNote?.list.find(
                  (memoryListItem) => memoryListItem.id === previousOfflineListItemId,
                )
                if (inMemoryListItem) {
                  inMemoryListItem.id = newListItem.id
                  inMemoryListItem.updated = new Date(newListItem.updated || '')
                  inMemoryListItem.created = new Date(newListItem.created || '')
                }
              } else {
                // Orphan: gone from the server, never created locally. Defer
                // the splice so we do not corrupt indices mid-iteration.
                offlineListItemsToRemove.push(offlineListItem)
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
    if (!offlineData || !offlineData.notes) {
      return
    }
    const inactiveStatusId = StatusesService.inactive.value.id
    // Tombstone expiration: 15 seconds gives sync enough time to complete
    // on slow networks before we prune the deletion records
    const tombstoneExpirationMs = 15000
    const currentTimestampMs = new Date().getTime()

    const isExpiredOfflineTombstone = (entity: TNote | TListItem) =>
      String(entity.id).indexOf('offline') === 0
      && entity.statusId === inactiveStatusId
      && currentTimestampMs - new Date(String(entity.updated)).getTime() > tombstoneExpirationMs

    offlineData.notes = offlineData.notes.filter((offlineNote: TNote) => {
      if (isExpiredOfflineTombstone(offlineNote)) {
        return false
      }
      if (offlineNote.list) {
        offlineNote.list = offlineNote.list.filter((offlineListItem) => !isExpiredOfflineTombstone(offlineListItem))
      }
      return true
    })

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
      // Reset the flag here so the "Updating…" toast clears even on code paths
      // where InitService.initApplication skipped synchronizeOfflineData (the
      // only other place that resets it) — e.g. when no offline blob exists.
      globalStore.isUpdating = false
    }
  }

  static removeRemovedEntities() {
    NotesService.removingNotes.value = []
    ListItemsService.removingListItems.value = []
  }
}
