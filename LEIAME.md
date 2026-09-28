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

## Próximas fases (do roadmap)
- **Fase 2:** foto de contracheque, boleto e comprovante. Usa a API do Claude com visão, chamada por uma Edge Function do Supabase para a chave nunca ficar exposta no navegador. Tem custo por uso, pequeno por foto.
- **Fase 3:** voz (Web Speech API, gratuita) e "Posso comprar isso?".
- **Fase 4:** chat educativo e Radar com texto gerado por IA.
- **Fase 5:** emblemas e notificações push.
