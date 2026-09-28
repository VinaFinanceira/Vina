// Prepara foto/PDF para enviar à IA: reduz fotos grandes (mais rápido e mais barato).
const MAX_LADO = 1600
const MAX_PDF = 3 * 1024 * 1024

export async function prepararAnexo(arquivo) {
  if (arquivo.type === 'application/pdf') {
    if (arquivo.size > MAX_PDF) throw new Error('PDF muito grande. Envie um de até 3 MB ou tire um print da página.')
    return { tipo: 'application/pdf', base64: await paraBase64(arquivo), previa: null, nome: arquivo.name }
  }
  if (!arquivo.type.startsWith('image/')) throw new Error('Envie uma foto (JPG, PNG) ou um PDF.')

  const url = URL.createObjectURL(arquivo)
  try {
    const img = await new Promise((ok, falha) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => falha(new Error('Não consegui abrir essa imagem. Tente outra foto.'))
      i.src = url
    })
    const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala)
    c.height = Math.round(img.height * escala)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const dataUrl = c.toDataURL('image/jpeg', 0.85)
    return { tipo: 'image/jpeg', base64: dataUrl.split(',')[1], previa: dataUrl, nome: arquivo.name }
  } finally {
    URL.revokeObjectURL(url)
  }
}

function paraBase64(arquivo) {
  return new Promise((ok, falha) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1])
    r.onerror = () => falha(new Error('Não consegui ler o arquivo.'))
    r.readAsDataURL(arquivo)
  })
}
