-- 1) Replantear gamas_luz: de rangos por temperatura (K) a rangos por potencia (W)
ALTER TABLE gamas_luz
    DROP CONSTRAINT IF EXISTS ck_gamas_rango_temp;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'gamas_luz'
          AND column_name = 'temperatura_color_min'
    ) THEN
        ALTER TABLE gamas_luz RENAME COLUMN temperatura_color_min TO potencia_watts_min;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'gamas_luz'
          AND column_name = 'temperatura_color_max'
    ) THEN
        ALTER TABLE gamas_luz RENAME COLUMN temperatura_color_max TO potencia_watts_max;
    END IF;
END $$;

ALTER TABLE gamas_luz
    ALTER COLUMN potencia_watts_min TYPE NUMERIC(10,2) USING potencia_watts_min::numeric,
    ALTER COLUMN potencia_watts_max TYPE NUMERIC(10,2) USING potencia_watts_max::numeric;

ALTER TABLE gamas_luz
    ADD CONSTRAINT ck_gamas_rango_potencia CHECK (
        potencia_watts_min >= 0
        AND potencia_watts_max >= potencia_watts_min
    );

-- Limpiar asignaciones previas y recargar gamas oficiales por potencia.
UPDATE productos_led
SET id_gama_luz = NULL;

DELETE FROM gamas_luz;

INSERT INTO gamas_luz (nombre, descripcion, potencia_watts_min, potencia_watts_max, activo)
VALUES
    ('baja', 'Gama baja por potencia', 0.00, 50.00, TRUE),
    ('media', 'Gama media por potencia', 51.00, 80.00, TRUE),
    ('alta', 'Gama alta por potencia', 81.00, 140.00, TRUE),
    ('premium', 'Gama premium por potencia', 141.00, 180.00, TRUE),
    ('super premium', 'Gama super premium por potencia', 181.00, 330.00, TRUE);

UPDATE productos_led p
SET id_gama_luz = g.id
FROM gamas_luz g
WHERE p.potencia_watts BETWEEN g.potencia_watts_min AND g.potencia_watts_max;

-- 2) Normalizar catalogo de casquillos segun negocio:
-- Permitidos: H4, H1, H7, H11, 9005, 9006, H13, 880, H3
UPDATE casquillos
SET codigo = '9005',
    descripcion = 'Casquillo 9005'
WHERE UPPER(codigo) = '9005 (HB3)';

UPDATE casquillos
SET codigo = '9006',
    descripcion = 'Casquillo 9006'
WHERE UPPER(codigo) = '9006 (HB4)';

INSERT INTO casquillos (codigo, descripcion)
VALUES
    ('H13', 'Casquillo H13'),
    ('880', 'Casquillo 880'),
    ('H3', 'Casquillo H3')
ON CONFLICT (codigo) DO NOTHING;

-- Si hay casquillos fuera del catalogo permitido y con referencias, detenemos la migracion.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM casquillos c
        WHERE UPPER(c.codigo) NOT IN ('H4', 'H1', 'H7', 'H11', '9005', '9006', 'H13', '880', 'H3')
          AND (
              EXISTS (SELECT 1 FROM productos_led p WHERE p.id_casquillo = c.id)
              OR EXISTS (SELECT 1 FROM compatibilidad_vehiculo_casquillo cv WHERE cv.id_casquillo = c.id)
          )
    ) THEN
        RAISE EXCEPTION 'Existen casquillos fuera del catalogo permitido con referencias en productos/compatibilidades.';
    END IF;
END $$;

DELETE FROM casquillos c
WHERE UPPER(c.codigo) NOT IN ('H4', 'H1', 'H7', 'H11', '9005', '9006', 'H13', '880', 'H3');

ALTER TABLE casquillos
    DROP CONSTRAINT IF EXISTS ck_casquillos_codigo_permitido;

ALTER TABLE casquillos
    ADD CONSTRAINT ck_casquillos_codigo_permitido CHECK (
        UPPER(codigo) IN ('H4', 'H1', 'H7', 'H11', '9005', '9006', 'H13', '880', 'H3')
    );
