'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Aviso, { textoErro } from '@/components/Aviso'
import { dinheiro, duracao, num, pct } from '@/lib/formato'

export default function Metas() {
  const [metas, setMetas] = useState(null)
  const [guardar, setGuardar] = useState({})   // id -> valor digitado
  const [nova, setNova] = useState({ nome: '', valor_alvo: '', aporte_mensal: '' })
  const [abrirForm, setAbrirForm] = useState(false)
  const [msg, setMsg] = useState(null)

  const carregar = useCallback(async () => {
    const { data } = await supabase().from('metas_compra').select('*').neq('status', 'cancelada').order('criado_em', { ascending: false })
    setMetas(data || [])
  }, [])
  useEffect(() => { carregar() }, [carregar])
  const avisar = (error, ok) => setMsg(error ? { erro: true, texto: textoErro(error) } : { texto: ok })

  async function criar(e) {
    e.preventDefault()
    const { error } = await supabase().from('metas_compra').insert({ nome: nova.nome.trim(), valor_alvo: num(nova.valor_alvo), aporte_mensal: num(nova.aporte_mensal) })
    avisar(error, 'Meta criada.')
    if (!error) { setNova({ nome: '', valor_alvo: '', aporte_mensal: '' }); setAbrirForm(false) }
    carregar()
  }

  async function adicionar(m) {
    const v = num(guardar[m.id])
    if (!v) return
    const total = Number(m.valor_guardado) + v
    const concluiu = total >= Number(m.valor_alvo)
    const { error } = await supabase().from('metas_compra').update({ valor_guardado: total, status: concluiu ? 'concluida' : 'ativa' }).eq('id', m.id)
    avisar(error, concluiu ? `Meta "${m.nome}" alcançada! Você juntou sem fazer dívida nova.` : `${dinheiro(v)} guardados.`)
    setGuardar({ ...guardar, [m.id]: '' })
    carregar()
  }

  async function cancelar(m) {
    if (!confirm(`Cancelar a meta "${m.nome}"?`)) return
    const { error } = await supabase().from('metas_compra').update({ status: 'cancelada' }).eq('id', m.id)
    avisar(error, 'Meta cancelada.')
    carregar()
  }

  if (!metas) return <p className="suave">Carregando…</p>

  return (
    <>
      <div className="cabecalho">
        <h1>Metas de compra</h1>
        <p>Quer comprar algo? Pergunte à VINA se dá, ou mande a foto do produto. Ela mostra o caminho sem dívida nova e cria a meta aqui.</p>
      </div>
      <div className="linha-botoes" style={{ marginBottom: 16 }}>
        <Link href="/vina?p=Quero%20comprar%20uma%20coisa.%20Me%20ajuda%20a%20ver%20se%20d%C3%A1%3F" className="botao">Perguntar à VINA</Link>
        <button className="secundario" onClick={() => setAbrirForm(!abrirForm)}>Criar meta manualmente</button>
      </div>

      {abrirForm && (
        <form className="bloco" onSubmit={criar}>
          <div className="campos">
            <div><label htmlFor="mn">O que você quer comprar</label><input id="mn" required value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></div>
            <div><label htmlFor="mv">Preço (R$)</label><input id="mv" required type="number" inputMode="decimal" step="0.01" min="1" value={nova.valor_alvo} onChange={(e) => setNova({ ...nova, valor_alvo: e.target.value })} /></div>
            <div><label htmlFor="ma">Guardar por mês (R$)</label><input id="ma" type="number" inputMode="decimal" step="0.01" min="0" value={nova.aporte_mensal} onChange={(e) => setNova({ ...nova, aporte_mensal: e.target.value })} /></div>
          </div>
          <button>Criar meta</button>
        </form>
      )}

      {metas.length === 0 && <div className="vazio">Nenhuma meta ainda.</div>}

      {metas.map((m) => {
        const falta = Math.max(Number(m.valor_alvo) - Number(m.valor_guardado), 0)
        const prog = Math.min(Number(m.valor_guardado) / Number(m.valor_alvo), 1)
        const meses = m.aporte_mensal > 0 ? Math.ceil(falta / Number(m.aporte_mensal)) : null
        return (
          <article key={m.id} className={m.status === 'concluida' ? 'divida quitada' : 'divida'}>
            <div className="divida-topo">
              <div>
                <h3 style={{ margin: 0 }}>{m.nome}</h3>
                <div className="divida-meta">
                  {m.status === 'concluida' ? 'Meta alcançada' : `Faltam ${dinheiro(falta)}${meses ? `, cerca de ${duracao(meses)} guardando ${dinheiro(m.aporte_mensal)} por mês` : ''}`}
                </div>
                {m.caminho && <div className="divida-meta">{m.caminho}</div>}
              </div>
              <div className="divida-saldo">{dinheiro(m.valor_alvo)}</div>
            </div>
            <div className="divida-barra" aria-hidden="true"><span style={{ width: `${prog * 100}%` }} /></div>
            <div className="pequeno suave">{pct(prog * 100, 0)} guardado ({dinheiro(m.valor_guardado)})</div>
            {m.status === 'ativa' && (
              <div className="linha-botoes" style={{ marginTop: 12, alignItems: 'center' }}>
                <label htmlFor={`g-${m.id}`} className="sr-only">Valor guardado</label>
                <input id={`g-${m.id}`} type="number" inputMode="decimal" step="0.01" min="0" placeholder="R$" style={{ maxWidth: 130 }}
                  value={guardar[m.id] ?? ''} onChange={(e) => setGuardar({ ...guardar, [m.id]: e.target.value })} />
                <button className="pequeno" onClick={() => adicionar(m)}>Guardei</button>
                <button className="pequeno perigo" onClick={() => cancelar(m)}>Cancelar meta</button>
              </div>
            )}
          </article>
        )
      })}
      <Aviso msg={msg} onFechar={() => setMsg(null)} />
    </>
  )
}
