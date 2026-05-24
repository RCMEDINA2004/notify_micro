const express = require('express');
const amqp = require('amqplib');

const app = express();
app.use(express.json());

// Nombre del exchange (debe coincidir con el de appointments-service)
const EXCHANGE = 'appointment_events';

// Funcion que procesa una notificacion (la separamos para poder testearla)
function procesarNotificacion(data) {
  if (!data || !data.tipo) {
    return { ok: false, error: 'Falta el tipo' };
  }
  console.log(`NOTIFICACION: tipo=${data.tipo} usuario=${data.email}`);
  return { ok: true, tipo: data.tipo, email: data.email };
}

// Procesa los eventos que llegan desde appointments-service
function procesarEventoCita(evento) {
  // Los mensajes desde Java vienen con campos: type, appointmentId, ownerId, petId, scheduledAt
  const mensajes = {
    'appointment_created':   'Se ha agendado una nueva cita',
    'appointment_confirmed': 'Tu cita fue confirmada',
    'appointment_done':      'Tu cita fue completada',
    'appointment_cancelled': 'Tu cita fue cancelada'
  };

  const mensaje = mensajes[evento.type] || `Evento de cita: ${evento.type}`;

  console.log('==========================================');
  console.log('[NOTIFY] Evento recibido desde RabbitMQ:');
  console.log(`  Tipo:          ${evento.type}`);
  console.log(`  Cita ID:       ${evento.appointmentId}`);
  console.log(`  Dueno ID:      ${evento.ownerId}`);
  console.log(`  Mascota ID:    ${evento.petId}`);
  console.log(`  Fecha cita:    ${evento.scheduledAt}`);
  console.log(`  Mensaje:       ${mensaje}`);
  console.log(`  Timestamp:     ${evento.timestamp}`);
  console.log('==========================================');

  // Aqui en un proyecto real se enviaria un email o SMS al dueno
  return { ok: true, mensaje };
}

// Escuchar eventos de RabbitMQ
async function startConsumer() {
  const url = process.env.RABBIT_URL || 'amqp://guest:guest@rabbitmq:5672';

  // Reintentar conexion hasta que RabbitMQ este listo
  for (let i = 0; i < 15; i++) {
    try {
      const conn = await amqp.connect(url);
      const ch = await conn.createChannel();

      // Declarar el exchange tipo fanout (igual que en appointments-service)
      await ch.assertExchange(EXCHANGE, 'fanout', { durable: false });

      // Crear una cola exclusiva para este consumidor
      const q = await ch.assertQueue('notify_appointments', { durable: false });

      // Enlazar la cola al exchange (para recibir TODOS los eventos)
      await ch.bindQueue(q.queue, EXCHANGE, '');

      console.log(`[NOTIFY] Conectado a RabbitMQ. Escuchando exchange '${EXCHANGE}'...`);

      ch.consume(q.queue, (msg) => {
        if (!msg) return;
        try {
          const evento = JSON.parse(msg.content.toString());
          procesarEventoCita(evento);
        } catch (err) {
          console.error('[NOTIFY] Error procesando mensaje:', err.message);
        }
        ch.ack(msg);
      });

      return;
    } catch (err) {
      console.log(`[NOTIFY] RabbitMQ no listo, reintento ${i + 1}/15...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log('[NOTIFY] No se pudo conectar a RabbitMQ, solo modo HTTP');
}

// Endpoint HTTP para enviar notificacion directo (sin cola)
app.post('/notify', (req, res) => {
  const resultado = procesarNotificacion(req.body);
  if (!resultado.ok) {
    return res.status(400).json(resultado);
  }
  res.json(resultado);
});

app.get('/health', (req, res) => res.json({ ok: true }));

// Exportamos app y funciones para los tests
module.exports = { app, procesarNotificacion, procesarEventoCita };

// Solo arrancar si se ejecuta directamente
if (require.main === module) {
  app.listen(8084, () => {
    console.log('Notify en puerto 8084');
    startConsumer();
  });
}
