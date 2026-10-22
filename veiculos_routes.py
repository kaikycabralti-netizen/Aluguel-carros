from fastapi import APIRouter
from db import conectar

veiculos_router = APIRouter(prefix="/api/veiculos", tags=["veiculos"])


@veiculos_router.get("")
async def listar_veiculos():
    conexao = conectar()
    try:
        linhas = conexao.execute("SELECT * FROM veiculos").fetchall()
    finally:
        conexao.close()
    return [dict(linha) for linha in linhas]
