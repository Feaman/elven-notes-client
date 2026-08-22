<template lang="pug">
q-dialog(
  @hide="$emit('hide')"
  :model-value="modelValue"
  transition-show="flip-up"
  transition-hide="flip-down"
)
  q-card.account-dialog
    q-toolbar.q-flex.bg-primary.shadow-3
      q-toolbar-title.text-black Учётная запись
      q-btn(
        @click="$emit('hide')"
        :icon="mdiClose"
        color="black"
        flat
        round
        dense
      )
    .px-6.pt-4.pb-4
      .text-weight-bold Учётные данные
      q-input.mt-2(
        v-model="email"
        label="Электропочта"
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
        label="Пароль"
        :maxlength="PASSWORD_MAX_LENGTH"
        hint="Оставьте пустым, чтобы не менять"
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
      .text-weight-bold.mt-4 Персональные данные
      q-input.mt-2(
        v-model="firstName"
        label="Имя"
        :maxlength="NAME_MAX_LENGTH"
        :disable="isLoading"
        counter
        clearable
        outlined
        dense
      )
      q-input.mt-2(
        v-model="secondName"
        label="Фамилия"
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
            label="Убрать фото"
            color="red-4"
            class="q-mt-xs"
            dense
          )
        q-file.hidden(
          ref="photoFilePicker"
          @rejected="handlePhotoRejected"
          @update:model-value="setPhotoFile"
          :model-value="photoFile"
          :max-file-size="AVATAR_MAX_FILE_SIZE_BYTES"
          :accept="PHOTO_ACCEPTED_EXTENSIONS"
        )
      .font-size-12.mt-1(
        :class="displayedPhotoHintClass"
      ) {{ displayedPhotoHint }}
      .text-red.mt-4(
        v-if="errorText"
      ) {{ errorText }}
    .q-flex.bg-primary
      q-btn.col(
        @click="$emit('hide')"
        :icon="mdiChevronDown"
        color="black"
        size="18px"
        square
        flat
      )
      q-separator(
        vertical
      )
      q-btn.account-dialog__save-button(
        @click="save()"
        :disable="!isValid || !globalStore.isOnline"
        :loading="isLoading"
        :icon="mdiContentSaveOutline"
        color="black"
        size="18px"
        square
        flat
      )
        ToolTip
          | {{ globalStore.isOnline ? 'Сохранить' : OFFLINE_HINT }}
</template>

<script setup lang="ts">
import { mdiChevronDown, mdiClose, mdiContentSaveOutline, mdiEye, mdiEyeOff } from '@quasar/extras/mdi-v6'
import { AxiosError } from 'axios'
import { Notify, QFile } from 'quasar'
import { computed, ref, watch } from 'vue'
import {
  AVATAR_MAX_FILE_SIZE_BYTES, EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH,
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
const PHOTO_SIZE_ERROR_NAME = 'max-file-size'
const PHOTO_ACCEPT_ERROR_NAME = 'accept'
const ERROR_PHOTO_TYPE = 'Допустимы только изображения PNG и JPEG'
// Правка профиля не кладётся в offline-очередь (файл фото в LocalStorage не сохранить)
const OFFLINE_HINT = 'Учётная запись недоступна без соединения с сервером'

const photoHint = `Максимальный размер файла — ${AVATAR_MAX_FILE_SIZE_BYTES / 1024 / 1024} МБ`

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

// undefined — показать текущую аватарку пользователя, '' — инициалы (фото убрано)
const previewImageUrl = computed(() => {
  if (photoPreviewUrl.value) {
    return photoPreviewUrl.value
  }

  return isAvatarRemoved.value ? '' : undefined
})

const isAvatarRemovalAvailable = computed(
  () => !!photoFile.value || (!isAvatarRemoved.value && !!globalStore.user?.avatar),
)

const photoButtonLabel = computed(() => (isAvatarRemovalAvailable.value ? 'Изменить фото' : 'Выбрать фото'))

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

function setPhotoFile(file: File | null) {
  photoFile.value = file
  photoErrorText.value = ''
  // Выбор нового файла отменяет запрошенное удаление фото
  isAvatarRemoved.value = false

  if (!file) {
    photoPreviewUrl.value = ''
    return
  }

  const photoReader = new FileReader()
  photoReader.readAsDataURL(file)
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
    // Тот же стиль, что у тоста «Updating...» в MainLayout: снизу, тёмный фон, жёлтый текст
    Notify.create({
      message: 'Учётная запись сохранена',
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

  .account-dialog__save-button {
    width: 3em;
  }
}
</style>
