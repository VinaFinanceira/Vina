// Radar de Oportunidades (versão por regras, sem IA).
// Cada insight: { id, tipo, titulo, texto, dividaId? }
import { dinheiro, pct } from './formato'

const DIA = 86400000

export function radar({ dividas, ultimosPagamentos, renda, despesas, hoje = new Date() }) {
  const ativas = dividas.filter((d) => d.status !== 'quitada' && Number(d.saldo_atual) > 0)
  const out = []
  if (!ativas.length) return out

  const somaMin = ativas.reduce((s, d) => s + Number(d.parcela_minima), 0)
  const livre = renda != null ? renda - despesas : null

  // Situação que pede ajuda profissional
  if (livre != null && somaMin > livre) {
    out.push({
      id: 'aperto', tipo: 'alerta',
      titulo: 'As parcelas mínimas passam do que sobra no mês',
      texto: `Depois das despesas essenciais sobram ${dinheiro(Math.max(livre, 0))}, e os mínimos somam ${dinheiro(somaMin)}. `
        + 'Nessa situação vale renegociar e buscar orientação gratuita no Procon ou na Defensoria Pública. '
        + 'A Lei do Superendividamento (Lei 14.181/2021) permite pedir uma repactuação de todas as dívidas de uma vez.',
    })
  } else if (renda && somaMin / renda > 0.3) {
    out.push({
      id: 'comprometimento', tipo: 'alerta',
      titulo: `${pct((somaMin / renda) * 100, 0)} da sua renda já vai para parcelas`,
      texto: 'Acima de 30% o orçamento fica sem folga para imprevistos. Evite novas parcelas até esse número baixar.',
    })
  }

  // Juro alto corroendo o progresso
  const porCusto = [...ativas].sort((a, b) => b.saldo_atual * b.juros_mensal - a.saldo_atual * a.juros_mensal)
  const cara = porCusto[0]
  const custo = (Number(cara.saldo_atual) * Number(cara.juros_mensal)) / 100
  if (custo >= 20) {
    out.push({
      id: `juro-${cara.id}`, tipo: 'custo', dividaId: cara.id,
      titulo: `${cara.nome} custa cerca de ${dinheiro(custo)} só de juros por mês`,
      texto: ativas.length > 1
        ? 'É a dívida que mais pesa no seu bolso hoje. Todo real extra aplicado nela rende mais do que em qualquer outra.'
        : 'Todo real extra que você conseguir aplicar nela reduz esse custo já no mês seguinte.',
    })
  }

  // Vitória rápida
  if (ativas.length >= 2) {
    const menor = [...ativas].sort((a, b) => a.saldo_atual - b.saldo_atual)[0]
    out.push({
      id: `vitoria-${menor.id}`, tipo: 'vitoria', dividaId: menor.id,
      titulo: `Vitória rápida: ${menor.nome}`,
      texto: `Faltam ${dinheiro(menor.saldo_atual)}. Quitando essa, você elimina 1 de ${ativas.length} pendências`
        + (Number(menor.parcela_minima) > 0 ? ` e libera ${dinheiro(menor.parcela_minima)} por mês.` : '.'),
    })
  }

  // Negociação
  for (const d of ativas.filter((x) => x.status === 'negativada' || x.status === 'atrasada')) {
    out.push({
      id: `negociar-${d.id}`, tipo: 'negociacao', dividaId: d.id,
      titulo: `${d.nome} pode ter desconto para pagar à vista`,
      texto: d.status === 'negativada'
        ? 'Dívidas negativadas costumam ter bons descontos em negociação. Vale procurar o credor ou plataformas oficiais como o Serasa Limpa Nome e o Desenrola, quando disponível.'
        : 'Negociar logo no início do atraso evita que a dívida cresça com multa e juros de mora.',
    })
  }

  // Dívida parada: sem pagamento registrado há mais de 45 dias
  for (const d of ativas) {
    const ult = ultimosPagamentos[d.id]
    const refData = new Date(ult || d.criado_em)
    const dias = Math.floor((hoje - refData) / DIA)
    if (dias > 45 && Number(d.parcela_minima) > 0) {
      out.push({
        id: `parada-${d.id}`, tipo: 'parada', dividaId: d.id,
        titulo: `${d.nome} está sem pagamento registrado há ${dias} dias`,
        texto: 'Você pagou e esqueceu de registrar, ou ela ficou parada? Registre o pagamento ou atualize o saldo para o plano continuar certo.',
      })
    }
  }

  // Entrada extra sazonal: 13º salário
  const mes = hoje.getMonth() + 1
  if (mes >= 10) {
    out.push({
      id: `decimo-${hoje.getFullYear()}`, tipo: 'extra',
      titulo: 'O 13º salário está chegando',
      texto: 'Se você tem carteira assinada, a 1ª parcela sai até 30 de novembro e a 2ª até 20 de dezembro. '
        + 'Direcionar parte dela para a dívida mais cara adianta bastante o seu dia da liberdade. Teste o valor no simulador do Plano.',
    })
  }

  return out
}

export function mensagemNegociacao(d, nome) {
  return [
    'Olá, tudo bem?',
    '',
    `Meu nome é ${nome} e tenho um débito com vocês referente a "${d.nome}", com saldo atual de aproximadamente ${dinheiro(d.saldo_atual)}.`,
    'Quero regularizar essa situação e gostaria de saber quais condições vocês conseguem oferecer:',
    '• desconto para pagamento à vista; ou',
    '• parcelamento com parcelas que caibam no meu orçamento, sem juros abusivos.',
    '',
    'Peço que me enviem a proposta por escrito, com o valor total e o CET.',
    'Obrigado(a).',
  ].join('\n')
}
