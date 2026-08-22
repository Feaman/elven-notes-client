import { computed } from 'vue'
import { TProfileData } from '~/composables/models/user'
import { ConfigObject } from '~/services/api/interface'
import BaseService from '~/services/base'
import InitService from '~/services/init'
import StorageService from '~/services/storage'
import { useGlobalStore } from '~/stores/global'

const AUTH_TOKEN_NAME = 'auth-token'

function auth(data: ConfigObject) {
  StorageService.set({ [AUTH_TOKEN_NAME]: data.token })
  return InitService.initApplication(data)
}

async function signIn(email: string, password: string) {
  const data = await BaseService.api.signIn(email, password)
  auth(data)
}

async function register(email: string, password: string, firstName: string, secondName: string) {
  const data = await BaseService.api.signUp(email, password, firstName, secondName)
  auth(data)
}

async function updateProfile(profileData: TProfileData) {
  const userData = await BaseService.api.updateProfile(profileData)
  // Rebuilding the model via setUser updates the user across the whole UI at once (user is a ref in the store)
  useGlobalStore().setUser(userData)
}

async function signOut() {
  InitService.clearApplication()
  // Reset the loading flag: otherwise MainLayout stays on the loading screen
  // (skeletons are only for note routes) and the /sign page is not rendered.
  const globalStore = useGlobalStore()
  globalStore.isInitDataLoading = false
  // Also hide the «Updating…» toast so it does not get stuck on the sign-in page.
  globalStore.isUpdating = false
  await BaseService.router.push('/sign')
}

export const isWatch = computed(() => {
  const globalStore = useGlobalStore()
  return Number(globalStore?.user?.id) === 1
  && window.navigator.userAgent.toLocaleLowerCase().includes('samsungbrowser')
})

export default {
  AUTH_TOKEN_NAME,
  auth,
  signIn,
  signOut,
  register,
  updateProfile,
}
