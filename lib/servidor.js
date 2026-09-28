import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Cliente Supabase do lado do servidor, autenticado com o login da pessoa.
// As regras de segurança (RLS) continuam valendo: só lê os dados dela.
export async function supabaseServidor() {
  const c = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => c.getAll(),
      setAll: (lista) => {
        try { lista.forEach(({ name, value, options }) => c.set(name, value, options)) } catch {}
      },
    },
  })
}
