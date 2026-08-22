<template lang="pug">
q-avatar.non-selectable(
  :size="size"
  color="purple"
  text-color="white"
)
  img(
    v-if="displayedImageUrl && !isImageLoadFailed"
    @error="isImageLoadFailed = true"
    :src="displayedImageUrl"
    alt="Avatar"
  )
  div(
    v-else
  ) {{ initials }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TUserModel } from '~/composables/models/user'

// imageUrl: undefined — show the user's avatar, '' — force initials (photo removed)
const props = defineProps<{
  user: TUserModel | null,
  size: string,
  imageUrl?: string,
}>()

// The photo may fail to load (offline, file deleted) — then initials are shown instead of a broken image
const isImageLoadFailed = ref(false)

const displayedImageUrl = computed(() => (props.imageUrl !== undefined ? props.imageUrl : props.user?.getAvatarUrl() || ''))

const initials = computed(() => props.user?.getInitials() || '')

watch(displayedImageUrl, () => {
  isImageLoadFailed.value = false
})
</script>
