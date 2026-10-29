import sqlite3

NOME_BANCO = 'banco_sistema.db'


def conectar():
    """Abre uma conexão com o banco. Use sempre com consultas parametrizadas (?)."""
    conexao = sqlite3.connect(NOME_BANCO)
    conexao.row_factory = sqlite3.Row   # permite acessar colunas pelo nome: linha["email"]
    return conexao


def criar_tabelas():
    conexao = conectar()
    cursor = conexao.cursor()

    # tabela de usuarios
    cursor.execute('''CREATE TABLE IF NOT EXISTS usuarios(
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   nome TEXT NOT NULL,
                   cpf TEXT NOT NULL UNIQUE,
                   email TEXT NOT NULL UNIQUE,
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
    # (a FK de cliente_id aponta pra "clientes", que ainda não existe: crie essa tabela depois)
    cursor.execute('''CREATE TABLE IF NOT EXISTS alugueis(
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   veiculo_id INTEGER NOT NULL,
                   cliente_id INTEGER NOT NULL,
                   data_inicio DATE NOT NULL,
                   data_fim DATE NOT NULL,
                   valor_total REAL NOT NULL,
                   FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
                   FOREIGN KEY (cliente_id) REFERENCES clientes(id))''')

    # ----------------------------------------------------------
    # NOVO: colunas adicionadas depois que o banco já existia.
    # O "CREATE TABLE IF NOT EXISTS" acima NÃO altera tabela que já existe,
    # então adicionamos as colunas novas aqui, só se ainda não existirem.
    #   usuarios.perfil          -> 'cliente' (padrão) ou 'admin'
    #   veiculos.preco_diaria    -> valor da diária de cada veículo
    #   alugueis.forma_pagamento -> pix, credito, debito, boleto ou retirada
    # Usuários antigos viram 'cliente' automaticamente (DEFAULT).
    # ----------------------------------------------------------
    for tabela, coluna, definicao in [
        ("usuarios", "perfil", "TEXT NOT NULL DEFAULT 'cliente'"),
        ("veiculos", "preco_diaria", "REAL NOT NULL DEFAULT 0"),
        ("alugueis", "forma_pagamento", "TEXT"),
    ]:
        # lista os nomes das colunas que a tabela tem hoje
        existentes = [l["name"] for l in cursor.execute(f"PRAGMA table_info({tabela})")]
        if coluna not in existentes:
            cursor.execute(f"ALTER TABLE {tabela} ADD COLUMN {coluna} {definicao}")

    # NOVO: padroniza o status dos veículos antigos (minúsculo e sem acento)
    # ex.: "Disponível" vira "disponivel"
    cursor.execute("UPDATE veiculos SET status = lower(status)")
    cursor.execute("UPDATE veiculos SET status = replace(status, 'í', 'i')")
    cursor.execute("UPDATE veiculos SET status = replace(status, 'ê', 'e')")

    conexao.commit()
    conexao.close()


if __name__ == "__main__":
    criar_tabelas()