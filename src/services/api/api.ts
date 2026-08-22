import { TCoAuthor } from '~/composables/models/co-author'
import { TListItemModel, type TListItem } from '~/composables/models/list-item'
import { TNote, TNoteModel } from '~/composables/models/note'
import { TProfileData, TUser } from '~/composables/models/user'
import { useGlobalStore } from '~/stores/global'
import BaseService from '~/services/base'
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

  // Attempt an online API call with automatic fallback to offline mode on network failure.
  // Returns undefined if network error occurs; all other errors are re-thrown.
  // Note: If network fails during the call, the operation may be partially applied.
  // The offline layer always executes after this to ensure eventual consistency.
  private async tryOnlineCall<T>(onlineCall: () => Promise<T>): Promise<T | undefined> {
    try {
      return await onlineCall()
    } catch (error) {
      if (!BaseService.isNetworkError(error)) throw error
      useGlobalStore().isOnline = false
      return undefined
    }
  }

  async getConfig(): Promise<ConfigObject> {
    if (useGlobalStore().isOnline) {
      return this.onlineApiService.getConfig()
    }

    return this.offlineApiService.getConfig()
  }

  // Creates stay online-first (unlike updates): the server id must be obtained
  // and stamped onto the offline record atomically. Writing locally first with a
  // synthetic `offline-*` id would risk a focus re-sync racing in before the id
  // is promoted and creating the entity on the server a second time (duplicate).
  // Offline durability is still covered: on a network failure tryOnlineCall
  // returns undefined and the offline write below proceeds with an `offline-*`
  // id, which SyncService promotes on the next merge.
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
      const serverNote = await this.tryOnlineCall(() => this.onlineApiService.addNote(
        list,
        title,
        text,
        typeId,
        order,
        isCompletedListExpanded,
        isCountable,
        isShowCheckedCheckboxes,
        isPrioritySort,
      ))
      noteId = serverNote?.id
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
    // Offline-first: persist locally first (synchronous, stamped with the
    // current time) so the offline blob is immediately the up-to-date source of
    // truth. A background re-sync that races this edit then compares against
    // fresh local data and keeps it (last-write-wins) instead of clobbering an
    // edit still in flight to the server. The server write follows.
    const offlineNote = await this.offlineApiService.updateNote(
      id,
      title,
      text,
      typeId,
      isCompletedListExpanded,
      isCountable,
      isShowCheckedCheckboxes,
      isPrioritySort,
    )
    if (useGlobalStore().isOnline && !isOfflineId(id)) {
      await this.tryOnlineCall(() => this.onlineApiService.updateNote(
        id,
        title,
        text,
        typeId,
        isCompletedListExpanded,
        isCountable,
        isShowCheckedCheckboxes,
        isPrioritySort,
      ))
    }
    return offlineNote
  }

  async completeNote(id: number | string): Promise<TNote> {
    // Offline-first: complete locally first so the UI updates instantly and the
    // change survives a server failure. The server write follows.
    const offlineNote = await this.offlineApiService.completeNote(id)
    if (useGlobalStore().isOnline && !isOfflineId(id)) {
      // The server's response is the authoritative list of completed items —
      // another device may have toggled checks we don't see locally — so apply
      // that exact state over the local blob once we have it.
      const serverNoteData = await this.tryOnlineCall(() => this.onlineApiService.completeNote(id))
      if (serverNoteData) {
        return this.offlineApiService.applyCompletedNote(serverNoteData)
      }
    }
    return offlineNote
  }

  async removeNote(note: TNoteModel | TNote) {
    // Offline-first: apply the change locally first, then to the server.
    const offlineNote = await this.offlineApiService.removeNote(note)
    if (useGlobalStore().isOnline && !isOfflineId(note.id)) {
      await this.tryOnlineCall(() => this.onlineApiService.removeNote(note))
    }
    return offlineNote
  }

  async restoreNote(noteId: number | string) {
    // Offline-first: apply the change locally first, then to the server.
    const offlineNote = await this.offlineApiService.restoreNote(noteId)
    if (useGlobalStore().isOnline && !isOfflineId(noteId)) {
      await this.tryOnlineCall(() => this.onlineApiService.restoreNote(noteId))
    }
    return offlineNote
  }

  // Online-first for the same reason as addNote (atomic server id; avoids
  // duplicate creation on a racing re-sync).
  async addListItem(listItem: TListItemModel): Promise<TListItem> {
    if (useGlobalStore().isOnline && !isOfflineId(listItem.noteId)) {
      const serverListItem = await this.tryOnlineCall(() => this.onlineApiService.addListItem(listItem))
      if (serverListItem) {
        listItem.id = serverListItem.id
      }
    }
    return this.offlineApiService.addListItem(listItem)
  }

  async updateListItem(listItem: TListItemModel): Promise<TListItem> {
    // Offline-first (see updateNote): the local write goes first so a racing
    // re-sync compares against fresh local data instead of overwriting it.
    const offlineListItem = await this.offlineApiService.updateListItem(listItem)
    if (useGlobalStore().isOnline && !isOfflineId(listItem.id) && !isOfflineId(listItem.noteId)) {
      await this.tryOnlineCall(() => this.onlineApiService.updateListItem(listItem))
    }
    return offlineListItem
  }

  async removeListItem(listItem: TListItemModel | TListItem, completely = false) {
    // Offline-first: apply the change locally first, then to the server.
    await this.offlineApiService.removeListItem(listItem, completely)
    if (useGlobalStore().isOnline && !isOfflineId(listItem.id) && !isOfflineId(listItem.noteId)) {
      await this.tryOnlineCall(() => this.onlineApiService.removeListItem(listItem, completely))
    }
  }

  async restoreListItem(noteId: number | string, listItemId: number | string) {
    // Offline-first: apply the change locally first, then to the server.
    await this.offlineApiService.restoreListItem(noteId, listItemId)
    if (useGlobalStore().isOnline && !isOfflineId(noteId) && !isOfflineId(listItemId)) {
      await this.tryOnlineCall(() => this.onlineApiService.restoreListItem(noteId, listItemId))
    }
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
    // Offline-first: apply the change locally first, then to the server.
    await this.offlineApiService.setListItemsOrder(note, order)
    if (useGlobalStore().isOnline && !isOfflineId(note.id)) {
      await this.tryOnlineCall(() => this.onlineApiService.setListItemsOrder(note, order))
    }
  }

  async setNotesOrder(order: number[]) {
    // Offline-first: apply the change locally first, then to the server.
    await this.offlineApiService.setNotesOrder(order)
    if (useGlobalStore().isOnline) {
      await this.tryOnlineCall(() => this.onlineApiService.setNotesOrder(order))
    }
  }

  // Online-only (в отличие от прочих мутаций): файл фото нельзя положить в LocalStorage-очередь,
  // поэтому профиль не пишется в offline-блоб до подтверждения сервером. После успешного ответа
  // подтверждённые данные (включая серверный путь аватарки) освежают пользователя в offline-блобе.
  async updateProfile(profileData: TProfileData): Promise<TUser> {
    if (!useGlobalStore().isOnline) {
      throw new Error('This action is not available in offline mode')
    }

    const userData = await this.onlineApiService.updateProfile(profileData)
    this.offlineApiService.setUser(userData)
    return userData
  }

  async checkStatus(config?: object): Promise<void> {
    return this.onlineApiService.checkStatus(config)
  }
}
