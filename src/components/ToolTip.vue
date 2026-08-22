<template lang="pug">
q-tooltip(
  :anchor="anchor"
  :self="self"
).text-body2
  slot
</template>

<script setup lang="ts">
import type { QTooltipProps } from 'quasar'

defineProps<{
  anchor?: QTooltipProps['anchor']
  self?: QTooltipProps['self']
}>()
</script>
