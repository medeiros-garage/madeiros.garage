/* =========================================================================
   Medeiros Garage — JavaScript da landing (vanilla ES6+, zero dependências)

   Faz três coisas:
   1. Carrossel de 4 slides controlado por gesto (Pointer Events) + autoplay.
   2. Monta os links de WhatsApp a partir de UM único número.
   3. Dispara o evento de conversão do Google Ads no clique.
   ========================================================================= */
(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     CONSTANTES DE AJUSTE — mexa aqui para calibrar o comportamento
     --------------------------------------------------------------------- */
  var LIMIAR_ARRASTE = 0.20;   // fração da largura da tela para trocar de slide
  var VEL_FLICK      = 0.40;   // px/ms: acima disso, troca de slide mesmo em arraste curto
  var RESISTENCIA    = 0.35;   // elasticidade nas bordas (35% do movimento)
  var EIXO_MINIMO    = 8;      // px acumulados antes de travar o eixo horizontal x vertical
  var DEBOUNCE_MS    = 120;    // espera do resize/orientationchange
  var CLIQUE_MIN     = 8;      // px de arraste que já cancelam o clique acidental

  // Autoplay (camada de tempo por cima do gesto; ver README)
  var AUTOPLAY_MS = 7000;      // tempo em CADA card, inclusive o último; 0 desliga o autoplay
  var REWIND_MS   = 550;       // duração da volta do card 4 ao card 1

  // Google Ads: troque pelo par "AW-XXXXXXXXX/RÓTULO" da sua ação de conversão.
  var CONVERSAO_ADS  = 'AW-XXXXXXXXX/XXXXXXXX';

  // UTMs fixas dos links (o utm_content muda por origem do clique)
  var UTM_BASE       = 'utm_source=google&utm_medium=cpc&utm_content=';

  /* -----------------------------------------------------------------------
     1. CARROSSEL
     --------------------------------------------------------------------- */
  function Carrossel(raiz) {
    this.raiz    = raiz;
    this.viewport = raiz.querySelector('.viewport');
    this.track   = raiz.querySelector('.track');
    this.slides  = Array.prototype.slice.call(raiz.querySelectorAll('.slide'));
    this.dots    = Array.prototype.slice.call(document.querySelectorAll('.dot'));
    this.indice  = 0;
    this.largura = 0;

    // estado do gesto
    this.arrastando = false;
    this.eixoDefinido = false;
    this.horizontal = false;
    this.x0 = 0; this.y0 = 0;
    this.dx = 0;
    this.ultimoX = 0; this.ultimoT = 0; this.velocidade = 0;
    this.pointerId = null;
    this.houveArraste = false;
    this.base = 0;      // posição REAL de onde o arraste partiu (px)
    this.offset = 0;    // último transform aplicado (px)

    // autoplay: um único setTimeout, sempre reagendado (nunca setInterval)
    this.timerAuto = null;
    this.mqMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.autoplayLigado = (AUTOPLAY_MS > 0 && !this.mqMovimento.matches);

    this.iniciar();
  }

  Carrossel.prototype.iniciar = function () {
    var self = this;

    this.medir();
    this.aplicar(0, false);
    this.sincronizar();

    // --- gesto (Pointer Events cobre toque, caneta e mouse) ---
    // Os listeners ficam no .viewport, não no .track: durante uma transição o toque
    // pode cair sobre um slide `inert` (fora do hit-test) e o alvo vira o .viewport,
    // que é PAI do track — no track o evento simplesmente não chegaria.
    this.viewport.addEventListener('pointerdown', function (e) { self.aoDescer(e); });
    this.viewport.addEventListener('pointermove', function (e) { self.aoMover(e); }, { passive: false });
    this.viewport.addEventListener('pointerup', function (e) { self.aoSubir(e); });
    this.viewport.addEventListener('pointercancel', function () { self.aoCancelar(); });

    // arrastar não pode virar clique no link do card 4
    this.viewport.addEventListener('click', function (e) {
      if (self.houveArraste) {
        e.preventDefault();
        e.stopPropagation();
        self.houveArraste = false;
      }
    }, true);

    // imagens/links não podem "sair" arrastando
    this.viewport.addEventListener('dragstart', function (e) { e.preventDefault(); });

    // --- dots ---
    this.dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        self.irPara(parseInt(dot.dataset.go, 10), true);
      });
    });

    // --- teclado (acessibilidade) ---
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { self.irPara(self.indice + 1, true); }
      else if (e.key === 'ArrowLeft') { self.irPara(self.indice - 1, true); }
    });

    // --- resize / rotação, com debounce ---
    var timer = null;
    function recalcular() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        self.medir();
        self.aplicar(-self.indice * self.largura, false);
      }, DEBOUNCE_MS);
    }
    window.addEventListener('resize', recalcular);
    window.addEventListener('orientationchange', recalcular);

    // solta o will-change quando a animação termina (economiza memória de GPU)
    // e devolve a duração normal, caso a volta do card 4 tenha usado REWIND_MS
    this.track.addEventListener('transitionend', function (e) {
      if (self.arrastando || e.propertyName !== 'transform') { return; }
      self.track.classList.remove('is-arrastando');
      self.track.style.transitionDuration = '';
    });

    // --- autoplay: aba em segundo plano não conta tempo ---
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { self.stopTimer(); } else { self.resetTimer(); }
    });

    // quem liga "reduzir movimento" no sistema não recebe troca automática
    var aoMudarPreferencia = function (e) {
      self.autoplayLigado = (AUTOPLAY_MS > 0 && !e.matches);
      if (self.autoplayLigado) { self.resetTimer(); } else { self.stopTimer(); }
    };
    if (this.mqMovimento.addEventListener) {
      this.mqMovimento.addEventListener('change', aoMudarPreferencia);
    } else if (this.mqMovimento.addListener) {
      this.mqMovimento.addListener(aoMudarPreferencia); // Safari antigo
    }

    this.resetTimer(); // começa a contar assim que a página carrega
  };

  /* ---------------- autoplay ---------------- */

  /** Só limpa o timeout pendente. */
  Carrossel.prototype.stopTimer = function () {
    clearTimeout(this.timerAuto);
    this.timerAuto = null;
  };

  /**
   * Limpa e reagenda do zero. É chamado no fim de TODA mudança de índice
   * (automática ou do usuário), então nenhum gesto herda o tempo do timer anterior.
   */
  Carrossel.prototype.resetTimer = function () {
    this.stopTimer();
    if (!this.autoplayLigado || document.hidden || this.arrastando) { return; }

    var self = this;
    this.timerAuto = setTimeout(function () { self.avancarAuto(); }, AUTOPLAY_MS);
  };

  /** Avanço do relógio: 1→2→3→4 e, só aqui, a volta 4→1. */
  Carrossel.prototype.avancarAuto = function () {
    if (this.indice === this.slides.length - 1) {
      // são 3 larguras de deslocamento: com os .38s normais viraria um borrão.
      // O inline sobrepõe o var(--dur) e o transitionend devolve o padrão.
      this.track.style.transitionDuration = REWIND_MS + 'ms';
      this.irPara(0, true, true);
    } else {
      this.irPara(this.indice + 1, true, true);
    }
  };

  /** Largura de um slide = largura da janela do carrossel. */
  Carrossel.prototype.medir = function () {
    this.largura = this.viewport.getBoundingClientRect().width;
  };

  /** Move o track. `animar` liga/desliga a transição CSS de encaixe. */
  Carrossel.prototype.aplicar = function (x, animar) {
    this.offset = x;
    this.track.classList.toggle('is-animando', !!animar);
    this.track.style.transform = 'translate3d(' + x + 'px,0,0)';
  };

  /**
   * Onde o track ESTÁ de verdade neste instante — no meio de uma transição, o
   * valor interpolado, não o alvo. É a base honesta para começar um arraste.
   */
  Carrossel.prototype.posicaoRenderizada = function () {
    var t = getComputedStyle(this.track).transform;
    if (!t || t === 'none') { return this.offset; }
    if (typeof DOMMatrixReadOnly === 'function') {
      try { return new DOMMatrixReadOnly(t).m41; } catch (err) { /* cai no parse manual */ }
    }
    var v = t.slice(t.indexOf('(') + 1, -1).split(',');
    var tx = parseFloat(v[t.indexOf('matrix3d') === 0 ? 12 : 4]);
    return isNaN(tx) ? this.offset : tx;
  };

  /**
   * Vai para um slide, respeitando os limites (o gesto nunca é circular).
   * `automatico` = veio do relógio, não do usuário.
   */
  Carrossel.prototype.irPara = function (i, animar, automatico) {
    var novo = Math.max(0, Math.min(this.slides.length - 1, i));
    this.indice = novo;

    // leitor de tela não deve narrar sozinho a cada 7s; anuncia só o que o usuário pediu
    this.raiz.setAttribute('aria-live', automatico ? 'off' : 'polite');

    this.track.classList.add('is-arrastando'); // will-change durante o movimento
    this.aplicar(-novo * this.largura, animar);
    this.sincronizar();
    this.resetTimer();                         // toda troca zera o contador
  };

  /** Só os pontinhos — seguro de chamar no meio de um gesto. */
  Carrossel.prototype.atualizarDots = function () {
    var atual = this.indice;
    this.dots.forEach(function (dot, i) {
      if (i === atual) { dot.setAttribute('aria-current', 'true'); }
      else { dot.removeAttribute('aria-current'); }
    });
  };

  /** Espelha o estado atual em dots, aria-hidden e inert. */
  Carrossel.prototype.sincronizar = function () {
    var atual = this.indice;
    this.slides.forEach(function (slide, i) {
      var ativo = (i === atual);
      slide.setAttribute('aria-hidden', ativo ? 'false' : 'true');
      if ('inert' in slide) { slide.inert = !ativo; }
    });
    this.atualizarDots();
  };

  /* ---------------- gesto ---------------- */

  Carrossel.prototype.aoDescer = function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) { return; }
    this.arrastando   = true;
    this.eixoDefinido = false;
    this.horizontal   = false;
    this.houveArraste = false;
    this.pointerId    = e.pointerId;
    this.x0 = this.ultimoX = e.clientX;
    this.y0 = e.clientY;
    this.dx = 0;
    this.ultimoT = e.timeStamp;
    this.velocidade = 0;

    this.stopTimer();                           // o tempo não corre com o dedo na tela
    if (!this.largura) { this.medir(); }

    // Pegar o carrossel no meio de uma transição não pode dar tranco: congelamos o
    // track exatamente onde ele está sendo desenhado e é DALI que o arraste parte.
    var real = this.posicaoRenderizada();
    this.track.style.transitionDuration = '';
    this.track.classList.add('is-arrastando');
    this.aplicar(real, false);                  // remove a transição sem mover 1px
    this.base = real;

    // o card que está na tela passa a ser a verdade (dots, elástico e destino)
    var visivel = Math.max(0, Math.min(this.slides.length - 1,
                                       Math.round(-real / this.largura)));
    if (visivel !== this.indice) {
      this.indice = visivel;
      this.atualizarDots();   // nada de mexer em `inert` com o dedo na tela
    }
  };

  Carrossel.prototype.aoMover = function (e) {
    if (!this.arrastando || e.pointerId !== this.pointerId) { return; }

    var dx = e.clientX - this.x0;
    var dy = e.clientY - this.y0;

    // Trava de eixo: acumula até um dos eixos passar de EIXO_MINIMO e só então decide.
    // Decidir na primeira amostra matava swipes que começam com leve deriva vertical.
    if (!this.eixoDefinido) {
      if (Math.abs(dx) < EIXO_MINIMO && Math.abs(dy) < EIXO_MINIMO) { return; }
      this.eixoDefinido = true;
      this.horizontal = Math.abs(dx) > Math.abs(dy);
      if (!this.horizontal) { this.arrastando = false; return; }
      try { this.viewport.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
    }

    // travado em horizontal: o gesto é nosso, o navegador não rouba
    if (e.cancelable) { e.preventDefault(); }

    // velocidade instantânea (px/ms) para detectar flick
    var dt = e.timeStamp - this.ultimoT;
    if (dt > 0) {
      this.velocidade = (e.clientX - this.ultimoX) / dt;
      this.ultimoX = e.clientX;
      this.ultimoT = e.timeStamp;
    }

    // resistência elástica no primeiro e no último slide
    var noInicio = (this.indice === 0 && dx > 0);
    var noFim    = (this.indice === this.slides.length - 1 && dx < 0);
    this.dx = (noInicio || noFim) ? dx * RESISTENCIA : dx;

    if (Math.abs(dx) > CLIQUE_MIN) { this.houveArraste = true; }

    this.aplicar(this.base + this.dx, false);
  };

  Carrossel.prototype.aoSubir = function (e) {
    if (!this.arrastando || (this.pointerId !== null && e.pointerId !== this.pointerId)) {
      // gesto vertical ou pointer alheio: não troca de slide, mas o relógio volta a correr
      this.arrastando = false;
      this.resetTimer();
      return;
    }
    this.arrastando = false;
    this.pointerId = null;

    // se o dedo ficou parado antes de soltar, a última velocidade não vale mais
    if (e.timeStamp - this.ultimoT > 100) { this.velocidade = 0; }

    var passouDistancia = Math.abs(this.dx) > this.largura * LIMIAR_ARRASTE;
    var passouVelocidade = Math.abs(this.velocidade) > VEL_FLICK;
    var destino = this.indice;

    if (passouDistancia || passouVelocidade) {
      // o sinal manda: dx negativo = arrastou para a esquerda = próximo slide
      var direcao = (Math.abs(this.velocidade) > VEL_FLICK) ? -Math.sign(this.velocidade)
                                                            : -Math.sign(this.dx);
      destino = this.indice + direcao;
    }

    this.dx = 0;
    this.irPara(destino, true); // snap back ou avanço, sempre animado
  };

  /**
   * O navegador reivindicou o gesto (scroll, gesto do sistema, barra de endereço).
   * Não dá para decidir destino a partir de um gesto cancelado: volta ao card atual.
   */
  Carrossel.prototype.aoCancelar = function () {
    if (!this.arrastando) { this.resetTimer(); return; }
    this.arrastando = false;
    this.pointerId = null;
    this.dx = 0;
    this.irPara(this.indice, true);
  };

  /* -----------------------------------------------------------------------
     2. LINKS DE WHATSAPP (número em um lugar só: data-whatsapp no <body>)
     --------------------------------------------------------------------- */
  function montarLinks() {
    var corpo   = document.body;
    var numero  = corpo.dataset.whatsapp;
    var mensagem = corpo.dataset.msg || 'Olá! Preciso de socorro mecânico 24h.';
    if (!numero) { return; }

    var base = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(mensagem);

    Array.prototype.forEach.call(document.querySelectorAll('[data-wa]'), function (link) {
      var origem = link.dataset.wa; // 'flutuante' | 'barra' | 'card4'
      link.href = base + '&' + UTM_BASE + encodeURIComponent(origem);
      link.addEventListener('click', function () { registrarConversao(origem); });
    });
  }

  /* -----------------------------------------------------------------------
     3. CONVERSÃO — Google Ads (gtag) e GTM (dataLayer)
        Nada bloqueia a navegação: o link abre imediatamente.
     --------------------------------------------------------------------- */
  function registrarConversao(origem) {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'conversion', {
          send_to: CONVERSAO_ADS,
          event_label: origem
        });
      }
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push({
          event: 'whatsapp_click',
          origem: origem
        });
      }
    } catch (err) {
      // medição nunca pode quebrar a página
    }
  }

  /* -----------------------------------------------------------------------
     BOOT
     --------------------------------------------------------------------- */
  function iniciar() {
    var raiz = document.getElementById('carousel');
    if (raiz) { new Carrossel(raiz); }
    montarLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
