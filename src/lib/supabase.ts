import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 前端用（anon key）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 後端 API 用（service role，只在 server 端使用）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
