'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const Contexto = createContext(null)

export function Sessao({ children }) {
  const [estado, setEstado] = useState({ carregando: true, perfil: null })

  const carregar = useCallback(async () => {
    const sb = supabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return setEstado({ carregando: false, perfil: null })
    const { data: perfil } = await sb.from('perfis').select('*').eq('id', user.id).single()
    setEstado({ carregando: false, perfil })
  }, [])

  useEffect(() => {
    carregar()
    const { data } = supabase().auth.onAuthStateChange((e) => {
      if (e === 'SIGNED_IN' || e === 'SIGNED_OUT') carregar()
    })
    return () => data.subscription.unsubscribe()
  }, [carregar])

  return <Contexto.Provider value={{ ...estado, recarregar: carregar }}>{children}</Contexto.Provider>
}

export const useSessao = () => useContext(Contexto)
