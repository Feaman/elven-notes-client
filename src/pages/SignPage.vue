<template lang="pug">
.sign-page.full-width.full-height(
  v-if="!isTokenExists"
  ref="rootElement"
)
  q-header(
    elevated
  )
    q-toolbar
      h6.text-black.text-weight-bold.text-grey-9.q-ma-none.q-pl-sm ELVEN NOTES
      transition(
        name="scale-fade"
      )
        CloudIcon(
          v-if="!globalStore.isOnline"
        )
  .row.flex-center.full-width.full-height
    .sign-page__container.column.flex-center.full-width.q-px-lg
      h5.full-width.text-left.q-ma-none Sign {{ isSignIn ? 'In' : 'Up' }}
      .full-width(
        :class="`sign-page__sign-${isSignIn ? 'in' : 'up'}-form`"
      )
        transition(
          appear
          enter-active-class="animated slideFadeIn"
          leave-active-class="animated slideFadeOut"
        )
          .sign-page__form(
            v-if="isSignIn"
          )
            q-input.q-mt-lg(
              v-model="email"
              label="Email"
              :maxlength="RULE_1024_LENGTH"
              counter
              clearable
              outlined
              :disable="isLoading"
            )
            q-input.q-mt-lg(
              v-model="password"
              label="Password"
              type="password"
              :maxlength="RULE_155_LENGTH"
              counter
              clearable
              outlined
              :disable="isLoading"
            )
        transition(
          appear
          enter-active-class="animated slideFadeIn"
          leave-active-class="animated slideFadeOut"
        )
          .sign-page__form(
            v-if="!isSignIn"
          )
            q-input.q-mt-lg(
              v-model="email"
              label="Email"
              :maxlength="RULE_155_LENGTH"
              counter
              clearable
              dense
              outlined
              :disable="isLoading"
            )
            q-input.q-mt-lg(
              v-model="password"
              type="password"
              label="Password"
              :maxlength="RULE_155_LENGTH"
              counter
              clearable
              dense
              outlined
              :disable="isLoading"
            )
            q-input.q-mt-lg(
              v-model="firstName"
              label="First Name"
              :maxlength="RULE_155_LENGTH"
              counter
              clearable
              dense
              outlined
              :disable="isLoading"
            )
            q-input.q-mt-lg(
              v-model="secondName"
              label="Second Name"
              :maxlength="RULE_155_LENGTH"
              counter
              clearable
              dense
              outlined
              :disable="isLoading"
            )
      transition(
        appear
        enter-active-class="animated zoomIn"
        leave-active-class="animated zoomOut"
      )
        .text-red(
          v-if="errorText"
        ) {{ errorText }}

      q-btn.text-black.mt-4(
        @click="sign"
        :disable="!isValid || isLoading"
        :loading="isLoading"
        :label="`Sign ${isSignIn ? 'In' : 'Up'}`"
        color="primary"
      )
      .mt-4 OR
      q-btn.mt-2(
        @click="togglePage"
        :disable="isLoading"
        :label="`Sign ${isSignIn ? 'Up' : 'In'}`"
        flat
      )
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import UsersService from '~/composables/services/users'
import KeyboardEvents from '~/helpers/keyboard-events'
import StorageService from '~/services/storage'
import { useGlobalStore } from '~/stores/global'

const isTokenExists = StorageService.get(UsersService.AUTH_TOKEN_NAME)
const router = useRouter()
const globalStore = useGlobalStore()

if (isTokenExists) {
  router.push('/')
}

const RULE_155_LENGTH = 155
const RULE_1024_LENGTH = 1024

const rootElement = ref<HTMLElement | null>(null)

const isSignIn = ref(true)
const email = ref('')
const password = ref('')
const firstName = ref('')
const secondName = ref('')
const isLoading = ref(false)
const errorText = ref('')

function togglePage() {
  errorText.value = ''
  isSignIn.value = !isSignIn.value
}

const isValid = computed(() => {
  const isEmailAndPasswordValid = email.value && email.value.length <= RULE_1024_LENGTH
    && password.value && password.value.length <= RULE_155_LENGTH

  if (isSignIn.value) {
    return isEmailAndPasswordValid
  }

  return isEmailAndPasswordValid && secondName.value && secondName.value.length <= RULE_155_LENGTH
    && password.value && password.value.length <= RULE_155_LENGTH
})

async function sign() {
  if (isValid.value) {
    isLoading.value = true
    try {
      if (isSignIn.value) {
        await UsersService.signIn(email.value, password.value)
      } else {
        await UsersService.register(email.value, password.value, firstName.value, secondName.value)
      }
      router.push('/')
    } catch (error) {
      errorText.value = ((error as { response: { data: { message: string }}}).response?.data?.message) || ((error as Error).message) || 'Unexpected error'
      isLoading.value = false
    }
  }
}

onMounted(() => {
  rootElement.value?.querySelectorAll('input').forEach(($input) => {
    $input.addEventListener('keypress', (event) => {
      if (KeyboardEvents.is(event, KeyboardEvents.ENTER)) {
        sign()
      }
    })
  })
})
</script>

<style lang="scss" scoped>
.sign-page {
  .sign-page__container {
    max-width: 500px;

    .sign-page__sign-in-form,
    .sign-page__sign-up-form {
      position: relative;
    }

    .sign-page__sign-in-form {
      height: 208px;
    }

    .sign-page__sign-up-form {
      height: 336px;
    }

    .sign-page__form {
      max-width: 500px;
      width: 100%;
      position: absolute;
    }
  }
}
</style>
