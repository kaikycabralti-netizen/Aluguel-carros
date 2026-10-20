import re
import sqlite3

import bcrypt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from db import conectar

# O front chama /api/login e /api/registrar
auth_router = APIRouter(prefix="/api", tags=["auth"])


class RegistroIn(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    cpf: str
    email: EmailStr
    senha: str = Field(min_length=8, max_length=72)  # bcrypt só usa os 72 primeiros bytes


class LoginIn(BaseModel):
    email: EmailStr
    senha: str = Field(min_length=1, max_length=72)


def cpf_valido(cpf: str) -> bool:
    """Valida CPF (formato e dígitos verificadores). Aceita com ou sem pontuação."""
    numeros = re.sub(r"\D", "", cpf)
    if len(numeros) != 11 or numeros == numeros[0] * 11:
        return False
    for i in (9, 10):
        soma = sum(int(numeros[j]) * (i + 1 - j) for j in range(i))
        digito = (soma * 10 % 11) % 10
        if digito != int(numeros[i]):
            return False
    return True


@auth_router.post("/registrar", status_code=201)
async def registrar(dados: RegistroIn):
    if not cpf_valido(dados.cpf):
        raise HTTPException(status_code=422, detail="CPF inválido")

    cpf = re.sub(r"\D", "", dados.cpf)
    email = dados.email.lower()
    senha_hash = bcrypt.hashpw(dados.senha.encode("utf-8"), bcrypt.gensalt())

    conexao = conectar()
    try:
        # Consulta parametrizada (?) contra SQL Injection
        conexao.execute(
            "INSERT INTO usuarios (nome, cpf, email, senha) VALUES (?, ?, ?, ?)",
            (dados.nome.strip(), cpf, email, senha_hash.decode("utf-8")),
        )
        conexao.commit()
    except sqlite3.IntegrityError:
        # CPF ou e-mail já cadastrado (colunas UNIQUE)
        raise HTTPException(status_code=409, detail="Usuário já cadastrado")
    finally:
        conexao.close()

    return {"mensagem": "Conta criada com sucesso"}


@auth_router.post("/login")
async def login(dados: LoginIn, request: Request):
    conexao = conectar()
    try:
        usuario = conexao.execute(
            "SELECT id, nome, senha FROM usuarios WHERE email = ?",
            (dados.email.lower(),),
        ).fetchone()
    finally:
        conexao.close()

    # Mesma resposta para "usuário não existe" e "senha errada"
    if usuario is None or not bcrypt.checkpw(
        dados.senha.encode("utf-8"), usuario["senha"].encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    request.session.clear()
    request.session["usuario_id"] = usuario["id"]
    return {"mensagem": "Login bem-sucedido", "nome": usuario["nome"]}


@auth_router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"mensagem": "Sessão encerrada"}
