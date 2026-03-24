CREATE TABLE generaciones_modelo (
    id SERIAL PRIMARY KEY,
    id_modelo INTEGER NOT NULL REFERENCES modelos_vehiculo(id),
    nombre TEXT NOT NULL,
    anio_desde INTEGER NOT NULL,
    anio_hasta INTEGER,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_generaciones_rango_anio CHECK (anio_hasta IS NULL OR anio_hasta >= anio_desde),
    CONSTRAINT uq_generaciones_modelo UNIQUE (id_modelo, nombre, anio_desde)
);

CREATE TABLE tipos_polarizado (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE gamas_luz (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    temperatura_color_min INTEGER NOT NULL,
    temperatura_color_max INTEGER NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_gamas_rango_temp CHECK (temperatura_color_max >= temperatura_color_min)
);

ALTER TABLE productos_led
    ADD COLUMN IF NOT EXISTS id_gama_luz INTEGER REFERENCES gamas_luz(id);

ALTER TABLE compatibilidad_vehiculo_casquillo
    ADD COLUMN IF NOT EXISTS id_generacion_modelo INTEGER REFERENCES generaciones_modelo(id);

CREATE INDEX idx_generaciones_modelo ON generaciones_modelo (id_modelo, anio_desde, anio_hasta);
CREATE INDEX idx_productos_gama_luz ON productos_led (id_gama_luz);
CREATE INDEX idx_compat_generacion_modelo ON compatibilidad_vehiculo_casquillo (id_generacion_modelo);
