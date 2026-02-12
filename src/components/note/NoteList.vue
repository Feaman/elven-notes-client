<template>
  <div
    v-if="templateNote"
    :class="{ 'note-list--focused': templateNote.isFocused, 'note-list--semi-focused': isSemiFocus }"
    class="note-list"
    ref="rootElement"
  >
    <div
      class="note-list__container"
      :class="{ 'pb-3': isMain }"
    >
      <div
        class="note-list__list"
        :style="{ opacity: isListReady ? 1 : 0 }"
      >
        <draggable
          v-model="list"
          :set-data="setDragGhostData"
          :component-data="{ name: drag || globalStore.isInitialLoading ? null : 'vertical-list' }"
          @start="drag = true"
          @end="drag = false"
          tag="transition-group"
          handle=".list-item__handle"
          ghost-class="sortable-ghost"
          item-key="generatedId"
        >
          <template #item="{ element }">
            <div
              class="list-item__container"
              :class="{ 'list-item__container--focused': element.focused }"
            >
              <div
                class="list-item q-flex items-center"
                :class="{ 'list-item--checked': element.checked, 'list-item--completed': element.completed }"
              >
                <q-icon
                  :name="mdiDrag"
                  color="grey"
                  class="list-item__handle"
                  size="sm"
                ></q-icon>
                <input
                  @change="complete($event, element)"
                  :checked="element.completed"
                  class="list-item__checkbox complete-checkbox"
                  type="checkbox"
                />
                <div class="list-item__text q-flex items-center column mx-1 ml-2">
                  <textarea
                    class="full-width transition"
                    @input="updateText(element, $event)"
                    @keydown.enter="selectFocusedVariant($event)"
                    @focus="handleFocus(element)"
                    @blur="templateNote.blurListItem(element)"
                    :value="element.text"
                    :id="element.generateTextareaRefName()"
                  ></textarea>
                </div>
                <q-btn
                  v-if="templateNote.isCountable"
                  @click="showCounterDialog(element)"
                  :icon="mdiCog"
                  :color="getPriorityColor(element)"
                  class="cursor-pointer"
                  size="12px"
                  flat
                  round
                  dense
                />
                <input
                  class="list-item__checkbox mr-1"
                  v-if="templateNote.isShowCheckedCheckboxes"
                  @change="check($event, element)"
                  :checked="element.checked"
                  :class="{ 'ml-9': !element.text }"
                  type="checkbox"
                  color="secondary"
                />
                <q-btn
                  class="list-item__remove-button"
                  @click="templateNote.removeListItem(element)"
                  :icon="mdiTrashCanOutline"
                  color="grey-5"
                  flat
                  round
                ></q-btn>
              </div>
            </div>
          </template>
        </draggable>
      </div>
      <div
        class="note-list__create-button q-flex items-center cursor-text mt-2"
        v-if="props.isMain &amp;&amp; isListReady"
        :class="{ 'note-list__create-button--alone': !list.length }"
        @click="add"
      >
        <q-icon
          color="grey"
          :name="mdiPlus"
          size="sm"
        ></q-icon>
        <div class="text-grey ml-2">Add item</div>
      </div>
    </div>
    <transition
      appear
      enter-active-class="animated zoomIn"
      leave-active-class="animated zoomOut"
    >
      <q-card
        class="note-list__menu shadow-6"
        v-if="isVariantsShown"
        :style="{ maxWidth: `${variantsMenuMaxWidth}px`, top: `${variantsMenuY}px`, left: `${variantsMenuX}px` }"
        ref="variantsElement"
      >
        <q-list
          class="list-item__variants"
          dense
        >
          <q-item
            class="list-item__variant"
            v-for="(variant, index) in variants"
            :key="index"
            :class="{ 'list-item__variant--focused': variant.focused }"
            clickable
            v-ripple
          >
            <q-item-section>
              <div
                class="q-flex items-center full-width py-1"
                @click="selectVariant(variantsListItem, variant)"
              >
                <div
                  class="limit-width font-size-14"
                  v-html="variant.highlightedText"
                ></div>
                <q-space></q-space>
                <div
                  class="text-green font-size-12 ml-2"
                  v-if="variant.isExists"
                >
                  exists
                </div>
                <div
                  class="list-item__variant-info text-red font-size-12 ml-2"
                  v-if="variant.duplicatesQuantity"
                >
                  •&nbsp; {{ variant.duplicatesQuantity }}
                </div>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </transition>

    <q-dialog
      @hide="hideCounterDialog"
      :model-value="isCounterDialogShown"
      :backdrop-filter="'blur(4px) brightness(60%)'"
      transition-show="jump-right"
      transition-hide="jump-left"
    >
      <div
        class="list-item-counter__container text-center full-height q-flex column no-wrap justify-end pa-5 mb-16"
        @click="isCounterDialogShown = false"
      >
        <div class="text-white text-uppercase font-size-16">Click anywhere on the shadow to close the dialog</div>
        <div class="q-space"></div>
        <div
          class="list-item-counter__list-item pa-3 mt-8"
          v-html="counterListItem?.getHighlightedCounterText()"
        ></div>
        <div
          class="d-flex row no-wrap mt-10"
          @click.stop
        >
          <div class="list-item-counter__measurements mt-3 ml-1 text-uppercase">
            <div
              class="list-item-counter__measurement bg-primary px-3 text-center cursor-pointer"
              @click="setCounterMeasurement(COUNTER_MEASUREMENT_PIECES)"
              :class="{ 'list-item-counter--current': counterListItem?.counterMeasurement === COUNTER_MEASUREMENT_PIECES }"
            >
              {{ COUNTER_MEASUREMENT_PIECES }}
            </div>
            <div
              class="list-item-counter__measurement bg-primary px-3 mt-3 text-center cursor-pointer"
              @click="setCounterMeasurement(COUNTER_MEASUREMENT_PACKAGES)"
              :class="{ 'list-item-counter--current': counterListItem?.counterMeasurement === COUNTER_MEASUREMENT_PACKAGES }"
            >
              {{ COUNTER_MEASUREMENT_PACKAGES }}
            </div>
          </div>
          <div class="list-item-counter__numbers row justify-end">
            <div
              class="list-item-counter__quantity bg-primary px-3 mt-3 ml-3 cursor-pointer"
              v-for="(quantity, index) in [1, 2, 3, 4, 5, 6, 7, 8]"
              :key="index"
              @click="setCounterQuantity(quantity)"
              :class="{ 'list-item-counter--current': counterListItem?.counterQuantity === quantity }"
            >
              {{ quantity }}
            </div>
          </div>
        </div>
        <div class="list-item-counter__custom row mt-6">
          <q-input
            class="list-item-counter__custom-input col"
            @click.stop="$event.target.select()"
            v-model="customQuantity"
            type="number"
            dark
            dense
            outlined
          />
          <q-btn
            class="list-item-counter__custom-button bg-primary ml-2"
            @click.stop="setCounterQuantity(Number(customQuantity))"
            icon="check"
            flat
          />
        </div>

        <div class="row justify-between q-mt-md">
          <q-btn
            @click="setPriorityType(priorityLow)"
            :class="{ 'button--active': counterListItem?.priorityTypeId === priorityLow.id }"
            class="button-switch"
            color="green"
            size="14px"
            >{{ priorityLow.title }}</q-btn
          >
          <q-btn
            @click="setPriorityType(priorityMedium)"
            :class="{ 'button--active': counterListItem?.priorityTypeId === priorityMedium.id }"
            class="button-switch q-ml-md"
            color="orange-4"
            size="14px"
            >{{ priorityMedium.title }}</q-btn
          >
          <q-btn
            @click="setPriorityType(priorityHigh)"
            :class="{ 'button--active': counterListItem?.priorityTypeId === priorityHigh.id }"
            class="button-switch q-ml-md"
            color="red"
            size="14px"
            >{{ priorityHigh.title }}</q-btn
          >
        </div>
      </div>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { mdiCog, mdiDrag, mdiPlus, mdiTrashCanOutline } from '@quasar/extras/mdi-v6'
import { QCard } from 'quasar'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import draggable from 'zhyswan-vuedraggable'
import { type TListItemModel, type TVariant, COUNTER_MEASUREMENT_PACKAGES, COUNTER_MEASUREMENT_PIECES } from '~/composables/models/list-item'
import { type TNoteModel } from '~/composables/models/note'
import { TTypeModel } from '~/composables/models/type'
import ListItemsService from '~/composables/services/list-items'
import NotesService from '~/composables/services/notes'
import { priorityHigh, priorityLow, priorityMedium } from '~/composables/services/types'
import KeyboardEvents from '~/helpers/keyboard-events'
import BaseService from '~/services/base'
import { useGlobalStore } from '~/stores/global'

const props = defineProps<{
  isMain?: boolean
}>()

let $root: HTMLElement | null
let focusTimeout: ReturnType<typeof setTimeout> | undefined
const { isListReady } = ListItemsService
const customQuantity = ref('')
const rootElement = ref<HTMLElement | null>(null)
const variants = ref<TVariant[]>([])
const variantsMenuX = ref(0)
const isVariantsShown = ref(false)
const variantsMenuY = ref(0)
const variantsMenuMaxWidth = ref(0)
const variantsListItem = ref<TListItemModel | null>(null)
const templateNote = NotesService.currentNote
const note = templateNote as unknown as { value: TNoteModel }
const globalStore = useGlobalStore()
const isSemiFocus = ref(false)
const variantsElement = ref<QCard | null>(null)
const listItemsToShow = ref(Math.round((window.innerHeight - 140) / ListItemsService.listItemMinHeight))
const fullList = computed(() => (props.isMain ? note.value.mainListItems : note.value.completedListItems))
const counterListItem = ref<TListItemModel | undefined>(undefined)
const isCounterDialogShown = ref(false)
const drag = ref(false)
const list = computed({
  get() {
    if (!props.isMain && listItemsToShow.value < fullList.value.length) {
      return fullList.value.slice(0, listItemsToShow.value)
    }

    return fullList.value
  },
  async set(newList: TListItemModel[]) {
    try {
      let newWholeList = []
      if (props.isMain) {
        newWholeList = [...newList, ...note.value.completedListItems]
      } else {
        newWholeList = [...note.value.mainListItems, ...newList, ...fullList.value.slice(listItemsToShow.value)]
      }
      newWholeList.forEach((listItem, index) => {
        listItem.order = index + 1
      })
      await NotesService.setOrder(
        note.value,
        newWholeList.map((listItem) => Number(listItem.id)),
      )
    } catch (error) {
      BaseService.eventBus.emit('showGlobalError', { statusCode: 500, message: (error as Error).message })
    }
  },
})

isListReady.value = false

async function checkVariants(listItem: TListItemModel) {
  variants.value = NotesService.findListItemVariants(listItem)
  const $textarea = listItem.getTextarea()
  if (variants.value.length && $textarea) {
    variantsListItem.value = listItem
    const boundingBox = $textarea.getBoundingClientRect()
    const menuHeight = variants.value.length * ListItemsService.variantsListItemMinHeight
    await nextTick()
    variantsMenuX.value = boundingBox.x
    variantsMenuY.value = ListItemsService.calculateVariantsMenuYPosition(boundingBox.y, menuHeight, boundingBox.height)
    variantsMenuMaxWidth.value = (rootElement.value?.offsetWidth || 350) - 52
    isVariantsShown.value = true
  } else {
    isVariantsShown.value = false
  }
}

function handleSemiFocus() {
  isSemiFocus.value = false
  if (focusTimeout) {
    clearTimeout(focusTimeout)
  }
  focusTimeout = setTimeout(() => {
    isSemiFocus.value = true
  }, 2000)
}

function handleFocus(listItem: TListItemModel) {
  listItem.focused = true
  isSemiFocus.value = false
  handleSemiFocus()
  if (!listItem.checked && !listItem.completed) {
    checkVariants(listItem)
  }
}

async function add() {
  ListItemsService.addListItem(note.value)
}

function hideVariants(event: Event) {
  if (!variantsElement.value?.$el.contains(event.target as Element)) {
    isVariantsShown.value = false
  }
}

function focusVariant(direction: string) {
  if (variants.value.length) {
    const focusedVariant = variants.value.find((variant) => variant.focused)
    const newVariants = variants.value.map((variant) => ({ ...variant, focused: false }))
    let currentIndex = direction === 'down' ? 0 : newVariants.length - 1
    if (focusedVariant) {
      const adding = direction === 'down' ? 1 : -1
      const currentVariantIndex = variants.value.indexOf(focusedVariant)
      currentIndex = currentVariantIndex + adding
      if (currentIndex < 0) {
        currentIndex = newVariants.length - 1
      } else if (currentIndex > variants.value.length - 1) {
        currentIndex = 0
      }
    }
    newVariants[currentIndex].focused = true
    variants.value = newVariants
  }
}

function handleKeyDown(event: KeyboardEvent) {
  switch (true) {
    case KeyboardEvents.is(event, KeyboardEvents.ARROW_UP):
      focusVariant('up')
      break
    case KeyboardEvents.is(event, KeyboardEvents.ARROW_DOWN):
      focusVariant('down')
      break
  }
}

function loadMore() {
  setTimeout(async () => {
    if (listItemsToShow.value < fullList.value.length) {
      loadMore()
      listItemsToShow.value += 50
      await nextTick()
      ListItemsService.handleTextAreaHeights($root as HTMLDivElement)
    }
  }, 250)
}

function handleWindowResize() {
  setTimeout(() => {
    ListItemsService.handleTextAreaHeights($root as HTMLDivElement)
    isListReady.value = true
  }, 200)
}

async function init() {
  $root = rootElement.value

  window.addEventListener('resize', handleWindowResize)
  document.addEventListener('mousedown', hideVariants)
  BaseService.eventBus.on('keydown', handleKeyDown)

  handleWindowResize()

  list.value.forEach((listItem) => ListItemsService.addTextareaSwipeEvent(note.value, listItem))
  $root?.querySelectorAll('.list-item textarea').forEach(($textarea) => {
    ListItemsService.addTextareaKeydownEvent($textarea as HTMLTextAreaElement, !props.isMain)
  })

  // Load all list if needed
  if (!props.isMain) {
    loadMore()
  }
}

onMounted(init)

onUnmounted(() => {
  document.removeEventListener('mousedown', hideVariants)
  window.removeEventListener('resize', handleWindowResize)
})

function selectFocusedVariant(event: Event) {
  if (variants.value.length) {
    const focusedListItem = list.value.find((item) => item.focused)
    if (!focusedListItem) {
      throw new Error('Focused list item not found')
    }
    const focusedVariant = variants.value.find((variant) => variant.focused)
    if (focusedVariant) {
      selectVariant(focusedListItem, focusedVariant)
      event.preventDefault()
    }
  }
}

function check(event: Event, listItem: TListItemModel) {
  note.value.checkOrUncheckListItem(listItem, (event.target as HTMLInputElement).checked)
}

function complete(event: Event, listItem: TListItemModel) {
  note.value.completeListItem(listItem, (event.target as HTMLInputElement).checked)
}

async function updateText(listItem: TListItemModel, event?: Event) {
  if (event) {
    const $textarea = event.target as HTMLTextAreaElement
    if (listItem.saveTimeout) {
      clearTimeout(listItem.saveTimeout)
    }
    listItem.text = ($textarea as unknown as HTMLTextAreaElement).value
  }
  listItem.saveTimeout = setTimeout(() => {
    note.value.saveListItem(listItem)
    listItem.saveTimeout = undefined
  }, 400)
  handleSemiFocus()
  if (!listItem.checked && !listItem.completed) {
    await checkVariants(listItem)
  }
}

async function selectVariant(listItem: TListItemModel | null, variant: TVariant) {
  if (listItem) {
    note.value.selectVariant(listItem, variant)
    variants.value = []
  }
}

function showCounterDialog(listItem: TListItemModel) {
  counterListItem.value = listItem
  customQuantity.value = String(counterListItem.value?.counterQuantity) || ''
  isCounterDialogShown.value = true
}

function hideCounterDialog() {
  counterListItem.value = undefined
  isCounterDialogShown.value = false
}

function setCounterQuantity(number: number) {
  if (Number.isNaN(number)) {
    return
  }

  if (counterListItem.value) {
    counterListItem.value.counterQuantity = number
    if (counterListItem.value) {
      counterListItem.value.text = `${counterListItem.value.text.substring(0, counterListItem.value.counterIndex)} — ${number}${String(counterListItem.value.counterMeasurement)}`
      updateText(counterListItem.value)
    }
    isCounterDialogShown.value = false
  }
}

function setCounterMeasurement(measurement: string) {
  if (counterListItem.value) {
    counterListItem.value.counterMeasurement = measurement
    if (counterListItem.value.counterQuantity) {
      counterListItem.value.text = `${counterListItem.value.text.substring(0, counterListItem.value.counterIndex)} — ${counterListItem.value.counterQuantity}${measurement}`
      updateText(counterListItem.value)
    }
  }
}

function setDragGhostData(dataTransfer: DataTransfer) {
  dataTransfer.setDragImage(document.createElement('div'), 0, 0)
}

function getPriorityColor(listItem: TListItemModel) {
  if (listItem.priorityTypeId === priorityLow.value.id) {
    return 'green'
  }

  if (listItem.priorityTypeId === priorityMedium.value.id) {
    return 'orange-4'
  }

  if (listItem.priorityTypeId === priorityHigh.value.id) {
    return 'red'
  }

  return 'grey'
}

function setPriorityType(priorityType: TTypeModel) {
  if (counterListItem.value) {
    counterListItem.value.priorityTypeId = priorityType.id
    note.value.saveListItem(counterListItem.value)
  }
}

watch(
  () => isCounterDialogShown.value,
  async () => {
    await nextTick()
    const $element = document.querySelector('.list-item-counter__list-item')
    $element?.scrollTo(0, $element.scrollHeight)
  },
)
</script>

<style lang="scss" scoped>
.note-list {
  position: relative;

  &.note-list--focused {
    .list-item {
      opacity: 0.5;
    }
  }

  &.note-list--semi-focused {
    .list-item {
      opacity: 1;
    }
  }

  .note-list__list {
    transition: opacity 0.1s;

    .sortable-ghost {
      position: relative;
      background-color: #fff;
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
      z-index: 200;
    }

    .list-item__container {
      width: 100%;

      &:not(:last-child) {
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      &.list-item__container--focused {
        .list-item {
          opacity: 1;

          div.list-item__text {
            max-height: 178px;
            overflow: auto;

            &:after {
              display: none;
            }
          }
        }
      }

      .list-item {
        background-color: #fff;
        transition: opacity 0.5s;

        .list-item__handle {
          width: 30px;
          margin-left: -8px;
        }

        &.list-item--checked {
          .list-item__text {
            &:after {
              color: $grey-4;
            }

            textarea {
              color: $grey-4;
              text-decoration: line-through;
              transition: color 0.2s;
            }
          }
        }

        .list-item__checkbox {
          min-width: 20px;
          min-height: 20px;
          color: #f00;
          cursor: pointer;

          &:not(:checked) {
            opacity: 0.3;
          }
        }

        .list-item__text {
          max-height: 78px;
          position: inherit;
          flex: 1;
          position: relative;
          overflow: hidden;
          transition: max-height 0.2s;

          &.list-item__text--multi-line:after {
            content: '...';
            width: 100%;
            height: 18px;
            line-height: 10px;
            position: absolute;
            top: 60px;
            left: 0;
            background: #fff;
            cursor: text;
          }

          textarea {
            height: 36px;
            border: none;
            color: rgba(0, 0, 0, 0.87);
            line-height: 18px;
            padding: 8px 0;
            outline: none;
            resize: none;
            overflow: hidden;

            &.transition {
              transition: height 0.1s;
            }
          }
        }

        .list-item__remove-button {
          min-width: 24px;
          min-height: 24px;
        }
      }
    }
  }

  .note-list__create-button {
    height: 24px;
    position: relative;
    margin-left: 21px;
    transition: opacity 0.3s;

    &.note-list__create-button--alone {
      margin-left: 0;
    }
  }

  .note-list__menu {
    position: absolute;
    z-index: 30;
  }
}

.note-list__menu {
  .list-item__variants {
    .list-item__variant-info {
      min-width: 24px;
    }

    .list-item__variant:not(:last-child) {
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .list-item__variant--focused {
      background-color: rgba(0, 0, 0, 0.1);
    }
  }
}

.list-item-counter__container {
  font-size: 24px;
  width: 310px;
  align-self: end;

  .list-item-counter__list-item {
    overflow: auto;
    background-color: rgba(255, 255, 255, 1);
    border-radius: 6px;
  }

  .list-item-counter__numbers {
    .list-item-counter__quantity {
      height: 36px;
      border-radius: 6px;

      &.list-item-counter--current {
        box-shadow: 0 0 15px #fffe00;
        border: 1px solid #ffffff;
        box-sizing: border-box;
      }
    }
  }

  .list-item-counter__measurement {
    border-radius: 6px;

    &.list-item-counter--current {
      box-shadow: 0 0 15px #fffe00;
      border: 1px solid #ffffff;
      box-sizing: border-box;
    }
  }
}
</style>
