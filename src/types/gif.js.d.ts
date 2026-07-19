declare module 'gif.js/dist/gif' {
  interface GIFOptions {
    workers?: number
    quality?: number
    width: number
    height: number
    workerScript: string
    background?: string
    repeat?: number
    transparent?: string | null
  }

  class GIF {
    constructor(options: GIFOptions)
    addFrame(
      context: CanvasRenderingContext2D | ImageData,
      options?: { copy?: boolean; delay?: number }
    ): void
    on(event: 'progress', callback: (p: number) => void): void
    on(event: 'finished', callback: (blob: Blob) => void): void
    render(): void
  }

  export default GIF
}
