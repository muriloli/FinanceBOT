# Setup do Bot FinanceFlow

## Configuração no Windows

1. **Clone o projeto e instale dependências:**
```bash
git clone [URL_DO_REPO]
cd FinanceBot
npm install
```

2. **Crie o arquivo `.env` na raiz do projeto:**
```env
DATABASE_URL=postgresql://postgres.hnxyploubxgvdsyvnsuu:Murilo013081@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
OPENAI_API_KEY=sk-proj-sua_chave_da_openai_aqui
WEBHOOK_SECRET=financeflow-webhook-secret
```

3. **Inicie o projeto:**
```bash
# Opção 1: Usar cross-env
npx cross-env NODE_ENV=development tsx server/index.ts

# Opção 2: Usar SET (Windows CMD)
SET NODE_ENV=development & npx tsx server/index.ts

# Opção 3: PowerShell
$env:NODE_ENV="development"; npx tsx server/index.ts
```

4. **Teste no Postman:**
- URL: `http://localhost:5000/api/test/process-message`
- Método: POST
- Body: `{"message": "Gastei R$ 50 no almoço", "phone": "5511999999999"}`

## Comandos úteis

- **Verificar se .env existe:** `dir .env` (CMD) ou `ls .env` (PowerShell)
- **Testar conexão:** Acesse `http://localhost:5000/api/test/process-message` no navegador
- **Ver logs:** O console mostrará se as variáveis foram carregadas

## Problemas comuns

1. **DATABASE_URL not set:** Verifique se o arquivo `.env` existe na raiz
2. **NODE_ENV not recognized:** Use cross-env ou SET conforme mostrado acima
3. **OpenAI API key:** Substitua `sua_chave_da_openai_aqui` pela chave real