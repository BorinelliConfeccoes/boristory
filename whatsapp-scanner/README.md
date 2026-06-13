# BoriStory · Scanner de Pedidos do WhatsApp

Lê as mensagens do seu WhatsApp **ao vivo** (conexão por QR Code, igual ao
WhatsApp Web), identifica automaticamente os **pedidos** e mostra tudo num
painel: cliente, produtos/quantidades, valores, status — separados por
**categoria** e filtráveis por **período de datas**.

Também faz uma **varredura do histórico antigo** (mensagens anteriores à
integração), então pedidos que já passaram também aparecem.

> Roda 100% no seu computador/servidor. As conversas não saem da sua máquina
> e a detecção é feita offline (sem IA externa).

---

## O que ele identifica

| Recurso | Descrição |
|---|---|
| **Cliente e contato** | Nome do contato + telefone de quem enviou |
| **Produtos e quantidades** | Ex.: `10 camisetas M`, `5 moletons G` (tolera plurais e tamanhos) |
| **Valores e total** | `R$ 1.250,00`, `89,90 reais`, total do pedido |
| **Data e status** | Data da mensagem + status (novo, confirmado, em produção, pago, entregue, cancelado) |
| **Categorias** | Camisetas, Moletons, Calças e Shorts, Vestidos, Uniformes, Acessórios, Outros e **Trabalho PL** (estampa/silk/plotagem/sublimação) |
| **Filtro por datas** | Intercale "de/até" e veja **quantos pedidos** houve no período |
| **Histórico antigo** | Varre conversas anteriores (ex.: últimos 14 dias) e captura pedidos que já passaram |
| **Responder o cliente** | Envie mensagem pelo WhatsApp direto do painel |
| **Orçamento automático** | Gera o texto do orçamento com os itens do pedido (edite e envie) |
| **Catálogo** | Envia o arquivo do catálogo (pasta `catalogo/`) com um clique |
| **O que falta pra fechar** | Lista, em cada pedido, o que ainda precisa (tamanho, valor, pagamento…) |

---

## Como rodar

Pré-requisito: **Node.js 18+** instalado.

```bash
cd whatsapp-scanner
npm install          # baixa as dependências (inclui o navegador do whatsapp-web.js)
npm start            # inicia o servidor
```

Abra **http://localhost:3000** no navegador:

1. Aparece um **QR Code**. No celular: WhatsApp → **Aparelhos conectados** →
   **Conectar um aparelho** → aponte para o QR.
2. Ao conectar, ele **varre o histórico** automaticamente e passa a detectar
   pedidos novos **ao vivo**.
3. Use os filtros de **data**, **categoria** e **status** para ver os pedidos
   do período que quiser. Os cartões no topo mostram a contagem.

> A sessão fica salva (pasta `.wwebjs_auth/`), então nas próximas vezes não
> precisa escanear o QR de novo.

### Testar sem o WhatsApp
No final do painel há um campo **"Testar detecção"**: cole um texto de exemplo
e veja como o motor classifica — útil para ajustar o vocabulário. Os testes
automatizados rodam com:

```bash
npm test
```

---

## Configuração (variáveis de ambiente)

| Variável | Padrão | Função |
|---|---|---|
| `PORT` | `3000` | Porta do servidor/painel |
| `SCORE_MINIMO` | `4` | Pontuação mínima (0–10) p/ registrar como pedido. Aumente p/ ser mais rigoroso |
| `HISTORICO_LIMITE` | `300` | Quantas mensagens antigas varrer por conversa |
| `HISTORICO_DIAS` | `14` | Só considerar mensagens dos últimos N dias (0 = sem limite de tempo) |
| `SYNC_AO_CONECTAR` | `1` | `0` desliga a varredura automática do histórico ao conectar |
| `NOME_EMPRESA` | `Borinelli Confecções` | Nome usado nas mensagens prontas |
| `CATALOGO_PATH` | `./catalogo` | Pasta onde fica o arquivo do catálogo |

Exemplo: `HISTORICO_DIAS=30 SCORE_MINIMO=5 npm start`

### Enviar mensagens, orçamento e catálogo
Cada pedido no painel tem três botões:
- **💬 Responder** — escreva e envie uma mensagem pelo WhatsApp.
- **🧾 Mandar orçamento** — abre um texto já montado com os itens do pedido; edite e envie.
- **📖 Enviar catálogo** — envia o arquivo que estiver na pasta [`catalogo/`](catalogo/).

Para o catálogo: coloque **uma imagem ou PDF** dentro da pasta `catalogo/`.
O envio só funciona com o WhatsApp **conectado** (QR Code).

---

## Personalizar o vocabulário

Toda a "inteligência" fica em [`src/orderParser.js`](src/orderParser.js), em
listas fáceis de editar no topo do arquivo:

- `CATEGORIAS_PRODUTO` — produtos de cada categoria (use o singular; plurais
  como `moletom→moletons` são tolerados automaticamente).
- `PL_KEYWORDS` — palavras que marcam **Trabalho PL** (silk, plotagem,
  sublimação, estampa, dtf…).
- `INTENCAO`, `CORES`, `STATUS_REGRAS` — intenção de compra, cores e
  palavras-chave de status.

---

## Estrutura

```
whatsapp-scanner/
├── server.js              # servidor Express + conexão WhatsApp (whatsapp-web.js)
├── src/
│   ├── orderParser.js     # motor de detecção de pedidos (offline)
│   └── store.js           # persistência em JSON + relatórios por período
├── public/index.html      # painel web (QR, filtros de data, categorias, lista)
├── test/parser.test.js    # testes do motor de detecção
└── data/pedidos.json       # pedidos salvos (gerado em runtime, fora do git)
```

## API (para integrações futuras)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/status` | Estado da conexão, QR e progresso da sincronização |
| GET | `/api/pedidos?de=&ate=&categoria=&status=&busca=` | Lista de pedidos filtrada |
| GET | `/api/relatorio?de=&ate=&categoria=&status=` | Contagens agregadas no período |
| GET | `/api/categorias` | Categorias disponíveis |
| POST | `/api/sincronizar` | Dispara a varredura do histórico |
| POST | `/api/pedidos/:id/status` | Atualiza o status de um pedido |
| DELETE | `/api/pedidos/:id` | Remove um pedido |
| POST | `/api/testar` | Analisa um texto sem salvar |

---

## Observações importantes

- O `whatsapp-web.js` é uma biblioteca **não-oficial** que automatiza o
  WhatsApp Web. Use no **seu próprio número** e de forma legítima (atendimento
  a clientes). Evite envio em massa para não arriscar bloqueio.
- Para uma integração **oficial** (sem risco de bloqueio), o caminho é a
  WhatsApp Cloud API da Meta — exige conta Business verificada e um servidor
  público. Posso adaptar para esse modelo se você precisar no futuro.
