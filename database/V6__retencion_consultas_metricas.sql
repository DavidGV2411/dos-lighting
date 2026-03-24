ALTER TABLE consultas
    ADD COLUMN IF NOT EXISTS nombre_cliente TEXT,
    ADD COLUMN IF NOT EXISTS telefono_cliente TEXT;

CREATE TABLE IF NOT EXISTS metricas_recomendacion_diaria (
    id BIGSERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    total_consultas INTEGER NOT NULL DEFAULT 0,
    top_producto_led_id INTEGER REFERENCES productos_led(id),
    top_producto_recomendado_cantidad INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metricas_recomendacion_diaria_top_producto
    ON metricas_recomendacion_diaria (top_producto_led_id);
