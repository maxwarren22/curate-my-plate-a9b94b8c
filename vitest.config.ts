import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    alias: {
      'https://deno.land/x/xhr@0.1.0/mod.ts': path.resolve(__dirname, './vitest-empty-mock.js'),
      'https://deno.land/std@0.168.0/http/server.ts': path.resolve(__dirname, './vitest-empty-mock.js'),
      'https://esm.sh/@supabase/supabase-js@2.45.0': '@supabase/supabase-js'
    }
  },
})
