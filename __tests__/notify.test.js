// Pruebas unitarias del servicio Notify
// Probamos:
// 1. La funcion procesarNotificacion (logica pura)
// 2. El endpoint POST /notify
// 3. El endpoint GET /health

const request = require('supertest');
const { app, procesarNotificacion, procesarEventoCita } = require('../index');

describe('Servicio de Notificaciones', () => {

  // ----------- Funcion procesarEventoCita (consumidor RabbitMQ) -----------
  describe('procesarEventoCita() - asincronicidad RabbitMQ', () => {

    test('procesa evento de cita creada', () => {
      const evento = {
        type: 'appointment_created',
        appointmentId: 1,
        ownerId: 5,
        petId: 3,
        scheduledAt: '2026-06-15T10:00:00'
      };
      const resultado = procesarEventoCita(evento);

      expect(resultado.ok).toBe(true);
      expect(resultado.mensaje).toContain('agendado');
    });

    test('procesa evento de cita cancelada', () => {
      const evento = {
        type: 'appointment_cancelled',
        appointmentId: 1,
        ownerId: 5,
        petId: 3
      };
      const resultado = procesarEventoCita(evento);

      expect(resultado.ok).toBe(true);
      expect(resultado.mensaje).toContain('cancelada');
    });

    test('procesa evento de cita confirmada', () => {
      const evento = {
        type: 'appointment_confirmed',
        appointmentId: 1,
        ownerId: 5,
        petId: 3
      };
      const resultado = procesarEventoCita(evento);

      expect(resultado.ok).toBe(true);
      expect(resultado.mensaje).toContain('confirmada');
    });

    test('procesa evento desconocido con mensaje generico', () => {
      const evento = {
        type: 'otro_tipo',
        appointmentId: 1
      };
      const resultado = procesarEventoCita(evento);

      expect(resultado.ok).toBe(true);
      expect(resultado.mensaje).toContain('otro_tipo');
    });
  });

  // ----------- Funcion procesarNotificacion -----------
  describe('procesarNotificacion()', () => {

    test('procesa una notificacion valida', () => {
      const data = { tipo: 'CITA_CREADA', email: 'juan@test.com' };
      const resultado = procesarNotificacion(data);

      expect(resultado.ok).toBe(true);
      expect(resultado.tipo).toBe('CITA_CREADA');
      expect(resultado.email).toBe('juan@test.com');
    });

    test('devuelve error si no hay tipo', () => {
      const resultado = procesarNotificacion({ email: 'juan@test.com' });

      expect(resultado.ok).toBe(false);
      expect(resultado.error).toBeDefined();
    });

    test('devuelve error si data es null', () => {
      const resultado = procesarNotificacion(null);

      expect(resultado.ok).toBe(false);
    });

    test('devuelve error si data es objeto vacio', () => {
      const resultado = procesarNotificacion({});

      expect(resultado.ok).toBe(false);
    });
  });

  // ----------- POST /notify -----------
  describe('POST /notify', () => {

    test('envia notificacion correctamente', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ tipo: 'CITA_CANCELADA', email: 'cliente@test.com', mensaje: 'Tu cita fue cancelada' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.tipo).toBe('CITA_CANCELADA');
    });

    test('devuelve 400 si falta el tipo', async () => {
      const res = await request(app)
        .post('/notify')
        .send({ email: 'cliente@test.com' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });
  });

  // ----------- GET /health -----------
  describe('GET /health', () => {

    test('devuelve ok true', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

});
