import sqlite3

NOME_BANCO = 'banco_sistema'


def conectar():
    """Abre uma conexão com o banco. Use sempre com consultas parametrizadas (?)."""
    conexao = sqlite3.connect(NOME_BANCO)
    conexao.row_factory = sqlite3.Row
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

    conexao.commit()
    conexao.close()


if __name__ == "__main__":
    criar_tabelas()
