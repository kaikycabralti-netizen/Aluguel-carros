import sqlite3

banco = sqlite3.connect('banco_sistema')
cursor = banco.cursor()

#tabela de usuarios
cursor.execute('''CREATE TABLE IF NOT EXISTS usuarios(
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               nome TEXT NOT NULL,
               cpf TEXT NOT NULL UNIQUE,
               email TEXT NOT NULL UNIQUE,
               senha TEXT NOT NULL)''')
banco.commit()
banco.close()

banco = sqlite3.connect('banco_sistema')
cursor = banco.cursor()
#tabela de veiculos
cursor.execute('''CREATE TABLE IF NOT EXISTS veiculos(
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               marca TEXT NOT NULL,
               modelo TEXT NOT NULL,
               ano INTEGER NOT NULL,
               placa TEXT NOT NULL UNIQUE,
               status TEXT NOT NULL DEFAULT 'disponivel')''')
banco.commit()
banco.close()

banco = sqlite3.connect('banco_sistema')
cursor = banco.cursor()
#tabela de alugueis
cursor.execute('''CREATE TABLE IF NOT EXISTS alugueis(
               id INTEGER PRIMARY KEY AUTOINCREMENT,
               veiculo_id INTEGER NOT NULL,
               cliente_id INTEGER NOT NULL,
               data_inicio DATE NOT NULL,
               data_fim DATE NOT NULL,
               valor_total REAL NOT NULL,
               FOREIGN KEY (veiculo_id) REFERENCES veiculos(id),
               FOREIGN KEY (cliente_id) REFERENCES clientes(id))''')

banco.commit()
banco.close()