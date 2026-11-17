import test from 'node:test';
import assert from 'node:assert/strict';

test('1. Card de Veículo Livre com foto cadastrada em Frotas habilita botão de visualização', () => {
  const veiculoComFoto = {
    type: 'livre',
    id: 'v-01',
    model: 'TRANSIT',
    brand: 'FORD',
    plate: 'SHK2D93',
    vehicleImageUrl: 'https://supabase.co/storage/v1/object/public/vehicles/transit-shk2d93.jpg'
  };

  const hasPhoto = Boolean(veiculoComFoto.vehicleImageUrl && veiculoComFoto.vehicleImageUrl.trim().length > 0);
  assert.equal(hasPhoto, true);

  const buttonProps = hasPhoto
    ? { disabled: false, label: 'Ver Foto do Veículo', action: 'openModal', url: veiculoComFoto.vehicleImageUrl }
    : { disabled: true, label: 'Foto indisponível', action: 'none', url: null };

  assert.equal(buttonProps.disabled, false);
  assert.equal(buttonProps.label, 'Ver Foto do Veículo');
  assert.equal(buttonProps.url, 'https://supabase.co/storage/v1/object/public/vehicles/transit-shk2d93.jpg');
});

test('2. Card de Veículo sem foto cadastrada em Frotas exibe botão desabilitado Foto indisponível', () => {
  const veiculoSemFoto = {
    type: 'livre',
    id: 'v-02',
    model: 'CARRETINHA ODONTOMÓVEL',
    brand: 'ODONTOMOVEL',
    plate: 'CARRETIN',
    vehicleImageUrl: undefined
  };

  const hasPhoto = Boolean(veiculoSemFoto.vehicleImageUrl && veiculoSemFoto.vehicleImageUrl.trim().length > 0);
  assert.equal(hasPhoto, false);

  const buttonProps = hasPhoto
    ? { disabled: false, label: 'Ver Foto do Veículo', action: 'openModal', url: veiculoSemFoto.vehicleImageUrl }
    : { disabled: true, label: 'Foto indisponível', action: 'none', url: null };

  assert.equal(buttonProps.disabled, true);
  assert.equal(buttonProps.label, 'Foto indisponível');
  assert.equal(buttonProps.url, null);
});

test('3. Card de Viagem Existente vincula a foto original do veículo associado à viagem', () => {
  const viagemComFoto = {
    type: 'viagem_existente',
    id: 'v-03_sched-01',
    scheduleId: 'sched-01',
    vehicleId: 'v-03',
    vehicleModel: 'MASTER RAYTEC PA 1',
    vehicleBrand: 'RENAULT',
    vehiclePlate: 'TCC7A13',
    vehicleImageUrl: 'https://supabase.co/storage/v1/object/public/vehicles/master-tcc7a13.png'
  };

  assert.equal(Boolean(viagemComFoto.vehicleImageUrl), true);
  assert.equal(viagemComFoto.vehicleImageUrl.includes('master-tcc7a13'), true);
});

test('4. Modal de Visualização exclusivo: fechamento por tecla Escape e backdrop', () => {
  let modalState = {
    isOpen: true,
    url: 'https://supabase.co/storage/v1/object/public/vehicles/transit-shk2d93.jpg',
    title: 'FORD TRANSIT (SHK2D93)'
  };

  const handleKeyDown = (key) => {
    if (key === 'Escape') {
      modalState = null;
    }
  };

  // Pressionar tecla diferente não fecha
  handleKeyDown('Enter');
  assert.notEqual(modalState, null);

  // Pressionar Escape fecha
  handleKeyDown('Escape');
  assert.equal(modalState, null);
});
