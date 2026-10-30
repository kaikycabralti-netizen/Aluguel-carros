# ============================================================
# admin_routes.py  ->  rotas EXCLUSIVAS do administrador
#
# Todas as rotas daqui exigem perfil 'admin'.
# Cliente comum recebe 403 (proibido), mesmo se descobrir a URL.
# ============================================================
import os
import re
import sqlite3
import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from db import conectar
from order_routes import CONSULTA_ALUGUEIS, PeriodoIn, como_data, formatar_aluguel
from seguranca import exige_admin

# "dependencies=[Depends(exige_admin)] no roteador" = a checagem vale
# para TODAS as rotas abaixo. Não dá para esquecer de proteger uma.
admin_router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(exige_admin)])

# Placa antiga (ABC1234) ou Mercosul (ABC1D23)
PADRAO_PLACA = re.compile(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$")


# ---------------------- FOTOS DOS VEÍCULOS ----------------------
PASTA_UPLOADS = os.path.join("static", "uploads")   # fica dentro de /static, então já é servida
LIMITE_IMAGEM = 2 * 1024 * 1024                     # 2 MB


def detectar_extensao(dados: bytes):
    """Descobre o tipo pelo CONTEÚDO do arquivo (os primeiros bytes), não pelo nome.
    Assim ninguém consegue enviar um .exe ou .html renomeado para .jpg."""
    if dados.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if dados.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if dados[:4] == b"RIFF" and dados[8:12] == b"WEBP":
        return "webp"
    return None


def apagar_arquivo_imagem(caminho):
    """Apaga a foto do disco. Só mexe em arquivos dentro da pasta de uploads."""
    if caminho and caminho.startswith("/static/uploads/"):
        arquivo = os.path.join(PASTA_UPLOADS, os.path.basename(caminho))
        if os.path.isfile(arquivo):
            os.remove(arquivo)


class VeiculoIn(BaseModel):
    """Dados de um veículo enviados pelo painel admin."""
    marca: str = Field(min_length=2, max_length=40)
    modelo: str = Field(min_length=1, max_length=60)
    ano: int = Field(ge=1990, le=date.today().year + 1)
    placa: str
    status: Literal["disponivel", "alugado", "manutencao"] = "disponivel"
    preco_diaria: float = Field(gt=0, le=100000)   # tem que ser maior que 0

    @field_validator("placa")
    @classmethod
    def validar_placa(cls, valor: str) -> str:
        # Tira espaço/hífen e põe maiúscula: "abc-1d23" vira "ABC1D23"
        placa = re.sub(r"[\s-]", "", valor).upper()
        if not PADRAO_PLACA.match(placa):
            raise ValueError("Placa inválida")
        return placa


# ------------------------------ VEÍCULOS ------------------------------
@admin_router.get("/veiculos")
async def listar_veiculos():
    """Lista todos os veículos (qualquer status) para o painel."""
    conexao = conectar()
    try:
        linhas = conexao.execute(
            "SELECT id, marca, modelo, ano, placa, status, preco_diaria, imagem "
            "FROM veiculos ORDER BY marca, modelo"
        ).fetchall()
    finally:
        conexao.close()
    return [dict(linha) for linha in linhas]


@admin_router.post("/veiculos", status_code=201)
async def criar_veiculo(dados: VeiculoIn):
    """Cadastra um veículo novo."""
    conexao = conectar()
    try:
        cursor = conexao.execute(
            "INSERT INTO veiculos (marca, modelo, ano, placa, status, preco_diaria) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (dados.marca.strip(), dados.modelo.strip(), dados.ano,
             dados.placa, dados.status, dados.preco_diaria),
        )
        conexao.commit()
        novo_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        # a coluna placa é UNIQUE: placa repetida cai aqui
        raise HTTPException(status_code=409, detail="Já existe um veículo com essa placa")
    finally:
        conexao.close()
    return {"id": novo_id, "mensagem": "Veículo cadastrado"}


@admin_router.put("/veiculos/{veiculo_id}")
async def editar_veiculo(veiculo_id: int, dados: VeiculoIn):
    """Altera os dados de um veículo (inclusive diária e status)."""
    conexao = conectar()
    try:
        cursor = conexao.execute(
            """UPDATE veiculos
               SET marca = ?, modelo = ?, ano = ?, placa = ?, status = ?, preco_diaria = ?
               WHERE id = ?""",
            (dados.marca.strip(), dados.modelo.strip(), dados.ano, dados.placa,
             dados.status, dados.preco_diaria, veiculo_id),
        )
        conexao.commit()
        if cursor.rowcount == 0:      # nenhuma linha alterada = id não existe
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Já existe um veículo com essa placa")
    finally:
        conexao.close()
    return {"mensagem": "Veículo atualizado"}


@admin_router.delete("/veiculos/{veiculo_id}")
async def remover_veiculo(veiculo_id: int):
    """Remove um veículo, desde que ele nunca tenha sido alugado."""
    conexao = conectar()
    try:
        # Preserva o histórico: veículo com aluguel não pode ser apagado
        tem_aluguel = conexao.execute(
            "SELECT 1 FROM alugueis WHERE veiculo_id = ? LIMIT 1", (veiculo_id,)
        ).fetchone()
        if tem_aluguel:
            raise HTTPException(
                status_code=409,
                detail="Veículo com aluguéis registrados não pode ser removido. Marque como manutenção.",
            )
        antiga = conexao.execute("SELECT imagem FROM veiculos WHERE id = ?", (veiculo_id,)).fetchone()
        cursor = conexao.execute("DELETE FROM veiculos WHERE id = ?", (veiculo_id,))
        conexao.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
        if antiga:
            apagar_arquivo_imagem(antiga["imagem"])   # não deixa foto órfã no disco
    finally:
        conexao.close()
    return {"mensagem": "Veículo removido"}


@admin_router.post("/veiculos/{veiculo_id}/imagem")
async def enviar_imagem(veiculo_id: int, request: Request):
    """Recebe a foto como corpo da requisição (o front manda o arquivo direto)."""
    # recusa cedo se o cabeçalho já avisa que é grande demais
    if int(request.headers.get("content-length") or 0) > LIMITE_IMAGEM + 1024:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máximo 2 MB)")
    dados = await request.body()
    if not dados:
        raise HTTPException(status_code=422, detail="Nenhuma imagem enviada")
    if len(dados) > LIMITE_IMAGEM:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máximo 2 MB)")
    extensao = detectar_extensao(dados)
    if extensao is None:
        raise HTTPException(status_code=415, detail="Formato inválido. Use JPG, PNG ou WebP")

    conexao = conectar()
    try:
        veiculo = conexao.execute("SELECT imagem FROM veiculos WHERE id = ?", (veiculo_id,)).fetchone()
        if veiculo is None:
            raise HTTPException(status_code=404, detail="Veículo não encontrado")

        # Nome aleatório: ninguém controla o nome do arquivo no servidor
        os.makedirs(PASTA_UPLOADS, exist_ok=True)
        nome = f"{uuid.uuid4().hex}.{extensao}"
        with open(os.path.join(PASTA_UPLOADS, nome), "wb") as arquivo:
            arquivo.write(dados)

        caminho = f"/static/uploads/{nome}"
        conexao.execute("UPDATE veiculos SET imagem = ? WHERE id = ?", (caminho, veiculo_id))
        conexao.commit()
        apagar_arquivo_imagem(veiculo["imagem"])   # troca a foto: apaga a antiga
    finally:
        conexao.close()
    return {"imagem": caminho}


@admin_router.delete("/veiculos/{veiculo_id}/imagem")
async def remover_imagem(veiculo_id: int):
    conexao = conectar()
    try:
        veiculo = conexao.execute("SELECT imagem FROM veiculos WHERE id = ?", (veiculo_id,)).fetchone()
        if veiculo is None:
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
        conexao.execute("UPDATE veiculos SET imagem = NULL WHERE id = ?", (veiculo_id,))
        conexao.commit()
        apagar_arquivo_imagem(veiculo["imagem"])
    finally:
        conexao.close()
    return {"mensagem": "Foto removida"}


# ------------------------------ ALUGUÉIS ------------------------------
@admin_router.get("/alugueis")
async def listar_alugueis():
    """Lista todos os aluguéis com dias, prazo e situação já calculados."""
    conexao = conectar()
    try:
        linhas = conexao.execute(CONSULTA_ALUGUEIS + " ORDER BY a.data_inicio DESC").fetchall()
    finally:
        conexao.close()
    return [formatar_aluguel(linha) for linha in linhas]


@admin_router.put("/alugueis/{aluguel_id}")
async def alterar_periodo(aluguel_id: int, dados: PeriodoIn):
    """Muda as datas (logo, a quantidade de dias) de um aluguel e recalcula o valor."""
    conexao = conectar()
    try:
        atual = conexao.execute(
            """SELECT a.data_inicio, a.data_fim, a.valor_total, v.preco_diaria
               FROM alugueis a JOIN veiculos v ON v.id = a.veiculo_id WHERE a.id = ?""",
            (aluguel_id,),
        ).fetchone()
        if atual is None:
            raise HTTPException(status_code=404, detail="Aluguel não encontrado")

        # Mantém a diária que valia quando o aluguel foi feito
        # (valor_total / dias antigos), mesmo que o preço do carro mude depois.
        dias_antigos = (como_data(atual["data_fim"]) - como_data(atual["data_inicio"])).days
        diaria = atual["valor_total"] / dias_antigos if dias_antigos > 0 else atual["preco_diaria"]

        dias_novos = (dados.data_fim - dados.data_inicio).days
        novo_valor = round(dias_novos * diaria, 2)

        conexao.execute(
            "UPDATE alugueis SET data_inicio = ?, data_fim = ?, valor_total = ? WHERE id = ?",
            (dados.data_inicio.isoformat(), dados.data_fim.isoformat(), novo_valor, aluguel_id),
        )
        conexao.commit()
    finally:
        conexao.close()
    return {"dias": dias_novos, "valor_total": novo_valor}