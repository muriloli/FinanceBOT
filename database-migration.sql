-- SQL Script para criar as tabelas necessárias no Supabase
-- Execute este script no seu banco Supabase para resolver o erro "relation does not exist"

-- Criar tabela conversation_history (se não existir)
CREATE TABLE IF NOT EXISTS conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'chat',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Criar tabela conversation_summary (se não existir)
CREATE TABLE IF NOT EXISTS conversation_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    summary TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at ON conversation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_summary_user_id ON conversation_summary(user_id);

-- Verificar se as tabelas foram criadas com sucesso
SELECT 
    'conversation_history' as table_name,
    COUNT(*) as columns_count
FROM information_schema.columns 
WHERE table_name = 'conversation_history' AND table_schema = 'public'
UNION
SELECT 
    'conversation_summary' as table_name,
    COUNT(*) as columns_count
FROM information_schema.columns 
WHERE table_name = 'conversation_summary' AND table_schema = 'public';