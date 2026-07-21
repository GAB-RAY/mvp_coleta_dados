-- ============================================================
-- MVP DE COLETA DE DADOS
-- PostgreSQL
-- ============================================================

-- Este script deve ser executado dentro do banco escolhido.
-- Exemplo de nome do banco:
-- sistema_coleta_dados


-- ============================================================
-- TABELA: usuarios
-- Usuários internos autorizados a acessar a área administrativa.
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    nome VARCHAR(150) NOT NULL,

    email VARCHAR(200) NOT NULL,

    senha_hash VARCHAR(255) NOT NULL,

    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT usuarios_nome_nao_vazio
        CHECK (LENGTH(TRIM(nome)) >= 2),

    CONSTRAINT usuarios_email_nao_vazio
        CHECK (LENGTH(TRIM(email)) >= 5)
);


-- O LOWER garante que emails com letras maiúsculas e minúsculas
-- sejam considerados iguais.
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico
    ON usuarios (LOWER(email));


-- ============================================================
-- TABELA: contatos
-- Cadastros realizados pelo formulário público.
-- ============================================================

CREATE TABLE IF NOT EXISTS contatos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    nome VARCHAR(150) NOT NULL,

    telefone VARCHAR(30) NOT NULL,

    telefone_normalizado VARCHAR(20) NOT NULL,

    bairro VARCHAR(150) NOT NULL,

    problema VARCHAR(500) NOT NULL,

    consentimento_armazenamento BOOLEAN NOT NULL,

    consentimento_mensagens BOOLEAN NOT NULL DEFAULT FALSE,

    consentimento_armazenamento_em TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    consentimento_mensagens_em TIMESTAMPTZ,

    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT contatos_nome_nao_vazio
        CHECK (LENGTH(TRIM(nome)) >= 2),

    CONSTRAINT contatos_telefone_nao_vazio
        CHECK (LENGTH(TRIM(telefone)) >= 8),

    CONSTRAINT contatos_telefone_normalizado_apenas_numeros
        CHECK (telefone_normalizado ~ '^[0-9]+$'),

    CONSTRAINT contatos_telefone_normalizado_tamanho
        CHECK (
            LENGTH(telefone_normalizado) >= 10
            AND LENGTH(telefone_normalizado) <= 15
        ),

    CONSTRAINT contatos_bairro_nao_vazio
        CHECK (LENGTH(TRIM(bairro)) >= 2),

    CONSTRAINT contatos_problema_nao_vazio
        CHECK (LENGTH(TRIM(problema)) >= 3),

    CONSTRAINT contatos_consentimento_armazenamento_obrigatorio
        CHECK (consentimento_armazenamento = TRUE),

    CONSTRAINT contatos_data_consentimento_mensagens
        CHECK (
            (
                consentimento_mensagens = TRUE
                AND consentimento_mensagens_em IS NOT NULL
            )
            OR
            (
                consentimento_mensagens = FALSE
                AND consentimento_mensagens_em IS NULL
            )
        )
);


-- Impede duplicidade de telefone.
CREATE UNIQUE INDEX IF NOT EXISTS contatos_telefone_normalizado_unico
    ON contatos (telefone_normalizado);


-- Índices para melhorar as buscas administrativas.
CREATE INDEX IF NOT EXISTS contatos_nome_indice
    ON contatos (LOWER(nome));

CREATE INDEX IF NOT EXISTS contatos_bairro_indice
    ON contatos (LOWER(bairro));

CREATE INDEX IF NOT EXISTS contatos_problema_indice
    ON contatos (LOWER(problema));

CREATE INDEX IF NOT EXISTS contatos_criado_em_indice
    ON contatos (criado_em DESC);


-- ============================================================
-- FUNÇÃO: atualizar automaticamente atualizado_em
-- ============================================================

CREATE OR REPLACE FUNCTION atualizar_data_modificacao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


-- ============================================================
-- TRIGGER: usuarios
-- ============================================================

DROP TRIGGER IF EXISTS usuarios_atualizar_data
ON usuarios;

CREATE TRIGGER usuarios_atualizar_data
BEFORE UPDATE ON usuarios
FOR EACH ROW
EXECUTE FUNCTION atualizar_data_modificacao();


-- ============================================================
-- TRIGGER: contatos
-- ============================================================

DROP TRIGGER IF EXISTS contatos_atualizar_data
ON contatos;

CREATE TRIGGER contatos_atualizar_data
BEFORE UPDATE ON contatos
FOR EACH ROW
EXECUTE FUNCTION atualizar_data_modificacao();


-- ============================================================
-- COMENTÁRIOS DAS TABELAS
-- ============================================================

COMMENT ON TABLE usuarios IS
'Usuários internos autorizados a acessar o painel administrativo.';

COMMENT ON COLUMN usuarios.senha_hash IS
'Hash da senha gerado pela aplicação com bcrypt. Nunca armazenar senha em texto puro.';

COMMENT ON TABLE contatos IS
'Pessoas cadastradas por meio do formulário público.';

COMMENT ON COLUMN contatos.telefone IS
'Telefone no formato informado pela pessoa.';

COMMENT ON COLUMN contatos.telefone_normalizado IS
'Telefone contendo somente números, utilizado para impedir duplicidade.';

COMMENT ON COLUMN contatos.consentimento_armazenamento IS
'Indica autorização para armazenamento dos dados. Deve ser verdadeiro para existir cadastro.';

COMMENT ON COLUMN contatos.consentimento_mensagens IS
'Indica se a pessoa autorizou mensagens futuras.';

COMMENT ON COLUMN contatos.consentimento_armazenamento_em IS
'Data e hora em que o consentimento para armazenamento foi registrado.';

COMMENT ON COLUMN contatos.consentimento_mensagens_em IS
'Data e hora da autorização para mensagens futuras. Fica nulo quando não autorizado.';


-- ============================================================
-- CONSULTAS DE VERIFICAÇÃO
-- ============================================================

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;


-- ============================================================
-- EXEMPLO DE CONSULTA ADMINISTRATIVA
-- Não é necessário executar durante a criação.
-- ============================================================

-- SELECT
--     id,
--     nome,
--     telefone,
--     bairro,
--     problema,
--     consentimento_armazenamento,
--     consentimento_mensagens,
--     criado_em,
--     atualizado_em
-- FROM contatos
-- WHERE
--     nome ILIKE '%maria%'
--     AND bairro ILIKE '%campo grande%'
--     AND problema ILIKE '%iluminação%'
-- ORDER BY criado_em DESC;


-- ============================================================
-- EXEMPLO DE CADASTRO DE CONTATO
-- A aplicação deve usar queries parametrizadas.
-- ============================================================

-- INSERT INTO contatos (
--     nome,
--     telefone,
--     telefone_normalizado,
--     bairro,
--     problema,
--     consentimento_armazenamento,
--     consentimento_mensagens,
--     consentimento_mensagens_em
-- )
-- VALUES (
--     'Maria da Silva',
--     '(21) 99999-9999',
--     '21999999999',
--     'Campo Grande',
--     'Falta de iluminação',
--     TRUE,
--     FALSE,
--     NULL
-- );


-- ============================================================
-- IMPORTANTE SOBRE O PRIMEIRO ADMINISTRADOR
-- ============================================================

-- Não cadastre uma senha diretamente por SQL.
-- Crie o primeiro administrador com o script Node.js,
-- pois a senha deve passar pelo bcrypt.
--
-- Exemplo do resultado esperado:
--
-- INSERT INTO usuarios (
--     nome,
--     email,
--     senha_hash
-- )
-- VALUES (
--     'Administrador',
--     'admin@email.com',
--     '$2b$12$HASH_GERADO_PELO_BCRYPT'
-- );