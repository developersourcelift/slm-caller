import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

// Local demo lead data (public/demo) is for development only — never ship it in a build.
const stripDemoData = {
  name: 'strip-demo-data',
  apply: 'build',
  closeBundle() {
    rmSync(resolve(__dirname, 'dist/demo'), { recursive: true, force: true })
  },
}

export default defineConfig({
  plugins: [react(), stripDemoData],
  base: './',
})
