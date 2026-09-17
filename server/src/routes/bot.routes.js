import { Router } from 'express';
import { botRateLimit } from '../middleware/botRateLimit.js';
import { verificarApiKeyBot } from '../middleware/botAuth.js';
import { resolverClientePorTelefono } from '../middleware/botCliente.js';
import { resolverUsuarioPorTelefono } from '../middleware/botUsuario.js';
import { resolverDomicilioFiscal } from '../middleware/botDomicilio.js';
import { clienteEmailRateLimit } from '../middleware/clienteEmailRateLimit.js';
import {
  getClienteByTelefono,
  crearClienteBot,
  verificarEmailCliente,
  updateClienteBot,
  solicitarCambioEmailCliente,
  confirmarCambioEmailCliente,
} from '../controllers/botClientesController.js';
import { recuperarCuenta, confirmarRecuperacionCuenta } from '../controllers/botRecuperacionController.js';
import { getUsuarioByTelefono } from '../controllers/botUsuariosController.js';
import {
  getInmueblesDelCliente,
  getInmuebleDelCliente,
  createInmuebleBot,
  updateInmuebleBot,
  darDeBajaInmuebleBot,
  sugerirUbicacion,
} from '../controllers/botInmueblesController.js';

const router = Router();
// Los middlewares usan el "router.use" para que protejan todo lo que salga de /api/bot sin tener que agregarlos a cada ruta.
// El rate limit lo agregamos para evitar que alguien nos mate a peticiones con distintas key.
router.use(botRateLimit);
router.use(verificarApiKeyBot);

// Identidad del numero que escribe. n8n las consulta en este orden: si el
// numero es del equipo va al flujo interno, si no es cliente va al alta.
// Las dos tablas son excluyentes por trigger, asi que el orden no cambia el
// resultado; usuarios va primero porque es la tabla chica.
// GET /api/bot/usuarios/:telefono
router.get('/usuarios/:telefono', resolverUsuarioPorTelefono, getUsuarioByTelefono);
// GET /api/bot/clientes/:telefono
router.get('/clientes/:telefono', resolverClientePorTelefono, getClienteByTelefono);


// resolverDomicilioFiscal va antes de crear/editar para que sigan
// funcionando igual si el body trae la ubicacion exacta que compartio el
// cliente por WhatsApp: el middleware la convierte en el string
// "Calle, Barrio, Provincia" y lo deja en domicilio_fiscal. Los controllers
// reciben el body ya resuelto y no se enteran de que existieron coordenadas.
//
// El alta (POST) no inserta el cliente: manda un código al email y el
// cliente se crea recién en /verificar-email (ver crearClienteBot). Volver a
// llamarlo reenvía el código. clienteEmailRateLimit va antes: sin límite,
// alguien podría hacer que la casilla de Gmail mande cientos de mails en loop.
// POST /api/bot/clientes
router.post('/clientes', clienteEmailRateLimit, resolverDomicilioFiscal, crearClienteBot);

// Sin resolverClientePorTelefono: el cliente todavía no existe.
// POST /api/bot/clientes/:telefono/verificar-email
router.post('/clientes/:telefono/verificar-email', verificarEmailCliente);

// La edición no reusa updateCliente del canal admin: updateClienteBot tiene
// una lista blanca de campos y opera solo sobre el cliente del número que
// escribe. Teléfono y email tienen su propio flujo con código.
// PUT  /api/bot/clientes/:telefono
router.put('/clientes/:telefono', resolverClientePorTelefono, resolverDomicilioFiscal, updateClienteBot);

// Cambio de email: código a la casilla nueva, y el cambio se aplica al confirmar.
// POST /api/bot/clientes/:telefono/cambiar-email
router.post('/clientes/:telefono/cambiar-email', clienteEmailRateLimit, resolverClientePorTelefono, solicitarCambioEmailCliente);
// POST /api/bot/clientes/:telefono/confirmar-cambio-email
router.post('/clientes/:telefono/confirmar-cambio-email', resolverClientePorTelefono, confirmarCambioEmailCliente);

// Recuperación de cuenta (clientes y staff): quien escribe ya no es ubicable
// por su teléfono actual, así que se identifica con su email o su teléfono
// anterior en el body. Por eso no cuelga de /clientes/:telefono.
// POST /api/bot/recuperar
router.post('/recuperar', clienteEmailRateLimit, recuperarCuenta);
// POST /api/bot/confirmar-recuperacion
router.post('/confirmar-recuperacion', confirmarRecuperacionCuenta);


// Inmuebles del cliente.
//
// Cuelgan del telefono y no de /inmuebles a proposito: asi el dueño sale de la
// URL y no del body, que es un dato que el que manda el mensaje no elige.
// resolverClientePorTelefono deja el cliente en req.cliente antes de cada
// handler, igual que en el GET de arriba.
//
// Por eso NO reusan createInmueble/updateInmueble del canal web como si lo
// hacen los clientes: esos esperan el id_cliente en el body y el update copia
// el body entero, lo que dejaria a n8n mover un inmueble a otro cliente.

// GET    /api/bot/clientes/:telefono/inmuebles
router.get('/clientes/:telefono/inmuebles', resolverClientePorTelefono, getInmueblesDelCliente);
// GET    /api/bot/clientes/:telefono/inmuebles/:id
router.get('/clientes/:telefono/inmuebles/:id', resolverClientePorTelefono, getInmuebleDelCliente);
// POST   /api/bot/clientes/:telefono/inmuebles
router.post('/clientes/:telefono/inmuebles', resolverClientePorTelefono, createInmuebleBot);
// PUT    /api/bot/clientes/:telefono/inmuebles/:id
router.put('/clientes/:telefono/inmuebles/:id', resolverClientePorTelefono, updateInmuebleBot);
// DELETE /api/bot/clientes/:telefono/inmuebles/:id/baja
router.delete('/clientes/:telefono/inmuebles/:id/baja', resolverClientePorTelefono, darDeBajaInmuebleBot);


// Auxiliar del alta: convierte el pin de ubicacion en una direccion sugerida.
// No toca la base ni depende de un cliente, por eso no lleva el middleware.
// POST /api/bot/ubicacion/reversa
router.post('/ubicacion/reversa', sugerirUbicacion);

export default router;
