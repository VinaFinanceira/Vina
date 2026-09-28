const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const dinheiro = (v) => brl.format(Number(v) || 0)
export const pct = (v, casas = 1) => `${(Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas })}%`

export function mesAno(data) {
  return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
export function somarMeses(meses, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), 1)
  d.setMonth(d.getMonth() + meses)
  return d
}
export function duracao(meses) {
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const a = Math.floor(meses / 12), m = meses % 12
  return `${a} ${a === 1 ? 'ano' : 'anos'}${m ? ` e ${m} ${m === 1 ? 'mês' : 'meses'}` : ''}`
}
export const num = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')))
