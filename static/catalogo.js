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
const modalPg = document.getElementById('modal-pagamento');
const formPg = document.getElementById('form-pagamento');
const pgConfirmar = document.getElementById('pg-confirmar');
const pgSucesso = document.getElementById('pg-sucesso');

const campoPgInicio = document.getElementById('pg-inicio');
const campoPgFim = document.getElementById('pg-fim');
const pgTotal = document.getElementById('pg-total');
const pgErro = document.getElementById('pg-erro');

function hojeISO() {
  return new Date().toLocaleDateString('sv-SE');
}

function diasEntre(inicioISO, fimISO) {
  const ms = new Date(fimISO + 'T00:00:00') - new Date(inicioISO + 'T00:00:00');
  return Math.round(ms / 86400000);
}

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

const PAINEL_DA_FORMA = {
  pix: 'd-pix',
  credito: 'd-cartao',
  debito: 'd-cartao',
  boleto: 'd-boleto',
  retirada: 'd-retirada',
};

let veiculoPagamento = null;

function alugar(veiculo) {
  veiculoPagamento = veiculo;
  formPg.reset();
  mostrarPainel('');
  pgSucesso.classList.add('d-none');
  pgErro.classList.add('d-none');
  campoPgInicio.min = hojeISO();
  campoPgFim.min = hojeISO();
  atualizarTotal();
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
  return new Date(ano, mes, 0, 23, 59, 59) >= new Date();
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

function periodoOk() {
  if (!campoPgInicio.value || !campoPgFim.value) return false;
  if (campoPgInicio.value < hojeISO()) return false;
  return diasEntre(campoPgInicio.value, campoPgFim.value) > 0;
}

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

function formaValida() {
  if (!periodoOk()) return false;
  const forma = formPg.forma.value;
  if (!forma) return false;
  if (forma === 'credito' || forma === 'debito') return cartaoOk();
  return true;
}

function atualizarBotao() {
  pgConfirmar.disabled = !formaValida();
}

if (campoNumero) {
  campoNumero.addEventListener('input', () => {
    const n = campoNumero.value.replace(/\D/g, '').slice(0, 19);
    campoNumero.value = n.replace(/(\d{4})(?=\d)/g, '$1 ');
  });
}
if (campoValidade) {
  campoValidade.addEventListener('input', () => {
    const n = campoValidade.value.replace(/\D/g, '').slice(0, 4);
    campoValidade.value = n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2)}` : n;
  });
}
if (campoCvv) {
  campoCvv.addEventListener('input', () => {
    campoCvv.value = campoCvv.value.replace(/\D/g, '').slice(0, 4);
  });
}

if (formPg) {
  formPg.addEventListener('change', (event) => {
    if (event.target.name === 'forma') mostrarPainel(event.target.value);
    atualizarBotao();
  });
  formPg.addEventListener('input', atualizarBotao);
}

if (campoPgInicio) {
  campoPgInicio.addEventListener('input', () => {
    campoPgFim.min = campoPgInicio.value || hojeISO();
    atualizarTotal();
  });
}
if (campoPgFim) {
  campoPgFim.addEventListener('input', atualizarTotal);
}

const pixCopiar = document.getElementById('pix-copiar');
if (pixCopiar) {
  pixCopiar.addEventListener('click', async (event) => {
    const botao = event.currentTarget;
    try {
      await navigator.clipboard.writeText(document.getElementById('pix-codigo').value);
      botao.textContent = 'Copiado!';
    } catch {
      document.getElementById('pix-codigo').select();
    }
    setTimeout(() => (botao.textContent = 'Copiar'), 1500);
  });
}

const pgFechar = document.getElementById('pg-fechar');
const pgCancelar = document.getElementById('pg-cancelar');
if (pgFechar) pgFechar.addEventListener('click', () => modalPg.close());
if (pgCancelar) pgCancelar.addEventListener('click', () => modalPg.close());
if (modalPg) {
  modalPg.addEventListener('click', (event) => {
    if (event.target === modalPg) modalPg.close();
  });
}

if (formPg) {
  formPg.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!formaValida()) return;
    confirmarAluguel(veiculoPagamento, formPg.forma.value);
  });
}

async function confirmarAluguel(veiculo, forma) {
  pgErro.classList.add('d-none');
  pgConfirmar.disabled = true;

  try {
    const resposta = await fetch('/api/alugueis', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        veiculo_id: veiculo.id,
        data_inicio: campoPgInicio.value,
        data_fim: campoPgFim.value,
        forma_pagamento: forma,
      }),
    });

    if (resposta.status === 401) {
      window.location.href = '/';
      return;
    }

    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const detalhe = Array.isArray(dados.detail)
        ? dados.detail.map((d) => d.msg.replace(/^Value error, /, '')).join(' · ')
        : dados.detail;
      pgErro.textContent = detalhe || 'Não foi possível registrar o aluguel.';
      pgErro.classList.remove('d-none');
      pgConfirmar.disabled = false;
      return;
    }

    pgSucesso.textContent =
      `Aluguel registrado: ${veiculo.marca} ${veiculo.modelo} · ${dados.dias} ` +
      `${dados.dias === 1 ? 'dia' : 'dias'} · ${moeda.format(dados.valor_total)} · ${NOME_FORMA[forma]}.`;
    pgSucesso.classList.remove('d-none');
    setTimeout(() => {
      modalPg.close();
      carregarVeiculos();
    }, 2000);
  } catch {
    pgErro.textContent = 'Não foi possível conectar ao servidor.';
    pgErro.classList.remove('d-none');
    pgConfirmar.disabled = false;
  }
}

// ---------------------------- FILTROS E LISTA ----------------------------
function preencherMarcas() {
  if (!filtroMarca) return;
  const marcaAtual = filtroMarca.value;
  const marcas = [...new Set(veiculos.map((v) => v.marca))].sort();
  filtroMarca.replaceChildren(new Option('Todas', ''));
  marcas.forEach((m) => filtroMarca.appendChild(new Option(m, m)));
  filtroMarca.value = marcas.includes(marcaAtual) ? marcaAtual : '';
}

async function carregarVeiculos() {
  if (!lista) return;
  const resposta = await fetch('/api/veiculos', { credentials: 'include' });
  if (!resposta.ok) {
    lista.replaceChildren();
    if (vazio) {
      vazio.textContent = 'Não foi possível carregar os veículos.';
      vazio.classList.remove('d-none');
    }
    return;
  }

  const dados = await resposta.json();
  veiculos = dados.map((v) => ({
    id: v.id,
    marca: v.marca,
    modelo: v.modelo,
    ano: v.ano,
    placa: v.placa,
    preco: v.preco_diaria ?? 0,
    situacao: String(v.status).toLowerCase().startsWith('dispon') ? 'disponivel' : 'alugado',
    imagem: v.imagem || '',
  }));

  preencherMarcas();
  render();
}

function render() {
  if (!lista) return;
  const termo = campoBusca ? campoBusca.value.trim().toLowerCase() : '';

  let resultado = veiculos.filter((v) => {
    const texto = `${v.marca} ${v.modelo}`.toLowerCase();
    if (termo && !texto.includes(termo)) return false;
    if (filtroMarca && filtroMarca.value && v.marca !== filtroMarca.value) return false;
    if (soDisponiveis && soDisponiveis.checked && v.situacao !== 'disponivel') return false;
    return true;
  });

  if (ordenar) {
    if (ordenar.value === 'menor') resultado.sort((a, b) => a.preco - b.preco);
    if (ordenar.value === 'maior') resultado.sort((a, b) => b.preco - a.preco);
    if (ordenar.value === 'novo') resultado.sort((a, b) => b.ano - a.ano);
  }

  lista.replaceChildren(...resultado.map(criarCard));
  if (contador) contador.textContent = resultado.length;
  if (vazio) vazio.classList.toggle('d-none', resultado.length > 0);
}

[campoBusca, filtroMarca, ordenar, soDisponiveis].forEach((campo) => {
  if (campo) campo.addEventListener('input', render);
});

carregarVeiculos();

async function mostrarLinkAdmin() {
  try {
    const resposta = await fetch('/api/me', { credentials: 'include' });
    if (!resposta.ok) return;
    const eu = await resposta.json();
    const linkAdmin = document.getElementById('link-admin');
    if (eu.perfil === 'admin' && linkAdmin) linkAdmin.classList.remove('d-none');
  } catch {}
}
mostrarLinkAdmin();

// ---------------------------- MODAL CUSTOMIZADO (SEGURO COM AUTO-CRIAÇÃO) ----------------------------
function mostrarModalCustomizado(mensagem, comBotoes = true) {
    return new Promise((resolve) => {
        let modalElement = document.getElementById('modalConfirmacao');
        
        if (!modalElement) {
            const divModal = document.createElement('div');
            divModal.innerHTML = `
                <div class="modal fade" id="modalConfirmacao" tabindex="-1" aria-hidden="true">
                  <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content border-0 shadow-lg rounded-4 p-4 text-center">
                      <h5 id="modalTextoMensagem" class="mb-4 text-dark fw-semibold"></h5>
                      <div id="modalBotoes" class="d-flex justify-content-center gap-3"></div>
                    </div>
                  </div>
                </div>
            `;
            document.body.appendChild(divModal);
            modalElement = document.getElementById('modalConfirmacao');
        }

        const textoEl = document.getElementById('modalTextoMensagem');
        const divBotoes = document.getElementById('modalBotoes');
        
        textoEl.textContent = mensagem;

        if (comBotoes) {
            divBotoes.innerHTML = `
                <button type="button" id="btnNaoModal" class="btn btn-secondary px-4 rounded-pill">Cancelar</button>
                <button type="button" id="btnSimModal" class="btn btn-danger px-4 rounded-pill">Confirmar</button>
            `;
        } else {
            divBotoes.innerHTML = `
                <button type="button" id="btnOkModal" class="btn btn-primary px-4 rounded-pill">OK</button>
            `;
        }

        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        if (comBotoes) {
            document.getElementById('btnSimModal').onclick = () => {
                modal.hide();
                resolve(true);
            };
            document.getElementById('btnNaoModal').onclick = () => {
                modal.hide();
                resolve(false);
            };
        } else {
            document.getElementById('btnOkModal').onclick = () => {
                modal.hide();
                resolve(true);
            };
        }
    });
}

// ---------------------------- GERENCIAR MEUS ALUGUÉIS E CANCELAMENTO ----------------------------
const meusAlugueisLista = document.getElementById('meus-alugueis-lista');
const meusAlugueisVazio = document.getElementById('meus-alugueis-vazio');

async function carregarMeusAlugueis() {
    if (!meusAlugueisLista) return;

    try {
        const resposta = await fetch('/api/alugueis', { credentials: 'include' });
        if (!resposta.ok) return;

        const alugueis = await resposta.json();
        meusAlugueisLista.replaceChildren();

        if (alugueis.length === 0) {
            if (meusAlugueisVazio) meusAlugueisVazio.classList.remove('d-none');
            return;
        }

        if (meusAlugueisVazio) meusAlugueisVazio.classList.add('d-none');

        alugueis.forEach((a) => {
            const item = el('div', 'list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center mb-2 rounded');
            
            const info = el('div');
            info.appendChild(el('strong', '', a.veiculo));
            info.appendChild(el('div', 'small text-muted', `De ${a.data_inicio} até ${a.data_fim} (${a.dias} dias) · Total: ${moeda.format(a.valor_total)}`));
            
            const botaoCancelar = el('button', 'btn btn-danger btn-sm rounded-pill px-3', 'Cancelar Aluguel');
            botaoCancelar.type = 'button';
            botaoCancelar.addEventListener('click', () => cancelarAluguel(a.id, a.data_inicio));

            item.append(info, botaoCancelar);
            meusAlugueisLista.appendChild(item);
        });
    } catch (e) {
        console.error("Erro ao carregar aluguéis", e);
    }
}

async function cancelarAluguel(idAluguel, dataInicio) {
    const hoje = hojeISO();
    
    // Regra: Bloqueia cancelamento se for o dia de início ou posterior
    if (dataInicio && dataInicio <= hoje) {
        await mostrarModalCustomizado(
            "Não é permitido cancelar um aluguel no dia de início ou após o início da vigência.",
            false
        );
        return;
    }

    const confirmado = await mostrarModalCustomizado(
        "Tem certeza que deseja cancelar este aluguel? O veículo voltará a ficar disponível.",
        true
    );

    if (!confirmado) return;

    try {
        const resposta = await fetch(`/api/alugueis/${idAluguel}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (resposta.ok) {
            await mostrarModalCustomizado("Aluguel cancelado com sucesso!", false);
            carregarMeusAlugueis();
            carregarVeiculos();
        } else {
            const erro = await resposta.json().catch(() => ({}));
            await mostrarModalCustomizado("Erro ao cancelar: " + (erro.detail || "Erro desconhecido"), false);
        }
    } catch (e) {
        await mostrarModalCustomizado("Erro de conexão com o servidor ao tentar cancelar.", false);
    }
}

async function cancelarAluguel(idAluguel, dataInicio) {
    const hoje = hojeISO(); // Formato AAAA-MM-DD
    
    // Validação local rápida
    if (dataInicio && dataInicio <= hoje) {
        await mostrarModalCustomizado(
            "Não é possível cancelar um aluguel que já iniciou ou é para hoje.",
            false
        );
        return;
    }

    const confirmado = await mostrarModalCustomizado(
        "Tem certeza que deseja cancelar este aluguel? O veículo voltará a ficar disponível.",
        true
    );

    if (!confirmado) return;

    try {
        const resposta = await fetch(`/api/alugueis/${idAluguel}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (resposta.ok) {
            await mostrarModalCustomizado("Aluguel cancelado com sucesso!", false);
            carregarMeusAlugueis(); // Atualiza a listagem de aluguéis
            carregarVeiculos();     // Atualiza o catálogo visualmente
        } else {
            const erro = await resposta.json().catch(() => ({}));
            // Exibe exatamente o erro vindo do backend (ex: se tentar burlar e cancelar no dia)
            await mostrarModalCustomizado(erro.detail || "Erro ao cancelar o aluguel.", false);
        }
    } catch (e) {
        await mostrarModalCustomizado("Erro de conexão com o servidor ao tentar cancelar.", false);
    }
}

// ---------------------------- MODAL CUSTOMIZADO (MODERNO E ESTILIZADO) ----------------------------
function mostrarModalCustomizado(mensagem, comBotoes = true) {
    return new Promise((resolve) => {
        let modalElement = document.getElementById('modalConfirmacao');
        
        if (!modalElement) {
            const divModal = document.createElement('div');
            divModal.innerHTML = `
                <div class="modal fade" id="modalConfirmacao" tabindex="-1" aria-hidden="true">
                  <div class="modal-dialog modal-dialog-centered">
                    <!-- Alterado para fundo escuro (bg-dark), texto claro e bordas bem arredondadas -->
                    <div class="modal-content bg-dark text-light border border-secondary shadow-lg rounded-4 p-4 text-center">
                      <h5 id="modalTextoMensagem" class="mb-4 fw-semibold text-light"></h5>
                      <div id="modalBotoes" class="d-flex justify-content-center gap-3"></div>
                    </div>
                  </div>
                </div>
            `;
            document.body.appendChild(divModal);
            modalElement = document.getElementById('modalConfirmacao');
        }

        const textoEl = document.getElementById('modalTextoMensagem');
        const divBotoes = document.getElementById('modalBotoes');
        
        textoEl.textContent = mensagem;

        if (comBotoes) {
            divBotoes.innerHTML = `
                <button type="button" id="btnNaoModal" class="btn btn-outline-light px-4 rounded-pill">Cancelar</button>
                <button type="button" id="btnSimModal" class="btn btn-danger px-4 rounded-pill">Confirmar</button>
            `;
        } else {
            divBotoes.innerHTML = `
                <button type="button" id="btnOkModal" class="btn btn-warning px-4 rounded-pill text-dark fw-bold">OK</button>
            `;
        }

        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        if (comBotoes) {
            document.getElementById('btnSimModal').onclick = () => {
                modal.hide();
                resolve(true);
            };
            document.getElementById('btnNaoModal').onclick = () => {
                modal.hide();
                resolve(false);
            };
        } else {
            document.getElementById('btnOkModal').onclick = () => {
                modal.hide();
                resolve(true);
            };
        }
    });
}


carregarMeusAlugueis();