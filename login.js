import 'bootstrap/dist/css/bootstrap.min.css'

const form = document.getElementById('form-login')
const erro = document.getElementById('erro')
const botao = document.getElementById('btn-entrar')

function mostrarErro(mensagem) {
  // textContent (e não innerHTML) evita injeção de HTML na mensagem
  erro.textContent = mensagem
  erro.classList.remove('d-none')
}

function limparErro() {
  erro.textContent = ''
  erro.classList.add('d-none')
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  limparErro()

  const login = form.login.value.trim()
  const senha = form.senha.value

  // Validação no front é só conveniência; a validação de verdade é no servidor
  if (!login || !senha) {
    mostrarErro('Preencha usuário e senha.')
    return
  }

  botao.disabled = true
  botao.textContent = 'Entrando...'

  try {
    const resposta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // envia/recebe o cookie de sessão
      body: JSON.stringify({ login, senha }),
    })

    if (resposta.ok) {
      window.location.href = '/painel.html'
      return
    }

    // Mensagem genérica de propósito: não revela se foi o usuário ou a senha que errou
    mostrarErro('Usuário ou senha inválidos.')
  } catch (e) {
    mostrarErro('Não foi possível conectar ao servidor.')
  } finally {
    botao.disabled = false
    botao.textContent = 'Entrar'
    form.senha.value = ''
  }
})
