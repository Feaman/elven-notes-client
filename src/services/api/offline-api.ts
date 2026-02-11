import { TCoAuthor } from '~/composables/models/co-author'
import { TListItemModel, type TListItem } from '~/composables/models/list-item'
import { TNote, TNoteModel } from '~/composables/models/note'
import { TUser } from '~/composables/models/user'
import StatusesService from '~/composables/services/statuses'
import UsersService from '~/composables/services/users'
import BaseService from '~/services/base'
import { useGlobalStore } from '~/stores/global'
import StorageService from '../storage'
import IApi, { ConfigObject } from './interface'

export default class OfflineApiService implements IApi {
  checkAuthToken() {
    const authToken = StorageService.get(UsersService.AUTH_TOKEN_NAME)
    if (!authToken) {
      throw new Error('Authentication is required. Please, find Internet connection and sign in.')
    }
  }

  async getConfig(): Promise<ConfigObject> {
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME)
    return Promise.resolve(offlineData as ConfigObject)
  }

  async addNote(_list: TListItemModel[] | TListItem[], title: string, text: string, typeId: number, order: number, isCompletedListExpanded: boolean, isCountable: boolean, isShowCheckedCheckboxes: boolean, id?: string | number): Promise<TNote> {
    this.checkAuthToken()

    id = Number(id)
    const noteData = {
      title,
      text,
      typeId,
      list: [] as TListItem[],
      order,
      isCompletedListExpanded,
      isCountable,
      isShowCheckedCheckboxes,
      statusId: StatusesService.active.value.id,
    }

    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject
    const currentDateTime = new Date().toISOString()
    const offlineNoteData = Object.assign(noteData, {
      id: id || `offline-${new Date().getTime()}`,
      updated: currentDateTime,
      created: currentDateTime,
      userId: useGlobalStore().user?.id,
      user: useGlobalStore().user as TUser,
    })

    offlineData.notes.push(offlineNoteData)
    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })

    return Promise.resolve(offlineNoteData)
  }

  async updateNote(id: number | string, title: string, text: string, typeId: number, isCompletedListExpanded: boolean, isCountable: boolean, isShowCheckedCheckboxes: boolean): Promise<TNote> {
    this.checkAuthToken()

    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject
    const offlineNote = offlineData.notes.find((note) => note.id === id)
    if (!offlineNote) {
      throw new Error(`[offlineApi.UpdateNote]: Note with id "${id}" not found in offline data`)
    }

    Object.assign(offlineNote, {
      title,
      text,
      typeId,
      isCompletedListExpanded,
      isCountable,
      isShowCheckedCheckboxes,
      updated: new Date().toISOString(),
    })

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })

    return Promise.resolve(offlineNote)
  }

  async completeNote(id: number | string): Promise<TNote> {
    this.checkAuthToken()

    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject
    const offlineNote = offlineData.notes.find((note) => note.id === id)
    if (!offlineNote) {
      throw new Error(`[offlineApi.UpdateNote]: Note with id "${id}" not found in offline data`)
    }

    offlineNote.list?.forEach((offlineNoteListItem: TListItem) => {
      if (!offlineNoteListItem.completed && offlineNoteListItem.checked) {
        Object.assign(offlineNoteListItem, {
          updated: new Date().toISOString(),
          completed: 1,
        })
      }
    })

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })

    return Promise.resolve(offlineNote)
  }

  async removeNote(note: TNoteModel | TNote, completely = false) {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject

    const offlineNote = offlineData.notes.find((offlineNote) => offlineNote.id === note.id) as TNote
    if (!offlineNote) {
      throw new Error(`[offlineApi.RemoveNote]: Offline note with id "${note.id}" not found in offline data`)
    }

    if (completely) {
      offlineData.notes.splice(offlineData.notes.indexOf(offlineNote), 1)
    } else {
      offlineNote.statusId = StatusesService.inactive.value.id
      offlineNote.updated = new Date().toISOString()
    }

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })

    return Promise.resolve(offlineNote)
  }

  async restoreNote(noteId: number | string) {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject
    const offlineNote = offlineData.notes.find((offlineNote) => offlineNote.id === noteId) as TNote
    if (!offlineNote) {
      throw new Error(`[offlineApi.restoreNoe]: Offline note with id "${noteId}" not found in offline data`)
    }

    offlineNote.statusId = StatusesService.active.value.id
    offlineNote.updated = new Date().toISOString()

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })

    return Promise.resolve(offlineNote)
  }

  async addListItem(listItem: TListItemModel | TListItem): Promise<TListItem> {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject
    const currentDateTime = new Date().toISOString()
    const listItemData = {
      id: Number(listItem.id) || `offline-${new Date().getTime()}`,
      updated: currentDateTime,
      created: currentDateTime,
      text: listItem.text,
      noteId: listItem.noteId,
      checked: listItem.checked,
      order: listItem.order,
      completed: listItem.completed,
      statusId: StatusesService.active.value.id,
      priorityTypeId: listItem.priorityTypeId,
    } as TListItem

    const offlineNote = offlineData.notes.find((offlineNote) => offlineNote.id === listItem.noteId)
    if (!offlineNote) {
      throw new Error(`[offlineApi.addListItem]: Offline note with id "${listItem.noteId}" not found in offline data`)
    }

    if (offlineNote.list) {
      offlineNote.list.push(listItemData)
    }

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })

    return listItemData
  }

  async updateListItem(listItem: TListItemModel | TListItem): Promise<TListItem> {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject

    const offlineNote = offlineData.notes.find((offlineNote) => offlineNote.id === listItem.noteId) as TNoteModel | undefined
    if (!offlineNote) {
      throw new Error(`[offlineApi.updateListItem]: Offline note with id "${listItem.noteId}" not found in offline data`)
    }

    const offlineNoteListItem = offlineNote.list.find((offlineNoteListItem) => offlineNoteListItem.id === listItem.id) as TListItem | undefined
    if (!offlineNoteListItem) {
      throw new Error(`[offlineApi.updateListItem]: Offline note list item with id "${listItem.id}" not found in offline data`)
    }

    Object.assign(offlineNoteListItem, {
      text: listItem.text,
      checked: listItem.checked,
      order: listItem.order,
      updated: new Date().toISOString(),
      completed: listItem.completed,
      priorityTypeId: listItem.priorityTypeId,
    })

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })

    return Promise.resolve(offlineNoteListItem)
  }

  async removeListItem(listItem: TListItemModel | TListItem, completely = false) {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject

    const offlineNote = offlineData.notes.find((offlineNote) => offlineNote.id === listItem.noteId) as TNote | undefined
    if (!offlineNote) {
      throw new Error(`[offlineApi.RemoveListItem]: Offline note with id "${listItem.noteId}" not found in offline data`)
    }

    const offlineNoteListItem = offlineNote.list?.find((offlineNoteListItem) => offlineNoteListItem.id === listItem.id) as TListItem | undefined
    if (!offlineNoteListItem) {
      throw new Error(`[offlineApi.RemoveListItem]: Offline note list item with id "${listItem.noteId}" not found in offline data`)
    }

    if (completely) {
      offlineNote.list?.splice(offlineNote.list.indexOf(offlineNoteListItem), 1)
    } else {
      offlineNoteListItem.statusId = StatusesService.inactive.value.id
      offlineNoteListItem.updated = new Date().toISOString()
    }

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })
  }

  async restoreListItem(noteId: number | string, listItemId: number | string) {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject

    const offlineNote = offlineData.notes.find((offlineNote) => offlineNote.id === noteId) as TNoteModel | undefined
    if (!offlineNote) {
      throw new Error(`[offlineApi.restoreListItem]: Offline note with id "${noteId}" not found in offline data`)
    }

    const offlineNoteListItem = offlineNote.list.find((offlineNoteListItem) => offlineNoteListItem.id === listItemId) as TListItem | undefined
    if (!offlineNoteListItem) {
      throw new Error(`[offlineApi.restoreListItem]: Offline note list item with id "${listItemId}" not found in offline data`)
    }

    offlineNoteListItem.statusId = StatusesService.active.value.id
    offlineNoteListItem.updated = new Date().toISOString()

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })
  }

  async signIn(): Promise<ConfigObject> {
    throw new Error('This action is not available in offline mode')
  }

  async signUp(): Promise<ConfigObject> {
    throw new Error('This action is not available in offline mode')
  }

  async addNoteCoAuthor(): Promise<TCoAuthor> {
    throw new Error('This action is not available in offline mode')
  }

  async removeNoteCoAuthor() {
    throw new Error('This action is not available in offline mode')
  }

  async setListItemsOrder(note: TNoteModel | TNote, order: number[]) {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject
    const offlineNote = offlineData.notes.find((offlineNote) => offlineNote.id === note.id)
    if (!offlineNote) {
      throw new Error(`[offlineApi.setListItemsOrder]: Note with id "${note.id}" not found in offline data`)
    }

    order.forEach(async (listItemId: number, index: number) => {
      const offlineListItem = offlineNote.list?.find((listItem: TListItem) => listItem.id === listItemId)
      if (!offlineListItem) {
        throw new Error(`[offlineApi.setListItemsOrder]: Offline note list item with id "${listItemId}" not found in offline data`)
      }
      offlineListItem.order = index + 1
      offlineListItem.updated = new Date().toISOString()
    })

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })
  }

  async setNotesOrder(order: number[]) {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject

    order.forEach(async (noteId: number, index: number) => {
      const offlineNote = offlineData.notes.find((note) => note.id === noteId)
      if (!offlineNote) {
        throw new Error(`[offlineApi.setNotesOrder]: Offline note list item with id "${noteId}" not found in offline data`)
      }
      offlineNote.order = index + 1
      offlineNote.updated = new Date().toISOString()
    })

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })
  }

  async updateUser() {
    this.checkAuthToken()
    const offlineData = StorageService.get(BaseService.OFFLINE_STORE_NAME) as ConfigObject

    StorageService.set({ [BaseService.OFFLINE_STORE_NAME]: offlineData })
  }
}
