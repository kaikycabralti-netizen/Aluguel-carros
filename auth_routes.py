# ============================================================
# auth_routes.py  ->  cadastro, login, logout e "quem sou eu"
# Todas as rotas começam com /api
# ============================================================
import re
import sqlite3

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from db import conectar
from seguranca import exige_login   # NOVO: usado na rota /api/me

# O front chama /api/login, /api/registrar, /api/me e /api/logout
auth_router = APIRouter(prefix="/api", tags=["auth"])


class RegistroIn(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    cpf: str
    email: EmailStr   # recusa e-mail com formato inválido
    senha: str = Field(min_length=8, max_length=72)  # bcrypt só usa os 72 primeiros bytes

    # NOVO: a senha precisa de 1 maiúscula, 1 número e 1 caractere especial.
    # A regra fica no servidor também, porque o JavaScript do navegador pode ser burlado.
    @field_validator("senha")
    @classmethod
    def senha_forte(cls, valor: str) -> str:
        if (
            not re.search(r"[A-Z]", valor)
            or not re.search(r"[0-9]", valor)
            or not re.search(r"[^A-Za-z0-9]", valor)
        ):
            raise ValueError("A senha precisa ter maiúscula, número e caractere especial")
        return valor


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


# ---------------------- CADASTRO ----------------------
@auth_router.post("/registrar", status_code=201)
async def registrar(dados: RegistroIn):
    if not cpf_valido(dados.cpf):
        raise HTTPException(status_code=422, detail="CPF inválido")

    cpf = re.sub(r"\D", "", dados.cpf)
    email = dados.email.lower()
    # A senha é criptografada antes de ir para o banco (nunca em texto puro)
    senha_hash = bcrypt.hashpw(dados.senha.encode("utf-8"), bcrypt.gensalt())

    conexao = conectar()
    try:
        # Consulta parametrizada (?) contra SQL Injection.
        # NOVO: todo cadastro pelo site vira 'cliente'. O admin nunca é criado
        # pela tela, para ninguém conseguir se promover sozinho.
        conexao.execute(
            "INSERT INTO usuarios (nome, cpf, email, senha, perfil) VALUES (?, ?, ?, ?, 'cliente')",
            (dados.nome.strip(), cpf, email, senha_hash.decode("utf-8")),
        )
        conexao.commit()
    except sqlite3.IntegrityError:
        # CPF ou e-mail já cadastrado (colunas UNIQUE)
        raise HTTPException(status_code=409, detail="Usuário já cadastrado")
    finally:
        conexao.close()

    return {"mensagem": "Conta criada com sucesso"}


# ---------------------- LOGIN ----------------------
@auth_router.post("/login")
async def login(dados: LoginIn, request: Request):
    conexao = conectar()
    try:
        # NOVO: busca também o perfil
        usuario = conexao.execute(
            "SELECT id, nome, senha, perfil FROM usuarios WHERE email = ?",
            (dados.email.lower(),),
        ).fetchone()
    finally:
        conexao.close()

    # Mesma resposta para "usuário não existe" e "senha errada"
    # (assim ninguém descobre quais e-mails estão cadastrados)
    if usuario is None or not bcrypt.checkpw(
        dados.senha.encode("utf-8"), usuario["senha"].encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    request.session.clear()
    request.session["usuario_id"] = usuario["id"]   # só o id fica na sessão
    # NOVO: devolve também o perfil
    return {"mensagem": "Login bem-sucedido", "nome": usuario["nome"], "perfil": usuario["perfil"]}


# ---------------------- QUEM SOU EU (NOVO) ----------------------
# O catalogo.js chama esta rota para saber se deve mostrar o botão "Painel admin".
# Depends(exige_login): sem login, responde 401.
@auth_router.get("/me")
async def quem_sou_eu(usuario: dict = Depends(exige_login)):
    return {"nome": usuario["nome"], "perfil": usuario["perfil"]}


# ---------------------- LOGOUT ----------------------
@auth_router.post("/logout")
async def logout(request: Request):
    request.session.clear()   # apaga a sessão
    return {"mensagem": "Sessão encerrada"}