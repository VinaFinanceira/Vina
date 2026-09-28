'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Marca from '@/components/Marca'

export default function Entrar() {
  const router = useRouter()
  const [modo, setModo] = useState('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true)
    setMsg('')
    const sb = supabase()
    const { data, error } = modo === 'entrar'
      ? await sb.auth.signInWithPassword({ email, password: senha })
      : await sb.auth.signUp({ email, password: senha, options: { data: { nome } } })
    setEnviando(false)
    if (error) return setMsg(error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : error.message)
    if (!data.session) return setMsg('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.')
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="tela-cheia">
      <div className="caixa">
        <Marca comSlogan />
        <h1 style={{ marginTop: 28 }}>{modo === 'entrar' ? 'Que bom te ver de novo' : 'Vamos organizar isso juntos'}</h1>
        <p className="suave">{modo === 'entrar' ? 'Entre para ver seu plano.' : 'Crie sua conta. Leva menos de um minuto.'}</p>
        <form onSubmit={enviar}>
          {modo === 'cadastrar' && (
            <div><label htmlFor="nome">Como podemos te chamar?</label>
              <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="given-name" /></div>
          )}
          <div><label htmlFor="email">E-mail</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
          <div><label htmlFor="senha">Senha</label>
            <input id="senha" type="password" minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} required
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} />
            {modo === 'cadastrar' && <div className="ajuda">Mínimo de 8 caracteres.</div>}</div>
          {msg && <p role="alert" className="pequeno">{msg}</p>}
          <button disabled={enviando}>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
        </form>
        <p className="pequeno" style={{ marginTop: 18 }}>
          {modo === 'entrar' ? 'Ainda não tem conta? ' : 'Já tem conta? '}
          <button className="link" onClick={() => { setModo(modo === 'entrar' ? 'cadastrar' : 'entrar'); setMsg('') }}>
            {modo === 'entrar' ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </div>
  )
}
