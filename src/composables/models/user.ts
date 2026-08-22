import { ref, UnwrapRef } from 'vue'
import BaseService from '~/services/base'

export const EMAIL_MAX_LENGTH = 1024
export const PASSWORD_MAX_LENGTH = 155
export const NAME_MAX_LENGTH = 155
// Mirrors the server's upload limit; after client-side compression it is only a fallback-path guard
export const AVATAR_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
// Value of the isAvatarRemoved flag in the profile FormData (the server compares against the same value)
export const AVATAR_REMOVED_FLAG = '1'

const AVATAR_PHOTO_MAX_SIDE_PIXELS = 1024
const AVATAR_PHOTO_JPEG_QUALITY = 0.85
const AVATAR_PHOTO_BACKGROUND_COLOR = '#ffffff'
const AVATAR_PHOTO_FILE_NAME = 'avatar.jpg'
const AVATAR_PHOTO_MIME_TYPE = 'image/jpeg'

// Downscales the picked photo before upload (the server stores only a 512px copy anyway), so the result
// always fits AVATAR_MAX_FILE_SIZE_BYTES regardless of the original size. EXIF orientation is applied
// by createImageBitmap; transparent PNG areas are flattened onto white.
export async function compressAvatarPhoto(photoFile: File): Promise<File> {
  const photoBitmap = await createImageBitmap(photoFile)
  const scale = Math.min(1, AVATAR_PHOTO_MAX_SIDE_PIXELS / Math.max(photoBitmap.width, photoBitmap.height))
  const width = Math.round(photoBitmap.width * scale)
  const height = Math.round(photoBitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const canvasContext = canvas.getContext('2d')
  if (!canvasContext) {
    throw new Error('Failed to process the photo')
  }

  canvasContext.fillStyle = AVATAR_PHOTO_BACKGROUND_COLOR
  canvasContext.fillRect(0, 0, width, height)
  canvasContext.drawImage(photoBitmap, 0, 0, width, height)
  photoBitmap.close()

  const photoBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, AVATAR_PHOTO_MIME_TYPE, AVATAR_PHOTO_JPEG_QUALITY)
  })
  if (!photoBlob) {
    throw new Error('Failed to process the photo')
  }

  return new File([photoBlob], AVATAR_PHOTO_FILE_NAME, { type: AVATAR_PHOTO_MIME_TYPE })
}

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
  // Fallback to an empty string: an offline blob written before avatars existed has no such field
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
