'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSessao } from './Sessao'
import Marca from './Marca'

export const VERSAO_TERMO = '1.0'

export default function Consentimento() {
  const { perfil, recarregar } = useSessao()
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState('')

  async function confirmar() {
    const { error } = await supabase().from('perfis')
      .update({ consentimento_em: new Date().toISOString(), consentimento_versao: VERSAO_TERMO })
      .eq('id', perfil.id)
    if (error) setErro(error.message)
    else recarregar()
  }

  return (
    <div className="tela-cheia">
      <div className="caixa">
        <Marca comSlogan />
        <h1 style={{ marginTop: 24 }}>Antes de começar, {perfil.nome.split(' ')[0]}</h1>
        <p>Para montar seu plano, a VINA vai guardar informações sobre sua renda, suas despesas e suas dívidas.</p>
        <ul className="termos">
          <li>Seus dados ficam protegidos e só você tem acesso a eles.</li>
          <li>Eles servem apenas para calcular seu plano e seus alertas. Não são vendidos nem compartilhados.</li>
          <li>A VINA nunca envia mensagens nem faz pagamentos em seu nome.</li>
          <li>Os cálculos são estimativas para ajudar você a decidir. Não são promessa de resultado nem recomendação de investimento.</li>
          <li>Você pode apagar sua conta e todos os seus dados quando quiser, na tela Conta.</li>
        </ul>
        <label className="check">
          <input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
          Li e concordo com o uso dos meus dados para essas finalidades.
        </label>
        {erro && <p role="alert" className="erro-texto">{erro}</p>}
        <button disabled={!aceito} onClick={confirmar} style={{ width: '100%', marginTop: 16 }}>Concordo e quero começar</button>
      </div>
    </div>
  )
}
