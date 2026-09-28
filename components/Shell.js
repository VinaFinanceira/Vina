'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSessao } from './Sessao'
import Marca from './Marca'
import Consentimento from './Consentimento'

const LINKS = [
  { href: '/', rotulo: 'Painel' },
  { href: '/dividas', rotulo: 'Dívidas' },
  { href: '/plano', rotulo: 'Plano' },
  { href: '/renda', rotulo: 'Renda' },
  { href: '/conta', rotulo: 'Conta' },
]

export default function Shell({ children }) {
  const caminho = usePathname()
  const s = useSessao()

  if (caminho.startsWith('/entrar')) return children
  if (s.carregando) return <div className="tela-cheia"><Marca /></div>
  if (!s.perfil) return <div className="tela-cheia"><p className="suave">Não foi possível carregar sua conta. Recarregue a página.</p></div>
  if (!s.perfil.consentimento_em) return <Consentimento />

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-linha">
          <Link href="/" className="sem-sublinhado"><Marca claro /></Link>
          <nav className="nav" aria-label="Seções">
            {LINKS.map((l) => {
              const ativo = l.href === '/' ? caminho === '/' : caminho.startsWith(l.href)
              return (
                <Link key={l.href} href={l.href} className={ativo ? 'nav-item ativo' : 'nav-item'} aria-current={ativo ? 'page' : undefined}>
                  {l.rotulo}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="conteudo">{children}</main>
    </div>
  )
}
