import { NextResponse } from 'next/server'
import { supabaseServidor } from '@/lib/servidor'
import { montarContexto } from '@/lib/contexto'
import { promptSistema } from '@/lib/prompt'
import { conversar, chaveConfigurada, provedorAtivo, ErroIA } from '@/lib/ia'
import { simular } from '@/lib/plano'
import { mesAno, somarMeses } from '@/lib/formato'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const LIMITE = Number(process.env.IA_LIMITE_DIARIO || 40)
const TIPOS_MIDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']

export async function POST(req) {
  if (!chaveConfigurada()) {
    const falta = provedorAtivo() === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'
    return NextResponse.json({ erro: `A IA ainda não foi configurada: falta a variável ${falta} na Vercel.` }, { status: 500 })
  }

  const sb = await supabaseServidor()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ erro: 'Sua sessão expirou. Entre de novo.' }, { status: 401 })

  let corpo
  try { corpo = await req.json() } catch { return NextResponse.json({ erro: 'Pedido inválido.' }, { status: 400 }) }

  const texto = String(corpo.texto || '').slice(0, 4000)
  const anexo = corpo.anexo || null
  if (!texto && !anexo) return NextResponse.json({ erro: 'Escreva, fale ou envie uma foto.' }, { status: 400 })
  if (anexo && (!TIPOS_MIDIA.includes(anexo.tipo) || typeof anexo.base64 !== 'string')) {
    return NextResponse.json({ erro: 'Formato de arquivo não suportado. Envie foto (JPG, PNG) ou PDF.' }, { status: 400 })
  }
  const historico = (Array.isArray(corpo.historico) ? corpo.historico.slice(-12) : [])
    .filter((m) => (m.papel === 'usuario' || m.papel === 'vina') && m.texto)
    .map((m) => ({ role: m.papel === 'usuario' ? 'user' : 'assistant', texto: String(m.texto).slice(0, 4000) }))

  const { data: dentro } = await sb.rpc('registrar_uso_ia', { p_limite: LIMITE })
  if (!dentro) {
    return NextResponse.json({ erro: `Você chegou ao limite de ${LIMITE} conversas com a VINA hoje. Amanhã tem mais.` }, { status: 429 })
  }

  const ctx = await montarContexto(sb)
  const propostas = []

  // Executa as ferramentas pedidas pela IA. "propor_*" só vira cartão na tela.
  async function executar(nome, input, id) {
    if (nome === 'simular_plano') {
      const metodo = input.metodo || ctx.metodo
      const descr = (s) => !s.viavel ? { viavel: false, falta_por_mes: Math.round(s.deficit) }
        : !s.quitou ? { quita: false } : { meses: s.meses, livre_em: mesAno(somarMeses(s.meses)), juros_total: Math.round(s.jurosTotal) }
      const base = simular(ctx.dividas, { orcamento: ctx.orcamento, metodo })
      const novo = simular(ctx.dividas, { orcamento: ctx.orcamento, metodo, extra: Number(input.extra_mensal) || 0 })
      return JSON.stringify({ plano_atual: descr(base), com_mudanca: descr(novo) })
    }
    if (nome.startsWith('propor_')) {
      propostas.push({ id, tipo: nome.replace('propor_', ''), dados: input })
      return 'Proposta exibida na tela para a pessoa revisar e confirmar. Ainda não foi salva.'
    }
    return 'Ferramenta desconhecida.'
  }

  try {
    const textos = await conversar({ system: promptSistema(ctx.resumo), historico, atual: { texto, anexo }, executar })
    return NextResponse.json({
      texto: textos.join('\n\n') || (propostas.length ? 'Deixei pronto para você conferir.' : 'Não entendi bem. Pode explicar de outro jeito?'),
      propostas,
    })
  } catch (e) {
    return NextResponse.json({ erro: e instanceof ErroIA ? e.message : 'Não consegui falar com a IA agora. Tente de novo.' }, { status: 502 })
  }
}
