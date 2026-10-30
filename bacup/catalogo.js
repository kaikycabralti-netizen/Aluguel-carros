// ===============================================================
// catalogo.js  ->  tela do catálogo (cliente e admin)
// - carrega os veículos do back-end (/api/veiculos)
// - filtros e ordenação
// - tela de pagamento com datas, total e envio do aluguel
// - mostra o botão "Painel admin" só para administradores
// ===============================================================

// Lista de veículos (vem da API, é preenchida em carregarVeiculos)
let veiculos = [];

// ---- elementos da página ----
const lista = document.getElementById('lista');
const vazio = document.getElementById('vazio');
const contador = document.getElementById('contador');
const campoBusca = document.getElementById('busca');
const filtroMarca = document.getElementById('filtro-marca');
const ordenar = document.getElementById('ordenar');
const soDisponiveis = document.getElementById('so-disponiveis');

// Formata números como dinheiro: 250 -> "R$ 250,00"
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Cria elementos com textContent (e não innerHTML), assim os dados
// que vierem da API não conseguem injetar HTML na página (proteção contra XSS).
function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

// ---------------------------- CARD DO VEÍCULO ----------------------------
function criarCard(v) {
  const disponivel = v.situacao === 'disponivel';

  const coluna = el('div', 'col-12 col-md-6 col-lg-4 col-xl-3');
  const card = el('article', 'cartao-black carro-card');

  // Imagem + selo de situação (Disponível / Alugado)
  const img = el('div', 'carro-img');
  if (v.imagem) {
    const foto = document.createElement('img');
    foto.src = v.imagem;
    foto.alt = `${v.marca} ${v.modelo}`;
    img.appendChild(foto);
  } else {
    img.textContent = '🚗'; // sem foto: mostra o emoji
  }
  img.appendChild(
    el(
      'span',
      `carro-situacao ${disponivel ? 'situacao-disponivel' : 'situacao-alugado'}`,
      disponivel ? 'Disponível' : 'Alugado'
    )
  );

  // Corpo do card: marca, modelo e placa
  const corpo = el('div', 'carro-corpo');
  corpo.appendChild(el('div', 'carro-marca', `${v.marca} · ${v.ano}`));
  corpo.appendChild(el('h2', 'carro-modelo', v.modelo));

  const tags = el('div', 'carro-tags');
  [`Placa ${v.placa}`].forEach((t) => tags.appendChild(el('span', 'carro-tag', t)));
  corpo.appendChild(tags);

  // Rodapé: preço da diária + botão Alugar
  const rodape = el('div', 'carro-rodape');
  const preco = el('div', 'carro-preco');
  preco.appendChild(el('strong', '', moeda.format(v.preco)));
  preco.appendChild(el('small', '', 'por dia'));

  const botao = el(
    'button',
    disponivel ? 'btn btn-dourado' : 'btn btn-secondary btn-indisponivel',
    disponivel ? 'Alugar' : 'Indisponível'
  );
  botao.type = 'button';
  botao.disabled = !disponivel; // veículo alugado não pode ser clicado
  if (disponivel) botao.addEventListener('click', () => alugar(v));

  rodape.append(preco, botao);
  corpo.appendChild(rodape);

  card.append(img, corpo);
  coluna.appendChild(card);
  return coluna;
}

// ---------------------------- PAGAMENTO ----------------------------
// Elementos da tela de pagamento (o <dialog> do catalogo.html)
const modalPg = document.getElementById('modal-pagamento');
const formPg = document.getElementById('form-pagamento');
const pgConfirmar = document.getElementById('pg-confirmar');
const pgSucesso = document.getElementById('pg-sucesso');

// NOVO: datas, total e erro
const campoPgInicio = document.getElementById('pg-inicio');
const campoPgFim = document.getElementById('pg-fim');
const pgTotal = document.getElementById('pg-total');
const pgErro = document.getElementById('pg-erro');

// Data de hoje no formato do <input type="date"> (AAAA-MM-DD, no fuso do usuário)
function hojeISO() {
  return new Date().toLocaleDateString('sv-SE');
}

// Quantidade de dias entre duas datas (fim - início)
function diasEntre(inicioISO, fimISO) {
  const ms = new Date(fimISO + 'T00:00:00') - new Date(inicioISO + 'T00:00:00');
  return Math.round(ms / 86400000); // 86400000 ms = 1 dia
}

// Campos do cartão
const campoNumero = document.getElementById('c-numero');
const campoNomeCartao = document.getElementById('c-nome');
const campoValidade = document.getElementById('c-validade');
const campoCvv = document.getElementById('c-cvv');

// Nome bonito de cada forma (usado na mensagem de sucesso)
const NOME_FORMA = {
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  boleto: 'Boleto',
  retirada: 'Pagar na retirada',
};

// Qual caixa de detalhes aparece para cada forma
const PAINEL_DA_FORMA = {
  pix: 'd-pix',
  credito: 'd-cartao',
  debito: 'd-cartao',
  boleto: 'd-boleto',
  retirada: 'd-retirada',
};

let veiculoPagamento = null; // veículo que está sendo alugado agora

// Chamada pelo botão "Alugar" de cada card: abre a tela de pagamento
function alugar(veiculo) {
  veiculoPagamento = veiculo;
  formPg.reset();                      // limpa o formulário
  mostrarPainel('');                   // esconde todos os detalhes
  pgSucesso.classList.add('d-none');   // esconde mensagens antigas
  pgErro.classList.add('d-none');
  campoPgInicio.min = hojeISO();       // não deixa escolher data no passado
  campoPgFim.min = hojeISO();
  atualizarTotal();
  document.getElementById('pg-resumo').textContent =
    `${veiculo.marca} ${veiculo.modelo} · ${moeda.format(veiculo.preco)} por dia`;
  atualizarBotao();
  modalPg.showModal();
}

// Mostra só o painel da forma escolhida (Pix, cartão, boleto...)
function mostrarPainel(forma) {
  document.querySelectorAll('#modal-pagamento .detalhe').forEach((p) => {
    p.hidden = p.id !== PAINEL_DA_FORMA[forma];
  });
}

// ---- validação do cartão (só no navegador; nada disso vai ao servidor) ----

// Algoritmo de Luhn: confere se o número do cartão é válido
function luhn(numero) {
  let soma = 0;
  let dobrar = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (dobrar) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

// Validade no formato MM/AA e ainda não vencida
function validadeOk(texto) {
  const m = /^(\d{2})\/(\d{2})$/.exec(texto);
  if (!m) return false;
  const mes = Number(m[1]);
  const ano = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return false;
  return new Date(ano, mes, 0, 23, 59, 59) >= new Date(); // vale até o último dia do mês
}

function cartaoOk() {
  const numero = campoNumero.value.replace(/\D/g, '');
  return (
    numero.length >= 13 &&
    numero.length <= 19 &&
    luhn(numero) &&
    campoNomeCartao.value.trim().length >= 3 &&
    validadeOk(campoValidade.value) &&
    /^\d{3,4}$/.test(campoCvv.value)
  );
}

// NOVO: retirada e devolução preenchidas, retirada de hoje em diante
// e devolução depois da retirada
function periodoOk() {
  if (!campoPgInicio.value || !campoPgFim.value) return false;
  if (campoPgInicio.value < hojeISO()) return false;
  return diasEntre(campoPgInicio.value, campoPgFim.value) > 0;
}

// NOVO: prévia do total. O valor OFICIAL é calculado no servidor.
function atualizarTotal() {
  if (!campoPgInicio.value || !campoPgFim.value) {
    pgTotal.textContent = 'Escolha as datas para ver o total.';
    return;
  }
  const dias = diasEntre(campoPgInicio.value, campoPgFim.value);
  if (dias <= 0) {
    pgTotal.textContent = 'A devolução precisa ser depois da retirada.';
    return;
  }
  const total = dias * veiculoPagamento.preco;
  pgTotal.textContent = `${dias} ${dias === 1 ? 'dia' : 'dias'} · total de ${moeda.format(total)}`;
}

// O botão Confirmar só habilita se o período e a forma de pagamento estiverem ok
function formaValida() {
  if (!periodoOk()) return false;
  const forma = formPg.forma.value; // '' se nenhuma foi escolhida
  if (!forma) return false;
  if (forma === 'credito' || forma === 'debito') return cartaoOk();
  return true;
}

function atualizarBotao() {
  pgConfirmar.disabled = !formaValida();
}

// ---- máscaras dos campos do cartão ----
campoNumero.addEventListener('input', () => {
  const n = campoNumero.value.replace(/\D/g, '').slice(0, 19);
  campoNumero.value = n.replace(/(\d{4})(?=\d)/g, '$1 '); // 0000 0000 0000 0000
});
campoValidade.addEventListener('input', () => {
  const n = campoValidade.value.replace(/\D/g, '').slice(0, 4);
  campoValidade.value = n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n; // MM/AA
});
campoCvv.addEventListener('input', () => {
  campoCvv.value = campoCvv.value.replace(/\D/g, '').slice(0, 4);
});

// ---- eventos da tela de pagamento ----
formPg.addEventListener('change', (event) => {
  if (event.target.name === 'forma') mostrarPainel(event.target.value);
  atualizarBotao();
});
formPg.addEventListener('input', atualizarBotao);

// NOVO: ao mudar as datas, atualiza o total (e a data mínima da devolução)
campoPgInicio.addEventListener('input', () => {
  campoPgFim.min = campoPgInicio.value || hojeISO();
  atualizarTotal();
});
campoPgFim.addEventListener('input', atualizarTotal);

// Botão "Copiar" do código Pix
document.getElementById('pix-copiar').addEventListener('click', async (event) => {
  const botao = event.currentTarget;
  try {
    await navigator.clipboard.writeText(document.getElementById('pix-codigo').value);
    botao.textContent = 'Copiado!';
  } catch {
    document.getElementById('pix-codigo').select(); // se o navegador bloquear, só seleciona
  }
  setTimeout(() => (botao.textContent = 'Copiar'), 1500);
});

// Fechar a tela de pagamento
document.getElementById('pg-fechar').addEventListener('click', () => modalPg.close());
document.getElementById('pg-cancelar').addEventListener('click', () => modalPg.close());
modalPg.addEventListener('click', (event) => {
  if (event.target === modalPg) modalPg.close(); // clique fora do cartão fecha
});

formPg.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!formaValida()) return;
  // Os dados do cartão NUNCA saem daqui: só a forma escolhida segue adiante.
  confirmarAluguel(veiculoPagamento, formPg.forma.value);
});

// NOVO: envia o aluguel de verdade para o servidor (POST /api/alugueis)
async function confirmarAluguel(veiculo, forma) {
  pgErro.classList.add('d-none');
  pgConfirmar.disabled = true; // evita clicar duas vezes

  try {
    // Só vão: veículo, datas e o NOME da forma de pagamento.
    // O preço NÃO é enviado: o servidor calcula.
    const resposta = await fetch('/api/alugueis', {
      method: 'POST',
      credentials: 'include', // envia o cookie de sessão (login)
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        veiculo_id: veiculo.id,
        data_inicio: campoPgInicio.value,
        data_fim: campoPgFim.value,
        forma_pagamento: forma,
      }),
    });

    if (resposta.status === 401) {
      window.location.href = '/'; // sessão expirou: volta pro login
      return;
    }

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      // Erros de validação do FastAPI vêm numa lista; os demais, em texto
      const detalhe = Array.isArray(dados.detail)
        ? dados.detail.map((d) => d.msg.replace(/^Value error, /, '')).join(' · ')
        : dados.detail;
      pgErro.textContent = detalhe || 'Não foi possível registrar o aluguel.';
      pgErro.classList.remove('d-none');
      pgConfirmar.disabled = false;
      return;
    }

    // Sucesso: mostra o resumo com os valores que o SERVIDOR calculou
    pgSucesso.textContent =
      `Aluguel registrado: ${veiculo.marca} ${veiculo.modelo} · ${dados.dias} ` +
      `${dados.dias === 1 ? 'dia' : 'dias'} · ${moeda.format(dados.valor_total)} · ${NOME_FORMA[forma]}.`;
    pgSucesso.classList.remove('d-none');
    setTimeout(() => {
      modalPg.close();
      carregarVeiculos(); // atualiza o catálogo: o carro passa a aparecer como alugado
    }, 2000);
  } catch {
    pgErro.textContent = 'Não foi possível conectar ao servidor.';
    pgErro.classList.remove('d-none');
    pgConfirmar.disabled = false;
  }
}

// ---------------------------- FILTROS E LISTA ----------------------------

// Monta o filtro de marcas a partir dos veículos carregados
function preencherMarcas() {
  const marcaAtual = filtroMarca.value;
  const marcas = [...new Set(veiculos.map((v) => v.marca))].sort();
  filtroMarca.replaceChildren(new Option('Todas', ''));   // zera antes, pra não duplicar marcas
  marcas.forEach((m) => filtroMarca.appendChild(new Option(m, m)));
  filtroMarca.value = marcas.includes(marcaAtual) ? marcaAtual : '';
}

// Busca os veículos no back-end
async function carregarVeiculos() {
  const resposta = await fetch('/api/veiculos', { credentials: 'include' });
  if (!resposta.ok) {
    lista.replaceChildren();
    vazio.textContent = 'Não foi possível carregar os veículos.';
    vazio.classList.remove('d-none');
    return;
  }

  const dados = await resposta.json();

  // Converte os campos do banco para o formato que os cards esperam
  veiculos = dados.map((v) => ({
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    placa: v.placa,
    preco: v.preco_diaria ?? 0,
    // qualquer status que comece com "dispon" é disponível; o resto aparece como alugado
    situacao: String(v.status).toLowerCase().startsWith('dispon') ? 'disponivel' : 'alugado',
    imagem: '',
  }));

  preencherMarcas();
  render();
}

// Aplica busca, filtros e ordenação e desenha os cards
function render() {
  const termo = campoBusca.value.trim().toLowerCase();

  let resultado = veiculos.filter((v) => {
    const texto = `${v.marca} ${v.modelo}`.toLowerCase();
    if (termo && !texto.includes(termo)) return false;
    if (filtroMarca.value && v.marca !== filtroMarca.value) return false;
    if (soDisponiveis.checked && v.situacao !== 'disponivel') return false;
    return true;
  });

  if (ordenar.value === 'menor') resultado.sort((a, b) => a.preco - b.preco);
  if (ordenar.value === 'maior') resultado.sort((a, b) => b.preco - a.preco);
  if (ordenar.value === 'novo') resultado.sort((a, b) => b.ano - a.ano);

  lista.replaceChildren(...resultado.map(criarCard));
  contador.textContent = resultado.length;
  vazio.classList.toggle('d-none', resultado.length > 0);
}

// Qualquer mudança nos filtros redesenha a lista
[campoBusca, filtroMarca, ordenar, soDisponiveis].forEach((campo) =>
  campo.addEventListener('input', render)
);

carregarVeiculos(); // carrega ao abrir a página

// ---------------------------- BOTÃO ADMIN ----------------------------
// NOVO: mostra o botão "Painel admin" só para administradores.
// (Quem realmente barra o acesso é o servidor; isto é só para esconder o botão.)
async function mostrarLinkAdmin() {
  try {
    const resposta = await fetch('/api/me', { credentials: 'include' });
    if (!resposta.ok) return;
    const eu = await resposta.json();
    if (eu.perfil === 'admin') document.getElementById('link-admin').classList.remove('d-none');
  } catch {
    /* sem conexão: o botão simplesmente não aparece */
  }
}
mostrarLinkAdmin();