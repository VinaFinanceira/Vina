export const SLOGAN = process.env.NEXT_PUBLIC_SLOGAN || 'sua IA para organizar dívidas'

export default function Marca({ comSlogan = false, claro = false }) {
  return (
    <span className={`marca ${claro ? 'claro' : ''}`}>
      <span className="marca-nome">VINA</span>
      {comSlogan && <span className="marca-slogan">{SLOGAN}</span>}
    </span>
  )
}
