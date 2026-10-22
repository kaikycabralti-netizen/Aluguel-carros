// ---------------------------------------------------------------
// DADOS DE EXEMPLO (mock). Depois, troque por um fetch('/api/veiculos').
// Se tiver foto, preencha "imagem" com a URL; vazio mostra o emoji.
// ---------------------------------------------------------------
let veiculos = [];


const lista = document.getElementById('lista');
const vazio = document.getElementById('vazio');
const contador = document.getElementById('contador');
const campoBusca = document.getElementById('busca');
const filtroMarca = document.getElementById('filtro-marca');
const ordenar = document.getElementById('ordenar');
const soDisponiveis = document.getElementById('so-disponiveis');

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Cria elementos com textContent (e não innerHTML), assim os dados
// que vierem da API não conseguem injetar HTML na página.
function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function criarCard(v) {
  const disponivel = v.situacao === 'disponivel';

  const coluna = el('div', 'col-12 col-md-6 col-lg-4 col-xl-3');
  const card = el('article', 'cartao-black carro-card');

  // Imagem + selo de situação
  const img = el('div', 'carro-img');
  if (v.imagem) {
    const foto = document.createElement('img');
    foto.src = v.imagem;
    foto.alt = `${v.marca} ${v.modelo}`;
    img.appendChild(foto);
  } else {
    img.textContent = '🚗';
  }
  img.appendChild(
    el(
      'span',
      `carro-situacao ${disponivel ? 'situacao-disponivel' : 'situacao-alugado'}`,
      disponivel ? 'Disponível' : 'Alugado'
    )
  );

  // Corpo
  const corpo = el('div', 'carro-corpo');
  corpo.appendChild(el('div', 'carro-marca', `${v.marca} · ${v.ano}`));
  corpo.appendChild(el('h2', 'carro-modelo', v.modelo));

  const tags = el('div', 'carro-tags');
    [`Placa ${v.placa}`].forEach((t) =>
      tags.appendChild(el('span', 'carro-tag', t))
    );
  corpo.appendChild(tags);

  // Rodapé: preço + botão
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
  botao.disabled = !disponivel;
  if (disponivel) botao.addEventListener('click', () => alugar(v));

  rodape.append(preco, botao);
  corpo.appendChild(rodape);

  card.append(img, corpo);
  coluna.appendChild(card);
  return coluna;
}

// Aqui entra depois a tela/modal de aluguel

// ---------------------------- PAGAMENTO ----------------------------
const modalPg = document.getElementById('modal-pagamento');
const formPg = document.getElementById('form-pagamento');
const pgConfirmar = document.getElementById('pg-confirmar');
const pgSucesso = document.getElementById('pg-sucesso');

const campoNumero = document.getElementById('c-numero');
const campoNomeCartao = document.getElementById('c-nome');
const campoValidade = document.getElementById('c-validade');
const campoCvv = document.getElementById('c-cvv');

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

let veiculoPagamento = null;

// Chamada pelo botão "Alugar" de cada card
function alugar(veiculo) {
  veiculoPagamento = veiculo;
  formPg.reset();
  mostrarPainel('');
  pgSucesso.classList.add('d-none');
  document.getElementById('pg-resumo').textContent =
    `${veiculo.marca} ${veiculo.modelo} · ${moeda.format(veiculo.preco)} por dia`;
  atualizarBotao();
  modalPg.showModal();
}

function mostrarPainel(forma) {
  document.querySelectorAll('#modal-pagamento .detalhe').forEach((p) => {
    p.hidden = p.id !== PAINEL_DA_FORMA[forma];
  });
}

// ---- validação do cartão (só no navegador; nada disso é enviado ao servidor) ----
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

function formaValida() {
  const forma = formPg.forma.value; // '' se nenhuma foi escolhida
  if (!forma) return false;
  if (forma === 'credito' || forma === 'debito') return cartaoOk();
  return true;
}

function atualizarBotao() {
  pgConfirmar.disabled = !formaValida();
}

// ---- máscaras dos campos ----
campoNumero.addEventListener('input', () => {
  const n = campoNumero.value.replace(/\D/g, '').slice(0, 19);
  campoNumero.value = n.replace(/(\d{4})(?=\d)/g, '$1 ');
});
campoValidade.addEventListener('input', () => {
  const n = campoValidade.value.replace(/\D/g, '').slice(0, 4);
  campoValidade.value = n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
});
campoCvv.addEventListener('input', () => {
  campoCvv.value = campoCvv.value.replace(/\D/g, '').slice(0, 4);
});

// ---- eventos ----
formPg.addEventListener('change', (event) => {
  if (event.target.name === 'forma') mostrarPainel(event.target.value);
  atualizarBotao();
});
formPg.addEventListener('input', atualizarBotao);

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

function confirmarAluguel(veiculo, forma) {
  // Aqui entra depois a chamada ao back, por exemplo:
  // fetch('/api/alugueis', { method: 'POST', credentials: 'include',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ veiculo_id: veiculo.id, forma_pagamento: forma }) });
  pgSucesso.textContent = `Pedido registrado: ${veiculo.marca} ${veiculo.modelo} · ${NOME_FORMA[forma]}.`;
  pgSucesso.classList.remove('d-none');
  pgConfirmar.disabled = true;
  setTimeout(() => modalPg.close(), 2000);
}

function preencherMarcas() {
  const marcas = [...new Set(veiculos.map((v) => v.marca))].sort();
  marcas.forEach((m) => {
    const opt = el('option', '', m);
    opt.value = m;
    filtroMarca.appendChild(opt);
  });
}

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
    situacao: String(v.status).toLowerCase().startsWith('dispon') ? 'disponivel' : 'alugado',
    imagem: '',
  }));

  preencherMarcas();
  render();
}

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

[campoBusca, filtroMarca, ordenar, soDisponiveis].forEach((campo) =>
  campo.addEventListener('input', render)
);

carregarVeiculos();