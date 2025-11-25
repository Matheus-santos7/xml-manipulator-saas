import { XmlHelper } from './XmlHelper';
import { VENDAS_CFOP, DEVOLUCOES_CFOP, RETORNOS_CFOP, REMESSAS_CFOP } from './constants';

export function getXmlInfo(helper: XmlHelper): Record<string, any> | null {
  try {
    const root = helper.doc.documentElement;
    // Ignora eventos e CTe nesta função (são tratados à parte ou simplificados)
    if (root.tagName.includes('procEventoNFe') || root.tagName.toLowerCase().includes('cte')) return null;

    const infNFe = helper.findElementDeep(root, 'infNFe');
    if (!infNFe) return null;

    const ide = helper.findElement(infNFe, 'ide');
    const emit = helper.findElement(infNFe, 'emit');
    
    if (!ide || !emit) return null;

    const chave = infNFe.getAttribute('Id')?.slice(3) || '';
    if (!chave || chave.length !== 44) return null;

    return {
      tipo: 'nfe',
      nfe_number: helper.findElement(ide, 'nNF')?.textContent || '',
      cfop: helper.findElementDeep(infNFe, 'det/prod/CFOP')?.textContent || '',
      nat_op: helper.findElement(ide, 'natOp')?.textContent || '',
      ref_nfe: helper.findElementDeep(ide, 'NFref/refNFe')?.textContent || null,
      x_texto: helper.findElementDeep(infNFe, 'infAdic/obsCont/xTexto')?.textContent || '',
      chave,
      emit_cnpj: helper.findElement(emit, 'CNPJ')?.textContent || '',
    };
  } catch {
    return null;
  }
}

export function getEventoInfo(helper: XmlHelper): Record<string, any> | null {
  try {
    const root = helper.doc.documentElement;
    if (!root.tagName.includes('procEventoNFe')) return null;

    const tpEvento = helper.findElementDeep(root, 'evento/infEvento/tpEvento')?.textContent;
    if (tpEvento !== '110111') return null; // Apenas Cancelamento por enquanto

    const chaveCancelada = helper.findElementDeep(root, 'evento/infEvento/chNFe')?.textContent || null;
    if (!chaveCancelada) return null;

    return {
      tipo: 'cancelamento',
      chave_cancelada: chaveCancelada,
    };
  } catch {
    return null;
  }
}

export function renameFileAccordingToRules(info: Record<string, any>): string {
  const { cfop, nat_op, ref_nfe, x_texto, nfe_number } = info;
  const natOp = nat_op || '';
  const xTexto = x_texto || '';

  if (DEVOLUCOES_CFOP.includes(cfop) && ref_nfe) {
    const refNFeNum = ref_nfe.slice(25, 34).replace(/^0+/, '');
    
    if (natOp === "Retorno de mercadoria nao entregue") {
        return `${nfe_number} - Insucesso de entrega da venda ${refNFeNum}.xml`;
    }
    
    if (natOp === "Devolucao de mercadorias") {
      if (xTexto.includes("DEVOLUTION_PLACES") || xTexto.includes("SALE_DEVOLUTION")) {
          return `${nfe_number} - Devoluçao pro Mercado Livre da venda - ${refNFeNum}.xml`;
      }
      if (xTexto.includes("DEVOLUTION_devolution")) {
          return `${nfe_number} - Devolucao da venda ${refNFeNum}.xml`;
      }
    }
  } 
  
  if (VENDAS_CFOP.includes(cfop)) {
    return `${nfe_number} - Venda.xml`;
  } 
  
  if (RETORNOS_CFOP.includes(cfop) && ref_nfe) {
    const refNFeNum = ref_nfe.slice(25, 34).replace(/^0+/, '');
    if (natOp === "Outras Entradas - Retorno Simbolico de Deposito Temporario") {
        return `${nfe_number} - Retorno da remessa ${refNFeNum}.xml`;
    }
    if (natOp === "Outras Entradas - Retorno de Deposito Temporario") {
        return `${nfe_number} - Retorno Efetivo da remessa ${refNFeNum}.xml`;
    }
  } 
  
  if (REMESSAS_CFOP.includes(cfop)) {
    if (ref_nfe) {
        return `${nfe_number} - Remessa simbólica da venda ${ref_nfe.slice(25, 34).replace(/^0+/, '')}.xml`;
    }
    return `${nfe_number} - Remessa.xml`;
  }

  return ''; // Retorna vazio se não cair em nenhuma regra, mantendo o original
}