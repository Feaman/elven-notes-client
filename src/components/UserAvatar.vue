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
    alt="Аватарка"
  )
  div(
    v-else
  ) {{ initials }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TUserModel } from '~/composables/models/user'

// imageUrl: undefined — показывать аватарку пользователя, '' — принудительно инициалы (фото убрано)
const props = defineProps<{
  user: TUserModel | null,
  size: string,
  imageUrl?: string,
}>()

// Фото может не загрузиться (offline, файл удалён) — тогда показываются инициалы вместо сломанной картинки
const isImageLoadFailed = ref(false)

const displayedImageUrl = computed(() => (props.imageUrl !== undefined ? props.imageUrl : props.user?.getAvatarUrl() || ''))

const initials = computed(() => props.user?.getInitials() || '')

watch(displayedImageUrl, () => {
  isImageLoadFailed.value = false
})
</script>
