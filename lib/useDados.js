'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { rendaReferencia } from './dividas'

// Carrega tudo o que o painel e o plano precisam de uma vez.
export function useDados() {
  const [dados, setDados] = useState(null)

  const carregar = useCallback(async () => {
    const sb = supabase()
    const [{ data: dividas }, { data: rendas }, { data: despesas }, { data: pags }] = await Promise.all([
      sb.from('dividas').select('*').order('criado_em'),
      sb.from('rendas').select('*').order('mes_referencia', { ascending: false }).limit(12),
      sb.from('despesas').select('*').order('nome'),
      sb.from('pagamentos').select('divida_id, data, valor').order('data', { ascending: false }).limit(500),
    ])
    const ultimosPagamentos = {}
    for (const p of pags || []) if (!ultimosPagamentos[p.divida_id]) ultimosPagamentos[p.divida_id] = p.data
    const renda = rendaReferencia(rendas)
    const totalDespesas = (despesas || []).reduce((s, d) => s + Number(d.valor), 0)
    setDados({
      dividas: dividas || [],
      rendas: rendas || [],
      despesas: despesas || [],
      ultimosPagamentos,
      renda,
      totalDespesas,
      rendaLivre: renda != null ? renda - totalDespesas : null,
    })
  }, [])

  useEffect(() => { carregar() }, [carregar])
  return [dados, carregar]
}

// Orçamento efetivo: o que a pessoa definiu, ou a soma dos mínimos.
export function orcamentoEfetivo(perfil, dividas) {
  if (perfil?.orcamento_dividas != null) return Number(perfil.orcamento_dividas)
  return dividas.filter((d) => d.status !== 'quitada').reduce((s, d) => s + Number(d.parcela_minima), 0)
}
