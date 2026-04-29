/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_YUNWU_API_URL: string
  readonly VITE_API_PROVIDER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
