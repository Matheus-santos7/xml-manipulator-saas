# =====================
# Manipulador de XMLs NFe, CT-e e Inutilização
# Autor: Matheus-santos7
# =====================

import os  # Operações de sistema de arquivos
import xml.etree.ElementTree as ET  # Manipulação de XML
from datetime import datetime  # Datas e horas
import json  # Leitura de arquivos JSON
import re  # Regex para manipulação de espaços entre tags
from decimal import Decimal, ROUND_HALF_UP # Para cálculos financeiros precisos


# --- CFOPs utilizados para identificar tipos de operações ---
VENDAS_CFOP = ['5404', '6404', '5108', '6108', '5405', '6405', '5102', '6102', '5105', '6105', '5106', '6106', '5551']
DEVOLUCOES_CFOP = ['1201', '2201', '1202', '1410', '2410', '2102', '2202', '2411']
RETORNOS_CFOP = ['1949', '2949', '5902', '6902']
REMESSAS_CFOP = ['5949', '5156', '6152', '6949', '6905', '5901', '6901']


# Namespace padrão para NFe e CTe (usado nas buscas de tags XML)
NS = {'nfe': 'http://www.portalfiscal.inf.br/nfe', 'cte': 'http://www.portalfiscal.inf.br/cte'}
# Namespace para a Assinatura Digital (Digital Signature)
NS_DS = {'ds': 'http://www.w3.org/2000/09/xmldsig#'}


# Função para buscar um elemento XML com ou sem namespace
def find_element(parent, path):
    if parent is None: return None
    # Tenta com namespace nfe
    namespaced_path_nfe = '/'.join([f'nfe:{tag}' for tag in path.split('/')])
    element = parent.find(namespaced_path_nfe, NS)
    if element is not None: return element
    # Tenta com namespace cte
    namespaced_path_cte = '/'.join([f'cte:{tag}' for tag in path.split('/')])
    element = parent.find(namespaced_path_cte, NS)
    if element is not None: return element
    # Tenta sem namespace
    element = parent.find(path)
    return element


# Busca todos os elementos XML de um caminho, com ou sem namespace
def find_all_elements(parent, path):
    if parent is None: return []
    # Tenta com namespace nfe
    namespaced_path_nfe = '/'.join([f'nfe:{tag}' for tag in path.split('/')])
    elements = parent.findall(namespaced_path_nfe, NS)
    if elements: return elements
    # Tenta com namespace cte
    namespaced_path_cte = '/'.join([f'cte:{tag}' for tag in path.split('/')])
    elements = parent.findall(namespaced_path_cte, NS)
    if elements: return elements
    # Tenta sem namespace
    elements = parent.findall(path)
    return elements


# Busca profunda (em qualquer nível) de um elemento XML
def find_element_deep(parent, path):
    if parent is None: return None
    # Tenta com namespace nfe
    namespaced_path_nfe = './/' + '/'.join([f'nfe:{tag}' for tag in path.split('/')])
    element = parent.find(namespaced_path_nfe, NS)
    if element is not None: return element
    # Tenta com namespace cte
    namespaced_path_cte = './/' + '/'.join([f'cte:{tag}' for tag in path.split('/')])
    element = parent.find(namespaced_path_cte, NS)
    if element is not None: return element
    # Tenta sem namespace
    element = parent.find(f'.//{path}')
    return element


# Calcula o dígito verificador de uma chave de acesso NFe
def calcular_dv_chave(chave):
    if len(chave) != 43:
        raise ValueError(f"A chave para cálculo do DV deve ter 43 dígitos. Recebeu {len(chave)}.")
    soma, multiplicador = 0, 2
    for i in range(len(chave) - 1, -1, -1):
        soma += int(chave[i]) * multiplicador
        multiplicador += 1
        if multiplicador > 9:
            multiplicador = 2
    resto = soma % 11
    dv = 11 - resto
    return '0' if dv in [0, 1, 10, 11] else str(dv)


# Carrega o arquivo de constantes (dados das empresas)
def carregar_constantes(caminho_arquivo='constantes.json'):
    if not os.path.exists(caminho_arquivo):
        print(f"Erro: Arquivo de constantes '{caminho_arquivo}' não encontrado.")
        return None
    try:
        with open(caminho_arquivo, 'r', encoding='utf-8') as f:
            print(f"Arquivo de constantes '{caminho_arquivo}' carregado com sucesso.")
            return json.load(f)
    except Exception as e:
        print(f"Erro Crítico ao carregar '{caminho_arquivo}': {e}")
        return None


# Pergunta ao usuário qual empresa deseja manipular
def selecionar_empresa(constantes):
    empresas = list(constantes.keys())
    print("Empresas disponíveis:")
    for idx, nome in enumerate(empresas, 1):
        print(f"  {idx}. {nome}")
    while True:
        escolha = input("Digite o nome da empresa desejada: ").strip().upper()
        if escolha in empresas:
            return constantes[escolha]
        print("Empresa não encontrada. Tente novamente.")


def get_main_info_block(root):
    """Tenta encontrar o bloco de informações principal (infNFe ou infCte) e retorna o tipo."""
    
    # Tenta NF-e
    nfe = root.find('nfe:NFe', NS)
    if nfe is None: 
        nfe = root.find('NFe')
    
    if nfe is not None:
        inf_nfe = nfe.find('nfe:infNFe', NS)
        if inf_nfe is None:
             inf_nfe = nfe.find('infNFe')
        
        if inf_nfe is not None and inf_nfe.get('Id', '').startswith('NFe'):
            return inf_nfe, 'NFe'

    # Tenta CT-e
    cte = root.find('cte:CTe', NS)
    if cte is None:
        cte = root.find('CTe')
        
    if cte is not None:
        inf_cte = cte.find('cte:infCte', NS)
        if inf_cte is None:
            inf_cte = cte.find('infCte')
            
        if inf_cte is not None and inf_cte.get('Id', '').startswith('CTe'):
            return inf_cte, 'CTe'
    
    return None, None


# Extrai informações essenciais para o mapeamento da chave (todos os tipos de doc)
def _get_chave_info_for_mapping(file_path):
    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # NF-e/CT-e
        inf_block, doc_type = get_main_info_block(root)
        if doc_type in ['NFe', 'CTe']:
            chave = inf_block.get('Id', 'XXXX')[3:]
            ide = find_element(inf_block, 'ide')
            # CTe usa 'rem', NFe usa 'emit'
            emit_rem_tag = 'emit' if doc_type == 'NFe' else 'rem' 
            emit = find_element(inf_block, emit_rem_tag)
            
            # Tenta pegar o CNPJ do emitente/remetente
            cnpj = find_element(emit, 'CNPJ').text if emit is not None and find_element(emit, 'CNPJ') is not None else ''

            # nNF é o número da nota (NF-e)
            nfe_number = find_element(ide, 'nNF').text if doc_type == 'NFe' and find_element(ide, 'nNF') is not None else None
            # ref_nfe é a chave referenciada (apenas NFe)
            ref_nfe_elem = find_element_deep(ide, 'NFref/refNFe') if doc_type == 'NFe' else None
            ref_nfe = ref_nfe_elem.text if ref_nfe_elem is not None else None

            return {
                'doc_type': doc_type,
                'caminho_completo': file_path,
                'chave': chave,
                'emit_cnpj': cnpj,
                'nfe_number': nfe_number,
                'ref_nfe': ref_nfe
            }
        
        # Inutilização
        elif 'procInutNFe' in root.tag or 'inutNFe' in root.tag:
            inf_inut = find_element_deep(root, 'inutNFe/infInut') or find_element_deep(root, 'retInutNFe/infInut')
            if inf_inut is not None:
                chave_id = inf_inut.get('Id', 'XXXX')
                # A ID de inutilização não é uma chave de 44 dígitos, mas a tratamos como tal para mapeamento
                return {
                    'doc_type': 'Inutilizacao',
                    'caminho_completo': file_path,
                    'chave': chave_id,
                    'emit_cnpj': find_element(inf_inut, 'CNPJ').text if find_element(inf_inut, 'CNPJ') is not None else '',
                    'nfe_number': None,
                    'ref_nfe': None
                }

        return None
    except Exception:
        return None

# Extrai informações relevantes de um XML de NFe para renomeação e manipulação
def get_xml_info(file_path):
    try:
        ET.register_namespace('', NS['nfe'])
        tree = ET.parse(file_path)
        root = tree.getroot()
        if 'procEventoNFe' in root.tag or 'cte' in root.tag.lower():
            return None
        inf_nfe = find_element_deep(root, 'infNFe')
        if inf_nfe is None:
            return None
        ide = find_element(inf_nfe, 'ide')
        emit = find_element(inf_nfe, 'emit')
        if ide is None or emit is None:
            return None
        chave = inf_nfe.get('Id', 'NFe')[3:]
        if not chave or len(chave) != 44: # Chave com DV
            return None
        cnpj = find_element(emit, 'CNPJ')
        n_nf = find_element(ide, 'nNF')
        cfop = find_element_deep(inf_nfe, 'det/prod/CFOP')
        nat_op = find_element(ide, 'natOp')
        ref_nfe_elem = find_element_deep(ide, 'NFref/refNFe')
        x_texto = find_element_deep(inf_nfe, 'infAdic/obsCont/xTexto')
        return {
            'tipo': 'nfe',
            'caminho_completo': file_path,
            'nfe_number': n_nf.text if n_nf is not None else '',
            'cfop': cfop.text if cfop is not None else '',
            'nat_op': nat_op.text if nat_op is not None else '',
            'ref_nfe': ref_nfe_elem.text if ref_nfe_elem is not None else None,
            'x_texto': x_texto.text if x_texto is not None else '',
            'chave': chave, # Chave com DV (44 digitos)
            'emit_cnpj': cnpj.text if cnpj is not None else ''
        }
    except Exception:
        return None


# Extrai informações de eventos de cancelamento de NFe
def get_evento_info(file_path):
    try:
        ET.register_namespace('', NS['nfe'])
        tree = ET.parse(file_path)
        root = tree.getroot()
        if 'procEventoNFe' not in root.tag:
            return None
        tp_evento = find_element_deep(root, 'evento/infEvento/tpEvento')
        if tp_evento is None or tp_evento.text != '110111':
            return None
        chave_cancelada_elem = find_element_deep(root, 'evento/infEvento/chNFe')
        if chave_cancelada_elem is None:
            return None
        return {
            'tipo': 'cancelamento',
            'caminho_completo': file_path,
            'chave_cancelada': chave_cancelada_elem.text
        }
    except Exception:
        return None

# --- Função principal de processamento e manipulação dos arquivos XML ---
def processar_arquivos(folder_path):
    print("\n========== ETAPA 1: ORGANIZAÇÃO E RENOMEAÇÃO DOS ARQUIVOS ==========")
    xmls = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.endswith('.xml')]
    if not xmls:
        print("Nenhum arquivo XML encontrado na pasta para processar.")
        return

    print("Buscando arquivos XML para renomear...")

    nfe_infos, eventos_info = _extrair_infos_xmls(xmls)
    total_renomeados, total_puladas, total_erros = 0, 0, 0

    resultado_nfe = _renomear_nfe(nfe_infos, folder_path)
    total_renomeados += resultado_nfe['renomeados']
    total_puladas += resultado_nfe['pulados']
    total_erros += resultado_nfe['erros']

    resultado_eventos = _renomear_eventos(eventos_info, nfe_infos, folder_path)
    total_renomeados += resultado_eventos['renomeados']
    total_erros += resultado_eventos['erros']

    _resumir_renomeacao(total_renomeados, total_puladas, total_erros)

def _extrair_infos_xmls(xmls):
    nfe_infos = {}
    eventos_info = []
    for file_path in xmls:
        info = get_xml_info(file_path)
        if info is not None:
            nfe_infos[info['nfe_number']] = info
            continue
        evento = get_evento_info(file_path)
        if evento is not None:
            eventos_info.append(evento)
    return nfe_infos, eventos_info

def _renomear_nfe(nfe_infos, folder_path):
    total_renomeados, total_puladas, total_erros = 0, 0, 0
    for nfe_number, info in nfe_infos.items():
        novo_nome = _gerar_novo_nome_nfe(info)
        if novo_nome is not None:
            caminho_novo_nome = os.path.join(folder_path, novo_nome)
            if not os.path.exists(caminho_novo_nome):
                try:
                    os.rename(info['caminho_completo'], caminho_novo_nome)
                    print(f"  [OK] {os.path.basename(info['caminho_completo'])} -> {novo_nome}")
                    total_renomeados += 1
                except Exception as e:
                    print(f"  [ERRO] Falha ao renomear {os.path.basename(info['caminho_completo'])}: {e}")
                    total_erros += 1
            elif os.path.basename(info['caminho_completo']) != novo_nome:
                print(f"  [PULADO] '{os.path.basename(info['caminho_completo'])}' já possui destino '{novo_nome}'.")
                total_puladas += 1
    return {'renomeados': total_renomeados, 'pulados': total_puladas, 'erros': total_erros}

def _gerar_novo_nome_nfe(info):
    cfop = info.get('cfop')
    nat_op = info.get('nat_op', '')
    ref_nfe = info.get('ref_nfe')
    x_texto = info.get('x_texto', '')
    nfe_number = info.get('nfe_number', '')
    if cfop in DEVOLUCOES_CFOP and ref_nfe is not None:
        ref_nfe_num = ref_nfe[25:34].lstrip('0')
        if nat_op == "Retorno de mercadoria nao entregue":
            return f"{nfe_number} - Insucesso de entrega da venda {ref_nfe_num}.xml"
        elif nat_op == "Devolucao de mercadorias":
            if x_texto is not None and ("DEVOLUTION_PLACES" in x_texto or "SALE_DEVOLUTION" in x_texto):
                return f"{nfe_number} - Devoluçao pro Mercado Livre da venda - {ref_nfe_num}.xml"
            elif x_texto is not None and "DEVOLUTION_devolution" in x_texto:
                return f"{nfe_number} - Devolucao da venda {ref_nfe_num}.xml"
    elif cfop in VENDAS_CFOP:
        return f"{nfe_number} - Venda.xml"
    elif cfop in RETORNOS_CFOP and ref_nfe is not None:
        ref_nfe_num = ref_nfe[25:34].lstrip('0')
        if nat_op == "Outras Entradas - Retorno Simbolico de Deposito Temporario":
            return f"{nfe_number} - Retorno da remessa {ref_nfe_num}.xml"
        elif nat_op == "Outras Entradas - Retorno de Deposito Temporario":
            return f"{nfe_number} - Retorno Efetivo da remessa {ref_nfe_num}.xml"
    elif cfop in REMESSAS_CFOP:
        if ref_nfe is not None:
            return f"{nfe_number} - Remessa simbólica da venda {ref_nfe[25:34].lstrip('0')}.xml"
        else:
            return f"{nfe_number} - Remessa.xml"
    return None

def _renomear_eventos(eventos_info, nfe_infos, folder_path):
    total_renomeados, total_erros = 0, 0
    chave_to_nfe_map = {info['chave']: info['nfe_number'] for info in nfe_infos.values()}
    for evento in eventos_info:
        chave_cancelada = evento['chave_cancelada']
        nfe_number_cancelado = chave_to_nfe_map.get(chave_cancelada)
        if nfe_number_cancelado is not None:
            novo_nome = f"CAN-{nfe_number_cancelado}.xml"
            caminho_novo_nome = os.path.join(folder_path, novo_nome)
            if not os.path.exists(caminho_novo_nome):
                try:
                    os.rename(evento['caminho_completo'], caminho_novo_nome)
                    print(f"  [OK] Evento {os.path.basename(evento['caminho_completo'])} -> {novo_nome}")
                    total_renomeados += 1
                except Exception as e:
                    print(f"  [ERRO] Falha ao renomear evento {os.path.basename(evento['caminho_completo'])}: {e}")
                    total_erros += 1
    return {'renomeados': total_renomeados, 'erros': total_erros}

def _resumir_renomeacao(total_renomeados, total_puladas, total_erros):
    print(f"\nResumo: {total_renomeados} renomeados, {total_puladas} pulados, {total_erros} erros.")
    print("====================================================================\n")


def editar_arquivos(folder_path, constantes_empresa):
    print("\n========== ETAPA 2: MANIPULAÇÃO E EDIÇÃO DOS ARQUIVOS ==========")
    arquivos = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.endswith('.xml')]
    if not arquivos:
        print("Nenhum arquivo XML encontrado na pasta para edição.")
        return

    ET.register_namespace('', NS['nfe'])
    ET.register_namespace('ds', NS_DS['ds'])

    cfg = constantes_empresa.get('alterar', {})
    alterar_emitente = cfg.get('emitente', False)
    alterar_produtos = cfg.get('produtos', False)
    alterar_impostos = cfg.get('impostos', False)
    alterar_data = cfg.get('data', False)
    alterar_ref_nfe = cfg.get('refNFe', False)
    alterar_cst = cfg.get('cst', False)
    alterar_destinatario = cfg.get('destinatario', False)
    zerar_ipi_remessa_retorno = cfg.get('zerar_ipi_remessa_retorno', False)
    zerar_ipi_venda = cfg.get('zerar_ipi_venda', False)
    alterar_reforma_tributaria = cfg.get('reforma_tributaria', False)
    alterar_serie = cfg.get('serie', False)
    alterar_cUF = cfg.get('cUF', False)

    novo_emitente = constantes_empresa.get('emitente')
    novo_destinatario = constantes_empresa.get('destinatario')
    novo_produto = constantes_empresa.get('produto')
    novos_impostos = constantes_empresa.get('impostos')
    nova_data_str = constantes_empresa.get('data', {}).get('nova_data')
    mapeamento_cst = constantes_empresa.get('mapeamento_cst', {})
    config_reforma_trib = constantes_empresa.get('reforma_tributaria') if alterar_reforma_tributaria is True else None
    novos_dados_ide = constantes_empresa.get('reforma_tributaria', {}).get('identificacao') or constantes_empresa.get('identificacao', {})
    
    # --- PREPARAÇÃO DE MAPAS DE CHAVES (INCLUINDO CT-E) ---
    chave_mapping, reference_map, chave_da_venda_nova = _prepara_mapeamentos(
        arquivos, alterar_emitente, alterar_data, novo_emitente, nova_data_str,
        alterar_cUF, alterar_serie, novos_dados_ide 
    )
    # --- FIM PREPARAÇÃO ---

    total_editados, total_erros = 0, 0
    for file_path in arquivos:
        tree = None
        
        # Lógica de robustez para lidar com arquivos malformados (como o seu retorno.xml)
        try:
            parser = ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))
            tree = ET.parse(file_path, parser)
        except ET.ParseError as pe:
            # Se a leitura falhar, tenta limpar o início do arquivo e reprocessar
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                # Remove caracteres não XML válidos do início
                cleaned_content = re.sub(r'^[^<]*<', '<', content.lstrip()) 
                # Tenta analisar o conteúdo limpo
                root_cleaned = ET.fromstring(cleaned_content)
                tree = ET.ElementTree(root_cleaned)
                print(f"[AVISO] '{os.path.basename(file_path)}' corrigido (malformação inicial) e lido.")
            except Exception as inner_e:
                print(f"\n[ERRO] Falha crítica ao editar {os.path.basename(file_path)}: O XML está malformado e não pôde ser corrigido. ({inner_e})")
                total_erros += 1
                continue # Pula este arquivo

        root = tree.getroot()
        alteracoes, msg = [], ""

        try:
            if 'procInutNFe' in root.tag:
                msg, alteracoes = _editar_inutilizacao(
                    root, alterar_emitente, novo_emitente, alterar_data, nova_data_str,
                    alterar_cUF, novos_dados_ide.get('novo_cUF'),
                    alterar_serie, novos_dados_ide.get('nova_serie')
                )
            elif 'cteProc' in root.tag or 'CTe' in root.tag:
                msg, alteracoes = _editar_cte(
                    root, file_path, chave_mapping,
                    chave_da_venda_nova=chave_da_venda_nova,
                    alterar_remetente=alterar_emitente, # Mapeia alteração de emitente para remetente
                    novo_remetente=novo_emitente,
                    alterar_data=alterar_data,
                    nova_data_str=nova_data_str,
                    alterar_cUF=alterar_cUF,
                    novo_cUF_val=novos_dados_ide.get('novo_cUF')
                )
            elif 'procEventoNFe' in root.tag:
                alteracoes = _editar_cancelamento(root, chave_mapping, alterar_data, nova_data_str)
                if alteracoes:
                    print(f"\n[OK] Evento de Cancelamento: {os.path.basename(file_path)}")
                    for a in sorted(set(alteracoes)):
                        print(f"   - {a}")
                    total_editados += 1
                    _salvar_xml(root, file_path)
                continue
            else:
                msg, alteracoes = _editar_nfe(
                    root, alterar_emitente, novo_emitente, alterar_produtos, novo_produto,
                    alterar_impostos, novos_impostos, alterar_cst, mapeamento_cst,
                    zerar_ipi_remessa_retorno, zerar_ipi_venda, alterar_data, nova_data_str,
                    chave_mapping, alterar_ref_nfe, reference_map,
                    alterar_destinatario, novo_destinatario,
                    alterar_reforma_tributaria, config_reforma_trib,
                    alterar_serie, alterar_cUF, novos_dados_ide
                )

            if alteracoes:
                print(f"\n[OK] {msg}")
                for a in sorted(set(alteracoes)):
                    print(f"   - {a}")
                total_editados += 1
                _salvar_xml(root, file_path)

        except Exception as e:
            # Captura de erro final
            print(f"\n[ERRO] Falha ao editar {os.path.basename(file_path)}: {e}")
            total_erros += 1

    print(f"\nResumo: {total_editados} arquivos editados, {total_erros} erros.")
    print("====================================================================\n")

# --- FUNÇÃO AUXILIAR ---
def _criar_ou_atualizar_bloco_endereco(parent, tag_name, data, alteracoes, log_prefix, ender_tag_name=None):
    """Cria ou atualiza um bloco de dados (ex: <dest>, <retirada>) no XML."""
    bloco = find_element(parent, tag_name)
    if bloco is None:
        bloco = ET.SubElement(parent, tag_name)
    
    if ender_tag_name:
        ender_container = find_element(bloco, ender_tag_name)
        if ender_container is None:
            ender_container = ET.SubElement(bloco, ender_tag_name)
    else:
        ender_container = bloco

    campos_endereco = ['xLgr', 'nro', 'xCpl', 'xBairro', 'cMun', 'xMun', 'UF', 'CEP', 'cPais', 'xPais', 'fone']
    
    for campo, valor in data.items():
        target_element = ender_container if campo in campos_endereco else bloco
        
        tag = find_element(target_element, campo)
        if tag is None:
            tag = ET.SubElement(target_element, campo)
        
        tag.text = str(valor)
        alteracoes.append(f"{log_prefix}: <{campo}> alterado")

# --- FUNÇÕES AUXILIARES PARA REFORMA TRIBUTÁRIA ---

def _create_and_set_text(parent, tag_name, text):
    """Cria um SubElemento com texto, garantindo que não seja None."""
    tag = ET.SubElement(parent, tag_name)
    tag.text = str(text) if text is not None else ""
    return tag

def _criar_bloco_ibscbs(imposto_tag, prod_tag, config, alteracoes):
    """
    Cria e anexa o bloco <IBSCBS> dentro da tag <imposto> de um item.
    Retorna os valores calculados para a totalização.
    """
    cfg_item = config.get('impostos_item', {})
    vProd_tag = find_element(prod_tag, 'vProd')
    
    if vProd_tag is None or vProd_tag.text is None:
        return {'vBC': Decimal('0.00'), 'vIBSUF': Decimal('0.00'), 'vIBSMun': Decimal('0.00'), 'vCBS': Decimal('0.00'), 'vDevTrib': Decimal('0.00')}

    vBC = Decimal(vProd_tag.text)
    pIBSUF = Decimal(cfg_item.get('pIBSUF', '0.00'))
    pIBSMun = Decimal(cfg_item.get('pIBSMun', '0.00'))
    pCBS = Decimal(cfg_item.get('pCBS', '0.00'))
    vDevTrib = Decimal(cfg_item.get('vDevTrib', '0.00'))
    
    quant = Decimal('0.01')
    vIBSUF = (vBC * pIBSUF / Decimal('100.00')).quantize(quant, rounding=ROUND_HALF_UP)
    vIBSMun = (vBC * pIBSMun / Decimal('100.00')).quantize(quant, rounding=ROUND_HALF_UP)
    vCBS = (vBC * pCBS / Decimal('100.00')).quantize(quant, rounding=ROUND_HALF_UP)

    ibscbs = ET.SubElement(imposto_tag, 'IBSCBS')
    _create_and_set_text(ibscbs, 'CST', cfg_item.get('CST', '000'))
    _create_and_set_text(ibscbs, 'cClassTrib', cfg_item.get('cClassTrib', '000001'))
    
    gIBSCBS = ET.SubElement(ibscbs, 'gIBSCBS')
    _create_and_set_text(gIBSCBS, 'vBC', f"{vBC:.2f}")

    gIBSUF = ET.SubElement(gIBSCBS, 'gIBSUF')
    _create_and_set_text(gIBSUF, 'pIBSUF', f"{pIBSUF:.2f}")
    gDevTribUF = ET.SubElement(gIBSUF, 'gDevTrib')
    _create_and_set_text(gDevTribUF, 'vDevTrib', f"{vDevTrib:.2f}")
    _create_and_set_text(gIBSUF, 'vIBSUF', f"{vIBSUF:.2f}")

    gIBSMun = ET.SubElement(gIBSCBS, 'gIBSMun')
    _create_and_set_text(gIBSMun, 'pIBSMun', f"{pIBSMun:.2f}")
    gDevTribMun = ET.SubElement(gIBSMun, 'gDevTrib')
    _create_and_set_text(gDevTribMun, 'vDevTrib', "0.00")
    _create_and_set_text(gIBSMun, 'vIBSMun', f"{vIBSMun:.2f}")

    gCBS = ET.SubElement(gIBSCBS, 'gCBS')
    _create_and_set_text(gCBS, 'pCBS', f"{pCBS:.2f}")
    gDevTribCBS = ET.SubElement(gCBS, 'gDevTrib')
    _create_and_set_text(gDevTribCBS, 'vDevTrib', "0.00")
    _create_and_set_text(gCBS, 'vCBS', f"{vCBS:.2f}")

    alteracoes.append("Imposto: Bloco <IBSCBS> adicionado ao item")
    
    return {'vBC': vBC, 'vIBSUF': vIBSUF, 'vIBSMun': vIBSMun, 'vCBS': vCBS, 'vDevTrib': vDevTrib}

def _criar_bloco_ibscbs_tot(total_tag, config, vBC, vIBSUF, vIBSMun, vCBS, vDevTrib, alteracoes):
    """Cria e anexa o bloco <IBSCBSTot> dentro da tag <total>."""
    
    cfg_totais = config.get('totais', {})
    vDif = cfg_totais.get('vDifDefault', '0.00')
    vCredPres = cfg_totais.get('vCredPres', '0.00')
    vCredPresCondSus = cfg_totais.get('vCredPresCondSus', '0.00')
    vIBS_total = vIBSUF + vIBSMun

    ibscbs_tot = ET.SubElement(total_tag, 'IBSCBSTot')
    _create_and_set_text(ibscbs_tot, 'vBCIBSCBS', f"{vBC:.2f}")

    gIBS = ET.SubElement(ibscbs_tot, 'gIBS')
    gIBSUF = ET.SubElement(gIBS, 'gIBSUF')
    _create_and_set_text(gIBSUF, 'vDif', vDif)
    _create_and_set_text(gIBSUF, 'vDevTrib', f"{vDevTrib:.2f}")
    _create_and_set_text(gIBSUF, 'vIBSUF', f"{vIBSUF:.2f}")
    
    gIBSMun = ET.SubElement(gIBS, 'gIBSMun')
    _create_and_set_text(gIBSMun, 'vDif', vDif)
    _create_and_set_text(gIBSMun, 'vDevTrib', "0.00")
    _create_and_set_text(gIBSMun, 'vIBSMun', f"{vIBSMun:.2f}")
    
    _create_and_set_text(gIBS, 'vIBS', f"{vIBS_total:.2f}")
    _create_and_set_text(gIBS, 'vCredPres', vCredPres)
    _create_and_set_text(gIBS, 'vCredPresCondSus', vCredPresCondSus)
    
    gCBS = ET.SubElement(ibscbs_tot, 'gCBS')
    _create_and_set_text(gCBS, 'vDif', vDif)
    _create_and_set_text(gCBS, 'vDevTrib', "0.00")
    _create_and_set_text(gCBS, 'vCBS', f"{vCBS:.2f}")
    _create_and_set_text(gCBS, 'vCredPres', vCredPres)
    _create_and_set_text(gCBS, 'vCredPresCondSus', vCredPresCondSus)

    alteracoes.append("Total: Bloco <IBSCBSTot> adicionado")


# --- FUNÇÕES PRINCIPAIS DE EDIÇÃO ---

def _prepara_mapeamentos(arquivos, alterar_emitente, alterar_data, novo_emitente, nova_data_str,
                         alterar_cUF, alterar_serie, novos_dados_ide):
    chave_mapping, reference_map = {}, {}
    chave_da_venda_nova = None

    # Busca informações de todos os tipos de documentos (NF-e, CT-e, Inutilização)
    all_doc_infos = []
    for f in arquivos:
        try:
            info = _get_chave_info_for_mapping(f)
            if info is not None and len(info['chave']) >= 43:
                 all_doc_infos.append(info)
        except Exception:
            pass # Ignora arquivos que não puderam ser lidos ou mapeados

    # Mapeamento de nNF para Chave (Apenas NF-e)
    nNF_to_key_map = {}
    for info in all_doc_infos:
        if info['doc_type'] == 'NFe' and info['nfe_number'] is not None:
            nNF_to_key_map[info['nfe_number']] = info['chave']

    for info in all_doc_infos:
        # Pula inutilização
        if info['doc_type'] == 'Inutilizacao':
             continue
             
        original_key_com_dv = info['chave']
        original_key = original_key_com_dv[:-1] # Chave de 43 digitos
        doc_type = info['doc_type']

        # Mapeamento de Referência (Só NF-e referenciando NF-e)
        if doc_type == 'NFe' and info['ref_nfe'] is not None:
            referenced_nNF = info['ref_nfe'][25:34].lstrip('0')
            if referenced_nNF in nNF_to_key_map:
                reference_map[original_key_com_dv] = nNF_to_key_map[referenced_nNF]
        
        # --- Lógica de cálculo da nova chave (aplicável a NF-e e CT-e) ---
        if alterar_emitente is True or alterar_data is True or alterar_cUF is True or alterar_serie is True:
            cnpj_original = info.get('emit_cnpj', '')
            
            # Se for para alterar o emitente, usa o CNPJ novo, senão, mantém o original
            novo_cnpj_raw = novo_emitente.get('CNPJ', cnpj_original) if alterar_emitente is True and novo_emitente is not None else cnpj_original
            novo_cnpj_num = ''.join(filter(str.isdigit, novo_cnpj_raw))

            # Obtém CNPJ (14 dígitos) e AAMM (4 dígitos)
            novo_ano_mes = datetime.strptime(nova_data_str, "%d/%m/%Y").strftime('%y%m') if (alterar_data is True and nova_data_str is not None) else original_key[2:6]
            
            # Extrai partes da chave
            # Estrutura NFe/CTe: [cUF(2)][AAMM(4)][CNPJ(14)][mod(2)][serie(3)][n(9)][tpEmis(1)][cNF/cCT(8)]
            uf_index, aamm_index, cnpj_index, mod_index, serie_index, n_doc_index, tp_emis_index, c_nf_index = 0, 2, 6, 20, 22, 25, 34, 35
            
            novo_cUF_chave = novos_dados_ide.get('novo_cUF', original_key[uf_index:aamm_index]).zfill(2) if alterar_cUF is True and novos_dados_ide is not None else original_key[uf_index:aamm_index]
            mod = original_key[mod_index:mod_index+2]
            nova_serie_chave = novos_dados_ide.get('nova_serie', original_key[serie_index:serie_index+3]).zfill(3) if alterar_serie is True and novos_dados_ide is not None else original_key[serie_index:serie_index+3]
            nNF = original_key[n_doc_index:n_doc_index+9]
            tpEmis = original_key[tp_emis_index:tp_emis_index+1]
            cNF = original_key[c_nf_index:c_nf_index+8]

            nova_chave_sem_dv = (f"{novo_cUF_chave}{novo_ano_mes}{novo_cnpj_num.zfill(14)}"
                                 f"{mod}{nova_serie_chave}{nNF}{tpEmis}{cNF}")
            
            if len(nova_chave_sem_dv) != 43:
                 continue # Pula se a chave não tiver 43 dígitos.

            nova_chave_com_dv = nova_chave_sem_dv + calcular_dv_chave(nova_chave_sem_dv)
            chave_mapping[original_key_com_dv] = nova_chave_com_dv

            if doc_type == 'NFe' and "Venda.xml" in info['caminho_completo']:
                chave_da_venda_nova = nova_chave_com_dv
    
    return chave_mapping, reference_map, chave_da_venda_nova


def _editar_inutilizacao(root, alterar_emitente, novo_emitente, alterar_data, nova_data_str,
                         alterar_cUF, novo_cUF_val, alterar_serie, nova_serie_val):
    alteracoes, msg = [], f"Inutilização: {root.tag}"
    ano_novo, cnpj_novo, cUF_novo, serie_nova = None, None, None, None
    
    inf_inut_fields = find_element_deep(root, 'inutNFe/infInut') or find_element_deep(root, 'retInutNFe/infInut')
    
    if inf_inut_fields is not None:
        if alterar_emitente is True and novo_emitente is not None:
            cnpj_tag = find_element(inf_inut_fields, 'CNPJ')
            if cnpj_tag is not None:
                cnpj_novo = novo_emitente.get('CNPJ')
                cnpj_tag.text = cnpj_novo
                alteracoes.append("Inutilização: <CNPJ> alterado")
        
        if alterar_data is True and nova_data_str is not None:
            nova_data_obj = datetime.strptime(nova_data_str, "%d/%m/%Y")
            ano_tag = find_element(inf_inut_fields, 'ano')
            if ano_tag is not None:
                ano_novo = nova_data_obj.strftime('%y')
                ano_tag.text = ano_novo
                alteracoes.append("Inutilização: <ano> alterado")
        
        if alterar_cUF is True and novo_cUF_val is not None:
            cUF_tag = find_element(inf_inut_fields, 'cUF')
            if cUF_tag is not None:
                cUF_tag.text = novo_cUF_val
                cUF_novo = novo_cUF_val
                alteracoes.append("Inutilização: <cUF> alterado")
                
        if alterar_serie is True and nova_serie_val is not None:
            serie_tag = find_element(inf_inut_fields, 'serie')
            if serie_tag is not None:
                serie_tag.text = nova_serie_val
                serie_nova = nova_serie_val.zfill(3)
                alteracoes.append("Inutilização: <serie> alterada")

    if alterar_data is True:
        dh_recbto_tag = find_element_deep(root, 'retInutNFe/infInut/dhRecbto')
        if dh_recbto_tag is not None and nova_data_str is not None:
            nova_data_fmt = datetime.strptime(nova_data_str, "%d/%m/%Y").strftime(f'%Y-%m-%dT{datetime.now().strftime("%H:%M:%S")}-03:00')
            dh_recbto_tag.text = nova_data_fmt
            alteracoes.append("Inutilização: <dhRecbto> alterado")

    inf_inut_id = find_element_deep(root, 'inutNFe/infInut')
    if inf_inut_id is not None:
        id_atual = inf_inut_id.get('Id')
        if id_atual is not None and (ano_novo is not None or cnpj_novo is not None or cUF_novo is not None or serie_nova is not None):
            # ID[cUF(2)][Ano(2)][CNPJ(14)][mod(2)][serie(3)][nNFIni(9)][nNFFin(9)]
            uf = cUF_novo if cUF_novo is not None else id_atual[2:4]
            ano = ano_novo if ano_novo is not None else id_atual[4:6]
            cnpj = ''.join(filter(str.isdigit, cnpj_novo)) if cnpj_novo is not None else id_atual[6:20]
            mod = id_atual[20:22]
            serie = serie_nova if serie_nova is not None else id_atual[22:25]
            nNFIni, nNFFin = id_atual[25:34], id_atual[34:43]
            nova_chave = f"ID{uf}{ano}{cnpj.zfill(14)}{mod}{serie}{nNFIni}{nNFFin}"
            inf_inut_id.set('Id', nova_chave)
            alteracoes.append(f"Inutilização: <Id> alterado para {nova_chave}")
    return msg, alteracoes


def _editar_cte(root, file_path, chave_mapping, chave_da_venda_nova=None, alterar_remetente=False, novo_remetente=None, alterar_data=False, nova_data_str=None,
                alterar_cUF=False, novo_cUF_val=None):
    alteracoes, msg = [], f"CTe: {os.path.basename(file_path)}"
    inf_cte = find_element_deep(root, 'infCte')
    if inf_cte is None: return msg, alteracoes
    alterou = False
    
    id_atual = inf_cte.get('Id')
    chave_original = id_atual[3:] if id_atual is not None and len(id_atual) > 3 else ''

    # --- ATUALIZAÇÃO DA CHAVE PRINCIPAL (baseada no mapeamento) ---
    if chave_original in chave_mapping:
        nova_chave_com_dv = chave_mapping[chave_original]
        inf_cte.set('Id', "CTe" + nova_chave_com_dv)
        alteracoes.append(f"Chave de acesso do CTe alterada para: {nova_chave_com_dv}")
        alterou = True
    
    ide = find_element(inf_cte, 'ide')
    if ide is not None:
        if alterar_cUF is True and novo_cUF_val is not None:
            tag = find_element(ide, 'cUF')
            if tag is not None:
                tag.text = novo_cUF_val
                alteracoes.append("CTe Identificação: <cUF> alterado")
                alterou = True
        
        if alterar_data is True and nova_data_str is not None:
            dh_emi_tag = find_element(ide, 'dhEmi')
            if dh_emi_tag is not None:
                nova_data_fmt = datetime.strptime(nova_data_str, "%d/%m/%Y").strftime(f'%Y-%m-%dT{datetime.now().strftime("%H:%M:%S")}-03:00')
                dh_emi_tag.text = nova_data_fmt
                alteracoes.append(f"Data de Emissão <dhEmi> alterada para {nova_data_fmt}")
                alterou = True

    inf_doc = find_element_deep(inf_cte, 'infCTeNorm/infDoc')
    if inf_doc is not None:
        chave_tag = find_element_deep(inf_doc, 'infNFe/chave')
        if chave_tag is not None:
            # Tenta atualizar pela chave mapeada (venda)
            if chave_tag.text in chave_mapping:
                 chave_tag.text = chave_mapping[chave_tag.text]
                 alteracoes.append(f"Referência de NFe <chave> atualizada para: {chave_mapping[chave_tag.text]}")
                 alterou = True
            # Se não, tenta forçar pela chave da venda (se existir)
            elif chave_da_venda_nova is not None and chave_tag.text != chave_da_venda_nova:
                chave_tag.text = chave_da_venda_nova
                alteracoes.append(f"Referência de NFe <chave> FORÇADA para a chave da venda: {chave_da_venda_nova}")
                alterou = True
            elif chave_da_venda_nova is None and not (chave_tag.text in chave_mapping):
                 alteracoes.append("[AVISO] Nova chave da nota de venda não foi encontrada para referenciar no CT-e.")


    if alterar_remetente is True and novo_remetente is not None:
        rem = find_element(inf_cte, 'rem')
        if rem is not None:
            ender_rem = find_element(rem, 'enderReme')
            for campo, valor in novo_remetente.items():
                target_element = ender_rem if campo in ['xLgr', 'nro', 'xCpl', 'xBairro', 'xMun', 'UF', 'fone'] else rem
                if target_element is not None:
                    tag = find_element(target_element, campo)
                    if tag is not None:
                        tag.text, alterou = str(valor), True
                        alteracoes.append(f"Remetente: <{campo}> alterado")
    
    prot_cte = find_element_deep(root, 'protCTe/infProt')
    if prot_cte is not None and inf_cte is not None:
        chcte_tag = find_element(prot_cte, 'chCTe')
        id_sem_prefixo = inf_cte.get('Id')
        if chcte_tag is not None and id_sem_prefixo is not None and id_sem_prefixo.startswith('CTe'):
            chcte_tag.text = id_sem_prefixo[3:]
            alteracoes.append(f"protCTe/infProt/chCTe sincronizado com infCte/Id: {chcte_tag.text}")
            alterou = True

    if prot_cte is not None and alterar_data is True and nova_data_str is not None:
        dhrecbto_tag = find_element(prot_cte, 'dhRecbto')
        if dhrecbto_tag is not None:
            nova_data_fmt = datetime.strptime(nova_data_str, "%d/%m/%Y").strftime(f'%Y-%m-%dT{datetime.now().strftime("%H:%M:%S")}-03:00')
            dhrecbto_tag.text = nova_data_fmt
            alteracoes.append(f"protCTe/infProt/dhRecbto alterado para {nova_data_fmt}")
            alterou = True

    return msg, alteracoes if alterou is True else []


def _editar_cancelamento(root, chave_mapping, alterar_data=False, nova_data_str=None):
    alteracoes = []
    chnfe_tag = find_element_deep(root, 'evento/infEvento/chNFe')
    if chnfe_tag is not None and chnfe_tag.text in chave_mapping:
        chnfe_tag.text = chave_mapping[chnfe_tag.text]
        alteracoes.append(f"chNFe alterado para nova chave: {chnfe_tag.text}")

    if alterar_data is True and nova_data_str is not None:
        nova_data_fmt = datetime.strptime(nova_data_str, "%d/%m/%Y").strftime(f'%Y-%m-%dT{datetime.now().strftime("%H:%M:%S")}-03:00')
        dh_evento_tag = find_element_deep(root, 'evento/infEvento/dhEvento')
        if dh_evento_tag is not None:
            dh_evento_tag.text = nova_data_fmt
            alteracoes.append(f"dhEvento alterado para {nova_data_fmt}")

        dhrecbto_tag = find_element_deep(root, 'retEvento/infEvento/dhRecbto')
        if dhrecbto_tag is not None:
            dhrecbto_tag.text = nova_data_fmt
            alteracoes.append(f"dhRecbto alterado para {nova_data_fmt}")

        dhreg_tag = find_element_deep(root, 'retEvento/infEvento/dhRegEvento')
        if dhreg_tag is not None and alterar_data is True and nova_data_str is not None:
            dhreg_tag.text = nova_data_fmt
            alteracoes.append(f"dhRegEvento alterado para {nova_data_fmt}")

    if chnfe_tag is not None:
        chave_antiga = chnfe_tag.text
        if chave_antiga in chave_mapping:
            chnfe_tag.text = chave_mapping[chave_antiga]
            alteracoes.append(f"chNFe (principal) alterado para nova chave: {chave_mapping[chave_antiga]}")

    for tag in root.iter():
        if tag.tag.endswith('chNFe'):
            chave_antiga = tag.text
            if chave_antiga in chave_mapping:
                nova_chave = chave_mapping[chave_antiga]
                if tag.text != nova_chave:
                    tag.text = nova_chave
                    alteracoes.append(f"<chNFe> alterado para nova chave: {nova_chave}")
    return alteracoes

def _editar_nfe(
    root, alterar_emitente, novo_emitente, alterar_produtos, novo_produto,
    alterar_impostos, novos_impostos, alterar_cst, mapeamento_cst,
    zerar_ipi_remessa_retorno, zerar_ipi_venda, alterar_data, nova_data_str,
    chave_mapping, alterar_ref_nfe, reference_map,
    alterar_destinatario, novo_destinatario,
    alterar_reforma_tributaria, config_reforma_trib,
    alterar_serie, alterar_cUF, novos_dados_ide
):
    alteracoes = []
    inf_nfe = find_element_deep(root, 'infNFe')
    if inf_nfe is None: return "", alteracoes
    
    ide = find_element(inf_nfe, 'ide')
    msg = f"NFe: {find_element(ide, 'nNF').text if find_element(ide, 'nNF') is not None else 'N/A'}"
    original_key = inf_nfe.get('Id')[3:]

    if ide is not None:
        if alterar_cUF is True and 'novo_cUF' in novos_dados_ide:
            tag = find_element(ide, 'cUF')
            if tag is not None:
                tag.text = novos_dados_ide['novo_cUF']
                alteracoes.append("Identificação: <cUF> alterado")
        
        if alterar_serie is True and 'nova_serie' in novos_dados_ide:
            tag = find_element(ide, 'serie')
            if tag is not None:
                tag.text = novos_dados_ide['nova_serie']
                alteracoes.append("Identificação: <serie> alterada")

    if alterar_emitente is True and novo_emitente is not None:
        emit = find_element(inf_nfe, 'emit')
        if emit is not None:
            ender = find_element(emit, 'enderEmit')
            for campo, valor in novo_emitente.items():
                target_element = ender if campo in ['xLgr', 'nro', 'xCpl', 'xBairro', 'xMun', 'UF', 'fone'] else emit
                if target_element is not None:
                    tag = find_element(target_element, campo)
                    if tag is not None:
                        tag.text = valor
                        alteracoes.append(f"Emitente: <{campo}> alterado")

    cfop_geral = find_element_deep(inf_nfe, 'det/prod/CFOP')
    if alterar_destinatario is True and novo_destinatario is not None and cfop_geral is not None:
        cfop = cfop_geral.text
        if cfop in VENDAS_CFOP:
            _criar_ou_atualizar_bloco_endereco(ide, 'retirada', novo_destinatario, alteracoes, "Retirada")
        elif cfop in REMESSAS_CFOP or cfop in RETORNOS_CFOP:
            _criar_ou_atualizar_bloco_endereco(inf_nfe, 'dest', novo_destinatario, alteracoes, "Destinatário", ender_tag_name='enderDest')

    total_vBC_IBSCBS = Decimal('0.00')
    total_vIBSUF = Decimal('0.00')
    total_vIBSMun = Decimal('0.00')
    total_vCBS = Decimal('0.00')
    total_vDevTrib = Decimal('0.00')

    for det in find_all_elements(inf_nfe, 'det'):
        prod, imposto = find_element(det, 'prod'), find_element(det, 'imposto')
        if alterar_produtos is True and novo_produto is not None and prod is not None:
            for campo, valor in novo_produto.items():
                tag = find_element(prod, campo)
                if tag is not None:
                    tag.text = valor
                    alteracoes.append(f"Produto: <{campo}> alterado")
        if imposto is None: continue

        if alterar_impostos is True and novos_impostos is not None:
            for campo_json, valor in novos_impostos.items():
                tag = find_element_deep(imposto, campo_json)
                if tag is not None and f"Imposto: <{campo_json}> alterado" not in alteracoes:
                    tag.text = valor
                    alteracoes.append(f"Imposto: <{campo_json}> alterado")
        
        cfop_tag = find_element(prod, 'CFOP') if prod is not None else None
        if cfop_tag is not None and cfop_tag.text:
            cfop = cfop_tag.text
            if alterar_cst is True and cfop in mapeamento_cst:
                regras_cst = mapeamento_cst[cfop]
                for imposto_nome, cst_valor in regras_cst.items():
                    imposto_tag = find_element(imposto, imposto_nome)
                    if imposto_tag:
                        cst_tag = find_element_deep(imposto_tag, 'CST')
                        if cst_tag is not None:
                            cst_tag.text = cst_valor
                            alteracoes.append(f"CST do {imposto_nome} alterado")

            ipi_tag = find_element(imposto, 'IPI')
            if ipi_tag is not None:
                if zerar_ipi_remessa_retorno is True and cfop in REMESSAS_CFOP + RETORNOS_CFOP:
                    for tag_ipi in ['vIPI', 'vBC']:
                        tag = find_element_deep(ipi_tag, tag_ipi)
                        if tag is not None: tag.text = "0.00"
                    tag_pIPI = find_element_deep(ipi_tag, 'pIPI')
                    if tag_pIPI is not None: tag_pIPI.text = "0.0000"
                    alteracoes.append("Valores de IPI zerados para remessa/retorno")
                
                if zerar_ipi_venda is True and cfop in VENDAS_CFOP:
                    for tag_ipi in ['vIPI', 'vBC']:
                        tag = find_element_deep(ipi_tag, tag_ipi)
                        if tag is not None: tag.text = "0.00"
                    tag_pIPI = find_element_deep(ipi_tag, 'pIPI')
                    if tag_pIPI is not None: tag_pIPI.text = "0.0000"
                    alteracoes.append("Valores de IPI zerados para venda")

        if alterar_reforma_tributaria is True and config_reforma_trib is not None and prod is not None:
            ibscbs_existente = find_element(imposto, 'IBSCBS')
            if ibscbs_existente is not None:
                imposto.remove(ibscbs_existente)
                
            valores_item = _criar_bloco_ibscbs(imposto, prod, config_reforma_trib, alteracoes)
            
            total_vBC_IBSCBS += valores_item['vBC']
            total_vIBSUF += valores_item['vIBSUF']
            total_vIBSMun += valores_item['vIBSMun']
            total_vCBS += valores_item['vCBS']
            total_vDevTrib += valores_item['vDevTrib']

    if zerar_ipi_remessa_retorno is True or zerar_ipi_venda is True:
        _recalcula_totais_ipi(inf_nfe, alteracoes)

    if alterar_reforma_tributaria is True and config_reforma_trib is not None:
        total_tag = find_element(inf_nfe, 'total')
        if total_tag is not None:
            tot_ibscbs_existente = find_element(total_tag, 'IBSCBSTot')
            if tot_ibscbs_existente is not None:
                total_tag.remove(tot_ibscbs_existente)
            
            _criar_bloco_ibscbs_tot(
                total_tag, config_reforma_trib,
                total_vBC_IBSCBS, total_vIBSUF, total_vIBSMun,
                total_vCBS, total_vDevTrib, alteracoes
            )

    if alterar_data is True and nova_data_str is not None:
        nova_data_fmt = datetime.strptime(nova_data_str, "%d/%m/%Y").strftime(f'%Y-%m-%dT{datetime.now().strftime("%H:%M:%S")}-03:00')
        if ide is not None:
            for tag_data in ['dhEmi', 'dhSaiEnt']:
                tag = find_element(ide, tag_data)
                if tag is not None:
                    tag.text = nova_data_fmt
                    alteracoes.append(f"Data: <{tag_data}> alterada")
        prot_nfe = find_element_deep(root, 'protNFe/infProt')
        if prot_nfe is not None:
            tag_recbto = find_element(prot_nfe, 'dhRecbto')
            if tag_recbto is not None:
                tag_recbto.text = nova_data_fmt
                alteracoes.append("Protocolo: <dhRecbto> alterado")

    if original_key in chave_mapping:
        nova_chave = chave_mapping[original_key]
        inf_nfe.set('Id', 'NFe' + nova_chave)
        alteracoes.append(f"Chave de Acesso ID alterada para: {nova_chave}")
        prot_nfe = find_element_deep(root, 'protNFe/infProt')
        if prot_nfe is not None:
            ch_nfe = find_element(prot_nfe, 'chNFe')
            if ch_nfe is not None:
                ch_nfe.text = nova_chave
                alteracoes.append("Chave de Acesso do Protocolo alterada")

    if alterar_ref_nfe is True and original_key in reference_map:
        original_referenced_key = reference_map[original_key]
        if original_referenced_key in chave_mapping:
            new_referenced_key = chave_mapping[original_referenced_key]
            ref_nfe_tag = find_element_deep(inf_nfe, 'ide/NFref/refNFe')
            if ref_nfe_tag is not None:
                ref_nfe_tag.text = new_referenced_key
                alteracoes.append(f"Chave de Referência alterada para: {new_referenced_key}")

    return msg, alteracoes


def _recalcula_totais_ipi(inf_nfe, alteracoes):
    icms_tot_tag = find_element_deep(inf_nfe, 'total/ICMSTot')
    if icms_tot_tag is None: return

    somas = {'vProd': 0, 'vIPI': 0, 'vDesc': 0, 'vFrete': 0, 'vSeg': 0, 'vOutro': 0}
    
    def safe_get_decimal(element, tag_name):
        tag = find_element(element, tag_name)
        return Decimal(tag.text) if tag is not None and tag.text is not None else Decimal('0.00')

    for det in find_all_elements(inf_nfe, 'det'):
        prod = find_element(det, 'prod')
        imposto = find_element(det, 'imposto')
        for k in somas.keys():
            if k != 'vIPI': somas[k] += safe_get_decimal(prod, k)
        
        ipi_tag = find_element(imposto, 'IPI')
        if ipi_tag is not None:
            # Precisa buscar mais profundamente
            vipi_elem = find_element_deep(ipi_tag, 'vIPI')
            if vipi_elem is not None:
                 somas['vIPI'] += Decimal(vipi_elem.text) if vipi_elem.text is not None else Decimal('0.00')

    novo_vnf = sum(somas.values()) - somas['vDesc']
    
    vipi_total_tag = find_element(icms_tot_tag, 'vIPI')
    vnf_total_tag = find_element(icms_tot_tag, 'vNF')

    if vipi_total_tag is not None:
        vipi_total_tag.text = f"{somas['vIPI']:.2f}"
        alteracoes.append("Total vIPI recalculado")
    if vnf_total_tag is not None:
        vnf_total_tag.text = f"{novo_vnf:.2f}"
        alteracoes.append("Total vNF recalculado")


def _salvar_xml(root, file_path):
    main_ns = ''
    inf_nfe = find_element_deep(root, 'infNFe')
    if inf_nfe is not None:
        main_ns = NS['nfe']
        ET.register_namespace('', main_ns)
    elif find_element_deep(root, 'infCte') is not None:
        pass # CT-e não precisa de namespace padrão registrado explicitamente aqui
        
    ET.register_namespace('ds', NS_DS['ds'])
    xml_str = ET.tostring(root, encoding='utf-8', method='xml', xml_declaration=True).decode('utf-8')
    xml_str = xml_str.replace(f' xmlns:ds="{NS_DS["ds"]}"', '')
    xml_str = xml_str.replace('<ds:Signature>', f'<Signature xmlns="{NS_DS["ds"]}">')
    xml_str = xml_str.replace('</ds:Signature>', '</Signature>')
    xml_str = xml_str.replace('<ds:', '<').replace('</ds:', '</')
    xml_str = re.sub(r'>\s+<', '><', xml_str.strip())
    # Limpa prefixos de namespace indesejados (ns0: ou nfe: desnecessário)
    xml_str = re.sub(r'<(/?)(ns0:|nfe:)', r'<\1', xml_str) 
    xml_str = xml_str.replace('xmlns:ns0="http://www.portalfiscal.inf.br/cte"', '')
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(xml_str)

# --- Loop Principal do Programa ---
if __name__ == "__main__":
    print("\n==================== INICIANDO GERENCIADOR DE XMLs ====================\n")
    constantes = carregar_constantes('constantes.json')
    if constantes is not None:
        constantes_empresa = selecionar_empresa(constantes)
        configs = constantes_empresa.get('configuracao_execucao', {})
        caminhos = constantes_empresa.get('caminhos', {})
        run_rename = configs.get('processar_e_renomear', False)
        run_edit = configs.get('editar_arquivos', False)
        pasta_origem = caminhos.get('pasta_origem')
        pasta_edicao = caminhos.get('pasta_edicao')

        if run_rename is True:
            if pasta_origem is not None and os.path.isdir(pasta_origem):
                processar_arquivos(pasta_origem)
            else:
                print(f"Erro: Caminho da 'pasta_origem' ('{pasta_origem}') é inválido ou não definido.")
        
        if run_edit is True:
            if pasta_edicao is not None and os.path.isdir(pasta_edicao):
                print(f"Pasta de edição selecionada: {pasta_edicao}")
                
                # Pega o CNPJ do primeiro arquivo para usar como padrão se não for alterado
                cnpj_orig = ''
                arquivos_edicao = [os.path.join(pasta_edicao, f) for f in os.listdir(pasta_edicao) if f.endswith('.xml')]
                if arquivos_edicao:
                    for f in arquivos_edicao:
                        try:
                            info = _get_chave_info_for_mapping(f)
                            if info is not None and info.get('emit_cnpj'):
                                cnpj_orig = info['emit_cnpj']
                                break
                        except Exception:
                            pass
                
                editar_arquivos(pasta_edicao, constantes_empresa)
            else:
                print(f"Erro: Caminho da 'pasta_edicao' ('{pasta_edicao}') é inválido ou não definido.")
            
    print("\n==================== PROCESSAMENTO FINALIZADO ====================\n")