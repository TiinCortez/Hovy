import { Router } from 'express';
import { botRateLimit } from '../middleware/botRateLimit.js';
import { verificarApiKeyBot } from '../middleware/botAuth.js';
import { resolverClientePorTelefono } from '../middleware/botCliente.js';
import { getClienteByTelefono } from '../controllers/botClientesController.js';
import { createCliente, updateCliente } from '../controllers/clientesController.js';
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

// GET /api/bot/clientes/:telefono
router.get('/clientes/:telefono', resolverClientePorTelefono, getClienteByTelefono);


// Los endpoints de creacion y modificacion reusan los controllres del cliente normal
// POST /api/bot/clientes
router.post('/clientes', createCliente);
// PUT  /api/bot/clientes/:telefono
router.put('/clientes/:telefono', updateCliente);


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
