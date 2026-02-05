import { TCoAuthor } from '~/composables/models/co-author'
import { TListItemModel, type TListItem } from '~/composables/models/list-item'
import { TNote, TNoteModel } from '~/composables/models/note'
import AxiosApi from '~/services/api/axios-api'
import IApi from '~/services/api/interface'
import { ConfigObject } from './interface'

export default class OnlineApiService implements IApi {
  api: AxiosApi

  static axiosApi: AxiosApi

  constructor() {
    this.api = OnlineApiService.axiosApi
  }

  async getConfig(): Promise<ConfigObject> {
    const { data } = await this.api.get('config')
    return data as ConfigObject
  }

  async addNote(
    list: TListItemModel[] | TListItem[],
    title: string,
    text: string,
    typeId: number,
    order: number,
    isCompletedListExpanded: boolean,
    isCountable: boolean,
    isShowCheckedCheckboxes: boolean,
  ): Promise<TNote> {
    const noteData = {
      title,
      text,
      typeId,
      list: [] as TListItem[],
      order,
      isCompletedListExpanded,
      isCountable,
      isShowCheckedCheckboxes,
    }

    list.forEach((listItem: TListItemModel | TListItem) => noteData.list.push({
      text: listItem.text,
      noteId: listItem.noteId,
      checked: listItem.checked,
      order: listItem.order,
      completed: listItem.completed,
    }))

    const { data } = await this.api.post('notes', noteData)
    return data as TNote
  }

  async updateNote(
    id: number | string,
    title: string,
    text: string,
    typeId: number,
    isCompletedListExpanded: boolean,
    isCountable: boolean,
    isShowCheckedCheckboxes: boolean,
  ): Promise<TNote> {
    const noteData = {
      title,
      text,
      typeId,
      isCompletedListExpanded,
      isShowCheckedCheckboxes,
      isCountable,
    }

    const { data } = await this.api.put(`notes/${id}`, noteData)
    return data as TNote
  }

  async completeNote(id: number | string): Promise<TNote> {
    const { data } = await this.api.put(`notes/complete/${id}`)
    return data as TNote
  }

  async removeNote(note: TNoteModel | TNote) {
    const { data } = await this.api.delete(`notes/${note.id}`)
    return data
  }

  async restoreNote(noteId: number | string) {
    const { data } = await this.api.put(`notes/restore/${noteId}`)
    return data
  }

  async updateListItem(listItem: TListItemModel | TListItem): Promise<TListItem> {
    const listItemData = {
      text: listItem.text,
      checked: listItem.checked,
      order: listItem.order,
      completed: listItem.completed,
    }
    const { data } = await this.api.put(`list-items/${listItem.id}`, listItemData)
    return data as TListItem
  }

  async addListItem(listItem: TListItemModel | TListItem): Promise<TListItem> {
    const listItemData = {
      text: listItem.text,
      noteId: listItem.noteId,
      checked: listItem.checked,
      order: listItem.order,
      completed: listItem.completed,
    }

    const { data } = await this.api.post('list-items', listItemData)
    return data as TListItem
  }

  async removeListItem(listItem: TListItemModel | TListItem, completely = false) {
    const { data } = await this.api.delete(`list-items/${listItem.id}`, { data: { completely } })
    return data
  }

  async restoreListItem(_noteId: number | string, listItemId: number | string) {
    const { data } = await this.api.put(`list-items/restore/${listItemId}`)
    return data
  }

  async signIn(email: string, password: string): Promise<ConfigObject> {
    const { data } = await this.api.post('login', { email, password })
    return data as ConfigObject
  }

  async signUp(email: string, password: string, firstName: string, secondName: string): Promise<ConfigObject> {
    const { data } = await this.api.post('users', {
      email, password, firstName, secondName,
    })
    return data as ConfigObject
  }

  async addNoteCoAuthor(noteId: number, email: string): Promise<TCoAuthor> {
    const { data } = await this.api.post(`notes/${noteId}/co-author`, { email })
    return data as TCoAuthor
  }

  async removeNoteCoAuthor(coAuthor: TCoAuthor) {
    const { data } = await this.api.delete(`notes/co-author/${coAuthor.id}`)
    return data
  }

  async setListItemsOrder(note: TNoteModel | TNote, order: number[]) {
    await this.api.put(`notes/${note.id}/set-order`, { order })
  }

  async setNotesOrder(order: number[]) {
    await this.api.put('notes/set-order', { order })
  }

  async updateUser() {
    const userData = {}
    await this.api.put('users', userData)
  }
}
