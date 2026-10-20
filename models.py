from sqlalchemy import Column, create_engine, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base

#conexão com o banco de dados
db = create_engine('sqlite:///banco_sistema.db',)

#criando a base de dados
Base = declarative_base()

#cria as tabelas no banco de dados

#executa o comando para criar as tabelas no banco de dados