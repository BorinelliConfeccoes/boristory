'use strict';

/**
 * Motor de detecção de pedidos para mensagens de WhatsApp.
 *
 * Funciona 100% offline (sem IA externa): usa heurísticas em português
 * para decidir se uma mensagem é um pedido e extrair os dados estruturados
 * (cliente, produtos/quantidades, valores e status).
 *
 * Pensado para confecção (Borinelli Confecções), mas tudo é configurável
 * pelas listas abaixo — basta editar para o seu vocabulário.
 */

// Produtos e suas CATEGORIAS. Use a forma singular com acento — o motor
// tolera plurais (camiseta→camisetas) e remove acentos ao comparar.
// Edite à vontade para o vocabulário da sua confecção.
const CATEGORIAS_PRODUTO = {
  Camisetas:  ['camiseta', 'camisa', 'regata', 'baby look', 'babylook', 'cropped', 'gola polo', 'polo'],
  Moletons:   ['moletom', 'blusão', 'blusa', 'casaco', 'jaqueta', 'canguru', 'agasalho'],
  'Calças e Shorts': ['calça', 'short', 'bermuda', 'legging', 'jogger'],
  Vestidos:   ['vestido', 'saia', 'macacão'],
  Uniformes:  ['uniforme', 'farda', 'fardamento', 'jaleco', 'avental', 'jersey'],
  Acessórios: ['boné', 'touca', 'meia', 'sacola', 'ecobag', 'mochila'],
  Outros:     ['conjunto', 'kit', 'pijama', 'cueca', 'calcinha', 'sutiã', 'abadá', 'enxoval'],
};

// "Trabalho de PL" — categoria especial detectada por palavra-chave, não por
// produto (plotagem / personalização / estampa por placa, etc.). Ajuste aqui.
const PL_KEYWORDS = ['trabalho de pl', 'trabalho pl', ' pl ', 'plotagem', 'plotter', 'placa', 'silk', 'serigrafia', 'estampa', 'estamparia', 'sublimacao', 'sublimação', 'dtf', 'transfer'];
const CATEGORIA_PL = 'Trabalho PL';

// Lista achatada de todos os produtos (para extração de itens).
const PRODUTOS = Object.values(CATEGORIAS_PRODUTO).flat();

// Mapa produto(normalizado) -> categoria.
const PRODUTO_CATEGORIA = {};
for (const [cat, lista] of Object.entries(CATEGORIAS_PRODUTO)) {
  for (const p of lista) PRODUTO_CATEGORIA[semAcento(p.toLowerCase())] = cat;
}

function categoriaDoProduto(produto) {
  return PRODUTO_CATEGORIA[semAcento(String(produto).toLowerCase())] || 'Outros';
}

// Palavras que indicam intenção de comprar / encomendar.
const INTENCAO = [
  'quero', 'queria', 'gostaria', 'preciso', 'precisava', 'necessito',
  'encomendar', 'encomenda', 'pedido', 'pedir', 'comprar', 'compra',
  'fazer', 'manda', 'mandar', 'me ve', 'me vê', 'me ver', 'me da', 'me dá',
  'fecho', 'fechar', 'vou querer', 'vou levar', 'pode ser', 'orcamento', 'orçamento',
  'cotacao', 'cotação', 'tem como', 'consegue', 'gostaríamos', 'gostariamos',
  'reservar', 'reserva', 'separa', 'separar',
];

// Tamanhos reconhecidos.
const TAMANHOS_LETRA = ['pp', 'p', 'm', 'g', 'gg', 'xg', 'xgg', 'exg', 'eg'];

// Cores comuns.
const CORES = [
  'preto', 'preta', 'branco', 'branca', 'azul', 'vermelho', 'vermelha',
  'verde', 'amarelo', 'amarela', 'rosa', 'roxo', 'roxa', 'cinza', 'marrom',
  'bege', 'laranja', 'vinho', 'lilas', 'lilás', 'dourado', 'prata',
  'turquesa', 'salmao', 'salmão', 'nude', 'caramelo', 'mostarda',
];

// Palavras-chave de status. A ordem importa: o status mais "avançado" vence.
const STATUS_REGRAS = [
  { status: 'cancelado', palavras: ['cancela', 'cancelar', 'cancelado', 'desisti', 'nao quero mais', 'não quero mais'] },
  { status: 'entregue', palavras: ['entreguei', 'entregue', 'recebi', 'recebido', 'chegou', 'retirei', 'retirado'] },
  { status: 'pago', palavras: ['paguei', 'pago', 'pix enviado', 'comprovante', 'transferi', 'ja paguei', 'já paguei', 'efetuei o pagamento'] },
  { status: 'producao', palavras: ['producao', 'produção', 'em producao', 'costurando', 'fazendo', 'confeccionando', 'em andamento'] },
  { status: 'confirmado', palavras: ['confirmado', 'confirma', 'fechado', 'fechei', 'pode fazer', 'pode produzir', 'aprovado'] },
];

// Remove acentos para comparar de forma robusta.
function semAcento(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizar(texto) {
  return semAcento(String(texto || '').toLowerCase());
}

// Conta quantas palavras de uma lista aparecem no texto (com limite de palavra).
function encontrar(textoNorm, lista) {
  const achados = [];
  for (const termo of lista) {
    const t = semAcento(termo.toLowerCase());
    // 's?' tolera plurais simples (preta/pretas, vestido/vestidos).
    const re = new RegExp('(^|[^a-z0-9])' + escaparRegex(t) + 's?([^a-z0-9]|$)');
    if (re.test(textoNorm)) achados.push(termo);
  }
  return achados;
}

function escaparRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Núcleo de regex para um produto (já normalizado, sem acento) que tolera
// plurais do português: -m→-ns (moletom→moletons), -ão→-ões (já sem acento:
// -ao→-oes), e o -s comum (camiseta→camisetas, short→shorts).
function nucleoProduto(pNorm) {
  const e = escaparRegex(pNorm);
  if (pNorm.endsWith('m')) return escaparRegex(pNorm.slice(0, -1)) + '(?:m|ns)';
  if (pNorm.endsWith('ao')) return escaparRegex(pNorm.slice(0, -2)) + '(?:ao|oes)';
  return e + 's?';
}

// Encontra produtos no texto (normalizado), com tolerância a plurais.
// Retorna os nomes canônicos (de PRODUTOS) encontrados.
function encontrarProdutos(textoNorm) {
  const achados = [];
  for (let i = 0; i < PRODUTOS.length; i++) {
    const pNorm = semAcento(PRODUTOS[i].toLowerCase());
    const re = new RegExp('(^|[^a-z0-9])' + nucleoProduto(pNorm) + '([^a-z0-9]|$)');
    if (re.test(textoNorm)) achados.push(PRODUTOS[i]);
  }
  return achados;
}

/**
 * Extrai itens no formato "<quantidade> <produto> [tamanho] [cor]".
 * Ex.: "3 camisetas pretas M", "10 calças jeans G".
 */
function extrairItens(textoOriginal) {
  const itens = [];
  const norm = normalizar(textoOriginal);

  // quantidade (1-4 dígitos) seguida, em até ~6 palavras, de um produto conhecido.
  const re = /(\d{1,4})\s+([a-zà-ú0-9\s]{0,40}?)\b/gi;
  let m;
  const produtosNorm = PRODUTOS.map((p) => semAcento(p.toLowerCase()));

  while ((m = re.exec(norm)) !== null) {
    const qtd = parseInt(m[1], 10);
    if (!qtd || qtd > 100000) continue;
    // janela de busca após o número (até o próximo número, p/ não invadir o item seguinte)
    const resto = norm.slice(m.index + m[0].length);
    const proxNum = resto.search(/\b\d{1,4}\s+[a-zà-ú]/);
    const fim = proxNum >= 0 ? m.index + m[0].length + proxNum : m.index + 40;
    const janela = norm.slice(m.index, Math.min(fim, m.index + 60));
    // escolhe o produto que aparece MAIS PERTO do número (menor posição no texto),
    // não o primeiro da lista — assim "10 calças ... 5 moletons" casa corretamente.
    // 's?' tolera plurais (calça→calças, short→shorts).
    let produto = null;
    let melhorPos = Infinity;
    for (const p of produtosNorm) {
      const mm = janela.match(new RegExp('\\b' + nucleoProduto(p) + '\\b'));
      if (mm && mm.index < melhorPos) {
        melhorPos = mm.index;
        produto = p;
      }
    }
    if (produto) {
      // recupera nome original do produto
      const idx = produtosNorm.indexOf(produto);
      const nome = PRODUTOS[idx];
      const item = { quantidade: qtd, produto: nome, categoria: categoriaDoProduto(nome) };
      const tam = detectarTamanho(janela);
      if (tam) item.tamanho = tam;
      const cor = encontrar(janela, CORES)[0];
      if (cor) item.cor = cor;
      itens.push(item);
    }
  }
  return itens;
}

function detectarTamanho(textoNorm) {
  // tamanho em letra (PP, P, M, G, GG...)
  for (const t of TAMANHOS_LETRA) {
    const re = new RegExp('(^|[^a-z])' + t + '([^a-z]|$)', 'i');
    if (re.test(textoNorm)) return t.toUpperCase();
  }
  // tamanho numérico (36, 38, 40, ... 48) — comum em calças/uniformes
  const mNum = textoNorm.match(/(^|[^0-9])(3[4-9]|4[0-8]|5[0-6])([^0-9]|$)/);
  if (mNum) return mNum[2];
  return null;
}

/**
 * Extrai valores monetários: "R$ 50", "50,00", "50 reais", "R$1.250,00".
 * Retorna { valores: [number], total: number|null }.
 */
function extrairValores(textoOriginal) {
  const valores = [];
  const texto = String(textoOriginal || '');

  // R$ 1.250,50  |  R$ 50  |  50,00  |  50 reais
  const re = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?:\s*reais|\s*r\$)?/gi;
  // Mas só aceitamos números que pareçam dinheiro: precedidos de R$, "reais",
  // vírgula decimal, ou a palavra "total/valor/fica/custa/sai".
  const norm = normalizar(texto);
  let m;
  const reMoeda = /r\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/gi;
  while ((m = reMoeda.exec(texto)) !== null) {
    valores.push(parseValor(m[1]));
  }
  const reReais = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*reais/gi;
  while ((m = reReais.exec(norm)) !== null) {
    valores.push(parseValor(m[1]));
  }
  // valores com centavos explícitos (ex.: "fica 89,90")
  const reCent = /\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/g;
  while ((m = reCent.exec(texto)) !== null) {
    const v = parseValor(m[1]);
    if (!valores.includes(v)) valores.push(v);
  }

  const limpos = [...new Set(valores.filter((v) => v && v > 0))];
  // "total" explícito
  let total = null;
  const mTotal = norm.match(/(total|fica|sai|da|fechou|fecha)\D{0,12}(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/);
  if (mTotal) total = parseValor(mTotal[2]);
  else if (limpos.length === 1) total = limpos[0];
  else if (limpos.length > 1) total = Math.max(...limpos);

  return { valores: limpos, total };
}

function parseValor(str) {
  // "1.250,50" -> 1250.50 ; "50" -> 50 ; "89,90" -> 89.9
  const s = String(str).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function detectarStatus(textoOriginal) {
  const norm = normalizar(textoOriginal);
  for (const regra of STATUS_REGRAS) {
    if (regra.palavras.some((p) => norm.includes(semAcento(p)))) {
      return regra.status;
    }
  }
  return 'novo';
}

/**
 * Analisa uma única mensagem e devolve a detecção.
 *
 * @param {object} msg
 * @param {string} msg.texto    - corpo da mensagem
 * @param {string} [msg.nome]   - nome do contato (cliente)
 * @param {string} [msg.telefone] - telefone/identificador
 * @param {number|Date} [msg.data] - timestamp (segundos, ms ou Date)
 * @returns {object} detecção
 */
function analisarMensagem(msg) {
  const texto = String(msg && msg.texto || '');
  const norm = normalizar(texto);

  const intencoes = encontrar(norm, INTENCAO);
  const produtos = encontrarProdutos(norm);
  const itens = extrairItens(texto);
  const { valores, total } = extrairValores(texto);
  const status = detectarStatus(texto);

  // Detecção de "Trabalho PL" por palavra-chave (com espaços p/ casar " pl ").
  const ehPL = PL_KEYWORDS.some((k) => (' ' + norm + ' ').includes(semAcento(k)));

  // Categorias presentes no pedido (uma por item) + PL se aplicável.
  const categoriasSet = new Set(itens.map((i) => i.categoria));
  if (ehPL) categoriasSet.add(CATEGORIA_PL);
  // se citou produto mas sem quantidade, ainda classifica pela categoria do produto
  if (!categoriasSet.size && produtos.length) {
    categoriasSet.add(categoriaDoProduto(produtos[0]));
  }
  const categorias = [...categoriasSet];
  // Categoria principal: PL tem prioridade; senão a primeira detectada.
  const categoria = ehPL ? CATEGORIA_PL : (categorias[0] || 'Outros');

  // Pontuação de confiança.
  let score = 0;
  if (intencoes.length) score += 2;
  if (produtos.length) score += 2;
  if (itens.length) score += 3;
  if (valores.length) score += 1;
  if (ehPL) score += 2;
  // mensagens muito curtas e sem produto raramente são pedidos
  if (norm.trim().length < 4) score = 0;

  const ehPedido = score >= 4 || itens.length > 0 ||
    (produtos.length > 0 && intencoes.length > 0) ||
    (ehPL && intencoes.length > 0);

  return {
    ehPedido,
    score,
    confianca: Math.min(100, Math.round((score / 10) * 100)),
    cliente: {
      nome: (msg && msg.nome) || null,
      telefone: (msg && msg.telefone) || null,
    },
    itens,
    produtos,
    intencoes,
    valores,
    total,
    categoria,
    categorias,
    status,
    data: normalizarData(msg && msg.data),
    textoOriginal: texto,
  };
}

function normalizarData(data) {
  if (!data) return new Date().toISOString();
  if (data instanceof Date) return data.toISOString();
  // whatsapp-web.js usa timestamp em segundos
  const n = Number(data);
  if (Number.isFinite(n)) {
    const ms = n < 1e12 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  return new Date().toISOString();
}

module.exports = {
  analisarMensagem,
  extrairItens,
  extrairValores,
  detectarStatus,
  categoriaDoProduto,
  // expõe as listas para permitir customização/teste
  config: { CATEGORIAS_PRODUTO, PRODUTO_CATEGORIA, PRODUTOS, INTENCAO, CORES, TAMANHOS_LETRA, STATUS_REGRAS, PL_KEYWORDS, CATEGORIA_PL },
};
