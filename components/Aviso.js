'use client'

export default function Aviso({ msg, onFechar }) {
  if (!msg) return null
  return (
    <div className={msg.erro ? 'aviso erro' : 'aviso'} role="status">
      <span>{msg.texto}</span>
      <button className="link" onClick={onFechar} aria-label="Fechar aviso">Fechar</button>
    </div>
  )
}

// Converte erros do Supabase em texto útil
export function textoErro(e) {
  const m = e?.message || String(e)
  if (m.includes('duplicate key')) return 'Esse registro já existe.'
  if (m.includes('row-level security')) return 'Você não tem permissão para essa ação.'
  return m
}
