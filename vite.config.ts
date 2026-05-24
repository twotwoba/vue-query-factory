import { defineConfig, loadEnv } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd())
    console.log('env: ', env)

    return {
        plugins: [vue()],
        build: {
            lib: {
                entry: resolve(__dirname, 'src/index.ts'),
                name: env.VITE_LIB_NAME
            },
            rollupOptions: {
                external: ['vue'],
                output: {
                    globals: {
                        vue: 'Vue'
                    }
                }
            }
        }
    }
})
