import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consolidarMedicamentosListaLive,
  filtrarListaLive,
  formatApresentacaoListaLive,
  isLoteDisponivelListaLive
} from '../utils/farmaciaListaLiveUtils.ts';
import { MODULE_ACCESS_TREE, userCanAccessSubmodule } from '../services/permissionService.ts';

const HOJE = '2026-11-17';

test('1. Exibe exclusivamente medicamentos com estoque disponível > 0 (oculta zerados e negativos)', () => {
  const estoque = [
    { id: '1', nome: 'Dipirona', dosagem: '500 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 180, unidade: 'comp', validade: '2027-05-01', lote: 'L1', limite_minimo: 20 },
    { id: '2', nome: 'Paracetamol', dosagem: '750 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 0, unidade: 'comp', validade: '2027-05-01', lote: 'L2', limite_minimo: 20 },
    { id: '3', nome: 'Ibuprofeno', dosagem: '600 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: -5, unidade: 'comp', validade: '2027-05-01', lote: 'L3', limite_minimo: 10 }
  ];

  const lista = consolidarMedicamentosListaLive(estoque, HOJE);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].nome, 'Dipirona');
  assert.equal(lista[0].estoque, 180);
});

test('2. Não contabiliza lotes vencidos, bloqueados ou indisponíveis', () => {
  const estoque = [
    { id: '1', nome: 'Amoxicilina', dosagem: '500 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 50, unidade: 'cap', validade: '2026-11-16', lote: 'L-VENCIDO', limite_minimo: 10 },
    { id: '2', nome: 'Amoxicilina', dosagem: '500 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 120, unidade: 'cap', validade: '2027-03-01', lote: 'L-VALIDO', limite_minimo: 10 },
    { id: '3', nome: 'Captopril', dosagem: '25 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 90, unidade: 'comp', validade: '2025-12-31', lote: 'L-VENCIDO-UNICO', limite_minimo: 10 },
    { id: '4', nome: 'Metformina', dosagem: '850 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 60, unidade: 'comp', validade: '2027-08-01', lote: 'L-BLOQ', limite_minimo: 10, bloqueado: true },
    { id: '5', nome: 'Sinvastatina', dosagem: '20 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 40, unidade: 'comp', validade: '2027-08-01', lote: 'L-INAT', limite_minimo: 10, status: 'Indisponível' }
  ];

  const lista = consolidarMedicamentosListaLive(estoque, HOJE);
  assert.equal(lista.length, 1, 'Apenas Amoxicilina com lote válido deve aparecer');
  assert.equal(lista[0].nome, 'Amoxicilina');
  assert.equal(lista[0].estoque, 120, 'Lote vencido de 50 unidades não pode ser somado ao saldo disponível');
  assert.equal(isLoteDisponivelListaLive(estoque[0], HOJE), false);
  assert.equal(isLoteDisponivelListaLive(estoque[3], HOJE), false);
});

test('3. Consolida múltiplos lotes da mesma apresentação sem duplicar e separa apresentações diferentes', () => {
  const estoque = [
    { id: '1', nome: 'Amoxicilina', dosagem: '500 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 100, unidade: 'cap', validade: '2027-01-10', lote: 'LOTE-A', limite_minimo: 10 },
    { id: '2', nome: 'Amoxicilina', dosagem: '500 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 140, unidade: 'cap', validade: '2027-09-20', lote: 'LOTE-B', limite_minimo: 10 },
    { id: '3', nome: 'Amoxicilina', dosagem: '250 mg/5 mL', tipo: 'Suspensão Oral', categoria: 'CBAF', quantidade: 35, unidade: 'fr', validade: '2027-04-15', lote: 'LOTE-C', limite_minimo: 5 }
  ];

  const lista = consolidarMedicamentosListaLive(estoque, HOJE);
  assert.equal(lista.length, 2, 'Deve consolidar os 2 lotes de 500 mg e manter 250 mg/5 mL separado');

  const suspensao = lista.find((i) => i.apresentacao === '250 mg/5 mL — Suspensão Oral');
  const capsula = lista.find((i) => i.apresentacao === '500 mg — Cápsula');

  assert.ok(suspensao);
  assert.equal(suspensao.estoque, 35);
  assert.ok(capsula);
  assert.equal(capsula.estoque, 240);
  assert.equal(capsula.lotesValidosCount, 2);
});

test('4. Respeita categorias CBAF, CESAF e CEAF e mantém ordenação alfabética A-Z', () => {
  const estoque = [
    { id: '1', nome: 'Omeprazol', dosagem: '20 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 120, unidade: 'cap', validade: '2027-05-01', lote: 'L1', limite_minimo: 10 },
    { id: '2', nome: 'Ácido Fólico', dosagem: '5 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 75, unidade: 'comp', validade: '2027-05-01', lote: 'L2', limite_minimo: 10 },
    { id: '3', nome: 'Insulina Glargina', dosagem: '100 UI/mL', tipo: 'Caneta', categoria: 'CEAF', quantidade: 30, unidade: 'un', validade: '2027-05-01', lote: 'L3', limite_minimo: 5 },
    { id: '4', nome: 'Dipirona', dosagem: '500 mg', tipo: 'Comprimido', categoria: 'CESAF', quantidade: 180, unidade: 'comp', validade: '2027-05-01', lote: 'L4', limite_minimo: 10 }
  ];

  const lista = consolidarMedicamentosListaLive(estoque, HOJE);
  assert.deepEqual(
    lista.map((i) => i.nome),
    ['Ácido Fólico', 'Dipirona', 'Insulina Glargina', 'Omeprazol'],
    'Ordenação alfabética pt-BR deve respeitar A-Z ignorando acentos'
  );
  // Contador = número de medicamentos/apresentações (4), não soma das unidades (405)
  assert.equal(lista.length, 4);
});

test('5. Pesquisa dinâmica filtra por nome ou apresentação ignorando acentos e maiúsculas/minúsculas', () => {
  const estoque = [
    { id: '1', nome: 'Amoxicilina', dosagem: '500 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 240, unidade: 'cap', validade: '2027-05-01', lote: 'L1', limite_minimo: 10 },
    { id: '2', nome: 'Ácido Acetilsalicílico', dosagem: '100 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 150, unidade: 'comp', validade: '2027-05-01', lote: 'L2', limite_minimo: 10 },
    { id: '3', nome: 'Losartana', dosagem: '50 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 95, unidade: 'comp', validade: '2027-05-01', lote: 'L3', limite_minimo: 10 },
    { id: '4', nome: 'Omeprazol', dosagem: '20 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 120, unidade: 'cap', validade: '2027-05-01', lote: 'L4', limite_minimo: 10 }
  ];

  const consolidados = consolidarMedicamentosListaLive(estoque, HOJE);

  // Pesquisa sem acento encontra "Ácido Acetilsalicílico"
  const buscaAcido = filtrarListaLive(consolidados, 'acido');
  assert.equal(buscaAcido.length, 1);
  assert.equal(buscaAcido[0].nome, 'Ácido Acetilsalicílico');

  // Pesquisa por apresentação sem acento ("capsula") encontra Amoxicilina e Omeprazol em ordem A-Z
  const buscaCapsula = filtrarListaLive(consolidados, 'CAPSULA');
  assert.deepEqual(buscaCapsula.map((i) => i.nome), ['Amoxicilina', 'Omeprazol']);

  // Pesquisa combinada nome + dosagem ("losart 50")
  const buscaCombinada = filtrarListaLive(consolidados, 'losart 50');
  assert.equal(buscaCombinada.length, 1);
  assert.equal(buscaCombinada[0].nome, 'Losartana');
});

test('6. Movimentações: entrada, retirada, zeramento (ocultação) e reposição (reaparição alfabética)', () => {
  // Estado inicial
  let estoque = [
    { id: '1', nome: 'Amoxicilina', dosagem: '500 mg', tipo: 'Cápsula', categoria: 'CBAF', quantidade: 10, unidade: 'cap', validade: '2027-05-01', lote: 'L1', limite_minimo: 5 },
    { id: '2', nome: 'Losartana', dosagem: '50 mg', tipo: 'Comprimido', categoria: 'CBAF', quantidade: 20, unidade: 'comp', validade: '2027-05-01', lote: 'L2', limite_minimo: 5 }
  ];

  // Retirada parcial de 4 unidades de Losartana -> 16
  estoque = estoque.map((m) => (m.id === '2' ? { ...m, quantidade: m.quantidade - 4 } : m));
  let lista = consolidarMedicamentosListaLive(estoque, HOJE);
  assert.equal(lista.find((i) => i.nome === 'Losartana')?.estoque, 16);

  // Retirada total de Amoxicilina -> zera e desaparece imediatamente da listagem
  estoque = estoque.map((m) => (m.id === '1' ? { ...m, quantidade: 0 } : m));
  lista = consolidarMedicamentosListaLive(estoque, HOJE);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].nome, 'Losartana');

  // Reposição de Amoxicilina (entrada de 50 unidades) -> reaparece na posição alfabética correta (antes de Losartana)
  estoque = estoque.map((m) => (m.id === '1' ? { ...m, quantidade: 50 } : m));
  lista = consolidarMedicamentosListaLive(estoque, HOJE);
  assert.deepEqual(lista.map((i) => i.nome), ['Amoxicilina', 'Losartana']);
  assert.equal(lista[0].estoque, 50);
});

test('7. Formatação de apresentação respeita os dados cadastrados sem duplicar texto', () => {
  assert.equal(formatApresentacaoListaLive({ dosagem: '500 mg', tipo: 'Cápsula', unidade: 'cap' }), '500 mg — Cápsula');
  assert.equal(formatApresentacaoListaLive({ dosagem: '500 mg', tipo: '', unidade: 'un' }), '500 mg');
  assert.equal(formatApresentacaoListaLive({ dosagem: '', tipo: 'Xarope', unidade: 'fr' }), 'Xarope');
  assert.equal(formatApresentacaoListaLive({ dosagem: '', tipo: '', unidade: 'Frasco' }), 'Frasco');
});

test('8. Submódulo Lista Live registrado no Controle de Acesso (/Admin/ControleAcesso) e restrito a autorizados', () => {
  const modFarmacia = MODULE_ACCESS_TREE.find((m) => m.key === 'parent_farmacia');
  assert.ok(modFarmacia, 'Módulo parent_farmacia deve existir no catálogo');

  const subListaLive = modFarmacia.submodules.find((s) => s.key === 'sub_farmacia_lista_live');
  assert.ok(subListaLive, 'Submódulo sub_farmacia_lista_live deve estar registrado automaticamente no catálogo');
  assert.equal(subListaLive.label, 'Lista Live');
  assert.equal(subListaLive.routes.includes('/FarmaciaPopular/ListaLive'), true);

  // Usuário sem permissão não acessa
  const usuarioSemPermissao = { id: 'u1', role: 'user', permissions: ['parent_farmacia', 'sub_farmacia_consultar'] };
  assert.equal(userCanAccessSubmodule(usuarioSemPermissao, 'parent_farmacia', 'sub_farmacia_lista_live', {}), false);

  // Usuário autorizado acessa
  const usuarioAutorizado = { id: 'u2', role: 'user', permissions: ['parent_farmacia', 'sub_farmacia_lista_live'] };
  assert.equal(userCanAccessSubmodule(usuarioAutorizado, 'parent_farmacia', 'sub_farmacia_lista_live', {}), true);
});
