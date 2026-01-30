# Bingola Monetization API (Projeto B - Standalone)

Backend especializado para monetização multi-store (Google Play & Apple App Store).

## Stack
- **NestJS**: Framework core.
- **Supabase/Postgres**: Banco de dados (Wallets, Ledger, Purchases).
- **Google Play Developer API**: Verificação server-side para Android.

## Configuração

1. **Supabase**:
   - Crie um novo projeto no Supabase.
   - Execute o conteúdo de `schema.sql` e `wallet_rpcs.sql` no SQL Editor do Supabase.
   
2. **Ambiente**:
   - Copie `.env.example` para `.env` e preencha as variáveis.
   - Coloque o JSON da Service Account do Google na pasta raiz (conforme configurado no `.env`).

3. **Execução Local (Docker)**:
   ```bash
   docker-compose up -d
   ```

4. **Execução Local (Manual)**:
   ```bash
   npm install
   npm run start:dev
   ```

## Endpoints Principais

### Billing
- `POST /billing/verify`: Valida compra na loja correspondente e credita BCOINS.
  - Body: `{ platform, store, product_id, token_or_tx_id, userId }`

### Wallet
- `GET /wallet/balance/:userId`: Retorna saldo atual.
- `GET /wallet/ledger/:userId`: Retorna histórico de transações.
- `POST /wallet/debit`: Débito manual (para criação de mesas).

## Estrutura Multi-Store
O sistema utiliza um modelo de dados genérico para suportar Android e iOS:
- **Google Play**: Usa `purchaseToken` como `token_or_tx_id`.
- **Apple Store**: Usa `transactionId` como `token_or_tx_id`.

A verificação de iOS está configurada com stubs para facilitar a implementação futura do StoreKit 2.
