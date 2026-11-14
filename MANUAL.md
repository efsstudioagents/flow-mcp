# Manual do Flow Studio

Guia completo, em português do Brasil, para o Erick e para qualquer agente de IA que use o Flow Studio.

Escrito em 14/11/2026, a partir do código e dos documentos do repositório `~/flow-mcp`. O que o código não prova está marcado com **(a confirmar)**.

Este manual não repete a tabela de contas do Google nem as regras de criação do Erick. Elas ficam em um lugar só: [AGENTS.md da pasta UGC](</Users/erickfonseca/Documents/EFS Studio/UGC/AGENTS.md>). Quando este manual disser "regras do Erick", é lá.

## Sumário

1. [O que é o Flow Studio e como abrir](#1-o-que-é-o-flow-studio-e-como-abrir)
2. [Mapa da tela](#2-mapa-da-tela)
3. [Uma seção por aba](#3-uma-seção-por-aba)
4. [Contas e créditos](#4-contas-e-créditos)
5. [Agendar](#5-agendar)
6. [Monitor](#6-monitor)
7. [Para agentes de IA](#7-para-agentes-de-ia)
8. [Problemas comuns e soluções](#8-problemas-comuns-e-soluções)
9. [Onde ficam os arquivos](#9-onde-ficam-os-arquivos)

### Palavras que aparecem aqui

| Palavra | O que quer dizer |
|---|---|
| **Flow** | O site do Google (flow.google.com) onde as imagens e os vídeos de IA são feitos. |
| **Flow Studio** | O painel deste manual. Ele aperta os botões do Flow por você. |
| **Crédito** | A moeda do Flow. Vídeo gasta crédito. Imagem não gasta. |
| **Projeto** | Uma pasta dentro de uma conta do Flow. Personagens e coleções pertencem a um projeto. |
| **Coleção** | Uma pasta dentro do projeto do Flow, para não misturar tudo na raiz ("All media"). |
| **Fila** | A lista de trabalhos esperando para rodar. O estúdio faz um de cada vez. |
| **Tarefa** | Um item da fila (nos documentos em inglês aparece como "job"). |
| **Cena** | Um vídeo curto. **Quadro** é uma imagem parada. |
| **MCP** | O jeito padrão de um assistente de IA (Claude, Codex) usar uma ferramenta. As ferramentas deste estúdio começam com `flow_`. |
| **API** | A porta que o estúdio abre no seu Mac para programas conversarem com ele. |
| **Token** | Uma senha curta, gerada toda vez que o estúdio liga, que protege essa porta. Nunca é copiada para documentos. |
| **Upscale** | Ampliar um arquivo (vídeo para 1080p, imagem para 2K). No Flow é grátis. |

---

## 1. O que é o Flow Studio e como abrir

O Flow Studio é um programa que roda no seu Mac. Ele abre um Chrome só dele, entra no Google Flow com as suas contas e aperta os botões do Flow como uma pessoa apertaria. Nada fica na nuvem. O painel é uma página que esse programa serve no próprio Mac.

Ele serve para fazer imagens e vídeos de IA, narração, montagem e legendas, sem abrir o Flow à mão. Também deixa um assistente de IA fazer o mesmo.

### Como abrir

1. Abra o navegador do Mac.
2. Vá para **http://127.0.0.1:8787**.

Só abre no próprio Mac. Não abre pelo celular nem por outro computador. Para acompanhar pelo celular, peça ao assistente de IA que consulte o estado (veja a seção 7). O servidor só aceita conexões do próprio Mac (endereço 127.0.0.1), de propósito, por segurança.

### Se estiver desligado

O painel mostra "Servidor desligado" na pílula de cima. Há três jeitos de ligar:

| Jeito | Como |
|---|---|
| Automático | Qualquer assistente com a ferramenta `flow_*` liga o estúdio sozinho quando encontra a porta livre. Basta pedir qualquer coisa a ele, como "veja a sessão do Flow". |
| Duplo clique | Dê dois cliques em **Flow Studio.command**, na pasta `~/flow-mcp`. Ele abre o painel. Feche a janela e o estúdio para. |
| Terminal | `cd ~/flow-mcp && npm run studio` |

Se o duplo clique disser que o arquivo "não pode ser aberto", clique com o botão direito e escolha **Abrir**.

### Ele reinicia sozinho quando um assistente chama

Quando um assistente chama uma ferramenta `flow_*` e a porta 8787 está livre, o programa dele inicia um Flow Studio separado, em segundo plano. Esse estúdio não morre quando a conversa com a IA acaba. Por isso a fila e os agendamentos sobrevivem.

Mais três coisas que o código faz:

- Se algo der errado de um jeito que o programa não entende (um erro inesperado, ou 10 erros soltos em 1 minuto), ele escreve o motivo no log e sai. Na próxima chamada de um assistente, um estúdio novo sobe.
- Se ninguém chamar nenhuma ferramenta, **ninguém religa** o estúdio caído. Aí é o duplo clique.
- O registro de tudo isso fica em `/tmp/flow-studio.log`. O programa só acrescenta linhas nele, nunca apaga.

O estúdio nunca liga um segundo se já houver um respondendo. Se a porta estiver ocupada por outro programa qualquer, ele avisa e não sobe.

### O que precisa estar instalado

- Node.js 22 ou mais novo e Google Chrome.
- **ffmpeg** (ferramenta grátis que corta e junta vídeo): para Montagem, Legendas e a voz Kokoro.
- **whisper.cpp** (ferramenta grátis que escuta o vídeo e escreve as palavras): para Legendas.
- Uma vez só: `npm run login` abre o Chrome do estúdio para você entrar no Google à mão. O programa nunca digita a sua senha.

Atualizar o programa: o README manda usar `git pull`, `npm install` e `npm run build`. Segundo as anotações do Erick de 11/11, o repositório dele acompanha o remoto `fork` (`git fetch fork && git merge fork/main`); confira com `git remote -v`. Depois reinicie o estúdio (com a fila vazia) e reconecte o assistente.

---

## 2. Mapa da tela

```
+-------------+------------------------------------------+------------------+
| Barra       |  [Conta e projeto]   Pílulas de status   |  MONITOR         |
| lateral     |------------------------------------------|  (fila e erros)  |
|             |                                          |                  |
| Elenco      |   ÁREA CENTRAL                           |  GALERIA         |
| Quadros     |   (a aba escolhida)                      |  (arquivos       |
| Cenas       |                                          |   salvos)        |
| Voz         |                                          |                  |
| Retocar     |                                          |                  |
| ---         |                                          |                  |
| Montagem    |                                          |                  |
| Legendas    |------------------------------------------|                  |
| Biblioteca  |  BARRA DE AÇÃO:  estimativa   [Gerar]    |                  |
| Prompts     |                                          |                  |
| Pesquisa    |                                          |                  |
+-------------+------------------------------------------+------------------+
```

Em janela estreita, a barra lateral vira uma fileira de botões no topo e o Monitor e a Galeria descem para baixo.

### Barra lateral

Dez abas, na ordem do menu. Uma linha separa as quatro primeiras e o Retocar das de acabamento:

| Aba | Subtítulo | Para que serve |
|---|---|---|
| Elenco | personagens | Criar o personagem uma vez. |
| Quadros | imagens | Imagens paradas, grátis. |
| Cenas | vídeos | Clipes de vídeo, gastam crédito. |
| Voz | narração | Gravar narração, grátis. |
| Retocar | editar um clipe | Mudar um clipe pronto. |
| Montagem | juntar o filme | Juntar clipes, música e narração. |
| Legendas | texto na tela | Palavras faladas na tela. |
| Biblioteca | no Flow | Ver e baixar o que está no projeto do Flow. |
| Prompts | biblioteca | Prompts prontos. |
| Pesquisa | produtos e vídeos | Achar produtos e vídeos no TikTok. |

Dá para abrir uma aba direto por endereço, por exemplo `http://127.0.0.1:8787/#captions`. Os nomes internos são `cast`, `frames`, `shots`, `narrate`, `restyle`, `cut`, `captions`, `library`, `prompts`, `research`.

O painel lembra o que você escreveu (cenas, pastas, ajustes) no navegador. Isso é por navegador: outro navegador começa em branco.

### Botão "Conta e projeto do Flow"

No topo da área central. Mostra a conta e o projeto abertos agora (por exemplo `moogbass53 · Bella - Influencer TIktok`). Clique para trocar. Detalhes na seção 4.

### Pílulas de status

No topo, ao lado do botão de conta. Elas se atualizam sozinhas (a cada 3 segundos quando há trabalho, a cada 20 quando não há).

| Pílula | Significa |
|---|---|
| **Conectando…** | O painel acabou de abrir e ainda não ouviu o estúdio. |
| **Servidor desligado** | O estúdio não responde. Veja a seção 1. |
| **Sem login** | O Chrome do estúdio não está logado no Google. Rode `npm run login`. |
| **Nenhum projeto aberto** | Está logado, mas o Flow não tem projeto aberto. Abra um em "Conta e projeto". |
| **Pronto** (bolinha verde) | Tudo certo e nada rodando. |
| **Trabalhando** (bolinha animada) | Há uma geração rodando ou tarefas prontas para rodar na fila. |
| Nome do plano (por exemplo PRO) | O plano da conta aberta. |
| **N créditos** | O saldo da conta aberta. |
| **Agendado HH:MM** | Existe pelo menos uma tarefa esperando a hora dela. A hora é a da primeira. Uma tarefa agendada para depois **não** conta como "Trabalhando". |
| **Mac acordado** | O Mac está sendo impedido de dormir porque há trabalho na fila (agendado ou não). |
| **A fila não está sendo salva** (vermelha) | O arquivo `queue.json` não pôde ser escrito. Se o estúdio cair, a fila se perde. |
| **Lista de contas proibidas ilegível: nada vai gerar** (vermelha) | O arquivo `config.json` está com defeito. Por segurança, o estúdio recusa tudo. Veja a seção 4. |

Quando o estúdio tem um recado sobre o Flow (sem login, sem projeto), ele aparece numa faixa amarela logo abaixo.

### Barra de ação (embaixo)

- À esquerda: a **estimativa** (número grande e texto pequeno). Em Quadros mostra "0 créditos". Em Cenas mostra "≈ N créditos" e quantas cenas estão prontas. Nas outras abas mostra "Grátis" (ou "≈ 20 créditos" em Retocar, "Apify" em Pesquisa). Sem aba escolhida mostra "Pronto".
- À direita: o botão **Gerar** (vira **Gerar quadros** ou **Gerar cenas**). Só funciona em Quadros e Cenas. Nas outras abas ele fica desligado e a ação é o botão de dentro da aba.
- O botão só liga se houver pelo menos uma cena com prompt escrito.

### Janelas (diálogos)

| Janela | Quando aparece |
|---|---|
| **Conta e projeto** | Ao clicar no botão de conta. |
| **Escolher do Flow** | Ao clicar "Do Flow" num espaço de imagem ou clipe. Também vira "Escolher uma narração", "Escolher dos meus filmes" e "Escolher um exemplo", conforme o uso. |
| **Visualizador** | Ao clicar num arquivo da Galeria ou do Monitor. Tem o botão **Mover para a lixeira do Mac**. |
| **Prompt completo** | Ao clicar "ver tudo" num prompt. |
| **Novo prompt / Editar prompt** | Ao criar ou editar um prompt seu. |
| **Confirmações** | O painel pergunta antes de gastar crédito, de mover algo para a lixeira e de apagar um prompt. |

---

## 3. Uma seção por aba

Regra geral do painel: **a pasta do projeto** (campo "Pasta do projeto") é o nome da pasta no Mac onde os arquivos vão cair, dentro de `~/flow-mcp-out/`. Não é o projeto do Flow. Caracteres estranhos viram `_`.

O nome padrão da pasta é `MyFilm` (em inglês mesmo). Troque por algo seu para não misturar.

### 3.1 Elenco (Passo 1)

**Para que serve.** Criar um personagem uma vez e usá-lo em todas as cenas. O Flow desenha o retrato a partir da descrição e mantém o visual.

**Campos.**

| Campo | O que fazer |
|---|---|
| Lista de personagens | Mostra os que já existem no projeto aberto. Cada um tem **Usar** e **Editar**. |
| Nome | Como o personagem será chamado. Nas cenas ele vira `asset:<nome>`. |
| Como ele ou ela é | A descrição. O Flow desenha o retrato. |
| Foto no lugar da descrição | Enviar uma foto, ou escolher uma imagem que já está no Flow. Use isto **ou** a descrição. |
| Personalidade (opcional) | Como o personagem age. |
| Voz (opcional) | Uma das vozes do Flow (Charon, Aoede...). |
| **Criar personagem** | Cria. Leva de 1 a 2 minutos. |
| **Recarregar** | Lê de novo a lista do Flow. |

**Usar** põe o personagem como referência no quadro 1 da aba Quadros. Para usá-lo numa cena de vídeo, escolha-o pelo espaço de referência da cena ("Do Flow"). **Editar** abre uma caixinha do navegador pedindo o que mudar ("troque a blusa por uma regata branca, mantenha todo o resto igual"); o Flow redesenha o retrato no lugar, de graça, e o personagem mantém nome, voz e personalidade.

**Quanto custa.** Nada.

**Dicas e armadilhas.**
- Personagem pertence ao **projeto**. Trocou de projeto, o elenco muda. No projeto novo, crie de novo.
- O retrato fica salvo em `~/flow-mcp-out/_cast/`.
- Personagem feito de uma foto que parece uma pessoa real famosa pode fazer o Flow recusar o vídeo. Quando o Flow achar que o rosto é de uma pessoa conhecida, a mensagem diz isso e sugere criar o personagem por descrição. Para vídeo, o roteiro do estúdio recomenda personagem **desenhado por descrição**.
- Máximo de 3 referências por cena.
- Cada cena que usa um personagem recebe automaticamente um "travamento de personagem": o estúdio acrescenta ao prompt um texto mandando o Flow copiar o rosto, o cabelo, o corpo e a roupa da referência. Por isso a descrição que você salvou precisa bater com a imagem.
- As regras do Erick para a Bella (não escrever o nome dela no prompt de imagem, usar só as fotos dela como referência) estão no AGENTS.md.

### 3.2 Quadros (Passo 2)

**Para que serve.** Imagens paradas: storyboard, ou o primeiro e o último quadro de um vídeo. É onde se acerta o visual antes de gastar crédito.

**Campos do cartão de cima.**

| Campo | O que faz |
|---|---|
| Pasta do projeto | Pasta do Mac onde as imagens caem. |
| Coleção no Flow (opcional) | Gera dentro dessa coleção (por exemplo `Dumps/Noite em SP`). Se não existir, é criada. Vazio = raiz do projeto. |
| **Começar às** (opcional) | Hora para começar. Vazio = agora. Veja a seção 5. |
| **Na conta/projeto** | Em qual conta e projeto rodar. Padrão: "O que estiver aberto no Flow". Veja a seção 5. |
| Formato | 16:9, 9:16, 1:1, 4:3 ou 3:4. |
| Versões por quadro | 1 a 4 imagens para cada prompt. |
| Como gerar | **Um por um** ou **Agente do Flow · todos juntos**. |

**Cada quadro** tem: o texto "O que este quadro mostra"; uma **Técnica de filmagem** (lista de frases prontas); até **3 referências** (personagem, produto, foto); e a caixa **Seguir o quadro anterior** (do quadro 2 em diante). Os botões do cartão: subir, descer, **Duplicar**, **Apagar**.

**Cole um roteiro.** Cole um texto com um quadro por parágrafo, ou numerado ("1. ... 2. ..."), e clique **Substituir quadros** ou **Acrescentar**. Aceita até 100.

**Um por um x Agente.**

| | Um por um | Agente do Flow |
|---|---|---|
| Velocidade | Uns 1 minuto por imagem, com pausa entre elas. | Todos de uma vez: cerca de 1 minuto para 30. |
| Prompt | Exatamente o que você escreveu. | O agente reescreve cada prompt. |
| Referências | Sim. | **Não** (o painel não manda). |
| Seguir o quadro anterior | Sim. | Não. |
| Versões e coleção | Sim. | Não: vai para a raiz do projeto, uma versão só. |
| Técnica de filmagem | Sim. | Não. |
| Limite | 100 quadros. | 50 quadros por lote (o painel aceita 100, mas o estúdio recusa mais de 50). |

Se algumas imagens do lote do agente falharem, o Monitor mostra o botão **Refazer N imagem(ns) que falhou**, que refaz só essas, com os mesmos números.

**Quanto custa.** Imagem não gasta crédito (a estimativa mostra "0 créditos"). Mas leia a seção 4: pelas regras do Erick, imagem só nas contas PRO.

**Dicas e armadilhas.**
- **Seguir o quadro anterior** é o que mantém o personagem e o estilo iguais numa sequência. Se um quadro for recusado pelo Flow, os que dependem dele também falham.
- Quadros não deixam escolher o modelo de imagem no painel: vale o Nano Banana mais novo (hoje o 2.1). O **Nano Banana Pro** só se escolhe pelo assistente de IA ou pela API.
- Em "Um por um", o painel manda `max_credits` zero: se o Flow cobrar algo, o quadro é pulado.

### 3.3 Cenas (Passo 3)

**Para que serve.** Clipes de vídeo. Cada cena gasta crédito. Você dá um primeiro e um último quadro e o Flow anima entre eles, ou encadeia na cena anterior para um movimento contínuo.

**Campos do cartão de cima.**

| Campo | O que faz |
|---|---|
| Pasta do projeto | Pasta do Mac. Os vídeos caem como `scene-01.mp4`, `scene-02.mp4`... O número continua de onde parou, nunca sobrescreve. |
| Coleção no Flow (opcional) | Igual a Quadros. |
| Começar às / Na conta/projeto | Veja a seção 5. |
| Modelo | **Omni 1.1 Flash**, **Veo 3.1 - Lite**, **Veo 3.1 - Fast** ou **Veo 3.1 - Quality**. |
| Formato | 16:9 ou 9:16 (vídeo só aceita esses dois). |
| Duração (s) | 4, 6, 8 ou 10. **Só no Omni.** Nos Veo o clipe é fixo em 8 s (os botões ficam desligados). |
| Gerar em | 360p ou 720p. **Só no Omni.** "720p é o máximo do Flow." |
| Baixar em | 720p (original) ou 1080p (ampliado, grátis, mais lento). |
| Versões por cena | 1 a 4. Cada versão gasta crédito. |
| Máximo de créditos por cena | Trava de segurança. Padrão 25. Se o Flow cobrar mais que isso, a cena é pulada e nada é gasto. |

**Cada cena** tem: o que acontece; técnica de filmagem; **Quadros (primeiro → último)**; até 3 referências; e a caixa **Continuar da cena N (emenda sem corte)**, que começa esta cena no último quadro da anterior.

Detalhe importante do Flow: o compositor dele aceita **ou** quadros (primeiro/último) **ou** referências de personagem, **nunca os dois juntos**. Se você puser os dois, as referências são ignoradas e o trabalho avisa isso. Para ter um quadro inicial **e** o personagem travado, use o cartão "Continuar a partir de um clipe pronto", abaixo.

**Por padrão, todo vídeo proíbe texto na tela.** O estúdio acrescenta ao prompt "sem legendas, sem texto" no começo e no fim, porque o modelo costuma queimar legendas tortas na imagem. Legenda se coloca depois, na aba Legendas. (Para pedir texto na imagem de propósito, só pelo assistente, com `on_screen_text`.)

**Quanto custa.** Tabela do painel (plano PRO, uma versão). Multiplique pelas versões.

| Omni 1.1 Flash | 4 s | 6 s | 8 s | 10 s |
|---|---:|---:|---:|---:|
| 360p | 4 | 5 | 6 | 7 |
| 720p | 7 | 10 | 12 | 15 |

| Veo (sempre 8 s) | Créditos |
|---|---:|
| Veo 3.1 - Lite | 10 |
| Veo 3.1 - Fast | 20 |
| Veo 3.1 - Quality | 100 |

O preço real é lido do próprio Flow antes de cada cena. A estimativa da barra de ação é só uma conta do painel. O Veo Quality custa 100: suba o "Máximo de créditos por cena" antes, senão ele é pulado.

Ao clicar **Gerar cenas**, o painel pergunta "Colocar N cena(s) na fila ... por cerca de X créditos?". Confirme só se o número estiver certo.

**Continuar a partir de um clipe pronto.** Parte do último quadro real de um clipe já feito, para os dois rodarem como um plano só.

| Campo | O que faz |
|---|---|
| Pasta do projeto para o novo clipe | Os arquivos caem como `shot-01`, `shot-02`... |
| Clipe de onde continuar | Clique **Carregar clipes do Flow** e escolha. |
| Como emendar | **Emenda exata** (recomendado): começa no último quadro real, corte invisível, mas o personagem anexado é ignorado. **Personagem travado**: o rosto fica igual, mas o quadro de abertura é só parecido. O Flow não faz os dois. |
| Quem manter travado | Só aparece em "Personagem travado". |
| O que acontece no novo clipe | O prompt, como um plano só e um movimento de câmera. |

O Flow não mostra o preço antes disso. O painel avisa que "um clipe de 10 s custou 15 créditos quando medimos". Se o estúdio achar que o Flow já tem uma continuação recente desse clipe, ele recusa para não gastar duas vezes. (Só o assistente consegue forçar, com `force`.)

Armadilha: o botão do painel **não manda o formato** (16:9 ou 9:16). O código usa 16:9 se ninguém disser. Para vídeo em pé, peça ao assistente com `aspect_ratio: "9:16"`. Se o Flow herda o formato do clipe de origem: **(a confirmar)**.

**Dicas e armadilhas.**
- Cada cena deve ter **uma ação** e **um movimento de câmera**. O roteiro do estúdio (`flow_status`) detalha o que funciona e o que quebra (mãos, objetos jogados, giros de produto).
- Fala: cada cena de 10 s comporta umas 22 a 25 palavras. Regras de fala e de "uma tomada por vídeo, nunca gerar de novo" estão no AGENTS.md.
- Uma cena recusada por política (rosto de pessoa famosa, certas partes do corpo) não gasta crédito. Reescrever o mesmo prompt não ajuda; mude o conteúdo.
- Se uma cena do meio falhar, as cenas que "continuam da anterior" falham junto.
- O estúdio tenta de novo, uma vez, o botão "Retry" do próprio Flow quando uma mídia falha. Isso é grátis. Erro de tempo esgotado **nunca** é repetido sozinho, porque pode já ter gasto crédito.

### 3.4 Voz (Passo 4)

**Para que serve.** Gravar narração em arquivo `.m4a`. Não gasta crédito do Flow.

| Campo | O que faz |
|---|---|
| Pasta do projeto | Onde o áudio é salvo (`narration-01.m4a`, `narration-02.m4a`...). |
| Texto a falar | O texto. Até 3.000 caracteres. |
| Motor de voz | **Kokoro** ou **Google AI Studio**. |
| Chave do Google AI Studio | Só no motor Google. Cole a chave aqui e clique **Salvar chave**. O estúdio confere com o Google e guarda só no Mac. **Nunca cole essa chave em um chat.** |
| Voz | A lista muda conforme o motor. |
| Velocidade | Só no Kokoro, de 0,70× a 1,30×. |
| Interpretação (opcional) | Só no Google. Uma nota curta, como "devagar e com carinho". Nota longa faz o modelo enrolar. |

| | Kokoro | Google AI Studio |
|---|---|---|
| Onde roda | No seu Mac. | Nos servidores do Google. |
| Chave | Não precisa. | Precisa de uma chave grátis. |
| Limite diário | Nenhum. | Tem. Se acabar, grava com o Kokoro e avisa. |
| Vozes | 28, em inglês (americanas e britânicas). Padrão `am_michael`. | As mesmas do Flow. Padrão Charon. |
| Primeira vez | Baixa um modelo de 326 MB, cerca de 1 minuto. | — |

O painel conta as palavras e estima: cerca de 2,5 palavras por segundo.

Depois de gravar, aparece um player e o botão **Usar na Montagem**. A lista "Suas narrações" guarda todas, com player e botão **Lixeira** (manda para a lixeira do Mac).

**Dica.** As vozes do Kokoro são em **inglês**. Para narração em português, o motor Google é o caminho **(a confirmar a qualidade do português; o código só lista vozes em inglês no Kokoro)**.

### 3.5 Retocar (opcional)

**Para que serve.** Mudar um clipe que já existe no projeto do Flow, sem gravar de novo: trocar a luz, o clima, a hora do dia, tirar um objeto.

| Campo | O que faz |
|---|---|
| Pasta do projeto para o resultado | Os arquivos caem como `edit-01`... |
| Clipe a mudar | **Carregar clipes do Flow**, depois escolha. |
| O que mudar | Texto livre. |
| **Retocar clipe** | Põe na fila. |

**Quanto custa.** O Flow **não mostra o preço antes**. Um clipe de 4 s custou 20 créditos quando foi medido. O painel pede confirmação. O preço real aparece no Monitor quando termina.

**Armadilha.** Como não há cotação, a trava `max_credits` não protege aqui. Pense duas vezes.

### 3.6 Montagem (Passo 5)

**Para que serve.** Juntar clipes em um filme só, com música e narração por cima. Tudo no seu Mac, de graça (usa o ffmpeg).

| Campo | O que faz |
|---|---|
| Pasta do projeto | Onde procurar os clipes e onde salvar. O filme sai como `final.mp4`. |
| Clipes, na ordem | **Enviar um vídeo** ou **Dos meus filmes**. Cada clipe tem um × para tirar. **Vazio = usa todos os `scene-NN.mp4` da pasta**, na ordem. |
| Música | Enviar um arquivo de áudio. A música repete e é cortada no tamanho do filme. |
| Narração | Enviar um arquivo, ou escolher em "Minhas narrações". Começa no segundo zero. |
| Volume da música | 0 a 100%. Padrão 25%. |
| Som dos clipes | 0 a 100%. Padrão 100%. Baixe para uns 20 a 30% para a narração ficar por cima. |
| Segurar o último quadro até a narração terminar | Marcado por padrão. Se a narração for mais longa que as imagens, o último quadro fica parado em vez de cortar a voz. |
| **Montar o filme** | Monta e mostra o resultado, com o botão **Colocar legendas neste filme**. |

**O painel só usa o básico.** Ferramentas avançadas existem pelo assistente de IA (`flow_assemble`): cortar o começo ou o fim de cada clipe (`trims`), cartão final com texto ("link na bio"), imagens de apoio por cima (`inserts`), voz montada linha por linha (`voice_lines`), nivelar o volume (`loudness`, o alvo de redes sociais é cerca de -14), tamanho do filme (`size`, por exemplo `1080x1920`) e tirar a marca d'água de brilho do canto (`remove_watermark`). A marca invisível SynthID continua, e as plataformas ainda esperam o aviso de conteúdo feito por IA.

**Quanto custa.** Nada.

**Armadilha.** Sem ffmpeg instalado, dá erro dizendo como instalar.

### 3.7 Legendas (Passo 6)

**Para que serve.** Colocar as palavras faladas na tela, no estilo dos vídeos curtos, em vídeo deitado ou em pé. O Mac escuta o vídeo e marca o tempo de cada palavra. Nada sai do Mac.

**Primeira vez.** Precisa do **whisper.cpp**. Se faltar, aparece um aviso amarelo "Configuração única" com o comando para instalar, e o botão **Já instalei, conferir de novo**. O modelo de fala baixa sozinho na primeira vez que cada idioma é usado: 148 MB para inglês, 574 MB para os outros idiomas. "Detectar sozinho" baixa também um detector pequeno (cerca de 60 MB).

| Campo | O que faz |
|---|---|
| Vídeo | **Enviar um vídeo**, **Dos meus filmes**, ou colar o caminho do arquivo no Mac e clicar **Usar**. Ao escolher, o estúdio já escuta o vídeo. |
| Idioma falado | Cerca de 100 idiomas, ou **Detectar sozinho**. O primeiro uso escolhe o idioma do navegador, se estiver na lista, senão inglês. **Para vídeos em português, escolha Português.** |
| Estilo | **Destaque forte** (letras grandes, a palavra falada acende), **Marca-texto** (bloco colorido atrás da palavra), **Palavra a palavra** (as palavras vão aparecendo), **Limpa** (legenda clássica), **Com tarja** (letras brancas numa faixa escura). |
| Posição | Embaixo, Meio ou Em cima. |
| Altura exata | Deslizador. Ou toque na prévia no ponto onde quer as palavras. |
| Tamanho | 50% a 180%. |
| Letras | Normal, MAIÚSC. ou minúsc. Padrão: maiúsculas no Destaque forte, normal nos outros. |
| Cor de destaque | Cinco cores por estilo (não existe no estilo Limpa nem no Com tarja). |
| Prévia | Um quadro de verdade do seu vídeo com a legenda. Atualiza sozinha. |
| As palavras | O que o estúdio ouviu. **Corrija aqui o que foi mal ouvido**: cada palavra mantém o tempo. **Enter** começa uma nova legenda naquele ponto. |
| **Colocar legendas** | Gera `<nome>-captions.mp4` e um arquivo `.srt` (legenda para o YouTube). Um vídeo de um minuto leva uns 30 segundos. |

**Dicas e armadilhas.**
- O whisper às vezes ouve errado nomes próprios e palavras coladas. **Sempre leia o campo "As palavras" antes de gerar.** Se uma legenda aparecer inventada ou fora de lugar, corrija o texto ali; o vídeo é refeito do mesmo jeito, só com as palavras certas.
- Música ou barulho forte no vídeo atrapalha o tempo das palavras. O assistente consegue dar os tempos à mão (`words`).
- As regras do Erick para o TikTok (texto na tela vai no editor do TikTok, nunca queimado no vídeo; rascunho; rótulo de IA ligado) estão no AGENTS.md. Legenda queimada serve para YouTube e outros usos; confira antes.
- Se trocar o idioma, o texto corrigido é descartado (ele era do idioma antigo) e o vídeo é escutado de novo.

**Quanto custa.** Nada.

### 3.8 Biblioteca

**Para que serve.** Ver tudo o que está solto no projeto aberto do Flow e baixar de novo, sem gerar outra vez. É o remédio quando "o vídeo foi gerado mas o arquivo não chegou": o clipe está seguro no Flow, e baixar é grátis. **Nunca gere de novo e pague duas vezes.**

| Botão | O que faz |
|---|---|
| Salvar na pasta do projeto | Campo: pasta do Mac onde os downloads caem (`clip-01`, `clip-02`... continuando a numeração). |
| **Carregar biblioteca** | Lê o projeto do Flow (demora um pouco). |
| (clique nos itens) | Marca ou desmarca. |
| **Baixar selecionados** | Baixa no tamanho original. |
| **…em 1080p / 2K** | Baixa ampliado. Grátis, mas pode levar minutos. |
| **Mover para a lixeira do Flow** | Tira do projeto do Flow, com confirmação. **Não** apaga do Mac. Dá para recuperar na lixeira do Flow. |

Ela só enxerga o que está **solto** (em "All media"). O que foi movido para uma coleção não aparece como solto.

**Dois tipos de lixeira, para você sempre saber o que está apagando:**

| Botão | O que tira | Dá para voltar? |
|---|---|---|
| **Mover para a lixeira do Flow** (aqui) | O item do projeto no Flow. | Sim, na lixeira do Flow. |
| **Lixeira / Mover para a lixeira do Mac** (Galeria, Voz) | O arquivo ou a pasta do seu Mac. | Sim, na Lixeira do Mac. |

Nenhum dos dois botões de lixeira apaga de vez, e o estúdio só mexe em arquivos dentro de `~/flow-mcp-out`. (Já apagar um prompt seu, na aba Prompts, não tem volta.)

### 3.9 Prompts

**Para que serve.** A biblioteca de prompts que funcionam, num lugar só.

**O que tem hoje.** 188 prompts em 9 categorias: Movimentos UGC, POV e mãos, Moda e provador, Unboxing e embalagem, Produto em ação, Com fala, Imagem inicial, Storyboard e JSON, Efeitos virais. As fontes são a Nespol (45) e criadores do TikTok: @pereiracreator_ (74), @airon.ia (31), @vendapro.ia (24), Cezar Bueno (9) e Brenda Fontes (5). Os números mudam quando a biblioteca é reconstruída.

**Como usar.**
- **Buscar.** A busca entende português e inglês: "vestido" também acha "dress".
- **Filtros.** Por categoria (as bolinhas com números), por ordem (**Recentes**, **Mais usados**, **Favoritos**) e por formato (Todos, Vertical 9:16, Horizontal 16:9). Os que têm exemplo (vídeo ou imagem) aparecem primeiro.
- **Cada cartão** tem: **Copiar**, uma estrela de **favorito**, **Usar em Cenas**, **Usar em Quadros**, **ver tudo** (abre o prompt completo, com todas as partes) e **Definir exemplo** / **Trocar exemplo** / **tirar exemplo**.
- **Usar em Cenas / Quadros** põe o texto no primeiro cartão vazio da aba escolhida (cria um novo se não houver) e leva você para lá. Em prompts com partes (imagem + movimento), Quadros pega a parte de imagem e Cenas pega a de vídeo. Se o prompt for vertical e o formato da aba não for 9:16, o aviso aparece.
- **Exemplo.** É o vídeo ou a imagem que mostra o resultado. Escolha um da Galeria. **Quando você gera uma cena a partir de um prompt da biblioteca e ela termina, o primeiro arquivo vira o exemplo automaticamente** (se o prompt ainda não tinha um). Se já tinha, o Monitor mostra o botão **Usar como exemplo do prompt**.
- **Novo prompt.** Escreva o seu (título, tipo, formato, texto). Fica na categoria **Meus**, que você edita e apaga. Os da biblioteca não se editam.
- **Para o produto.** Vindo da aba Pesquisa pelo botão "Criar prompt com este produto", aparece uma faixa lembrando de trocar o produto do prompt pelo seu.

**Onde ficam os dados.**

| Arquivo | O que é |
|---|---|
| `~/flow-mcp/prompts/library.json` | A biblioteca. É gerada pelo script `node scripts/build-prompts.mjs` a partir de dois arquivos de texto da pasta `Referencias` do UGC (`prompts-nespol-ugc.md` e `prompts-criadores-tiktok.md`). Pode reconstruir à vontade. |
| `~/flow-mcp/prompts/meus.json` | **Seus dados**: favoritos, contagem de cópias e usos, seus prompts, exemplos escolhidos. O script de reconstrução nunca mexe nele. (Ainda não existe até você favoritar ou criar algo.) |
| `~/flow-mcp/prompts/nespol-examples.json` | Endereços das imagens de exemplo da Nespol. Elas vêm do site da Nespol, não são baixadas. |

**Quanto custa.** Nada.

### 3.10 Pesquisa

**Para que serve.** Achar os produtos que mais vendem no TikTok Shop e os vídeos que estão bombando, pelo Apify (um serviço que lê o TikTok para você). Cada busca usa centavos de dólar do saldo de uma conta sua do Apify.

**Campos.**

| Campo | O que faz |
|---|---|
| Produtos · TikTok Shop / Vídeos · TikTok | O que buscar. |
| Palavra-chave | Em vídeos também aceita `#hashtag`. |
| Quantidade | 1 a 50. Padrão 20. |
| **Buscar** | Pede a confirmação com o custo estimado e busca. Espera até 4 minutos. |
| **País** | Produtos: Brasil, Estados Unidos, Reino Unido, França, Alemanha, Espanha, Itália, México, Japão. Vídeos: Brasil, Estados Unidos, Reino Unido, Portugal, Espanha, México, Argentina, França, Itália, Alemanha, Canadá, Austrália, Japão, Coreia do Sul. Padrão Brasil. Sem escolher o país, uma busca de vídeos vinha em inglês, dos EUA. |
| **Conta do Apify** | A conta usada primeiro, com o saldo do mês ("US$ X livres de US$ Y no mês"). |

**Custo estimado (mostrado antes de buscar).** Produtos: cerca de US$ 0,002 + US$ 0,005 por produto. Vídeos: cerca de US$ 0,001 + US$ 0,0037 por vídeo. O custo real, depois da busca, aparece no aviso.

**Se uma conta do Apify estiver sem saldo.** Se a conta escolhida recusar (chave recusada, sem saldo, limite do mês), o estúdio tenta a **próxima** conta sozinho e avisa quais pulou. Outros erros (demora, erro do servidor) **não** passam para outra conta, para não pagar duas vezes por algo que pode já ter rodado.

**Resultados.**
- Produtos: foto, preço, desconto, vendidos, nota, loja, faturamento estimado, **Abrir no TikTok** e **Criar prompt com este produto** (vai para a aba Prompts com uma busca pronta). Ordenar por mais vendidos, menor ou maior preço, maior desconto ou melhor nota.
- Vídeos: capa, descrição, autor, visualizações, curtidas, comentários, compartilhamentos, duração, **Abrir no TikTok**. Ordenar por mais vistos, curtidos, comentados, compartilhados ou recentes. Para Brasil e Portugal, os vídeos em português vêm primeiro.

**Buscas salvas.** Toda busca fica salva em `~/flow-mcp-out/pesquisas/` como `AAAA-MM-DD-produtos-<termo>.json` (ou `-videos-`). A lista "Buscas salvas" mostra todas. Arquivos de outras fontes (por exemplo, uma busca que o Claude fez com o conector dele do Apify) funcionam se você os colocar nessa pasta: aparecem sem precisar de chave.

**As chaves do Apify.**
- Ficam em `~/flow-mcp/.env`, que **você** escreve. Até 5 contas: `APIFY_TOKEN`, `APIFY_TOKEN_2` até `APIFY_TOKEN_5`, cada uma com um nome opcional (`APIFY_TOKEN_NAME`, `APIFY_TOKEN_2_NAME`...).
- O painel só vê o nome e o saldo. A chave nunca chega ao painel, nem ao log, nem a um assistente.
- Sem nenhuma chave, o botão Buscar fica desligado e o painel diz "peça a busca ao Claude e ela aparece aqui".
- Nunca escreva uma chave em documento, chat ou git.
- Hoje o arquivo tem 3 contas configuradas.

---

## 4. Contas e créditos

A tabela das contas (qual é PRO, qual é gratuita, qual não usar) fica no [AGENTS.md](</Users/erickfonseca/Documents/EFS Studio/UGC/AGENTS.md>) e muda com o tempo. Este manual só explica **como o estúdio lida com elas**.

### Trocar de conta ou projeto

1. Clique no botão **Conta e projeto do Flow** (no topo).
2. A janela lista cada conta logada no Chrome do Flow, com os projetos dela. O projeto aberto aparece como "aberto".
3. Clique no projeto desejado. O estúdio troca. As próximas gerações vão para lá.
4. **Recarregar** lê as contas de novo.

Regras:
- **Não dá para trocar com a fila ativa.** O painel avisa "Espere a fila terminar antes de trocar de projeto". Trocar no meio de um vídeo atrapalha o trabalho.
- **Não dá para ler as contas enquanto uma geração roda.** O painel mostra o que leu da última vez (guardado no navegador) e diz "Saldo atualizado quando a geração terminar".
- Personagens e coleções pertencem ao projeto: ao trocar, o Elenco é relido.
- Para **gerar** em outra conta sem trocar à mão, use **Na conta/projeto** (seção 5).
- O **Novo projeto** (ferramenta `flow_new_project`) cria o projeto na conta em que o Flow estava por último. Isso já criou um projeto vazio duplicado na conta errada (conta /u/0/, em 13/11). Confira a conta antes. O jeito seguro é primeiro abrir um projeto da conta certa (botão de conta e projeto) e só depois criar o novo.

### Ler saldo e renovação

Na janela de conta, cada conta mostra uma linha como:

`free · 31 créditos · renova 23:25 · lido há 3 min` (conta gratuita, renovação diária)

- O saldo é lido abrindo o painel "Account details" do Flow em uma aba rápida, uns 3 segundos por conta. Isso só acontece quando você abre a janela de conta ou clica **Recarregar**. A leitura automática do começo é a barata, sem créditos.
- **Contas gratuitas**: a linha do Flow diz "Credits refresh daily at 11:25 PM" e o estúdio mostra a próxima renovação por hora. Os créditos não usados se perdem.
- **Contas PRO**: a linha do Flow diz "Resets Dec 2 at 11:34 PM" (renovação **mensal**, com data). **Atenção:** o painel do estúdio mostra só a hora ("renova 23:34"), sem a data, então numa conta PRO essa hora é a do reset mensal, não diária. A data completa está no menu de créditos do próprio Flow. Para algumas contas o menu não mostra data nenhuma; aí o estúdio não inventa.
- A hora de renovação que o Flow mostra de manhã às vezes é só a hora de agora. Segundo as anotações do Erick, as horas reais foram lidas à noite. Confira antes de planejar um lote.
- O saldo da pílula "N créditos" no topo é o da conta aberta agora. O saldo mensal pode não aparecer certo nessa pílula; o menu da conta é a fonte confiável **(a confirmar caso a caso)**.
- Por assistente: `flow_accounts` com `credits: true` (e opcionalmente `only: [2,3,5]` para ler só algumas contas).

### Conta bloqueada ("não usar")

O arquivo `~/.flow-mcp/config.json` guarda a lista de contas proibidas:

```json
{ "avoid_accounts": [4] }
```

- Os números são os índices das contas no endereço (`/u/4/`). Os índices dependem da ordem em que as contas foram logadas; se as contas forem relogadas em outra ordem, o número passa a apontar para a conta errada.
- O arquivo é criado com `[4]` se não existir. A mudança vale na hora, sem reiniciar.
- O estúdio recusa **colocar na fila** qualquer coisa em conta proibida, e **recusa rodar** um trabalho se a aba do Flow estiver numa conta proibida, mesmo que ele estivesse na fila antes.
- No painel, a conta proibida aparece com a etiqueta **não usar** na janela de conta, e some do seletor "Na conta/projeto". Clicar nela dá aviso.
- Se o arquivo estiver ilegível, **nada** é gerado (falha segura) e a pílula vermelha avisa.
- A variável de ambiente `FLOW_MCP_AVOID_ACCOUNTS` (por exemplo `4,6`) sobrepõe o arquivo, se estiver preenchida.

### O que cada coisa custa

Tabela de vídeos na seção 3.3. Resumo de todo o resto:

| O quê | Custo |
|---|---|
| Imagem (qualquer modelo Nano Banana) | 0 crédito |
| Vídeo Omni 1.1 Flash 360p | 4 a 7 créditos (4, 6, 8 ou 10 s) |
| Vídeo Omni 1.1 Flash 720p | 7 a 15 créditos |
| Vídeo Veo 3.1 Lite / Fast / Quality | 10 / 20 / 100 créditos, 8 s fixos |
| Retocar um clipe | cerca de 20 créditos para 4 s (sem cotação prévia) |
| Continuar de um clipe pronto | cerca de 15 créditos para 10 s (sem cotação prévia) |
| Personagem (criar e editar) | 0 |
| Narração, Montagem, Legendas, Prompts | 0 |
| Download e upscale (1080p / 2K) | 0 |
| Busca no Apify | centavos de dólar do saldo do Apify |

Como o estúdio protege o crédito:
- **Antes de cada cena de vídeo**, ele lê o preço que o próprio Flow mostra e **pula a cena** se passar de `max_credits` (padrão 25). Nada é gasto.
- Retocar e Continuar não têm preço visível, então exigem um "sim, aceito o custo" explícito.
- Um trabalho é gravado como "rodando" **antes** de tocar no Flow. Se o estúdio cair no meio, esse trabalho volta como "falhou" e **nunca** roda de novo sozinho (pode já ter sido cobrado).

Regras do Erick sobre qual conta usa o quê, resoluções e quando usar 720p: no [AGENTS.md](</Users/erickfonseca/Documents/EFS Studio/UGC/AGENTS.md>).

---

## 5. Agendar

Serve para começar um trabalho numa hora certa. O caso típico: esperar a renovação diária de uma conta gratuita e gastar os 50 créditos assim que chegarem.

### Os dois campos (em Quadros e em Cenas)

| Campo | O que faz |
|---|---|
| **Começar às** | Um relógio de hora e minuto. Vazio = começa agora. Se a hora já passou hoje, é amanhã. Máximo de 48 horas à frente. |
| **Na conta/projeto** | Qual conta e projeto usar. Padrão: "O que estiver aberto no Flow". As contas "não usar" não aparecem. |

Para saber a hora de renovação da conta, veja a janela "Conta e projeto". Agende uns minutos **depois** da renovação.

Quando você clica em **Gerar**, o painel avisa: `Agendado: começa sex 10:35 (em 2h 14min).` O horário vem da resposta do estúdio.

### O que acontece quando a hora chega

1. Se o projeto escolhido não for o que está aberto, o estúdio abre esse projeto (na conta certa).
2. Confere a conta contra a lista "não usar".
3. Roda o trabalho.

Todo trabalho agendado fica **preso a um projeto**. Para não arrastar os outros para o projeto errado:
- Se você agenda sem escolher "Na conta/projeto", ele fica preso ao projeto **aberto naquele momento**.
- Enquanto existirem trabalhos agendados ou presos na fila, todo trabalho novo também é preso ao projeto aberto na hora em que entra.
- Se o estúdio não souber qual projeto está aberto (Chrome fechado, sem projeto), ele **recusa** agendar e pede para você escolher "Na conta/projeto". Nada entra na fila.

### O que aparece em "Agendados"

No Monitor, o bloco **Agendados** mostra cada trabalho com um relógio: o nome, o que vai gerar, "começa às HH:MM · em Xh YYmin" e, por baixo, a conta e o projeto em palavras (por exemplo `moogbass53 · projeto Bella - Influencer TIktok`). Cada linha tem um **×**: **cancelar o agendamento**.

O resumo do topo do Monitor ganha "N agendados". A pílula do topo diz "Agendado HH:MM".

### Como cancelar

- **Antes de começar**: clique o **×** na linha do Monitor (ou, pelo assistente, `flow_cancel` com o número do trabalho). O trabalho vira "cancelado". **Tentar de novo** o coloca de volta (uma hora ainda no futuro é mantida; uma hora que já passou roda na hora).
- **Depois de começar**: **não dá para cancelar** um trabalho que já está rodando. Ele continua até terminar. Reiniciar o estúdio para pará-lo não resolve: a fila gravada volta, mas o trabalho que estava rodando volta como "falhou" (pode já ter gastado crédito).

### Se o estúdio reiniciar

A fila é salva em `~/.flow-mcp/queue.json` a cada mudança. Quando o estúdio liga de novo:

| Estado antes | Depois |
|---|---|
| Rodando | Vira **falhou**, com a nota "o estúdio reiniciou enquanto isso rodava; o Flow pode ter terminado e cobrado". **Não roda de novo sozinho.** Confira a Biblioteca antes de tentar. |
| Agendado com a hora ainda no futuro | Mantido, mesma hora. |
| Na fila, gravada ou com hora marcada há **menos de 30 minutos** | Mantido e roda. |
| Na fila, gravada ou com hora marcada há **mais de 30 minutos** | Vira **cancelado**, com a nota "perdeu a hora enquanto o estúdio estava desligado; Tentar de novo roda agora". |
| Prontos e com erro | Ficam como histórico (até 100 itens). |

Só um estúdio por vez é dono desse arquivo. Se outro estúdio de outra porta o segurar, o novo avisa e guarda a fila só na memória.

### Se o Mac dormir

- **Enquanto houver trabalho na fila (agendado ou não), o estúdio impede o Mac de dormir** (usa o `caffeinate` do macOS). A pílula **Mac acordado** mostra que isso está ligado.
- **Isso não cobre tudo.**
  - **Bateria**: o impedimento de sono do sistema só funciona **na tomada**. Deixe o Mac carregando.
  - **Tampa fechada**: o Mac dorme, a menos que esteja em modo "tampa fechada" com monitor externo e carregador. **Deixe a tampa aberta e na tomada.**
  - Mudar essas configurações do Mac é com você.
- Se o Mac dormir mesmo assim, o relógio do estúdio atrasa. Quando acorda, ele confere a hora real a cada 15 segundos, e o trabalho deve começar pouco depois de acordar, mas **não** no horário (a confirmar na prática). Se passar de 30 minutos e o estúdio também reiniciar, a regra de 30 minutos acima vale.
- Variáveis para quem sabe o que faz: `FLOW_MCP_AWAKE=0` desliga o impedimento de sono; `FLOW_MCP_AWAKE_DISPLAY=0` deixa a tela apagar (Flow com tela apagada nunca foi testado).

### Agendamento pelo assistente

`flow_generate` e `flow_agent_images` aceitam `start_at` e `open_project`:

| `start_at` | Exemplo |
|---|---|
| Hora do dia (24 h, relógio deste Mac) | `"10:35"` (se já passou hoje, é amanhã) |
| Daqui a quanto tempo | `"+90m"`, `"+2h"`, `"+1h30m"` |
| Data e hora | `"2026-11-15T10:35"` |

`open_project` é o endereço do projeto, vindo de `flow_accounts` (por exemplo `https://flow.google.com/u/2/project/<id>`).

Dois cuidados antes de agendar:
1. **Reconecte o MCP do Flow na sessão.** Um processo MCP antigo ignora a hora e **começa o vídeo na hora, gastando crédito**. Confirme que `flow_status` lista `start_at` em `capabilities`.
2. **Confira `starts_at` na resposta.** Se ele não vier, o agendamento não valeu.

Um erro de digitação no `start_at` nunca vira "começar agora": o estúdio recusa e não coloca nada na fila. Os dois comandos também recusam campo com nome errado (por exemplo `start_time`).

---

## 6. Monitor

O Monitor fica à direita (embaixo, no celular). Mostra a fila, o que está rodando e o que deu errado.

### Resumo no topo

Uma linha de números: **gerando**, **na fila**, **agendados**, **prontos**, **com erro** (só aparece se houver) e **créditos** (soma dos créditos gastos pelas tarefas prontas **desta sessão**).

### Os blocos

| Bloco | O que é |
|---|---|
| **Gerando agora** | A tarefa que está rodando, com uma barra de progresso, a porcentagem do próprio Flow (quando ele mostra), o modelo, os créditos e o número da tentativa. |
| **Na fila** | As tarefas esperando a vez, numeradas. Cada uma tem um **×** para tirar da fila. |
| **Agendados** | Tarefas esperando a hora delas. Veja a seção 5. |
| **Com erro / Cancelados** | O que falhou ou foi cancelado. Cada um tem o botão **Tentar de novo**. A mensagem de erro aparece em uma linha; toque nela para ver inteira, ou abra "detalhes". |
| **Prontos** | As 6 mais recentes, com miniatura, o que gerou, créditos, quanto tempo levou e a hora. Clique para abrir no visualizador. **ver todos (N)** mostra o resto. |

Estados de uma tarefa no estúdio: `queued` (na fila ou agendada), `running` (gerando), `done` (pronta), `failed` (erro), `cancelled` (cancelada).

### Tempo estimado (ETA)

- A estimativa usa a **média real** das últimas 8 tarefas prontas do mesmo tipo (imagem ou vídeo). Sem histórico, usa 90 s por imagem e 180 s por vídeo.
- Na tarefa rodando: "faltam ~Xmin YYs · gerando há ...". Se passar da média: "passou da média em ...".
- Na fila: "começa em ~X". Em agendadas: "começa às HH:MM · em Xh YYmin".
- Embaixo do resumo: **Fila inteira: ~X até gerar tudo (N itens) · termina perto das HH:MM.** A conta já inclui as pausas e a espera dos agendados.
- É uma estimativa. Tarefas com várias versões ou lotes de agente fogem da média.

### Pausas entre gerações

O estúdio roda **uma geração de cada vez**, com uma **pausa aleatória de 25 a 70 segundos** entre elas. É de propósito: o Flow tem uma proteção invisível contra robôs, e o estúdio age no ritmo de uma pessoa. O Monitor mostra: `⏱ Pausa entre gerações: a próxima começa em 38s`. Não é travamento.

Quem sabe o que faz pode mudar o intervalo com `FLOW_MCP_PAUSE_MIN_S` e `FLOW_MCP_PAUSE_MAX_S`. **Não é recomendado.**

### Tentar de novo

- **Tentar de novo** (na linha com erro ou cancelada) coloca a tarefa de volta na fila com as mesmas configurações e os mesmos nomes de arquivo. Uma hora agendada ainda no futuro é mantida.
- Para um **lote de agente** que terminou com algumas imagens falhando, o botão é **Refazer N imagem(ns) que falhou**: refaz só essas, com os números certos.
- O Flow já tenta de novo, uma vez, sozinho, antes de a tarefa falhar. Isso é grátis.
- **Cuidado com "Tentar de novo" depois de um erro de tempo esgotado ou de reinício.** O Flow pode ter terminado e cobrado. Veja a Biblioteca antes.
- Se uma tarefa nunca aparece (o estúdio perdeu o registro), `flow_wait` avisa com "unknown_ids": confira `flow_assets` antes de colocar de novo.

### Limpar

O botão **Limpar cancelados e com erro** tira da lista as tarefas canceladas e as que deram erro. **Os arquivos já salvos continuam no Mac.** (Pelo assistente, não existe `flow_clear`; só pela API: `POST /api/clear`.) Para limpar também as prontas, use a API com `statuses`.

### Usar como exemplo do prompt

Numa tarefa pronta que veio de um prompt da biblioteca, aparece o botão **Usar como exemplo do prompt**. Ele define o primeiro arquivo da tarefa como o exemplo daquele prompt na aba Prompts. Se o prompt ainda não tinha exemplo, isso já acontece sozinho.

### Galeria (abaixo do Monitor)

Mostra os arquivos salvos da pasta escolhida no menu ("pasta · quantidade de arquivos"), com filtros **Tudo**, **Vídeos**, **Imagens**, **Áudio**. O filtro padrão acompanha a aba. O caminho da pasta aparece embaixo. Clique num arquivo para abrir grande. O botão **Lixeira** manda a pasta inteira para a lixeira do Mac, com confirmação. Nas abas Voz, Biblioteca, Prompts e Pesquisa a Galeria some.

---

## 7. Para agentes de IA

Esta seção é para Claude, Codex, Antigravity e outros assistentes.

### Antes de qualquer coisa

1. Leia o [AGENTS.md](</Users/erickfonseca/Documents/EFS Studio/UGC/AGENTS.md>): contas, custos e regras de criação do Erick. Ele vale mais que qualquer padrão deste manual.
2. Chame `flow_status` primeiro. Se vier `hint`, repasse ao Erick e pare. A resposta traz também o `playbook` (roteiro de como montar prompts), `capabilities`, `awake`, `next_start`, `avoid_accounts` e a lista de tarefas.

### Regras principais

1. **Nunca gere antes do OK do Erick.** Nas falas, espere o "play" dele (regra do AGENTS.md). Diga o total de créditos esperado **antes** de colocar na fila algo que gasta.
2. **Sempre use `max_credits`**, no limite do custo esperado. O padrão é 25.
3. **Reconecte o MCP do Flow antes de usar `start_at`.** Processo antigo ignora a hora e começa na hora. Confira `capabilities` e **confira `starts_at` na resposta**.
4. **Uma tomada por vídeo.** Nunca gere o mesmo vídeo de novo. Perdeu o arquivo? `flow_assets` e `flow_download` (grátis) em vez de gerar outra vez. Um id de tarefa desconhecido **não** significa que terminou.
5. **Não troque de conta/projeto com algo gerando.** `flow_open_project` recusa se houver geração rodando.
6. **Nunca use uma conta da lista `avoid_accounts`.** O estúdio também recusa.
7. **`flow_edit` e `flow_continue` não têm cotação**: exigem `acknowledge_cost: true`, e você deve perguntar ao Erick antes.
8. **`flow_trash`**: confirme com o Erick antes (o Flow não pergunta). Não apaga de vez.
9. **Chaves não vão em chat.** O `set_key` (chave do Google AI Studio) existe só no painel e na API, de propósito: não é uma ferramenta MCP.
10. **Nenhuma chamada espera mais de ~45 s.** Se vier `still_working: true` com um `task_id`, passe o `task_id` para `flow_wait` e **não repita a chamada**. `flow_wait` volta em até ~40 s: chame de novo até `finished: true`.
11. Não reinicie o estúdio com fila ativa. Na volta, as tarefas na fila e as agendadas continuam (vêm do `queue.json`), mas a que estava rodando vira "falhou" e pode já ter sido cobrada; o que passou de 30 minutos da hora vira "cancelado".
12. Escreva prompts de vídeo em inglês, uma ação e um movimento de câmera por cena. O `playbook` do `flow_status` detalha.
13. Ao mudar arquivos de repositórios do Erick, siga a regra de changelog do `~/.claude/CLAUDE.md`. (O `~/flow-mcp` não tem `CHANGELOG.md` hoje.)

### Ferramentas MCP

São 25 ferramentas. Todas começam com `flow_`.

| Ferramenta | Em uma linha |
|---|---|
| `flow_status` | Estado da sessão do Flow (logado, projeto, plano, créditos), fila, pausas, contas proibidas e o roteiro de prompts. |
| `flow_generate` | Põe cenas na fila: um vídeo ou imagem por cena, até 100. |
| `flow_wait` | Espera tarefas (ou um `task_id` lento) e devolve resultados e caminhos de arquivos. |
| `flow_cancel` | Cancela uma tarefa que ainda não começou. |
| `flow_retry` | Recoloca tarefas que falharam, com as mesmas configurações. |
| `flow_assets` | Lista imagens e vídeos soltos no projeto aberto (`asset:<título>`). |
| `flow_download` | Baixa mídia que já existe, de graça, inclusive 1080p/2K. Uma cena baixa como um filme só. |
| `flow_agent_images` | Lote rápido de até 50 imagens pelo modo Agente do Flow, 0 crédito. |
| `flow_edit` | Edita um clipe existente (relight, clima, remover objeto). Sem cotação, uns 20 créditos para 4 s. |
| `flow_continue` | Continua um clipe a partir do último quadro, com personagem ou avatar anexado. Sem cotação. |
| `flow_collection` | Move imagens/vídeos soltos para uma coleção do Flow, opcionalmente renomeando (`"Cenários/Fazenda"` cria os níveis). |
| `flow_trash` | Move um item para a lixeira do Flow (título exato). Recuperável. |
| `flow_character` | Cria personagem por descrição ou imagem. Grátis. |
| `flow_character_edit` | Muda o visual de um personagem no lugar. Grátis. |
| `flow_characters` | Lista os personagens do projeto. |
| `flow_accounts` | Lista as contas logadas e os projetos; com `credits: true`, saldo, plano e renovação. |
| `flow_open_project` | Troca a conta e o projeto da janela do Flow. |
| `flow_new_project` | Cria um projeto novo e vazio e o abre. |
| `flow_techniques` | Lista as 39 frases prontas de câmera, produto, transição e comandos de imagem. |
| `flow_narrate` | Grava narração em `.m4a`, grátis (Kokoro ou Google). |
| `flow_voices` | Lista as vozes e se o modelo do Kokoro e a chave do Google estão prontos. |
| `flow_assemble` | Junta clipes em um MP4, com música, narração e muitos ajustes. |
| `flow_transcribe` | Escuta um vídeo ou áudio e devolve as palavras com início e fim. Grátis, local. |
| `flow_captions` | Queima legendas no vídeo. Antes, chame `flow_transcribe`, mostre as palavras, corrija e passe-as em `text`. |
| `flow_presenter` | Monta um explicativo a partir da gravação de um apresentador falando, em tela cheia ou em círculo no canto. |

### Opções principais de uma cena (`flow_generate`)

| Opção | O que faz |
|---|---|
| `prompt` | Obrigatório. |
| `type` | `video` (padrão) ou `image`. |
| `model` | Nome como no Flow: `Omni 1.1 Flash`, `Veo 3.1 - Fast`, `Nano Banana Pro`... Imagem sem modelo = Nano Banana mais novo. |
| `aspect_ratio` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4` (vídeo só os dois primeiros). |
| `duration` | 4, 6, 8 ou 10 s. Só Omni. |
| `resolution` | `360p` ou `720p`. Só Omni. |
| `max_credits` | Padrão 25. Cena pulada se o Flow cobrar mais. |
| `variants` | 1 a 4 saídas por prompt. Cada uma gasta. |
| `first_frame` / `last_frame` | Caminho de imagem, `asset:<título>`, ou caminho de um `.mp4` (começa exatamente no último quadro dele; o `last_frame` termina onde o clipe começa). |
| `first_frame_at` | Com um clipe como `first_frame`: começa no quadro deste segundo, não no último. |
| `reference_images` | Até 3. **Quadros ou referências, nunca os dois na mesma cena.** |
| `chain_previous` | Começa no último quadro da cena anterior da mesma chamada. Não vale na primeira cena nem junto com `first_frame`. |
| `reference_previous` | Usa a imagem da cena anterior como referência extra (mantém um conjunto de imagens no mesmo estilo). |
| `download_quality` | `original` ou `upscaled` (1080p/2K, grátis, mais lento). |
| `retries` | 0 a 3. Tentativas automáticas quando o Flow acusa falha. Padrão 1. |
| `technique` | Id de `flow_techniques`. A frase é acrescentada ao prompt. |
| `on_screen_text` | `true` se quer palavras na imagem. Padrão: o estúdio proíbe texto na tela. |
| `outfit` | Roupa do personagem nesta cena, quando difere do visual salvo. |
| `collection` | Coleção onde gerar (`"Dumps/Noite em SP"`). |

Fora das cenas: `project` (pasta no Mac), `start_at`, `open_project`. `flow_generate` e `flow_agent_images` **recusam campos desconhecidos**. A resposta traz `jobs` com os números das tarefas e, se agendado, `starts_at`, `starts_local` e `starts_in`.

### API HTTP

O painel usa a mesma porta que você pode usar sem MCP.

- Endereço: `http://127.0.0.1:8787`. Só aceita o próprio Mac e só os nomes `127.0.0.1` e `localhost`.
- Chamar um método: `POST /api/<método>` com corpo JSON e o cabeçalho `x-flow-token`.
- O token fica em `~/.flow-mcp/token` e **muda toda vez que o estúdio liga**. Leia do arquivo na hora de usar. Nunca copie o valor para um documento, um log ou um chat.
- `GET /api/health` responde `{"name":"flow-mcp"}` sem token, para saber se está no ar.
- Corpo de até 1 MB. Erros voltam como `{ "error": "..." }` com código 400 (ou 401 sem token certo).

Exemplo, só para ler o estado (não gasta nada):

```bash
curl -s -X POST http://127.0.0.1:8787/api/status \
  -H "x-flow-token: $(cat ~/.flow-mcp/token)" \
  -H "content-type: application/json" \
  -d '{"detailed": false}'
```

Métodos da API (o que cada um faz, com o nome da ferramenta MCP quando existe):

| Método | Ferramenta MCP | Observação |
|---|---|---|
| `status` | `flow_status` | |
| `generate` | `flow_generate` | |
| `wait` | `flow_wait` | |
| `cancel` | `flow_cancel` | |
| `retry` | `flow_retry` | |
| `assets` | `flow_assets` | |
| `download` | `flow_download` | |
| `agent` | `flow_agent_images` | |
| `edit` | `flow_edit` | |
| `continue_shot` | `flow_continue` | |
| `collect` | `flow_collection` | |
| `trash` | `flow_trash` | |
| `character`, `character_edit`, `characters` | `flow_character`, `flow_character_edit`, `flow_characters` | |
| `accounts`, `open_project`, `new_project` | `flow_accounts`, `flow_open_project`, `flow_new_project` | |
| `techniques` | `flow_techniques` | |
| `narrate`, `voices` | `flow_narrate`, `flow_voices` | |
| `assemble` | `flow_assemble` | |
| `transcribe`, `captions` | `flow_transcribe`, `flow_captions` | |
| `presenter` | `flow_presenter` | |
| `clear` | — | Tira cancelados e com erro da lista (`statuses` opcional: `cancelled`, `failed`, `done`). |
| `discard` | — | Move um arquivo ou pasta de `~/flow-mcp-out` para a lixeira do Mac. Recusa qualquer outro caminho. |
| `outputs` | — | Lista tudo o que já foi salvo, projeto por projeto. |
| `set_key` | — | Salva a chave do Google AI Studio. Só painel e API. |
| `caption_setup`, `caption_preview` | — | Conferência do whisper.cpp e prévia de um quadro com legenda. |

Outras rotas: `POST /api/upload?name=<arquivo>` (envia um arquivo de até 200 MB para `~/.flow-mcp/uploads` e devolve o caminho), `GET /media?path=<arquivo>&token=<token>` (serve arquivos de `~/flow-mcp-out`, dos uploads e das legendas), `/api/prompts` e `/api/prompts/{favorite,count,save,delete,example}` (biblioteca de prompts), `/api/research/{status,load,run}` (pesquisa).

Observação: `POST /api/collect` é o nome da API para a ferramenta `flow_collection`. Um assistente que ainda não recarregou o MCP pode chamar a API direto enquanto isso.

### Em caso de dúvida

Não adivinhe. Pergunte ao Erick. Diga o que foi feito, o que falta e o que não foi conferido, em português simples e sem jargão.

---

## 8. Problemas comuns e soluções

| O que você vê | Causa provável | O que fazer |
|---|---|---|
| Erro "waiting for getByRole('button', { name: 'Agent' })" (ou outro botão não achado) | O Flow está em português. O estúdio procura os botões pelos nomes em inglês. | Abra o projeto com `?hl=en` no final do endereço (por exemplo `https://flow.google.com/u/1/project/<id>?hl=en`). O código já acrescenta isso e abre o Chrome em inglês, mas o Flow pode voltar ao português depois de um reinício. Isso nunca muda o idioma da sua conta. |
| "fetch failed" / pílula "Servidor desligado" | O estúdio (a porta 8787) não está rodando. | Chame qualquer ferramenta `flow_*` (ele liga sozinho) ou dê dois cliques em **Flow Studio.command**. Veja o motivo da queda em `/tmp/flow-studio.log`. A fila gravada volta (veja a seção 5); o que estava rodando vira "falhou". |
| "You've reached your usage limit" na imagem | O Nano Banana Pro tem limite diário de imagens por conta. | Use a outra conta PRO, ou o Nano Banana 2.1 (limite separado). Está no AGENTS.md. |
| "Flow's tile menu has no Download item. It offered: ..." | O estúdio abriu o menu da mídia e não achou "Download". Na prática costuma ser uma mídia que o Flow recusou ou que falhou. | Olhe a mídia no Flow. Em 14/11 a mensagem lá era "You've reached your usage limit": o limite diário de imagens do Nano Banana Pro daquela conta acabou. Nesse caso, use a outra conta PRO ou espere o dia seguinte. Se a mensagem falar de política de conteúdo, mude o prompt. |
| "Flow's tile menu did not open." | O menu da mídia não abriu a tempo. | Tente de novo (Biblioteca → baixar). |
| Imagem falha em conta gratuita ("failed tiles", botão Agent sumido) | Contas gratuitas não geram imagem de forma confiável. | Gere imagens só nas contas PRO (regra do Erick). Vídeo nas gratuitas. |
| "Flow refused this generation on policy grounds" | Política do Flow (rosto de pessoa famosa, certas partes do corpo, etc.). Nada foi cobrado. | Reescrever o mesmo prompt não ajuda. Mude o conteúdo. Se for rosto: crie o personagem por descrição, não por foto. |
| "Flow failed this generation N time(s)... Nothing was charged." | O servidor do Flow estava ocupado ou a geração falhou. | Tente de novo mais tarde ou mude o prompt. |
| "Timed out after Ns waiting for Flow to finish." | O Flow demorou demais. **Pode ter gerado e cobrado.** | Olhe a Biblioteca ou `flow_assets` antes de qualquer nova tentativa. |
| Vídeo gerado mas sem arquivo | O download falhou. O clipe está no Flow. | **Biblioteca → Baixar** (grátis). Nunca gere de novo. |
| "A generation is running in the Flow tab. Wait for it to finish..." | Você pediu algo que usa a janela do Flow (ler contas, biblioteca, lixeira, trocar projeto) com uma geração rodando. | Espere terminar. |
| "Espere a fila terminar antes de trocar de projeto" | O painel recusa trocar com a fila ativa. | Espere, ou cancele o que ainda não começou. |
| "Account /u/N/ is on the do-not-use list..." | A conta está em `avoid_accounts`. | Escolha um projeto de outra conta. |
| Pílula "Lista de contas proibidas ilegível" | O `~/.flow-mcp/config.json` tem erro. | Conserte o arquivo (por exemplo `{"avoid_accounts": [4]}`). |
| Pílula "A fila não está sendo salva" | O `queue.json` não pôde ser escrito (disco cheio, permissão). | Libere espaço ou corrija a permissão. Até lá, uma queda perde a fila. |
| "Not started: the queue file could not be written..." | O estúdio se recusa a começar um trabalho que um reinício poderia rodar duas vezes. | Mesmo conserto acima. Nada foi gerado. |
| Cena de vídeo "pulada" sem gastar | O Flow cobrou mais que o `max_credits`. | Suba o limite da cena, se o custo valer. |
| Agendado rodou na hora | O assistente usava um MCP antigo que ignora `start_at`. | Reconecte o MCP e confira `starts_at` **antes** de agendar. |
| Agendado não rodou | O Mac dormiu, o estúdio caiu, ou passou de 30 minutos da hora. | Veja "Cancelado: perdeu a hora..." no Monitor e **Tentar de novo**. Deixe o Mac na tomada, tampa aberta. |
| Legenda inventada ou palavra errada | O whisper entendeu mal (nome próprio, música alta, fala emendada). | Corrija o texto na caixa "As palavras" antes de gerar. Confirme o **idioma falado**. |
| "Captions need whisper.cpp to hear the words" | O whisper.cpp não está instalado. | Siga o comando no aviso amarelo "Configuração única" e clique **Já instalei, conferir de novo**. |
| "ffmpeg is not installed" | Falta o ffmpeg (Montagem, Legendas, voz Kokoro). | Instale (no Mac: `brew install ffmpeg`). |
| Primeira narração ou legenda demora minutos | Baixa o modelo uma vez (Kokoro 326 MB; fala inglês 148 MB; outros idiomas 574 MB). | Espere. Só acontece na primeira vez. |
| Narração do Google não funciona | Falta a chave do Google AI Studio, ou o limite diário acabou. | Salve a chave na aba Voz. Se o limite acabou, o estúdio grava com o Kokoro e avisa. |
| Pesquisa: "Sem a chave do Apify..." | Nenhuma chave no `.env`. | Coloque a chave no `~/flow-mcp/.env` (nunca em chat), ou peça a busca ao Claude. |
| Pesquisa: "Nenhuma conta do Apify conseguiu fazer a busca" | Todas as contas recusaram (sem saldo, limite do mês, chave recusada). | Confira o saldo no próprio Apify. |
| Aba Prompts ou Pesquisa diz "Esta parte é nova: reinicie o estúdio para ativar" | O estúdio rodando é de uma versão anterior. | Com a fila vazia, feche e abra o Flow Studio. |
| Cancelei, mas continua "gerando" | **Cancelar só vale para o que ainda não começou.** | Espere terminar. Reiniciar não cancela: a tarefa que estava rodando só volta como "falhou", possivelmente já cobrada. |
| Mac: `EPERM: operation not permitted` | O programa está numa pasta protegida (Desktop, Documentos, Downloads). | Deixe o `flow-mcp` na pasta pessoal (`~/flow-mcp`). |
| "Not signed in" / "no project open" | Sem login ou sem projeto no Chrome do Flow. | `npm run login`, entre no Google, abra um projeto e deixe a janela aberta. |
| Tudo dá tempo esgotado | A janela do Chrome do Flow foi fechada, ou o Mac dormiu. | Reabra com `npm run login`. |

---

## 9. Onde ficam os arquivos

| O quê | Onde |
|---|---|
| **O programa** | `~/flow-mcp` (não coloque em Desktop, Documentos ou Downloads). |
| **Vídeos, imagens e áudios gerados** | `~/flow-mcp-out/<projeto>/`. Cenas: `scene-NN`; retoques: `edit-NN`; continuações: `shot-NN`; downloads da Biblioteca: `clip-NN`; narrações: `narration-NN.m4a`; filme montado: `final.mp4`; legendado: `<nome>-captions.mp4` + `.srt`. |
| **Retratos dos personagens** | `~/flow-mcp-out/_cast/` |
| **Buscas da aba Pesquisa** | `~/flow-mcp-out/pesquisas/` |
| **Biblioteca de prompts** | `~/flow-mcp/prompts/library.json` (gerada) e `~/flow-mcp/prompts/meus.json` (seus dados) |
| **Chaves do Apify** | `~/flow-mcp/.env` (você escreve; nunca no git nem em documento) |
| **Fila e agendamentos** | `~/.flow-mcp/queue.json` (e `queue.lock`, que diz qual estúdio é o dono) |
| **Contas proibidas** | `~/.flow-mcp/config.json` |
| **Token da API** | `~/.flow-mcp/token` (muda a cada início; não copie) |
| **Chave do Google AI Studio** | `~/.flow-mcp/gemini-key` (guardada pelo painel) |
| **Chrome do estúdio (logins)** | `~/.flow-mcp/chrome-profile` |
| **Modelos de fala (whisper) e Kokoro** | `~/.flow-mcp/models` |
| **Arquivos enviados pelo painel** | `~/.flow-mcp/uploads` |
| **Cache das legendas** | `~/.flow-mcp/captions` |
| **Log do estúdio** | `/tmp/flow-studio.log` (o programa só acrescenta; o macOS apaga o `/tmp` quando o Mac é reiniciado, então o log some depois de um reinício) |

Documentos do projeto:
- `~/flow-mcp/README.md`, `GETTING-STARTED.md`, `OVERVIEW.md`: instalação e visão geral, em inglês. Algumas partes estão **desatualizadas**: falam em 8 abas com nomes em inglês (Cast, Frames, Shots, Voice, Restyle, Cut, Captions, Library), não citam Prompts e Pesquisa, agendamento, o reinício automático, o `config.json` nem as contas proibidas. **Este manual vale mais.**
- `~/flow-mcp/CLAUDE.md`: notas técnicas para agentes que mexem no código.
- [AGENTS.md da pasta UGC](</Users/erickfonseca/Documents/EFS Studio/UGC/AGENTS.md>): as regras do Erick.
