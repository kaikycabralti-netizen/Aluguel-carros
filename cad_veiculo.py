import re
import sqlite3

NOME_BANCO = 'banco_sistema.db'


# ---------------------- cadastro de veículos ----------------------
def cadastrar_veiculo(marca, modelo, ano, placa, status, preco_diaria):
    # preco_diaria é a coluna nova: sem ela o veículo fica com diária 0
    # e não pode ser alugado.
    conexao = sqlite3.connect(NOME_BANCO)
    cursor = conexao.cursor()
    cursor.execute(
        '''INSERT INTO veiculos (marca, modelo, ano, placa, status, preco_diaria)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (marca, modelo, ano, placa, status, preco_diaria),
    )
    conexao.commit()
    conexao.close()
    print("Veículo cadastrado com sucesso!")


# ---------------------- deletar veículos ----------------------
def deletar_veiculo(id_veiculo):
    conexao = sqlite3.connect(NOME_BANCO)
    cursor = conexao.cursor()
    # Usa o "?" e o id recebido (antes estava "WHERE id = 4" fixo).
    cursor.execute('''DELETE FROM veiculos WHERE id = ?''', (id_veiculo,))
    conexao.commit()
    conexao.close()
    print("Veículo removido.")


# ---------------------- listagem de veículos ----------------------
def listar_veiculos():
    conexao = sqlite3.connect(NOME_BANCO)
    cursor = conexao.cursor()
    cursor.execute('''SELECT * FROM veiculos''')
    veiculos = cursor.fetchall()
    conexao.close()
    return veiculos


# ---------------------- inclusão pelo terminal ----------------------
def main():
    marca_veiculo = input("Digite a marca: ").strip()
    modelo_veiculo = input("Digite o modelo: ").strip()

    # ano e diária precisam ser números (o input devolve texto)
    try:
        ano_veiculo = int(input("Digite o ano: "))
        preco_diaria = float(input("Digite a diária (ex.: 200 ou 199.90): ").replace(",", "."))
    except ValueError:
        print("Ano e diária precisam ser números. Nada foi cadastrado.")
        return

    # O painel admin só aceita de 1990 em diante, e a diária precisa ser maior que 0
    if ano_veiculo < 1990 or preco_diaria <= 0:
        print("Ano precisa ser 1990 ou mais e a diária maior que 0. Nada foi cadastrado.")
        return

    # Placa em maiúscula, sem hífen/espaço: ABC1234 ou ABC1D23
    placa_veiculo = re.sub(r"[\s-]", "", input("Digite a placa: ")).upper()
    if not re.match(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$", placa_veiculo):
        print("Placa inválida. Use ABC1234 ou ABC1D23. Nada foi cadastrado.")
        return

    # Status por número (Enter = disponível). O valor gravado sai certo:
    # minúsculo e sem acento, que é o que o catálogo reconhece.
    print("Status: 1 = disponível | 2 = alugado | 3 = manutenção")
    opcao = input("Escolha [1]: ").strip() or "1"
    opcoes = {"1": "disponivel", "2": "alugado", "3": "manutencao"}
    if opcao not in opcoes:
        print("Opção inválida. Nada foi cadastrado.")
        return
    status_veiculo = opcoes[opcao]

    try:
        cadastrar_veiculo(marca_veiculo, modelo_veiculo, ano_veiculo,
                          placa_veiculo, status_veiculo, preco_diaria)
    except sqlite3.IntegrityError:
        # a coluna placa é UNIQUE: placa repetida cai aqui
        print("Já existe um veículo com essa placa.")


# O bloco que executa o programa fica no FIM, depois de todas as funções.
if __name__ == "__main__":
    main()