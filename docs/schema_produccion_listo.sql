--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: fn_calcular_superficie_mantenible(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_calcular_superficie_mantenible() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Si no se pasó un valor manual de superficie_mantenible, la calcula automáticamente
  IF NEW.superficie_mantenible IS NULL THEN
    IF NEW.superficie_total IS NOT NULL THEN
      NEW.superficie_mantenible := NEW.superficie_total - COALESCE(NEW.superficie_construida, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id_cliente integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    telefono character varying(30) NOT NULL,
    email character varying(150),
    domicilio_fiscal character varying(200),
    tipo_cliente character varying(20) NOT NULL,
    cuit_cuil character varying(20),
    razon_social character varying(150),
    calificacion_promedio numeric(3,2) DEFAULT 0.0,
    fecha_alta timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    estado character varying(20) DEFAULT 'Activo'::character varying,
    email_verificado boolean DEFAULT false NOT NULL,
    CONSTRAINT clientes_tipo_cliente_check CHECK (((tipo_cliente)::text = ANY ((ARRAY['Fijo'::character varying, 'Casual'::character varying, 'Empresa'::character varying])::text[])))
);


--
-- Name: clientes_id_cliente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clientes_id_cliente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clientes_id_cliente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clientes_id_cliente_seq OWNED BY public.clientes.id_cliente;


--
-- Name: codigos_verificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codigos_verificacion (
    id bigint NOT NULL,
    usuario_id bigint,
    tipo text NOT NULL,
    codigo_hash text NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    usado_en timestamp with time zone,
    intentos integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cliente_id bigint,
    email text,
    telefono text,
    datos jsonb,
    CONSTRAINT codigos_entidad_chk CHECK ((((tipo = ANY (ARRAY['alta_cliente'::text, 'alta_usuario'::text])) AND (usuario_id IS NULL) AND (cliente_id IS NULL) AND (datos IS NOT NULL)) OR ((tipo <> ALL (ARRAY['alta_cliente'::text, 'alta_usuario'::text])) AND (num_nonnulls(usuario_id, cliente_id) = 1)))),
    CONSTRAINT codigos_verificacion_tipo_check CHECK ((tipo = ANY (ARRAY['verificacion_email'::text, 'recuperacion_password'::text, 'verificacion_email_cliente'::text, 'recuperacion_telefono_cliente'::text, 'alta_cliente'::text, 'alta_usuario'::text, 'recuperacion_telefono_usuario'::text, 'cambio_email_cliente'::text])))
);


--
-- Name: codigos_verificacion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.codigos_verificacion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: codigos_verificacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.codigos_verificacion_id_seq OWNED BY public.codigos_verificacion.id;


--
-- Name: configuracion_empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracion_empresa (
    id_config integer NOT NULL,
    nombre_empresa character varying(100) DEFAULT 'Valle La Armonía'::character varying,
    logo_url character varying(255),
    color_primario character varying(10) DEFAULT '#2D6A4F'::character varying,
    color_secundario character varying(10) DEFAULT '#52B788'::character varying,
    telefono_oficial character varying(30),
    cuit character varying(20),
    condicion_iva character varying(50)
);


--
-- Name: configuracion_empresa_id_config_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.configuracion_empresa_id_config_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: configuracion_empresa_id_config_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.configuracion_empresa_id_config_seq OWNED BY public.configuracion_empresa.id_config;


--
-- Name: cuentas_corrientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cuentas_corrientes (
    id_cuenta integer NOT NULL,
    id_cliente integer NOT NULL,
    saldo numeric(12,2) DEFAULT 0.0,
    estado character varying(20) DEFAULT 'Pagado'::character varying,
    ultima_actualizacion timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cuentas_corrientes_id_cuenta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cuentas_corrientes_id_cuenta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cuentas_corrientes_id_cuenta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cuentas_corrientes_id_cuenta_seq OWNED BY public.cuentas_corrientes.id_cuenta;


--
-- Name: detalle_presupuesto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_presupuesto (
    id_detalle integer NOT NULL,
    id_presupuesto integer NOT NULL,
    id_servicio integer NOT NULL,
    cantidad numeric(10,2) NOT NULL,
    precio_unitario numeric(12,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL
);


--
-- Name: detalle_presupuesto_id_detalle_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_presupuesto_id_detalle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_presupuesto_id_detalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_presupuesto_id_detalle_seq OWNED BY public.detalle_presupuesto.id_detalle;


--
-- Name: encuestas_calificaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.encuestas_calificaciones (
    id_encuesta integer NOT NULL,
    id_trabajo integer NOT NULL,
    id_cliente integer NOT NULL,
    puntaje_general integer NOT NULL,
    comentarios text,
    sugerencias text,
    fecha_envio timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta timestamp with time zone,
    estado character varying(20) DEFAULT 'Enviada'::character varying,
    CONSTRAINT encuestas_calificaciones_puntaje_general_check CHECK (((puntaje_general >= 1) AND (puntaje_general <= 5)))
);


--
-- Name: encuestas_calificaciones_id_encuesta_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.encuestas_calificaciones_id_encuesta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: encuestas_calificaciones_id_encuesta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.encuestas_calificaciones_id_encuesta_seq OWNED BY public.encuestas_calificaciones.id_encuesta;


--
-- Name: especies_planta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especies_planta (
    id_especie integer NOT NULL,
    nombre_comun character varying(100) NOT NULL,
    nombre_cientifico character varying(150),
    descripcion text,
    ciclo_poda_dias integer,
    ciclo_abono_dias integer,
    ciclo_fertilizacion_dias integer,
    cuidados_generales text
);


--
-- Name: especies_planta_id_especie_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.especies_planta_id_especie_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: especies_planta_id_especie_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.especies_planta_id_especie_seq OWNED BY public.especies_planta.id_especie;


--
-- Name: facturas_arca; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.facturas_arca (
    id_factura integer NOT NULL,
    id_cliente integer NOT NULL,
    id_trabajo integer,
    cuit_cuil character varying(20) NOT NULL,
    razon_social character varying(150) NOT NULL,
    tipo_comprobante character varying(20),
    cae character varying(50),
    fecha_vto_cae date,
    unidades numeric(10,2),
    importe_neto numeric(12,2),
    importe_total numeric(12,2) NOT NULL,
    fecha_emision timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: facturas_arca_id_factura_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facturas_arca_id_factura_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facturas_arca_id_factura_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facturas_arca_id_factura_seq OWNED BY public.facturas_arca.id_factura;


--
-- Name: fotos_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fotos_servicio (
    id_foto integer NOT NULL,
    id_trabajo integer NOT NULL,
    archivo_url character varying(255) NOT NULL,
    fecha_carga timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    enviada_cliente boolean DEFAULT false
);


--
-- Name: fotos_servicio_id_foto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fotos_servicio_id_foto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fotos_servicio_id_foto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fotos_servicio_id_foto_seq OWNED BY public.fotos_servicio.id_foto;


--
-- Name: gastos_insumos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gastos_insumos (
    id_gasto integer NOT NULL,
    id_maquina integer,
    id_trabajo integer,
    categoria character varying(50) NOT NULL,
    descripcion character varying(200) NOT NULL,
    monto_bruto numeric(12,2) NOT NULL,
    impuestos numeric(12,2) DEFAULT 0.0,
    monto_neto numeric(12,2) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    comprobante_url character varying(255)
);


--
-- Name: gastos_insumos_id_gasto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gastos_insumos_id_gasto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gastos_insumos_id_gasto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gastos_insumos_id_gasto_seq OWNED BY public.gastos_insumos.id_gasto;


--
-- Name: inmuebles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inmuebles (
    id_inmueble integer NOT NULL,
    id_cliente integer NOT NULL,
    barrio character varying(100),
    manzana character varying(20),
    lote character varying(20),
    direccion character varying(200) NOT NULL,
    tipo_inmueble character varying(20) NOT NULL,
    superficie_total numeric(10,2) NOT NULL,
    superficie_construida numeric(10,2) DEFAULT 0.0,
    superficie_mantenible numeric(10,2),
    estado_vegetacion character varying(50),
    altura_cesped_cm numeric(5,2),
    tiempo_promedio_min integer,
    latitud numeric(10,8),
    longitud numeric(11,8),
    provincia character varying(100) DEFAULT 'Córdoba'::character varying NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT inmuebles_tipo_inmueble_check CHECK (((tipo_inmueble)::text = ANY ((ARRAY['Lote Vacio'::character varying, 'Casa Habitada'::character varying])::text[])))
);


--
-- Name: inmuebles_id_inmueble_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inmuebles_id_inmueble_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inmuebles_id_inmueble_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inmuebles_id_inmueble_seq OWNED BY public.inmuebles.id_inmueble;


--
-- Name: interacciones_chatbot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interacciones_chatbot (
    id_interaccion integer NOT NULL,
    id_cliente integer,
    telefono_origen character varying(30) NOT NULL,
    consulta_mensaje text NOT NULL,
    respuesta_mensaje text NOT NULL,
    accion_derivada character varying(100),
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: interacciones_chatbot_id_interaccion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.interacciones_chatbot_id_interaccion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: interacciones_chatbot_id_interaccion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.interacciones_chatbot_id_interaccion_seq OWNED BY public.interacciones_chatbot.id_interaccion;


--
-- Name: maquinas_equipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maquinas_equipos (
    id_maquina integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo character varying(50),
    fecha_adquisicion date,
    horas_de_uso numeric(8,2) DEFAULT 0.0,
    estado character varying(20) DEFAULT 'Operativa'::character varying
);


--
-- Name: maquinas_equipos_id_maquina_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.maquinas_equipos_id_maquina_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maquinas_equipos_id_maquina_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.maquinas_equipos_id_maquina_seq OWNED BY public.maquinas_equipos.id_maquina;


--
-- Name: mercadopago_conexion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mercadopago_conexion (
    id bigint NOT NULL,
    id_usuario bigint NOT NULL,
    mp_user_id bigint NOT NULL,
    access_token_enc text NOT NULL,
    refresh_token_enc text NOT NULL,
    scope text,
    expira_en timestamp with time zone NOT NULL,
    estado text DEFAULT 'Conectada'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mercadopago_conexion_estado_check CHECK ((estado = ANY (ARRAY['Conectada'::text, 'Reautorizar'::text])))
);


--
-- Name: mercadopago_conexion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mercadopago_conexion ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.mercadopago_conexion_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mercadopago_oauth_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mercadopago_oauth_state (
    state_hash text NOT NULL,
    id_usuario bigint NOT NULL,
    expira_en timestamp with time zone NOT NULL,
    usado_en timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: movimientos_cuenta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimientos_cuenta (
    id_movimiento integer NOT NULL,
    id_cuenta integer NOT NULL,
    tipo character varying(20) NOT NULL,
    monto numeric(12,2) NOT NULL,
    concepto character varying(200) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT movimientos_cuenta_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['Debito'::character varying, 'Credito'::character varying, 'Ajuste'::character varying])::text[])))
);


--
-- Name: movimientos_cuenta_id_movimiento_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimientos_cuenta_id_movimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimientos_cuenta_id_movimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movimientos_cuenta_id_movimiento_seq OWNED BY public.movimientos_cuenta.id_movimiento;


--
-- Name: notificaciones_alertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones_alertas (
    id_notificacion integer NOT NULL,
    id_cliente integer,
    id_inmueble integer,
    id_turno integer,
    tipo character varying(50) NOT NULL,
    destinatario character varying(30) NOT NULL,
    canal character varying(30) NOT NULL,
    mensaje text NOT NULL,
    fecha_emision timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    estado character varying(20) DEFAULT 'Pendiente'::character varying
);


--
-- Name: notificaciones_alertas_id_notificacion_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notificaciones_alertas_id_notificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notificaciones_alertas_id_notificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notificaciones_alertas_id_notificacion_seq OWNED BY public.notificaciones_alertas.id_notificacion;


--
-- Name: operarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operarios (
    id_operario integer NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    telefono character varying(30),
    rol character varying(50),
    fecha_ingreso date,
    estado character varying(20) DEFAULT 'Activo'::character varying
);


--
-- Name: operarios_id_operario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operarios_id_operario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operarios_id_operario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operarios_id_operario_seq OWNED BY public.operarios.id_operario;


--
-- Name: pagos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos (
    id_pago integer NOT NULL,
    id_cliente integer NOT NULL,
    id_trabajo integer,
    id_movimiento integer,
    monto numeric(12,2) NOT NULL,
    medio_pago character varying(30) NOT NULL,
    referencia_comprobante character varying(100),
    estado character varying(20) DEFAULT 'Pendiente'::character varying,
    fecha_pago timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pagos_medio_pago_check CHECK (((medio_pago)::text = ANY ((ARRAY['MercadoPago_QR'::character varying, 'Transferencia'::character varying, 'Efectivo'::character varying])::text[])))
);


--
-- Name: pagos_id_pago_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_id_pago_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_id_pago_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_id_pago_seq OWNED BY public.pagos.id_pago;


--
-- Name: pagos_operarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_operarios (
    id_pago_operario integer NOT NULL,
    id_operario integer NOT NULL,
    id_trabajo integer,
    periodo character varying(30),
    monto numeric(12,2) NOT NULL,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pagos_operarios_id_pago_operario_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_operarios_id_pago_operario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_operarios_id_pago_operario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_operarios_id_pago_operario_seq OWNED BY public.pagos_operarios.id_pago_operario;


--
-- Name: plantados_realizados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plantados_realizados (
    id_plantado integer NOT NULL,
    id_trabajo integer NOT NULL,
    id_especie integer NOT NULL,
    cantidad integer NOT NULL,
    fecha_plantado date NOT NULL,
    proxima_poda_sugerida date,
    proximo_abono_sugerido date
);


--
-- Name: plantados_realizados_id_plantado_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plantados_realizados_id_plantado_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plantados_realizados_id_plantado_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plantados_realizados_id_plantado_seq OWNED BY public.plantados_realizados.id_plantado;


--
-- Name: presupuestos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presupuestos (
    id_presupuesto integer NOT NULL,
    id_solicitud integer,
    id_cliente integer NOT NULL,
    id_inmueble integer NOT NULL,
    tipo_presupuesto character varying(30),
    tiempo_estimado_horas numeric(5,2),
    recargo_logistico numeric(12,2) DEFAULT 0.0,
    monto_subtotal numeric(12,2) NOT NULL,
    descuento numeric(12,2) DEFAULT 0.0,
    monto_total numeric(12,2) NOT NULL,
    estado character varying(30) DEFAULT 'Borrador'::character varying,
    documento_pdf_url character varying(255),
    fecha_emision timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    nota text,
    monto_estimado numeric(12,2)
);


--
-- Name: presupuestos_id_presupuesto_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.presupuestos_id_presupuesto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: presupuestos_id_presupuesto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.presupuestos_id_presupuesto_seq OWNED BY public.presupuestos.id_presupuesto;


--
-- Name: sectores_inmueble; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sectores_inmueble (
    id_sector integer NOT NULL,
    id_inmueble integer NOT NULL,
    nombre_sector character varying(100) NOT NULL,
    medidas character varying(50),
    superficie_m2 numeric(10,2) NOT NULL
);


--
-- Name: sectores_inmueble_id_sector_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sectores_inmueble_id_sector_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sectores_inmueble_id_sector_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sectores_inmueble_id_sector_seq OWNED BY public.sectores_inmueble.id_sector;


--
-- Name: services_maquina; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services_maquina (
    id_service integer NOT NULL,
    id_maquina integer NOT NULL,
    tipo_service character varying(100),
    fecha date NOT NULL,
    costo numeric(12,2) NOT NULL,
    horas_uso_al_service numeric(8,2),
    proximo_service_horas numeric(8,2),
    observaciones text
);


--
-- Name: services_maquina_id_service_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.services_maquina_id_service_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: services_maquina_id_service_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.services_maquina_id_service_seq OWNED BY public.services_maquina.id_service;


--
-- Name: servicios_catalogo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicios_catalogo (
    id_servicio integer NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    variable_cotizacion character varying(30),
    limite_operativo_parametro character varying(100)
);


--
-- Name: servicios_catalogo_id_servicio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicios_catalogo_id_servicio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicios_catalogo_id_servicio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicios_catalogo_id_servicio_seq OWNED BY public.servicios_catalogo.id_servicio;


--
-- Name: sesiones_wa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sesiones_wa (
    wa_id text NOT NULL,
    estado text DEFAULT 'menu'::text NOT NULL,
    contexto jsonb DEFAULT '{}'::jsonb NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: solicitud_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitud_servicio (
    id_solicitud_servicio bigint NOT NULL,
    id_solicitud integer NOT NULL,
    id_servicio integer NOT NULL,
    superficie_m2 numeric(12,2) NOT NULL,
    CONSTRAINT solicitud_servicio_superficie_m2_check CHECK ((superficie_m2 > (0)::numeric))
);


--
-- Name: solicitud_servicio_id_solicitud_servicio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.solicitud_servicio ALTER COLUMN id_solicitud_servicio ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.solicitud_servicio_id_solicitud_servicio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: solicitudes_presupuesto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_presupuesto (
    id_solicitud integer NOT NULL,
    id_cliente integer,
    id_inmueble integer,
    tipo_servicio_requerido character varying(100),
    fecha_solicitud timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    origen character varying(30),
    estado character varying(30) DEFAULT 'Nueva'::character varying
);


--
-- Name: solicitudes_presupuesto_id_solicitud_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.solicitudes_presupuesto_id_solicitud_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_presupuesto_id_solicitud_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.solicitudes_presupuesto_id_solicitud_seq OWNED BY public.solicitudes_presupuesto.id_solicitud;


--
-- Name: solicitudes_visita; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.solicitudes_visita (
    id_solicitud bigint NOT NULL,
    telefono text NOT NULL,
    nombre text NOT NULL,
    apellido text NOT NULL,
    direccion text NOT NULL,
    barrio text,
    provincia text,
    latitud double precision,
    longitud double precision,
    servicio text,
    fecha_preferida date,
    franja_preferida text DEFAULT 'Indistinto'::text NOT NULL,
    nota_horario text,
    estado text DEFAULT 'Pendiente'::text NOT NULL,
    id_cliente bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    superficie_aproximada numeric,
    contactada_at timestamp with time zone,
    contactada_por bigint,
    id_inmueble bigint,
    id_presupuesto bigint,
    id_turno bigint,
    CONSTRAINT solicitudes_visita_estado_check CHECK ((estado = ANY (ARRAY['Pendiente'::text, 'Contactada'::text, 'Confirmada'::text, 'Realizada'::text, 'Cancelada'::text]))),
    CONSTRAINT solicitudes_visita_franja_preferida_check CHECK ((franja_preferida = ANY (ARRAY['Mañana'::text, 'Tarde'::text, 'Indistinto'::text]))),
    CONSTRAINT solicitudes_visita_superficie_aproximada_check CHECK ((superficie_aproximada > (0)::numeric))
);


--
-- Name: solicitudes_visita_id_solicitud_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes_visita ALTER COLUMN id_solicitud ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.solicitudes_visita_id_solicitud_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: trabajos_ejecutados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trabajos_ejecutados (
    id_trabajo integer NOT NULL,
    id_turno integer NOT NULL,
    id_operario_lider integer,
    fecha_ejecucion date NOT NULL,
    hora_inicio time without time zone,
    hora_fin time without time zone,
    duracion_real_min integer,
    observaciones text
);


--
-- Name: trabajos_ejecutados_id_trabajo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trabajos_ejecutados_id_trabajo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trabajos_ejecutados_id_trabajo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trabajos_ejecutados_id_trabajo_seq OWNED BY public.trabajos_ejecutados.id_trabajo;


--
-- Name: turnos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.turnos (
    id_turno integer NOT NULL,
    id_presupuesto integer,
    id_inmueble integer NOT NULL,
    fecha_programada date NOT NULL,
    prioridad character varying(20) NOT NULL,
    estado character varying(20) DEFAULT 'Coordinado'::character varying,
    motivo_cancelacion text,
    inicio_desde time without time zone,
    hasta time without time zone,
    CONSTRAINT chk_horarios_validos CHECK (((inicio_desde IS NULL) OR (hasta IS NULL) OR (inicio_desde < hasta))),
    CONSTRAINT turnos_prioridad_check CHECK (((prioridad)::text = ANY ((ARRAY['P1_Reasignado'::character varying, 'P2_Fijo'::character varying, 'P3_Casual'::character varying])::text[])))
);


--
-- Name: turnos_id_turno_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.turnos_id_turno_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: turnos_id_turno_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.turnos_id_turno_seq OWNED BY public.turnos.id_turno;


--
-- Name: usuario_servicio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_servicio (
    id_usuario_servicio bigint NOT NULL,
    id_usuario bigint NOT NULL,
    id_servicio bigint NOT NULL,
    precio_base numeric(12,2) NOT NULL,
    limite_operativo numeric,
    activo boolean DEFAULT true NOT NULL,
    CONSTRAINT usuario_servicio_precio_base_check CHECK ((precio_base >= (0)::numeric))
);


--
-- Name: usuario_servicio_id_usuario_servicio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.usuario_servicio ALTER COLUMN id_usuario_servicio ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.usuario_servicio_id_usuario_servicio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id bigint NOT NULL,
    usuario text,
    password_hash text NOT NULL,
    rol text DEFAULT 'user'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    telefono character varying(20) DEFAULT ''::character varying NOT NULL,
    email_verificado boolean DEFAULT false NOT NULL,
    debe_cambiar_password boolean DEFAULT false NOT NULL,
    password_temporal_expira timestamp with time zone,
    CONSTRAINT usuarios_rol_check CHECK ((rol = ANY (ARRAY['admin'::text, 'user'::text, 'viewer'::text])))
);


--
-- Name: usuarios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuarios_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuarios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuarios_id_seq OWNED BY public.usuarios.id;


--
-- Name: visitas_verificacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visitas_verificacion (
    id_visita integer NOT NULL,
    id_solicitud integer NOT NULL,
    fecha_visita timestamp with time zone NOT NULL,
    m2_medidos numeric(10,2),
    tipo_servicio_confirmado character varying(100),
    estado_terreno text,
    observaciones text
);


--
-- Name: visitas_verificacion_id_visita_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.visitas_verificacion_id_visita_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: visitas_verificacion_id_visita_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.visitas_verificacion_id_visita_seq OWNED BY public.visitas_verificacion.id_visita;


--
-- Name: clientes id_cliente; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes ALTER COLUMN id_cliente SET DEFAULT nextval('public.clientes_id_cliente_seq'::regclass);


--
-- Name: codigos_verificacion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_verificacion ALTER COLUMN id SET DEFAULT nextval('public.codigos_verificacion_id_seq'::regclass);


--
-- Name: configuracion_empresa id_config; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_empresa ALTER COLUMN id_config SET DEFAULT nextval('public.configuracion_empresa_id_config_seq'::regclass);


--
-- Name: cuentas_corrientes id_cuenta; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuentas_corrientes ALTER COLUMN id_cuenta SET DEFAULT nextval('public.cuentas_corrientes_id_cuenta_seq'::regclass);


--
-- Name: detalle_presupuesto id_detalle; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_presupuesto ALTER COLUMN id_detalle SET DEFAULT nextval('public.detalle_presupuesto_id_detalle_seq'::regclass);


--
-- Name: encuestas_calificaciones id_encuesta; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas_calificaciones ALTER COLUMN id_encuesta SET DEFAULT nextval('public.encuestas_calificaciones_id_encuesta_seq'::regclass);


--
-- Name: especies_planta id_especie; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especies_planta ALTER COLUMN id_especie SET DEFAULT nextval('public.especies_planta_id_especie_seq'::regclass);


--
-- Name: facturas_arca id_factura; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas_arca ALTER COLUMN id_factura SET DEFAULT nextval('public.facturas_arca_id_factura_seq'::regclass);


--
-- Name: fotos_servicio id_foto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_servicio ALTER COLUMN id_foto SET DEFAULT nextval('public.fotos_servicio_id_foto_seq'::regclass);


--
-- Name: gastos_insumos id_gasto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_insumos ALTER COLUMN id_gasto SET DEFAULT nextval('public.gastos_insumos_id_gasto_seq'::regclass);


--
-- Name: inmuebles id_inmueble; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inmuebles ALTER COLUMN id_inmueble SET DEFAULT nextval('public.inmuebles_id_inmueble_seq'::regclass);


--
-- Name: interacciones_chatbot id_interaccion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacciones_chatbot ALTER COLUMN id_interaccion SET DEFAULT nextval('public.interacciones_chatbot_id_interaccion_seq'::regclass);


--
-- Name: maquinas_equipos id_maquina; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maquinas_equipos ALTER COLUMN id_maquina SET DEFAULT nextval('public.maquinas_equipos_id_maquina_seq'::regclass);


--
-- Name: movimientos_cuenta id_movimiento; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_cuenta ALTER COLUMN id_movimiento SET DEFAULT nextval('public.movimientos_cuenta_id_movimiento_seq'::regclass);


--
-- Name: notificaciones_alertas id_notificacion; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_alertas ALTER COLUMN id_notificacion SET DEFAULT nextval('public.notificaciones_alertas_id_notificacion_seq'::regclass);


--
-- Name: operarios id_operario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operarios ALTER COLUMN id_operario SET DEFAULT nextval('public.operarios_id_operario_seq'::regclass);


--
-- Name: pagos id_pago; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos ALTER COLUMN id_pago SET DEFAULT nextval('public.pagos_id_pago_seq'::regclass);


--
-- Name: pagos_operarios id_pago_operario; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_operarios ALTER COLUMN id_pago_operario SET DEFAULT nextval('public.pagos_operarios_id_pago_operario_seq'::regclass);


--
-- Name: plantados_realizados id_plantado; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantados_realizados ALTER COLUMN id_plantado SET DEFAULT nextval('public.plantados_realizados_id_plantado_seq'::regclass);


--
-- Name: presupuestos id_presupuesto; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos ALTER COLUMN id_presupuesto SET DEFAULT nextval('public.presupuestos_id_presupuesto_seq'::regclass);


--
-- Name: sectores_inmueble id_sector; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sectores_inmueble ALTER COLUMN id_sector SET DEFAULT nextval('public.sectores_inmueble_id_sector_seq'::regclass);


--
-- Name: services_maquina id_service; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_maquina ALTER COLUMN id_service SET DEFAULT nextval('public.services_maquina_id_service_seq'::regclass);


--
-- Name: servicios_catalogo id_servicio; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios_catalogo ALTER COLUMN id_servicio SET DEFAULT nextval('public.servicios_catalogo_id_servicio_seq'::regclass);


--
-- Name: solicitudes_presupuesto id_solicitud; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_presupuesto ALTER COLUMN id_solicitud SET DEFAULT nextval('public.solicitudes_presupuesto_id_solicitud_seq'::regclass);


--
-- Name: trabajos_ejecutados id_trabajo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajos_ejecutados ALTER COLUMN id_trabajo SET DEFAULT nextval('public.trabajos_ejecutados_id_trabajo_seq'::regclass);


--
-- Name: turnos id_turno; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos ALTER COLUMN id_turno SET DEFAULT nextval('public.turnos_id_turno_seq'::regclass);


--
-- Name: usuarios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios ALTER COLUMN id SET DEFAULT nextval('public.usuarios_id_seq'::regclass);


--
-- Name: visitas_verificacion id_visita; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_verificacion ALTER COLUMN id_visita SET DEFAULT nextval('public.visitas_verificacion_id_visita_seq'::regclass);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id_cliente);


--
-- Name: clientes clientes_telefono_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_telefono_key UNIQUE (telefono);


--
-- Name: codigos_verificacion codigos_verificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_verificacion
    ADD CONSTRAINT codigos_verificacion_pkey PRIMARY KEY (id);


--
-- Name: configuracion_empresa configuracion_empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracion_empresa
    ADD CONSTRAINT configuracion_empresa_pkey PRIMARY KEY (id_config);


--
-- Name: cuentas_corrientes cuentas_corrientes_id_cliente_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuentas_corrientes
    ADD CONSTRAINT cuentas_corrientes_id_cliente_key UNIQUE (id_cliente);


--
-- Name: cuentas_corrientes cuentas_corrientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuentas_corrientes
    ADD CONSTRAINT cuentas_corrientes_pkey PRIMARY KEY (id_cuenta);


--
-- Name: detalle_presupuesto detalle_presupuesto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_presupuesto
    ADD CONSTRAINT detalle_presupuesto_pkey PRIMARY KEY (id_detalle);


--
-- Name: encuestas_calificaciones encuestas_calificaciones_id_trabajo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas_calificaciones
    ADD CONSTRAINT encuestas_calificaciones_id_trabajo_key UNIQUE (id_trabajo);


--
-- Name: encuestas_calificaciones encuestas_calificaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas_calificaciones
    ADD CONSTRAINT encuestas_calificaciones_pkey PRIMARY KEY (id_encuesta);


--
-- Name: especies_planta especies_planta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especies_planta
    ADD CONSTRAINT especies_planta_pkey PRIMARY KEY (id_especie);


--
-- Name: facturas_arca facturas_arca_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas_arca
    ADD CONSTRAINT facturas_arca_pkey PRIMARY KEY (id_factura);


--
-- Name: fotos_servicio fotos_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_servicio
    ADD CONSTRAINT fotos_servicio_pkey PRIMARY KEY (id_foto);


--
-- Name: gastos_insumos gastos_insumos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_insumos
    ADD CONSTRAINT gastos_insumos_pkey PRIMARY KEY (id_gasto);


--
-- Name: inmuebles inmuebles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inmuebles
    ADD CONSTRAINT inmuebles_pkey PRIMARY KEY (id_inmueble);


--
-- Name: interacciones_chatbot interacciones_chatbot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacciones_chatbot
    ADD CONSTRAINT interacciones_chatbot_pkey PRIMARY KEY (id_interaccion);


--
-- Name: maquinas_equipos maquinas_equipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maquinas_equipos
    ADD CONSTRAINT maquinas_equipos_pkey PRIMARY KEY (id_maquina);


--
-- Name: mercadopago_conexion mercadopago_conexion_id_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadopago_conexion
    ADD CONSTRAINT mercadopago_conexion_id_usuario_key UNIQUE (id_usuario);


--
-- Name: mercadopago_conexion mercadopago_conexion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadopago_conexion
    ADD CONSTRAINT mercadopago_conexion_pkey PRIMARY KEY (id);


--
-- Name: mercadopago_oauth_state mercadopago_oauth_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadopago_oauth_state
    ADD CONSTRAINT mercadopago_oauth_state_pkey PRIMARY KEY (state_hash);


--
-- Name: movimientos_cuenta movimientos_cuenta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_cuenta
    ADD CONSTRAINT movimientos_cuenta_pkey PRIMARY KEY (id_movimiento);


--
-- Name: notificaciones_alertas notificaciones_alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_alertas
    ADD CONSTRAINT notificaciones_alertas_pkey PRIMARY KEY (id_notificacion);


--
-- Name: operarios operarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operarios
    ADD CONSTRAINT operarios_pkey PRIMARY KEY (id_operario);


--
-- Name: pagos_operarios pagos_operarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_operarios
    ADD CONSTRAINT pagos_operarios_pkey PRIMARY KEY (id_pago_operario);


--
-- Name: pagos pagos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_pkey PRIMARY KEY (id_pago);


--
-- Name: plantados_realizados plantados_realizados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantados_realizados
    ADD CONSTRAINT plantados_realizados_pkey PRIMARY KEY (id_plantado);


--
-- Name: presupuestos presupuestos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_pkey PRIMARY KEY (id_presupuesto);


--
-- Name: sectores_inmueble sectores_inmueble_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sectores_inmueble
    ADD CONSTRAINT sectores_inmueble_pkey PRIMARY KEY (id_sector);


--
-- Name: services_maquina services_maquina_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_maquina
    ADD CONSTRAINT services_maquina_pkey PRIMARY KEY (id_service);


--
-- Name: servicios_catalogo servicios_catalogo_nombre_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios_catalogo
    ADD CONSTRAINT servicios_catalogo_nombre_key UNIQUE (nombre);


--
-- Name: servicios_catalogo servicios_catalogo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios_catalogo
    ADD CONSTRAINT servicios_catalogo_pkey PRIMARY KEY (id_servicio);


--
-- Name: sesiones_wa sesiones_wa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sesiones_wa
    ADD CONSTRAINT sesiones_wa_pkey PRIMARY KEY (wa_id);


--
-- Name: solicitud_servicio solicitud_servicio_id_solicitud_id_servicio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_servicio
    ADD CONSTRAINT solicitud_servicio_id_solicitud_id_servicio_key UNIQUE (id_solicitud, id_servicio);


--
-- Name: solicitud_servicio solicitud_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_servicio
    ADD CONSTRAINT solicitud_servicio_pkey PRIMARY KEY (id_solicitud_servicio);


--
-- Name: solicitudes_presupuesto solicitudes_presupuesto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_presupuesto
    ADD CONSTRAINT solicitudes_presupuesto_pkey PRIMARY KEY (id_solicitud);


--
-- Name: solicitudes_visita solicitudes_visita_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_visita
    ADD CONSTRAINT solicitudes_visita_pkey PRIMARY KEY (id_solicitud);


--
-- Name: trabajos_ejecutados trabajos_ejecutados_id_turno_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajos_ejecutados
    ADD CONSTRAINT trabajos_ejecutados_id_turno_key UNIQUE (id_turno);


--
-- Name: trabajos_ejecutados trabajos_ejecutados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajos_ejecutados
    ADD CONSTRAINT trabajos_ejecutados_pkey PRIMARY KEY (id_trabajo);


--
-- Name: turnos turnos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_pkey PRIMARY KEY (id_turno);


--
-- Name: usuario_servicio usuario_servicio_id_usuario_id_servicio_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_servicio
    ADD CONSTRAINT usuario_servicio_id_usuario_id_servicio_key UNIQUE (id_usuario, id_servicio);


--
-- Name: usuario_servicio usuario_servicio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_servicio
    ADD CONSTRAINT usuario_servicio_pkey PRIMARY KEY (id_usuario_servicio);


--
-- Name: usuarios usuarios_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_email_key UNIQUE (email);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_telefono_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_telefono_key UNIQUE (telefono);


--
-- Name: usuarios usuarios_usuario_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_usuario_key UNIQUE (usuario);


--
-- Name: visitas_verificacion visitas_verificacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_verificacion
    ADD CONSTRAINT visitas_verificacion_pkey PRIMARY KEY (id_visita);


--
-- Name: clientes_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX clientes_email_unique ON public.clientes USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: codigos_alta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX codigos_alta_idx ON public.codigos_verificacion USING btree (tipo, email, telefono);


--
-- Name: idx_codigos_verificacion_cliente_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codigos_verificacion_cliente_lookup ON public.codigos_verificacion USING btree (cliente_id, tipo, usado_en);


--
-- Name: idx_codigos_verificacion_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codigos_verificacion_lookup ON public.codigos_verificacion USING btree (usuario_id, tipo, usado_en);


--
-- Name: mercadopago_oauth_state_expira_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mercadopago_oauth_state_expira_idx ON public.mercadopago_oauth_state USING btree (expira_en);


--
-- Name: solicitud_servicio_solicitud_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitud_servicio_solicitud_idx ON public.solicitud_servicio USING btree (id_solicitud);


--
-- Name: solicitudes_visita_estado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_visita_estado_idx ON public.solicitudes_visita USING btree (estado, created_at);


--
-- Name: solicitudes_visita_id_inmueble_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_visita_id_inmueble_idx ON public.solicitudes_visita USING btree (id_inmueble);


--
-- Name: solicitudes_visita_id_presupuesto_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_visita_id_presupuesto_idx ON public.solicitudes_visita USING btree (id_presupuesto);


--
-- Name: solicitudes_visita_id_turno_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_visita_id_turno_idx ON public.solicitudes_visita USING btree (id_turno);


--
-- Name: solicitudes_visita_telefono_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX solicitudes_visita_telefono_idx ON public.solicitudes_visita USING btree (telefono);


--
-- Name: usuario_servicio_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuario_servicio_usuario_idx ON public.usuario_servicio USING btree (id_usuario);


--
-- Name: inmuebles trg_calcular_superficie_mantenible; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_calcular_superficie_mantenible BEFORE INSERT OR UPDATE ON public.inmuebles FOR EACH ROW EXECUTE FUNCTION public.fn_calcular_superficie_mantenible();


--
-- Name: codigos_verificacion codigos_verificacion_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_verificacion
    ADD CONSTRAINT codigos_verificacion_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: codigos_verificacion codigos_verificacion_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codigos_verificacion
    ADD CONSTRAINT codigos_verificacion_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: cuentas_corrientes cuentas_corrientes_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cuentas_corrientes
    ADD CONSTRAINT cuentas_corrientes_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: detalle_presupuesto detalle_presupuesto_id_presupuesto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_presupuesto
    ADD CONSTRAINT detalle_presupuesto_id_presupuesto_fkey FOREIGN KEY (id_presupuesto) REFERENCES public.presupuestos(id_presupuesto) ON DELETE CASCADE;


--
-- Name: detalle_presupuesto detalle_presupuesto_id_servicio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_presupuesto
    ADD CONSTRAINT detalle_presupuesto_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios_catalogo(id_servicio);


--
-- Name: encuestas_calificaciones encuestas_calificaciones_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas_calificaciones
    ADD CONSTRAINT encuestas_calificaciones_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: encuestas_calificaciones encuestas_calificaciones_id_trabajo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.encuestas_calificaciones
    ADD CONSTRAINT encuestas_calificaciones_id_trabajo_fkey FOREIGN KEY (id_trabajo) REFERENCES public.trabajos_ejecutados(id_trabajo) ON DELETE CASCADE;


--
-- Name: facturas_arca facturas_arca_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas_arca
    ADD CONSTRAINT facturas_arca_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: facturas_arca facturas_arca_id_trabajo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facturas_arca
    ADD CONSTRAINT facturas_arca_id_trabajo_fkey FOREIGN KEY (id_trabajo) REFERENCES public.trabajos_ejecutados(id_trabajo);


--
-- Name: fotos_servicio fotos_servicio_id_trabajo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fotos_servicio
    ADD CONSTRAINT fotos_servicio_id_trabajo_fkey FOREIGN KEY (id_trabajo) REFERENCES public.trabajos_ejecutados(id_trabajo) ON DELETE CASCADE;


--
-- Name: gastos_insumos gastos_insumos_id_maquina_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_insumos
    ADD CONSTRAINT gastos_insumos_id_maquina_fkey FOREIGN KEY (id_maquina) REFERENCES public.maquinas_equipos(id_maquina);


--
-- Name: gastos_insumos gastos_insumos_id_trabajo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gastos_insumos
    ADD CONSTRAINT gastos_insumos_id_trabajo_fkey FOREIGN KEY (id_trabajo) REFERENCES public.trabajos_ejecutados(id_trabajo);


--
-- Name: inmuebles inmuebles_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inmuebles
    ADD CONSTRAINT inmuebles_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: interacciones_chatbot interacciones_chatbot_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interacciones_chatbot
    ADD CONSTRAINT interacciones_chatbot_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE SET NULL;


--
-- Name: mercadopago_conexion mercadopago_conexion_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadopago_conexion
    ADD CONSTRAINT mercadopago_conexion_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: mercadopago_oauth_state mercadopago_oauth_state_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercadopago_oauth_state
    ADD CONSTRAINT mercadopago_oauth_state_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: movimientos_cuenta movimientos_cuenta_id_cuenta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimientos_cuenta
    ADD CONSTRAINT movimientos_cuenta_id_cuenta_fkey FOREIGN KEY (id_cuenta) REFERENCES public.cuentas_corrientes(id_cuenta) ON DELETE CASCADE;


--
-- Name: notificaciones_alertas notificaciones_alertas_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_alertas
    ADD CONSTRAINT notificaciones_alertas_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: notificaciones_alertas notificaciones_alertas_id_inmueble_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_alertas
    ADD CONSTRAINT notificaciones_alertas_id_inmueble_fkey FOREIGN KEY (id_inmueble) REFERENCES public.inmuebles(id_inmueble) ON DELETE CASCADE;


--
-- Name: notificaciones_alertas notificaciones_alertas_id_turno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_alertas
    ADD CONSTRAINT notificaciones_alertas_id_turno_fkey FOREIGN KEY (id_turno) REFERENCES public.turnos(id_turno) ON DELETE SET NULL;


--
-- Name: pagos pagos_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: pagos pagos_id_movimiento_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_movimiento_fkey FOREIGN KEY (id_movimiento) REFERENCES public.movimientos_cuenta(id_movimiento);


--
-- Name: pagos pagos_id_trabajo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos
    ADD CONSTRAINT pagos_id_trabajo_fkey FOREIGN KEY (id_trabajo) REFERENCES public.trabajos_ejecutados(id_trabajo);


--
-- Name: pagos_operarios pagos_operarios_id_operario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_operarios
    ADD CONSTRAINT pagos_operarios_id_operario_fkey FOREIGN KEY (id_operario) REFERENCES public.operarios(id_operario) ON DELETE CASCADE;


--
-- Name: pagos_operarios pagos_operarios_id_trabajo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_operarios
    ADD CONSTRAINT pagos_operarios_id_trabajo_fkey FOREIGN KEY (id_trabajo) REFERENCES public.trabajos_ejecutados(id_trabajo);


--
-- Name: plantados_realizados plantados_realizados_id_especie_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantados_realizados
    ADD CONSTRAINT plantados_realizados_id_especie_fkey FOREIGN KEY (id_especie) REFERENCES public.especies_planta(id_especie);


--
-- Name: plantados_realizados plantados_realizados_id_trabajo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plantados_realizados
    ADD CONSTRAINT plantados_realizados_id_trabajo_fkey FOREIGN KEY (id_trabajo) REFERENCES public.trabajos_ejecutados(id_trabajo) ON DELETE CASCADE;


--
-- Name: presupuestos presupuestos_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE CASCADE;


--
-- Name: presupuestos presupuestos_id_inmueble_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_id_inmueble_fkey FOREIGN KEY (id_inmueble) REFERENCES public.inmuebles(id_inmueble) ON DELETE CASCADE;


--
-- Name: presupuestos presupuestos_id_solicitud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presupuestos
    ADD CONSTRAINT presupuestos_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_presupuesto(id_solicitud) ON DELETE SET NULL;


--
-- Name: sectores_inmueble sectores_inmueble_id_inmueble_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sectores_inmueble
    ADD CONSTRAINT sectores_inmueble_id_inmueble_fkey FOREIGN KEY (id_inmueble) REFERENCES public.inmuebles(id_inmueble) ON DELETE CASCADE;


--
-- Name: services_maquina services_maquina_id_maquina_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services_maquina
    ADD CONSTRAINT services_maquina_id_maquina_fkey FOREIGN KEY (id_maquina) REFERENCES public.maquinas_equipos(id_maquina) ON DELETE CASCADE;


--
-- Name: solicitud_servicio solicitud_servicio_id_servicio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_servicio
    ADD CONSTRAINT solicitud_servicio_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios_catalogo(id_servicio);


--
-- Name: solicitud_servicio solicitud_servicio_id_solicitud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitud_servicio
    ADD CONSTRAINT solicitud_servicio_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_visita(id_solicitud) ON DELETE CASCADE;


--
-- Name: solicitudes_presupuesto solicitudes_presupuesto_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_presupuesto
    ADD CONSTRAINT solicitudes_presupuesto_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE SET NULL;


--
-- Name: solicitudes_presupuesto solicitudes_presupuesto_id_inmueble_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_presupuesto
    ADD CONSTRAINT solicitudes_presupuesto_id_inmueble_fkey FOREIGN KEY (id_inmueble) REFERENCES public.inmuebles(id_inmueble) ON DELETE SET NULL;


--
-- Name: solicitudes_visita solicitudes_visita_contactada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_visita
    ADD CONSTRAINT solicitudes_visita_contactada_por_fkey FOREIGN KEY (contactada_por) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: solicitudes_visita solicitudes_visita_id_cliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_visita
    ADD CONSTRAINT solicitudes_visita_id_cliente_fkey FOREIGN KEY (id_cliente) REFERENCES public.clientes(id_cliente) ON DELETE SET NULL;


--
-- Name: solicitudes_visita solicitudes_visita_id_inmueble_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_visita
    ADD CONSTRAINT solicitudes_visita_id_inmueble_fkey FOREIGN KEY (id_inmueble) REFERENCES public.inmuebles(id_inmueble) ON DELETE SET NULL;


--
-- Name: solicitudes_visita solicitudes_visita_id_presupuesto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_visita
    ADD CONSTRAINT solicitudes_visita_id_presupuesto_fkey FOREIGN KEY (id_presupuesto) REFERENCES public.presupuestos(id_presupuesto) ON DELETE SET NULL;


--
-- Name: solicitudes_visita solicitudes_visita_id_turno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.solicitudes_visita
    ADD CONSTRAINT solicitudes_visita_id_turno_fkey FOREIGN KEY (id_turno) REFERENCES public.turnos(id_turno) ON DELETE SET NULL;


--
-- Name: trabajos_ejecutados trabajos_ejecutados_id_operario_lider_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajos_ejecutados
    ADD CONSTRAINT trabajos_ejecutados_id_operario_lider_fkey FOREIGN KEY (id_operario_lider) REFERENCES public.operarios(id_operario);


--
-- Name: trabajos_ejecutados trabajos_ejecutados_id_turno_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trabajos_ejecutados
    ADD CONSTRAINT trabajos_ejecutados_id_turno_fkey FOREIGN KEY (id_turno) REFERENCES public.turnos(id_turno) ON DELETE CASCADE;


--
-- Name: turnos turnos_id_inmueble_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_id_inmueble_fkey FOREIGN KEY (id_inmueble) REFERENCES public.inmuebles(id_inmueble) ON DELETE CASCADE;


--
-- Name: turnos turnos_id_presupuesto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.turnos
    ADD CONSTRAINT turnos_id_presupuesto_fkey FOREIGN KEY (id_presupuesto) REFERENCES public.presupuestos(id_presupuesto) ON DELETE SET NULL;


--
-- Name: usuario_servicio usuario_servicio_id_servicio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_servicio
    ADD CONSTRAINT usuario_servicio_id_servicio_fkey FOREIGN KEY (id_servicio) REFERENCES public.servicios_catalogo(id_servicio);


--
-- Name: usuario_servicio usuario_servicio_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_servicio
    ADD CONSTRAINT usuario_servicio_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios(id);


--
-- Name: visitas_verificacion visitas_verificacion_id_solicitud_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visitas_verificacion
    ADD CONSTRAINT visitas_verificacion_id_solicitud_fkey FOREIGN KEY (id_solicitud) REFERENCES public.solicitudes_presupuesto(id_solicitud) ON DELETE CASCADE;


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: codigos_verificacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.codigos_verificacion ENABLE ROW LEVEL SECURITY;

--
-- Name: configuracion_empresa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracion_empresa ENABLE ROW LEVEL SECURITY;

--
-- Name: cuentas_corrientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cuentas_corrientes ENABLE ROW LEVEL SECURITY;

--
-- Name: detalle_presupuesto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.detalle_presupuesto ENABLE ROW LEVEL SECURITY;

--
-- Name: encuestas_calificaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.encuestas_calificaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: especies_planta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.especies_planta ENABLE ROW LEVEL SECURITY;

--
-- Name: facturas_arca; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.facturas_arca ENABLE ROW LEVEL SECURITY;

--
-- Name: fotos_servicio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fotos_servicio ENABLE ROW LEVEL SECURITY;

--
-- Name: gastos_insumos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gastos_insumos ENABLE ROW LEVEL SECURITY;

--
-- Name: inmuebles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inmuebles ENABLE ROW LEVEL SECURITY;

--
-- Name: interacciones_chatbot; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interacciones_chatbot ENABLE ROW LEVEL SECURITY;

--
-- Name: maquinas_equipos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maquinas_equipos ENABLE ROW LEVEL SECURITY;

--
-- Name: mercadopago_conexion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mercadopago_conexion ENABLE ROW LEVEL SECURITY;

--
-- Name: mercadopago_oauth_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mercadopago_oauth_state ENABLE ROW LEVEL SECURITY;

--
-- Name: movimientos_cuenta; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.movimientos_cuenta ENABLE ROW LEVEL SECURITY;

--
-- Name: notificaciones_alertas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificaciones_alertas ENABLE ROW LEVEL SECURITY;

--
-- Name: operarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operarios ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

--
-- Name: pagos_operarios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pagos_operarios ENABLE ROW LEVEL SECURITY;

--
-- Name: plantados_realizados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plantados_realizados ENABLE ROW LEVEL SECURITY;

--
-- Name: presupuestos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

--
-- Name: sectores_inmueble; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sectores_inmueble ENABLE ROW LEVEL SECURITY;

--
-- Name: services_maquina; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services_maquina ENABLE ROW LEVEL SECURITY;

--
-- Name: servicios_catalogo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.servicios_catalogo ENABLE ROW LEVEL SECURITY;

--
-- Name: sesiones_wa; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sesiones_wa ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitud_servicio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitud_servicio ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitudes_presupuesto; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes_presupuesto ENABLE ROW LEVEL SECURITY;

--
-- Name: solicitudes_visita; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.solicitudes_visita ENABLE ROW LEVEL SECURITY;

--
-- Name: trabajos_ejecutados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trabajos_ejecutados ENABLE ROW LEVEL SECURITY;

--
-- Name: turnos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.turnos ENABLE ROW LEVEL SECURITY;

--
-- Name: usuario_servicio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usuario_servicio ENABLE ROW LEVEL SECURITY;

--
-- Name: visitas_verificacion; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.visitas_verificacion ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



