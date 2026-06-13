'use strict';

/**
 * Testes do motor de detecção. Rode com:  node test/parser.test.js
 * Não precisa do WhatsApp conectado — valida só a lógica de identificação.
 */

const assert = require('assert');
const { analisarMensagem, extrairItens, extrairValores, detectarStatus } = require('../src/orderParser');

let passou = 0;
let falhou = 0;

function teste(nome, fn) {
  try {
    fn();
    passou++;
    console.log('  ✓ ' + nome);
  } catch (e) {
    falhou++;
    console.log('  ✗ ' + nome + '\n      ' + e.message);
  }
}

console.log('\nMotor de detecção de pedidos\n');

teste('detecta pedido simples com quantidade + produto', () => {
  const d = analisarMensagem({ texto: 'Oi, quero 3 camisetas pretas tamanho M', nome: 'Ana' });
  assert.strictEqual(d.ehPedido, true);
  assert.strictEqual(d.itens.length, 1);
  assert.strictEqual(d.itens[0].quantidade, 3);
  assert.strictEqual(d.itens[0].produto, 'camiseta'); // forma canônica singular
  assert.strictEqual(d.itens[0].categoria, 'Camisetas');
  assert.strictEqual(d.itens[0].tamanho, 'M');
  assert.strictEqual(d.itens[0].cor, 'preta'); // "pretas" casa com "preta" (plural tolerado)
});

teste('extrai múltiplos itens (plural tolerado, sem vazar cor)', () => {
  const itens = extrairItens('preciso de 10 calças G e 5 moletons azul');
  assert.strictEqual(itens.length, 2);
  assert.strictEqual(itens[0].quantidade, 10);
  assert.strictEqual(itens[0].produto, 'calça');
  assert.strictEqual(itens[0].cor, undefined); // "azul" pertence ao 2º item
  assert.strictEqual(itens[1].quantidade, 5);
  assert.strictEqual(itens[1].produto, 'moletom');
  assert.strictEqual(itens[1].cor, 'azul');
});

teste('categoriza por tipo de produto', () => {
  assert.strictEqual(analisarMensagem({ texto: 'quero 2 moletons' }).categoria, 'Moletons');
  assert.strictEqual(analisarMensagem({ texto: 'quero 5 uniformes' }).categoria, 'Uniformes');
});

teste('detecta categoria Trabalho PL', () => {
  const d = analisarMensagem({ texto: 'preciso de um trabalho de PL com estampa em silk' });
  assert.strictEqual(d.categoria, 'Trabalho PL');
  assert.strictEqual(d.ehPedido, true);
});

teste('PL tem prioridade mas mantém categorias dos itens', () => {
  const d = analisarMensagem({ texto: 'quero 10 camisetas com estampa sublimação' });
  assert.strictEqual(d.categoria, 'Trabalho PL');
  assert.ok(d.categorias.includes('Camisetas'));
  assert.ok(d.categorias.includes('Trabalho PL'));
});

teste('extrai valor com R$ e centavos', () => {
  const v = extrairValores('fica R$ 1.250,00 no total');
  assert.ok(v.valores.includes(1250));
  assert.strictEqual(v.total, 1250);
});

teste('extrai valor com "reais"', () => {
  const v = extrairValores('cada um sai 89,90 reais');
  assert.ok(v.valores.includes(89.9));
});

teste('status: pago', () => {
  assert.strictEqual(detectarStatus('já paguei, segue o comprovante'), 'pago');
});

teste('status: entregue vence pago', () => {
  assert.strictEqual(detectarStatus('paguei e já recebi tudo'), 'entregue');
});

teste('status padrão é novo', () => {
  assert.strictEqual(detectarStatus('quero encomendar umas camisetas'), 'novo');
});

teste('mensagem não-pedido é ignorada', () => {
  const d = analisarMensagem({ texto: 'bom dia, tudo bem?' });
  assert.strictEqual(d.ehPedido, false);
});

teste('saudação curta não é pedido', () => {
  const d = analisarMensagem({ texto: 'oi' });
  assert.strictEqual(d.ehPedido, false);
});

teste('intenção + produto sem quantidade ainda conta como pedido', () => {
  const d = analisarMensagem({ texto: 'gostaria de encomendar uniformes para a equipe' });
  assert.strictEqual(d.ehPedido, true);
});

teste('captura nome e telefone do cliente', () => {
  const d = analisarMensagem({ texto: 'quero 2 vestidos', nome: 'Maria', telefone: '5547999999999' });
  assert.strictEqual(d.cliente.nome, 'Maria');
  assert.strictEqual(d.cliente.telefone, '5547999999999');
});

console.log(`\n${passou} passou, ${falhou} falhou\n`);
process.exit(falhou ? 1 : 0);
