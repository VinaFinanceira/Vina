# VINA: Fase 1 (MVP)

Next.js (PWA) + Supabase + Vercel, tudo no plano gratuito.

## O que já funciona

- **Conta e consentimento (LGPD).** A pessoa cria a conta e aceita o termo, que fica registrado com data e versão. Na tela Conta ela pode apagar tudo com um clique.
- **Renda.** É informada manualmente: bruto, descontos, líquido e benefícios. Para CLT vale o último mês informado; para autônomo, a média dos últimos 3 meses.
- **Gastos essenciais.** Com eles o app calcula a **renda livre**, que é quanto realmente sobra para as dívidas.
- **Dívidas.** Cada uma tem tipo, saldo, juros, mínimo, vencimento e situação.
  - Com "não sei a taxa", o app usa uma estimativa pelo tipo da dívida e mostra isso para a pessoa.
  - Registrar um pagamento abate o saldo automaticamente. Quando o saldo zera, a dívida é marcada como quitada.
- **Motor de plano.** Tem três estratégias: híbrido (padrão), avalanche e bola de neve. O plano mostra:
  - quanto pagar em cada dívida neste mês;
  - a ordem de quitação;
  - o **dia da liberdade**;
  - os juros projetados até lá;
  - a comparação entre as três estratégias.
- **Simulador "E se".** Um controle deslizante mostra quanto tempo e quanto de juros cada real extra economiza.
- **Radar de Oportunidades (versão por regras, sem custo de IA).** Aponta cinco situações:
  - dívida parada;
  - vitória rápida;
  - juro alto corroendo o progresso;
  - comprometimento de renda acima de 30%;
  - 13º salário chegando.
- **Negociação e superendividamento.** Para dívidas negativadas ou atrasadas, o app monta um rascunho de mensagem de negociação. A pessoa revisa e envia pelo WhatsApp; o app nunca envia sozinho. Quando os mínimos não cabem na renda, o app indica o caminho: Procon, Defensoria e Lei do Superendividamento.
- **Segurança.** Cada pessoa só enxerga os próprios dados, com a regra aplicada no banco (RLS).

## Publicar (≈ 30 min)

### 1. Supabase
1. Em supabase.com, crie um **New project** na região **São Paulo**.
2. Abra o **SQL Editor**, cole `supabase/01_fase1_vina.sql` e clique em **Run**.
3. Em **Authentication → Sign In / Providers → Email**:
   - Para testar, desligue **Confirm email**.
   - Antes de abrir ao público, **ligue de novo** e configure um SMTP próprio (Brevo e Resend têm plano gratuito). O envio de e-mail embutido do Supabase tem limite baixo por hora.
4. Em **Project Settings → API**, copie a **Project URL** e a chave **anon / publishable**.

### 2. GitHub
Crie um repositório e envie todo o conteúdo desta pasta, exceto `node_modules`, `.next` e `.env.local`.

### 3. Vercel
1. Em **Add New → Project**, importe o repositório.
2. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SLOGAN`, que hoje é `sua IA para organizar dívidas`. Para trocar pelo slogan novo, basta mudar essa variável e publicar de novo.
3. Clique em **Deploy**.
4. Copie o endereço gerado e coloque em **Site URL**, no Supabase, em **Authentication → URL Configuration**.

### No celular
- **Android (Chrome):** menu ⋮ → **Adicionar à tela inicial**.
- **iPhone (Safari):** botão compartilhar → **Adicionar à Tela de Início**.

## Rodar no computador
```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev                  # http://localhost:3000
```

## Antes de abrir para o público
- **Política de privacidade e termos de uso** publicados. O termo exibido no app é um resumo e precisa de uma versão completa com o controlador dos dados e um canal de contato.
- **Confirmação de e-mail ligada**, com SMTP próprio.
- **Autenticação de dois fatores (TOTP)**, que o Supabase oferece e pode ser ligada na próxima fase.

## Fase 2: IA (assistente VINA, fotos e voz)

### O que entrou
- **Aba VINA.** É uma conversa por texto, voz (microfone) ou foto/PDF. A assistente cadastra dívidas, pagamentos, renda, gastos e metas a partir do que a pessoa conta ou fotografa. Cada item aparece num cartão editável e **só é salvo quando a pessoa confirma**.
- **Documentos que ela lê:**
  - boleto, fatura ou carta de cobrança: cria a dívida ou atualiza a existente;
  - extrato: encontra parcelas e empréstimos;
  - comprovante: registra o pagamento na dívida certa;
  - contracheque: registra a renda do mês;
  - foto de produto: responde "posso comprar isso?".
- **"Posso comprar isso?".** Mostra primeiro o caminho sem dívida nova, depois o caminho acelerado com o atraso real no plano (calculado, não chutado) e cria a meta de compra.
- **Aba Metas.** Acompanha quanto já foi guardado para cada compra.
- **Negociação.** A partir do Radar, a VINA escreve a mensagem para o credor.
- **Limite diário por pessoa** (padrão: 40 mensagens), para proteger o seu custo.
- **Termo de uso atualizado (versão 1.1).** Informa que as conversas passam por um provedor de IA. Todos aceitam de novo no próximo acesso. As fotos não são guardadas.

### Passo a passo (com Google Gemini, gratuito para teste)
1. **Supabase:** no SQL Editor, rode `supabase/02_fase2_ia.sql`.
2. **Google AI Studio:**
   - Acesse aistudio.google.com e entre com uma conta Google.
   - Clique em **Get API key → Create API key**.
   - Não precisa cadastrar cartão.
3. **Vercel:** em **Settings → Environment Variables**, adicione como **Sensitive**, **sem** `NEXT_PUBLIC_`:
   - `IA_PROVEDOR`, com o valor `gemini`;
   - `GEMINI_API_KEY`, com a chave criada.
   - Opcional: `GEMINI_MODEL`. O padrão é `gemini-2.5-flash`. Se o Google tirar esse modelo do ar, troque pelo Flash mais recente listado no AI Studio.
4. **GitHub:** suba de novo o conteúdo desta pasta. A Vercel publica sozinha.

### Limites da camada gratuita do Gemini
- Algumas requisições por minuto e algumas centenas por dia (o número exato aparece no AI Studio). Serve para testar, não para muitas pessoas ao mesmo tempo.
- **Na camada gratuita o Google pode usar os dados enviados para melhorar os produtos dele.** Teste só com seus próprios dados ou com dados fictícios. Antes de abrir para o público, faça uma destas duas coisas:
  - ative o faturamento no Google (o uso fica pago e barato, e os dados deixam de ser usados para treino);
  - ou troque para a Anthropic.

### Trocar para a Anthropic (pago) depois
1. Crie a conta em console.anthropic.com, adicione créditos e defina um limite de gasto mensal.
2. Crie a chave de API.
3. Na Vercel:
   - mude `IA_PROVEDOR` para `anthropic`;
   - adicione `ANTHROPIC_API_KEY` como **Sensitive**;
   - faça um **Redeploy**.

O código não muda.

### Custo com a Anthropic (estimativa)
- Mensagem de texto: na ordem de 1 a 2 centavos de dólar.
- Foto: na ordem de 3 a 5 centavos de dólar.
- Com `ANTHROPIC_MODEL=claude-haiku-4-5-20251001`, o custo cai mais ou menos pela metade.

## Próximas fases
- Notificações push de vencimento e resumo semanal do Radar.
- Emblemas de progresso.
- Plano Plus (assinatura) para cobrir o custo da IA.
- Arredondamento automático via Pix: depende de Open Finance, que exige parceria com instituição autorizada pelo Banco Central.
