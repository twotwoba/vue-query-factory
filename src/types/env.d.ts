/// <reference types="vite/client" />

interface ImportMetaEnv {
    // readonly VITE_XXX: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
