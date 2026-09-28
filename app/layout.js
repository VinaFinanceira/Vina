import './globals.css'
import { Sessao } from '@/components/Sessao'
import Shell from '@/components/Shell'

export const metadata = {
  title: 'VINA',
  description: process.env.NEXT_PUBLIC_SLOGAN || 'sua IA para organizar dívidas',
}

export const viewport = { themeColor: '#2A2170', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <Sessao>
          <Shell>{children}</Shell>
        </Sessao>
      </body>
    </html>
  )
}
