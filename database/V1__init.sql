CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tipos_vehiculo (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE marcas_vehiculo (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    id_tipo_vehiculo INTEGER NOT NULL REFERENCES tipos_vehiculo(id)
);

CREATE TABLE modelos_vehiculo (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    id_marca INTEGER NOT NULL REFERENCES marcas_vehiculo(id),
    anio_desde INTEGER NOT NULL,
    anio_hasta INTEGER,
    CONSTRAINT ck_modelos_rango_anio CHECK (anio_hasta IS NULL OR anio_hasta >= anio_desde)
);

CREATE TABLE casquillos (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    descripcion TEXT
);

CREATE TABLE compatibilidad_vehiculo_casquillo (
    id SERIAL PRIMARY KEY,
    id_modelo INTEGER NOT NULL REFERENCES modelos_vehiculo(id),
    anio_desde INTEGER NOT NULL,
    anio_hasta INTEGER,
    posicion_luz TEXT NOT NULL,
    id_casquillo INTEGER NOT NULL REFERENCES casquillos(id),
    tipo_sistema_optico TEXT NOT NULL,
    CONSTRAINT ck_compatibilidad_rango_anio CHECK (anio_hasta IS NULL OR anio_hasta >= anio_desde),
    CONSTRAINT ck_compatibilidad_posicion CHECK (posicion_luz IN ('cruce', 'largo', 'cruce_y_largo', 'antiniebla')),
    CONSTRAINT ck_compatibilidad_optica CHECK (tipo_sistema_optico IN ('lupa_proyector', 'reflector_abierto'))
);

CREATE TABLE marcas_led (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    pais_origen TEXT,
    sitio_web TEXT
);

CREATE TABLE productos_led (
    id SERIAL PRIMARY KEY,
    id_marca_led INTEGER NOT NULL REFERENCES marcas_led(id),
    modelo TEXT NOT NULL,
    id_casquillo INTEGER NOT NULL REFERENCES casquillos(id),
    posicion_aplicable TEXT NOT NULL,
    sistema_optico_compatible TEXT NOT NULL,
    lumens INTEGER NOT NULL,
    temperatura_color INTEGER NOT NULL,
    potencia_watts NUMERIC(10,2) NOT NULL,
    precio NUMERIC(10,2) NOT NULL,
    disponible BOOLEAN NOT NULL DEFAULT TRUE,
    imagen_path TEXT,
    notas TEXT,
    CONSTRAINT ck_productos_posicion CHECK (posicion_aplicable IN ('cruce', 'largo', 'cruce_y_largo', 'antiniebla', 'todos')),
    CONSTRAINT ck_productos_optica CHECK (sistema_optico_compatible IN ('lupa_proyector', 'reflector_abierto', 'ambos')),
    CONSTRAINT ck_productos_lumens CHECK (lumens > 0),
    CONSTRAINT ck_productos_temp CHECK (temperatura_color > 0),
    CONSTRAINT ck_productos_watts CHECK (potencia_watts > 0),
    CONSTRAINT ck_productos_precio CHECK (precio >= 0)
);

CREATE TABLE perfiles_uso (
    id SERIAL PRIMARY KEY,
    categoria TEXT NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_perfiles_categoria_valor UNIQUE (categoria, valor)
);

CREATE TABLE reglas_recomendacion (
    id SERIAL PRIMARY KEY,
    id_perfil_uso INTEGER NOT NULL REFERENCES perfiles_uso(id),
    id_producto_led INTEGER NOT NULL REFERENCES productos_led(id),
    puntaje INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    CONSTRAINT uq_reglas_perfil_producto UNIQUE (id_perfil_uso, id_producto_led)
);

CREATE TABLE consultas (
    id BIGSERIAL PRIMARY KEY,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    id_modelo INTEGER NOT NULL REFERENCES modelos_vehiculo(id),
    anio_vehiculo INTEGER NOT NULL,
    perfiles_seleccionados JSONB NOT NULL,
    resultado_json JSONB NOT NULL,
    top1_producto_id INTEGER REFERENCES productos_led(id)
);

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login TIMESTAMPTZ,
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    CONSTRAINT ck_usuarios_intentos CHECK (intentos_fallidos >= 0)
);

CREATE INDEX idx_modelos_marca ON modelos_vehiculo (id_marca);
CREATE INDEX idx_compat_modelo_rango ON compatibilidad_vehiculo_casquillo (id_modelo, anio_desde, anio_hasta);
CREATE INDEX idx_compat_casquillo ON compatibilidad_vehiculo_casquillo (id_casquillo);
CREATE INDEX idx_productos_filtro ON productos_led (id_casquillo, posicion_aplicable, sistema_optico_compatible, disponible);
CREATE INDEX idx_reglas_producto_perfil ON reglas_recomendacion (id_producto_led, id_perfil_uso);
CREATE INDEX idx_consultas_fecha ON consultas (fecha DESC);
CREATE INDEX idx_consultas_modelo_fecha ON consultas (id_modelo, fecha DESC);
