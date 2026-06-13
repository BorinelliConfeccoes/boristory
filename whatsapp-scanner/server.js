'use strict';

/**
 * BoriStory — Scanner de Pedidos do WhatsApp
 *
 * Conecta ao seu WhatsApp via QR Code (igual ao WhatsApp Web), lê as
 * mensagens recebidas ao vivo, detecta pedidos e disponibiliza tudo num
 * painel web + API REST.
 *
 * Uso:  node server.js   →   abra http://localhost:3000  →  escaneie o QR.
 */

const path = require('path');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');

const { analisarMensagem, config: parserConfig } = require('./src/orderParser');
const OrderStore = require('./src/store');
const replies = require('./src/replies');

const PORT = process.env.PORT || 3000;
// Score mínimo para registrar automaticamente como pedido (0-10).
const SCORE_MINIMO = Number(process.env.SCORE_MINIMO || 4);
// Quantas mensagens antigas buscar por conversa ao sincronizar o histórico.
const HISTORICO_LIMITE = Number(process.env.HISTORICO_LIMITE || 300);
// Quantos dias para trás considerar no histórico (0 = sem limite de dias).
const HISTORICO_DIAS = Number(process.env.HISTORICO_DIAS || 14);
// Pasta onde você coloca o arquivo do catálogo (1ª imagem/PDF é usada).
const CATALOGO_DIR = process.env.CATALOGO_PATH || path.join(__dirname, 'catalogo');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const store = new OrderStore();

// Estado da conexão com o WhatsApp.
const estado = {
  status: 'iniciando', // iniciando | qr | autenticando | conectado | desconectado | erro
  qrDataUrl: null,
  numero: null,
  ultimaAtividade: null,
  detectados: 0,
  sincronizando: false,
  sincronizado: false,
  progressoSync: null, // { atual, total, encontrados }
};

let clientRef = null; // referência ao client do WhatsApp (p/ sincronização manual)

// ---------- API REST ----------

app.get('/api/status', (req, res) => {
  res.json({ ...estado, stats: store.estatisticas() });
});

app.get('/api/pedidos', (req, res) => {
  const { status, categoria, busca, de, ate } = req.query;
  res.json(store.listar({ status, categoria, busca, de, ate }));
});

// Relatório agregado por período (datas intercaláveis), categoria e status.
app.get('/api/relatorio', (req, res) => {
  const { de, ate, status, categoria } = req.query;
  res.json(store.relatorio({ de, ate, status, categoria }));
});

// Categorias disponíveis (p/ montar os filtros no painel).
app.get('/api/categorias', (req, res) => {
  res.json([...Object.keys(parserConfig.CATEGORIAS_PRODUTO), parserConfig.CATEGORIA_PL]);
});

// Dispara a sincronização do histórico antigo (mensagens anteriores à integração).
app.post('/api/sincronizar', async (req, res) => {
  if (!clientRef) return res.status(409).json({ erro: 'WhatsApp não conectado' });
  if (estado.sincronizando) return res.status(409).json({ erro: 'Sincronização já em andamento' });
  const limite = Number((req.body && req.body.limite) || HISTORICO_LIMITE);
  const dias = (req.body && req.body.dias != null) ? Number(req.body.dias) : HISTORICO_DIAS;
  // roda em segundo plano; o painel acompanha por /api/status
  sincronizarHistorico(clientRef, limite, dias).catch((e) => console.error('[sync]', e.message));
  res.json({ ok: true, iniciado: true, limitePorConversa: limite, dias });
});

// Configuração visível ao painel: templates de mensagem e estado do catálogo.
app.get('/api/config', (req, res) => {
  res.json({
    templates: replies.TEMPLATES,
    empresa: replies.NOME_EMPRESA,
    catalogo: catalogoInfo(),
    historicoDias: HISTORICO_DIAS,
    conectado: estado.status === 'conectado',
  });
});

// Gera o texto do orçamento de um pedido (o painel pode editar antes de enviar).
app.get('/api/pedidos/:id/orcamento', (req, res) => {
  const p = store.listar().find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json({ texto: replies.gerarOrcamento(p), pendencias: replies.pendencias(p) });
});

// Envia uma mensagem de texto para um número.
app.post('/api/enviar', async (req, res) => {
  const telefone = (req.body && req.body.telefone) || '';
  const mensagem = (req.body && req.body.mensagem) || '';
  if (!clientRef || estado.status !== 'conectado') {
    return res.status(409).json({ erro: 'WhatsApp não conectado. Conecte pelo QR Code para enviar.' });
  }
  if (!telefone || !mensagem.trim()) return res.status(400).json({ erro: 'Informe telefone e mensagem.' });
  try {
    await clientRef.sendMessage(chatId(telefone), mensagem);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: 'Falha ao enviar: ' + e.message });
  }
});

// Envia o catálogo (arquivo da pasta /catalogo) com uma legenda opcional.
app.post('/api/enviar-catalogo', async (req, res) => {
  const telefone = (req.body && req.body.telefone) || '';
  const legenda = (req.body && req.body.legenda) || '';
  if (!clientRef || estado.status !== 'conectado') {
    return res.status(409).json({ erro: 'WhatsApp não conectado. Conecte pelo QR Code para enviar.' });
  }
  const info = catalogoInfo();
  if (!info.configurado) {
    return res.status(400).json({ erro: 'Nenhum catálogo encontrado. Coloque um arquivo (imagem ou PDF) na pasta "catalogo/".' });
  }
  try {
    const { MessageMedia } = require('whatsapp-web.js');
    const media = MessageMedia.fromFilePath(info.caminho);
    await clientRef.sendMessage(chatId(telefone), media, legenda ? { caption: legenda } : {});
    res.json({ ok: true, arquivo: info.nome });
  } catch (e) {
    res.status(500).json({ erro: 'Falha ao enviar catálogo: ' + e.message });
  }
});

app.post('/api/pedidos/:id/status', (req, res) => {
  const p = store.atualizarStatus(req.params.id, req.body && req.body.status);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(p);
});

app.delete('/api/pedidos/:id', (req, res) => {
  const ok = store.remover(req.params.id);
  res.json({ ok });
});

// Endpoint de teste: analisa um texto sem precisar do WhatsApp conectado.
app.post('/api/testar', (req, res) => {
  const det = analisarMensagem({
    texto: (req.body && req.body.texto) || '',
    nome: (req.body && req.body.nome) || 'Teste',
    telefone: (req.body && req.body.telefone) || null,
  });
  res.json(det);
});

// Permite registrar manualmente uma detecção de teste no painel.
app.post('/api/registrar-teste', (req, res) => {
  const det = analisarMensagem({
    texto: (req.body && req.body.texto) || '',
    nome: (req.body && req.body.nome) || 'Teste',
    telefone: (req.body && req.body.telefone) || null,
  });
  const registro = store.adicionar({
    msgId: 'teste-' + Date.now(),
    origem: 'teste',
    ...det,
  });
  res.json(registro || { erro: 'duplicado' });
});

// ---------- WhatsApp (whatsapp-web.js) ----------

function iniciarWhatsApp() {
  let Client, LocalAuth;
  try {
    ({ Client, LocalAuth } = require('whatsapp-web.js'));
  } catch (e) {
    console.error('\n[!] Dependência "whatsapp-web.js" não instalada.');
    console.error('    Rode  npm install  nesta pasta e inicie de novo.');
    console.error('    O painel e a API de teste continuam funcionando sem WhatsApp.\n');
    estado.status = 'erro';
    return;
  }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr) => {
    estado.status = 'qr';
    try {
      estado.qrDataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 320 });
    } catch (_) { /* ignore */ }
    console.log('[whatsapp] QR gerado — abra o painel e escaneie com o celular.');
  });

  client.on('authenticated', () => {
    estado.status = 'autenticando';
    estado.qrDataUrl = null;
    console.log('[whatsapp] autenticado.');
  });

  client.on('ready', async () => {
    estado.status = 'conectado';
    estado.qrDataUrl = null;
    estado.numero = client.info && client.info.wid ? client.info.wid.user : null;
    clientRef = client;
    console.log('[whatsapp] conectado como', estado.numero);
    // Sincroniza o histórico automaticamente uma vez (coisas anteriores à integração).
    if (!estado.sincronizado && process.env.SYNC_AO_CONECTAR !== '0') {
      sincronizarHistorico(client, HISTORICO_LIMITE, HISTORICO_DIAS).catch((e) => console.error('[sync]', e.message));
    }
  });

  client.on('disconnected', (motivo) => {
    estado.status = 'desconectado';
    console.log('[whatsapp] desconectado:', motivo);
  });

  client.on('auth_failure', (msg) => {
    estado.status = 'erro';
    console.error('[whatsapp] falha de autenticação:', msg);
  });

  client.on('message', async (message) => {
    estado.ultimaAtividade = new Date().toISOString();
    await processarMensagem(message, 'whatsapp', true);
  });

  estado.status = 'iniciando';
  client.initialize().catch((e) => {
    estado.status = 'erro';
    console.error('[whatsapp] erro ao inicializar:', e.message);
  });
}

/**
 * Analisa uma mensagem do whatsapp-web.js e, se for pedido, salva.
 * Reutilizado tanto pelo fluxo ao vivo quanto pela sincronização do histórico.
 */
async function processarMensagem(message, origem, logar) {
  try {
    if (message.from && message.from.endsWith('@g.us')) return false; // ignora grupos
    if (message.type !== 'chat') return false; // só texto
    if (!message.body || !message.body.trim()) return false;
    if (message.fromMe) return false; // ignora o que você mesmo enviou

    let nome = null;
    try {
      const contato = await message.getContact();
      nome = contato.pushname || contato.name || contato.number || null;
    } catch (_) { /* ignore */ }

    const det = analisarMensagem({
      texto: message.body,
      nome,
      telefone: (message.from || '').replace('@c.us', ''),
      data: message.timestamp,
    });

    if (det.ehPedido && det.score >= SCORE_MINIMO) {
      const reg = store.adicionar({
        msgId: message.id && message.id._serialized,
        origem,
        ...det,
      });
      if (reg) {
        estado.detectados++;
        if (logar) {
          console.log(`[pedido] ${reg.id} (${reg.categoria}) de ${det.cliente.nome || det.cliente.telefone} — ${det.itens.length} item(ns), status ${det.status}`);
        }
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('[whatsapp] erro ao processar mensagem:', e.message);
    return false;
  }
}

/**
 * Varre o histórico de todas as conversas individuais e analisa as
 * últimas N mensagens de cada uma — captura pedidos anteriores à integração.
 */
async function sincronizarHistorico(client, limitePorConversa, dias) {
  if (estado.sincronizando) return;
  estado.sincronizando = true;
  estado.progressoSync = { atual: 0, total: 0, encontrados: 0 };
  // Só considera mensagens dos últimos `dias` dias (0 = sem limite de tempo).
  const cutoff = dias && dias > 0 ? (Date.now() / 1000) - (dias * 86400) : 0;
  console.log(`[sync] varrendo histórico (até ${limitePorConversa} msgs/conversa${cutoff ? `, últimos ${dias} dias` : ''})...`);
  try {
    const chats = await client.getChats();
    const individuais = chats.filter((c) => !c.isGroup);
    estado.progressoSync.total = individuais.length;
    let encontrados = 0;
    for (const chat of individuais) {
      estado.progressoSync.atual++;
      try {
        const msgs = await chat.fetchMessages({ limit: limitePorConversa });
        for (const m of msgs) {
          if (cutoff && m.timestamp && m.timestamp < cutoff) continue; // mais antiga que o limite
          const ok = await processarMensagem(m, 'historico', false);
          if (ok) encontrados++;
        }
        estado.progressoSync.encontrados = encontrados;
      } catch (e) {
        console.error(`[sync] erro na conversa ${chat.id && chat.id._serialized}:`, e.message);
      }
    }
    console.log(`[sync] concluído: ${encontrados} pedido(s) encontrado(s) no histórico de ${individuais.length} conversa(s).`);
    estado.sincronizado = true;
  } catch (e) {
    console.error('[sync] falha geral:', e.message);
  } finally {
    estado.sincronizando = false;
  }
}

// ---------- Helpers ----------

// Converte um telefone (só dígitos ou já com @c.us) no id de chat do WhatsApp.
function chatId(telefone) {
  const t = String(telefone || '');
  if (t.includes('@')) return t;
  return t.replace(/\D/g, '') + '@c.us';
}

// Localiza o arquivo de catálogo (imagem ou PDF) na pasta configurada.
const CATALOGO_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
function catalogoInfo() {
  try {
    if (!fs.existsSync(CATALOGO_DIR)) return { configurado: false };
    const arquivos = fs.readdirSync(CATALOGO_DIR)
      .filter((f) => CATALOGO_EXT.includes(path.extname(f).toLowerCase()))
      .sort();
    if (!arquivos.length) return { configurado: false };
    return { configurado: true, nome: arquivos[0], caminho: path.join(CATALOGO_DIR, arquivos[0]) };
  } catch (_) {
    return { configurado: false };
  }
}

// ---------- Boot ----------

app.listen(PORT, () => {
  console.log(`\nBoriStory Scanner rodando em http://localhost:${PORT}`);
  console.log('Abra o endereço acima no navegador para ver o painel e o QR Code.\n');
  iniciarWhatsApp();
});
