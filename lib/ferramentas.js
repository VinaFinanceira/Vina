// Ferramentas que a IA pode usar. Todas as "propor_*" só PROPÕEM:
// a pessoa revisa e confirma na tela antes de qualquer coisa ser salva.
const TIPOS_DIVIDA = ['cartao_rotativo', 'cheque_especial', 'consignado', 'financiamento', 'carne_pix_parcelado', 'emprestimo_pessoal', 'outro']
const STATUS = ['em_dia', 'atrasada', 'negativada', 'renegociada']

export const FERRAMENTAS = [
  {
    name: 'propor_divida',
    description: 'Propõe cadastrar uma NOVA dívida (a pessoa confirma na tela). Use para dívida contada na conversa, boleto/fatura/carta de cobrança fotografada ou cada parcela recorrente encontrada num extrato. Não use se a dívida já existe na lista: nesse caso use propor_atualizar_divida.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome curto e reconhecível, ex.: "Cartão Nubank", "Carnê Casas Bahia"' },
        tipo: { type: 'string', enum: TIPOS_DIVIDA },
        saldo_atual: { type: 'number', description: 'Quanto falta pagar hoje, em reais' },
        juros_mensal: { type: 'number', description: 'Juros em % ao mês. Omita se não souber.' },
        parcela_minima: { type: 'number', description: 'Parcela ou pagamento mínimo mensal, em reais' },
        dia_vencimento: { type: 'integer', minimum: 1, maximum: 31 },
        status: { type: 'string', enum: STATUS },
        observacao: { type: 'string', description: 'Algo que a pessoa deve conferir, ex.: "boleto vencido em março: confirme se ainda está em aberto"' },
      },
      required: ['nome', 'tipo', 'saldo_atual'],
    },
  },
  {
    name: 'propor_atualizar_divida',
    description: 'Propõe atualizar uma dívida que JÁ EXISTE (novo saldo, juros, parcela, vencimento ou situação), ex.: nova fatura do mesmo cartão, renegociação.',
    input_schema: {
      type: 'object',
      properties: {
        divida_id: { type: 'string', description: 'id exato da dívida na lista' },
        divida_nome: { type: 'string' },
        saldo_atual: { type: 'number' },
        juros_mensal: { type: 'number' },
        parcela_minima: { type: 'number' },
        dia_vencimento: { type: 'integer', minimum: 1, maximum: 31 },
        status: { type: 'string', enum: STATUS },
        motivo: { type: 'string', description: 'Por que atualizar, em uma frase' },
      },
      required: ['divida_id', 'divida_nome', 'motivo'],
    },
  },
  {
    name: 'propor_pagamento',
    description: 'Propõe registrar um pagamento feito em uma dívida existente (ex.: comprovante de Pix/boleto fotografado, ou "paguei 200 no cartão").',
    input_schema: {
      type: 'object',
      properties: {
        divida_id: { type: 'string', description: 'id exato da dívida correspondente; vazio se não houver correspondência clara' },
        divida_nome: { type: 'string' },
        valor: { type: 'number' },
        data: { type: 'string', description: 'AAAA-MM-DD' },
        destinatario: { type: 'string', description: 'Quem recebeu, como aparece no comprovante' },
      },
      required: ['valor', 'data'],
    },
  },
  {
    name: 'propor_renda',
    description: 'Propõe registrar a renda de um mês (ex.: contracheque/holerite fotografado, ou "ganho 3 mil líquidos").',
    input_schema: {
      type: 'object',
      properties: {
        mes_referencia: { type: 'string', description: 'AAAA-MM' },
        tipo: { type: 'string', enum: ['clt', 'autonomo', 'outro'] },
        bruto: { type: 'number' },
        descontos: { type: 'number' },
        liquido: { type: 'number', description: 'Valor que cai na conta' },
        beneficios: { type: 'number', description: 'Soma de VA/VR e similares, se houver' },
      },
      required: ['mes_referencia', 'liquido'],
    },
  },
  {
    name: 'propor_despesa',
    description: 'Propõe cadastrar um gasto essencial fixo mensal (aluguel, luz, mercado, transporte, remédios). Nunca use para dívidas.',
    input_schema: {
      type: 'object',
      properties: { nome: { type: 'string' }, valor: { type: 'number' } },
      required: ['nome', 'valor'],
    },
  },
  {
    name: 'propor_meta_compra',
    description: 'Propõe criar uma meta de compra rastreada, depois que a pessoa escolheu um caminho para comprar algo (ou fotografou um produto com preço).',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        valor_alvo: { type: 'number' },
        aporte_mensal: { type: 'number', description: 'Quanto guardar por mês no caminho escolhido' },
        caminho: { type: 'string', description: 'Resumo do caminho escolhido, em uma frase' },
      },
      required: ['nome', 'valor_alvo'],
    },
  },
  {
    name: 'simular_plano',
    description: 'Calcula de verdade o efeito no plano de dívidas de mudar o valor mensal. Use SEMPRE antes de afirmar quanto tempo ou quanto de juros algo muda. extra_mensal positivo = pagar mais; negativo = tirar dinheiro do plano (ex.: para juntar para uma compra).',
    input_schema: {
      type: 'object',
      properties: {
        extra_mensal: { type: 'number' },
        metodo: { type: 'string', enum: ['hibrido', 'avalanche', 'bola_de_neve'] },
      },
      required: ['extra_mensal'],
    },
  },
]
