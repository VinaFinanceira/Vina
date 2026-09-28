// Motor de plano de pagamento. Simula mês a mês:
// 1) aplica juros no saldo; 2) paga o mínimo de todas;
// 3) todo o resto do orçamento vai para a dívida prioritária do método.
// Quando uma dívida acaba, o valor dela passa a reforçar a próxima.

const EPS = 0.005

function ordenar(ativas, metodo, alvoHibrido) {
  const porJuros = (a, b) => b.taxa - a.taxa || a.saldo - b.saldo
  const porSaldo = (a, b) => a.saldo - b.saldo || b.taxa - a.taxa
  if (metodo === 'avalanche') return [...ativas].sort(porJuros)
  if (metodo === 'bola_de_neve') return [...ativas].sort(porSaldo)
  const alvo = ativas.find((d) => d.id === alvoHibrido)
  const resto = ativas.filter((d) => d.id !== alvoHibrido).sort(porJuros)
  return alvo ? [alvo, ...resto] : resto
}

export function simular(dividas, { orcamento, metodo = 'hibrido', extra = 0, maxMeses = 600 }) {
  const ds = dividas
    .filter((d) => d.status !== 'quitada' && Number(d.saldo_atual) > EPS)
    .map((d) => ({
      id: d.id,
      nome: d.nome,
      saldo: Number(d.saldo_atual),
      taxa: Number(d.juros_mensal) / 100,
      minimo: Number(d.parcela_minima) || 0,
    }))

  const somaMinimos = ds.reduce((s, d) => s + Math.min(d.minimo, d.saldo), 0)
  const verba = Number(orcamento || 0) + Number(extra || 0)
  const base = { somaMinimos, verba, totalAtual: ds.reduce((s, d) => s + d.saldo, 0) }

  if (!ds.length) return { ...base, viavel: true, meses: 0, jurosTotal: 0, quitacoes: [], primeiroMes: [], quitou: true }
  if (verba + EPS < somaMinimos) return { ...base, viavel: false, deficit: somaMinimos - verba }

  const alvoHibrido = [...ds].sort((a, b) => a.saldo - b.saldo)[0].id
  const prioridade = ordenar(ds, metodo, alvoHibrido)[0].id
  const quitacoes = []
  let jurosTotal = 0
  let primeiroMes = null
  let mes = 0

  while (ds.some((d) => d.saldo > EPS) && mes < maxMeses) {
    mes++
    const pago = {}
    for (const d of ds) {
      if (d.saldo <= EPS) continue
      const j = d.saldo * d.taxa
      d.saldo += j
      jurosTotal += j
    }
    let sobra = verba
    for (const d of ds) {
      if (d.saldo <= EPS) continue
      const p = Math.min(d.minimo, d.saldo, sobra)
      d.saldo -= p
      sobra -= p
      pago[d.id] = p
    }
    for (const d of ordenar(ds.filter((x) => x.saldo > EPS), metodo, alvoHibrido)) {
      if (sobra <= EPS) break
      const p = Math.min(sobra, d.saldo)
      d.saldo -= p
      sobra -= p
      pago[d.id] = (pago[d.id] || 0) + p
    }
    if (mes === 1) {
      primeiroMes = ds.filter((d) => pago[d.id] !== undefined)
        .map((d) => ({ id: d.id, nome: d.nome, valor: pago[d.id], prioridade: d.id === prioridade }))
        .sort((a, b) => b.valor - a.valor)
    }
    for (const d of ds) {
      if (d.saldo <= EPS && !quitacoes.some((q) => q.id === d.id)) {
        d.saldo = 0
        quitacoes.push({ id: d.id, nome: d.nome, mes })
      }
    }
  }

  const quitou = ds.every((d) => d.saldo <= EPS)
  return { ...base, viavel: true, quitou, meses: mes, jurosTotal, quitacoes, primeiroMes }
}

export function compararMetodos(dividas, opcoes) {
  return ['hibrido', 'avalanche', 'bola_de_neve'].map((m) => ({ metodo: m, ...simular(dividas, { ...opcoes, metodo: m }) }))
}
