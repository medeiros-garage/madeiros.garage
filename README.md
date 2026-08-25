# Medeiros Garage — landing page de socorro mecânico 24h

Landing de **tela única** (não rola), feita para receber tráfego de Google Ads
(Rede de Pesquisa, mobile). O único objetivo da página é o clique no WhatsApp.

- HTML + CSS + JavaScript puros. **Sem** frameworks, sem bibliotecas, sem build.
- **Zero requisições externas**: fontes do sistema, ícones em SVG inline.
- Peso: HTML + CSS + JS ≈ **37 KB**; logo em WebP ≈ 25 KB.
- Para publicar, suba **todo o conteúdo desta pasta** para a raiz do domínio
  (o `index.html` tem que ficar na raiz, não dentro de uma subpasta).
  Para testar no computador, dê duplo clique em `index.html`.

## Estrutura

```
index.html            página inteira (textos, SEO, JSON-LD, ícones SVG)
robots.txt            libera a indexação + aponta o sitemap
sitemap.xml           a única URL do site
assets/css/style.css  todo o visual
assets/js/main.js     carrossel, autoplay, links de WhatsApp e conversão do Ads
assets/img/           logo (WebP + PNG) e favicon
README.md             este arquivo
```

---

## 1. Trocar o número de WhatsApp

O número fica em **um lugar só**: o atributo `data-whatsapp` do `<body>`, em `index.html`.

```html
<body data-whatsapp="5511997699947" data-msg="Olá! Preciso de socorro mecânico 24h.">
```

- `data-whatsapp` — número com código do país e DDD, **só dígitos** (55 + 11 + número).
- `data-msg` — mensagem que já vem digitada quando o cliente abre o WhatsApp.

O `main.js` reescreve automaticamente os três botões (flutuante, barra inferior e CTA do card 4)
a partir desses dois atributos.

Depois de trocar, atualize também estes três pontos, que existem para funcionar **sem JavaScript**
e para o Google entender o telefone (busque por `997699947` no `index.html`):

1. o `href` de cada um dos três links (`data-wa="flutuante"`, `"barra"`, `"card4"`);
2. o campo `"telephone"` dentro do bloco `<script type="application/ld+json">`;
3. os links dentro do `<noscript>`, no fim da página.

## 2. Editar os textos dos cards

Tudo está em `index.html`, dentro de `<div class="track">`. São 4 `<article class="slide">`:

| Card | O que é | Onde mexer |
|------|---------|-----------|
| 1 | Título principal | `<h1>` e `<p class="lead">` |
| 2 | Lista de serviços | `<ul class="lista">` do slide 2 |
| 3 | Diferenciais | `<ul class="lista">` do slide 3 |
| 4 | Depoimentos + CTA | `<blockquote class="depo">` e `<a class="cta">` |

Regras práticas:

- A palavra em vermelho com brilho é o `<span class="destaque">`. Pode mover para outra
  palavra — use **uma** por título.
- **Há um único `<h1>` na página** (card 1). Os outros cards usam `<h2>`. Não troque isso:
  é o que o Google espera.
- Para adicionar um item na lista, copie uma linha `<li>` inteira e troque o texto.
  O ícone é o `<use href="#i-...">` — os disponíveis são `i-guincho`, `i-bateria`,
  `i-combustivel`, `i-pneu`, `i-chave`, `i-transporte` e `i-check`.
- Se acrescentar muito texto, o conteúdo do card passa a rolar **dentro do card**
  (a página continua sem rolar). Em telas pequenas, prefira frases curtas.
- Ao mudar os textos, atualize também o bloco `<noscript>` no fim do `index.html`,
  que repete o conteúdo para buscadores e para quem está com JavaScript bloqueado.

## 3. Substituir os depoimentos (obrigatório antes de publicar)

O card 4 vem com **placeholders**:

```html
<blockquote class="depo">
  <p>“[Inserir avaliação real do Google Meu Negócio]”</p>
  <cite>— [Nome do cliente]</cite>
</blockquote>
```

Substitua pelo texto **real** de avaliações do perfil do Google Meu Negócio e pelo primeiro
nome do cliente. Se ainda não houver avaliações, **apague os dois blocos** e deixe só o botão
CTA — é melhor não ter prova social do que ter prova social inventada.

> Depoimentos fabricados apresentados como reais violam as políticas de publicidade do Google Ads
> (que pode reprovar os anúncios ou suspender a conta) e configuram publicidade enganosa
> perante o Código de Defesa do Consumidor.

## 4. Tags do Google Ads

Há três marcações no código, todas comentadas, esperando os IDs reais:

**a) Google tag (gtag.js)** — `index.html`, no `<head>`, no bloco
`GOOGLE ADS / ANALYTICS — COLE AS TAGS AQUI`. Descomente e troque `AW-XXXXXXXXX`
pelo ID da sua conta:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXX');
</script>
```

**b) Google Tag Manager (opcional)** — cole o `<script>` do GTM no mesmo bloco do `<head>`
e o `<noscript>` correspondente logo depois do `<body>`, onde está o comentário
`GOOGLE TAG MANAGER (noscript) — COLE AQUI`.

**c) Rótulo da conversão** — `assets/js/main.js`, no topo do arquivo:

```js
var CONVERSAO_ADS = 'AW-XXXXXXXXX/XXXXXXXX';
```

Troque pelo par que o Google Ads mostra na tela da ação de conversão
(ID da conta `/` rótulo). É o único lugar do JS que precisa ser editado.

### O que já está pronto na medição

Todo clique em qualquer um dos três botões de WhatsApp dispara, sem travar a abertura do link:

- `gtag('event', 'conversion', { send_to: CONVERSAO_ADS, event_label: origem })` — se o gtag existir;
- `dataLayer.push({ event: 'whatsapp_click', origem: origem })` — se o GTM existir.

`origem` diz **qual botão** foi clicado: `flutuante`, `barra` ou `card4`. A mesma informação vai
na URL como `utm_content`, então dá para comparar no relatório qual ponto converte mais.

## 5. Antes de publicar — checklist

- [ ] Trocar `SEUDOMINIO.com.br` pelo domínio real em: `index.html` (canonical, Open Graph,
      Twitter, JSON-LD), `robots.txt` e `sitemap.xml`.
- [ ] Preencher `address` e `geo` no JSON-LD (há um bloco comentado pronto, logo abaixo do script)
      e listar Instagram / perfil do Google em `sameAs`.
- [ ] Substituir os depoimentos placeholder (item 3).
- [ ] Colar as tags do Google Ads e o rótulo de conversão (item 4).
- [ ] Conferir o número de WhatsApp nos quatro lugares (item 1).
- [ ] Atualizar `<lastmod>` no `sitemap.xml`.
- [ ] Opcional: trocar a `og:image` por uma imagem 1200×630 (hoje aponta para o logo).

## 6. Ajustes finos

**Cores, alturas e espaçamentos** — todos são variáveis no topo de `assets/css/style.css`:

```css
--bg  --surface  --red  --wa-green  --wa-bar     /* cores */
--h-header  --h-bar  --h-dots  --gap-side  --fab /* medidas */
```

**Comportamento do carrossel** — constantes no topo de `assets/js/main.js`:

| Constante | Padrão | O que faz |
|---|---|---|
| `LIMIAR_ARRASTE` | `0.20` | fração da largura da tela para trocar de slide |
| `VEL_FLICK` | `0.40` | px/ms: acima disso um "peteleco" já troca de slide |
| `RESISTENCIA` | `0.35` | elasticidade no primeiro e no último slide |
| `EIXO_MINIMO` | `6` | px antes de decidir se o gesto é horizontal ou vertical |
| `DEBOUNCE_MS` | `120` | espera para recalcular no resize / rotação |

Além do arraste, o carrossel funciona por clique nos pontinhos e pelas setas ← → do teclado.
**No gesto ele não é circular**: no primeiro slide não volta e no último não avança — puxar além
disso só dá o efeito elástico e volta.

**Autoplay** — o carrossel também anda sozinho. As duas constantes ficam no mesmo bloco, no topo
de `assets/js/main.js`:

| Constante | Padrão | O que faz |
|---|---|---|
| `AUTOPLAY_MS` | `7000` | tempo parado em **cada** card, inclusive o card 4 antes de voltar para o 1 |
| `REWIND_MS` | `550` | duração da animação da volta 4→1 (são 3 larguras de tela; com os .38s normais viraria um borrão) |

Como funciona na prática:

- **Para desligar o autoplay, ponha `AUTOPLAY_MS = 0`.** O carrossel continua inteiro no arraste,
  nos pontinhos e nas setas.
- A volta do card 4 para o card 1 é o **único** ponto em que o carrossel dá a volta. O gesto do
  usuário continua não circular.
- Qualquer ação do usuário (arrastar — mesmo que o card volte sem trocar —, clicar num pontinho ou
  usar as setas) **zera o contador**: o card seguinte só entra depois dos 7 s cheios. Nada de o
  card pular sozinho logo depois de um deslize.
- Com o dedo na tela o tempo não corre, e com a aba em segundo plano o contador para
  (o usuário troca de app, volta e continua no mesmo card).
- Quem tem **"reduzir movimento"** ligado no sistema não recebe troca automática nenhuma —
  só o carrossel manual.

**Trocar o logo** — substitua os arquivos em `assets/img/`, mantendo os nomes
(`logo-medeiros-garage.webp`, `.png` e `favicon.png`) e o fundo transparente. Se mudar a
proporção, ajuste `width` e `height` do `<img class="logo">` no `index.html` (hoje 220×228)
e a altura visível em `.logo { height: 72px }` no CSS.

## 7. Testes já realizados

- Layout conferido em 320×568, 360×640, 375×667, 390×693, 414×736 e 430×780:
  nenhum texto cortado, nenhuma rolagem de página.
- Carrossel testado do slide 1 ao 4 e de volta: arraste, elástico nas bordas, snap back,
  peteleco, pontinhos, setas do teclado e gesto vertical ignorado.
- Autoplay medido em Chrome real: 7 s em cada card, volta 4→1 em 550 ms, contador zerado por
  gesto / pontinho / seta, parado com o dedo na tela e com a aba oculta, desligado sob
  "reduzir movimento" e sem avanço duplo depois de uma rajada de interações.
- Swipe verificado com **toque emulado** (device toolbar), incluindo o caso crítico de encostar
  o dedo no meio da transição automática: sem tranco (salto de 0,0 px) e o gesto vale a partir do
  card que está na tela.
- Console do navegador sem erros. Três requisições no total (CSS, JS e logo).
