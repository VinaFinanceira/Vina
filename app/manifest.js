export default function manifest() {
  return {
    name: 'VINA',
    short_name: 'VINA',
    description: process.env.NEXT_PUBLIC_SLOGAN || 'sua IA para organizar dívidas',
    start_url: '/',
    display: 'standalone',
    background_color: '#F4F3F8',
    theme_color: '#2A2170',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
