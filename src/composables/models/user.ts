import { ref, UnwrapRef } from 'vue'
import BaseService from '~/services/base'

export const EMAIL_MAX_LENGTH = 1024
export const PASSWORD_MAX_LENGTH = 155
export const NAME_MAX_LENGTH = 155
export const AVATAR_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
// Значение флага isAvatarRemoved в FormData профиля (сервер сравнивает с ним же)
export const AVATAR_REMOVED_FLAG = '1'

export type TUser = {
  id: number,
  firstName: string,
  secondName: string,
  email: string,
  avatar: string,
}

export type TProfileData = {
  email: string,
  password: string,
  firstName: string,
  secondName: string,
  photoFile: File | null,
  isAvatarRemoved: boolean,
}

export default function userModel(userData: TUser) {
  const id = ref(userData.id)
  const firstName = ref(userData.firstName)
  const secondName = ref(userData.secondName)
  const email = ref(userData.email)
  // Fallback на пустую строку: offline-блоб, записанный до появления аватарок, поля не содержит
  const avatar = ref(userData.avatar || '')

  function getFio() {
    return `${secondName.value} ${firstName.value}`
  }

  function getInitials() {
    return `${secondName.value.charAt(0).toUpperCase()}${firstName.value.charAt(0).toUpperCase()}`
  }

  function getAvatarUrl() {
    return avatar.value ? BaseService.getFileUrl(avatar.value) : ''
  }

  return {
    id, firstName, secondName, email, avatar, getFio, getInitials, getAvatarUrl,
  }
}

export type TUserModel = UnwrapRef<ReturnType<typeof userModel>>
