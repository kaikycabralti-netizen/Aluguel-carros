from fastapi import HTTPException, Request

from db import conectar


def obter_usuario(request: Request):
    """Devolve o usuário logado (dict) ou None. O perfil é lido do banco a cada requisição."""
    usuario_id = request.session.get("usuario_id")
    if usuario_id is None:
        return None
    conexao = conectar()
    try:
        linha = conexao.execute(
            "SELECT id, nome, perfil FROM usuarios WHERE id = ?", (usuario_id,)
        ).fetchone()
    finally:
        conexao.close()
    if linha is None:  # usuário foi apagado: derruba a sessão
        request.session.clear()
        return None
    return dict(linha)


def exige_login(request: Request):
    usuario = obter_usuario(request)
    if usuario is None:
        raise HTTPException(status_code=401, detail="Faça login")
    return usuario


def exige_admin(request: Request):
    usuario = exige_login(request)
    if usuario["perfil"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return usuario