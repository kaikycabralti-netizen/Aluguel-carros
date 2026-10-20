from fastapi import APIRouter

order_router = APIRouter(prefix="/aluguel", tags=["aluguel"])

@order_router.get("/lista")
async def listar_alugueis():
    # Lógica para listar os aluguéis
    return {"mensagem": "Listando aluguéis"}