import Decimal from "decimal.js";
import type { XmlHelper } from "./XmlHelper";
import { VENDAS_CFOP, REMESSAS_CFOP, RETORNOS_CFOP } from "./constants";
import {
  criarBlocoIBSCBS,
  criarBlocoIBSCBSTot,
  recalculaTotaisIpi,
} from "./taxUtils";
import type { ScenarioDB } from "../../../types";

export function editarNfe(
  helper: XmlHelper,
  scenario: ScenarioDB,
  chaveMapping: Record<string, string>,
  referenceMap: Record<string, string>
): { msg: string; alteracoes: string[] } {
  const alteracoes: string[] = [];
  const root = helper.doc.documentElement;
  const infNFe = helper.findElementDeep(root, "infNFe");
  if (!infNFe) return { msg: "", alteracoes };

  const ide = helper.findElement(infNFe, "ide");
  const msg = `NFe: ${helper.findElement(ide, "nNF")?.textContent || ""}`;
  const originalKey = infNFe.getAttribute("Id")?.slice(3) || "";

  // --- Identificação ---
  if (ide) {
    if (scenario.alterar_cUF && scenario.novo_cUF) {
      const tag = helper.findElement(ide, "cUF");
      if (tag) {
        tag.textContent = scenario.novo_cUF;
        alteracoes.push("Identificação: <cUF> alterado");
      }
    }
    if (scenario.alterar_serie && scenario.nova_serie) {
      const tag = helper.findElement(ide, "serie");
      if (tag) {
        tag.textContent = scenario.nova_serie;
        alteracoes.push("Identificação: <serie> alterada");
      }
    }
  }

  // --- Emitente ---
  if (scenario.editar_emitente && scenario.emitente) {
    const emit = helper.findElement(infNFe, "emit");
    if (emit) {
      const ender = helper.findElement(emit, "enderEmit");
      for (const [campo, valor] of Object.entries(scenario.emitente)) {
        const target = [
          "xLgr",
          "nro",
          "xCpl",
          "xBairro",
          "xMun",
          "UF",
          "fone",
        ].includes(campo)
          ? ender
          : emit;
        if (target) {
          const tag = helper.findElement(target, campo);
          if (tag) {
            tag.textContent = valor as string;
            alteracoes.push(`Emitente: <${campo}> alterado`);
          }
        }
      }
    }
  }

  // --- Destinatário & Endereços ---
  const cfopGeral =
    helper.findElementDeep(infNFe, "det/prod/CFOP")?.textContent || "";
  if (scenario.editar_destinatario && scenario.destinatario && cfopGeral) {
    if (VENDAS_CFOP.includes(cfopGeral)) {
      criarOuAtualizarBlocoEndereco(
        helper,
        ide,
        "retirada",
        scenario.destinatario as any,
        alteracoes,
        "Retirada"
      );
    } else if (
      REMESSAS_CFOP.includes(cfopGeral) ||
      RETORNOS_CFOP.includes(cfopGeral)
    ) {
      criarOuAtualizarBlocoEndereco(
        helper,
        infNFe,
        "dest",
        scenario.destinatario as any,
        alteracoes,
        "Destinatário",
        "enderDest"
      );
    }
  }

  // --- Itens & Impostos ---
  let totalVBCIBSCBS = new Decimal(0);
  let totalVIBSUF = new Decimal(0);
  let totalVIBSMun = new Decimal(0);
  let totalVCBS = new Decimal(0);
  let totalVDevTrib = new Decimal(0);

  const dets = helper.findAllElements(infNFe, "det");
  for (const det of dets) {
    const prod = helper.findElement(det, "prod");
    const imposto = helper.findElement(det, "imposto");
    if (!prod || !imposto) continue;

    // Edição Produto Padrão
    if (scenario.editar_produtos && scenario.produto_padrao) {
      for (const [campo, valor] of Object.entries(scenario.produto_padrao)) {
        const tag = helper.findElement(prod, campo);
        if (tag) {
          tag.textContent = valor as string;
          alteracoes.push(`Produto: <${campo}> alterado`);
        }
      }
    }

    // Edição Impostos Padrão
    if (scenario.editar_impostos && scenario.impostos_padrao) {
      for (const [campo, valor] of Object.entries(scenario.impostos_padrao)) {
        const tag = helper.findElementDeep(imposto, campo);
        if (tag && !alteracoes.includes(`Imposto: <${campo}> alterado`)) {
          tag.textContent = valor as string;
          alteracoes.push(`Imposto: <${campo}> alterado`);
        }
      }
    }

    const cfop = helper.findElement(prod, "CFOP")?.textContent || "";

    // CST Mappings
    if (cfop && scenario.editar_cst) {
      const regras = scenario.cstMappings.find((m) => m.cfop === cfop);
      if (regras) {
        for (const [impostoNome, cstValor] of Object.entries(regras)) {
          if (impostoNome === "cfop") continue;
          const impostoTag = helper.findElement(imposto, impostoNome);
          if (impostoTag) {
            const cstTag = helper.findElementDeep(impostoTag, "CST");
            if (cstTag) {
              cstTag.textContent = cstValor as string;
              alteracoes.push(`CST do ${impostoNome} alterado`);
            }
          }
        }
      }
    }

    // Zerar IPI
    const ipiTag = helper.findElement(imposto, "IPI");
    if (ipiTag && cfop) {
      const isRemessaRetorno =
        REMESSAS_CFOP.includes(cfop) || RETORNOS_CFOP.includes(cfop);
      const isVenda = VENDAS_CFOP.includes(cfop);

      if (
        (scenario.zerar_ipi_remessa_retorno && isRemessaRetorno) ||
        (scenario.zerar_ipi_venda && isVenda)
      ) {
        ["vIPI", "vBC"].forEach((tagIpi) => {
          const tag = helper.findElementDeep(ipiTag, tagIpi);
          if (tag) tag.textContent = "0.00";
        });
        const pIpi = helper.findElementDeep(ipiTag, "pIPI");
        if (pIpi) pIpi.textContent = "0.0000";
        alteracoes.push(
          `Valores de IPI zerados (${
            isRemessaRetorno ? "Remessa/Retorno" : "Venda"
          })`
        );
      }
    }

    // Reforma Tributária
    if (scenario.reforma_tributaria && scenario.taxReformRules.length) {
      const ibscbsExistente = helper.findElement(imposto, "IBSCBS");
      if (ibscbsExistente) imposto.removeChild(ibscbsExistente);

      const valoresItem = criarBlocoIBSCBS(
        helper,
        imposto,
        prod,
        scenario.taxReformRules[0],
        alteracoes,
        scenario.aplicar_reducao_aliq
      );
      totalVBCIBSCBS = totalVBCIBSCBS.add(valoresItem.vBC);
      totalVIBSUF = totalVIBSUF.add(valoresItem.vIBSUF);
      totalVIBSMun = totalVIBSMun.add(valoresItem.vIBSMun);
      totalVCBS = totalVCBS.add(valoresItem.vCBS);
      totalVDevTrib = totalVDevTrib.add(valoresItem.vDevTrib);
    }
  }

  // Recálculos Finais
  if (scenario.zerar_ipi_remessa_retorno || scenario.zerar_ipi_venda) {
    recalculaTotaisIpi(helper, infNFe, alteracoes);
  }

  if (scenario.reforma_tributaria && scenario.taxReformRules.length) {
    const totalTag = helper.findElement(infNFe, "total");
    if (totalTag) {
      const totIBSCBSExistente = helper.findElement(totalTag, "IBSCBSTot");
      if (totIBSCBSExistente) totalTag.removeChild(totIBSCBSExistente);
      criarBlocoIBSCBSTot(
        helper,
        totalTag,
        totalVBCIBSCBS,
        totalVIBSUF,
        totalVIBSMun,
        totalVCBS,
        totalVDevTrib,
        alteracoes
      );
    }
  }

  // Data e Chaves
  if (scenario.editar_data && scenario.nova_data) {
    const novaDh = `${
      new Date(scenario.nova_data.split("/").reverse().join("-"))
        .toISOString()
        .split("T")[0]
    }T${new Date().toLocaleTimeString("en-GB", { hour12: false })}-03:00`;
    if (ide) {
      ["dhEmi", "dhSaiEnt"].forEach((tagData) => {
        const tag = helper.findElement(ide, tagData);
        if (tag) {
          tag.textContent = novaDh;
          alteracoes.push(`Data: <${tagData}> alterada`);
        }
      });
    }
    const protNFe = helper.findElementDeep(root, "protNFe/infProt");
    if (protNFe) {
      const tagRecbto = helper.findElement(protNFe, "dhRecbto");
      if (tagRecbto) {
        tagRecbto.textContent = novaDh;
        alteracoes.push("Protocolo: <dhRecbto> alterado");
      }
    }
  }

  if (originalKey in chaveMapping) {
    const novaChave = chaveMapping[originalKey];
    infNFe.setAttribute("Id", "NFe" + novaChave);
    alteracoes.push(`Chave de Acesso ID alterada para: ${novaChave}`);
    const protNFe = helper.findElementDeep(root, "protNFe/infProt");
    if (protNFe) {
      const chNFe = helper.findElement(protNFe, "chNFe");
      if (chNFe) {
        chNFe.textContent = novaChave;
        alteracoes.push("Chave de Acesso do Protocolo alterada");
      }
    }
  }

  // Referências
  if (scenario.editar_refNFe && originalKey in referenceMap) {
    const originalReferencedKey = referenceMap[originalKey];
    if (originalReferencedKey in chaveMapping) {
      const newReferencedKey = chaveMapping[originalReferencedKey];
      const refNFeTag = helper.findElementDeep(infNFe, "ide/NFref/refNFe");
      if (refNFeTag) {
        refNFeTag.textContent = newReferencedKey;
        alteracoes.push(
          `Chave de Referência alterada para: ${newReferencedKey}`
        );
      }
    }
  }

  return { msg, alteracoes };
}

function criarOuAtualizarBlocoEndereco(
  helper: XmlHelper,
  parent: Element | null,
  tagName: string,
  data: Record<string, string>,
  alteracoes: string[],
  logPrefix: string,
  enderTagName?: string
) {
  if (!parent) return;
  let bloco = helper.findElement(parent, tagName);
  if (!bloco) {
    bloco = helper.doc.createElement(tagName);
    parent.appendChild(bloco);
  }

  let enderContainer = enderTagName
    ? helper.findElement(bloco, enderTagName)
    : bloco;
  if (enderTagName && !enderContainer) {
    enderContainer = helper.doc.createElement(enderTagName);
    bloco.appendChild(enderContainer);
  }

  const camposEndereco = [
    "xLgr",
    "nro",
    "xCpl",
    "xBairro",
    "cMun",
    "xMun",
    "UF",
    "CEP",
    "cPais",
    "xPais",
    "fone",
  ];
  for (const [campo, valor] of Object.entries(data)) {
    const target = camposEndereco.includes(campo) ? enderContainer : bloco;
    let tag = helper.findElement(target, campo);
    if (!tag) tag = helper.createAndSetText(target, campo, valor);
    else tag.textContent = valor;

    alteracoes.push(`${logPrefix}: <${campo}> alterado`);
  }
}
