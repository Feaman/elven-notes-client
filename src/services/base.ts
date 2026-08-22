import { AxiosError, isAxiosError } from 'axios'
import mitt from 'mitt'
import { Router } from 'vue-router'
import { useGlobalStore } from '~/stores/global'
import { TEvents, TGlobalError } from '~/types'
import ApiService from './api/api'

export default class BaseService {
  static API_URL = 'https://api-notes.pavlo.ru/'

  static API_DOMAIN = 'api-notes.pavlo.ru'

  static DEV_API_DOMAIN = 'localhost:3015'

  static DEV_API_URL = `http://${BaseService.DEV_API_DOMAIN}`

  static OFFLINE_STORE_NAME = 'offline-data'

  static api: ApiService

  static showError: (error: Error | TGlobalError) => void

  static eventBus = mitt<TEvents>()

  static router: Router

  static getApiUrl(): string {
    return process.env.DEV ? BaseService.DEV_API_URL : BaseService.API_URL
  }

  // URL of a file served by the server's /files static route (filePath is a relative path from the avatar field)
  static getFileUrl(filePath: string): string {
    const apiUrl = BaseService.getApiUrl()
    return `${apiUrl}${apiUrl.endsWith('/') ? '' : '/'}files/${filePath}`
  }

  static isNetworkError(error: unknown): boolean {
    return isAxiosError(error) && !error.response
  }

  static parseAxiosError(error: AxiosError): TGlobalError {
    return {
      statusCode: Number(error.code) || error?.response?.status || undefined,
      message: (error?.response?.data as { message: string })?.message || error.message,
    }
  }

  static pause(milliseconds: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds)
    })
  }

  static switchWatchMode() {
    const store = useGlobalStore()
    store.isWatchMode = !store.isWatchMode
    this.router.push({ query: { 'is-watch': store.isWatchMode ? '1' : '0' } })
  }
}
