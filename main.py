from fastapi import FastAPI
# para rodar o código, colocar no terminal: uvicorn main:app --reload
app = FastAPI()
from auth_routes import auth_router
from order_routes import order_router

app.include_router(auth_router)
app.include_router(order_router)

#@app.get("/")
#def read_root():
#    return {"message": "Bem-vindo ao sistema!"}

#Rest APIs
# GET - leitura/pegar
# POST - enviar/criar
# PUT/PATCH - ediçao/atualizar
# DELETE - deletar