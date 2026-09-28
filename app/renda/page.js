'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDados } from '@/lib/useDados'
import Aviso, { textoErro } from '@/components/Aviso'
import { dinheiro, num } from '@/lib/formato'

const TIPOS_RENDA = [
  { id: 'clt', nome: 'Salário (carteira assinada)' },
  { id: 'autonomo', nome: 'Autônomo / PJ (varia todo mês)' },
  { id: 'outro', nome: 'Outra (aposentadoria, bicos…)' },
]
const mesAtual = () => new Date().toISOString().slice(0, 7)
const fmtMes = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

export default function Renda() {
  const [dados, recarregar] = useDados()
  const [f, setF] = useState({ mes: mesAtual(), tipo: 'clt', bruto: '', descontos: '', liquido: '', beneficios: '' })
  const [desp, setDesp] = useState({ nome: '', valor: '' })
  const [msg, setMsg] = useState(null)
  const avisar = (error, ok) => setMsg(error ? { erro: true, texto: textoErro(error) } : { texto: ok })

  const liquidoCalc = num(f.bruto) != null && num(f.descontos) != null ? num(f.bruto) - num(f.descontos) : null

  async function salvarRenda(e) {
    e.preventDefault()
    const liquido = num(f.liquido) ?? liquidoCalc
    const { error } = await supabase().from('rendas').upsert({
      mes_referencia: `${f.mes}-01`, tipo: f.tipo, bruto: num(f.bruto), descontos: num(f.descontos), liquido,
      beneficios: num(f.beneficios) ? [{ nome: 'Benefícios (VA/VR etc.)', valor: num(f.beneficios) }] : [],
    }, { onConflict: 'usuario_id,mes_referencia' })
    avisar(error, 'Renda salva.')
    if (!error) setF({ ...f, bruto: '', descontos: '', liquido: '', beneficios: '' })
    recarregar()
  }

  async function addDespesa(e) {
    e.preventDefault()
    const { error } = await supabase().from('despesas').insert({ nome: desp.nome.trim(), valor: num(desp.valor) })
    avisar(error, 'Gasto adicionado.')
    if (!error) setDesp({ nome: '', valor: '' })
    recarregar()
  }

  async function apagar(tabela, id) {
    const { error } = await supabase().from(tabela).delete().eq('id', id)
    avisar(error, 'Removido.')
    recarregar()
  }

  if (!dados) return <p className="suave">Carregando…</p>
  const variavel = dados.rendas[0] && dados.rendas[0].tipo !== 'clt'

  return (
    <>
      <div className="cabecalho">
        <h1>Renda e gastos essenciais</h1>
        <p>Com isso a VINA calcula quanto realmente sobra no mês para as dívidas, sem apertar o que é essencial.</p>
      </div>

      <div className="numeros">
        <div className="numero"><div className="numero-valor">{dados.renda != null ? dinheiro(dados.renda) : '—'}</div><div className="numero-rotulo">renda líquida{variavel ? ' (média dos últimos meses)' : ''}</div></div>
        <div className="numero"><div className="numero-valor">{dinheiro(dados.totalDespesas)}</div><div className="numero-rotulo">em gastos essenciais</div></div>
        <div className="numero"><div className="numero-valor">{dados.rendaLivre != null ? dinheiro(dados.rendaLivre) : '—'}</div><div className="numero-rotulo">sobram por mês</div></div>
      </div>

      <h2>Renda do mês</h2>
      <form className="bloco" onSubmit={salvarRenda}>
        <div className="campos">
          <div><label htmlFor="mes">Mês</label><input id="mes" type="month" required value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></div>
          <div>
            <label htmlFor="tipo">De onde vem</label>
            <select id="tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
              {TIPOS_RENDA.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        </div>
        <div className="campos">
          <div><label htmlFor="bruto">Salário bruto (R$)</label><input id="bruto" type="number" inputMode="decimal" step="0.01" min="0" value={f.bruto} onChange={(e) => setF({ ...f, bruto: e.target.value })} /></div>
          <div><label htmlFor="desc">Descontos (R$)</label><input id="desc" type="number" inputMode="decimal" step="0.01" min="0" value={f.descontos} onChange={(e) => setF({ ...f, descontos: e.target.value })} /><div className="ajuda">INSS, IR, consignado…</div></div>
          <div>
            <label htmlFor="liq">Valor que cai na conta (R$)</label>
            <input id="liq" type="number" inputMode="decimal" step="0.01" min="0" required={liquidoCalc == null}
              placeholder={liquidoCalc != null ? liquidoCalc.toFixed(2) : ''} value={f.liquido} onChange={(e) => setF({ ...f, liquido: e.target.value })} />
            <div className="ajuda">{f.tipo === 'clt' ? 'O "líquido" do seu contracheque.' : 'Quanto entrou de fato neste mês.'}</div>
          </div>
          <div><label htmlFor="ben">Benefícios (R$, opcional)</label><input id="ben" type="number" inputMode="decimal" step="0.01" min="0" value={f.beneficios} onChange={(e) => setF({ ...f, beneficios: e.target.value })} /><div className="ajuda">VA, VR. Não entra na conta das dívidas.</div></div>
        </div>
        <button>Salvar renda</button>
        {f.tipo !== 'clt' && <p className="ajuda" style={{ marginTop: 10 }}>Como sua renda varia, a VINA usa a média dos últimos 3 meses informados.</p>}
      </form>

      {dados.rendas.length > 0 && (
        <ul className="lista bloco">
          {dados.rendas.map((r) => (
            <li key={r.id}>
              <span style={{ textTransform: 'capitalize' }}>{fmtMes(r.mes_referencia)}</span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <strong>{dinheiro(r.liquido)}</strong>
                <button className="link pequeno" onClick={() => apagar('rendas', r.id)}>Apagar</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2>Gastos essenciais do mês</h2>
      <p className="suave">Só o que não dá para cortar: aluguel, luz, água, mercado, transporte, remédios. Não inclua as dívidas aqui.</p>
      <form className="bloco campos" style={{ alignItems: 'end' }} onSubmit={addDespesa}>
        <div><label htmlFor="dn">Gasto</label><input id="dn" required value={desp.nome} placeholder="Aluguel" onChange={(e) => setDesp({ ...desp, nome: e.target.value })} /></div>
        <div><label htmlFor="dv">Valor por mês (R$)</label><input id="dv" required type="number" inputMode="decimal" step="0.01" min="0" value={desp.valor} onChange={(e) => setDesp({ ...desp, valor: e.target.value })} /></div>
        <div><button>Adicionar gasto</button></div>
      </form>
      {dados.despesas.length > 0 && (
        <ul className="lista bloco">
          {dados.despesas.map((d) => (
            <li key={d.id}>
              <span>{d.nome}</span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <strong>{dinheiro(d.valor)}</strong>
                <button className="link pequeno" onClick={() => apagar('despesas', d.id)}>Apagar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Aviso msg={msg} onFechar={() => setMsg(null)} />
    </>
  )
}
