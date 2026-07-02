
const TOKEN = '597.BuLdWQHljMuWApnbSsMUUsvvfjjCzCHtkyTowxTttT9O0oMsA9EHfLnR6q1YVulDDFwtSJS33Ozr1GIkDO8oOjNJzYfJnAA4kirO4r4TB3wYgK4qpGU3zeOo';

async function testRH() {
  const payload = {
    documento: 'recibo_honorarios',
    serie: 'E001',
    numero: Math.floor(Math.random() * 100000),
    moneda: 'PEN',
    fecha_de_emision: new Date().toISOString().split('T')[0],
    cliente_tipo_de_documento: '6',
    cliente_numero_de_documento: '20123456789',
    cliente_denominacion: 'CLIENTE TEST SAC',
    cliente_direccion: 'CALLE PRUEBA 123',
    items: [{
      unidad_de_medida: 'ZZ',
      descripcion: 'SERVICIOS PROFESIONALES DE PRUEBA',
      cantidad: 1,
      valor_unitario: 1000.00,
      porcentaje_igv: '0.00',
      codigo_tipo_afectacion_igv: '10',
      nombre_tributo: 'IGV',
      total: 1000.00
    }],
    tipo_operacion: '0101',
    forma_pago: 'Contado',
    total: 1000.00
  };

  try {
    const res = await fetch('https://api.apisunat.com/api/v3/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const txt = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', txt);
  } catch (error) {
    console.error(error);
  }
}

testRH();
