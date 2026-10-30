// ===============================================================
// admin.js  ->  lógica do painel do administrador (view/admin.html)
//
// - lista, cadastra, edita e remove veículos
// - lista os aluguéis e deixa alterar a quantidade de dias
// - é independente: não depende do catalogo.js
//
// Lembrete: esconder botões aqui é só conforto. Quem barra o acesso
// de verdade é o servidor (erro 403 para quem não é admin).
// ===============================================================

// Formata números como dinheiro: 250 -> "R$ 250,00"
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Cria elementos com textContent (e não innerHTML): dados que vêm da API
// não conseguem injetar HTML na página (proteção contra XSS).
function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

// "2026-10-29" -> "29/10/2026"
function formatarData(iso) {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Data de hoje no formato AAAA-MM-DD, no fuso do usuário
function hojeISO() {
  return new Date().toLocaleDateString('sv-SE');
}

// Quantidade de dias entre duas datas (fim - início)
function diasEntre(inicioISO, fimISO) {
  const ms = new Date(fimISO + 'T00:00:00') - new Date(inicioISO + 'T00:00:00');
  return Math.round(ms / 86400000); // 86400000 ms = 1 dia
}

// A API devolve o erro em "detail": texto (nossos erros) ou lista (validação do FastAPI)
function textoErro(dados) {
  if (dados && typeof dados.detail === 'string') return dados.detail;
  if (dados && Array.isArray(dados.detail)) {
    return dados.detail.map((d) => d.msg.replace(/^Value error, /, '')).join(' · ');
  }
  return 'Erro inesperado. Tente de novo.';
}

// ---------------------------- CHAMADA À API ----------------------------
// Função única para falar com o servidor.
//   401 = sessão caiu           -> volta para o login
//   403 = logado, mas não admin -> volta para o catálogo
async function api(url, { method = 'GET', body } = {}) {
  const resposta = await fetch(url, {
    method,
    credentials: 'include', // envia o cookie de sessão (login)
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  if (resposta.status === 401) {
    window.location.href = '/';
    throw new Error('Sessão expirada');
  }
  if (resposta.status === 403) {
    window.location.href = '/catalogo.html';
    throw new Error('Acesso restrito ao administrador');
  }

  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    /* resposta sem corpo */
  }
  if (!resposta.ok) throw new Error(textoErro(dados));
  return dados;
}

// ---------------------------- ESTADO E ELEMENTOS ----------------------------
let veiculos = [];          // lista vinda de /api/admin/veiculos
let alugueis = [];          // lista vinda de /api/admin/alugueis
let veiculoEmEdicao = null; // null = estou cadastrando um veículo novo
let aluguelEmEdicao = null; // aluguel que está com o modal de dias aberto

const aviso = document.getElementById('aviso');
const tabelaVeiculos = document.getElementById('tabela-veiculos');
const tabelaAlugueis = document.getElementById('tabela-alugueis');

// Modal de veículo (cadastrar / editar). new bootstrap.Modal é do Bootstrap JS.
const modalVeiculo = new bootstrap.Modal(document.getElementById('modal-veiculo'));
const formVeiculo = document.getElementById('form-veiculo');
const erroVeiculo = document.getElementById('veiculo-erro');
const btnSalvarVeiculo = document.getElementById('btn-salvar-veiculo');

// Modal de período (alterar dias do aluguel)
const modalPeriodo = new bootstrap.Modal(document.getElementById('modal-periodo'));
const formPeriodo = document.getElementById('form-periodo');
const erroPeriodo = document.getElementById('periodo-erro');
const btnSalvarPeriodo = document.getElementById('btn-salvar-periodo');
const campoPInicio = document.getElementById('p-inicio');
const campoPFim = document.getElementById('p-fim');
const resumoPeriodo = document.getElementById('periodo-resumo');

// Texto e cor do selo de cada status do veículo
const ROTULO_STATUS = {
  disponivel: ['Disponível', 'situacao-disponivel'],
  alugado: ['Alugado', 'situacao-alugado'],
  manutencao: ['Manutenção', 'situacao-manutencao'],
};

// Nome bonito de cada forma de pagamento
const NOME_FORMA = {
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  boleto: 'Boleto',
  retirada: 'Na retirada',
};

// Mostra um erro geral no topo da página
function mostrarAviso(mensagem) {
  aviso.textContent = mensagem;
  aviso.classList.remove('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Atalhos para montar as tabelas
function celula(texto, classe) {
  return el('td', classe, texto);
}

function botao(texto, classe, aoClicar) {
  const b = el('button', `btn btn-sm ${classe}`, texto);
  b.type = 'button';
  b.addEventListener('click', aoClicar);
  return b;
}

// ---------------------------- RESUMO (4 cartões) ----------------------------
function atualizarResumo() {
  document.getElementById('r-total').textContent = veiculos.length;
  document.getElementById('r-disponiveis').textContent = veiculos.filter(
    (v) => v.status === 'disponivel'
  ).length;
  // "em_andamento" e "encerrado" são calculados pelo servidor (prazo já passou)
  document.getElementById('r-andamento').textContent = alugueis.filter(
    (a) => a.situacao === 'em_andamento'
  ).length;
  document.getElementById('r-atrasados').textContent = alugueis.filter(
    (a) => a.situacao === 'encerrado'
  ).length;
}

// ---------------------------- ABA VEÍCULOS ----------------------------
// Desenha a tabela de veículos
function renderVeiculos() {
  const linhas = veiculos.map((v) => {
    const tr = el('tr');
    tr.appendChild(celula(`${v.marca} ${v.modelo}`));
    tr.appendChild(celula(v.ano));
    tr.appendChild(celula(v.placa));
    tr.appendChild(celula(moeda.format(v.preco_diaria)));

    // Selo colorido do status
    const [rotulo, classe] = ROTULO_STATUS[v.status] || [v.status, 'situacao-alugado'];
    const tdStatus = el('td');
    tdStatus.appendChild(el('span', `badge-status ${classe}`, rotulo));
    tr.appendChild(tdStatus);

    // Botões Editar e Remover
    const acoes = el('td', 'text-end text-nowrap');
    acoes.append(
      botao('Editar', 'btn-outline-warning me-2', () => abrirVeiculo(v)),
      botao('Remover', 'btn-outline-danger', () => removerVeiculo(v))
    );
    tr.appendChild(acoes);
    return tr;
  });

  // Tabela vazia: mostra uma mensagem
  if (linhas.length === 0) {
    const tr = el('tr');
    const td = el('td', 'text-center text-muted py-4', 'Nenhum veículo cadastrado.');
    td.colSpan = 6;
    tr.appendChild(td);
    linhas.push(tr);
  }
  tabelaVeiculos.replaceChildren(...linhas);
}

// Abre o modal. Sem argumento = novo veículo; com um veículo = edição.
function abrirVeiculo(v = null) {
  veiculoEmEdicao = v;
  erroVeiculo.classList.add('d-none');
  formVeiculo.reset();
  document.getElementById('veiculo-titulo').textContent = v ? 'Editar veículo' : 'Novo veículo';
  document.getElementById('v-ano').max = new Date().getFullYear() + 1;

  // Na edição, preenche os campos com os dados atuais
  if (v) {
    document.getElementById('v-marca').value = v.marca;
    document.getElementById('v-modelo').value = v.modelo;
    document.getElementById('v-ano').value = v.ano;
    document.getElementById('v-placa').value = v.placa;
    document.getElementById('v-preco').value = v.preco_diaria || '';
    document.getElementById('v-status').value = v.status;
  }
  modalVeiculo.show();
}

// Salvar: faz POST (novo) ou PUT (edição)
formVeiculo.addEventListener('submit', async (event) => {
  event.preventDefault();
  erroVeiculo.classList.add('d-none');

  const corpo = {
    marca: document.getElementById('v-marca').value.trim(),
    modelo: document.getElementById('v-modelo').value.trim(),
    ano: Number(document.getElementById('v-ano').value),
    placa: document.getElementById('v-placa').value.trim(),
    preco_diaria: Number(document.getElementById('v-preco').value),
    status: document.getElementById('v-status').value,
  };

  btnSalvarVeiculo.disabled = true; // evita clicar duas vezes
  try {
    if (veiculoEmEdicao) {
      await api(`/api/admin/veiculos/${veiculoEmEdicao.id}`, { method: 'PUT', body: corpo });
    } else {
      await api('/api/admin/veiculos', { method: 'POST', body: corpo });
    }
    modalVeiculo.hide();
    await carregarTudo(); // recarrega as tabelas com os dados novos
  } catch (e) {
    // erro do servidor (ex.: "Placa inválida") aparece dentro do modal
    erroVeiculo.textContent = e.message;
    erroVeiculo.classList.remove('d-none');
  } finally {
    btnSalvarVeiculo.disabled = false;
  }
});

// Remover (pede confirmação). O servidor recusa se o veículo já teve aluguel.
async function removerVeiculo(v) {
  if (!confirm(`Remover ${v.marca} ${v.modelo} (${v.placa})?`)) return;
  try {
    await api(`/api/admin/veiculos/${v.id}`, { method: 'DELETE' });
    await carregarTudo();
  } catch (e) {
    mostrarAviso(e.message);
  }
}

// ---------------------------- ABA ALUGUÉIS ----------------------------
// Texto da coluna "Prazo": quanto falta, ou há quanto tempo venceu
function textoPrazo(a) {
  if (a.situacao === 'futuro') return `Começa em ${diasEntre(hojeISO(), a.data_inicio)} d`;
  if (a.situacao === 'encerrado') return `Venceu há ${Math.abs(a.dias_restantes)} d`;
  return a.dias_restantes === 0 ? 'Vence hoje' : `Restam ${a.dias_restantes} d`;
}

// Cor do selo de prazo
const CLASSE_PRAZO = {
  futuro: 'situacao-futuro',
  em_andamento: 'situacao-disponivel',
  encerrado: 'situacao-alugado',
};

// Desenha a tabela de aluguéis
function renderAlugueis() {
  const linhas = alugueis.map((a) => {
    const tr = el('tr');
    tr.appendChild(celula(a.veiculo));
    tr.appendChild(celula(a.cliente));
    tr.appendChild(celula(formatarData(a.data_inicio)));
    tr.appendChild(celula(formatarData(a.data_fim)));
    tr.appendChild(celula(`${a.dias} ${a.dias === 1 ? 'dia' : 'dias'}`));

    const tdPrazo = el('td');
    tdPrazo.appendChild(el('span', `badge-status ${CLASSE_PRAZO[a.situacao]}`, textoPrazo(a)));
    tr.appendChild(tdPrazo);

    tr.appendChild(celula(NOME_FORMA[a.forma_pagamento] || '—'));
    tr.appendChild(celula(moeda.format(a.valor_total)));

    const acoes = el('td', 'text-end text-nowrap');
    acoes.appendChild(botao('Alterar dias', 'btn-outline-warning', () => abrirPeriodo(a)));
    tr.appendChild(acoes);
    return tr;
  });

  if (linhas.length === 0) {
    const tr = el('tr');
    const td = el('td', 'text-center text-muted py-4', 'Nenhum aluguel registrado ainda.');
    td.colSpan = 9;
    tr.appendChild(td);
    linhas.push(tr);
  }
  tabelaAlugueis.replaceChildren(...linhas);
}

// Abre o modal de alterar período, com as datas atuais
function abrirPeriodo(a) {
  aluguelEmEdicao = a;
  erroPeriodo.classList.add('d-none');
  document.getElementById('periodo-titulo').textContent = `Alterar período · ${a.veiculo}`;
  campoPInicio.value = a.data_inicio;
  campoPFim.value = a.data_fim;
  atualizarResumoPeriodo();
  modalPeriodo.show();
}

// Prévia: "Novo período: 7 dias (antes: 3) · novo valor R$ 1.750,00"
function atualizarResumoPeriodo() {
  if (!campoPInicio.value || !campoPFim.value) return;
  const dias = diasEntre(campoPInicio.value, campoPFim.value);
  if (dias <= 0) {
    resumoPeriodo.textContent = 'A devolução precisa ser depois da retirada.';
    return;
  }
  // Mantém a diária original do aluguel (o servidor faz o cálculo oficial)
  const diaria = aluguelEmEdicao.valor_total / aluguelEmEdicao.dias;
  resumoPeriodo.textContent =
    `Novo período: ${dias} ${dias === 1 ? 'dia' : 'dias'} ` +
    `(antes: ${aluguelEmEdicao.dias}) · novo valor ${moeda.format(dias * diaria)}`;
}

// A prévia se atualiza sempre que o admin muda uma das datas
campoPInicio.addEventListener('change', atualizarResumoPeriodo);
campoPFim.addEventListener('change', atualizarResumoPeriodo);

// Salvar o novo período (PUT). O servidor valida e recalcula o valor.
formPeriodo.addEventListener('submit', async (event) => {
  event.preventDefault();
  erroPeriodo.classList.add('d-none');

  btnSalvarPeriodo.disabled = true;
  try {
    await api(`/api/admin/alugueis/${aluguelEmEdicao.id}`, {
      method: 'PUT',
      body: { data_inicio: campoPInicio.value, data_fim: campoPFim.value },
    });
    modalPeriodo.hide();
    await carregarTudo();
  } catch (e) {
    erroPeriodo.textContent = e.message;
    erroPeriodo.classList.remove('d-none');
  } finally {
    btnSalvarPeriodo.disabled = false;
  }
});

// ---------------------------- INÍCIO ----------------------------
// Busca veículos e aluguéis ao mesmo tempo e redesenha tudo
async function carregarTudo() {
  [veiculos, alugueis] = await Promise.all([
    api('/api/admin/veiculos'),
    api('/api/admin/alugueis'),
  ]);
  renderVeiculos();
  renderAlugueis();
  atualizarResumo();
}

// Botão Sair: avisa o servidor e volta para o login
async function sair() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/';
  }
}

document.getElementById('btn-novo').addEventListener('click', () => abrirVeiculo());
document.getElementById('btn-sair').addEventListener('click', sair);

// Ao abrir a página, carrega os dados (se falhar, mostra o aviso no topo)
carregarTudo().catch((e) => mostrarAviso(e.message));