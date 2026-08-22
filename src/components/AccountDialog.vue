<template lang="pug">
q-dialog(
  @hide="$emit('hide')"
  :model-value="modelValue"
  transition-show="flip-up"
  transition-hide="flip-down"
)
  q-card.account-dialog
    q-toolbar.q-flex.bg-primary.shadow-3
      q-toolbar-title.text-black Account
      q-btn(
        @click="$emit('hide')"
        :icon="mdiClose"
        color="black"
        flat
        round
        dense
      )
    .px-6.pt-4.pb-4
      .text-weight-bold Credentials
      q-input.mt-2(
        v-model="email"
        label="Email"
        :maxlength="EMAIL_MAX_LENGTH"
        :disable="isLoading"
        counter
        clearable
        outlined
        dense
      )
      q-input.mt-2(
        v-model="password"
        :type="isPasswordVisible ? 'text' : 'password'"
        label="Password"
        :maxlength="PASSWORD_MAX_LENGTH"
        hint="Leave empty to keep unchanged"
        :disable="isLoading"
        counter
        clearable
        outlined
        dense
      )
        template(#append)
          q-icon.cursor-pointer(
            @click="isPasswordVisible = !isPasswordVisible"
            :name="isPasswordVisible ? mdiEyeOff : mdiEye"
          )
      .text-weight-bold.mt-4 Personal data
      q-input.mt-2(
        v-model="firstName"
        label="First name"
        :maxlength="NAME_MAX_LENGTH"
        :disable="isLoading"
        counter
        clearable
        outlined
        dense
      )
      q-input.mt-2(
        v-model="secondName"
        label="Last name"
        :maxlength="NAME_MAX_LENGTH"
        :disable="isLoading"
        counter
        clearable
        outlined
        dense
      )
      .q-flex.items-center.mt-2
        UserAvatar.mr-4(
          :user="globalStore.user"
          :image-url="previewImageUrl"
          size="48px"
        )
        .column.items-start
          q-btn(
            @click="pickPhoto()"
            :disable="isLoading || !globalStore.isOnline"
            :label="photoButtonLabel"
            color="amber"
            text-color="black"
            dense
          )
          q-btn(
            v-if="isAvatarRemovalAvailable"
            @click="removePhoto()"
            :disable="isLoading"
            label="Remove photo"
            color="red-4"
            class="q-mt-xs"
            dense
          )
        q-file.hidden(
          ref="photoFilePicker"
          @rejected="handlePhotoRejected"
          @update:model-value="setPhotoFile"
          :model-value="photoFile"
          :max-file-size="PHOTO_INPUT_MAX_FILE_SIZE_BYTES"
          :accept="PHOTO_ACCEPTED_EXTENSIONS"
        )
      .font-size-12.mt-1(
        :class="displayedPhotoHintClass"
      ) {{ displayedPhotoHint }}
      .text-red.mt-4(
        v-if="errorText"
      ) {{ errorText }}
    q-separator
    q-card-actions(
      align="right"
    )
      q-btn(
        @click="save()"
        :disable="!isValid || !globalStore.isOnline"
        :loading="isLoading"
        label="Save"
        color="black"
        flat
      )
        ToolTip(
          v-if="!globalStore.isOnline"
        )
          | {{ OFFLINE_HINT }}
</template>

<script setup lang="ts">
import { mdiClose, mdiEye, mdiEyeOff } from '@quasar/extras/mdi-v6'
import { AxiosError } from 'axios'
import { Notify, QFile } from 'quasar'
import { computed, ref, watch } from 'vue'
import {
  AVATAR_MAX_FILE_SIZE_BYTES, compressAvatarPhoto, EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH,
} from '~/composables/models/user'
import UsersService from '~/composables/services/users'
import BaseService from '~/services/base'
import { useGlobalStore } from '~/stores/global'

const props = defineProps<{
  modelValue: boolean,
}>()

const emit = defineEmits<{
  hide: []
}>()

const PHOTO_ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg'
// The photo is compressed on the client before upload; this guards only against absurdly large originals
const PHOTO_INPUT_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const PHOTO_SIZE_ERROR_NAME = 'max-file-size'
const PHOTO_ACCEPT_ERROR_NAME = 'accept'
const ERROR_PHOTO_TYPE = 'Only PNG and JPEG images are allowed'
const ERROR_PHOTO_PROCESSING = `Failed to process the photo — choose a file up to ${AVATAR_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`
// Profile editing is not queued for offline (a photo file cannot be stored in LocalStorage)
const OFFLINE_HINT = 'Account is not available without a server connection'

const photoHint = `Maximum file size — ${PHOTO_INPUT_MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`

const globalStore = useGlobalStore()

const email = ref('')
const password = ref('')
const isPasswordVisible = ref(false)
const firstName = ref('')
const secondName = ref('')
const photoFilePicker = ref<QFile | null>(null)
const photoFile = ref<File | null>(null)
const photoPreviewUrl = ref('')
const isAvatarRemoved = ref(false)
const photoErrorText = ref('')
const errorText = ref('')
const isLoading = ref(false)

watch(() => props.modelValue, (isShown) => {
  if (isShown) {
    initializeForm()
  }
})

// undefined — show the user's current avatar, '' — initials (photo removed)
const previewImageUrl = computed(() => {
  if (photoPreviewUrl.value) {
    return photoPreviewUrl.value
  }

  return isAvatarRemoved.value ? '' : undefined
})

const isAvatarRemovalAvailable = computed(
  () => !!photoFile.value || (!isAvatarRemoved.value && !!globalStore.user?.avatar),
)

const photoButtonLabel = computed(() => (isAvatarRemovalAvailable.value ? 'Change photo' : 'Choose photo'))

const displayedPhotoHint = computed(() => {
  if (!globalStore.isOnline) {
    return OFFLINE_HINT
  }

  return photoErrorText.value || photoHint
})

const displayedPhotoHintClass = computed(
  () => (globalStore.isOnline && photoErrorText.value ? 'text-red' : 'text-grey-8'),
)

const isValid = computed(() => !!email.value && email.value.length <= EMAIL_MAX_LENGTH
  && password.value.length <= PASSWORD_MAX_LENGTH
  && !!firstName.value && firstName.value.length <= NAME_MAX_LENGTH
  && !!secondName.value && secondName.value.length <= NAME_MAX_LENGTH)

function initializeForm() {
  email.value = globalStore.user?.email || ''
  password.value = ''
  isPasswordVisible.value = false
  firstName.value = globalStore.user?.firstName || ''
  secondName.value = globalStore.user?.secondName || ''
  photoFile.value = null
  photoPreviewUrl.value = ''
  isAvatarRemoved.value = false
  photoErrorText.value = ''
  errorText.value = ''
}

function pickPhoto() {
  photoFilePicker.value?.pickFiles()
}

async function setPhotoFile(file: File | null) {
  photoErrorText.value = ''
  // Picking a new file cancels the requested photo removal
  isAvatarRemoved.value = false

  if (!file) {
    photoFile.value = null
    photoPreviewUrl.value = ''
    return
  }

  let preparedPhotoFile: File
  try {
    preparedPhotoFile = await compressAvatarPhoto(file)
  } catch {
    // The canvas pipeline failed (corrupt or unsupported image) — upload the original if the server accepts its size
    if (file.size > AVATAR_MAX_FILE_SIZE_BYTES) {
      photoFile.value = null
      photoPreviewUrl.value = ''
      photoErrorText.value = ERROR_PHOTO_PROCESSING
      return
    }
    preparedPhotoFile = file
  }

  photoFile.value = preparedPhotoFile
  const photoReader = new FileReader()
  photoReader.readAsDataURL(preparedPhotoFile)
  photoReader.onload = () => {
    photoPreviewUrl.value = photoReader.result as string
  }
}

function removePhoto() {
  photoFile.value = null
  photoPreviewUrl.value = ''
  photoErrorText.value = ''
  isAvatarRemoved.value = true
}

function handlePhotoRejected(rejectedEntries: { failedPropValidation: string }[]) {
  const errorName = rejectedEntries[0]?.failedPropValidation
  if (errorName === PHOTO_SIZE_ERROR_NAME) {
    photoErrorText.value = photoHint
  } else if (errorName === PHOTO_ACCEPT_ERROR_NAME) {
    photoErrorText.value = ERROR_PHOTO_TYPE
  }
}

async function save() {
  isLoading.value = true
  errorText.value = ''
  try {
    await UsersService.updateProfile({
      email: email.value,
      password: password.value || '',
      firstName: firstName.value,
      secondName: secondName.value,
      photoFile: photoFile.value,
      isAvatarRemoved: isAvatarRemoved.value,
    })
    // Same style as the «Updating...» toast in MainLayout: bottom position, dark background, yellow text
    Notify.create({
      message: 'Account saved',
      textColor: 'primary',
      icon: 'check',
      timeout: 2000,
    })
    emit('hide')
  } catch (error) {
    errorText.value = BaseService.parseAxiosError(error as AxiosError).message
  } finally {
    isLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.account-dialog {
  max-width: 350px;
  width: 100%;
}
</style>
