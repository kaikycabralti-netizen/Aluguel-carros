const formLogin = document.getElementById('form-login');
const formRegistro = document.getElementById('form-registro');
const erro = document.getElementById('erro');
const sucesso = document.getElementById('sucesso');
const subtitulo = document.getElementById('subtitulo');
const textoTroca = document.getElementById('texto-troca');
const linkTroca = document.getElementById('link-troca');
const btnEntrar = document.getElementById('btn-entrar');
const btnRegistrar = document.getElementById('btn-registrar');

// textContent (e não innerHTML) evita injeção de HTML nas mensagens
function mostrarErro(mensagem) {
  sucesso.classList.add('d-none');
  erro.textContent = mensagem;
  erro.classList.remove('d-none');
}

function mostrarSucesso(mensagem) {
  erro.classList.add('d-none');
  sucesso.textContent = mensagem;
  sucesso.classList.remove('d-none');
}

function limparMensagens() {
  erro.classList.add('d-none');
  sucesso.classList.add('d-none');
}

// Alterna entre a tela de login e a de registro
function alternar(modoRegistro) {
  limparMensagens();
  formLogin.classList.toggle('d-none', modoRegistro);
  formRegistro.classList.toggle('d-none', !modoRegistro);
  subtitulo.textContent = modoRegistro ? 'Crie sua conta' : 'Acesse sua conta';
  textoTroca.textContent = modoRegistro ? 'Já tem conta?' : 'Não tem conta?';
  linkTroca.textContent = modoRegistro ? 'Entrar' : 'Registre-se';
}

linkTroca.addEventListener('click', (event) => {
  event.preventDefault();
  alternar(formLogin.classList.contains('d-none') === false);
});

// ---------------------------- LOGIN ----------------------------
formLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagens();

  const login = formLogin.login.value.trim();
  const senha = formLogin.senha.value;

  // Validação no front é só conveniência; a validação de verdade é no servidor
  if (!login || !senha) {
    mostrarErro('Preencha usuário e senha.');
    return;
  }

  btnEntrar.disabled = true;
  btnEntrar.textContent = 'Entrando...';

  try {
    const resposta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // envia/recebe o cookie de sessão
      body: JSON.stringify({ login, senha }),
    });

    if (resposta.ok) {
      window.location.href = '/painel.html';
      return;
    }

    // Mensagem genérica de propósito: não revela se foi o usuário ou a senha que errou
    mostrarErro('Usuário ou senha inválidos.');
  } catch (e) {
    mostrarErro('Não foi possível conectar ao servidor.');
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.textContent = 'Entrar';
    formLogin.senha.value = '';
  }
});

// --------------------------- REGISTRO --------------------------
formRegistro.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagens();

  const nome = formRegistro.nome.value.trim();
  const login = formRegistro.login.value.trim();
  const senha = formRegistro.senha.value;
  const confirmar = formRegistro.confirmar.value;

  if (!nome || !login || !senha || !confirmar) {
    mostrarErro('Preencha todos os campos.');
    return;
  }
  if (senha.length < 8) {
    mostrarErro('A senha deve ter no mínimo 8 caracteres.');
    return;
  }
  if (senha !== confirmar) {
    mostrarErro('As senhas não conferem.');
    return;
  }

  btnRegistrar.disabled = true;
  btnRegistrar.textContent = 'Criando...';

  try {
    // Repare: o front NÃO envia "perfil". Quem define o perfil é o servidor.
    const resposta = await fetch('/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, login, senha }),
    });

    if (resposta.ok) {
      formRegistro.reset();
      alternar(false); // volta pro login
      mostrarSucesso('Conta criada! Agora é só entrar.');
      return;
    }

    if (resposta.status === 409) {
      mostrarErro('Esse usuário já existe. Escolha outro.');
    } else if (resposta.status === 400 || resposta.status === 422) {
      mostrarErro('Dados inválidos. Confira os campos.');
    } else {
      mostrarErro('Não foi possível criar a conta.');
    }
  } catch (e) {
    mostrarErro('Não foi possível conectar ao servidor.');
  } finally {
    btnRegistrar.disabled = false;
    btnRegistrar.textContent = 'Criar conta';
    formRegistro.senha.value = '';
    formRegistro.confirmar.value = '';
  }
});
