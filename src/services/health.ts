import { ROUTE_SIGN } from '~/router/routes'
import { useGlobalStore } from '~/stores/global'
import BaseService from './base'
import SyncService from './sync'

export default class HealthService extends BaseService {
  static SHORT_TIMEOUT_MS = 1000

  static LONG_TIMEOUT_MS = 5000

  private static currentAbortController: AbortController | null = null

  static async check(
    timeoutMs: number = HealthService.LONG_TIMEOUT_MS,
    isReloadRequired = false,
  ): Promise<void> {
    HealthService.currentAbortController?.abort()

    const abortController = new AbortController()
    HealthService.currentAbortController = abortController
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

    const globalStore = useGlobalStore()
    const isOnlineBefore = globalStore.isOnline

    try {
      await BaseService.api.checkStatus({ signal: abortController.signal })

      if (!HealthService.isCurrentCheck(abortController)) {
        return
      }

      globalStore.isOnline = true

      if ((!isOnlineBefore || isReloadRequired) && HealthService.shouldReloadData()) {
        await SyncService.handleApplicationUpdate(true)
      }
    } catch {
      if (!HealthService.isCurrentCheck(abortController)) {
        return
      }
      globalStore.isOnline = false
    } finally {
      clearTimeout(timeoutId)
      if (HealthService.currentAbortController === abortController) {
        HealthService.currentAbortController = null
      }
    }
  }

  private static isCurrentCheck(abortController: AbortController): boolean {
    return HealthService.currentAbortController === abortController
  }

  private static shouldReloadData(): boolean {
    const globalStore = useGlobalStore()
    const isOnSignRoute = HealthService.router.currentRoute.value.name === ROUTE_SIGN
    return globalStore.user !== null && !isOnSignRoute
  }
}
