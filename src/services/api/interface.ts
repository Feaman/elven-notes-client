import { TCoAuthor } from '~/composables/models/co-author'
import { TListItemModel, type TListItem } from '~/composables/models/list-item'
import { TNote, TNoteModel } from '~/composables/models/note'
import { IStatus } from '~/composables/models/status'
import { IType } from '~/composables/models/type'
import { TProfileData, TUser } from '~/composables/models/user'

export interface ConfigObject {
  user: TUser,
  types: IType[],
  statuses: IStatus[],
  notes: TNote[],
  token?: string,
}

export default interface IApi {
  getConfig (): Promise<ConfigObject>

  addNote(
    list: TListItemModel[],
    title: string,
    text: string,
    typeId: number,
    order: number,
    isCompletedListExpanded: boolean,
    isCountable: boolean,
    isShowCheckedCheckboxes: boolean,
    isPrioritySort: boolean,
  ): Promise<TNote>

  updateNote(
    id: number,
    title: string,
    text: string,
    typeId: number,
    isCompletedListExpanded: boolean,
    isCountable: boolean,
    isShowCheckedCheckboxes: boolean,
    isPrioritySort: boolean,
  ): Promise<TNote>

  removeNote(note: TNoteModel | TNote): Promise<TNoteModel | TNote>

  restoreNote(noteId: number): Promise<TNoteModel | TNote>

  updateListItem(listItem: TListItemModel): Promise<TListItem>

  addListItem(listItem: TListItemModel): Promise<TListItem>

  removeListItem(listItem: TListItemModel | TListItem, completely: boolean): void

  restoreListItem(noteId: number, listItemId: number): void

  signIn(email: string, password: string): Promise<ConfigObject>

  signUp(email: string, password: string, firstName: string, secondName: string): Promise<ConfigObject>

  addNoteCoAuthor(noteId: number, email: string): Promise<TCoAuthor>

  removeNoteCoAuthor(coAuthor: TCoAuthor): void

  setListItemsOrder(note: TNoteModel, order: number[]): void

  setNotesOrder(order: number[]): void

  updateProfile(profileData: TProfileData): Promise<TUser>
}
