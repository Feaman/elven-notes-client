import { nextTick, ref } from 'vue'
import listItemModel, { TListItem, TListItemModel } from '~/composables/models/list-item'
import { type TNoteModel } from '~/composables/models/note'
import NotesService from '~/composables/services/notes'
import StatusesService from '~/composables/services/statuses'
import KeyboardEvents from '~/helpers/keyboard-events'
import SwipeEvents, { LEFT_SWIPE_WIDTH } from '~/helpers/swipe-events'
import { priorityLow } from './types'

const removingListItems = ref<TListItemModel[]>([])
const listItemMinHeight = 36
const variantsListItemMinHeight = 34
const isMainListReady = ref(false)

function handleListItemTextAreaHeight($textArea: HTMLTextAreaElement) {
  let textAreaHeight = 0
  const $parent = $textArea.parentElement
  $parent?.classList.remove('list-item__text--multi-line')
  $textArea.classList.remove('transition')
  $textArea.style.height = '0'
  $textArea.style.minHeight = '0'
  textAreaHeight = $textArea.scrollHeight
  $textArea.style.height = `${textAreaHeight}px`
  $textArea.style.minHeight = `${textAreaHeight}px`

  if (textAreaHeight > 64) {
    $parent?.classList.add('list-item__text--multi-line')
  }
}

function handleTextAreaHeights($container: HTMLDivElement) {
  Array.from($container.querySelectorAll('textarea[id]')).forEach(($textarea) => {
    handleListItemTextAreaHeight($textarea as HTMLTextAreaElement)
  })
}

function filterCompleted(note: TNoteModel) {
  return note.list.filter((listItem) => listItem.completed && listItem.statusId === StatusesService.active.value.id)
}

function focusListItem(index: number, isCompletedList: boolean) {
  const note = NotesService.currentNote.value as unknown as TNoteModel
  const list = note.filterAndSort(isCompletedList)
  const nextListItem = list[index]
  nextListItem.focused = true
  nextListItem.getTextarea().focus()
}

function focusNextItem(event: KeyboardEvent, isCompletedList: boolean) {
  const note = NotesService.currentNote.value as unknown as TNoteModel
  const list = note.filterAndSort(isCompletedList)
  const focusedListItem = list.find((item) => item.focused)
  if (focusedListItem) {
    const focusedItemIndex = list.indexOf(focusedListItem)
    if (focusedItemIndex === list.length - 1) {
      addListItem(note)
    } else {
      focusListItem(focusedItemIndex + 1, isCompletedList)
    }
  }
  event.preventDefault()
}

async function addListItem(note: TNoteModel, data: TListItem | undefined = undefined) {
  const listItem = listItemModel({
    updated: String(new Date()),
    statusId: StatusesService.active.value.id,
    priorityTypeId: priorityLow.value.id,
    text: '',
    order: note.list.length ? Math.max(...note.list.map((listItem) => listItem.order)) + 1 : 1,
    ...(data || {}),
  })
  note.addListItem(listItem as unknown as TListItemModel)
  const unRefListItem = note.list.find((_listItem) => _listItem.generatedId === listItem.generatedId.value)

  if (!unRefListItem) {
    throw new Error('List item to unref not found')
  }

  if (!data) {
    await note.saveListItem(unRefListItem as unknown as TListItemModel)
  }

  // Handle textarea events
  await nextTick()
  const $textarea = listItem.getTextarea()
  addTextareaSwipeEvent(note, unRefListItem as unknown as TListItemModel)
  addTextareaKeydownEvent($textarea, unRefListItem.completed)
  if (!data) {
    $textarea.focus()
  }

  return listItem
}

function addTextareaKeydownEvent($textarea: HTMLTextAreaElement, isCompletedList: boolean) {
  $textarea.onkeydown = (event: KeyboardEvent) => {
    if (KeyboardEvents.is(event, KeyboardEvents.ENTER, false, true)) {
      focusNextItem(event, isCompletedList)
    }
    if (KeyboardEvents.is(event, KeyboardEvents.ENTER, false, false, true)) {
      focusNextItem(event, isCompletedList)
    }
  }
}

function calculateVariantsMenuYPosition(yPosition: number, menuHeight: number, elementHeight: number) {
  const headerHeight = 50
  const offset = 8
  const $noteContent = document.querySelector('.note__content')
  const scrollTop = $noteContent ? $noteContent.scrollTop - elementHeight * 1.5 : 0
  yPosition += scrollTop - headerHeight
  if (yPosition > menuHeight) {
    return yPosition - menuHeight
  }
  return headerHeight + offset
}

function addTextareaSwipeEvent(note: TNoteModel, listItem: TListItemModel, whichTextarea?: string) {
  const $textarea = listItem.getTextarea(whichTextarea)
  const swiper = new SwipeEvents($textarea)
  swiper.onMove = (xDiff: number, yDiff: number) => {
    if (Math.abs(yDiff) > 60) {
      if (listItem.checked) {
        $textarea.classList.add('text-strike')
        $textarea.classList.remove('text-decoration-none')
        $textarea.classList.remove('text-black')
      } else {
        $textarea.style.opacity = '1'
        $textarea.classList.remove('text-strike')
      }
      return
    }
    if (!listItem.checked && xDiff > 0) {
      if (xDiff >= LEFT_SWIPE_WIDTH) {
        $textarea.classList.add('text-strike')
      } else {
        $textarea.style.opacity = `${10 / xDiff}`
        $textarea.classList.remove('text-strike')
      }
    }
    if (listItem.checked && xDiff < 0) {
      if (xDiff <= -LEFT_SWIPE_WIDTH) {
        $textarea.classList.add('text-decoration-none')
        $textarea.classList.add('text-black')
      } else {
        $textarea.classList.remove('text-decoration-none')
        $textarea.classList.remove('text-black')
      }
    }
  }
  swiper.onEnd = (xDiff: number, yDiff: number) => {
    if (Math.abs(yDiff) < 60) {
      if (!listItem.checked) {
        $textarea.style.opacity = '1'
        $textarea.classList.remove('text-strike')
        if (xDiff > LEFT_SWIPE_WIDTH) {
          note.checkOrUncheckListItem(listItem, true)
        }
      } else if (xDiff < -LEFT_SWIPE_WIDTH) {
        $textarea.classList.remove('text-decoration-none')
        $textarea.classList.remove('text-black')
        note.checkOrUncheckListItem(listItem, false)
      }
    }
  }
}

function generateMaxOrder(listItemId: number, list: TListItemModel[]) {
  let order = 0
  if (list.length) {
    const numbers = list.filter((_listItem) => _listItem.id !== listItemId).map((listItem) => listItem.order)
    order = Math.max(...numbers)
  }

  return order + 1
}

export default {
  listItemMinHeight,
  removingListItems,
  variantsListItemMinHeight,
  isListReady: isMainListReady,
  focusNextItem,
  generateMaxOrder,
  addTextareaSwipeEvent,
  calculateVariantsMenuYPosition,
  handleTextAreaHeights,
  handleListItemTextAreaHeight,
  filterCompleted,
  addListItem,
  addTextareaKeydownEvent,
}
