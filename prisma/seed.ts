import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Workspace único de desenvolvimento
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'dev-nerus' },
    update: {},
    create: { name: 'Nerus Dev Workspace', slug: 'dev-nerus' },
  });

  // ===================== GRUPO_MULTI =====================
  const multiProfile = await prisma.profile.upsert({
    where: { cnpj: '59717553000102' },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'GRUPO_MULTI',
      cnpj: '59717553000102',
      razaoSocial: 'MULTILASER INDUSTRIAL SA',
      endereco: {
        xLgr: 'AV BRIGADEIRO FARIA LIMA',
        nro: '1811',
        xCpl: 'Nao consta',
        xBairro: 'JARDIM PAULISTANO',
        xMun: 'São Paulo',
        UF: 'SP',
        fone: '99999999',
      },
    },
  });

  const multiScenario = await prisma.scenario.upsert({
    where: { profileId_name: { profileId: multiProfile.id, name: 'GRUPO_MULTI - Cenário Principal 2025' } },
    update: {},
    create: {
      profileId: multiProfile.id,
      name: 'GRUPO_MULTI - Cenário Principal 2025',
      active: true,
      editar_emitente: true,
      editar_produtos: true,
      editar_impostos: false,
      editar_data: true,
      editar_refNFe: true,
      editar_cst: false,
      editar_destinatario: false,
      zerar_ipi_remessa_retorno: false,
      zerar_ipi_venda: false,
      reforma_tributaria: true,
      alterar_serie: true,
      alterar_cUF: true,
      aplicar_reducao_aliq: false,
      nova_data: '13/11/2025',
      nova_serie: '999',
      novo_cUF: '35',
      emitente: {
        CNPJ: '59717553000102',
        xNome: 'MULTILASER INDUSTRIAL SA',
        xLgr: 'AV BRIGADEIRO FARIA LIMA',
        nro: '1811',
        xCpl: 'Nao consta',
        xBairro: 'JARDIM PAULISTANO',
        xMun: 'São Paulo',
        UF: 'SP',
        fone: '99999999',
      },
      destinatario: {
        CNPJ: '12345678000199',
        xNome: 'EMPRESA DESTINATARIO EXEMPLO LTDA',
        IE: '123456789111',
        xLgr: 'RUA DAS FLORES',
        nro: '123',
        xBairro: 'CENTRO',
        xMun: 'Cidade Exemplo',
        UF: 'EX',
        CEP: '12345678',
        fone: '1188888888',
      },
      produto_padrao: {
        xProd: 'TABLET M7 (WIFI/32GB) - BRANCO',
        cEAN: '7899838882963',
        cProd: 'NB356',
        NCM: '84713011',
        CEST: '2102800',
        EXTIPI: '01',
        CFOP: '5105',
      },
      impostos_padrao: {
        pFCP: '2.00',
        pICMS: '18.00',
        pICMSUFDest: '12.00',
        pICMSInter: '7.00',
        pPIS: '1.65',
        pCOFINS: '7.60',
        pIPI: '5.00',
      },
    },
  });

  await prisma.cstMapping.deleteMany({ where: { scenarioId: multiScenario.id } });
  const multiCst = [
    { cfop: '6105', icms: '00', ipi: '50', pis: '01', cofins: '01' },
    { cfop: '5949', icms: '00', ipi: '55', pis: '09', cofins: '09' },
    { cfop: '1949', icms: '00', ipi: '55', pis: '09', cofins: '09' },
    { cfop: '1201', icms: '00', ipi: '50', pis: '01', cofins: '01' },
    { cfop: '2201', icms: '00', ipi: '50', pis: '01', cofins: '01' },
  ];
  for (const m of multiCst) await prisma.cstMapping.create({ data: { scenarioId: multiScenario.id, ...m } });

  await prisma.taxReformRule.deleteMany({ where: { scenarioId: multiScenario.id } });
  await prisma.taxReformRule.create({
    data: {
      scenarioId: multiScenario.id,
      pIBSUF: '0.1000',
      pIBSMun: '0.00',
      pCBS: '0.9000',
      vDevTrib: '0.00',
      cClassTrib: '200030',
      CST: '200',
      gIBSUF_gRed: { pRedAliq: '60.0000', pAliqEfet: '0.04' },
      gIBSMun_gRed: { pRedAliq: '60.0000', pAliqEfet: '0.00' },
      gCBS_gRed: { pRedAliq: '60.0000', pAliqEfet: '0.36' }
    },
  });

  // ===================== ITATIAIA =====================
  const itatiaiaProfile = await prisma.profile.upsert({
    where: { cnpj: '46334135000194' },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'ITATIAIA',
      cnpj: '46334135000194',
      razaoSocial: 'ITATIAIA LTDA',
      endereco: {
        xLgr: 'ROD BR 101',
        nro: 'S/N',
        xCpl: 'Nao consta',
        xBairro: 'FAZENDA SAO ROQUE',
        xMun: 'Sooretama',
        UF: 'ES',
        fone: '4732812000',
      },
    },
  });

  const itatiaiaScenario = await prisma.scenario.upsert({
    where: { profileId_name: { profileId: itatiaiaProfile.id, name: 'ITATIAIA - Cenário Principal 2025' } },
    update: {},
    create: {
      profileId: itatiaiaProfile.id,
      name: 'ITATIAIA - Cenário Principal 2025',
      active: true,
      editar_emitente: true,
      editar_produtos: true,
      editar_impostos: false,
      editar_data: true,
      editar_refNFe: true,
      editar_cst: false,
      editar_destinatario: true,
      zerar_ipi_remessa_retorno: false,
      zerar_ipi_venda: false,
      reforma_tributaria: true,
      alterar_serie: true,
      alterar_cUF: true,
      aplicar_reducao_aliq: false,
      nova_data: '01/10/2025',
      nova_serie: '999',
      novo_cUF: '35',
      emitente: {
        CNPJ: '46334135000194',
        xNome: 'ITATIAIA LTDA',
        xLgr: 'ROD BR 101',
        nro: 'S/N',
        xCpl: 'Nao consta',
        xBairro: 'FAZENDA SAO ROQUE',
        xMun: 'Sooretama',
        UF: 'ES',
        fone: '4732812000',
      },
      destinatario: {
        CNPJ: '12345678000199',
        xNome: 'EMPRESA DESTINATARIO EXEMPLO LTDA',
        IE: '123456789111',
        xLgr: 'RUA DAS FLORES',
        nro: '123',
        xBairro: 'CENTRO',
        xMun: 'Cidade Exemplo',
        UF: 'EX',
        CEP: '12345678',
        fone: '1188888888',
      },
      produto_padrao: {
        xProd: 'Air Fryer 3,5 litros 220 V Essencial - Itatiaia',
        cEAN: '7892946455166',
        cProd: 'AFITA1001',
      },
      impostos_padrao: {
        pFCP: '2.00',
        pICMS: '18.00',
        pICMSUFDest: '12.00',
        pICMSInter: '7.00',
        pPIS: '1.65',
        pCOFINS: '7.60',
        pIPI: '5.00',
      },
    },
  });

  await prisma.cstMapping.deleteMany({ where: { scenarioId: itatiaiaScenario.id } });
  const itatiaiaCst = [
    { cfop: '6105', icms: '00', ipi: '50', pis: '01', cofins: '01' },
    { cfop: '5949', icms: '00', ipi: '55', pis: '08', cofins: '08' },
    { cfop: '1949', icms: '00', ipi: '55', pis: '08', cofins: '08' },
  ];
  for (const m of itatiaiaCst) await prisma.cstMapping.create({ data: { scenarioId: itatiaiaScenario.id, ...m } });

  await prisma.taxReformRule.deleteMany({ where: { scenarioId: itatiaiaScenario.id } });
  await prisma.taxReformRule.create({
    data: {
      scenarioId: itatiaiaScenario.id,
      pIBSUF: '0.10',
      pIBSMun: '0.00',
      pCBS: '0.10',
      vDevTrib: '0.00',
      cClassTrib: '000001',
      CST: '000',
    },
  });

  // ===================== SODIMAC =====================
  const sodimacProfile = await prisma.profile.upsert({
    where: { cnpj: '03439316000172' },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'SODIMAC',
      cnpj: '03439316000172',
      razaoSocial: 'CONSTRUDECOR S.A',
      endereco: {
        xLgr: 'R Dos Patriotas',
        nro: '1213',
        xCpl: 'Nao consta',
        xBairro: 'Ipiranga',
        xMun: 'São Paulo',
        UF: 'SP',
        fone: '11966192890',
      },
    },
  });

  const sodimacScenario = await prisma.scenario.upsert({
    where: { profileId_name: { profileId: sodimacProfile.id, name: 'SODIMAC - Cenário Principal 2025' } },
    update: {},
    create: {
      profileId: sodimacProfile.id,
      name: 'SODIMAC - Cenário Principal 2025',
      active: true,
      editar_emitente: true,
      editar_produtos: true,
      editar_impostos: false,
      editar_data: true,
      editar_refNFe: true,
      editar_cst: false,
      editar_destinatario: true,
      zerar_ipi_remessa_retorno: false,
      zerar_ipi_venda: false,
      reforma_tributaria: true,
      alterar_serie: true,
      alterar_cUF: true,
      aplicar_reducao_aliq: false,
      nova_data: '01/10/2025',
      nova_serie: '999',
      novo_cUF: '35',
      emitente: {
        CNPJ: '03439316000172',
        xNome: 'CONSTRUDECOR S.A',
        xLgr: 'R Dos Patriotas',
        nro: '1213',
        xCpl: 'Nao consta',
        xBairro: 'Ipiranga',
        xMun: 'São Paulo',
        UF: 'SP',
        fone: '11966192890',
      },
      destinatario: {
        CNPJ: '12345678000199',
        xNome: 'EMPRESA DESTINATARIO EXEMPLO LTDA',
        IE: '123456789111',
        xLgr: 'RUA DAS FLORES',
        nro: '123',
        xBairro: 'CENTRO',
        xMun: 'Cidade Exemplo',
        UF: 'EX',
        CEP: '12345678',
        fone: '1188888888',
      },
      produto_padrao: {
        xProd: 'Chumbador Cba com Prisioneiro Cromado 3/8x80',
        cEAN: '7899789207075',
        cProd: '741697',
      },
      impostos_padrao: {
        pFCP: '2.00',
        pICMS: '18.00',
        pICMSUFDest: '12.00',
        pICMSInter: '7.00',
        pPIS: '1.65',
        pCOFINS: '7.60',
        pIPI: '5.00',
      },
    },
  });

  await prisma.cstMapping.deleteMany({ where: { scenarioId: sodimacScenario.id } });
  const sodimacCst = [
    { cfop: '6105', icms: '00', ipi: '50', pis: '01', cofins: '01' },
    { cfop: '5949', icms: '00', ipi: '55', pis: '09', cofins: '09' },
    { cfop: '1949', icms: '00', ipi: '55', pis: '09', cofins: '09' },
    { cfop: '1201', icms: '00', ipi: '50', pis: '01', cofins: '01' },
    { cfop: '2201', icms: '00', ipi: '50', pis: '01', cofins: '01' },
  ];
  for (const m of sodimacCst) await prisma.cstMapping.create({ data: { scenarioId: sodimacScenario.id, ...m } });

  await prisma.taxReformRule.deleteMany({ where: { scenarioId: sodimacScenario.id } });
  await prisma.taxReformRule.create({
    data: {
      scenarioId: sodimacScenario.id,
      pIBSUF: '0.10',
      pIBSMun: '0.00',
      pCBS: '0.10',
      vDevTrib: '0.00',
      cClassTrib: '000001',
      CST: '000',
    },
  });

  console.log('\n🎉 Seed hard-coded 100% concluído – todas as 3 empresas do constantes.json estão no banco!');
  console.log('   Pode rodar infinitas vezes – nunca duplica.');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());