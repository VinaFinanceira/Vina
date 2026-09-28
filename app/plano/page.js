'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/components/Sessao'
import { useDados, orcamentoEfetivo } from '@/lib/useDados'
import { simular, compararMetodos } from '@/lib/plano'
import { METODOS } from '@/lib/dividas'
import { dinheiro, mesAno, somarMeses, duracao, num } from '@/lib/formato'
import Aviso, { textoErro } from '@/components/Aviso'

export default function Plano() {
  const s = useSessao()
  const [dados] = useDados()
  const [metodo, setMetodo] = useState(s.perfil.metodo)
  const [orcamento, setOrcamento] = useState('')
  const [extra, setExtra] = useState(0)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    if (dados && orcamento === '') setOrcamento(String(orcamentoEfetivo(s.perfil, dados.dividas)))
  }, [dados, s.perfil, orcamento])

  const verba = num(orcamento) || 0
  const base = useMemo(() => dados && simular(dados.dividas, { orcamento: verba, metodo }), [dados, verba, metodo])
  const comExtra = useMemo(() => dados && extra > 0 && simular(dados.dividas, { orcamento: verba, metodo, extra }), [dados, verba, metodo, extra])
  const comparacao = useMemo(() => dados && compararMetodos(dados.dividas, { orcamento: verba }), [dados, verba])

  if (!dados || !base) return <p className="suave">Carregando…</p>
  if (!dados.dividas.some((d) => d.status !== 'quitada')) {
    return <div className="vazio">Sem dívidas em aberto para planejar. <Link href="/dividas">Cadastre uma dívida</Link> para montar seu plano.</div>
  }

  const salvo = s.perfil.metodo === metodo && Number(s.perfil.orcamento_dividas) === verba && s.perfil.orcamento_dividas != null
  async function salvar() {
    const { error } = await supabase().from('perfis').update({ metodo, orcamento_dividas: verba }).eq('id', s.perfil.id)
    setMsg(error ? { erro: true, texto: textoErro(error) } : { texto: 'Plano salvo. O painel já mostra a nova data.' })
    if (!error) s.recarregar()
  }

  const livre = dados.rendaLivre
  const acimaDaRenda = livre != null && verba > livre
  const maxExtra = Math.max(500, Math.ceil(((livre ?? verba) * 0.5) / 50) * 50)

  return (
    <>
      <div className="cabecalho">
        <h1>Seu plano</h1>
        <p>Pague o mínimo de todas as dívidas e concentre o resto em uma de cada vez. Quando uma acaba, o valor dela reforça a próxima.</p>
      </div>

      <section className="bloco">
        <label htmlFor="orc">Quanto você consegue destinar às dívidas por mês (R$)</label>
        <input id="orc" type="number" inputMode="decimal" step="10" min="0" value={orcamento} onChange={(e) => setOrcamento(e.target.value)} style={{ maxWidth: 240 }} />
        <div className="ajuda">
          O mínimo para ficar em dia é {dinheiro(base.somaMinimos)}.
          {livre != null
            ? ` Depois dos gastos essenciais sobram ${dinheiro(livre)}.`
            : <> <Link href="/renda">Informe sua renda</Link> para ver quanto sobra no mês.</>}
        </div>
        {acimaDaRenda && <p className="erro-texto pequeno" style={{ marginTop: 8 }}>Esse valor passa do que sobra no mês. Um plano que não cabe no bolso costuma ser abandonado.</p>}

        <h3 style={{ marginTop: 20 }}>Estratégia</h3>
        <div className="metodos">
          {Object.entries(METODOS).map(([id, m]) => (
            <button key={id} className="metodo" aria-pressed={metodo === id} onClick={() => setMetodo(id)}>
              <strong>{m.nome}{id === 'hibrido' ? ' (recomendado)' : ''}</strong>
              <span className="pequeno suave">{m.resumo}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={salvar} disabled={salvo}>{salvo ? 'Plano salvo' : 'Salvar plano'}</button>
        </div>
      </section>

      {!base.viavel ? (
        <div className="insight alerta">
          <h3>Esse valor não cobre as parcelas mínimas</h3>
          <p>Faltam {dinheiro(base.deficit)} por mês. Antes de tudo, tente renegociar as parcelas. Se a conta não fechar, procure orientação gratuita no Procon ou na Defensoria Pública.</p>
        </div>
      ) : !base.quitou ? (
        <div className="insight alerta">
          <h3>Com esse valor as dívidas não acabam</h3>
          <p>Os juros crescem mais rápido do que você paga. Aumente o valor mensal ou renegocie a dívida mais cara para uma taxa menor.</p>
        </div>
      ) : (
        <>
          <h2>Resultado</h2>
          <div className="numeros">
            <div className="numero"><div className="numero-valor" style={{ textTransform: 'capitalize' }}>{mesAno(somarMeses(base.meses))}</div><div className="numero-rotulo">livre das dívidas, em {duracao(base.meses)}</div></div>
            <div className="numero"><div className="numero-valor">{dinheiro(base.jurosTotal)}</div><div className="numero-rotulo">de juros até lá, estimado</div></div>
          </div>

          <h2>Ordem de quitação</h2>
          <ol className="linha-tempo bloco">
            {base.quitacoes.map((q) => (
              <li key={q.id}><strong>{q.nome}</strong> <span className="suave">quitada em {mesAno(somarMeses(q.mes))}</span></li>
            ))}
          </ol>

          <h2>E se eu pagar um pouco mais?</h2>
          <section className="bloco">
            <label htmlFor="extra">Valor extra por mês: <strong>{dinheiro(extra)}</strong></label>
            <input id="extra" className="faixa" type="range" min="0" max={maxExtra} step="10" value={extra} onChange={(e) => setExtra(Number(e.target.value))} />
            {comExtra && comExtra.quitou ? (
              <p style={{ marginTop: 10, marginBottom: 0 }}>
                Você ficaria livre em <strong style={{ textTransform: 'capitalize' }}>{mesAno(somarMeses(comExtra.meses))}</strong>,{' '}
                <span className="destaque-verde">{duracao(Math.max(base.meses - comExtra.meses, 0))} antes</span>, e economizaria{' '}
                <span className="destaque-verde">{dinheiro(base.jurosTotal - comExtra.jurosTotal)}</span> em juros.
              </p>
            ) : (
              <p className="suave pequeno" style={{ marginTop: 10, marginBottom: 0 }}>Arraste para ver quanto tempo e quanto de juros um valor a mais economiza.</p>
            )}
          </section>

          <h2>Comparando as estratégias</h2>
          <ul className="lista bloco">
            {comparacao.filter((c) => c.quitou).map((c) => (
              <li key={c.metodo}>
                <span><strong>{METODOS[c.metodo].nome}</strong> <span className="suave pequeno">1ª quitação: {c.quitacoes[0]?.nome}, em {duracao(c.quitacoes[0]?.mes || 0)}</span></span>
                <span>{duracao(c.meses)}, {dinheiro(c.jurosTotal)} de juros</span>
              </li>
            ))}
          </ul>
          <p className="pequeno suave">Todos os valores são estimativas com base nos saldos e taxas que você informou. O plano se recalcula a cada pagamento ou atualização de saldo.</p>
        </>
      )}
      <Aviso msg={msg} onFechar={() => setMsg(null)} />
    </>
  )
}
