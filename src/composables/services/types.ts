import { computed, ref } from 'vue'
import typeModel, { IType, TTypeModel, TYPE_LIST, TYPE_PRIORITY_HIGH, TYPE_PRIORITY_LOW, TYPE_PRIORITY_MEDIUM } from '~/composables/models/type'

const types = ref<TTypeModel[]>([])

function generateTypes(typesData: IType[]) {
  types.value = []
  typesData.forEach((typeData: IType) => {
    types.value.push(typeModel(typeData) as unknown as TTypeModel)
  })
}

export const list = computed(() => {
  const defaultType = types.value.find((type: TTypeModel) => type.name === TYPE_LIST)
  if (!defaultType) {
    throw new Error('Default type not found')
  }

  return defaultType
})

export const priorityLow = computed(() => {
  const priorityLowType = types.value.find((type: TTypeModel) => type.name === TYPE_PRIORITY_LOW)
  if (!priorityLowType) {
    throw new Error('Priority low type not found')
  }

  return priorityLowType
})

export const priorityMedium = computed(() => {
  const priorityMediumType = types.value.find((type: TTypeModel) => type.name === TYPE_PRIORITY_MEDIUM)
  if (!priorityMediumType) {
    throw new Error('Priority medium type not found')
  }

  return priorityMediumType
})

export const priorityHigh = computed(() => {
  const priorityHighType = types.value.find((type: TTypeModel) => type.name === TYPE_PRIORITY_HIGH)
  if (!priorityHighType) {
    throw new Error('Priority high type not found')
  }

  return priorityHighType
})

function findByName(name: string) {
  const type = types.value.find((type: TTypeModel) => type.name === name)
  if (!type) {
    throw new Error(`Type '${name}' not found`)
  }

  return type
}

export function findById(typeId: number) {
  const type = types.value.find((_type: TTypeModel) => _type.id === typeId)
  if (!type) {
    throw new Error(`Type with id '${typeId}' not found`)
  }

  return type
}

export default {
  types,
  list,
  findById,
  generateTypes,
  findByName,

}
