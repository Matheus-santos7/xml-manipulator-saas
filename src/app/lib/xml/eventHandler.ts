import { XmlHelper } from './XmlHelper';
import { ScenarioDB } from '../../../types';

export function editarInutilizacao(
  helper: XmlHelper,
  scenario: ScenarioDB
): { msg: string; alteracoes: string[] } {
  const alteracoes: string[] = [];
  const root = helper.doc.documentElement;
  const msg = `Inutilização: ${root.tagName}`;
  
  // Tenta achar infInut na raiz ou dentro do retorno
  let infInut = helper.findElementDeep(root, 'inutNFe/infInut');
  if (!infInut) infInut = helper.findElementDeep(root, 'retInutNFe/infInut');

  if (!infInut) return { msg, alteracoes };

  // Variáveis para recalculo de ID
  let anoNovo: string | null = null;
  let cnpjNovo: string | null = null;
  let cUFNovo: string | null = null;
  let serieNova: string | null = null;

  // 1. Editar Emitente (CNPJ)
  if (scenario.editar_emitente && scenario.emitente) {
    const cnpjTag = helper.findElement(infInut, 'CNPJ');
    if (cnpjTag && typeof scenario.emitente === 'object' && 'CNPJ' in scenario.emitente) {
      cnpjNovo = scenario.emitente.CNPJ as string;
      cnpjTag.textContent = cnpjNovo;
      alteracoes.push("Inutilização: <CNPJ> alterado");
    }
  }

  // 2. Editar Data (Ano)
  if (scenario.editar_data && scenario.nova_data) {
    const novaData = new Date(scenario.nova_data.split('/').reverse().join('-'));
    const anoTag = helper.findElement(infInut, 'ano');
    if (anoTag) {
      anoNovo = novaData.getFullYear().toString().slice(2); // Pega os 2 últimos dígitos
      anoTag.textContent = anoNovo;
      alteracoes.push("Inutilização: <ano> alterado");
    }

    // Atualiza dhRecbto se existir
    const dhRecbtoTag = helper.findElementDeep(root, 'retInutNFe/infInut/dhRecbto');
    if (dhRecbtoTag) {
       const novaDh = `${novaData.toISOString().split('T')[0]}T${new Date().toLocaleTimeString('en-GB', { hour12: false })}-03:00`;
       dhRecbtoTag.textContent = novaDh;
       alteracoes.push("Inutilização: <dhRecbto> alterado");
    }
  }

  // 3. Editar UF e Série
  if (scenario.alterar_cUF && scenario.novo_cUF) {
    const cUFTag = helper.findElement(infInut, 'cUF');
    if (cUFTag) {
      cUFTag.textContent = scenario.novo_cUF;
      cUFNovo = scenario.novo_cUF;
      alteracoes.push("Inutilização: <cUF> alterado");
    }
  }

  if (scenario.alterar_serie && scenario.nova_serie) {
    const serieTag = helper.findElement(infInut, 'serie');
    if (serieTag) {
      serieTag.textContent = scenario.nova_serie;
      serieNova = scenario.nova_serie.padStart(3, '0');
      alteracoes.push("Inutilização: <serie> alterada");
    }
  }

  // 4. Recalcular ID da Tag
  const idAtual = infInut.getAttribute('Id');
  if (idAtual && (anoNovo || cnpjNovo || cUFNovo || serieNova)) {
    // Formato: ID[cUF(2)][Ano(2)][CNPJ(14)][mod(2)][serie(3)][nNFIni(9)][nNFFin(9)]
    const uf = cUFNovo || idAtual.slice(2, 4);
    const ano = anoNovo || idAtual.slice(4, 6);
    const cnpjRaw = cnpjNovo || idAtual.slice(6, 20);
    const cnpj = cnpjRaw.replace(/\D/g, '').padStart(14, '0');
    const mod = idAtual.slice(20, 22);
    const serie = serieNova || idAtual.slice(22, 25);
    const nNFIni = idAtual.slice(25, 34);
    const nNFFin = idAtual.slice(34, 43);

    const novoId = `ID${uf}${ano}${cnpj}${mod}${serie}${nNFIni}${nNFFin}`;
    infInut.setAttribute('Id', novoId);
    alteracoes.push(`Inutilização: <Id> alterado para ${novoId}`);
  }

  return { msg, alteracoes };
}

export function editarCancelamento(
  helper: XmlHelper,
  chaveMapping: Record<string, string>,
  editarData: boolean,
  novaData?: string
): string[] {
  const alteracoes: string[] = [];
  const root = helper.doc.documentElement;

  // 1. Atualizar chNFe do evento
  const chNFeTag = helper.findElementDeep(root, 'evento/infEvento/chNFe');
  if (chNFeTag && chNFeTag.textContent && chNFeTag.textContent in chaveMapping) {
    const novaChave = chaveMapping[chNFeTag.textContent];
    chNFeTag.textContent = novaChave;
    alteracoes.push(`chNFe alterado para nova chave: ${novaChave}`);
    
    // Tenta atualizar o ID do evento também (geralmente ID + tpEvento + chNFe + nSeqEvento)
    const infEvento = helper.findElementDeep(root, 'evento/infEvento');
    const idAtual = infEvento?.getAttribute('Id');
    if (infEvento && idAtual) {
        // ID (2) + tpEvento (6) + chNFe (44) + nSeq (2)
        const prefix = idAtual.substring(0, 8); 
        const suffix = idAtual.substring(52); 
        const novoId = `${prefix}${novaChave}${suffix}`;
        infEvento.setAttribute('Id', novoId);
    }
  }

  // 2. Atualizar Datas
  if (editarData && novaData) {
    const novaDh = `${new Date(novaData.split('/').reverse().join('-')).toISOString().split('T')[0]}T${new Date().toLocaleTimeString('en-GB', { hour12: false })}-03:00`;
    
    const tagsData = [
        helper.findElementDeep(root, 'evento/infEvento/dhEvento'),
        helper.findElementDeep(root, 'retEvento/infEvento/dhRecbto'),
        helper.findElementDeep(root, 'retEvento/infEvento/dhRegEvento')
    ];

    tagsData.forEach(tag => {
        if (tag) {
            tag.textContent = novaDh;
            alteracoes.push(`${tag.tagName} alterado para ${novaDh}`);
        }
    });
  }

  // 3. Atualizar qualquer outra referência de chave antiga
  // Percorre chNFe genéricos no XML (ex: no retorno)
  // Nota: A implementação precisa ser adaptada pois o helper atual não tem um "iter all nodes", 
  // mas podemos buscar paths conhecidos.
  const chNFeRet = helper.findElementDeep(root, 'retEvento/infEvento/chNFe');
  if (chNFeRet && chNFeRet.textContent && chNFeRet.textContent in chaveMapping) {
      chNFeRet.textContent = chaveMapping[chNFeRet.textContent];
      alteracoes.push(`retEvento/chNFe alterado para nova chave`);
  }

  return alteracoes;
}