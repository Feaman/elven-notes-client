import { nextTick, ref, UnwrapRef, watch } from 'vue'
import StatusesService from '~/composables/services/statuses'
import BaseService from '~/services/base'
import ListItemsService from '../services/list-items'
import NotesService from '../services/notes'
import { TNoteModel } from './note'
import { TStatusModel } from './status'

const LAST_TEXTAREA = 'LAST_TEXTAREA'
const FIRST_TEXTAREA = 'FIRST_TEXTAREA'

export type TVariant = {
  noteId: number | string
  listItemId: number | string
  text: string
  highlightedText: string
  isExists: boolean
  focused: boolean
  duplicatesQuantity?: number
}

export type TListItem = {
  id?: number | string
  noteId?: number | string
  order?: number
  text?: string | ''
  note?: TNoteModel | undefined
  focused?: boolean
  checked?: boolean
  completed?: boolean
  priorityTypeId?: number
  statusId?: number
  status?: TStatusModel
  created?: string
  updated?: string
}

export const COUNTER_MEASUREMENT_PIECES = 'шт'
export const COUNTER_MEASUREMENT_PACKAGES = 'уп'

export default function listItemModel(listItemData: TListItem) {
  const currentMilliseconds = new Date().getMilliseconds()
  const id = ref(listItemData.id)
  const generatedId = ref(`${currentMilliseconds}-${id.value}`)
  const text = ref(listItemData.text || '')
  const noteId = ref(listItemData.noteId)
  const order = ref(listItemData.order || 0)
  const focused = ref(false)
  const checked = ref(!!listItemData.checked || false)
  const completed = ref(!!listItemData.completed || false)
  const created = ref(listItemData.created ? new Date(listItemData.created) : null)
  const updated = ref(listItemData.updated ? new Date(listItemData.updated) : null)
  const priorityTypeId = ref(listItemData.priorityTypeId)
  const statusId = ref(listItemData.statusId || StatusesService.active.value.id)
  const isCreating = ref(false)
  const isUpdateNeeded = ref(false)
  const counterQuantity = ref<number | undefined>(undefined)
  const counterMeasurement = ref<string | undefined>(undefined)
  const counterIndex = ref<number | undefined>(undefined)
  let saveTimeout: ReturnType<typeof setTimeout> | undefined

  async function restore() {
    try {
      if (id.value) {
        statusId.value = StatusesService.active.value.id
        await BaseService.api.restoreListItem(noteId.value || 0, id.value)
      }
    } catch (error) {
      BaseService.showError(error as Error)
    }
  }

  function generateTextareaRefName() {
    return `textarea-${generatedId.value}`
  }

  function getHighlightedCounterText() {
    if (counterIndex.value && counterIndex.value !== text.value.length) {
      return `${text.value.substring(0, counterIndex.value)}<span style="color: #00ff22;">${text.value.substring(counterIndex.value)}<span>`
    }
    return text.value
  }

  function getTextarea(which = LAST_TEXTAREA) {
    const textAreas = document.querySelectorAll(`textarea[id="${generateTextareaRefName()}"]`)
    return textAreas[which === FIRST_TEXTAREA ? 0 : textAreas.length - 1] as HTMLTextAreaElement
  }

  function handleDataTransformation() {
    created.value = created.value ? new Date(created.value) : new Date()
    updated.value = updated.value ? new Date(updated.value) : new Date()
  }

  function handleCounter() {
    const regExp = new RegExp(`\\s+(-|—)?\\s?(\\d+)\\s*(${COUNTER_MEASUREMENT_PIECES}|${COUNTER_MEASUREMENT_PACKAGES})?\\s*$`, 'i')
    const matches = text.value.match(regExp)
    if (matches) {
      counterQuantity.value = Number(matches[2])
      counterMeasurement.value = matches[3] ? String(matches[3]).toLocaleLowerCase() : COUNTER_MEASUREMENT_PIECES
      counterIndex.value = matches.index
    } else {
      counterMeasurement.value = COUNTER_MEASUREMENT_PIECES
      counterIndex.value = text.value.length
    }
  }

  async function onTextUpdated(which = LAST_TEXTAREA) {
    handleCounter()

    // Handle textarea
    await nextTick()
    const $textArea = getTextarea(which)
    if ($textArea) {
      ListItemsService.handleListItemTextAreaHeight($textArea)
      if (!completed.value && id.value && noteId.value) {
        const note = NotesService.find(noteId.value)
        ListItemsService.addTextareaSwipeEvent(note, note.findListItem(id.value), FIRST_TEXTAREA)
      }
    }
  }

  handleCounter()

  watch(text, () => onTextUpdated())
  watch(completed, () => onTextUpdated(completed.value ? LAST_TEXTAREA : FIRST_TEXTAREA))
  watch(statusId, () => onTextUpdated())

  return {
    id,
    generatedId,
    text,
    noteId,
    order,
    focused,
    checked,
    completed,
    created,
    updated,
    statusId,
    priorityTypeId,
    isCreating,
    isUpdateNeeded,
    saveTimeout,
    counterQuantity,
    counterMeasurement,
    counterIndex,
    getHighlightedCounterText,
    handleDataTransformation,
    restore,
    generateTextareaRefName,
    getTextarea,
  }
}

export type TListItemModel = UnwrapRef<ReturnType<typeof listItemModel>>
