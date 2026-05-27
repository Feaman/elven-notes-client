import { TCoAuthor } from '~/composables/models/co-author'
import { TListItemModel, type TListItem } from '~/composables/models/list-item'
import { TNote, TNoteModel } from '~/composables/models/note'
import { useGlobalStore } from '~/stores/global'
import IApi, { ConfigObject } from './interface'
import OfflineApiService from './offline-api'
import OnlineApiService from './online-api'

// Entities created while offline carry a synthetic `offline-<timestamp>` id
// until SyncService promotes them. Calls that target such an id must skip
// the online endpoint — the server doesn't know the synthetic id yet and
// would 404. SyncService handles eventual consistency on the next merge.
function isOfflineId(id?: number | string): boolean {
  return typeof id === 'string' && id.indexOf('offline') === 0
}

export default class ApiService implements IApi {
  onlineApiService

  offlineApiService

  constructor() {
    this.onlineApiService = new OnlineApiService()
    this.offlineApiService = new OfflineApiService()
  }

  async getConfig(): Promise<ConfigObject> {
    if (useGlobalStore().isOnline) {
      return this.onlineApiService.getConfig()
    }

    return this.offlineApiService.getConfig()
  }

  async addNote(
    list: TListItemModel[],
    title: string,
    text: string,
    typeId: number,
    order: number,
    isCompletedListExpanded: boolean,
    isCountable: boolean,
    isShowCheckedCheckboxes: boolean,
    isPrioritySort: boolean,
  ): Promise<TNote> {
    let noteId
    if (useGlobalStore().isOnline) {
      const serverNote = await this.onlineApiService.addNote(
        list,
        title,
        text,
        typeId,
        order,
        isCompletedListExpanded,
        isCountable,
        isShowCheckedCheckboxes,
        isPrioritySort,
      )
      noteId = serverNote.id
    }
    return this.offlineApiService.addNote(
      list,
      title,
      text,
      typeId,
      order,
      isCompletedListExpanded,
      isCountable,
      isShowCheckedCheckboxes,
      isPrioritySort,
      noteId,
    )
  }

  async updateNote(
    id: number | string,
    title: string,
    text: string,
    typeId: number,
    isCompletedListExpanded: boolean,
    isCountable: boolean,
    isShowCheckedCheckboxes: boolean,
    isPrioritySort: boolean,
  ): Promise<TNote> {
    if (useGlobalStore().isOnline && !isOfflineId(id)) {
      await this.onlineApiService.updateNote(
        id,
        title,
        text,
        typeId,
        isCompletedListExpanded,
        isCountable,
        isShowCheckedCheckboxes,
        isPrioritySort,
      )
    }
    return this.offlineApiService.updateNote(
      id,
      title,
      text,
      typeId,
      isCompletedListExpanded,
      isCountable,
      isShowCheckedCheckboxes,
      isPrioritySort,
    )
  }

  async completeNote(id: number | string): Promise<TNote> {
    if (useGlobalStore().isOnline && !isOfflineId(id)) {
      // Server's response is the authoritative list of completed items —
      // another device may have toggled checks that we don't see locally.
      // Mirror that exact state into the offline blob.
      const serverNoteData = await this.onlineApiService.completeNote(id)
      return this.offlineApiService.applyCompletedNote(serverNoteData)
    }
    return this.offlineApiService.completeNote(id)
  }

  async removeNote(note: TNoteModel | TNote) {
    if (useGlobalStore().isOnline && !isOfflineId(note.id)) {
      await this.onlineApiService.removeNote(note)
    }
    return this.offlineApiService.removeNote(note)
  }

  async restoreNote(noteId: number | string) {
    if (useGlobalStore().isOnline && !isOfflineId(noteId)) {
      await this.onlineApiService.restoreNote(noteId)
    }
    return this.offlineApiService.restoreNote(noteId)
  }

  async addListItem(listItem: TListItemModel): Promise<TListItem> {
    if (useGlobalStore().isOnline && !isOfflineId(listItem.noteId)) {
      const serverListItem = await this.onlineApiService.addListItem(listItem)
      listItem.id = serverListItem.id
    }
    return this.offlineApiService.addListItem(listItem)
  }

  async updateListItem(listItem: TListItemModel): Promise<TListItem> {
    if (useGlobalStore().isOnline && !isOfflineId(listItem.id) && !isOfflineId(listItem.noteId)) {
      await this.onlineApiService.updateListItem(listItem)
    }
    return this.offlineApiService.updateListItem(listItem)
  }

  async removeListItem(listItem: TListItemModel | TListItem, completely = false) {
    if (useGlobalStore().isOnline && !isOfflineId(listItem.id) && !isOfflineId(listItem.noteId)) {
      await this.onlineApiService.removeListItem(listItem, completely)
    }

    return this.offlineApiService.removeListItem(listItem, completely)
  }

  async restoreListItem(noteId: number | string, listItemId: number | string) {
    if (useGlobalStore().isOnline && !isOfflineId(noteId) && !isOfflineId(listItemId)) {
      await this.onlineApiService.restoreListItem(noteId, listItemId)
    }

    return this.offlineApiService.restoreListItem(noteId, listItemId)
  }

  async signIn(email: string, password: string): Promise<ConfigObject> {
    if (useGlobalStore().isOnline) {
      return this.onlineApiService.signIn(email, password)
    }
    throw new Error('This action is not available in offline mode')
  }

  async signUp(email: string, password: string, firstName: string, secondName: string): Promise<ConfigObject> {
    if (useGlobalStore().isOnline) {
      return this.onlineApiService.signUp(email, password, firstName, secondName)
    }
    throw new Error('This action is not available in offline mode')
  }

  async addNoteCoAuthor(noteId: number, email: string): Promise<TCoAuthor> {
    if (useGlobalStore().isOnline) {
      return this.onlineApiService.addNoteCoAuthor(noteId, email)
    }
    throw new Error('This action is not available in offline mode')
  }

  async removeNoteCoAuthor(coAuthor: TCoAuthor) {
    if (useGlobalStore().isOnline) {
      return this.onlineApiService.removeNoteCoAuthor(coAuthor)
    }
    throw new Error('This action is not available in offline mode')
  }

  async setListItemsOrder(note: TNoteModel | TNote, order: number[]) {
    if (useGlobalStore().isOnline && !isOfflineId(note.id)) {
      await this.onlineApiService.setListItemsOrder(note, order)
    }
    return this.offlineApiService.setListItemsOrder(note, order)
  }

  async setNotesOrder(order: number[]) {
    if (useGlobalStore().isOnline) {
      await this.onlineApiService.setNotesOrder(order)
    }
    return this.offlineApiService.setNotesOrder(order)
  }

  async updateUser() {
    if (useGlobalStore().isOnline) {
      await this.onlineApiService.updateUser()
    }

    return this.offlineApiService.updateUser()
  }

  async checkStatus(config?: object): Promise<void> {
    return this.onlineApiService.checkStatus(config)
  }
}
