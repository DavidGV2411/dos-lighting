-- Reaplica catalogo completo desde Base_Datos_Iluminacion_COMPLETA.docx
-- con consolidacion correcta de variantes (Con/Sin Proyector).
DROP TABLE IF EXISTS tmp_modelo_source;
CREATE TEMP TABLE tmp_modelo_source (
    marca TEXT NOT NULL,
    modelo TEXT NOT NULL,
    anio_desde INTEGER NOT NULL,
    anio_hasta INTEGER NOT NULL,
    cruce_codes TEXT NOT NULL,
    largo_codes TEXT NOT NULL,
    antiniebla_codes TEXT NOT NULL,
    sistema_optico TEXT NOT NULL
);

INSERT INTO tmp_modelo_source (
    marca,
    modelo,
    anio_desde,
    anio_hasta,
    cruce_codes,
    largo_codes,
    antiniebla_codes,
    sistema_optico
)
VALUES
    ('Toyota', 'Yaris (Gen 1 a 3)', 1999, 2026, 'H4', 'H4', 'H11/9006', 'Sin Proyector'),
    ('Toyota', 'Corolla Gen 1', 2006, 2013, '9006', '9005', 'H11', 'Sin Proyector'),
    ('Toyota', 'Corolla Gen 2', 2014, 2016, 'H11', '9005', 'H11', 'Sin Proyector'),
    ('Toyota', 'Corolla Gen 3 (Version 9005)', 2017, 2018, '9005', '9005', 'H11', 'Sin Proyector'),
    ('Toyota', 'Corolla Gen 3 (Version H11)', 2017, 2018, '9005', 'H11', 'H11', 'Sin Proyector'),
    ('Toyota', 'Corolla Cross', 2020, 2026, 'H11', 'H7', 'H11', 'Sin Proyector'),
    ('Toyota', 'RAV4 (Gen 3 y 4)', 2006, 2015, '9006/9005', '9005', 'H11', 'Sin Proyector'),
    ('Toyota', 'Fortuner Gen 2', 2016, 2026, 'H11', '9005', 'H11', 'Sin Proyector'),
    ('Toyota', '4Runner Gen 5', 2010, 2021, 'H11', '9005', 'H11', 'Sin Proyector'),
    ('Toyota', 'Hilux', 1997, 2026, 'H4', 'H4', 'H11', 'Sin Proyector'),
    ('Toyota', 'Prado (J150) / TXL', 2010, 2026, 'H11', '9005', '9006', 'Sin Proyector'),
    ('Toyota', 'Land Cruiser (Single)', 2003, 2008, 'H4', 'H4', '9006', 'Sin Proyector'),
    ('Toyota', 'Land Cruiser', 2009, 2014, 'H11', '9005', '9006', 'Sin Proyector'),
    ('Nissan', 'March', 2012, 2020, 'H4', 'H4', 'H11', 'Reflector'),
    ('Nissan', 'Versa Gen 1', 2012, 2019, 'H4', 'H4', 'H11', 'Reflector'),
    ('Nissan', 'Versa Gen 2', 2021, 2026, 'H11', 'H11', 'H11', 'Reflector'),
    ('Nissan', 'Qashqai Gen 1', 2007, 2013, 'H7', 'H7', 'H11', 'Reflector'),
    ('Nissan', 'Qashqai Gen 2', 2014, 2026, 'H11', 'H7', 'H11', 'Reflector'),
    ('Nissan', 'Kicks', 2018, 2026, 'H11', 'H11', 'H11', 'Reflector'),
    ('Nissan', 'Sentra Con Proyector', 2013, 2019, 'H11', 'H11', 'H11', 'Proyector'),
    ('Nissan', 'Sentra Gen 2', 2020, 2026, 'H11', 'H11', 'H11', 'Reflector'),
    ('Nissan', 'Frontier (NP300)', 2005, 2026, 'H4', 'H4', 'H11', 'Reflector'),
    ('Nissan', 'X-Trail Gen 2', 2007, 2009, 'H4', 'H4', 'H11', 'Reflector'),
    ('Nissan', 'X-Trail Gen 2 Facelift', 2010, 2012, 'H11', 'H1', 'H11', 'Reflector'),
    ('Nissan', 'X-Trail Gen 3', 2014, 2026, 'H11', 'H11', 'H11', 'Reflector'),
    ('Ford', 'EcoSport Gen 1', 2013, 2017, 'H4', 'H4', 'H11', 'Reflector'),
    ('Ford', 'EcoSport Gen 2', 2018, 2019, 'H11', '9005', 'H11', 'Reflector'),
    ('Ford', 'EcoSport Gen 3', 2020, 2020, 'H11', 'H11', 'H11', 'Reflector'),
    ('Ford', 'Fiesta', 2009, 2018, 'H7', 'H1', 'H11', 'Reflector'),
    ('Ford', 'Escape Gen 1', 2008, 2012, 'H13', 'H13', 'H11', 'Reflector'),
    ('Ford', 'Escape Gen 2/3 (Sin Proyector)', 2013, 2019, 'H11', '9005', 'H11', 'Reflector'),
    ('Ford', 'Escape Gen 3 (Con Proyector)', 2017, 2019, '9005', 'H11', 'H11', 'Proyector'),
    ('Ford', 'Escape Gen 4 (Sin Proyector)', 2021, 2026, 'H11', 'H7', 'H11', 'Reflector'),
    ('Ford', 'Escape Gen 4 (Con Proyector)', 2021, 2026, 'H7', 'H7', 'H11', 'Proyector'),
    ('Ford', 'Edge Gen 1', 2007, 2010, 'H11', '9005', 'H11', 'Reflector'),
    ('Ford', 'Edge Gen 2 (Sin Proyector)', 2011, 2014, '9005', '9005', 'H11', 'Reflector'),
    ('Ford', 'Edge Gen 2 (Con Proyector)', 2011, 2014, 'H7', 'H7', 'H11', 'Proyector'),
    ('Ford', 'Edge Gen 3 (Sin Proyector)', 2016, 2022, 'H11', '9005', 'H11', 'Reflector'),
    ('Ford', 'Edge Gen 3 (Con Proyector)', 2016, 2022, 'H7', 'H7', 'H11', 'Proyector'),
    ('Ford', 'F-150', 2015, 2023, 'H11', '9005', 'H11', 'Reflector'),
    ('Mazda', 'Mazda 2', 2007, 2026, 'H4', 'H4', 'H11', 'Reflector'),
    ('Mazda', 'Mazda 3 Gen 1', 2007, 2009, 'H7', '9005', 'H11', 'Reflector'),
    ('Mazda', 'Mazda 3 Gen 2/3/4', 2010, 2020, 'H11', '9005', 'H11', 'Reflector'),
    ('Mazda', 'Mazda 6', 2002, 2017, '9005', 'H11', 'H11', 'Reflector'),
    ('Mazda', 'Mazda CX-3', 2015, 2021, 'H11', '9005', 'H11', 'Reflector/Proyector'),
    ('Mazda', 'Mazda CX-30', 2019, 2026, 'H11', '9005', 'H11', 'Reflector/Led'),
    ('Mazda', 'Mazda CX-5', 2013, 2026, 'H11', '9005', 'H11', 'Reflector'),
    ('Mazda', 'Mazda CX-9', 2007, 2018, 'H11', '9005', 'H11', 'Reflector'),
    ('Mazda', 'Mazda CX-50', 2023, 2026, 'H11', '9005', 'H11', 'Reflector/Proyector'),
    ('Kia', 'Picanto', 2004, 2026, 'H4', 'H4', 'H11', 'Reflector'),
    ('Kia', 'Rio', 1999, 2017, 'H7', 'H1', '9006', 'Reflector'),
    ('Kia', 'Sportage Gen 1/2', 1995, 2010, 'H11', 'H7', 'H11', 'Reflector'),
    ('Kia', 'Sportage Gen 3 (Sin HID)', 2011, 2016, 'H11', 'H7', 'H11', 'Reflector'),
    ('Kia', 'Sportage Gen 3 (Con HID)', 2011, 2016, 'HID D3S', 'HID D3S', 'H11', 'Proyector'),
    ('Kia', 'Cerato/K3', 2008, 2026, 'H7', 'H1', 'H11', 'Reflector'),
    ('Kia', 'K4', 2025, 2026, 'H7', 'H1', 'H11', 'Reflector'),
    ('Hyundai', 'Atos / i10 / Getz', 1999, 2026, 'H4', 'H4', 'H11/H3', 'Reflector'),
    ('Hyundai', 'Accent Gen 1', 2000, 2012, 'H4', 'H4', '880', 'Reflector'),
    ('Hyundai', 'Accent Gen 2', 2013, 2026, 'H4', '9005', '9006', 'Reflector'),
    ('Hyundai', 'Elantra Gen 1', 2011, 2013, 'H11', 'H1', '880', 'Reflector'),
    ('Hyundai', 'Elantra Gen 2 (Sin Proyector)', 2014, 2016, 'H11', 'H7', '880', 'Reflector'),
    ('Hyundai', 'Elantra Gen 2 (Con Proyector)', 2014, 2016, '9005', 'H7', '880', 'Proyector'),
    ('Hyundai', 'Elantra Gen 3', 2017, 2018, '9005', 'H7', 'H7', 'Reflector'),
    ('Hyundai', 'Elantra Gen 4', 2019, 2020, 'H7', '9005', 'H11', 'Reflector'),
    ('Hyundai', 'Elantra Gen 5', 2021, 2026, '9005', '9005', 'H11', 'Reflector'),
    ('Hyundai', 'Tucson', 2005, 2026, 'H4/H7', 'H4/9005', 'H11/880', 'Reflector'),
    ('Hyundai', 'Kona Gen 1', 2018, 2020, 'H7', 'H7', 'H11', 'Reflector'),
    ('Hyundai', 'Kona Gen 2 (Sin Proyector)', 2022, 2026, 'H7', 'H7', '9006', 'Reflector'),
    ('Hyundai', 'Kona Gen 2 (Con Proyector)', 2022, 2026, '9005', '9005', '9006', 'Proyector'),
    ('Hyundai', 'HB20 (Vibrant/Premium)', 2012, 2026, 'H4', 'H4', '9006', 'Reflector'),
    ('Renault', 'Sandero/Logan Gen 1', 2007, 2015, 'H4', 'H4', 'H11', 'Reflector'),
    ('Renault', 'Sandero/Logan Gen 2', 2016, 2021, 'H7', 'H1', 'H11', 'Reflector'),
    ('Renault', 'Sandero Gen 3', 2022, 2026, 'H7', 'H7', 'H11', 'Reflector'),
    ('Renault', 'Stepway', 2007, 2022, 'H4/H7', 'H4/H1', 'H11', 'Reflector'),
    ('Renault', 'Duster Gen 1', 2013, 2015, 'H7', 'H1', 'H11', 'Reflector'),
    ('Renault', 'Duster Gen 2', 2016, 2021, 'H1', 'H7', 'H11', 'Reflector'),
    ('Renault', 'Kwid', 2018, 2026, 'H4', 'H4', 'H11', 'Reflector'),
    ('Renault', 'Clio', 2001, 2006, 'H7', 'H1', 'H11', 'Reflector'),
    ('Chevrolet', 'Sail', 2002, 2026, 'H4', 'H4', 'H11', 'Reflector'),
    ('Chevrolet', 'Aveo / Spark / Spark GT', 2004, 2026, 'H4', 'H4', 'H11/H3', 'Reflector'),
    ('Chevrolet', 'Onix / Beat', 2019, 2026, 'H4', 'H4', '880/H11', 'Reflector'),
    ('Chevrolet', 'Tracker Nueva (Standard)', 2015, 2022, 'H11', '9005', 'H11', 'Reflector'),
    ('Chevrolet', 'Tracker Nueva (Premium)', 2021, 2021, 'H13', 'H13', 'H11', 'Proyector'),
    ('Chevrolet', 'Sonic', 2012, 2020, 'H11', '9005', 'H11', 'Reflector'),
    ('Chevrolet', 'Cruze 2011-2015', 2011, 2015, 'H13', 'H13', 'H11', 'Reflector'),
    ('Chevrolet', 'Cruze 2016-2019 (Standard)', 2016, 2019, 'H11', '9005', 'H11', 'Reflector'),
    ('Chevrolet', 'Captiva Sport', 2008, 2015, 'H7/H11', 'H1/H11', 'H11', 'Reflector'),
    ('Chevrolet', 'Colorado / Tahoe / Silverado', 2008, 2017, 'H11', '9005', 'H11', 'Reflector');

DELETE FROM consulta_recomendaciones;
DELETE FROM consultas;
DELETE FROM compatibilidad_vehiculo_casquillo;
DELETE FROM generaciones_modelo;
DELETE FROM modelos_vehiculo;

DELETE FROM marcas_vehiculo
WHERE lower(nombre) NOT IN (
    SELECT DISTINCT lower(marca)
    FROM tmp_modelo_source
);

WITH tipo_ids AS (
    SELECT
        COALESCE(
            (SELECT id FROM tipos_vehiculo WHERE lower(nombre) LIKE 'camioneta%'),
            (SELECT id FROM tipos_vehiculo WHERE lower(nombre) LIKE 'auto%'),
            (SELECT MIN(id) FROM tipos_vehiculo)
        ) AS tipo_camioneta,
        COALESCE(
            (SELECT id FROM tipos_vehiculo WHERE lower(nombre) LIKE 'auto%'),
            (SELECT id FROM tipos_vehiculo WHERE lower(nombre) LIKE 'camioneta%'),
            (SELECT MIN(id) FROM tipos_vehiculo)
        ) AS tipo_auto
)
INSERT INTO marcas_vehiculo (nombre, id_tipo_vehiculo)
SELECT src.nombre, src.id_tipo_vehiculo
FROM (
    SELECT DISTINCT
        initcap(lower(s.marca)) AS nombre,
        CASE
            WHEN lower(s.marca) = 'toyota' THEN t.tipo_camioneta
            ELSE t.tipo_auto
        END AS id_tipo_vehiculo
    FROM tmp_modelo_source s
    CROSS JOIN tipo_ids t
) src
WHERE NOT EXISTS (
    SELECT 1
    FROM marcas_vehiculo mv
    WHERE lower(mv.nombre) = lower(src.nombre)
);

ALTER TABLE casquillos
    DROP CONSTRAINT IF EXISTS ck_casquillos_codigo_permitido;

ALTER TABLE casquillos
    ADD CONSTRAINT ck_casquillos_codigo_permitido CHECK (
        UPPER(codigo) IN ('H4', 'H1', 'H7', 'H11', '9005', '9006', 'H13', '880', 'H3', 'HIDD3S')
    );

WITH codes_from_source AS (
    SELECT DISTINCT
        upper(raw_code) AS codigo
    FROM tmp_modelo_source s
    CROSS JOIN LATERAL (
        VALUES
            (s.cruce_codes),
            (s.largo_codes),
            (s.antiniebla_codes)
    ) all_codes(codes_text)
    CROSS JOIN LATERAL regexp_split_to_table(replace(all_codes.codes_text, ' ', ''), '/') raw(raw_code)
    WHERE btrim(raw_code) <> ''
)
INSERT INTO casquillos (codigo, descripcion)
SELECT c.codigo, CONCAT('Casquillo ', c.codigo, ' (importado)')
FROM codes_from_source c
WHERE NOT EXISTS (
    SELECT 1
    FROM casquillos existing
    WHERE upper(existing.codigo) = upper(c.codigo)
);

WITH source_normalized AS (
    SELECT
        s.marca,
        trim(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        s.modelo,
                        ' [(]Version[^)]*[)]$',
                        '',
                        'i'
                    ),
                    ' [(](Con|Sin) Proyector[)]$',
                    '',
                    'i'
                ),
                ' [(](Standard|Premium)[)]$',
                '',
                'i'
            )
        ) AS modelo_normalizado,
        s.anio_desde,
        s.anio_hasta
    FROM tmp_modelo_source s
)
INSERT INTO modelos_vehiculo (nombre, id_marca, anio_desde, anio_hasta)
SELECT
    sn.modelo_normalizado,
    mv.id,
    MIN(sn.anio_desde) AS anio_desde,
    MAX(sn.anio_hasta) AS anio_hasta
FROM source_normalized sn
INNER JOIN marcas_vehiculo mv
    ON lower(mv.nombre) = lower(sn.marca)
GROUP BY sn.modelo_normalizado, mv.id;

INSERT INTO generaciones_modelo (id_modelo, nombre, anio_desde, anio_hasta, activo)
SELECT m.id, CONCAT(m.nombre, ' Base'), m.anio_desde, m.anio_hasta, TRUE
FROM modelos_vehiculo m;

WITH source_positions AS (
    SELECT
        s.marca,
        trim(
            regexp_replace(
                regexp_replace(
                    regexp_replace(
                        s.modelo,
                        ' [(]Version[^)]*[)]$',
                        '',
                        'i'
                    ),
                    ' [(](Con|Sin) Proyector[)]$',
                    '',
                    'i'
                ),
                ' [(](Standard|Premium)[)]$',
                '',
                'i'
            )
        ) AS modelo,
        s.anio_desde,
        s.anio_hasta,
        s.sistema_optico,
        pos.posicion_luz,
        upper(raw.raw_code) AS casquillo_codigo
    FROM tmp_modelo_source s
    CROSS JOIN LATERAL (
        VALUES
            ('cruce', s.cruce_codes),
            ('largo', s.largo_codes),
            ('antiniebla', s.antiniebla_codes)
    ) pos(posicion_luz, codes_text)
    CROSS JOIN LATERAL regexp_split_to_table(replace(pos.codes_text, ' ', ''), '/') raw(raw_code)
    WHERE btrim(raw.raw_code) <> ''
),
normalized AS (
    SELECT DISTINCT
        sp.marca,
        sp.modelo,
        sp.anio_desde,
        sp.anio_hasta,
        sp.posicion_luz,
        sp.casquillo_codigo,
        CASE
            WHEN lower(sp.sistema_optico) LIKE 'sin %' THEN 'reflector_abierto'
            WHEN lower(sp.sistema_optico) LIKE '%reflector%' THEN 'reflector_abierto'
            WHEN lower(sp.sistema_optico) LIKE '%proyector%' THEN 'lupa_proyector'
            ELSE 'reflector_abierto'
        END AS tipo_sistema_optico
    FROM source_positions sp
)
INSERT INTO compatibilidad_vehiculo_casquillo (
    id_modelo,
    id_generacion_modelo,
    anio_desde,
    anio_hasta,
    posicion_luz,
    id_casquillo,
    tipo_sistema_optico,
    activo
)
SELECT
    m.id,
    g.id,
    n.anio_desde,
    n.anio_hasta,
    n.posicion_luz,
    c.id,
    n.tipo_sistema_optico,
    TRUE
FROM normalized n
INNER JOIN marcas_vehiculo mv
    ON lower(mv.nombre) = lower(n.marca)
INNER JOIN modelos_vehiculo m
    ON m.id_marca = mv.id
   AND m.nombre = n.modelo
INNER JOIN generaciones_modelo g
    ON g.id_modelo = m.id
INNER JOIN casquillos c
    ON upper(c.codigo) = upper(n.casquillo_codigo);
