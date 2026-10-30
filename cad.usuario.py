import sqlite3
import bcrypt

#cadastro de usuarios
#comando cadastrar adm
# python -c "import sqlite3,hashlib; e='email-para-vira-adm'; c=sqlite3.connect('banco_sistema.db'); c.execute('UPDATE usuarios SET perfil=? WHERE email_hash=?', ('admin', hashlib.sha256(e.lower().strip().encode()).hexdigest())); c.commit(); print(c.total_changes, 'conta promovida')" 
def cadastrar_usuario(nome, cpf, email, senha):
    conexao = sqlite3.connect('banco_sistema.db')
    cursor = conexao.cursor()
    #senha do usuário é criptografada antes de ser armazenada no banco de dados
    senha_hash = bcrypt.hashpw(senha.encode('utf-8'), bcrypt.gensalt())
    cursor.execute('''INSERT INTO usuarios (nome, cpf, email, senha) VALUES(?, ?, ?, ?)''', (nome, cpf, email, senha_hash))

    conexao.commit()
    conexao.close()
    print("Usuário cadastrado com sucesso!")

#inclusao de usuarios
def main():
    nome_usuario = input("Digite o nome: ")
    cpf_usuario = input("Digite o CPF: ")
    email_usuario = input("Digite o e-mail: ")
    senha_usuario = input("Digite a senha: ")

    cadastrar_usuario(nome_usuario, cpf_usuario, email_usuario, senha_usuario)

if __name__ == "__main__":
    main()

#atualização de usuarios
def atualizar_usuario(id_usuario, nome, cpf, email, senha):
    conexao = sqlite3.connect('banco_sistema.db')
    cursor = conexao.cursor()
    cursor.execute('''UPDATE usuarios SET nome = ?, cpf = ?, email = ?, senha = ? WHERE id = ?''', (nome, cpf, email, senha, id_usuario))

    conexao.commit()
    conexao.close()

#deletar usuarios
def deletar_usuario(id_usuario):
    conexao = sqlite3.connect('banco_sistema.db')
    cursor = conexao.cursor()
    cursor.execute('''DELETE FROM usuarios WHERE id = ?''', (id_usuario,))
    conexao.commit()
    conexao.close()
    
#listagem de usuarios
def listar_usuarios():
    conexao = sqlite3.connect('banco_sistema.db')
    cursor = conexao.cursor()
    cursor.execute('''SELECT * FROM usuarios''')
    pessoa = cursor.fetchall()
    conexao.close()
    return