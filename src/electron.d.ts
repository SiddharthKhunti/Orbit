declare global {
  interface Window {
    electronAPI?: {
      readAppData: () => Promise<string | null>
      writeAppData: (payload: string) => Promise<void>
    }
  }
}

export {}
