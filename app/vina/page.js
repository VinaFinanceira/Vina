'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useSessao } from '@/components/Sessao'
import Proposta from '@/components/Proposta'
import { prepararAnexo } from '@/lib/imagem'

const SUGESTOES = [
  'Tenho uma dívida de R$ 2.000 no cartão com juros de 12% ao mês',
  'Quero comprar um tênis de R$ 800. Como faço?',
  'Paguei R$ 300 no cartão hoje',
  'Qual dívida devo pagar primeiro e por quê?',
]

export default function PaginaVina() {
  return (
    <Suspense fallback={<p className="suave">Carregando…</p>}>
      <Vina />
    </Suspense>
  )
}

function Vina() {
  const { perfil } = useSessao()
  const params = useSearchParams()
  const [msgs, setMsgs] = useState([])          // { papel, texto, previa?, propostas? }
  const [texto, setTexto] = useState('')
  const [anexo, setAnexo] = useState(null)
  const [pensando, setPensando] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [temVoz, setTemVoz] = useState(false)
  const [dividas, setDividas] = useState([])
  const arquivoRef = useRef(null)
  const fimRef = useRef(null)
  const vozRef = useRef(null)
  const enviouInicial = useRef(false)

  const carregarDividas = useCallback(async () => {
    const { data } = await supabase().from('dividas').select('id, nome, saldo_atual, saldo_inicial, status')
    setDividas(data || [])
  }, [])

  useEffect(() => { carregarDividas() }, [carregarDividas])
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs, pensando])
  useEffect(() => { setTemVoz(typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)) }, [])

  const enviar = useCallback(async (textoEnvio, anexoEnvio) => {
    const t = (textoEnvio ?? '').trim()
    if (!t && !anexoEnvio) return
    const historico = msgs.map((m) => ({ papel: m.papel, texto: m.papel === 'usuario' && m.previa !== undefined ? `${m.texto || ''} [enviou uma foto/documento]` : m.texto }))
    setMsgs((m) => [...m, { papel: 'usuario', texto: t, previa: anexoEnvio ? anexoEnvio.previa || anexoEnvio.nome : undefined }])
    setTexto('')
    setAnexo(null)
    setPensando(true)
    try {
      const r = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ texto: t, historico, anexo: anexoEnvio ? { tipo: anexoEnvio.tipo, base64: anexoEnvio.base64 } : null }),
      })
      const corpo = await r.json().catch(() => ({ erro: 'Resposta inesperada do servidor. Recarregue a página.' }))
      setMsgs((m) => [...m, corpo.erro
        ? { papel: 'erro', texto: corpo.erro }
        : { papel: 'vina', texto: corpo.texto, propostas: corpo.propostas || [] }])
    } catch {
      setMsgs((m) => [...m, { papel: 'erro', texto: 'Sem conexão. Confira sua internet e tente de novo.' }])
    } finally {
      setPensando(false)
    }
  }, [msgs])

  // Pergunta vinda de outra tela (ex.: Radar do painel)
  useEffect(() => {
    const p = params.get('p')
    if (p && !enviouInicial.current) {
      enviouInicial.current = true
      enviar(p, null)
    }
  }, [params, enviar])

  async function escolherArquivo(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { setAnexo(await prepararAnexo(f)) }
    catch (err) { setMsgs((m) => [...m, { papel: 'erro', texto: err.message }]) }
  }

  function alternarVoz() {
    if (ouvindo) { vozRef.current?.stop(); return }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.interimResults = true
    rec.continuous = false
    const base = texto ? `${texto} ` : ''
    rec.onresult = (ev) => {
      let fala = ''
      for (let i = 0; i < ev.results.length; i++) fala += ev.results[i][0].transcript
      setTexto(base + fala)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') setMsgs((m) => [...m, { papel: 'erro', texto: 'Libere o microfone para o site nas configurações do navegador.' }])
    }
    rec.onend = () => setOuvindo(false)
    vozRef.current = rec
    rec.start()
    setOuvindo(true)
  }

  function aoEnviar(e) {
    e.preventDefault()
    if (ouvindo) vozRef.current?.stop()
    enviar(texto, anexo)
  }

  const primeiroNome = perfil?.nome?.split(' ')[0]

  return (
    <div className="chat">
      <div className="chat-mensagens" aria-live="polite">
        {msgs.length === 0 && (
          <div className="chat-inicio">
            <h1>Oi, {primeiroNome}. Me conta o que está acontecendo.</h1>
            <p className="suave">Fale, escreva ou mande a foto de um boleto, fatura, extrato, comprovante, contracheque ou até de algo que você quer comprar. Eu organizo e deixo tudo pronto para você só confirmar.</p>
            <div className="sugestoes">
              {SUGESTOES.map((s) => <button key={s} className="sugestao" onClick={() => enviar(s, null)}>{s}</button>)}
              <button className="sugestao" onClick={() => arquivoRef.current?.click()}>Fotografar um boleto ou fatura</button>
            </div>
          </div>
        )}

        {msgs.map((m, i) => (
          <div key={i} className={`bolha ${m.papel}`}>
            {m.previa && (m.previa.startsWith('data:')
              ? <img src={m.previa} alt="Foto enviada" className="bolha-foto" />
              : <div className="pequeno">Documento: {m.previa}</div>)}
            {m.texto && <div className="bolha-texto">{m.texto}</div>}
            {m.propostas?.map((p) => <Proposta key={p.id} proposta={p} dividas={dividas} aoSalvar={carregarDividas} />)}
          </div>
        ))}
        {pensando && <div className="bolha vina pensando">{anexo || msgs.at(-1)?.previa ? 'Lendo o documento…' : 'Pensando…'}</div>}
        <div ref={fimRef} />
      </div>

      <form className="chat-entrada" onSubmit={aoEnviar}>
        {anexo && (
          <div className="anexo">
            {anexo.previa ? <img src={anexo.previa} alt="Foto a enviar" /> : <span className="pequeno">{anexo.nome}</span>}
            <button type="button" className="link pequeno" onClick={() => setAnexo(null)}>Remover</button>
          </div>
        )}
        <div className="chat-linha">
          <input ref={arquivoRef} type="file" accept="image/*,application/pdf" hidden onChange={escolherArquivo} />
          <button type="button" className="icone" onClick={() => arquivoRef.current?.click()} aria-label="Enviar foto ou PDF" title="Foto ou PDF">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/></svg>
          </button>
          {temVoz && (
            <button type="button" className={ouvindo ? 'icone ouvindo' : 'icone'} onClick={alternarVoz} aria-label={ouvindo ? 'Parar de ouvir' : 'Falar'} aria-pressed={ouvindo} title="Falar">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V22h2v-3.1a7 7 0 0 0 6-6.9h-2Z"/></svg>
            </button>
          )}
          <label htmlFor="msg" className="sr-only">Mensagem para a VINA</label>
          <textarea id="msg" rows={1} value={texto} placeholder={ouvindo ? 'Pode falar…' : 'Escreva para a VINA'}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) aoEnviar(e) }} />
          <button disabled={pensando || (!texto.trim() && !anexo)}>Enviar</button>
        </div>
        <div className="ajuda">A VINA pode errar. Confira os números antes de confirmar.</div>
      </form>
    </div>
  )
}
