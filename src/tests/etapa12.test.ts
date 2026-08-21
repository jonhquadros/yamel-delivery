import 'fake-indexeddb/auto';
import { printingQueueRepository, printerConfigRepository } from '../printers';
import { PrintJob, PrinterConfig } from '../printers/types';

async function runEtapa12Tests() {
  console.log('=== INICIANDO BATERIA DE TESTES DA ETAPA 12 ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail !== undefined ? detail : '');
      failed++;
    }
  }

  try {
    // 1. Criar um PrintJob do tipo KITCHEN_NEW_ORDER
    const createdJob = await printingQueueRepository.create({
      type: 'KITCHEN_NEW_ORDER',
      source: 'KDS',
      status: 'PENDING',
      orderId: 'ord-123',
      ticketId: 'tkt-456',
      roundNumber: 1,
      station: 'KITCHEN',
      attempts: 0,
      isReprint: false,
      eventKey: 'KITCHEN_tkt-456_R1_KITCHEN',
      payload: {
        title: 'Mesa 01',
        content: '1x Burger Prime'
      }
    });

    assert(Boolean(createdJob.id), '1. Criar PrintJob com ID gerado automaticamente');
    assert(createdJob.status === 'PENDING', '1b. Status inicial é PENDING');
    assert(createdJob.eventKey === 'KITCHEN_tkt-456_R1_KITCHEN', '1c. EventKey configurado corretamente');

    // 2. Buscar por ID
    const retrievedJob = await printingQueueRepository.getById(createdJob.id);
    assert(Boolean(retrievedJob) && retrievedJob?.orderId === 'ord-123', '2. Buscar PrintJob por ID');

    // 3. Buscar por eventKey (Idempotência)
    const foundByKey = await printingQueueRepository.findByEventKey('KITCHEN_tkt-456_R1_KITCHEN');
    assert(Boolean(foundByKey) && foundByKey?.id === createdJob.id, '3. Buscar PrintJob por eventKey');

    // 4. Atualizar status para PRINTED
    createdJob.status = 'PRINTED';
    createdJob.printedAt = new Date().toISOString();
    const updatedJob = await printingQueueRepository.update(createdJob);
    assert(updatedJob.status === 'PRINTED', '4. Atualizar status do PrintJob para PRINTED');

    // 5. Listar por status PENDING (deve estar vazio)
    const pendingJobs = await printingQueueRepository.listByStatus('PENDING');
    assert(pendingJobs.length === 0, '5. Listar por status PENDING (esperado 0)');

    // 6. Listar por status PRINTED (deve conter 1 item)
    const printedJobs = await printingQueueRepository.listByStatus('PRINTED');
    assert(printedJobs.length === 1 && printedJobs[0].id === createdJob.id, '6. Listar por status PRINTED (esperado 1)');

    // 7. Criar PrinterConfig
    const createdPrinter = await printerConfigRepository.create({
      name: 'Impressora Cozinha 01',
      type: 'NETWORK',
      address: '192.168.1.200',
      port: 9100,
      enabled: true,
      paperWidth: 80,
      station: 'KITCHEN'
    });

    assert(Boolean(createdPrinter.id), '7. Criar PrinterConfig');

    // 8. Listar impressoras por estação KITCHEN
    const kitchenPrinters = await printerConfigRepository.listByStation('KITCHEN');
    assert(kitchenPrinters.length === 1 && kitchenPrinters[0].name === 'Impressora Cozinha 01', '8. Listar impressoras por estação');

    console.log(`\n=== RESUMO ETAPA 12: PASSOU: ${passed} | FALHOU: ${failed} ===`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Erro crítico nos testes:', err);
    process.exit(1);
  }
}

runEtapa12Tests();
