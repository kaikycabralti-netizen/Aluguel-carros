import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from db import criar_tabelas
from auth_routes import auth_router
from order_routes import order_router

# para rodar o código, colocar no terminal: uvicorn main:app --reload

app = FastAPI()

# Sessão por cookie assinado. Em produção, a chave deve vir de variável de ambiente.
app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ.get("SECRET_KEY", "troque-esta-chave-em-producao"),
    https_only=False,   # mude para True quando usar HTTPS
    same_site="lax",
)

criar_tabelas()

# Rotas da API
app.include_router(auth_router)
app.include_router(order_router)

# Arquivos do front-end (as pastas precisam existir ao lado do main.py)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/style", StaticFiles(directory="style"), name="style")


@app.get("/")
def pagina_login():
    return FileResponse("view/index.html")


@app.get("/catalogo.html")
def pagina_catalogo():
    return FileResponse("view/catalogo.html")

# Rest APIs
# GET - leitura/pegar
# POST - enviar/criar
# PUT/PATCH - ediçao/atualizar
# DELETE - deletar
