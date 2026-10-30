import os
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from db import criar_tabelas
from auth_routes import auth_router
from order_routes import order_router
from veiculos_routes import veiculos_router
from admin_routes import admin_router
from seguranca import obter_usuario    
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
app.include_router(admin_router)   

# Arquivos do front-end (as pastas precisam existir ao lado do main.py)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/style", StaticFiles(directory="style"), name="style")


@app.get("/")
def pagina_login():
    return FileResponse("view/index.html")


@app.get("/catalogo.html")
def pagina_catalogo(request: Request):
    # só quem está logado vê o catálogo; senão volta pro login
    if obter_usuario(request) is None:
        return RedirectResponse("/", status_code=303)
    return FileResponse("view/catalogo.html")


@app.get("/admin.html")
def pagina_admin(request: Request):
    usuario = obter_usuario(request)
    if usuario is None:                      # não logado: vai pro login
        return RedirectResponse("/", status_code=303)
    if usuario["perfil"] != "admin":         # logado, mas não é admin
        return RedirectResponse("/catalogo.html", status_code=303)
    return FileResponse("view/admin.html")


app.include_router(veiculos_router)

# Rest APIs
# GET - leitura/pegar
# POST - enviar/criar
# PUT/PATCH - ediçao/atualizar
# DELETE - deletar
