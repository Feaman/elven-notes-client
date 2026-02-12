export default class PromiseQueue {
  queue: (() => Promise<void>)[]

  isProcessing: boolean

  constructor() {
    this.queue = []
    this.isProcessing = false
  }

  async add(task: () => Promise<void>) {
    this.queue.push(task)
    if (!this.isProcessing) {
      await this.#process()
    }
  }

  async #process() {
    this.isProcessing = true
    while (this.queue.length) {
      const task = this.queue.shift()
      try {
        if (task) {
          // eslint-disable-next-line no-await-in-loop
          await task()
        }
      } catch (error) {
        this.queue = []
        throw error
      }
    }
    this.isProcessing = false
  }
}
