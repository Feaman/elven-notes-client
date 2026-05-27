import { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import IAxiosApi from './axios-interface'

export default class AxiosApi implements IAxiosApi {
  api: AxiosInstance

  constructor(api: AxiosInstance) {
    this.api = api
  }

  setRequestInterceptor(requestHandler: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig): void {
    this.api.interceptors.request.use((config: InternalAxiosRequestConfig) => requestHandler(config))
  }

  setResponseInterceptor(responseHandler: (response: { data: object, status: number }) => AxiosResponse): void {
    this.api.interceptors.response.use((response: AxiosResponse) => responseHandler(response))
  }

  get(url: string, config?: object) {
    return this.api.get(url, config)
  }

  post(url: string, data?: object, config?: object) {
    return this.api.post(url, data, config)
  }

  put(url: string, data?: object, config?: object) {
    return this.api.put(url, data, config)
  }

  delete(url: string, data?: object) {
    return this.api.delete(url, data)
  }

  head(url: string, config?: object) {
    return this.api.head(url, config)
  }
}
