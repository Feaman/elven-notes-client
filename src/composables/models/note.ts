import { computed, Ref, ref, UnwrapRef, watch } from 'vue'
import coAuthorModel, { TCoAuthor, TCoAuthorModel } from '~/composables/models/co-author'
import listItemModel, { TListItem, TListItemModel, type TVariant } from '~/composables/models/list-item'
import { TStatusModel } from '~/composables/models/status'
import { TYPE_LIST, type TTypeModel } from '~/composables/models/type'
import userModel, { TUser, TUserModel } from '~/composables/models/user'
import ListItemsService from '~/composables/services/list-items'
import NotesService from '~/composables/services/notes'
import StatusesService from '~/composables/services/statuses'
import TypesService from '~/composables/services/types'
import OfflineApiService from '~/services/api/offline-api'
import BaseService from '~/services/base'
import { useGlobalStore } from '~/stores/global'

export type TNote = {
  id?: number | string
  title?: string | ''
  text?: string | ''
  type?: TTypeModel
  typeId?: number
  statusId?: number
  status?: TStatusModel
  userId?: number
  user?: TUser
  order: number
  isCompletedListExpanded?: boolean
  isCountable?: boolean
  isShowCheckedCheckboxes?: boolean
  list?: TListItem[]
  coAuthors?: TCoAuthor[]
  created?: string
  updated?: string
  isRawUpdate?: boolean
  isLocalModel?: boolean
}

export default function noteModel(noteData: TNote) {
  const id = ref(noteData.id)
  const isSaving = ref(false)
  const title = ref(noteData.title || '')
  const userId = ref(noteData.userId)
  const order = ref(noteData.order)
  const text = ref(noteData.text || '')
  const typeId = ref(noteData.typeId || TypesService.list.value.id)
  const type = computed(() => TypesService.findById(typeId.value))
  const created = ref(noteData.created ? new Date(noteData.created) : null)
  const updated = ref(noteData.updated ? new Date(noteData.updated) : null)
  const statusId = ref(noteData.statusId || StatusesService.active.value.id)
  const status = computed(() => StatusesService.findById(statusId.value))
  const list: Ref<TListItemModel[]> = ref([])
  const coAuthors = ref<TCoAuthorModel[]>([])
  const user = ref<TUserModel | null>(null)
  const isCompletedListExpanded = ref(!!noteData.isCompletedListExpanded)
  const isCountable = ref(!!noteData.isCountable)
  const isShowCheckedCheckboxes = ref(!!noteData.isShowCheckedCheckboxes)
  const isCreating = ref(false)
  const isUpdateNeeded = ref(false)
  const unSavedListItems = ref<TListItemModel[]>([])
  const isList = computed(() => type.value?.name === TYPE_LIST)
  const isRawUpdate = ref(false)
  const isLocalModel = ref(!!noteData.isLocalModel)

  const globalStore = useGlobalStore()

  function handleList(listData: TListItem[] = []) {
    listData.forEach((listItemData) => list.value.push(listItemModel(listItemData) as unknown as TListItemModel))
  }

  function handleUser(userData: TUser | undefined) {
    if (userData) {
      user.value = userModel(userData) as unknown as TUserModel
    }
  }

  function handleCoAuthors(coAuthorsData: TCoAuthor[] = []) {
    coAuthorsData.forEach((coAuthorData) => coAuthors.value.push(coAuthorModel(coAuthorData) as unknown as TCoAuthorModel))
  }

  async function handleListItem(listItem: TListItemModel) {
    listItem.noteId = id.value
    const data = await BaseService.api.addListItem(listItem)
    listItem.id = data.id
    listItem.handleDataTransformation()
    listItem.isCreating = false
    if (listItem.isUpdateNeeded) {
      const data = await BaseService.api.updateListItem(listItem)
      listItem.updated = new Date(data.updated || '')
      listItem.isUpdateNeeded = false
    }
  }

  async function save() {
    try {
      isSaving.value = true
      if (id.value) {
        await BaseService.api.updateNote(id.value, title.value.trim(), text.value.trim(), typeId.value, isCompletedListExpanded.value, isCountable.value, isShowCheckedCheckboxes.value)
      } else if (isCreating.value) {
        isUpdateNeeded.value = true
      } else {
        isCreating.value = true
        const noteData = await BaseService.api.addNote(list.value, title.value.trim(), text.value.trim(), typeId.value, order.value, isCompletedListExpanded.value, isCountable.value, isShowCheckedCheckboxes.value)
        id.value = noteData.id
        userId.value = noteData.user?.id
        isCreating.value = false
        if (isUpdateNeeded.value && id.value) {
          await BaseService.api.updateNote(id.value, title.value.trim(), text.value.trim(), typeId.value, isCompletedListExpanded.value, isCountable.value, isShowCheckedCheckboxes.value)
          isUpdateNeeded.value = false
        }
        unSavedListItems.value.forEach((listItem) => handleListItem(listItem))
        BaseService.router.push(`/note/${noteData.id}`)
      }
      isSaving.value = false
    } catch (error) {
      BaseService.showError(error as Error)
    }
  }

  function addListItem(listItem: TListItemModel) {
    listItem.noteId = id.value
    list.value.push(listItem as unknown as TListItemModel)
  }

  async function saveListItem(listItem: TListItemModel) {
    try {
      if (!list.value.includes(listItem)) {
        debugger
        throw new Error(`List item with id "${listItem.id}" doesn't exists in note "${id.value}" list`)
      }
      isSaving.value = true
      if (listItem.id) {
        const data = await BaseService.api.updateListItem(listItem)
        listItem.id = data.id
        listItem.updated = new Date(data.updated || '')
      } else if (listItem.isCreating) {
        listItem.isUpdateNeeded = true
      } else {
        listItem.isCreating = true
        if (!id.value) {
          if (!isCreating.value) {
            await save()
          }
          unSavedListItems.value.push(listItem)
        } else {
          await handleListItem(listItem)
        }
      }
      isSaving.value = false
    } catch (error) {
      BaseService.showError(error as Error)
    }
  }

  async function restore() {
    try {
      if (id.value) {
        statusId.value = StatusesService.active.value.id
        await BaseService.api.restoreNote(id.value)
      }
    } catch (error) {
      BaseService.showError(error as Error)
    }
  }

  const isMyNote = computed(() => globalStore.user?.id === userId.value)

  const isFocused = computed(() => !!list.value.find((listItem) => listItem.focused))

  function filterAndSort(completed = false) {
    return list.value
      .filter((listItem) => (completed ? listItem.completed : !listItem.completed) && listItem.statusId === StatusesService.active.value.id)
      .sort((previousItem, nextItem) => ((previousItem.order || 0) < (nextItem.order || 0) ? -1 : 1))
      .sort((previousItem, nextItem) => {
        if (previousItem.checked === nextItem.checked) {
          return 0
        }
        return previousItem.checked ? 1 : -1
      })
  }

  const checkedListItems = computed(() => list.value.filter((listItem) => listItem.checked && !listItem.completed && listItem.statusId === StatusesService.active.value.id)) as Ref<TListItemModel[]>

  const mainListItems = computed(() => filterAndSort()) as Ref<TListItemModel[]>

  const completedListItems = computed(() => filterAndSort(true)) as Ref<TListItemModel[]>
  const activeListItems = computed(() => list.value.filter((listItem) => listItem.statusId === StatusesService.active.value.id))

  function addCoAuthor(coAuthor: TCoAuthorModel) {
    coAuthors.value.push(coAuthor)
  }

  async function createCoAuthor(email: string) {
    const noteCoAuthorData = await BaseService.api.addNoteCoAuthor(Number(id.value), email)
    addCoAuthor(coAuthorModel(noteCoAuthorData) as unknown as TCoAuthorModel)
  }

  async function removeCoAuthor(coAuthor: TCoAuthorModel) {
    try {
      if (userId.value !== globalStore.user?.id) {
        NotesService.notes.value = NotesService.notes.value.filter((note) => note.id !== id.value)
        BaseService.router.push('/')
      } else {
        coAuthors.value = coAuthors.value.filter((_coAuthor) => _coAuthor.id !== coAuthor.id)
      }
      await BaseService.api.removeNoteCoAuthor(coAuthor)
    } catch (error) {
      BaseService.showError(error as Error)
    }
  }

  function removeListItemSoft(item: TListItemModel) {
    list.value = list.value.filter((_item) => _item.id !== item.id)
  }

  async function removeListItem(listItem: TListItemModel, addToRestore = true) {
    if (listItem.id) {
      listItem.statusId = StatusesService.inactive.value.id
      if (addToRestore) {
        ListItemsService.removingListItems.value.push(listItem as unknown as TListItemModel)
      }
      await BaseService.api.removeListItem(listItem, !addToRestore)
    }
  }

  function completeListItem(listItem: TListItemModel, isCompleted: boolean) {
    listItem.completed = isCompleted
    listItem.order = ListItemsService.generateMaxOrder(Number(id.value), list.value)
    saveListItem(listItem)
  }

  async function completeAllChecked() {
    if (id.value) {
      list.value.forEach((listItem: TListItemModel) => {
        if (!listItem.completed && listItem.checked) {
          listItem.completed = true
        }
      })
      const noteData = await BaseService.api.completeNote(id.value)
      noteData.list?.forEach((listItem) => {
        listItem.completed = true
      })

      // Change offline note
      const offlineApi = new OfflineApiService()
      await offlineApi.completeNote(Number(noteData.id))
    }
  }

  function blurListItem(listItem: TListItemModel) {
    listItem.focused = false
    if (listItem.text !== listItem.text.trim()) {
      listItem.text = listItem.text.trim()
    }
    const $textArea = listItem.getTextarea()
    if ($textArea && $textArea.parentElement) {
      $textArea.parentElement.scrollTop = 0
    }
  }

  function selectVariant(listItem: TListItemModel, variant: TVariant) {
    if (variant.noteId === listItem.noteId && variant.listItemId !== listItem.id) {
      const existentListItem = list.value.find((listItem: TListItemModel) => listItem.id === variant.listItemId)
      if (!existentListItem) {
        throw new Error('List item not found')
      }
      existentListItem.completed = false
      existentListItem.checked = false
      existentListItem.order = listItem.order
      saveListItem(existentListItem)
      removeListItem(listItem, false)
      return existentListItem
    }

    listItem.text = variant.text
    saveListItem(listItem)

    return listItem
  }

  function checkOrUncheckListItem(listItem: TListItemModel, isChecked: boolean) {
    listItem.checked = isChecked
    saveListItem(listItem)
  }

  function updateOnChange(callback: () => void) {
    if (!isRawUpdate.value) {
      callback()
    }
  }

  function handleDataTransformation(userData?: TUser, coAuthorsData?: TCoAuthor[]) {
    created.value = created.value ? new Date(created.value) : new Date()
    updated.value = updated.value ? new Date(updated.value) : new Date()

    if (userData) {
      handleUser(userData)
    }

    if (coAuthorsData) {
      coAuthors.value = []
      coAuthorsData.forEach((coAuthorData) => coAuthors.value.push(coAuthorModel(coAuthorData) as unknown as TCoAuthorModel))
    }
  }

  function findListItem(listItemId: number | string) {
    const listItem = list.value.find((listItem) => listItem.id === listItemId)
    if (!listItem) {
      throw new Error(`listItem width id "${listItemId}" not found`)
    }
    return listItem
  }

  handleList(noteData.list)
  handleCoAuthors(noteData.coAuthors)
  handleUser(noteData.user)

  watch(title, () => updateOnChange(save))
  watch(text, () => updateOnChange(save))
  watch(isCompletedListExpanded, () => updateOnChange(save))
  watch(isCountable, () => updateOnChange(save))
  watch(isShowCheckedCheckboxes, () => updateOnChange(save))
  watch(isRawUpdate, (value) => (isRawUpdate.value = value))

  return {
    id,
    title,
    userId,
    text,
    typeId,
    type,
    created,
    updated,
    statusId,
    list,
    status,
    isCompletedListExpanded,
    coAuthors,
    completedListItems,
    mainListItems,
    isMyNote,
    isSaving,
    checkedListItems,
    isFocused,
    isCreating,
    isUpdateNeeded,
    user,
    isList,
    order,
    isRawUpdate,
    activeListItems,
    isLocalModel,
    isCountable,
    isShowCheckedCheckboxes,
    filterAndSort,
    checkOrUncheckListItem,
    addCoAuthor,
    createCoAuthor,
    removeCoAuthor,
    save,
    completeListItem,
    removeListItemSoft,
    handleList,
    handleCoAuthors,
    completeAllChecked,
    saveListItem,
    removeListItem,
    findListItem,
    addListItem,
    selectVariant,
    blurListItem,
    restore,
    handleDataTransformation,
  }
}

export type TNoteModel = UnwrapRef<ReturnType<typeof noteModel>>
