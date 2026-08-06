import fs from 'fs';

const consultas = [
  'Clínica Geral', 'Cardiologia', 'Pediatria', 'Ginecologia', 'Obstetrícia',
  'Ortopedia', 'Neurologia', 'Neurocirurgia', 'Psiquiatria', 'Psicologia',
  'Dermatologia', 'Oftalmologia', 'Otorrinolaringologia', 'Pneumologia', 'Endocrinologia',
  'Gastroenterologia', 'Nefrologia', 'Reumatologia', 'Hematologia', 'Oncologia',
  'Infectologia', 'Alergologia', 'Geriatria', 'Nutrição', 'Fisioterapia',
  'Fonoaudiologia', 'Terapia Ocupacional', 'Cirurgia Geral (consulta)', 'Cirurgia Vascular (consulta)', 'Cirurgia Plástica (consulta)',
  'Mastologia', 'Proctologia', 'Angiologia', 'Coloproctologia', 'Anestesiologia (avaliação)',
  'Medicina do Trabalho', 'Medicina Esportiva', 'Genética Médica', 'Homeopatia', 'Acupuntura',
  'Odontologia', 'Bucomaxilofacial'
];

const exames = [
  'Hemograma', 'Glicemia', 'Colesterol', 'PSA', 'TSH',
  'T4', 'HIV', 'Hepatites', 'Urina', 'Fezes',
  'Raio-X', 'Ultrassom', 'Doppler', 'Mamografia', 'Tomografia',
  'Ressonância', 'PET-CT', 'Cintilografia', 'ECG', 'Ecocardiograma',
  'Holter', 'MAPA', 'Teste Ergométrico', 'EEG', 'ENMG',
  'Potencial Evocado', 'Espirometria', 'Polissonografia', 'Oximetria', 'OCT',
  'Campimetria', 'Tonometria', 'Fundoscopia', 'Audiometria', 'BERA',
  'Nasofibroscopia', 'Papanicolau', 'Cardiotocografia', 'Espermograma', 'Fluxometria',
  'Teste do Pezinho', 'Teste do Olhinho', 'Teste do Coraçãozinho', 'Gasometria', 'Citologia',
  'Anatomopatológico', 'Exames Genéticos', 'Cultura', 'Antibiograma'
];

const cirurgias = [
  'Endoscopia Digestiva', 'Colonoscopia', 'Retossigmoidoscopia', 'Histeroscopia', 'Cistoscopia',
  'Pele', 'Mama', 'Próstata', 'Fígado', 'Rim',
  'Punção Aspirativa (PAAF)', 'Cateterismo Cardíaco', 'Punção Lombar (Líquor)', 'Catarata', 'Hernioplastia',
  'Colecistectomia', 'Vasectomia', 'Laqueadura', 'Postectomia', 'Apendicectomia',
  'Histerectomia', 'Artroscopia', 'Amigdalectomia', 'Adenoidectomia', 'Cesariana',
  'Exérese de Tumores', 'Cirurgias Vasculares', 'Cirurgias Ortopédicas', 'Cirurgias Urológicas', 'Cirurgias Plásticas',
  'Cirurgias Bucomaxilofaciais'
];

let codeCounter = 1;
const values = [];

consultas.forEach(name => {
  const code = String(codeCounter++).padStart(4, '0');
  const safeName = name.toUpperCase().replace(/'/g, "''");
  values.push(`('${code}', '${safeName}', 'Consulta', 'Ativo', 'Não Se Aplica', 0, 0)`);
});

exames.forEach(name => {
  const code = String(codeCounter++).padStart(4, '0');
  const safeName = name.toUpperCase().replace(/'/g, "''");
  values.push(`('${code}', '${safeName}', 'Exame', 'Ativo', 'Não Se Aplica', 0, 0)`);
});

cirurgias.forEach(name => {
  const code = String(codeCounter++).padStart(4, '0');
  const safeName = name.toUpperCase().replace(/'/g, "''");
  values.push(`('${code}', '${safeName}', 'Cirurgia', 'Ativo', 'Não Se Aplica', 0, 0)`);
});

const sql = `-- Migration: Seed procedimentos de consultas, exames e cirurgias
DROP POLICY IF EXISTS "Enable all access for consultas_procedimentos" ON public.consultas_procedimentos;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.consultas_procedimentos;

CREATE POLICY "Enable all access for consultas_procedimentos" ON public.consultas_procedimentos
  FOR ALL USING (true) WITH CHECK (true);

DELETE FROM public.consultas_procedimentos;

INSERT INTO public.consultas_procedimentos (code, name, type, status, recurso, total_quantity, available_quantity)
VALUES
${values.join(',\n')};
`;

fs.writeFileSync('supabase/migrations/20260806_seed_procedimentos.sql', sql);
console.log('Migration gerada em supabase/migrations/20260806_seed_procedimentos.sql! Total registros:', values.length);
