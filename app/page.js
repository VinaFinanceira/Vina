'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useSessao } from '@/components/Sessao'
import { useDados, orcamentoEfetivo } from '@/lib/useDados'
import { simular } from '@/lib/plano'
import { radar, mensagemNegociacao } from '@/lib/radar'
import { dinheiro, mesAno, somarMeses, duracao, pct } from '@/lib/formato'
import Aviso from '@/components/Aviso'

export default function Painel() {
  const { perfil } = useSessao()
  const [dados] = useDados()
  const [mensagem, setMensagem] = useState(null)   // { dividaId, texto }
  const [msg, setMsg] = useState(null)

  const calc = useMemo(() => {
    if (!dados) return null
    const ativas = dados.dividas.filter((d) => d.status !== 'quitada')
    const plano = simular(dados.dividas, { orcamento: orcamentoEfetivo(perfil, dados.dividas), metodo: perfil.metodo })
    const inicial = dados.dividas.reduce((s, d) => s + Number(d.saldo_inicial), 0)
    const atual = ativas.reduce((s, d) => s + Number(d.saldo_atual), 0)
    const jurosMes = ativas.reduce((s, d) => s + (Number(d.saldo_atual) * Number(d.juros_mensal)) / 100, 0)
    const insights = radar({
      dividas: dados.dividas, ultimosPagamentos: dados.ultimosPagamentos,
      renda: dados.renda, despesas: dados.totalDespesas,
    })
    return { ativas, plano, inicial, atual, jurosMes, progresso: inicial ? (inicial - atual) / inicial : 0, insights }
  }, [dados, perfil])

  if (!dados || !calc) return <p className="suave">Carregando…</p>

  const primeiroNome = perfil.nome.split(' ')[0]

  if (!dados.dividas.length) {
    return (
      <>
        <div className="cabecalho">
          <h1>Olá, {primeiroNome}</h1>
          <p>Em dois passos a VINA monta seu plano para sair das dívidas e mostra a data em que você fica livre delas.</p>
        </div>
        <ol className="bloco" style={{ paddingLeft: 36 }}>
          <li style={{ marginBottom: 10 }}>
            <strong>Informe sua renda e seus gastos essenciais.</strong>{' '}
            {dados.renda != null ? <span className="destaque-verde">Feito.</span> : <Link href="/renda">Informar renda</Link>}
          </li>
          <li><strong>Cadastre suas dívidas.</strong> <Link href="/dividas">Cadastrar a primeira dívida</Link></li>
        </ol>
      </>
    )
  }

  const { plano } = calc
  let heroiTitulo, heroiData, heroiSub
  if (!calc.ativas.length) {
    heroiTitulo = 'Você está livre das dívidas cadastradas'
    heroiData = 'Parabéns!'
    heroiSub = 'Agora o próximo passo é montar uma reserva para imprevistos.'
  } else if (!plano.viavel) {
    heroiTitulo = 'Seu plano ainda não fecha'
    heroiData = `Faltam ${dinheiro(plano.deficit)}`
    heroiSub = 'por mês para cobrir as parcelas mínimas. Veja as saídas no Radar abaixo.'
  } else if (!plano.quitou) {
    heroiTitulo = 'Com o valor atual, as dívidas não diminuem'
    heroiData = 'Ajuste o plano'
    heroiSub = 'Os juros estão crescendo mais rápido do que os pagamentos.'
  } else {
    heroiTitulo = 'Seu dia da liberdade'
    heroiData = mesAno(somarMeses(plano.meses))
    heroiSub = `Daqui a ${duracao(plano.meses)}, pagando ${dinheiro(plano.verba)} por mês.`
  }

  const hoje = new Date().getDate()
  const vencendo = calc.ativas
    .filter((d) => d.dia_vencimento)
    .map((d) => ({ ...d, falta: (d.dia_vencimento - hoje + 31) % 31 }))
    .filter((d) => d.falta <= 10)
    .sort((a, b) => a.falta - b.falta)

  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); setMsg({ texto: 'Mensagem copiada.' }) }
    catch { setMsg({ erro: true, texto: 'Não deu para copiar. Selecione o texto e copie manualmente.' }) }
  }

  return (
    <>
      <section className="heroi" aria-label="Resumo do plano">
        <div className="heroi-rotulo">{heroiTitulo}</div>
        <div className="heroi-data">{heroiData}</div>
        <div className="heroi-sub">{heroiSub}</div>
        <div className="trilho" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(calc.progresso * 100)} aria-label="Quanto já foi quitado">
          <div className="trilho-cheio" style={{ width: `${Math.max(calc.progresso * 100, 1.5)}%` }} />
        </div>
        <div className="trilho-legenda">
          <span>{pct(calc.progresso * 100, 0)} quitado</span>
          <span>Faltam {dinheiro(calc.atual)}</span>
        </div>
      </section>

      <div className="numeros">
        <div className="numero"><div className="numero-valor">{dinheiro(calc.jurosMes)}</div><div className="numero-rotulo">de juros por mês, estimado</div></div>
        <div className="numero"><div className="numero-valor">{dinheiro(plano.somaMinimos)}</div><div className="numero-rotulo">em parcelas mínimas</div></div>
        <div className="numero">
          <div className="numero-valor">{dados.rendaLivre != null ? dinheiro(dados.rendaLivre) : '—'}</div>
          <div className="numero-rotulo">{dados.rendaLivre != null ? 'sobram após gastos essenciais' : <Link href="/renda">Informe sua renda</Link>}</div>
        </div>
      </div>

      {plano.viavel && plano.primeiroMes?.length > 0 && (
        <>
          <h2>Este mês, pague assim</h2>
          <div className="bloco">
            {plano.primeiroMes.map((p) => (
              <div key={p.id} className={p.prioridade ? 'passo foco' : 'passo'}>
                <span>{p.prioridade ? <strong>{p.nome} (foco do mês)</strong> : p.nome}</span>
                <strong>{dinheiro(p.valor)}</strong>
              </div>
            ))}
            <p className="pequeno suave" style={{ marginTop: 10, marginBottom: 0 }}>
              Tudo o que passa do mínimo vai para a dívida em foco. <Link href="/plano">Ver o plano completo</Link>
            </p>
          </div>
        </>
      )}

      {vencendo.length > 0 && (
        <>
          <h2>Vencendo nos próximos dias</h2>
          <ul className="lista bloco">
            {vencendo.map((d) => (
              <li key={d.id}>
                <span>{d.nome} <span className="suave">dia {d.dia_vencimento}</span></span>
                <span className={d.falta <= 2 ? 'selo atrasada' : 'selo'}>{d.falta === 0 ? 'hoje' : `em ${d.falta} dia${d.falta > 1 ? 's' : ''}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {calc.insights.length > 0 && (
        <>
          <h2>Radar</h2>
          {calc.insights.map((i) => (
            <div key={i.id} className={`insight ${i.tipo}`}>
              <h3>{i.titulo}</h3>
              <p>{i.texto}</p>
              {i.tipo === 'negociacao' && (
                <div style={{ marginTop: 10 }}>
                  {mensagem?.dividaId === i.dividaId ? (
                    <>
                      <label htmlFor={`m-${i.id}`}>Revise antes de enviar</label>
                      <textarea id={`m-${i.id}`} value={mensagem.texto} onChange={(e) => setMensagem({ ...mensagem, texto: e.target.value })} />
                      <div className="linha-botoes" style={{ marginTop: 8 }}>
                        <button className="pequeno" onClick={() => copiar(mensagem.texto)}>Copiar mensagem</button>
                        <a className="botao secundario pequeno" href={`https://wa.me/?text=${encodeURIComponent(mensagem.texto)}`} target="_blank" rel="noreferrer">
                          Abrir no WhatsApp
                        </a>
                      </div>
                    </>
                  ) : (
                    <button className="pequeno secundario" onClick={() => {
                      const d = dados.dividas.find((x) => x.id === i.dividaId)
                      setMensagem({ dividaId: d.id, texto: mensagemNegociacao(d, perfil.nome) })
                    }}>Escrever mensagem para o credor</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}
      <Aviso msg={msg} onFechar={() => setMsg(null)} />
    </>
  )
}
