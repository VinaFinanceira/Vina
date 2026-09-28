// Tipos de dívida e juros de referência (% ao mês) usados quando a pessoa
// não sabe a taxa. São estimativas conservadoras; o ideal é conferir no
// contrato, na fatura ou no app do banco (campo CET).
export const TIPOS = [
  { id: 'cartao_rotativo', nome: 'Cartão (rotativo)', jurosRef: 14 },
  { id: 'cheque_especial', nome: 'Cheque especial', jurosRef: 8 },      // teto legal: 8% a.m.
  { id: 'emprestimo_pessoal', nome: 'Empréstimo pessoal', jurosRef: 6 },
  { id: 'carne_pix_parcelado', nome: 'Carnê / Pix parcelado', jurosRef: 5 },
  { id: 'financiamento', nome: 'Financiamento', jurosRef: 2 },
  { id: 'consignado', nome: 'Consignado', jurosRef: 1.8 },
  { id: 'outro', nome: 'Outro', jurosRef: 4 },
]
export const nomeTipo = (id) => TIPOS.find((t) => t.id === id)?.nome || id

export const STATUS = [
  { id: 'em_dia', nome: 'Em dia' },
  { id: 'atrasada', nome: 'Atrasada' },
  { id: 'negativada', nome: 'Negativada' },
  { id: 'renegociada', nome: 'Renegociada' },
  { id: 'quitada', nome: 'Quitada' },
]
export const nomeStatus = (id) => STATUS.find((s) => s.id === id)?.nome || id

export const METODOS = {
  hibrido: {
    nome: 'Híbrido',
    resumo: 'Quita primeiro a menor dívida para ganhar fôlego e depois ataca os juros mais altos.',
  },
  avalanche: {
    nome: 'Avalanche',
    resumo: 'Ataca sempre a dívida com juros mais altos. É o que paga menos juros no total.',
  },
  bola_de_neve: {
    nome: 'Bola de neve',
    resumo: 'Quita da menor para a maior. As vitórias rápidas ajudam a manter o ritmo.',
  },
}

// Renda livre = renda líquida de referência - despesas essenciais.
// Para renda variável (autônomo/outro) usa a média dos últimos 3 meses.
export function rendaReferencia(rendas) {
  if (!rendas?.length) return null
  const ord = [...rendas].sort((a, b) => b.mes_referencia.localeCompare(a.mes_referencia))
  if (ord[0].tipo === 'clt') return Number(ord[0].liquido)
  const ult = ord.slice(0, 3)
  return ult.reduce((s, r) => s + Number(r.liquido), 0) / ult.length
}
