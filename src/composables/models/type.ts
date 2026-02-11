import { ref, UnwrapRef } from 'vue'

export interface IType {
  id: number
  title: string
  name: string
}
export const TYPE_LIST = 'list'
export const TYPE_TEXT = 'text'
export const TYPE_PRIORITY_LOW = 'priority_low'
export const TYPE_PRIORITY_MEDIUM = 'priority_medium'
export const TYPE_PRIORITY_HIGH = 'priority_high'

export default function typeModel(typeData: IType) {
  const id = ref(typeData.id)
  const title = ref(typeData.title || '')
  const name = ref(typeData.name || '')

  return {
    id, title, name,
  }
}

export type TTypeModel = UnwrapRef<ReturnType<typeof typeModel>>
