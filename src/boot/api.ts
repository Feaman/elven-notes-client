import axios, { AxiosInstance } from 'axios'
import { boot } from 'quasar/wrappers'
import UsersService from '~/composables/services/users'
import AxiosApi from '~/services/api/axios-api'
import OnlineApi from '~/services/api/online-api'
import BaseService from '~/services/base'
import SocketIOService from '~/services/socket-io'
import StorageService from '~/services/storage'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance;
  }
}

// Be careful when using SSR for cross-request state pollution
// due to creating a Singleton instance here;
// If any client changes this (global) instance, it might be a
// good idea to move this instance creation inside of the
// "export default () => {}" function below (which runs individually
// for each client)
const axiosInstance = axios.create({
  baseURL: process.env.DEV ? 'http://localhost:3015' : BaseService.API_URL,
})

export default boot(() => {
  const axiosApi = new AxiosApi(axiosInstance)
  axiosApi.setRequestInterceptor((config) => {
    try {
      // Auth token
      const token = StorageService.get(UsersService.AUTH_TOKEN_NAME)
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`
      }

      // Set socket io identifier
      if (config.headers) {
        config.headers['socket-io-id'] = SocketIOService.socketId
      }
    } catch (error) {
      BaseService.showError(error as Error)
    }

    return config
  })
  OnlineApi.axiosApi = axiosApi
})
