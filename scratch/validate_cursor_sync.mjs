// Script de Validação Matemática da Sincronização do Cursor Remoto
// Testa exatidão de posicionamento entre resoluções, zoom e scroll

function testMathematicalSync() {
  console.log("=== INÍCIO DA VALIDAÇÃO MATEMÁTICA DE SINCRONIZAÇÃO ===");
  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  function assertCloseTo(actual, expected, tolerance, message) {
    totalTests++;
    const diff = Math.abs(actual - expected);
    if (diff <= tolerance) {
      console.log(`[PASS] ${message} (Diff: ${diff.toFixed(4)}px <= ${tolerance}px)`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message} (Actual: ${actual}, Expected: ${expected}, Diff: ${diff})`);
    }
  }

  // Simulação de Elemento e Cálculo
  function simulateSenderCalculation(elementRect, clientX, clientY) {
    const relativeX = Math.max(0, Math.min(1, (clientX - elementRect.left) / elementRect.width));
    const relativeY = Math.max(0, Math.min(1, (clientY - elementRect.top) / elementRect.height));
    return { relativeX, relativeY };
  }

  function simulateReceiverPosition(elementRect, relativeX, relativeY) {
    const cursorX = elementRect.left + (relativeX * elementRect.width);
    const cursorY = elementRect.top + (relativeY * elementRect.height);
    return { cursorX, cursorY };
  }

  // 1. TESTE 1: 1920x1080 -> 1366x768 (Desktop para Notebook)
  // No desktop 1920x1080: Botão de Ação tem left: 600, top: 200, width: 200, height: 48
  // O administrador posiciona o cursor exatamente no centro do botão (clientX: 700, clientY: 224)
  {
    const senderButton = { left: 600, top: 200, width: 200, height: 48 };
    const { relativeX, relativeY } = simulateSenderCalculation(senderButton, 700, 224);
    assertCloseTo(relativeX, 0.5, 0.001, "Teste 1.1: RelativeX no transmissor é exatamente 50% (centro)");
    assertCloseTo(relativeY, 0.5, 0.001, "Teste 1.2: RelativeY no transmissor é exatamente 50% (centro)");

    // No receptor 1366x768: Devido ao layout responsivo, o botão está em left: 420, top: 180, width: 180, height: 44
    const receiverButton = { left: 420, top: 180, width: 180, height: 44 };
    const { cursorX, cursorY } = simulateReceiverPosition(receiverButton, relativeX, relativeY);

    // O cursor no receptor DEVE estar exatamente no centro do botão no receptor (left + width/2, top + height/2)
    assertCloseTo(cursorX, 420 + 90, 0.001, "Teste 1.3: 1920x1080 -> 1366x768: Cursor X posicionado no centro exato do botão receptor (510px)");
    assertCloseTo(cursorY, 180 + 22, 0.001, "Teste 1.4: 1920x1080 -> 1366x768: Cursor Y posicionado no centro exato do botão receptor (202px)");
  }

  // 2. TESTE 2: 1366x768 -> 1920x1080 (Notebook para Desktop)
  // No notebook: Campo de busca está em left: 100, top: 50, width: 300, height: 40
  // O usuário clica a 15px da borda esquerda (ícone da lupa): clientX: 115, clientY: 70
  {
    const senderSearch = { left: 100, top: 50, width: 300, height: 40 };
    const { relativeX, relativeY } = simulateSenderCalculation(senderSearch, 115, 70);
    assertCloseTo(relativeX, 0.05, 0.001, "Teste 2.1: RelativeX a 5% da largura (ícone da lupa)");
    assertCloseTo(relativeY, 0.5, 0.001, "Teste 2.2: RelativeY a 50% da altura");

    // No desktop: O campo de busca se expande para width: 500, left: 200, top: 60, height: 44
    const receiverSearch = { left: 200, top: 60, width: 500, height: 44 };
    const { cursorX, cursorY } = simulateReceiverPosition(receiverSearch, relativeX, relativeY);

    assertCloseTo(cursorX, 200 + (0.05 * 500), 0.001, "Teste 2.3: 1366x768 -> 1920x1080: Cursor X aponta exatamente para a lupa (225px)");
    assertCloseTo(cursorY, 60 + 22, 0.001, "Teste 2.4: 1366x768 -> 1920x1080: Cursor Y aponta exatamente para o centro vertical da lupa (82px)");
  }

  // 3. TESTE 3: 1920x1080 -> 1440x900
  // Linha de tabela tr:nth-of-type(4)
  {
    const senderRow = { left: 50, top: 350, width: 1200, height: 50 };
    // Cursor no terço final da linha (ex: botão de ações): clientX: 1010, clientY: 375
    const { relativeX, relativeY } = simulateSenderCalculation(senderRow, 1010, 375);
    assertCloseTo(relativeX, (1010 - 50) / 1200, 0.001, "Teste 3.1: RelativeX na linha da tabela");

    const receiverRow = { left: 40, top: 320, width: 950, height: 48 };
    const { cursorX, cursorY } = simulateReceiverPosition(receiverRow, relativeX, relativeY);
    const expectedX = 40 + (relativeX * 950);
    const expectedY = 320 + (0.5 * 48);
    assertCloseTo(cursorX, expectedX, 0.001, "Teste 3.2: 1920x1080 -> 1440x900: Cursor sobre a mesma coluna lógica");
    assertCloseTo(cursorY, expectedY, 0.001, "Teste 3.3: 1920x1080 -> 1440x900: Cursor sobre o centro vertical da linha");
  }

  // 4. TESTE 4: 100% ZOOM -> 125% ZOOM
  // Com zoom de 125%, os pixels CSS do getBoundingClientRect() aumentam proporcionalmente no receptor
  {
    const sender100 = { left: 100, top: 100, width: 200, height: 50 };
    const { relativeX, relativeY } = simulateSenderCalculation(sender100, 150, 125); // 25% da largura, 50% da altura

    // Receptor com zoom de 125%: o rect CSS é 1.25x maior
    const receiver125 = { left: 100 * 1.25, top: 100 * 1.25, width: 200 * 1.25, height: 50 * 1.25 };
    const { cursorX, cursorY } = simulateReceiverPosition(receiver125, relativeX, relativeY);

    assertCloseTo(cursorX, (125) + (0.25 * 250), 0.001, "Teste 4.1: 100% -> 125% Zoom: Cursor alinhado ao ponto interno escalado");
    assertCloseTo(cursorY, (125) + (0.5 * 62.5), 0.001, "Teste 4.2: 100% -> 125% Zoom: Cursor verticalmente alinhado");
  }

  // 5. TESTE 5: 125% ZOOM -> 100% ZOOM
  {
    const sender125 = { left: 125, top: 125, width: 250, height: 62.5 };
    const { relativeX, relativeY } = simulateSenderCalculation(sender125, 200, 150);

    const receiver100 = { left: 100, top: 100, width: 200, height: 50 };
    const { cursorX, cursorY } = simulateReceiverPosition(receiver100, relativeX, relativeY);

    assertCloseTo(cursorX, 100 + (relativeX * 200), 0.001, "Teste 5.1: 125% -> 100% Zoom: Reversão matemática exata X");
    assertCloseTo(cursorY, 100 + (relativeY * 50), 0.001, "Teste 5.2: 125% -> 100% Zoom: Reversão matemática exata Y");
  }

  // 6. TESTE 6: SCROLL EM POSIÇÕES DIFERENTES
  // No transmissor: scrollY = 500, o botão no DOM está em documentY = 700 => viewport rect.top = 200
  // Cursor aponta para o topo do botão em viewport clientY = 210 (10px dentro do botão)
  {
    const senderViewportRect = { left: 300, top: 200, width: 150, height: 40 };
    const { relativeX, relativeY } = simulateSenderCalculation(senderViewportRect, 330, 210);
    assertCloseTo(relativeX, 0.20, 0.001, "Teste 6.1: 20% do botão horizontalmente");
    assertCloseTo(relativeY, 0.25, 0.001, "Teste 6.2: 25% do botão verticalmente");

    // No receptor: scrollY = 100 (usuário ainda não desceu tudo)
    // O botão no receptor (documentY = 700) terá viewport rect.top = 700 - 100 = 600
    const receiverViewportRect = { left: 250, top: 600, width: 140, height: 40 };
    const { cursorX, cursorY } = simulateReceiverPosition(receiverViewportRect, relativeX, relativeY);

    // O cursor no receptor DEVE aparecer a 20% de 140 e 25% de 40 a partir de rect.top = 600 (não importando scroll diferente!)
    assertCloseTo(cursorX, 250 + (0.20 * 140), 0.001, "Teste 6.3: Scroll diferente: Cursor X acompanha o botão no viewport (278px)");
    assertCloseTo(cursorY, 600 + (0.25 * 40), 0.001, "Teste 6.4: Scroll diferente: Cursor Y acompanha o botão no viewport (610px)");
  }

  // 7. TESTE 7: FALLBACK NORMALIZADO PELO VIEWPORT (quando não há elemento)
  {
    const senderW = 1920;
    const senderH = 1080;
    const clientX = 960;
    const clientY = 540;
    const normalizedX = clientX / senderW;
    const normalizedY = clientY / senderH;

    const receiverW = 1366;
    const receiverH = 768;
    const fallbackX = normalizedX * receiverW;
    const fallbackY = normalizedY * receiverH;

    assertCloseTo(fallbackX, 683, 0.001, "Teste 7.1: Fallback X no centro exato da tela receptora (683px)");
    assertCloseTo(fallbackY, 384, 0.001, "Teste 7.2: Fallback Y no centro exato da tela receptora (384px)");
  }

  console.log(`\n=== RESULTADO DOS TESTES: ${passedTests}/${totalTests} PASSARAM ===`);
  if (passedTests === totalTests) {
    console.log("TODAS AS PROVAS MATEMÁTICAS FORAM VALIDADAS COM SUCESSO!");
  } else {
    process.exit(1);
  }
}

testMathematicalSync();
