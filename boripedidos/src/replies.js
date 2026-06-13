'use strict';

/**
 * Geração de respostas para o cliente: orçamento automático, mensagens
 * prontas (catálogo, etc.) e o cálculo de "o que falta pra fechar".
 *
 * Tudo em português e editável. As mensagens usam {nome} como espaço
 * reservado para o nome do cliente.
 */

const NOME_EMPRESA = process.env.NOME_EMPRESA || 'Borinelli Confecções';

// Mensagens prontas (templates). Edite à vontade. {nome} vira o nome do cliente.
const TEMPLATES = {
  catalogo: 'Olá {nome}! 😊 Segue o nosso catálogo. Qualquer dúvida é só chamar!',
  saudacao: 'Olá {nome}! Tudo bem? Aqui é da ' + NOME_EMPRESA + '. Como posso ajudar?',
  agradecimento: 'Obrigado, {nome}! Seu pedido já está anotado. 🙌',
  pagamento: 'Olá {nome}! Para fecharmos o pedido, o pagamento pode ser via Pix. Posso te enviar a chave?',
};

function primeiroNome(nome) {
  if (!nome) return 'tudo bem';
  return String(nome).trim().split(/\s+/)[0];
}

function aplicarTemplate(texto, pedido) {
  const nome = primeiroNome(pedido && pedido.cliente && pedido.cliente.nome);
  return String(texto).replace(/\{nome\}/g, nome);
}

const moeda = (v) =>
  'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

/**
 * Monta um texto de orçamento a partir dos itens detectados no pedido.
 * Se houver preços por item (mapa opcional precos[produto]), calcula o total.
 */
function gerarOrcamento(pedido, precos = {}) {
  const nome = primeiroNome(pedido && pedido.cliente && pedido.cliente.nome);
  const itens = (pedido && pedido.itens) || [];
  const linhas = [];
  linhas.push(`Olá ${nome}! Segue o orçamento do seu pedido na ${NOME_EMPRESA}:`);
  linhas.push('');

  let total = 0;
  let temPreco = false;
  if (itens.length) {
    for (const i of itens) {
      const desc = `${i.quantidade}x ${i.produto}` +
        (i.tamanho ? ` (tam. ${i.tamanho})` : '') +
        (i.cor ? ` ${i.cor}` : '');
      const preco = precos[i.produto];
      if (typeof preco === 'number') {
        temPreco = true;
        const sub = preco * i.quantidade;
        total += sub;
        linhas.push(`• ${desc} — ${moeda(preco)} cada = ${moeda(sub)}`);
      } else {
        linhas.push(`• ${desc}`);
      }
    }
  } else {
    linhas.push('• (descreva aqui os itens)');
  }

  linhas.push('');
  if (temPreco) {
    linhas.push(`*Total: ${moeda(total)}*`);
  } else if (typeof (pedido && pedido.total) === 'number') {
    linhas.push(`*Total: ${moeda(pedido.total)}*`);
  } else {
    linhas.push('*Total: a confirmar*');
  }
  linhas.push('');
  linhas.push('Posso seguir com a produção? Qualquer ajuste é só avisar! 😊');
  return linhas.join('\n');
}

/**
 * Descobre "o que falta pra fechar" o pedido. Retorna uma lista de pendências
 * legíveis para o lojista saber o que ainda precisa perguntar/combinar.
 */
function pendencias(pedido) {
  const p = pedido || {};
  const itens = p.itens || [];
  const lista = [];

  if (!itens.length) lista.push('Detalhar os itens');
  if (itens.length && itens.some((i) => !i.tamanho)) lista.push('Confirmar tamanhos');
  if (itens.length && itens.some((i) => !i.cor)) lista.push('Confirmar cores');

  const temValor = typeof p.total === 'number' || (Array.isArray(p.valores) && p.valores.length);
  if (!temValor) lista.push('Combinar/enviar valor');

  const status = p.status || 'novo';
  if (status === 'novo') lista.push('Aguardando confirmação');
  if (status === 'confirmado') lista.push('Aguardando pagamento');
  if (status === 'pago') lista.push('Produzir e entregar');

  // Pronto pra fechar = sem pendências relevantes
  return lista;
}

module.exports = { TEMPLATES, aplicarTemplate, gerarOrcamento, pendencias, primeiroNome, NOME_EMPRESA };
