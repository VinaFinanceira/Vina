// Camada de IA com dois provedores:
//  - gemini    (Google AI Studio; tem camada gratuita para teste)
//  - anthropic (Claude; pago por uso)
// Escolha com IA_PROVEDOR. Sem ela, usa anthropic se houver ANTHROPIC_API_KEY, senão gemini.
import { FERRAMENTAS } from './ferramentas'

const RODADAS = 5

export function provedorAtivo() {
  const p = (process.env.IA_PROVEDOR || '').toLowerCase()
  if (p === 'gemini' || p === 'anthropic') return p
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'gemini'
}

export function chaveConfigurada() {
  return provedorAtivo() === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY : !!process.env.GEMINI_API_KEY
}

// historico: [{ role: 'user'|'assistant', texto }]
// atual: { texto, anexo: { tipo, base64 } | null }
// executar(nome, input) => string (resultado devolvido à IA)
export async function conversar({ system, historico, atual, executar }) {
  return provedorAtivo() === 'anthropic'
    ? conversarClaude({ system, historico, atual, executar })
    : conversarGemini({ system, historico, atual, executar })
}

export class ErroIA extends Error {
  constructor(msg, status) { super(msg); this.status = status }
}

// Junta mensagens seguidas do mesmo papel (as APIs esperam alternância)
function alternar(lista) {
  const out = []
  for (const m of lista) {
    const ult = out[out.length - 1]
    if (ult && ult.role === m.role) ult.partes.push(...m.partes)
    else out.push({ role: m.role, partes: [...m.partes] })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

function montarLista(historico, atual) {
  const lista = historico.map((m) => ({ role: m.role, partes: [{ texto: m.texto }] }))
  const partes = []
  if (atual.anexo) partes.push({ anexo: atual.anexo })
  partes.push({ texto: atual.texto || 'Analise este documento e cadastre o que for relevante.' })
  lista.push({ role: 'user', partes })
  return alternar(lista)
}

// ---------------------------------------------------------------- Claude
async function conversarClaude({ system, historico, atual, executar }) {
  const modelo = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
  const mensagens = montarLista(historico, atual).map((m) => ({
    role: m.role,
    content: m.partes.map((p) => p.texto !== undefined ? { type: 'text', text: p.texto }
      : p.anexo.tipo === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.anexo.base64 } }
        : { type: 'image', source: { type: 'base64', media_type: p.anexo.tipo, data: p.anexo.base64 } }),
  }))
  const textos = []

  for (let r = 0; r < RODADAS; r++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: modelo, max_tokens: 1500, system, messages: mensagens, tools: FERRAMENTAS }),
    })
    const corpo = await resp.json()
    if (!resp.ok) {
      const m = corpo?.error?.message || ''
      throw new ErroIA(
        resp.status === 401 ? 'A chave da IA (Anthropic) está inválida. Confira ANTHROPIC_API_KEY na Vercel.'
          : m.includes('credit') ? 'Os créditos da Anthropic acabaram. Recarregue em console.anthropic.com.'
          : resp.status === 429 || resp.status === 529 ? 'A IA está sobrecarregada agora. Tente de novo em instantes.'
          : 'Não consegui falar com a IA agora. Tente de novo.', resp.status)
    }
    for (const b of corpo.content) if (b.type === 'text' && b.text.trim()) textos.push(b.text.trim())
    if (corpo.stop_reason !== 'tool_use') break

    const resultados = []
    for (const b of corpo.content.filter((x) => x.type === 'tool_use')) {
      resultados.push({ type: 'tool_result', tool_use_id: b.id, content: await executar(b.name, b.input || {}, b.id) })
    }
    mensagens.push({ role: 'assistant', content: corpo.content })
    mensagens.push({ role: 'user', content: resultados })
  }
  return textos
}

// ---------------------------------------------------------------- Gemini
// O Gemini aceita um subconjunto de JSON Schema: removemos o que ele não usa.
function esquemaGemini(s) {
  if (Array.isArray(s)) return s.map(esquemaGemini)
  if (!s || typeof s !== 'object') return s
  const out = {}
  for (const [k, v] of Object.entries(s)) {
    if (k === 'minimum' || k === 'maximum') continue
    out[k] = esquemaGemini(v)
  }
  return out
}
const FERRAMENTAS_GEMINI = [{
  functionDeclarations: FERRAMENTAS.map((f) => ({ name: f.name, description: f.description, parameters: esquemaGemini(f.input_schema) })),
}]

async function conversarGemini({ system, historico, atual, executar }) {
  const modelo = process.env.GEMINI_MODEL || 'gemini-flash-latest'
  const contents = montarLista(historico, atual).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: m.partes.map((p) => p.texto !== undefined ? { text: p.texto } : { inlineData: { mimeType: p.anexo.tipo, data: p.anexo.base64 } }),
  }))
  const textos = []

  for (let r = 0; r < RODADAS; r++) {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: FERRAMENTAS_GEMINI,
        generationConfig: { maxOutputTokens: 2048 },      }),
    })
    const corpo = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const m = corpo?.error?.message || ''
      throw new ErroIA(
        resp.status === 429 ? 'O limite gratuito do Google foi atingido. Espere um minuto e tente de novo (há também um limite por dia).'
          : resp.status === 400 && m.toLowerCase().includes('api key') ? 'A chave do Gemini está inválida. Confira GEMINI_API_KEY na Vercel.'
          : resp.status === 403 ? 'A chave do Gemini não tem permissão. Gere uma nova no Google AI Studio.'
          : resp.status === 404 ? `O modelo "${modelo}" não foi encontrado. Ajuste GEMINI_MODEL na Vercel.`
          : 'Não consegui falar com a IA agora. Tente de novo.', resp.status)
    }

    const cand = corpo.candidates?.[0]
    const partes = cand?.content?.parts || []
    for (const p of partes) if (p.text && !p.thought && p.text.trim()) textos.push(p.text.trim())
    const chamadas = partes.filter((p) => p.functionCall)
    if (!chamadas.length) {
      if (!partes.length && cand?.finishReason === 'SAFETY') textos.push('Não consegui responder isso. Pode reformular?')
      break
    }

    contents.push(cand.content)   // devolve exatamente o que o modelo mandou
    const respostas = []
    for (let i = 0; i < chamadas.length; i++) {
      const { name, args } = chamadas[i].functionCall
      const resultado = await executar(name, args || {}, `g${r}-${i}-${name}`)
      respostas.push({ functionResponse: { name, response: { resultado } } })
    }
    contents.push({ role: 'user', parts: respostas })
  }
  return textos
}
