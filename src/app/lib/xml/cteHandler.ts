// Manipulação de CTe: regras de alteração de chave, datas e emitente.
// Comentários foram atualizados para português. Funções permanecem
// com nomenclatura em português para clareza.

import { XmlHelper } from "./XmlHelper";
import { ScenarioDB } from "../../../types";
import { getEmitenteMap } from "../scenarioUtils";

export function editarCte(
  helper: XmlHelper,
  scenario: ScenarioDB,
  chaveMapping: Record<string, string>,
  chaveDaVendaNova?: string
): { msg: string; alteracoes: string[] } {
  const alteracoes: string[] = [];
  const msg = "CTe processado";
  const root = helper.doc.documentElement;
  const infCte = helper.findElementDeep(root, "infCte");

  if (!infCte) return { msg, alteracoes };

  const idAtual = infCte.getAttribute("Id") || "";
  let altered = false;

  // 1. Recálculo de Chave (Data ou UF mudou)
  if (
    (scenario.editar_data && scenario.nova_data) ||
    (scenario.alterar_cUF && scenario.novo_cUF && idAtual)
  ) {
    const ufAtual = idAtual.slice(3, 5);
    const aammAtual = idAtual.slice(5, 9);
    const cnpjAtual = idAtual.slice(9, 23);

    // CORREÇÃO AQUI: O slice correto é até 46 para pegar os 23 dígitos restantes
    // (Antes estava 43, o que gerava uma chave de 40 dígitos no total)
    const restoAtual = idAtual.slice(23, 46);

    const ufNovo = scenario.novo_cUF?.padStart(2, "0") || ufAtual;
    const aammNovo = scenario.nova_data
      ? new Date(scenario.nova_data.split("/").reverse().join("-"))
          .toLocaleString("en-GB", { year: "2-digit", month: "2-digit" })
          .replace("/", "")
      : aammAtual;

    const novaChaveSemDv = `${ufNovo}${aammNovo}${cnpjAtual}${restoAtual}`;

    // Agora novaChaveSemDv terá 43 dígitos (2+4+14+23) e o cálculo funcionará
    const novaDv = helper.calcularDvChave(novaChaveSemDv);
    const novaChaveComDv = `CTe${novaChaveSemDv}${novaDv}`;

    infCte.setAttribute("Id", novaChaveComDv);
    alteracoes.push(`Chave de acesso do CTe alterada para: ${novaChaveComDv}`);
    altered = true;
  }

  // 2. Identificação
  const ide = helper.findElement(infCte, "ide");
  if (ide) {
    if (scenario.alterar_cUF && scenario.novo_cUF) {
      const tag = helper.findElement(ide, "cUF");
      if (tag) {
        tag.textContent = scenario.novo_cUF;
        alteracoes.push("CTe Identificação: <cUF> alterado");
        altered = true;
      }
    }
    if (scenario.editar_data && scenario.nova_data) {
      const dhEmiTag = helper.findElement(ide, "dhEmi");
      if (dhEmiTag) {
        const novaDh = `${
          new Date(scenario.nova_data.split("/").reverse().join("-"))
            .toISOString()
            .split("T")[0]
        }T${new Date().toLocaleTimeString("en-GB", { hour12: false })}-03:00`;
        dhEmiTag.textContent = novaDh;
        alteracoes.push(`Data de Emissão <dhEmi> alterada para ${novaDh}`);
        altered = true;
      }
    }
  }

  // 3. Referência à NFe (infDoc)
  const infDoc = helper.findElementDeep(infCte, "infCTeNorm/infDoc");
  if (infDoc) {
    const chaveTag = helper.findElementDeep(infDoc, "infNFe/chave");
    if (chaveTag) {
      let updated = false;
      if (chaveTag.textContent && chaveTag.textContent in chaveMapping) {
        chaveTag.textContent = chaveMapping[chaveTag.textContent];
        alteracoes.push(
          `Referência de NFe <chave> atualizada para: ${chaveTag.textContent}`
        );
        updated = true;
      } else if (
        chaveDaVendaNova &&
        chaveTag.textContent !== chaveDaVendaNova
      ) {
        chaveTag.textContent = chaveDaVendaNova;
        alteracoes.push(
          `Referência de NFe <chave> FORÇADA para a chave da venda: ${chaveDaVendaNova}`
        );
        updated = true;
      }
      if (updated) altered = true;
    }
  }
  // 4. Emitente
  const emitenteMap = getEmitenteMap(scenario);
  if (scenario.editar_emitente && emitenteMap) {
    const rem = helper.findElement(infCte, "rem");
    if (rem) {
      const enderRem = helper.findElement(rem, "enderReme");
      for (const [campo, valor] of Object.entries(emitenteMap)) {
        const target = [
          "xLgr",
          "nro",
          "xCpl",
          "xBairro",
          "xMun",
          "UF",
          "fone",
        ].includes(campo)
          ? enderRem
          : rem;
        if (target) {
          const tag = helper.findElement(target, campo);
          if (tag) {
            tag.textContent = valor as string;
            alteracoes.push(`Remetente: <${campo}> alterado`);
            altered = true;
          }
        }
      }
    }
  }
  // 5. Sincronizar Protocolo
  const protCte = helper.findElementDeep(root, "protCTe/infProt");
  if (protCte && infCte) {
    const chCteTag = helper.findElement(protCte, "chCTe");
    const idSemPrefixo = infCte.getAttribute("Id");
    if (chCteTag && idSemPrefixo && idSemPrefixo.startsWith("CTe")) {
      chCteTag.textContent = idSemPrefixo.slice(3);
      alteracoes.push(`protCTe/infProt/chCTe sincronizado com infCte/Id`);
      altered = true;
    }

    if (scenario.editar_data && scenario.nova_data) {
      const dhRecbtoTag = helper.findElement(protCte, "dhRecbto");
      if (dhRecbtoTag) {
        const novaDh = `${
          new Date(scenario.nova_data.split("/").reverse().join("-"))
            .toISOString()
            .split("T")[0]
        }T${new Date().toLocaleTimeString("en-GB", { hour12: false })}-03:00`;
        dhRecbtoTag.textContent = novaDh;
        alteracoes.push(`protCTe/infProt/dhRecbto alterado`);
        altered = true;
      }
    }
  }

  return { msg, alteracoes: altered ? alteracoes : [] };
}
