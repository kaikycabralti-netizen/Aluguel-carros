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

// Máscara simples de CPF: 000.000.000-00
formRegistro.cpf.addEventListener('input', (event) => {
  const n = event.target.value.replace(/\D/g, '').slice(0, 11);
  event.target.value = n
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
});

// ---------------------------- LOGIN ----------------------------
formLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagens();

  const email = formLogin.email.value.trim();
  const senha = formLogin.senha.value;

  // Validação no front é só conveniência; a validação de verdade é no servidor
  if (!email || !senha) {
    mostrarErro('Preencha e-mail e senha.');
    return;
  }

  btnEntrar.disabled = true;
  btnEntrar.textContent = 'Entrando...';

  try {
    const resposta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // envia/recebe o cookie de sessão
      body: JSON.stringify({ email, senha }),
    });

    if (resposta.ok) {
      window.location.href = '/catalogo.html';
      return;
    }

    // Mensagem genérica de propósito: não revela se foi o e-mail ou a senha que errou
    mostrarErro('E-mail ou senha inválidos.');
  } catch (e) {
    mostrarErro('Não foi possível conectar ao servidor.');
  } finally {
    btnEntrar.disabled = false;
    btnEntrar.textContent = 'Entrar';
    formLogin.senha.value = '';
  }
});

// ---------------- Regras de e-mail e senha ----------------
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const REGRAS_SENHA = {
  tamanho: (s) => s.length >= 8,
  maiuscula: (s) => /[A-Z]/.test(s),
  numero: (s) => /[0-9]/.test(s),
  especial: (s) => /[^A-Za-z0-9]/.test(s),
};

const TEXTO_REGRA = {
  tamanho: 'no mínimo 8 caracteres',
  maiuscula: 'uma letra maiúscula',
  numero: 'um número',
  especial: 'um caractere especial',
};

// Devolve o texto das regras que a senha ainda não cumpre
function senhaFaltando(senha) {
  return Object.keys(REGRAS_SENHA)
    .filter((regra) => !REGRAS_SENHA[regra](senha))
    .map((regra) => TEXTO_REGRA[regra]);
}

// Marca na tela (✔) as regras que a senha digitada já cumpre
function atualizarRegras() {
  const senha = formRegistro.senha.value;
  document.querySelectorAll('#regras-senha li').forEach((li) => {
    li.classList.toggle('ok', REGRAS_SENHA[li.dataset.regra](senha));
  });
}
formRegistro.senha.addEventListener('input', atualizarRegras);



// --------------------------- REGISTRO --------------------------
formRegistro.addEventListener('submit', async (event) => {
  event.preventDefault();
  limparMensagens();

  const nome = formRegistro.nome.value.trim();
  const cpf = formRegistro.cpf.value.trim();
  const email = formRegistro.email.value.trim();
  const senha = formRegistro.senha.value;
  const confirmar = formRegistro.confirmar.value;

  if (!nome || !cpf || !email || !senha || !confirmar) {
    mostrarErro('Preencha todos os campos.');
    return;
  }
  if (!REGEX_EMAIL.test(email)) {
    mostrarErro('Digite um e-mail válido (ex: nome@dominio.com).');
    return;
  }
  const faltando = senhaFaltando(senha);
  if (faltando.length > 0) {
    mostrarErro('A senha precisa ter: ' + faltando.join(', ') + '.');
    return;
  }
  if (senha !== confirmar) {
    mostrarErro('As senhas não conferem.');
    return;
  }
  
  btnRegistrar.disabled = true;
  btnRegistrar.textContent = 'Criando...';

  try {
    const resposta = await fetch('/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, cpf, email, senha }),
    });

    if (resposta.ok) {
      formRegistro.reset();
      alternar(false); // volta pro login
      mostrarSucesso('Conta criada! Agora é só entrar.');
      return;
    }

    if (resposta.status === 409) {
      mostrarErro('CPF ou e-mail já cadastrado.');
    } else if (resposta.status === 400 || resposta.status === 422) {
      mostrarErro('Dados inválidos. Confira o CPF, o e-mail e a senha.');
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
    atualizarRegras();
  }
});
