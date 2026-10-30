# ============================================================
# auth_routes.py  ->  cadastro, login, logout e "quem sou eu"
# Todas as rotas começam com /api
# ============================================================
import hashlib
import re
import sqlite3

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from db import conectar
from seguranca import exige_login

auth_router = APIRouter(prefix="/api", tags=["auth"])


class RegistroIn(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    cpf: str
    email: EmailStr
    senha: str = Field(min_length=8, max_length=72)

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


def gerar_hash_busca(dado: str) -> str:
    """Gera um hash SHA-256 determinístico para permitir buscas exatas no banco."""
    return hashlib.sha256(dado.lower().strip().encode("utf-8")).hexdigest()


def mascarar_email(email: str) -> str:
    """Transforma 'usuario@email.com' em 'us****@email.com' para exibição segura."""
    partes = email.split("@")
    if len(partes) != 2:
        return "***"
    usuario, dominio = partes
    if len(usuario) <= 2:
        return f"{usuario[0]}***@{dominio}"
    return f"{usuario[:2]}****@{dominio}"


def mascarar_cpf(cpf: str) -> str:
    """Transforma '12345678901' em '123.***.***-01'."""
    nums = re.sub(r"\D", "", cpf)
    if len(nums) != 11:
        return "***.***.***-**"
    return f"{nums[:3]}.***.***-{nums[9:]}"


# ---------------------- CADASTRO ----------------------
@auth_router.post("/registrar", status_code=201)
async def registrar(dados: RegistroIn):
    if not cpf_valido(dados.cpf):
        raise HTTPException(status_code=422, detail="CPF inválido")

    cpf_limpo = re.sub(r"\D", "", dados.cpf)
    email_limpo = dados.email.lower()

    # Geramos os hashes para busca e as versões mascaradas para exibição
    email_hash = gerar_hash_busca(email_limpo)
    cpf_hash = gerar_hash_busca(cpf_limpo)

    email_mascarado = mascarar_email(email_limpo)
    cpf_mascarado = mascarar_cpf(cpf_limpo)

    senha_hash = bcrypt.hashpw(dados.senha.encode("utf-8"), bcrypt.gensalt())

    conexao = conectar()
    try:
        # ATENÇÃO: Sua tabela 'usuarios' no SQLite precisa ter colunas para os hashes!
        # Exemplo de criação da tabela:
        # CREATE TABLE usuarios (
        #     id INTEGER PRIMARY KEY AUTOINCREMENT,
        #     nome TEXT,
        #     email_hash TEXT UNIQUE,
        #     cpf_hash TEXT UNIQUE,
        #     email_mascarado TEXT,
        #     cpf_mascarado TEXT,
        #     senha TEXT,
        #     perfil TEXT
        # );
        conexao.execute(
            """
            INSERT INTO usuarios (nome, email_hash, cpf_hash, email_mascarado, cpf_mascarado, senha, perfil) 
            VALUES (?, ?, ?, ?, ?, ?, 'cliente')
            """,
            (
                dados.nome.strip(),
                email_hash,
                cpf_hash,
                email_mascarado,
                cpf_mascarado,
                senha_hash.decode("utf-8"),
            ),
        )
        conexao.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Usuário já cadastrado")
    finally:
        conexao.close()

    return {"mensagem": "Conta criada com sucesso"}


# ---------------------- LOGIN ----------------------
@auth_router.post("/login")
async def login(dados: LoginIn, request: Request):
    email_hash = gerar_hash_busca(dados.email.lower())

    conexao = conectar()
    try:
        # Buscamos o usuário utilizando o hash do e-mail
        usuario = conexao.execute(
            "SELECT id, nome, senha, perfil FROM usuarios WHERE email_hash = ?",
            (email_hash,),
        ).fetchone()
    finally:
        conexao.close()

    if usuario is None or not bcrypt.checkpw(
        dados.senha.encode("utf-8"), usuario["senha"].encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    request.session.clear()
    request.session["usuario_id"] = usuario["id"]
    return {"mensagem": "Login bem-sucedido", "nome": usuario["nome"], "perfil": usuario["perfil"]}


# ---------------------- QUEM SOU EU ----------------------
@auth_router.get("/me")
async def quem_sou_eu(usuario: dict = Depends(exige_login)):
    return {"nome": usuario["nome"], "perfil": usuario["perfil"]}


# ---------------------- LOGOUT ----------------------
@auth_router.post("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"mensagem": "Sessão encerrada"}