import { createBrowserClient } from '@supabase/ssr'

let cliente

export function supabase() {
  if (!cliente) {
    cliente = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return cliente
}
