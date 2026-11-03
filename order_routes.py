from datetime import date, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, model_validator

from db import conectar
from seguranca import exige_login   # bloqueia quem não está logado (401)

# Todas as rotas deste arquivo começam com /api/alugueis
# O nome "order_router" continua o mesmo porque o main.py importa por ele.
order_router = APIRouter(prefix="/api/alugueis", tags=["aluguel"])


# ------------------------------------------------------------
# MODELOS: definem o formato do JSON que o front pode enviar.
# O Pydantic valida sozinho e devolve erro 422 se estiver errado.
# ------------------------------------------------------------
class PeriodoIn(BaseModel):
    """Período do aluguel: data de retirada e de devolução."""
    data_inicio: date
    data_fim: date

    # Roda depois que os dois campos foram lidos e validam a combinação deles
    @model_validator(mode="after")
    def validar_periodo(self):
        # Devolução precisa ser depois da retirada
        if self.data_fim <= self.data_inicio:
            raise ValueError("A data final precisa ser depois da inicial")
        # Limite de 1 ano, pra evitar valores absurdos
        if (self.data_fim - self.data_inicio).days > 365:
            raise ValueError("O aluguel não pode passar de 365 dias")
        return self


class AluguelIn(PeriodoIn):
    """O que o cliente envia ao alugar: período + veículo + forma de pagamento."""
    veiculo_id: int
    # Literal aceita SOMENTE estes valores. Qualquer outro vira erro 422.
    # Repare: só o NOME da forma de pagamento, nunca dados de cartão.
    forma_pagamento: Literal["pix", "credito", "debito", "boleto", "retirada"]


# ------------------------------------------------------------
# CONSULTA reaproveitada pelo admin_routes.py.
# Junta aluguel + veículo + usuário para mostrar nomes em vez de ids.
# (junta com "usuarios" porque a tabela "clientes" não existe)
# ------------------------------------------------------------
CONSULTA_ALUGUEIS = """
    SELECT a.id, a.veiculo_id, a.cliente_id, a.data_inicio, a.data_fim, a.valor_total,
           a.forma_pagamento, v.marca, v.modelo, v.placa, u.nome AS cliente_nome
    FROM alugueis a
    JOIN veiculos v ON v.id = a.veiculo_id
    JOIN usuarios u ON u.id = a.cliente_id
"""


def como_data(texto: str) -> date:
    """O SQLite guarda datas como texto 'AAAA-MM-DD'. Isto converte para date."""
    return datetime.strptime(texto, "%Y-%m-%d").date()


def formatar_aluguel(linha) -> dict:
    """Transforma uma linha do banco no JSON que o front usa,
    já com o tempo do aluguel calculado."""
    inicio, fim = como_data(linha["data_inicio"]), como_data(linha["data_fim"])
    hoje = date.today()

    # Em que momento está o aluguel?
    if hoje < inicio:
        situacao = "futuro"          # ainda não começou
    elif hoje > fim:
        situacao = "encerrado"       # prazo já passou
    else:
        situacao = "em_andamento"    # acontecendo agora

    return {
        "id": linha["id"],
        "veiculo_id": linha["veiculo_id"],
        "veiculo": f'{linha["marca"]} {linha["modelo"]} ({linha["placa"]})',
        "cliente": linha["cliente_nome"],
        "data_inicio": linha["data_inicio"],
        "data_fim": linha["data_fim"],
        "dias": (fim - inicio).days,            # duração total do aluguel
        "dias_restantes": (fim - hoje).days,    # negativo = passou do prazo
        "situacao": situacao,
        "forma_pagamento": linha["forma_pagamento"],
        "valor_total": linha["valor_total"],
    }


# ------------------------------------------------------------
# GET /api/alugueis  ->  lista os aluguéis do usuário logado
# ------------------------------------------------------------
@order_router.get("", status_code=200)
async def listar_alugueis(usuario: dict = Depends(exige_login)):
    conexao = conectar()
    try:
        # Se for admin, pode ver todos; se for cliente, vê apenas os seus
        if usuario.get("perfil") == "admin":
            cursor = conexao.execute(CONSULTA_ALUGUEIS)
        else:
            cursor = conexao.execute(
                CONSULTA_ALUGUEIS + " WHERE a.cliente_id = ?", (usuario["id"],)
            )
        
        linhas = cursor.fetchall()
        alugueis = [formatar_aluguel(linha) for linha in linhas]
    finally:
        conexao.close()

    return alugueis


# ------------------------------------------------------------
# POST /api/alugueis  ->  cliente logado aluga um veículo
# ------------------------------------------------------------
@order_router.post("", status_code=201)
async def criar_aluguel(dados: AluguelIn, usuario: dict = Depends(exige_login)):
    if dados.data_inicio < date.today():
        raise HTTPException(status_code=422, detail="A data inicial não pode ser no passado")

    conexao = conectar()
    try:
        veiculo = conexao.execute(
            "SELECT id, status, preco_diaria FROM veiculos WHERE id = ?", (dados.veiculo_id,)
        ).fetchone()

        if veiculo is None:
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
        if veiculo["status"] != "disponivel":
            raise HTTPException(status_code=409, detail="Veículo indisponível")
        if veiculo["preco_diaria"] <= 0:
            raise HTTPException(status_code=409, detail="Veículo sem preço de diária definido")

        dias = (dados.data_fim - dados.data_inicio).days
        valor_total = round(dias * veiculo["preco_diaria"], 2)

        cursor = conexao.execute(
            """INSERT INTO alugueis
                    (veiculo_id, cliente_id, data_inicio, data_fim, valor_total, forma_pagamento)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (veiculo["id"], usuario["id"], dados.data_inicio.isoformat(),
             dados.data_fim.isoformat(), valor_total, dados.forma_pagamento),
        )

        conexao.execute("UPDATE veiculos SET status = 'alugado' WHERE id = ?", (veiculo["id"],))
        conexao.commit()
        novo_id = cursor.lastrowid
    finally:
        conexao.close()

    return {"id": novo_id, "dias": dias, "valor_total": valor_total}


# ------------------------------------------------------------
# DELETE /api/alugueis/{id}  ->  cliente cancela o seu aluguel
# ------------------------------------------------------------
@order_router.delete("/{aluguel_id}", status_code=200)
async def cancelar_aluguel(aluguel_id: int, usuario: dict = Depends(exige_login)):
    conexao = conectar()
    try:
        aluguel = conexao.execute(
            "SELECT id, veiculo_id, cliente_id, data_inicio FROM alugueis WHERE id = ?", 
            (aluguel_id,)
        ).fetchone()

        if aluguel is None:
            raise HTTPException(status_code=404, detail="Aluguel não encontrado")

        if aluguel["cliente_id"] != usuario["id"] and usuario.get("perfil") != "admin":
            raise HTTPException(status_code=403, detail="Você não tem permissão para cancelar este aluguel")

        data_inicio = como_data(aluguel["data_inicio"])
        if data_inicio <= date.today():
            raise HTTPException(status_code=400, detail="Não é possível cancelar um aluguel que já iniciou ou é para hoje.")

        veiculo_id = aluguel["veiculo_id"]

        conexao.execute("UPDATE veiculos SET status = 'disponivel' WHERE id = ?", (veiculo_id,))
        conexao.execute("DELETE FROM alugueis WHERE id = ?", (aluguel_id,))
        conexao.commit()
    finally:
        conexao.close()

    return {"mensagem": "Aluguel cancelado com sucesso", "aluguel_id": aluguel_id}