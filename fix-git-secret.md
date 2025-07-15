# Como Resolver o Problema do Git com Chave de API

## Problema
O GitHub está bloqueando o push porque detectou uma chave de API do OpenAI no arquivo `.env`.

## Solução Rápida

Execute estes comandos no seu terminal (PowerShell) na pasta do projeto:

### 1. Remover o arquivo .env do rastreamento do Git (mas mantê-lo localmente)
```bash
git rm --cached .env
```

### 2. Fazer commit das mudanças
```bash
git add .
git commit -m "Remove .env from tracking and add to .gitignore"
```

### 3. Fazer push para o GitHub
```bash
git push -u origin main
```

## Verificações Adicionais

### Se ainda der erro, remova o arquivo do histórico completamente:
```bash
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' --prune-empty --tag-name-filter cat -- --all
```

### Depois force push (cuidado - isso reescreve o histórico):
```bash
git push origin --force --all
```

## Importante!

Depois de fazer o push com sucesso:

1. **Crie um novo arquivo `.env`** com suas chaves reais
2. **Nunca faça commit do arquivo `.env`** novamente
3. **Use o arquivo `.env.example`** como template para outros desenvolvedores

## Arquivo .env.example (já incluído no projeto)
```
DATABASE_URL=your_database_url_here
OPENAI_API_KEY=your_openai_api_key_here
WEBHOOK_SECRET=your_webhook_secret_here
ZAPI_BASE_URL=your_zapi_base_url_here
ZAPI_TOKEN=your_zapi_token_here
AZURE_SPEECH_KEY=your_azure_speech_key_here
AZURE_SPEECH_REGION=your_azure_speech_region_here
```

## Status Atual
- ✅ `.env` removido do rastreamento
- ✅ `.gitignore` atualizado para ignorar `.env`
- ✅ Chave de API removida do arquivo `.env`