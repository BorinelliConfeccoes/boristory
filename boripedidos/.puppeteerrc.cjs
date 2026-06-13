// Não baixar o navegador interno do puppeteer.
// Usamos o Google Chrome (ou Edge) já instalado no computador — assim a
// instalação funciona mesmo em redes que bloqueiam o download do navegador.
module.exports = { skipDownload: true };
