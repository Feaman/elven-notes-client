import { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

export default interface IAxiosApi {
  get(url: string, config?: object): Promise<{ data: object }>
  post(url: string, data: object, config?: object): Promise<{ data: object, status: number }>
  put(url: string, data?: object, config?: object): Promise<{ data: object, status: number }>
  delete(url: string, data?: object): Promise<{ data: object, status: number }>
  head(url: string, config?: object): Promise<{ status: number }>
  setResponseInterceptor(responseHandler: (response: { data: object, status: number }) => AxiosResponse): void
  setRequestInterceptor(requestHandler: (config: { headers?: { [index: string]: string } }) => InternalAxiosRequestConfig): void
}
