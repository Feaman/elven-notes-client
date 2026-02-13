<template>
  <q-card
    class="note-preview cursor-pointer gradient full-height pa-4 pt-2"
    :id="note.id"
    :class="{ 'with-completed': note.completedListItems.length }"
    :ripple="false"
    tabindex="0"
  >
    <div
      class="text-h6 limit-width"
      v-if="note.title"
    >
      {{ note.title }}
    </div>
    <template v-if="note.type?.name === NOTE_TYPE_LIST">
      <div class="list">
        <div
          class="list-item q-flex items-center mt-1"
          v-for="(listItem, i) in note.mainListItems"
          :key="i"
          :class="{ checked: listItem.checked }"
        >
          <span class="text-grey-8">•</span>
          <div
            class="list-item__text limit-width ml-1"
            :class="{
              'text-grey-8': !listItem.checked,
              'text-grey-5': listItem.checked,
            }"
          >
            {{ listItem.text }}
          </div>
        </div>
      </div>
      <NoteCoAuthors :co-authors="note.coAuthors"></NoteCoAuthors>
      <div
        class="completed-list-header q-flex text-grey-6 full-width mt-2 pl-5"
        v-if="note.completedListItems.length"
      >
        <div class="text-green text-weight-bold">
          {{ note.completedListItems.length }}
        </div>
        <div class="ml-1">completed</div>
      </div>
    </template>
    <div
      class="text column"
      v-else
    >
      <div class="text-grey-8">{{ note.text }}</div>
      <NoteCoAuthors :co-authors="note.coAuthors"></NoteCoAuthors>
    </div>
    <q-btn
      class="remove-button"
      v-if="note.isMyNote"
      @click.stop="$emit('remove')"
      :icon="mdiTrashCanOutline"
      size="12px"
      color="red-3"
      flat
      round
    ></q-btn>
  </q-card>
</template>

<script setup lang="ts">
import { mdiTrashCanOutline } from '@quasar/extras/mdi-v6'
import { type TNoteModel } from '~/composables/models/note'
import { TYPE_LIST } from '~/composables/models/type'
import NoteCoAuthors from './NoteCoAuthors.vue'

defineProps<{
  note: TNoteModel
}>()

const NOTE_TYPE_LIST = TYPE_LIST
</script>

<style lang="scss" scoped>
.note-preview {
  position: relative;
  overflow: hidden;
  background: none;
  transform: scale(1);
  transition: transform 0.3s;

  &:focus {
    outline: none;
    border-radius: 6px;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
    transform: scale(1.05);
  }

  &:before {
    background: none;
  }

  &.gradient:after {
    content: '';
    width: 100%;
    height: 90px;
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 20;
    background: linear-gradient(to top, #fff 24px, transparent);
  }

  &.gradient.with-completed:after {
    background: linear-gradient(to top, #fff 48px, transparent);
  }

  .remove-button {
    position: absolute;
    right: 6px;
    top: 6px;
    background: radial-gradient(#fff 30%, transparent);
  }

  .text {
    height: calc(100% - 16px);
    position: relative;
  }

  .list {
    height: calc(100% - 24px);
    position: relative;
  }

  .list .list-item.checked .list-item__text {
    text-decoration: line-through;
  }

  .completed-list-header {
    position: absolute;
    left: 0;
    bottom: 16px;
    z-index: 30;
  }
}

@media (max-width: 600px) {
  .note-preview {
    padding: 8px 10px 10px 10px;
  }
}
</style>
