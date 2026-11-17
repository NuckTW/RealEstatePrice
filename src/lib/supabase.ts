// 這個模組帶有 service role key，只能在 server 端使用；
// 被 client 元件 import 時 build 會直接失敗（Next.js 內建支援 server-only，不需另外安裝套件）
import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 後端 API 用（service role）。前端不直接連 Supabase，一律經由 /api 路由，所以不提供 anon client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
