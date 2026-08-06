import { supabase } from './supabaseClient';

export interface SeedProcedimento {
  code: string;
  name: string;
  type: 'Exame' | 'Consulta' | 'Cirurgia';
  status: 'Ativo' | 'Inativo';
  recurso: 'Não Se Aplica' | 'FM' | 'PPI';
  total_quantity: number;
  available_quantity: number;
}

export const PROCEDURES_SEED_LIST: SeedProcedimento[] = [
  // CONSULTAS (0001 - 0042)
  { code: '0001', name: 'CLÍNICA GERAL', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0002', name: 'CARDIOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0003', name: 'PEDIATRIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0004', name: 'GINECOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0005', name: 'OBSTETRÍCIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0006', name: 'ORTOPEDIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0007', name: 'NEUROLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0008', name: 'NEUROCIRURGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0009', name: 'PSIQUIATRIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0010', name: 'PSICOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0011', name: 'DERMATOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0012', name: 'OFTALMOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0013', name: 'OTORRINOLARINGOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0014', name: 'PNEUMOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0015', name: 'ENDOCRINOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0016', name: 'GASTROENTEROLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0017', name: 'NEFROLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0018', name: 'REUMATOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0019', name: 'HEMATOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0020', name: 'ONCOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0021', name: 'INFECTOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0022', name: 'ALERGOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0023', name: 'GERIATRIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0024', name: 'NUTRIÇÃO', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0025', name: 'FISIOTERAPIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0026', name: 'FONOAUDIOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0027', name: 'TERAPIA OCUPACIONAL', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0028', name: 'CIRURGIA GERAL (CONSULTA)', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0029', name: 'CIRURGIA VASCULAR (CONSULTA)', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0030', name: 'CIRURGIA PLÁSTICA (CONSULTA)', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0031', name: 'MASTOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0032', name: 'PROCTOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0033', name: 'ANGIOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0034', name: 'COLOPROCTOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0035', name: 'ANESTESIOLOGIA (AVALIAÇÃO)', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0036', name: 'MEDICINA DO TRABALHO', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0037', name: 'MEDICINA ESPORTIVA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0038', name: 'GENÉTICA MÉDICA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0039', name: 'HOMEOPATIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0040', name: 'ACUPUNTURA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0041', name: 'ODONTOLOGIA', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0042', name: 'BUCOMAXILOFACIAL', type: 'Consulta', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },

  // EXAMES (0043 - 0091)
  { code: '0043', name: 'HEMOGRAMA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0044', name: 'GLICEMIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0045', name: 'COLESTEROL', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0046', name: 'PSA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0047', name: 'TSH', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0048', name: 'T4', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0049', name: 'HIV', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0050', name: 'HEPATITES', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0051', name: 'URINA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0052', name: 'FEZES', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0053', name: 'RAIO-X', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0054', name: 'ULTRASSOM', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0055', name: 'DOPPLER', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0056', name: 'MAMOGRAFIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0057', name: 'TOMOGRAFIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0058', name: 'RESSONÂNCIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0059', name: 'PET-CT', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0060', name: 'CINTILOGRAFIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0061', name: 'ECG', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0062', name: 'ECOCARDIOGRAMA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0063', name: 'HOLTER', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0064', name: 'MAPA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0065', name: 'TESTE ERGOMÉTRICO', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0066', name: 'EEG', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0067', name: 'ENMG', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0068', name: 'POTENCIAL EVOCADO', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0069', name: 'ESPIROMETRIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0070', name: 'POLISSONOGRAFIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0071', name: 'OXIMETRIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0072', name: 'OCT', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0073', name: 'CAMPIMETRIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0074', name: 'TONOMETRIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0075', name: 'FUNDOSCOPIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0076', name: 'AUDIOMETRIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0077', name: 'BERA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0078', name: 'NASOFIBROSCOPIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0079', name: 'PAPANICOLAU', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0080', name: 'CARDIOTOCOGRAFIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0081', name: 'ESPERMOGRAMA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0082', name: 'FLUXOMETRIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0083', name: 'TESTE DO PEZINHO', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0084', name: 'TESTE DO OLHINHO', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0085', name: 'TESTE DO CORAÇÃOZINHO', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0086', name: 'GASOMETRIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0087', name: 'CITOLOGIA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0088', name: 'ANATOMOPATOLÓGICO', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0089', name: 'EXAMES GENÉTICOS', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0090', name: 'CULTURA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0091', name: 'ANTIBIOGRAMA', type: 'Exame', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },

  // CIRURGIAS (0092 - 0122)
  { code: '0092', name: 'ENDOSCOPIA DIGESTIVA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0093', name: 'COLONOSCOPIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0094', name: 'RETOSSIGMOIDOSCOPIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0095', name: 'HISTEROSCOPIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0096', name: 'CISTOSCOPIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0097', name: 'PELE', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0098', name: 'MAMA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0099', name: 'PRÓSTATA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0100', name: 'FÍGADO', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0101', name: 'RIM', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0102', name: 'PUNÇÃO ASPIRATIVA (PAAF)', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0103', name: 'CATETERISMO CARDÍACO', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0104', name: 'PUNÇÃO LOMBAR (LÍQUOR)', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0105', name: 'CATARATA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0106', name: 'HERNIOPLASTIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0107', name: 'COLECISTECTOMIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0108', name: 'VASECTOMIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0109', name: 'LAQUEADURA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0110', name: 'POSTECTOMIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0111', name: 'APENDICECTOMIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0112', name: 'HISTERECTOMIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0113', name: 'ARTROSCOPIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0114', name: 'AMIGDALECTOMIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0115', name: 'ADENOIDECTOMIA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0116', name: 'CESARIANA', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0117', name: 'EXÉRESE DE TUMORES', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0118', name: 'CIRURGIAS VASCULARES', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0119', name: 'CIRURGIAS ORTOPÉDICAS', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0120', name: 'CIRURGIAS UROLÓGICAS', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0121', name: 'CIRURGIAS PLÁSTICAS', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 },
  { code: '0122', name: 'CIRURGIAS BUCOMAXILOFACIAIS', type: 'Cirurgia', status: 'Ativo', recurso: 'Não Se Aplica', total_quantity: 0, available_quantity: 0 }
];

export const seedDefaultProcedures = async (): Promise<number> => {
  const { data, error } = await supabase
    .from('consultas_procedimentos')
    .insert(PROCEDURES_SEED_LIST)
    .select();

  if (error) {
    console.error('Erro ao popular lista de procedimentos padrão:', error);
    throw error;
  }
  return data?.length || 0;
};
