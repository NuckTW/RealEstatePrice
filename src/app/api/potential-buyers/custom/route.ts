import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkAccess } from '@/lib/aiGuard'

/**
 * 潛在客群｜手動資料與自訂指數（讀寫）
 * 存取：與 AI 問答共用密碼（x-chat-password）；資料表 RLS 全關，只能經由此 API 以 service role 存取
 * 資料表：supabase/migrations/20261007_custom_datasets_indices.sql
 */

const MAX_VALUES = 800        // 650 里 + 緩衝
const MAX_COMPONENTS = 30

type Json = Record<string, unknown>
const str = (v: unknown, max: number): string | null => {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)

function deny(req: NextRequest) {
  const a = checkAccess(req)
  return a.ok ? null : NextResponse.json({ error: a.error }, { status: a.status })
}

/* ── 讀取：全部手動資料 + 自訂指數 ───────────────────────────── */
export async function GET(req: NextRequest) {
  const d = deny(req); if (d) return d
  try {
    const [ds, vals, idx] = await Promise.all([
      supabaseAdmin.from('custom_datasets').select('*').order('created_at'),
      supabaseAdmin.from('custom_dataset_values').select('dataset_id, area_key, value').limit(50000),
      supabaseAdmin.from('custom_indices').select('*').order('created_at'),
    ])
    const err = ds.error ?? vals.error ?? idx.error
    if (err) throw err

    const valuesBy = new Map<string, Record<string, number>>()
    for (const r of vals.data ?? []) {
      const m = valuesBy.get(r.dataset_id) ?? {}
      m[r.area_key] = Number(r.value)
      valuesBy.set(r.dataset_id, m)
    }
    return NextResponse.json({
      datasets: (ds.data ?? []).map(r => ({
        id: r.id, name: r.name, unit: r.unit, level: r.level, description: r.description, source: r.source,
        updatedAt: r.updated_at, values: valuesBy.get(r.id) ?? {},
      })),
      indices: (idx.data ?? []).map(r => ({
        id: r.id, name: r.name, desc: r.description ?? '', components: r.components, aiNote: r.ai_note,
        updatedAt: r.updated_at,
      })),
    })
  } catch (err) {
    console.error('[/api/potential-buyers/custom GET]', err)
    // 資料表尚未建立時給明確提示
    const msg = String((err as { message?: string })?.message ?? '')
    const missing = /relation .* does not exist|Could not find the table/i.test(msg)
    return NextResponse.json({ error: missing ? '資料表尚未建立（需執行 20261007 migration）' : '讀取失敗' }, { status: 500 })
  }
}

/* ── 寫入：saveDataset / deleteDataset / saveIndex / deleteIndex ── */
export async function POST(req: NextRequest) {
  const d = deny(req); if (d) return d
  let body: Json
  try { body = await req.json() } catch { return NextResponse.json({ error: '格式錯誤' }, { status: 400 }) }

  try {
    switch (body.action) {
      case 'saveDataset': {
        const x = (body.dataset ?? {}) as Json
        const name = str(x.name, 60)
        const level = x.level === 'district' ? 'district' : x.level === 'village' ? 'village' : null
        if (!name || !level) return NextResponse.json({ error: '請填資料名稱與層級' }, { status: 400 })
        const raw = (x.values ?? {}) as Record<string, unknown>
        const entries = Object.entries(raw)
          .map(([k, v]) => [String(k).trim().slice(0, 20), Number(v)] as const)
          .filter(([k, v]) => k && Number.isFinite(v))
        if (entries.length > MAX_VALUES) return NextResponse.json({ error: `最多 ${MAX_VALUES} 筆` }, { status: 400 })

        const row = {
          name, level, unit: str(x.unit, 20), description: str(x.description, 500), source: str(x.source, 200),
          updated_at: new Date().toISOString(),
        }
        let id = isUuid(x.id) ? x.id : null
        if (id) {
          const { error } = await supabaseAdmin.from('custom_datasets').update(row).eq('id', id)
          if (error) throw error
          // 數值整批替換：先刪後寫
          const del = await supabaseAdmin.from('custom_dataset_values').delete().eq('dataset_id', id)
          if (del.error) throw del.error
        } else {
          const { data, error } = await supabaseAdmin.from('custom_datasets').insert(row).select('id').single()
          if (error) throw error
          id = data.id as string
        }
        if (entries.length) {
          const { error } = await supabaseAdmin.from('custom_dataset_values')
            .insert(entries.map(([area_key, value]) => ({ dataset_id: id, area_key, value })))
          if (error) throw error
        }
        return NextResponse.json({ ok: true, id })
      }

      case 'deleteDataset': {
        if (!isUuid(body.id)) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
        const { error } = await supabaseAdmin.from('custom_datasets').delete().eq('id', body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      case 'saveIndex': {
        const x = (body.index ?? {}) as Json
        const name = str(x.name, 40)
        if (!name) return NextResponse.json({ error: '請填指數名稱' }, { status: 400 })
        const comps = Array.isArray(x.components) ? x.components : []
        const components = comps.slice(0, MAX_COMPONENTS)
          .map(c => c as Json)
          .map(c => ({ key: String(c.key ?? '').slice(0, 60), weight: Number(c.weight), invert: Boolean(c.invert) }))
          .filter(c => c.key && Number.isFinite(c.weight) && c.weight > 0 && c.weight <= 1000)
        if (!components.length) return NextResponse.json({ error: '至少要有一個權重大於 0 的指標' }, { status: 400 })

        const row = {
          name, components, description: str(x.desc, 500), ai_note: str(x.aiNote, 4000),
          updated_at: new Date().toISOString(),
        }
        let id = isUuid(x.id) ? x.id : null
        if (id) {
          const { error } = await supabaseAdmin.from('custom_indices').update(row).eq('id', id)
          if (error) throw error
        } else {
          const { data, error } = await supabaseAdmin.from('custom_indices').insert(row).select('id').single()
          if (error) throw error
          id = data.id as string
        }
        return NextResponse.json({ ok: true, id })
      }

      case 'deleteIndex': {
        if (!isUuid(body.id)) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
        const { error } = await supabaseAdmin.from('custom_indices').delete().eq('id', body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ error: '未知的動作' }, { status: 400 })
    }
  } catch (err) {
    console.error('[/api/potential-buyers/custom POST]', err)
    return NextResponse.json({ error: '儲存失敗' }, { status: 500 })
  }
}
