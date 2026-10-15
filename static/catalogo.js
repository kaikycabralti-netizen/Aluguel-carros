// ---------------------------------------------------------------
// DADOS DE EXEMPLO (mock). Depois, troque por um fetch('/api/veiculos').
// Se tiver foto, preencha "imagem" com a URL; vazio mostra o emoji.
// ---------------------------------------------------------------
const veiculos = [
  { id: 1, marca: 'Toyota', modelo: 'Corolla', ano: 2023, preco: 220, cambio: 'Automático', lugares: 5, combustivel: 'Flex', situacao: 'disponivel', imagem: '' },
  { id: 2, marca: 'Chevrolet', modelo: 'Onix', ano: 2022, preco: 130, cambio: 'Manual', lugares: 5, combustivel: 'Flex', situacao: 'disponivel', imagem: '' },
  { id: 3, marca: 'Jeep', modelo: 'Compass', ano: 2024, preco: 320, cambio: 'Automático', lugares: 5, combustivel: 'Diesel', situacao: 'alugado', imagem: '' },
  { id: 4, marca: 'Volkswagen', modelo: 'T-Cross', ano: 2023, preco: 210, cambio: 'Automático', lugares: 5, combustivel: 'Flex', situacao: 'disponivel', imagem: '' },
  { id: 5, marca: 'Fiat', modelo: 'Mobi', ano: 2021, preco: 95, cambio: 'Manual', lugares: 4, combustivel: 'Flex', situacao: 'disponivel', imagem: '' },
  { id: 6, marca: 'Hyundai', modelo: 'HB20', ano: 2022, preco: 140, cambio: 'Manual', lugares: 5, combustivel: 'Flex', situacao: 'alugado', imagem: '' },
  { id: 7, marca: 'Toyota', modelo: 'Hilux', ano: 2024, preco: 380, cambio: 'Automático', lugares: 5, combustivel: 'Diesel', situacao: 'disponivel', imagem: '' },
  { id: 8, marca: 'Honda', modelo: 'Civic', ano: 2023, preco: 250, cambio: 'Automático', lugares: 5, combustivel: 'Flex', situacao: 'disponivel', imagem: '' },
];

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
  [v.cambio, `${v.lugares} lugares`, v.combustivel].forEach((t) =>
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
function alugar(veiculo) {
  alert(`Alugar: ${veiculo.marca} ${veiculo.modelo} (id ${veiculo.id})`);
}

function preencherMarcas() {
  const marcas = [...new Set(veiculos.map((v) => v.marca))].sort();
  marcas.forEach((m) => {
    const opt = el('option', '', m);
    opt.value = m;
    filtroMarca.appendChild(opt);
  });
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

preencherMarcas();
render();
