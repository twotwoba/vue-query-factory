import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'VueQueryFactory',
            fileName: (format) => `vue-query-factory.${format}.js`,
            formats: ['es', 'cjs']
        },
        rollupOptions: {
            external: ['vue', '@tanstack/vue-query'],
            output: {
                globals: {
                    vue: 'Vue',
                    '@tanstack/vue-query': 'VueQuery'
                }
            }
        }
    }
})
