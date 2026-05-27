<template>
  <q-layout
    class="main-layout"
    view="hHh Lpr fFf"
  >
    <CloudIcon
      v-if="!globalStore.isOnline"
      class="offline-indicator"
    ></CloudIcon>
    <q-page-container v-if="isNoOfflineDataError">
      <div class="offline-data-error q-flex flex-center pa-8">
        <ConnectionErrorDialog
          :model-value="isNoOfflineDataError"
          @hide="handleHideOfflineError"
          message="Looks like there is no Internet here. Wait until server will be online and try again."
          :on-check="handleCheckConnection"
        />
      </div>
    </q-page-container>
    <q-page-container v-else-if="isErrorShown">
      <ErrorPage :error="{ statusCode: globalStore.initError?.statusCode, message: globalStore.initError?.message }"></ErrorPage>
    </q-page-container>
    <q-page-container v-else-if="globalStore.isInitDataLoading">
      <template v-if="$route.name === 'notes'">
        <q-skeleton
          class="bg-grey-3"
          type="rect"
          height="50px"
        ></q-skeleton>
        <div class="column">
          <div class="row pa-4">
            <q-skeleton
              class="note bg-grey-3 ma-2"
              v-for="index in 6"
              :key="index"
              type="rect"
            ></q-skeleton>
          </div>
          <div class="row pa-4">
            <q-skeleton
              class="note bg-grey-3 ma-2"
              v-for="index in 6"
              :key="index"
              type="rect"
            ></q-skeleton>
          </div>
        </div>
      </template>
      <template v-if="['existed-note', 'new-note'].includes(String($route.name))">
        <NotListSkeletons></NotListSkeletons>
      </template>
    </q-page-container>
    <q-page-container
      class="page pa-0"
      v-else
    >
      <router-view
        class="page-content"
        v-slot="{ Component }"
      >
        <transition
          appear
          enter-active-class="animated slideFadeAppear"
        >
          <component :is="Component"></component>
        </transition>
      </router-view>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar'
import { computed, onMounted, ref, watch } from 'vue'
import ConnectionErrorDialog from '~/components/ConnectionErrorDialog.vue'
import NotListSkeletons from '~/components/note/NotListSkeletons.vue'
import ListItemsService from '~/composables/services/list-items'
import NotesService from '~/composables/services/notes'
import BaseService from '~/services/base'
import HealthService from '~/services/health'
import InitService from '~/services/init'
import SyncService from '~/services/sync'
import { useGlobalStore } from '~/stores/global'
import { type TGlobalError } from '~/types'

const $q = useQuasar()

const isNoOfflineDataError = ref(false)
const isErrorShown = ref(false)
const globalStore = useGlobalStore()
let removeTimeout: ReturnType<typeof setTimeout> | null = null
const removedItemsQuantity = computed(() => NotesService.removingNotes.value.length + ListItemsService.removingListItems.value.length)
const removedItemsMessage = computed(() => {
  const notesQuantity = NotesService.removingNotes.value.length
  const listItemsQuantity = ListItemsService.removingListItems.value.length
  const notesMessage = notesQuantity ? `${notesQuantity} note${notesQuantity > 1 ? 's' : ''}` : ''
  const middleWord = notesQuantity && listItemsQuantity ? ' and ' : ''
  const listItemsMessage = listItemsQuantity ? `${listItemsQuantity} list item${listItemsQuantity > 1 ? 's' : ''}` : ''
  return `${notesMessage}${middleWord}${listItemsMessage} removed`
})
let notification: null | ((props: object | undefined) => void) = null
let updateNotification: null | ((props: object | undefined) => void) = null

BaseService.eventBus.on('showGlobalError', (errorObject: TGlobalError) => {
  globalStore.initError = errorObject
  isErrorShown.value = true
})

if (globalStore.initError) {
  isErrorShown.value = true
}

if (globalStore.isNoOfflineDataError) {
  isNoOfflineDataError.value = true
}

function handleHideOfflineError() {
  isNoOfflineDataError.value = false
}

async function handleCheckConnection() {
  try {
    // The dialog is shown precisely when there is no offline blob, so calling
    // synchronizeOfflineData directly would crash on `offlineData.notes`.
    // Re-probe connectivity, then run full init — it knows how to bootstrap
    // from the server when nothing is cached locally.
    await HealthService.check(HealthService.SHORT_TIMEOUT_MS)
    if (globalStore.isOnline) {
      await InitService.initApplication()
      if (!globalStore.isNoOfflineDataError) {
        isNoOfflineDataError.value = false
      }
    }
  } catch (error) {
    BaseService.showError(error as Error)
  }
}

function restoreItems() {
  notification = null
  NotesService.removingNotes.value.forEach((note) => note.restore())
  ListItemsService.removingListItems.value.forEach((listItem) => listItem.restore())
  NotesService.removingNotes.value = []
  ListItemsService.removingListItems.value = []
  if (removeTimeout) {
    clearTimeout(removeTimeout)
  }
}

function handleWindowResize() {
  // Fix 100vh for mobile
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
}

onMounted(() => {
  handleWindowResize()
  window.addEventListener('resize', handleWindowResize)
  setTimeout(() => {
    globalStore.isInitialLoading = false
  }, 1000)

  const $splash = document.getElementById('initial-splash')
  if ($splash) {
    $splash.classList.add('is-hidden')
    setTimeout(() => $splash.remove(), 300)
  }
})

watch(removedItemsQuantity, () => {
  try {
    if (removedItemsQuantity.value) {
      if (!notification) {
        notification = $q.notify({
          group: false, // required to be updatable
          timeout: 0, // we want to be in control when it gets dismissed
          message: removedItemsMessage.value,
          actions: [{ label: 'Restore', color: 'primary', handler: restoreItems }],
        })
      } else {
        notification({
          message: removedItemsMessage.value,
        })
      }

      if (removeTimeout) {
        clearTimeout(removeTimeout)
      }
      removeTimeout = setTimeout(() => {
        if (notification) {
          notification({
            timeout: 1,
            actions: [],
          })
          notification = null
        }
        SyncService.removeRemovedEntities()
      }, 5000)
    } else if (notification) {
      notification({ timeout: 1, actions: [] })
    }
  } catch (error) {
    BaseService.showError(error as Error)
  }
})

watch(
  () => globalStore.initError,
  () => (isErrorShown.value = !!globalStore.initError),
)

watch(
  () => globalStore.isUpdating,
  () => {
    if (globalStore.isUpdating) {
      updateNotification = $q.notify({
        group: false,
        message: 'Updating...',
        textColor: 'primary',
        icon: 'update',
        timeout: 0,
      })
    } else if (updateNotification) {
      updateNotification({
        timeout: 1,
      })
      updateNotification = null
    }
  },
)
</script>

<style lang="scss" scoped>
.offline-data-error {
  height: 100vh;

  .q-card {
    width: 500px;
  }
}

.note {
  min-width: 250px;
  max-width: 300px;
  height: 260px;
  flex: 1;
}

.is-loading-icon {
  position: fixed;
  top: calc(100% - 60px);
  right: 20px;
  z-index: 30;
}

.offline-indicator {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 2000;
}

@media (max-width: 700px) {
  .note {
    min-width: 148px;
  }
}

.page {
  height: 100vh;
  height: calc(var(--vh, 1vh) * 100);

  .page-content {
    position: relative;
  }

  & > div {
    padding-top: 50px;
    overflow-x: hidden;
  }
}
</style>
