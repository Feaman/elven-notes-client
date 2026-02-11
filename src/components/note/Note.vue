<template>
  <div
    v-if="templateNote"
    class="note q-flex column items-center full-height"
  >
    <div class="note__content column no-wrap full-width full-height py-2 px-3">
      <FullScreenView
        @close="emit('fullscreen', false)"
        @list-item-check="templateNote.checkOrUncheckListItem($event, true)"
        @list-item-uncheck="templateNote.checkOrUncheckListItem($event, false)"
        :note="note"
        :show="fullscreen"
      ></FullScreenView>
      <template v-if="!fullscreen">
        <div class="q-flex items-center">
          <q-input
            class="note__title-field mt-1 mb-2"
            v-model="templateNote.title"
            placeholder="Title"
            debounce="400"
            dense
          ></q-input>
          <template v-if="templateNote.type?.name === NOTE_TYPE_LIST && templateNote.list.length">
            <q-btn
              class="note__complete-checked-button text-black"
              @click="templateNote.completeAllChecked()"
              :disabled="!templateNote.checkedListItems.length"
              :icon="mdiCheckAll"
              flat
              round
            >
              <ToolTip>Complete checked items</ToolTip>
            </q-btn>
            <q-btn
              class="ml-1 margin-right-minus-10"
              :icon="mdiDotsVertical"
              flat
              round
            >
              <q-menu auto-close>
                <q-list
                  class="font-size-14"
                  dense
                >
                  <q-item
                    class="pl-1"
                    clickable
                  >
                    <q-item-section>
                      <q-toggle
                        v-model="templateNote.isShowCheckedCheckboxes"
                        label="Show checked checkboxes"
                        color="blue"
                        v-close-popup
                      ></q-toggle>
                    </q-item-section>
                  </q-item>
                  <q-item
                    class="pl-1"
                    clickable
                  >
                    <q-item-section>
                      <q-toggle
                        v-model="templateNote.isCountable"
                        label="Show item settings"
                        color="blue"
                        v-close-popup
                      ></q-toggle>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </template>
        </div>
        <q-input
          class="note__text"
          v-if="templateNote.type?.name === NOTE_TYPE_TEXT"
          v-model="templateNote.text"
          type="textarea"
          debounce="400"
          placeholder="Text"
        ></q-input>
        <template v-else-if="templateNote.type?.name === NOTE_TYPE_LIST">
          <NoteList is-main></NoteList>
          <template v-if="templateNote.completedListItems.length">
            <div
              class="completed-list"
              :style="{ opacity: isListReady ? 1 : 0 }"
            >
              <q-separator class="my-2"></q-separator>
              <q-expansion-item
                header-style="padding-right: 0; padding-left: 8px"
                v-model="templateNote.isCompletedListExpanded"
              >
                <template v-slot:header>
                  <div class="text-green q-flex items-center">
                    <div class="text-weight-bold font-size-16">{{ templateNote.completedListItems.length }}</div>
                    <div class="ml-2">completed</div>
                  </div>
                  <q-space></q-space>
                </template>
                <NoteList v-if="templateNote.isCompletedListExpanded"></NoteList>
              </q-expansion-item>
            </div>
          </template>
        </template>
      </template>
    </div>
    <q-dialog
      v-if="templateNote.userId"
      @close:model-value="emit('hide-authors')"
      @hide="emit('hide-authors')"
      :model-value="showAuthors"
      transition-show="flip-up"
      transition-hide="flip-down"
    >
      <q-card class="note__authors">
        <q-toolbar class="q-flex bg-primary shadow-3">
          <q-toolbar-title class="text-black">Authors</q-toolbar-title>
          <q-space></q-space>
          <q-btn
            @click="emit('hide-authors')"
            :icon="mdiClose"
            color="black"
            flat
            round
            dense
          ></q-btn>
        </q-toolbar>
        <q-card-section class="px-1">
          <q-list>
            <q-item-label
              class="font-size-16 py-0"
              header
              >Author</q-item-label
            >
            <q-item class="py-0">
              <q-item-section>
                <q-item-label>{{ templateNote.user?.getFio() }}</q-item-label>
                <q-item-label caption>{{ templateNote.user?.email }}</q-item-label>
              </q-item-section>
            </q-item>
            <template v-if="templateNote.coAuthors.length">
              <q-item-label
                class="font-size-16 py-0 pt-4"
                header
                >Co-Author{{ templateNote.coAuthors.length > 1 ? 's' : '' }}</q-item-label
              >
              <TransitionGroup
                name="vertical-list"
                tag="div"
                style="position: relative"
              >
                <q-item
                  class="co-author py-0 pr-1"
                  v-for="coAuthor in templateNote.coAuthors"
                  :key="coAuthor.id"
                >
                  <q-item-section>
                    <div class="q-flex items-center">
                      <div>
                        <q-item-label>{{ coAuthor.user.getFio() }}</q-item-label>
                        <q-item-label caption>{{ coAuthor.user.email }}</q-item-label>
                      </div>
                      <q-space></q-space>
                      <q-btn
                        @click="templateNote.removeCoAuthor(coAuthor)"
                        :icon="mdiTrashCanOutline"
                        color="grey"
                        round
                        flat
                      ></q-btn>
                    </div>
                  </q-item-section>
                </q-item>
              </TransitionGroup>
            </template>
          </q-list>
          <div class="q-flex full-width mt-4 pl-4 pr-1">
            <q-input
              class="col"
              @clear="coAuthorError = ''"
              v-model="coAuthorEmail"
              :error-messages="coAuthorError"
              :error="!!coAuthorError"
              :error-message="coAuthorError"
              name="co-author"
              placeholder="Co-author email"
              clearable
              dense
            ></q-input>
            <q-btn
              class="note__add-coauthor-button"
              @click="addCoAuthor()"
              :disabled="!coAuthorEmail"
              :icon="mdiPlus"
              flat
              round
            ></q-btn>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { mdiCheckAll, mdiClose, mdiDotsVertical, mdiPlus, mdiTrashCanOutline } from '@quasar/extras/mdi-v6'
import { nextTick, ref, watch } from 'vue'
import { type TNoteModel } from '~/composables/models/note'
import { TYPE_LIST, TYPE_TEXT } from '~/composables/models/type'
import ListItemsService from '~/composables/services/list-items'
import NotesService from '~/composables/services/notes'

const NOTE_TYPE_LIST = TYPE_LIST
const NOTE_TYPE_TEXT = TYPE_TEXT

const coAuthorEmail = ref('')
const coAuthorError = ref('')
const templateNote = NotesService.currentNote
const note = templateNote as unknown as { value: TNoteModel }
const { isListReady } = ListItemsService

defineProps<{
  fullscreen: boolean
  showAuthors: boolean
}>()

// eslint-disable-next-line
const emit = defineEmits<{
  (event: 'fullscreen', value: boolean): void
  (event: 'is-watch', value: boolean): void
  (event: 'hide-authors'): void
  (event: 'hide'): void
}>()

async function addCoAuthor() {
  try {
    const existedEmail = note.value.coAuthors.find((_coAuthor) => _coAuthor.user.email === coAuthorEmail.value)
    if (existedEmail) {
      coAuthorError.value = 'Co-author with such an email is already exists'
      return
    }
    if (coAuthorEmail.value === note.value.user?.email) {
      coAuthorError.value = 'This person is already an Author'
      return
    }
    await note.value.createCoAuthor(coAuthorEmail.value)
    coAuthorEmail.value = ''
    coAuthorError.value = ''
  } catch (error) {
    coAuthorError.value = (error as { response: { data: { message: string } } })?.response?.data?.message || (error as Error).message
  }
}

watch(
  () => note.value.isShowCheckedCheckboxes,
  async () => {
    await nextTick()
    if (note.value.isCompletedListExpanded) {
      note.value.activeListItems.forEach((listItem) => ListItemsService.handleListItemTextAreaHeight(listItem.getTextarea()))
    } else {
      note.value.mainListItems.forEach((listItem) => ListItemsService.handleListItemTextAreaHeight(listItem.getTextarea()))
    }
  },
)
</script>

<style lang="scss" scoped>
.note {
  .note__content {
    max-width: 900px;
    overflow: auto;
    flex: 1;

    .completed-list {
      transition: opacity 0.1s;
    }

    .margin-right-minus-10 {
      margin-right: -10px;
    }

    .note__title-field {
      width: 100%;
      max-height: 32px;
      position: relative;

      &:after {
        content: '';
        width: 50px;
        height: 40px;
        position: absolute;
        top: 0;
        right: 0;
        background: linear-gradient(to left, #fff 20%, transparent);
      }

      :deep(input) {
        font-weight: bold;
        font-size: 24px;
      }

      :deep(*):before {
        border: none;
      }
    }

    .note__complete-checked-button {
      width: 24px;
      height: 24px;

      &[disabled] {
        opacity: 0.1 !important;
      }
    }

    .note__text {
      height: calc(100% - 45px) !important;

      &:deep(*) {
        height: 100% !important;
      }

      :deep(*):before {
        border: none;
      }

      &:deep(textarea) {
        overflow: auto;
        margin-top: 0 !important;
        resize: none;
        font-size: 16px;
        line-height: 26px;
        padding: 0;
      }
    }

    :deep(.q-item__section--side) {
      padding: 0;
    }

    :deep(.q-focus-helper) {
      display: none;
    }
  }
}

.note__authors {
  max-width: 350px;
  width: 100%;

  .note__add-coauthor-button {
    width: 3em;
    height: 3em;

    &:disabled {
      opacity: 0.2 !important;
    }
  }
}
</style>
