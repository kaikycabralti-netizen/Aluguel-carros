from fastapi import APIRouter

auth_router = APIRouter(prefix="/auth", tags=["auth"])

@auth_router.get("/login")
async def login():
    """
    Rota padrão para realizar login do usuário.
    """
    # Lógica para autenticação do usuário
    return {"mensagem": "Login bem-sucedido"}

