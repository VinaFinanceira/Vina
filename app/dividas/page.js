'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Aviso, { textoErro } from '@/components/Aviso'
import { TIPOS, STATUS, nomeTipo, nomeStatus } from '@/lib/dividas'
import { dinheiro, num, pct } from '@/lib/formato'

const VAZIO = {
  nome: '', tipo: 'cartao_rotativo', saldo_atual: '', juros_mensal: '', naoSeiJuros: false,
  parcela_minima: '', dia_vencimento: '', status: 'em_dia',
}
const hojeISO = () => new Date().toISOString().slice(0, 10)

export default function Dividas() {
  const [dividas, setDividas] = useState(null)
  const [form, setForm] = useState(null)          // null = fechado; { id?, ...campos }
  const [pagando, setPagando] = useState(null)    // { dividaId, valor, data }
  const [historico, setHistorico] = useState({})  // dividaId -> pagamentos[]
  const [msg, setMsg] = useState(null)

  const carregar = useCallback(async () => {
    const { data } = await supabase().from('dividas').select('*').order('status').order('saldo_atual', { ascending: false })
    setDividas((data || []).sort((a, b) => (a.status === 'quitada') - (b.status === 'quitada')))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const avisar = (error, ok) => setMsg(error ? { erro: true, texto: textoErro(error) } : ok ? { texto: ok } : null)
  const tipoRef = (t) => TIPOS.find((x) => x.id === t)?.jurosRef

  function editar(d) {
    setForm({
      id: d.id, nome: d.nome, tipo: d.tipo, saldo_atual: d.saldo_atual, juros_mensal: d.juros_mensal,
      naoSeiJuros: d.juros_estimado, parcela_minima: d.parcela_minima, dia_vencimento: d.dia_vencimento ?? '', status: d.status,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function salvar(e) {
    e.preventDefault()
    const juros = form.naoSeiJuros ? tipoRef(form.tipo) : num(form.juros_mensal)
    const campos = {
      nome: form.nome.trim(), tipo: form.tipo, saldo_atual: num(form.saldo_atual), juros_mensal: juros,
      juros_estimado: form.naoSeiJuros, parcela_minima: num(form.parcela_minima) || 0,
      dia_vencimento: num(form.dia_vencimento), status: form.status, atualizado_em: new Date().toISOString(),
    }
    if (campos.status === 'quitada' && campos.saldo_atual > 0) campos.status = 'em_dia'
    if (campos.saldo_atual === 0) { campos.status = 'quitada'; campos.quitada_em = hojeISO() }
    const sb = supabase()
    const { error } = form.id
      ? await sb.from('dividas').update(campos).eq('id', form.id)
      : await sb.from('dividas').insert({ ...campos, saldo_inicial: campos.saldo_atual })
    avisar(error, form.id ? 'Dívida atualizada. O plano já foi recalculado.' : 'Dívida cadastrada.')
    if (!error) setForm(null)
    carregar()
  }

  async function excluir(d) {
    if (!confirm(`Excluir "${d.nome}" e todo o histórico de pagamentos dela?`)) return
    const { error } = await supabase().from('dividas').delete().eq('id', d.id)
    avisar(error, 'Dívida excluída.')
    carregar()
  }

  async function registrarPagamento(e) {
    e.preventDefault()
    const d = dividas.find((x) => x.id === pagando.dividaId)
    const valor = num(pagando.valor)
    const { error } = await supabase().from('pagamentos').insert({ divida_id: d.id, valor, data: pagando.data })
    const quitou = !error && valor >= Number(d.saldo_atual)
    avisar(error, quitou ? `${d.nome} quitada! Uma a menos.` : 'Pagamento registrado.')
    if (!error) setPagando(null)
    carregar()
    if (historico[d.id]) verHistorico(d.id, true)
  }

  async function verHistorico(id, forcar = false) {
    if (historico[id] && !forcar) return setHistorico({ ...historico, [id]: undefined })
    const { data } = await supabase().from('pagamentos').select('id, valor, data').eq('divida_id', id).order('data', { ascending: false })
    setHistorico((h) => ({ ...h, [id]: data || [] }))
  }

  async function desfazer(p, dividaId) {
    if (!confirm(`Apagar o pagamento de ${dinheiro(p.valor)}? O valor volta para o saldo da dívida.`)) return
    const { error } = await supabase().from('pagamentos').delete().eq('id', p.id)
    avisar(error, 'Pagamento apagado.')
    carregar()
    verHistorico(dividaId, true)
  }

  if (!dividas) return <p className="suave">Carregando…</p>
  const ativas = dividas.filter((d) => d.status !== 'quitada')
  const total = ativas.reduce((s, d) => s + Number(d.saldo_atual), 0)

  return (
    <>
      <div className="cabecalho">
        <h1>Dívidas</h1>
        <p>{ativas.length ? `${ativas.length} em aberto, somando ${dinheiro(total)}.` : 'Cadastre cada dívida com o saldo de hoje. Você pode ajustar tudo depois.'}</p>
      </div>

      {form ? (
        <form className="bloco" onSubmit={salvar}>
          <h3>{form.id ? 'Editar dívida' : 'Nova dívida'}</h3>
          <div className="campos">
            <div>
              <label htmlFor="nome">Nome</label>
              <input id="nome" required value={form.nome} placeholder="Ex.: Cartão do banco X" onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <label htmlFor="tipo">Tipo</label>
              <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="saldo">Quanto falta pagar hoje (R$)</label>
              <input id="saldo" required type="number" inputMode="decimal" step="0.01" min="0" value={form.saldo_atual} onChange={(e) => setForm({ ...form, saldo_atual: e.target.value })} />
            </div>
            <div>
              <label htmlFor="min">Parcela mínima por mês (R$)</label>
              <input id="min" type="number" inputMode="decimal" step="0.01" min="0" value={form.parcela_minima} onChange={(e) => setForm({ ...form, parcela_minima: e.target.value })} />
              <div className="ajuda">No cartão, é o pagamento mínimo da fatura.</div>
            </div>
            <div>
              <label htmlFor="juros">Juros ao mês (%)</label>
              <input id="juros" type="number" inputMode="decimal" step="0.01" min="0" required={!form.naoSeiJuros} disabled={form.naoSeiJuros}
                value={form.naoSeiJuros ? tipoRef(form.tipo) : form.juros_mensal} onChange={(e) => setForm({ ...form, juros_mensal: e.target.value })} />
              <label className="check pequeno" style={{ marginTop: 6 }}>
                <input type="checkbox" checked={form.naoSeiJuros} onChange={(e) => setForm({ ...form, naoSeiJuros: e.target.checked })} />
                Não sei, usar uma estimativa
              </label>
            </div>
            <div>
              <label htmlFor="venc">Dia do vencimento</label>
              <input id="venc" type="number" min="1" max="31" value={form.dia_vencimento} onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })} />
            </div>
            <div>
              <label htmlFor="status">Situação</label>
              <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUS.filter((s) => s.id !== 'quitada').map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>
          {form.naoSeiJuros && (
            <p className="ajuda">Usando {pct(tipoRef(form.tipo), 2)} ao mês, uma média para {nomeTipo(form.tipo).toLowerCase()}. A taxa real aparece no contrato, na fatura ou no app do banco (procure por CET).</p>
          )}
          <div className="linha-botoes">
            <button>{form.id ? 'Salvar alterações' : 'Cadastrar dívida'}</button>
            <button type="button" className="secundario" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <div style={{ marginBottom: 16 }}><button onClick={() => setForm({ ...VAZIO })}>Cadastrar dívida</button></div>
      )}

      {dividas.length === 0 && !form && (
        <div className="vazio">Nenhuma dívida cadastrada. Comece pela que mais te preocupa hoje.</div>
      )}

      {dividas.map((d) => {
        const pago = Number(d.saldo_inicial) ? 1 - Number(d.saldo_atual) / Number(d.saldo_inicial) : 0
        const aberta = d.status !== 'quitada'
        return (
          <article key={d.id} className={aberta ? 'divida' : 'divida quitada'}>
            <div className="divida-topo">
              <div>
                <h3 style={{ margin: 0 }}>{d.nome}</h3>
                <div className="divida-meta">
                  {nomeTipo(d.tipo)}, {pct(d.juros_mensal, 2)} ao mês{d.juros_estimado ? ' (estimado)' : ''}
                  {aberta && Number(d.parcela_minima) > 0 && `, mínimo de ${dinheiro(d.parcela_minima)}`}
                  {aberta && d.dia_vencimento && `, vence dia ${d.dia_vencimento}`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="divida-saldo">{dinheiro(d.saldo_atual)}</div>
                <span className={`selo ${d.status}`}>{nomeStatus(d.status)}</span>
              </div>
            </div>
            <div className="divida-barra" aria-hidden="true"><span style={{ width: `${Math.max(pago * 100, 0)}%` }} /></div>
            <div className="pequeno suave">{pct(Math.max(pago, 0) * 100, 0)} pago de {dinheiro(d.saldo_inicial)}</div>

            {pagando?.dividaId === d.id ? (
              <form className="campos" style={{ marginTop: 12, alignItems: 'end' }} onSubmit={registrarPagamento}>
                <div>
                  <label htmlFor={`v-${d.id}`}>Valor pago (R$)</label>
                  <input id={`v-${d.id}`} required autoFocus type="number" inputMode="decimal" step="0.01" min="0.01" value={pagando.valor} onChange={(e) => setPagando({ ...pagando, valor: e.target.value })} />
                </div>
                <div>
                  <label htmlFor={`d-${d.id}`}>Data</label>
                  <input id={`d-${d.id}`} required type="date" value={pagando.data} onChange={(e) => setPagando({ ...pagando, data: e.target.value })} />
                </div>
                <div className="linha-botoes">
                  <button>Registrar</button>
                  <button type="button" className="secundario" onClick={() => setPagando(null)}>Cancelar</button>
                </div>
              </form>
            ) : (
              <div className="divida-acoes">
                {aberta && <button className="pequeno" onClick={() => setPagando({ dividaId: d.id, valor: d.parcela_minima || '', data: hojeISO() })}>Registrar pagamento</button>}
                <button className="pequeno secundario" onClick={() => editar(d)}>{aberta ? 'Editar ou atualizar saldo' : 'Editar'}</button>
                <button className="pequeno secundario" onClick={() => verHistorico(d.id)}>{historico[d.id] ? 'Esconder pagamentos' : 'Pagamentos'}</button>
                <button className="pequeno perigo" onClick={() => excluir(d)}>Excluir</button>
              </div>
            )}

            {historico[d.id] && (
              historico[d.id].length === 0 ? <p className="pequeno suave" style={{ marginTop: 10 }}>Nenhum pagamento registrado.</p> : (
                <ul className="lista" style={{ marginTop: 8 }}>
                  {historico[d.id].map((p) => (
                    <li key={p.id}>
                      <span>{p.data.split('-').reverse().join('/')}</span>
                      <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <strong>{dinheiro(p.valor)}</strong>
                        <button className="link pequeno" onClick={() => desfazer(p, d.id)}>Apagar</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </article>
        )
      })}
      <Aviso msg={msg} onFechar={() => setMsg(null)} />
    </>
  )
}
