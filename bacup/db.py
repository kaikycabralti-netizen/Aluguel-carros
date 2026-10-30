import sqlite3

NOME_BANCO = 'banco_sistema.db'


def conectar():
    """Abre uma conexão com o banco. Use sempre com consultas parametrizadas (?)."""
    conexao = sqlite3.connect(NOME_BANCO)
    conexao.row_factory = sqlite3.Row  # permite acessar colunas pelo nome: linha["email_hash"]
    return conexao


def criar_tabelas():
    conexao = conectar()
    cursor = conexao.cursor()

    # tabela de usuarios atualizada para suportar hashes de busca e dados mascarados
    cursor.execute('''CREATE TABLE IF NOT EXISTS usuarios(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    cpf_hash TEXT NOT NULL UNIQUE,
                    email_hash TEXT NOT NULL UNIQUE,
                    cpf_mascarado TEXT NOT NULL,
                    email_mascarado TEXT NOT NULL,
                    senha TEXT NOT NULL)''')

    # tabela de veiculos
    cursor.execute('''CREATE TABLE IF NOT EXISTS veiculos(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    marca TEXT NOT NULL,
                    modelo TEXT NOT NULL,
                    ano INTEGER NOT NULL,
                    placa TEXT NOT NULL UNIQUE,
                    status TEXT NOT NULL DEFAULT 'disponivel')''')

    # tabela de alugueis
    cursor.execute('''CREATE TABLE IF NOT EXISTS alugueis(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    veiculo_id INTEGER NOT NULL,
                    cliente_id INTEGER NOT NULL,
                    data_inicio DATE NOT NULL,
                    data_fim DATE NOT NULL,
                    valor_total REAL NOT NULL,
                    FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
                    FOREIGN KEY (cliente_id) REFERENCES usuarios(id))''')

    # ----------------------------------------------------------
    # Colunas adicionadas dinamicamente caso o banco já exista
    # ----------------------------------------------------------
    for tabela, coluna, definicao in [
        ("usuarios", "perfil", "TEXT NOT NULL DEFAULT 'cliente'"),
        # Garantindo que se a tabela antiga já existir, ela receba as novas colunas de segurança:
        ("usuarios", "cpf_hash", "TEXT UNIQUE"),
        ("usuarios", "email_hash", "TEXT UNIQUE"),
        ("usuarios", "cpf_mascarado", "TEXT"),
        ("usuarios", "email_mascarado", "TEXT"),
        ("veiculos", "preco_diaria", "REAL NOT NULL DEFAULT 0"),
        ("alugueis", "forma_pagamento", "TEXT"),
        ("veiculos", "imagem", "TEXT"),
    ]:
        existentes = [l["name"] for l in cursor.execute(f"PRAGMA table_info({tabela})")]
        if coluna not in existentes:
            cursor.execute(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {definicao}")

    # Padroniza o status dos veículos antigos
    cursor.execute("UPDATE veiculos SET status = lower(status)")
    cursor.execute("UPDATE veiculos SET status = replace(status, 'í', 'i')")
    cursor.execute("UPDATE veiculos SET status = replace(status, 'ê', 'e')")

    conexao.commit()
    conexao.close()


if __name__ == "__main__":
    criar_tabelas()