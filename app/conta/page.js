'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/components/Sessao'
import Aviso, { textoErro } from '@/components/Aviso'
import Marca from '@/components/Marca'

export default function Conta() {
  const router = useRouter()
  const s = useSessao()
  const [nome, setNome] = useState(s.perfil.nome)
  const [confirmacao, setConfirmacao] = useState('')
  const [msg, setMsg] = useState(null)

  async function salvarNome(e) {
    e.preventDefault()
    const { error } = await supabase().from('perfis').update({ nome: nome.trim() }).eq('id', s.perfil.id)
    setMsg(error ? { erro: true, texto: textoErro(error) } : { texto: 'Nome atualizado.' })
    s.recarregar()
  }

  async function sair() {
    await supabase().auth.signOut()
    router.replace('/entrar')
    router.refresh()
  }

  async function excluirTudo() {
    const { error } = await supabase().rpc('excluir_meus_dados')
    if (error) return setMsg({ erro: true, texto: textoErro(error) })
    await supabase().auth.signOut()
    router.replace('/entrar')
    router.refresh()
  }

  const aceite = s.perfil.consentimento_em && new Date(s.perfil.consentimento_em).toLocaleDateString('pt-BR')

  return (
    <>
      <div className="cabecalho"><h1>Conta</h1></div>

      <form className="bloco" onSubmit={salvarNome}>
        <label htmlFor="nome">Seu nome</label>
        <div className="linha-botoes" style={{ flexWrap: 'nowrap' }}>
          <input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          <button>Salvar</button>
        </div>
      </form>

      <div className="bloco">
        <h3>Privacidade</h3>
        <p className="suave">Você autorizou o uso dos seus dados em {aceite} (termo versão {s.perfil.consentimento_versao}). Eles são usados apenas para calcular seu plano e seus alertas, e só você tem acesso a eles. Conversas e fotos enviadas à assistente são processadas por um provedor de IA (como Google Gemini ou Anthropic Claude) e as fotos não ficam guardadas.</p>
        <button className="secundario" onClick={sair}>Sair da conta</button>
      </div>

      <div className="bloco" style={{ borderColor: 'var(--vermelho)' }}>
        <h3>Apagar conta e todos os dados</h3>
        <p className="suave">Remove de vez sua conta, renda, gastos, dívidas e pagamentos. Não dá para desfazer.</p>
        <label htmlFor="conf">Digite APAGAR para confirmar</label>
        <input id="conf" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} style={{ maxWidth: 240, marginBottom: 12 }} />
        <div><button className="perigo" disabled={confirmacao.trim().toUpperCase() !== 'APAGAR'} onClick={excluirTudo}>Apagar tudo</button></div>
      </div>

      <p className="pequeno suave" style={{ textAlign: 'center', marginTop: 32 }}><Marca comSlogan /></p>
      <Aviso msg={msg} onFechar={() => setMsg(null)} />
    </>
  )
}
