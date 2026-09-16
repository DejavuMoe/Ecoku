import { CommentSurface } from './comment'
import { resolveConfig, type EcokuConfig, type ResolvedEcokuConfig } from './config'

const mountedContainers = new WeakMap<HTMLElement, CommentSurface>()

class Ecoku {
  private options: EcokuConfig | null
  private config: ResolvedEcokuConfig | null = null
  private surface: CommentSurface | null = null
  private initialized = false

  constructor(options?: EcokuConfig) {
    this.options = options || null
  }

  async init(options?: EcokuConfig): Promise<void> {
    if (this.initialized) return
    if (options) this.options = options
    if (!this.options) {
      throw new TypeError('Ecoku: configuration is required in the constructor or init().')
    }
    const config = resolveConfig(this.options)
    if (mountedContainers.has(config.container)) {
      throw new Error('Ecoku: the selected container already has an active comment instance.')
    }
    const surface = new CommentSurface(config)
    this.config = config
    this.surface = surface
    this.initialized = true
    mountedContainers.set(config.container, surface)
    try {
      await surface.mount()
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  async reload(): Promise<void> {
    if (!this.surface) {
      throw new Error('Ecoku: init() must be called before reload().')
    }
    await this.surface.reload()
  }

  async setPageKey(pageKey: string, pageTitle = ''): Promise<void> {
    if (!this.surface || !this.config) {
      throw new Error('Ecoku: init() must be called before setPageKey().')
    }
    this.config = { ...this.config, pageKey: pageKey.trim(), pageTitle: pageTitle.trim() }
    await this.surface.setPageKey(pageKey, pageTitle)
  }

  destroy(): void {
    if (this.surface && this.config) {
      mountedContainers.delete(this.config.container)
      this.surface.destroy()
    }
    this.surface = null
    this.config = null
    this.initialized = false
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

export default Ecoku

export type { CommentFormConfig, EcokuConfig, EcokuTheme, ResolvedEcokuConfig } from './config'
export type {
  CommentData,
  CommentDraft,
  CommentPage,
  CommentSort,
  CommentSubmission,
  CommentSubmitResponse,
} from './fetch'
