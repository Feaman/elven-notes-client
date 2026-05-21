<template lang="pug">
.user-menu
  q-btn(
    :icon="mdiAccountOutline"
    color="black"
    flat
    round
  )
    q-menu(
      style="width: 220px"
      transition-show="scale"
      transition-hide="jump-left"
    )
      q-list(
        separator
      )
        q-item.shadow-1.pa-0
          .bg-grey-3.px-4.pt-2.pb-2.full-width
            .text-weight-bold {{ globalStore.user?.getFio() }}
            .font-size-14.text-grey-8.text--darken-1 {{globalStore.user?.email }}
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
</template>

<script setup lang="ts">
import { mdiAccountOutline, mdiLogout, mdiTrashCanOutline } from '@quasar/extras/mdi-v6'
import UsersService from '~/composables/services/users'
import InitService from '~/services/init'
import { useGlobalStore } from '~/stores/global'

const globalStore = useGlobalStore()

function signOut() {
  UsersService.signOut()
}

async function clearLocalNotesData() {
  await InitService.clearLocalNotesData()
}
</script>
