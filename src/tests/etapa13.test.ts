import 'fake-indexeddb/auto';
import { printingService } from '../services/printingService';

async function runEtapa13Tests() {
  console.log('=== INICIANDO BATERIA DE TESTES DA ETAPA 13 ===\n');
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
    // TESTE 01: Enqueue KITCHEN_NEW_ORDER
    const job1 = await printingService.enqueue({
      type: 'KITCHEN_NEW_ORDER',
      source: 'KDS',
      ticketId: 'tkt-001',
      roundNumber: 1,
      station: 'KITCHEN',
      payload: { items: ['X-Burguer'] },
    });

    assert(Boolean(job1.id), 'TESTE 01a. Criar PrintJob KITCHEN_NEW_ORDER');
    assert(job1.status === 'PENDING', 'TESTE 01b. Status inicial é PENDING');

    // TESTE 02: Confirmar attempts = 0
    assert(job1.attempts === 0, 'TESTE 02. Confirmar attempts = 0');

    // TESTE 03: Confirmar isReprint = false
    assert(job1.isReprint === false, 'TESTE 03. Confirmar isReprint = false');

    // TESTE 04: Confirmar eventKey automático gerado
    assert(job1.eventKey === 'KITCHEN_tkt-001_R1_KITCHEN', 'TESTE 04. Confirmar eventKey automático gerado');

    // TESTE 05: Tentar enqueue com mesmo eventKey (Idempotência)
    const job1Duplicate = await printingService.enqueue({
      type: 'KITCHEN_NEW_ORDER',
      source: 'KDS',
      ticketId: 'tkt-001',
      roundNumber: 1,
      station: 'KITCHEN',
      payload: { items: ['X-Burguer'] },
    });

    assert(job1Duplicate.id === job1.id, 'TESTE 05. Idempotência: Retorna mesmo PrintJob sem duplicar');

    // TESTE 06: Criar dois eventos com eventKeys diferentes
    const job2 = await printingService.enqueue({
      type: 'KITCHEN_NEW_ORDER',
      source: 'KDS',
      ticketId: 'tkt-002',
      roundNumber: 1,
      station: 'KITCHEN',
      payload: { items: ['Pizza Margherita'] },
    });

    assert(Boolean(job2.id) && job2.id !== job1.id, 'TESTE 06. Eventos distintos geram PrintJobs distintos');

    // TESTE 07: Atualizar status PENDING -> PRINTING
    const job1Printing = await printingService.updateStatus(job1.id, 'PRINTING');
    assert(job1Printing.status === 'PRINTING', 'TESTE 07. Atualizar status PENDING -> PRINTING');

    // TESTE 08: markPrinted()
    const job1Printed = await printingService.markPrinted(job1.id);
    assert(job1Printed.status === 'PRINTED', 'TESTE 08a. markPrinted() altera status para PRINTED');
    assert(Boolean(job1Printed.printedAt), 'TESTE 08b. printedAt é preenchido com timestamp');

    // TESTE 09: markFailed()
    const job2Failed = await printingService.markFailed(job2.id, 'Impressora fora de linha');
    assert(job2Failed.status === 'FAILED', 'TESTE 09a. markFailed() altera status para FAILED');
    assert(job2Failed.lastError === 'Impressora fora de linha', 'TESTE 09b. lastError é registrado');

    // TESTE 10: incrementAttempts()
    const job2Attempt1 = await printingService.incrementAttempts(job2.id);
    assert(job2Attempt1.attempts === 1, 'TESTE 10. incrementAttempts() incrementa attempts de 0 para 1');

    // TESTE 11: createReprint()
    const reprintJob = await printingService.createReprint(job1.id);
    assert(Boolean(reprintJob.id) && reprintJob.id !== job1.id, 'TESTE 11a. Reimpressão gera novo ID');
    assert(reprintJob.isReprint === true, 'TESTE 11b. isReprint = true');
    assert(reprintJob.originalJobId === job1.id, 'TESTE 11c. originalJobId preservado');
    assert(reprintJob.status === 'PENDING', 'TESTE 11d. Status inicial da reimpressão é PENDING');

    // TESTE 12: Reimpressão não é bloqueada pelo eventKey original
    const existingReprint = await printingService.getJob(reprintJob.id);
    assert(Boolean(existingReprint) && existingReprint?.id === reprintJob.id, 'TESTE 12. Reimpressão persiste normalmente sem bloqueio por eventKey');

    // TESTE 13: Validação de KITCHEN_NEW_ORDER inválido (sem station)
    let errorCaught13 = false;
    try {
      await printingService.enqueue({
        type: 'KITCHEN_NEW_ORDER',
        source: 'KDS',
        ticketId: 'tkt-003',
      } as any);
    } catch (e: any) {
      errorCaught13 = true;
    }
    assert(errorCaught13, 'TESTE 13. Validação rejeita KITCHEN_NEW_ORDER sem station');

    // TESTE 14: Validação de DELIVERY_ORDER inválido (sem orderId)
    let errorCaught14 = false;
    try {
      await printingService.enqueue({
        type: 'DELIVERY_ORDER',
        source: 'DELIVERY',
      } as any);
    } catch (e: any) {
      errorCaught14 = true;
    }
    assert(errorCaught14, 'TESTE 14. Validação rejeita DELIVERY_ORDER sem orderId');

    // TESTE 15: Consultas do serviço
    const allJobs = await printingService.getJobs();
    assert(allJobs.length >= 3, 'TESTE 15a. getJobs() retorna lista completa de trabalhos');

    const printedJobs = await printingService.getJobsByStatus('PRINTED');
    assert(printedJobs.length === 1 && printedJobs[0].id === job1.id, 'TESTE 15b. getJobsByStatus("PRINTED") filtra corretamente');

    console.log(`\n=== RESUMO ETAPA 13: PASSOU: ${passed} | FALHOU: ${failed} ===`);
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Erro crítico nos testes:', err);
    process.exit(1);
  }
}

runEtapa13Tests();
