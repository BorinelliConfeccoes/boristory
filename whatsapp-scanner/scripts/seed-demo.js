'use strict';
// Cria pedidos de exemplo para a demonstração do painel.
const path = require('path');
const { analisarMensagem } = require('../src/orderParser');
const OrderStore = require('../src/store');

const store = new OrderStore(path.join(__dirname, '..', 'data', 'pedidos.json'));
// limpa antes (demo)
store.pedidos = [];

const hoje = new Date();
const diasAtras = (n) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return d; };

const exemplos = [
  { texto: 'Oi! Quero 10 camisetas pretas tamanho M, quanto fica?', nome: 'João Silva', telefone: '5547991112233', data: diasAtras(0) },
  { texto: 'Bom dia, preciso de 5 moletons G azul. Já paguei via pix, segue comprovante', nome: 'Maria Souza', telefone: '5547998887766', data: diasAtras(1) },
  { texto: 'Gostaria de encomendar 20 uniformes brancos para a equipe, fica R$ 1.200,00?', nome: 'Mercado Bom Preço', telefone: '5547997776655', data: diasAtras(3) },
  { texto: 'Preciso de um trabalho de PL com estampa em silk, 30 camisetas brancas', nome: 'Carlos Eventos', telefone: '5547996665544', data: diasAtras(5) },
  { texto: 'Quero 3 vestidos vermelhos. Fica 450,00 no total mesmo?', nome: 'Ana Paula', telefone: '5547995554433', data: diasAtras(8) },
  { texto: 'Me vê 8 calças 40 e 4 bermudas pretas por favor', nome: 'Pedro Lima', telefone: '5547994443322', data: diasAtras(12) },
  { texto: 'Fechei o pedido das 15 camisetas com sublimação, já recebi tudo, obrigado!', nome: 'Time Águia FC', telefone: '5547993332211', data: diasAtras(20) },
  { texto: 'Gostaria de 2 jaquetas G e 2 toucas, pode confirmar o valor?', nome: 'Lucas Inverno', telefone: '5547992221100', data: diasAtras(25) },
];

for (const ex of exemplos) {
  const det = analisarMensagem(ex);
  store.adicionar({ msgId: 'demo-' + ex.telefone + ex.data.getTime(), origem: 'historico', ...det });
}
console.log('Pedidos de exemplo criados:', store.pedidos.length);
