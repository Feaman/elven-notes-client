import { Ref, computed, nextTick, ref } from 'vue'
import listItemModel, { TListItemModel, type TVariant } from '~/composables/models/list-item'
import noteModel, { TNote, TNoteModel } from '~/composables/models/note'
import StatusesService from '~/composables/services/statuses'
import BaseService from '~/services/base'
import ListItemsService from '../services/list-items'

const currentNote: Ref<TNoteModel | null> = ref(null)
const notes: Ref<TNoteModel[]> = ref([])
const removingNotes = ref<TNoteModel[]>([])
export const searchQuery = ref('')

function isInFlightEntity(entity: { id?: number | string, isCreating?: boolean }) {
  return entity.id === undefined || entity.isCreating === true
}

function generateNotes(notesData: TNote[]) {
  // Update existing notes
  notesData.forEach((noteData: TNote) => {
    const existingNote = notes.value.find((_note) => _note.id === noteData.id)
    if (existingNote) {
      // Suppress field watchers (which would otherwise echo the same data
      // back to the server via save) while we merge the server snapshot.
      // Reset on nextTick so any async watchers scheduled by these
      // assignments see the flag as still true and skip themselves.
      existingNote.isRawUpdate = true
      existingNote.title = noteData.title || ''
      existingNote.text = noteData.text || ''
      if (noteData.typeId !== undefined) {
        existingNote.typeId = noteData.typeId
      }
      if (noteData.statusId !== undefined) {
        existingNote.statusId = noteData.statusId
      }
      existingNote.order = noteData.order
      existingNote.isCompletedListExpanded = !!noteData.isCompletedListExpanded
      existingNote.isCountable = !!noteData.isCountable
      existingNote.isShowCheckedCheckboxes = !!noteData.isShowCheckedCheckboxes
      existingNote.isPrioritySort = !!noteData.isPrioritySort
      if (noteData.updated) {
        existingNote.updated = new Date(noteData.updated)
      }
      nextTick(() => {
        existingNote.isRawUpdate = false
      })

      // Update existing list items / append new ones
      const newListItemsData = noteData.list || []
      newListItemsData.forEach((newListItemData) => {
        const existingListItem = existingNote.list.find((_listItem) => _listItem.id === newListItemData.id)
        if (existingListItem) {
          existingListItem.text = newListItemData.text || ''
          existingListItem.order = newListItemData.order || 0
          existingListItem.checked = !!newListItemData.checked
          existingListItem.completed = !!newListItemData.completed
          existingListItem.priorityTypeId = newListItemData.priorityTypeId
          if (newListItemData.statusId !== undefined) {
            existingListItem.statusId = newListItemData.statusId
          }
          if (newListItemData.updated) {
            existingListItem.updated = new Date(newListItemData.updated)
          }
        } else {
          const newListItem = listItemModel(newListItemData) as unknown as TListItemModel
          existingNote.list.push(newListItem)
          setTimeout(() => {
            ListItemsService.handleListItemTextAreaHeight(newListItem.getTextarea())
          })
        }
      })

      // Remove removed list items (keep in-flight items not yet confirmed by server,
      // otherwise typing into a brand-new item races with sync and throws "listItem not found")
      existingNote.list = existingNote.list.filter((listItem) =>
        isInFlightEntity(listItem)
        || newListItemsData.find((newListItemData) => newListItemData.id === listItem.id))
    } else {
      const newNote = noteModel(noteData)
      notes.value.push(newNote as unknown as TNoteModel)
    }
  })

  // Remove removed notes (keep in-flight notes that haven't been confirmed by server yet)
  notes.value = notes.value.filter((note) =>
    isInFlightEntity(note)
    || notesData.find((_note) => _note.id === note.id))
}

async function setNotesOrder(order: number[]) {
  try {
    await BaseService.api.setNotesOrder(order)
  } catch (error) {
    BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
  }
}

const filtered = computed({
  get() {
    const resultNotes = notes.value.filter((note) => note.statusId === StatusesService.active.value.id)

    resultNotes.sort((previousItem, nextItem) => ((previousItem.order || previousItem.id || 0) < (nextItem.order || nextItem.id || 0) ? -1 : 1))

    if (!searchQuery.value) {
      return resultNotes
    }

    return resultNotes.filter((note: TNoteModel) => {
      const regExp = new RegExp(searchQuery.value.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')
      let foundInLisListItems = false
      note.list.forEach((listItem) => {
        if (regExp.test(listItem.text || '')) {
          foundInLisListItems = true
        }
      })
      return regExp.test(note.title || '') || regExp.test(note.text || '') || foundInLisListItems
    })
  },
  set(newList) {
    newList.forEach((note, index) => {
      note.order = index + 1
    })
    setNotesOrder(newList.map((note) => Number(note.id)))
  },
})

function findNoteListItemVariants(note: TNoteModel, variants: TVariant[], listItem: TListItemModel, query: string) {
  note.list
    .filter((_listItem) => _listItem !== listItem && _listItem.statusId !== StatusesService.inactive.value.id)
    .forEach((_listItem) => {
      if (
        _listItem.text.toLowerCase().includes(query)
        && !variants.find((variant) => variant.listItemId === _listItem.id)
      ) {
        const isExists = listItem.noteId === note.id && !_listItem.completed
        const text = _listItem.text.trim()
        variants.push({
          noteId: Number(_listItem.noteId),
          listItemId: Number(_listItem.id),
          text,
          highlightedText: text,
          isExists,
          focused: false,
        })
      }
    })
}

function findListItemVariants(listItem: TListItemModel) {
  const variants: TVariant[] = []
  const query = listItem.text.toLocaleLowerCase()

  if (query.length > 1) {
    notes.value.forEach((note) => {
      if (note.isList) {
        findNoteListItemVariants(note, variants, listItem, query)
      }
    })
  }

  // Sort
  variants.sort((previousItem, nextItem) => {
    if (previousItem.text === nextItem.text) {
      return 0
    }
    return previousItem.text > nextItem.text ? -1 : 1
  })

  // Duplicates
  const currentNoteVariants = variants.filter((variant) => variant.noteId === listItem.noteId)
  currentNoteVariants.forEach((variant) => {
    const duplicates = currentNoteVariants.filter((_element) => (
      variant.listItemId !== _element.listItemId
      && _element.text.toLowerCase() === variant.text.toLowerCase()
    ))
    variant.duplicatesQuantity = duplicates.length
  })

  // Unique
  let resultVariants: TVariant[] = []
  const resultVariantsObject: { [key: string]: TVariant } = {}
  variants
    .reduce((accumulator: TVariant[], item: TVariant) => {
      if (item.noteId === listItem.noteId) {
        return [...accumulator, item]
      }
      return [item, ...accumulator]
    }, [])
    .forEach((variant) => {
      resultVariantsObject[variant.text.toLowerCase()] = variant
    })
  resultVariants = Object.values(resultVariantsObject)

  // Highlight
  const regexp = new RegExp(query.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')
  resultVariants.forEach((variant) => {
    variant.highlightedText = variant.text.replace(regexp, (text: string) => `<span class="text-green">${text}</span>`)
  })

  if (
    resultVariants.length === 1
    && resultVariants[0].text === listItem.text
    && resultVariants[0].noteId !== listItem.noteId
  ) {
    return []
  }

  return resultVariants.slice(0, 15)
}

async function setListItemsOrder(note: TNoteModel, order: number[]) {
  await BaseService.api.setListItemsOrder(note, order)
}

function generateMaxOrder() {
  let order = 0
  if (notes.value.length) {
    const numbers = notes.value.map((note) => note.order)
    order = Math.max(...numbers)
  }

  return order + 1
}

async function removeNote(note: TNoteModel) {
  note.statusId = StatusesService.inactive.value.id
  removingNotes.value.push(note as unknown as TNoteModel)
  await BaseService.api.removeNote(note)
}

function find(noteId: number | string) {
  const note = notes.value.find((note) => note.id === noteId)
  if (!note) {
    throw new Error(`Note width id "${noteId}" not found`)
  }
  return note
}

export default {
  currentNote,
  notes,
  filtered,
  searchQuery,
  removingNotes,
  find,
  generateMaxOrder,
  generateNotes,
  findNoteListItemVariants,
  setOrder: setListItemsOrder,
  findListItemVariants,
  removeNote,
}
