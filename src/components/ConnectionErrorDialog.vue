<template lang="pug">
q-dialog(
  @hide="$emit('hide')"
  :model-value="modelValue"
  transition-show="flip-up"
  transition-hide="flip-down"
)
  q-card
    q-toolbar.q-flex.bg-primary.shadow-3
      q-toolbar-title.ml-2
        .q-flex.items-center
          q-icon(
            :name="mdiAlertDecagram"
            size="sm"
            color="red"
          )
          .font-size-18.ml-2 Connection error
      q-btn(
        @click="$emit('hide')"
        :icon="mdiClose"
        color="black"
        flat
        round
        dense
      )
    .pa-6
      .font-size-18.mb-4 {{ message }}
      q-btn(
        outline
        color="primary"
        label="Check connection"
        @click="handleCheck"
        :loading="isChecking"
      )
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { mdiAlertDecagram, mdiClose } from '@quasar/extras/mdi-v6'

const props = defineProps<{
  modelValue: boolean
  message: string
  onCheck:() => Promise<void>
}>()

defineEmits<{
  hide: []
}>()

const isChecking = ref(false)

async function handleCheck() {
  isChecking.value = true
  try {
    await props.onCheck()
  } finally {
    isChecking.value = false
  }
}
</script>

<style lang="scss" scoped>
</style>
