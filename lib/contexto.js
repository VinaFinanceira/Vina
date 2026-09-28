// Monta o retrato financeiro da pessoa que vai no contexto da IA.
import { simular } from './plano'
import { rendaReferencia, nomeTipo } from './dividas'

export async function montarContexto(sb) {
  const [{ data: perfil }, { data: rendas }, { data: despesas }, { data: dividas }, { data: metas }] = await Promise.all([
    sb.from('perfis').select('nome, metodo, orcamento_dividas').single(),
    sb.from('rendas').select('mes_referencia, tipo, liquido, bruto, descontos').order('mes_referencia', { ascending: false }).limit(6),
    sb.from('despesas').select('nome, valor'),
    sb.from('dividas').select('*').order('criado_em'),
    sb.from('metas_compra').select('id, nome, valor_alvo, valor_guardado, aporte_mensal, status').eq('status', 'ativa'),
  ])

  const ativas = (dividas || []).filter((d) => d.status !== 'quitada')
  const renda = rendaReferencia(rendas || [])
  const totalDespesas = (despesas || []).reduce((s, d) => s + Number(d.valor), 0)
  const rendaLivre = renda != null ? renda - totalDespesas : null
  const somaMinimos = ativas.reduce((s, d) => s + Number(d.parcela_minima), 0)
  const orcamento = perfil?.orcamento_dividas != null ? Number(perfil.orcamento_dividas) : somaMinimos
  const plano = simular(dividas || [], { orcamento, metodo: perfil?.metodo || 'hibrido' })
  const aportesMetas = (metas || []).reduce((s, m) => s + Number(m.aporte_mensal || 0), 0)
  const folga = rendaLivre != null ? rendaLivre - orcamento - aportesMetas : null

  const r2 = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100)
  const resumo = {
    hoje: new Date().toISOString().slice(0, 10),
    nome: perfil?.nome,
    renda_liquida_referencia: r2(renda),
    ultimas_rendas: (rendas || []).map((r) => ({ mes: r.mes_referencia.slice(0, 7), tipo: r.tipo, liquido: r2(r.liquido) })),
    despesas_essenciais: (despesas || []).map((d) => ({ nome: d.nome, valor: r2(d.valor) })),
    total_despesas_essenciais: r2(totalDespesas),
    renda_livre_apos_essenciais: r2(rendaLivre),
    orcamento_mensal_para_dividas: r2(orcamento),
    soma_parcelas_minimas: r2(somaMinimos),
    aportes_mensais_em_metas: r2(aportesMetas),
    folga_mensal_sem_mexer_no_plano: r2(folga),
    metodo_do_plano: perfil?.metodo,
    plano: plano.viavel
      ? { quita_tudo: plano.quitou, meses_ate_quitar: plano.quitou ? plano.meses : null, juros_projetados: r2(plano.jurosTotal),
          ordem_quitacao: plano.quitacoes.map((q) => `${q.nome} (mês ${q.mes})`) }
      : { viavel: false, falta_por_mes_para_cobrir_minimos: r2(plano.deficit) },
    dividas: (dividas || []).map((d) => ({
      id: d.id, nome: d.nome, tipo: nomeTipo(d.tipo), saldo_atual: r2(d.saldo_atual), juros_mensal_pct: Number(d.juros_mensal),
      juros_estimado: d.juros_estimado, parcela_minima: r2(d.parcela_minima), dia_vencimento: d.dia_vencimento, status: d.status,
    })),
    metas_de_compra: (metas || []).map((m) => ({ id: m.id, nome: m.nome, alvo: r2(m.valor_alvo), guardado: r2(m.valor_guardado), aporte_mensal: r2(m.aporte_mensal) })),
  }

  return { resumo, dividas: dividas || [], orcamento, metodo: perfil?.metodo || 'hibrido', plano }
}
