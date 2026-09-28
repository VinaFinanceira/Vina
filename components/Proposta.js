'use client'

// Cartão de confirmação: mostra o que a VINA preparou, deixa editar e só
// salva quando a pessoa confirma. "A palavra final é sempre sua."
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TIPOS, STATUS } from '@/lib/dividas'
import { dinheiro, num } from '@/lib/formato'
import { textoErro } from './Aviso'

const TITULOS = {
  divida: 'Nova dívida',
  atualizar_divida: 'Atualizar dívida',
  pagamento: 'Registrar pagamento',
  renda: 'Renda do mês',
  despesa: 'Gasto essencial',
  meta_compra: 'Meta de compra',
}
const OPC_TIPO = TIPOS.map((t) => ({ v: t.id, r: t.nome }))
const OPC_STATUS = STATUS.filter((s) => s.id !== 'quitada').map((s) => ({ v: s.id, r: s.nome }))
const OPC_RENDA = [{ v: 'clt', r: 'Carteira assinada' }, { v: 'autonomo', r: 'Autônomo / PJ' }, { v: 'outro', r: 'Outra' }]

function campos(tipo, dividas) {
  const opcDividas = dividas.filter((d) => d.status !== 'quitada').map((d) => ({ v: d.id, r: `${d.nome} (${dinheiro(d.saldo_atual)})` }))
  switch (tipo) {
    case 'divida': return [
      ['nome', 'Nome', 'texto'], ['tipo', 'Tipo', OPC_TIPO], ['saldo_atual', 'Quanto falta pagar (R$)', 'valor'],
      ['parcela_minima', 'Parcela mínima (R$)', 'valor'], ['juros_mensal', 'Juros ao mês (%)', 'valor'],
      ['dia_vencimento', 'Dia do vencimento', 'inteiro'], ['status', 'Situação', OPC_STATUS]]
    case 'atualizar_divida': return [
      ['divida_id', 'Dívida', opcDividas], ['saldo_atual', 'Novo saldo (R$)', 'valor'], ['parcela_minima', 'Parcela mínima (R$)', 'valor'],
      ['juros_mensal', 'Juros ao mês (%)', 'valor'], ['dia_vencimento', 'Dia do vencimento', 'inteiro'], ['status', 'Situação', OPC_STATUS]]
    case 'pagamento': return [['divida_id', 'Em qual dívida', opcDividas], ['valor', 'Valor pago (R$)', 'valor'], ['data', 'Data', 'data']]
    case 'renda': return [
      ['mes_referencia', 'Mês', 'mes'], ['tipo', 'De onde vem', OPC_RENDA], ['bruto', 'Bruto (R$)', 'valor'],
      ['descontos', 'Descontos (R$)', 'valor'], ['liquido', 'Líquido (R$)', 'valor'], ['beneficios', 'Benefícios (R$)', 'valor']]
    case 'despesa': return [['nome', 'Gasto', 'texto'], ['valor', 'Valor por mês (R$)', 'valor']]
    case 'meta_compra': return [['nome', 'O que você quer comprar', 'texto'], ['valor_alvo', 'Preço (R$)', 'valor'], ['aporte_mensal', 'Guardar por mês (R$)', 'valor']]
    default: return []
  }
}

async function salvar(tipo, d, dividas) {
  const sb = supabase()
  const n = (k) => num(d[k])
  switch (tipo) {
    case 'divida': {
      const ref = TIPOS.find((t) => t.id === d.tipo)?.jurosRef ?? 4
      const juros = n('juros_mensal')
      return sb.from('dividas').insert({
        nome: d.nome, tipo: d.tipo || 'outro', saldo_inicial: n('saldo_atual'), saldo_atual: n('saldo_atual'),
        juros_mensal: juros ?? ref, juros_estimado: juros == null, parcela_minima: n('parcela_minima') || 0,
        dia_vencimento: n('dia_vencimento'), status: d.status || 'em_dia',
      })
    }
    case 'atualizar_divida': {
      const atual = dividas.find((x) => x.id === d.divida_id)
      if (!atual) throw new Error('Escolha a dívida.')
      const mud = { atualizado_em: new Date().toISOString() }
      for (const k of ['saldo_atual', 'parcela_minima', 'juros_mensal', 'dia_vencimento']) if (n(k) != null) mud[k] = n(k)
      if (d.status) mud.status = d.status
      if (mud.juros_mensal != null) mud.juros_estimado = false
      if (mud.saldo_atual != null && mud.saldo_atual > Number(atual.saldo_inicial)) mud.saldo_inicial = mud.saldo_atual
      return sb.from('dividas').update(mud).eq('id', d.divida_id)
    }
    case 'pagamento':
      if (!d.divida_id) throw new Error('Escolha em qual dívida foi o pagamento.')
      return sb.from('pagamentos').insert({ divida_id: d.divida_id, valor: n('valor'), data: d.data })
    case 'renda':
      return sb.from('rendas').upsert({
        mes_referencia: `${d.mes_referencia}-01`, tipo: d.tipo || 'clt', bruto: n('bruto'), descontos: n('descontos'), liquido: n('liquido'),
        beneficios: n('beneficios') ? [{ nome: 'Benefícios', valor: n('beneficios') }] : [],
      }, { onConflict: 'usuario_id,mes_referencia' })
    case 'despesa':
      return sb.from('despesas').insert({ nome: d.nome, valor: n('valor') })
    case 'meta_compra':
      return sb.from('metas_compra').insert({ nome: d.nome, valor_alvo: n('valor_alvo'), aporte_mensal: n('aporte_mensal'), caminho: d.caminho || null, origem: 'vina' })
  }
}

export default function Proposta({ proposta, dividas, aoSalvar }) {
  const inicial = { ...proposta.dados }
  if (proposta.tipo === 'pagamento' && !inicial.data) inicial.data = new Date().toISOString().slice(0, 10)
  if (proposta.tipo === 'renda' && inicial.mes_referencia) inicial.mes_referencia = String(inicial.mes_referencia).slice(0, 7)
  const [d, setD] = useState(inicial)
  const [estado, setEstado] = useState('aberta')   // aberta | salvando | salva | descartada
  const [erro, setErro] = useState('')

  async function confirmar() {
    setEstado('salvando')
    setErro('')
    try {
      const { error } = (await salvar(proposta.tipo, d, dividas)) || {}
      if (error) throw error
      setEstado('salva')
      aoSalvar?.()
    } catch (e) {
      setErro(textoErro(e))
      setEstado('aberta')
    }
  }

  if (estado === 'salva') return <div className="proposta feita">{TITULOS[proposta.tipo]}: salvo.</div>
  if (estado === 'descartada') return <div className="proposta feita descartada">{TITULOS[proposta.tipo]}: descartado.</div>

  return (
    <div className="proposta">
      <div className="proposta-titulo">{TITULOS[proposta.tipo] || proposta.tipo}</div>
      {(d.observacao || d.motivo || d.caminho) && <p className="pequeno suave" style={{ margin: '0 0 8px' }}>{d.observacao || d.motivo || d.caminho}</p>}
      <div className="proposta-campos">
        {campos(proposta.tipo, dividas).map(([k, rotulo, tipo]) => {
          const id = `${proposta.id}-${k}`
          return (
            <div key={k}>
              <label htmlFor={id}>{rotulo}</label>
              {Array.isArray(tipo) ? (
                <select id={id} value={d[k] ?? ''} onChange={(e) => setD({ ...d, [k]: e.target.value })}>
                  <option value="">Escolha…</option>
                  {tipo.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
                </select>
              ) : (
                <input id={id}
                  type={tipo === 'valor' || tipo === 'inteiro' ? 'number' : tipo === 'data' ? 'date' : tipo === 'mes' ? 'month' : 'text'}
                  inputMode={tipo === 'valor' ? 'decimal' : undefined} step={tipo === 'valor' ? '0.01' : undefined}
                  placeholder={k === 'juros_mensal' ? 'Não sei (estimar)' : ''}
                  value={d[k] ?? ''} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
              )}
            </div>
          )
        })}
      </div>
      {erro && <p className="erro-texto pequeno">{erro}</p>}
      <div className="linha-botoes" style={{ marginTop: 10 }}>
        <button className="pequeno" disabled={estado === 'salvando'} onClick={confirmar}>{estado === 'salvando' ? 'Salvando…' : 'Confirmar e salvar'}</button>
        <button className="pequeno secundario" onClick={() => setEstado('descartada')}>Descartar</button>
      </div>
    </div>
  )
}
