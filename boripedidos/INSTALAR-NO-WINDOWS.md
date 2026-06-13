# 📦 Como instalar o BoriPedidos no Windows

Um guia bem passo a passo, sem pressa. Faça **uma parte de cada vez**.
Se travar em algum ponto, é só avisar que a gente resolve junto. 🤝

---

## Parte 1 — Instalar o "motor" (Node.js)

O BoriPedidos precisa de um programa-base pra funcionar, chamado **Node.js**.
Você instala **uma vez só** e nunca mais mexe.

1. Abra o navegador e entre em: **https://nodejs.org**
2. Clique no botão verde grande que diz **"LTS"** (é a versão recomendada).
3. Vai baixar um arquivo. Clique nele pra abrir.
4. Na instalação, é só ir clicando em **"Next"** (Próximo) até o final, e
   depois em **"Install"** (Instalar). Pode aceitar tudo do jeito que vem.
5. No final, clique em **"Finish"** (Concluir). Pronto! ✅

> Você não vai "ver" nada abrir — é normal. Ele fica trabalhando por trás.

---

## Parte 2 — Trazer o BoriPedidos pro seu computador

1. Entre no site do projeto (GitHub) na parte do BoriPedidos.
2. Procure o botão verde escrito **"Code"** e clique nele.
3. Clique em **"Download ZIP"**.
4. Vai baixar uma pasta compactada. Vá na pasta **Downloads**, clique com o
   **botão direito** nela e escolha **"Extrair tudo"** (Extract All).
5. Abra a pasta que apareceu. Dentro dela, entre na pasta **`boripedidos`**.

> Guarde essa pasta `boripedidos` num lugar fácil, tipo a Área de Trabalho.

---

## Parte 3 — Ligar o programa

1. Abra a pasta **`boripedidos`** (a que você guardou).
2. Clique na **barra de endereço** lá em cima (onde mostra o caminho da pasta),
   apague o que estiver escrito, digite **`cmd`** e aperte **Enter**.
   → Vai abrir uma **janelinha preta**. Não se assuste, é amiga! 😄
3. Nessa janela preta, digite exatamente isto e aperte **Enter**:
   ```
   npm install
   ```
   → Ele vai baixar as peças. **Demora uns minutos** na primeira vez.
   Espere aparecer o cursor piscando de novo. ⏳
4. Agora digite isto e aperte **Enter**:
   ```
   npm start
   ```
   → Quando aparecer **"BoriPedidos rodando em http://localhost:3000"**,
   está ligado! 🎉

> **Importante:** deixe essa janelinha preta **aberta** enquanto usar o
> BoriPedidos. Se fechar, ele desliga.

---

## Parte 4 — Abrir a telinha e conectar o WhatsApp

1. Abra o navegador e digite na barra de endereço: **`localhost:3000`**
2. Vai aparecer a telinha do BoriPedidos com um **QR Code** (quadradinho de
   bolinhas).
3. No celular: abra o **WhatsApp** → toque nos **três pontinhos** (ou
   Ajustes) → **Aparelhos conectados** → **Conectar um aparelho**.
4. Aponte a câmera do celular pro QR Code da tela.
5. Pronto! Ele vai conectar e começar a achar seus pedidos. 🥳

---

## Dia a dia (depois de instalado)

- Pra **ligar de novo**: abra a pasta, abra a janelinha preta (passo da Parte 3)
  e digite só **`npm start`**. Não precisa fazer o `npm install` de novo.
- Pra **desligar**: feche a janelinha preta.
- Pra colocar seu **catálogo**: ponha uma foto ou PDF dentro da pasta
  **`catalogo`** (tem um bilhetinho lá explicando).

---

## Deu algum erro? Sem pânico! 🙂

Me mande **uma foto da tela** (ou me copie a mensagem que apareceu) e eu te
ajudo a resolver. Quase sempre é coisinha simples.
