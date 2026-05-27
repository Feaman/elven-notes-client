<template lang="pug">
.cloud-icon.row.flex-center
  q-btn(
    @click="handleClick"
    :icon="icon"
    :color="isSocketError || !store.isOnline ? 'red' : 'black'"
    flat
    round
  )
    ToolTip {{ tooltipText }}

  q-dialog(
    @hide="showDialog = false"
    :model-value="showDialog"
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
          @click="showDialog = false"
          :icon="mdiClose"
          color="black"
          flat
          round
          dense
        )
      .pa-6
        .font-size-18 Seems like there is no Internet here. The application is working offline.
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  mdiAlertDecagram,
  mdiCloudUploadOutline,
  mdiCloudCheckOutline,
  mdiCloudSyncOutline,
  mdiClose,
} from '@quasar/extras/mdi-v6'
import { type TNoteModel } from '~/composables/models/note'
import HealthService from '~/services/health'
import { useGlobalStore } from '~/stores/global'

const props = defineProps<{
  note?: TNoteModel,
}>()

const store = useGlobalStore()
const showDialog = ref(false)
const isChecking = ref(false)
const isSocketError = computed(() => store.isSocketError === true)
const icon = computed(() => {
  if (isChecking.value) {
    return mdiCloudSyncOutline
  }

  if (isSocketError.value || !store.isOnline) {
    return mdiAlertDecagram
  }

  return props.note?.isSaving ? mdiCloudUploadOutline : mdiCloudCheckOutline
})
const tooltipText = computed(() => {
  if (isChecking.value) {
    return 'Checking connection...'
  }

  if (isSocketError.value || !store.isOnline) {
    return 'Connection error, click to retry.'
  }

  return props.note?.isSaving ? 'Saving to cloud' : 'Saved to cloud'
})

async function handleClick() {
  if (isChecking.value) {
    return
  }

  if (!isSocketError.value && store.isOnline) {
    return
  }

  isChecking.value = true
  try {
    await HealthService.check(HealthService.LONG_TIMEOUT_MS)
  } finally {
    isChecking.value = false
  }

  if (!store.isOnline) {
    showDialog.value = true
  }
}
</script>

<style lang="scss" scoped>

</style>
