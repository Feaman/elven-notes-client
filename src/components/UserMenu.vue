<template lang="pug">
.user-menu
  q-btn(
    color="black"
    flat
    round
  )
    UserAvatar(
      v-if="globalStore.user"
      :user="globalStore.user"
      size="32px"
    )
    q-icon(
      v-else
      :name="mdiAccountOutline"
    )
    q-menu(
      style="width: 220px"
      transition-show="scale"
      transition-hide="jump-left"
    )
      q-list(
        separator
      )
        q-item.shadow-1.pa-0(
          @click="showAccountDialog()"
          clickable
          v-close-popup
        )
          .user-menu__account.bg-grey-3.px-4.pt-3.pb-3.full-width.column.items-center
            UserAvatar(
              :user="globalStore.user"
              size="72px"
            )
            .text-weight-bold.mt-2 {{ globalStore.user?.getFio() }}
            .font-size-14.text-grey-8.text--darken-1 {{ globalStore.user?.email }}
        q-item(
          @click="showAccountDialog()"
          clickable
          v-close-popup
        )
          q-item-section
            .q-flex.items-center
              q-icon(
                :name="mdiAccountOutline"
                color="black"
              )
              .cursor-pointer.py-1.ml-2 Account
        q-item.bg-light-blue-1(
          @click="clearLocalNotesData()"
          clickable
        )
          q-item-section
            .q-flex.items-center
              q-icon(
                :name="mdiTrashCanOutline"
                color="black"
              )
              .cursor-pointer.py-1.ml-2 Update local data
        q-item(
          @click="signOut()"
          clickable
        )
          q-item-section
            .q-flex.items-center
              q-icon(
                :name="mdiLogout"
                color="black"
              )
              .cursor-pointer.py-1.ml-2 Sign out
  AccountDialog(
    @hide="isAccountDialogShown = false"
    :model-value="isAccountDialogShown"
  )
</template>

<script setup lang="ts">
import { mdiAccountOutline, mdiLogout, mdiTrashCanOutline } from '@quasar/extras/mdi-v6'
import { ref } from 'vue'
import UsersService from '~/composables/services/users'
import InitService from '~/services/init'
import { useGlobalStore } from '~/stores/global'

const globalStore = useGlobalStore()

const isAccountDialogShown = ref(false)

function showAccountDialog() {
  isAccountDialogShown.value = true
}

function signOut() {
  UsersService.signOut()
}

async function clearLocalNotesData() {
  await InitService.clearLocalNotesData()
}
</script>
