'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Armazenamento simples em arquivo JSON para os pedidos detectados.
 * Sem banco de dados — suficiente para o volume de uma confecção e
 * fácil de inspecionar/exportar manualmente.
 */
class OrderStore {
  constructor(arquivo) {
    this.arquivo = arquivo || path.join(__dirname, '..', 'data', 'pedidos.json');
    this.pedidos = [];
    this._carregar();
  }

  _carregar() {
    try {
      const dir = path.dirname(this.arquivo);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.arquivo)) {
        this.pedidos = JSON.parse(fs.readFileSync(this.arquivo, 'utf8')) || [];
      }
    } catch (e) {
      console.error('[store] falha ao carregar pedidos:', e.message);
      this.pedidos = [];
    }
  }

  _salvar() {
    try {
      fs.writeFileSync(this.arquivo, JSON.stringify(this.pedidos, null, 2));
    } catch (e) {
      console.error('[store] falha ao salvar pedidos:', e.message);
    }
  }

  /** Evita duplicar o mesmo pedido (mesmo id de mensagem do WhatsApp). */
  jaExiste(msgId) {
    return msgId && this.pedidos.some((p) => p.msgId === msgId);
  }

  adicionar(pedido) {
    if (this.jaExiste(pedido.msgId)) return null;
    const registro = {
      id: 'PED-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000),
      criadoEm: new Date().toISOString(),
      ...pedido,
    };
    this.pedidos.unshift(registro);
    this._salvar();
    return registro;
  }

  atualizarStatus(id, status) {
    const p = this.pedidos.find((x) => x.id === id);
    if (!p) return null;
    p.status = status;
    p.atualizadoEm = new Date().toISOString();
    this._salvar();
    return p;
  }

  remover(id) {
    const antes = this.pedidos.length;
    this.pedidos = this.pedidos.filter((p) => p.id !== id);
    if (this.pedidos.length !== antes) {
      this._salvar();
      return true;
    }
    return false;
  }

  /**
   * Lista pedidos com filtros opcionais.
   * @param {object} f
   * @param {string} [f.status]    - filtra por status ('todos' = sem filtro)
   * @param {string} [f.categoria] - filtra por categoria ('todas' = sem filtro)
   * @param {string} [f.busca]     - busca textual livre
   * @param {string} [f.de]        - data inicial (ISO ou YYYY-MM-DD), inclusive
   * @param {string} [f.ate]       - data final (ISO ou YYYY-MM-DD), inclusive
   */
  listar({ status, categoria, busca, de, ate } = {}) {
    let r = this.pedidos;
    if (status && status !== 'todos') r = r.filter((p) => p.status === status);
    if (categoria && categoria !== 'todas') {
      r = r.filter((p) => p.categoria === categoria || (Array.isArray(p.categorias) && p.categorias.includes(categoria)));
    }
    const ini = parseLimiteData(de, false);
    const fim = parseLimiteData(ate, true);
    if (ini !== null) r = r.filter((p) => +new Date(p.data) >= ini);
    if (fim !== null) r = r.filter((p) => +new Date(p.data) <= fim);
    if (busca) {
      const q = String(busca).toLowerCase();
      r = r.filter((p) => JSON.stringify(p).toLowerCase().includes(q));
    }
    return r;
  }

  /**
   * Relatório agregado dentro de um intervalo de datas (intercalável).
   * Retorna contagem total, por categoria, por status, receita e quantidade
   * de peças — exatamente o "quantos pedidos no período" pedido.
   */
  relatorio({ de, ate, status, categoria } = {}) {
    const lista = this.listar({ de, ate, status, categoria });
    const porCategoria = {};
    const porStatus = {};
    let receita = 0;
    let pecas = 0;
    for (const p of lista) {
      porCategoria[p.categoria || 'Outros'] = (porCategoria[p.categoria || 'Outros'] || 0) + 1;
      porStatus[p.status] = (porStatus[p.status] || 0) + 1;
      if (typeof p.total === 'number') receita += p.total;
      if (Array.isArray(p.itens)) pecas += p.itens.reduce((s, i) => s + (i.quantidade || 0), 0);
    }
    return {
      periodo: { de: de || null, ate: ate || null },
      total: lista.length,
      pecas,
      receita: Math.round(receita * 100) / 100,
      porCategoria,
      porStatus,
    };
  }

  estatisticas() {
    return this.relatorio({});
  }
}

// Converte 'YYYY-MM-DD' ou ISO em timestamp; fimDoDia=true joga para 23:59:59.
function parseLimiteData(valor, fimDoDia) {
  if (!valor) return null;
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    d = new Date(valor + (fimDoDia ? 'T23:59:59.999' : 'T00:00:00.000'));
  } else {
    d = new Date(valor);
  }
  const t = +d;
  return Number.isFinite(t) ? t : null;
}

module.exports = OrderStore;
