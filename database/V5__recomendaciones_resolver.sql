ALTER TABLE compatibilidad_vehiculo_casquillo
    ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS tipos_sistema_optico (
    id SERIAL PRIMARY KEY,
    codigo TEXT NOT NULL UNIQUE,
    descripcion TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO tipos_sistema_optico (id, codigo, descripcion, activo)
VALUES
    (1, 'lupa_proyector', 'Lupa o proyector', TRUE),
    (2, 'reflector_abierto', 'Reflector abierto', TRUE),
    (3, 'ambos', 'Compatible con ambos', TRUE)
ON CONFLICT (codigo) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('tipos_sistema_optico', 'id'),
    COALESCE((SELECT MAX(id) FROM tipos_sistema_optico), 1),
    true
);

ALTER TABLE consultas
    ADD COLUMN IF NOT EXISTS id_marca INTEGER REFERENCES marcas_vehiculo(id),
    ADD COLUMN IF NOT EXISTS id_perfil_uso INTEGER REFERENCES perfiles_uso(id),
    ADD COLUMN IF NOT EXISTS id_tipo_polarizado INTEGER REFERENCES tipos_polarizado(id),
    ADD COLUMN IF NOT EXISTS id_tipo_sistema_optico INTEGER REFERENCES tipos_sistema_optico(id),
    ADD COLUMN IF NOT EXISTS nivel_confianza TEXT,
    ADD COLUMN IF NOT EXISTS mensaje_resultado TEXT;

CREATE TABLE IF NOT EXISTS consulta_recomendaciones (
    id BIGSERIAL PRIMARY KEY,
    id_consulta BIGINT NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
    posicion_luz TEXT NOT NULL,
    id_producto_led INTEGER NOT NULL REFERENCES productos_led(id),
    puntaje_total INTEGER NOT NULL,
    rank_posicion INTEGER NOT NULL,
    motivos_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consulta_recomendaciones_consulta
    ON consulta_recomendaciones (id_consulta);

CREATE INDEX IF NOT EXISTS idx_consulta_recomendaciones_producto
    ON consulta_recomendaciones (id_producto_led);

CREATE UNIQUE INDEX IF NOT EXISTS uq_consulta_recomendaciones_rank
    ON consulta_recomendaciones (id_consulta, posicion_luz, rank_posicion);
