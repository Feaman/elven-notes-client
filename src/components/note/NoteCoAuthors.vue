<template lang="pug">
.note-co-authors.q-flex.justify-end.full-width
  .co-authors.q-flex.justify-end
    UserAvatar(
      v-for="(coAuthor, index) in coAuthors"
      :key="coAuthor.id"
      :class="{ 'ml-2': index > 0 }"
      :user="coAuthor.user"
      size="20px"
    )
</template>

<script setup lang="ts">
import type { TCoAuthorModel } from '~/composables/models/co-author'

defineProps<{
  coAuthors: TCoAuthorModel[],
}>()
</script>

<style lang="scss" scoped>
.note-co-authors {
  position: absolute;
  bottom: 20px;
  right: 16px;

  .co-authors {
    position: relative;
    overflow: hidden;
    z-index: 30;
  }

  .co-authors:after {
    content: '';
    width: 100%;
    height: 20px;
    position: absolute;
    bottom: 0;
    left: 0;
    z-index: 20;
    background: linear-gradient(to left, transparent, #fff 25px);
  }

  @media (max-width: 700px) {
    .co-authors {
      display: none !important;
    }
  }
}
</style>
