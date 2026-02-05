import { io } from 'socket.io-client'
import { nextTick } from 'vue'
import listItemModel, { TListItem, TListItemModel } from '~/composables/models/list-item'
import noteModel, { TNote, TNoteModel } from '~/composables/models/note'
import NotesService from '~/composables/services/notes'
import UsersService from '~/composables/services/users'
import { ROUTE_EXISTED_NOTE } from '~/router/routes'
import { useGlobalStore } from '~/stores/global'
import OfflineApiService from './api/offline-api'
import BaseService from './base'
import StorageService from './storage'

export default class SocketIOService extends BaseService {
  static EVENT_NOTE_ADDED = 'EVENT_NOTE_ADDED'

  static EVENT_NOTE_CHANGED = 'EVENT_NOTE_CHANGED'

  static EVENT_NOTE_COMPLETED = 'EVENT_NOTE_COMPLETED'

  static EVENT_NOTE_REMOVED = 'EVENT_NOTE_REMOVED'

  static EVENT_NOTE_ORDER_SET = 'EVENT_NOTE_ORDER_SET'

  static EVENT_LIST_ITEM_CHANGED = 'EVENT_LIST_ITEM_CHANGED'

  static EVENT_LIST_ITEM_REMOVED = 'EVENT_LIST_ITEM_REMOVED'

  static EVENT_LIST_ITEM_ADDED = 'EVENT_LIST_ITEM_ADDED'

  static socketId: string

  static init() {
    const token = StorageService.get(UsersService.AUTH_TOKEN_NAME)
    const socket = io(
      process.env.DEV ? 'localhost:3015' : BaseService.API_DOMAIN,
      { extraHeaders: { Authorization: `Bearer ${token}` } },
    )

    socket.on('connect', () => {
      this.socketId = socket.id || ''
      const globalStore = useGlobalStore()
      globalStore.isSocketError = false
    })

    socket.on('connect_error', (error) => {
      const globalStore = useGlobalStore()
      globalStore.isSocketError = true
      globalStore.isSocketErrorOnce = true
      // eslint-disable-next-line
      console.error(error)
    })

    socket.on(this.EVENT_NOTE_ADDED, async (noteData: TNote) => {
      // Add note
      const note = noteModel(noteData)
      NotesService.notes.value.push(note as unknown as TNoteModel)

      // Add offline note
      const offlineApi = new OfflineApiService()
      await offlineApi.addNote(
        [],
        noteData.title || '',
        noteData.text || '',
        Number(noteData.typeId),
        noteData.order,
        !!noteData.isCompletedListExpanded,
        !!noteData.isCountable,
        !!noteData.isShowCheckedCheckboxes,
        noteData.id,
      )
    })

    socket.on(this.EVENT_NOTE_CHANGED, async (noteData: TNote) => {
      try {
        // Change note
        const note = NotesService.notes.value.find((note) => note.id === noteData.id)
        if (note) {
          note.isRawUpdate = true
          Object.assign(
            note,
            {
              title: noteData.title,
              text: noteData.text,
              isCompletedListExpanded: noteData.isCompletedListExpanded,
              isCountable: noteData.isCountable,
              isShowCheckedCheckboxes: noteData.isShowCheckedCheckboxes,
              order: noteData.order,
            },
          )
          await nextTick()
          note.isRawUpdate = false
        }

        // Change offline note
        const offlineApi = new OfflineApiService()
        await offlineApi.updateNote(
          Number(noteData.id),
          noteData.title || '',
          noteData.text || '',
          Number(noteData.typeId),
          !!noteData.isCompletedListExpanded,
          !!noteData.isCountable,
          !!noteData.isShowCheckedCheckboxes,
        )
      } catch (error) {
        BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
      }
    })

    socket.on(this.EVENT_NOTE_COMPLETED, async (noteData: TNote) => {
      try {
        // Change note
        const note = NotesService.notes.value.find((note) => note.id === noteData.id)
        if (note) {
          note.list?.forEach((listItem: TListItemModel) => {
            if (!listItem.completed && listItem.checked) {
              listItem.completed = true
            }
          })
          await nextTick()
          note.isRawUpdate = false
        }

        // Change offline note
        const offlineApi = new OfflineApiService()
        await offlineApi.completeNote(Number(noteData.id))
      } catch (error) {
        BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
      }
    })

    socket.on(this.EVENT_NOTE_REMOVED, async (noteData: TNote) => {
      try {
        // Remove offline note
        const offlineApi = new OfflineApiService()
        await offlineApi.removeNote(noteData, true)

        // Remove note
        const note = NotesService.notes.value.find((note) => note.id === noteData.id)
        if (note) {
          NotesService.notes.value = NotesService.notes.value.filter((_note) => _note.id !== note.id)
        }
        if (this.router.currentRoute.value.name === ROUTE_EXISTED_NOTE) {
          this.router.push('/')
        }
      } catch (error) {
        BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
      }
    })

    socket.on(this.EVENT_LIST_ITEM_ADDED, async (listItemData: TListItem) => {
      try {
        // Add list item
        const note = NotesService.notes.value.find((note) => note.id === listItemData.noteId)
        if (note) {
          note.addListItem(listItemModel(listItemData) as unknown as TListItemModel)
        }

        // Remove offline note
        const offlineApi = new OfflineApiService()
        await offlineApi.addListItem(listItemData)
      } catch (error) {
        BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
      }
    })

    socket.on(this.EVENT_LIST_ITEM_CHANGED, async (listItemData: TListItem) => {
      try {
        // Update current list item
        const note = NotesService.notes.value.find((note) => note.id === listItemData.noteId)
        if (note) {
          const listItem = note.list.find((listItem) => listItem.id === listItemData.id)
          if (listItem) {
            Object.assign(listItem, { text: listItemData.text, checked: listItemData.checked, completed: listItemData.completed })
          }
        }

        // Update offline list item
        const offlineApi = new OfflineApiService()
        await offlineApi.updateListItem(listItemData)
      } catch (error) {
        BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
      }
    })

    socket.on(this.EVENT_LIST_ITEM_REMOVED, async (listItemData: TListItem) => {
      try {
        // Remove offline list item
        const offlineApi = new OfflineApiService()
        await offlineApi.removeListItem(listItemData, true)

        // Remove offline list item
        const note = NotesService.notes.value.find((note) => note.id === listItemData.noteId)
        if (note) {
          const listItem = note.list.find((listItem) => listItem.id === listItemData.id)
          if (listItem) {
            await note.removeListItemSoft(listItem)
          }
        }
      } catch (error) {
        BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
      }
    })

    socket.on(this.EVENT_NOTE_ORDER_SET, (noteData: TNote) => {
      const note = NotesService.notes.value.find((_note) => _note.id === noteData.id) as TNoteModel
      if (note && note.isList) {
        noteData.list?.forEach((listItemData: TListItem) => {
          const listItem = note.list.find((listItem) => listItem.id === listItemData.id) as TListItemModel
          if (listItem) {
            listItem.order = Number(listItemData.order)
          }
        })
      }
    })
  }
}
