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

  ConnectionErrorDialog(
    :model-value="showDialog"
    @hide="showDialog = false"
    message="Seems like there is no Internet here. The application is working offline."
    :on-check="handleCheckConnection"
  )
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  mdiAlertDecagram,
  mdiCloudUploadOutline,
  mdiCloudCheckOutline,
  mdiCloudSyncOutline,
} from '@quasar/extras/mdi-v6'
import ConnectionErrorDialog from '~/components/ConnectionErrorDialog.vue'
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

  showDialog.value = true
  isChecking.value = true
  try {
    await HealthService.check(HealthService.LONG_TIMEOUT_MS)
  } finally {
    isChecking.value = false
  }
}

async function handleCheckConnection() {
  isChecking.value = true
  try {
    await HealthService.check(HealthService.LONG_TIMEOUT_MS)
  } finally {
    isChecking.value = false
  }

  if (store.isOnline) {
    showDialog.value = false
  }
}
</script>

<style lang="scss" scoped>

</style>
