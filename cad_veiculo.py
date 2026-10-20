import sqlite3

#cadastro de veiculos
def cadastrar_veiculo(marca, modelo, ano, placa, status):
    conexao = sqlite3.connect('banco_sistema')
    cursor = conexao.cursor()
    cursor.execute('''INSERT INTO veiculos (marca, modelo, ano, placa, status) VALUES (?, ?, ?, ?, ?)''', (marca, modelo, ano, placa, status))
    conexao.commit()
    conexao.close()

    print("Veículo cadastrado com sucesso!")

#inclusao de veiculos
def main():
    marca_veiculo = input("Digite a marca: ")
    modelo_veiculo = input("Digite o modelo: ")
    ano_veiculo = input("Digite o ano: ")
    placa_veiculo = input("Digite a placa: ")
    status_veiculo = input("Digite o status: ")

    cadastrar_veiculo(marca_veiculo, modelo_veiculo, ano_veiculo, placa_veiculo, status_veiculo)

if __name__ == "__main__":
    main()

#deletar veiculos
def deletar_veiculo(id_veiculo):
    conexao = sqlite3.connect('banco_sistema')
    cursor = conexao.cursor()
    cursor.execute('''DELETE FROM veiculos WHERE id = 4''', (id_veiculo,))
    conexao.commit()
    conexao.close()
    
#listagem de veiculos
def listar_veiculos():
    conexao = sqlite3.connect('banco_sistema')
    cursor = conexao.cursor()
    cursor.execute('''SELECT * FROM veiculos''')
    veiculos = cursor.fetchall()
    conexao.close()
    return veiculos