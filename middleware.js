import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !chave || !url.startsWith('https://')) {
    return new NextResponse(
      'VINA: configuração incompleta. Na Vercel, confira NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em Settings > Environment Variables e faça um novo deploy.',
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    )
  }

  let resposta = NextResponse.next({ request })

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value))
        resposta = NextResponse.next({ request })
        cookies.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const caminho = request.nextUrl.pathname
  const publica = caminho.startsWith('/entrar')

  if (!user && caminho.startsWith('/api/')) {
    return NextResponse.json({ erro: 'Sua sessão expirou. Entre de novo.' }, { status: 401 })
  }
  if (!user && !publica) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/entrar'
    return NextResponse.redirect(destino)
  }
  if (user && publica) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/'
    return NextResponse.redirect(destino)
  }
  return resposta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest.webmanifest).*)'],
}
