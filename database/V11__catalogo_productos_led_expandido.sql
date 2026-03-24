-- Recarga de catalogo de productos LED con base en referencias comerciales.
-- Mantiene la clasificacion de gamas por potencia (W).

-- Limpiar referencias historicas para permitir recarga del catalogo.
UPDATE consultas
SET top1_producto_id = NULL
WHERE top1_producto_id IS NOT NULL;

DELETE FROM consulta_recomendaciones;
DELETE FROM reglas_recomendacion;
DELETE FROM productos_led;

-- Marcas base del catalogo.
INSERT INTO marcas_led (nombre, pais_origen, sitio_web)
VALUES
    ('Philips', 'Paises Bajos', 'https://www.philips.com'),
    ('Osram', 'Alemania', 'https://www.osram.com'),
    ('Fahren', 'Estados Unidos', 'https://www.fahrenled.com')
ON CONFLICT (nombre) DO UPDATE
SET pais_origen = EXCLUDED.pais_origen,
    sitio_web = EXCLUDED.sitio_web;

-- Asegurar casquillos operativos.
INSERT INTO casquillos (codigo, descripcion)
VALUES
    ('H1', 'Casquillo H1'),
    ('H3', 'Casquillo H3'),
    ('H4', 'Casquillo H4'),
    ('H7', 'Casquillo H7'),
    ('H11', 'Casquillo H11'),
    ('H13', 'Casquillo H13'),
    ('880', 'Casquillo 880'),
    ('9005', 'Casquillo 9005'),
    ('9006', 'Casquillo 9006')
ON CONFLICT (codigo) DO UPDATE
SET descripcion = EXCLUDED.descripcion;

WITH catalogo_base AS (
    SELECT *
    FROM (
        VALUES
            -- Gama baja (<= 50W)
            ('Ultinon Essential H4', 'Philips', 'H4', 30.00::numeric, 8000, 'ambos', 'cruce_y_largo', 85.00::numeric, 'baja'),
            ('Ultinon Essential H7', 'Philips', 'H7', 30.00::numeric, 7200, 'ambos', 'cruce', 84.00::numeric, 'baja'),
            ('Ultinon Essential H11', 'Philips', 'H11', 25.00::numeric, 6000, 'ambos', 'antiniebla', 79.00::numeric, 'baja'),
            ('Ultinon Essential 9005', 'Philips', '9005', 30.00::numeric, 8000, 'reflector_abierto', 'largo', 88.00::numeric, 'baja'),
            ('Night Breaker LED H4', 'Osram', 'H4', 40.00::numeric, 9000, 'ambos', 'cruce_y_largo', 96.00::numeric, 'baja'),
            ('Night Breaker LED H7', 'Osram', 'H7', 40.00::numeric, 8600, 'ambos', 'cruce', 94.00::numeric, 'baja'),
            ('Night Breaker LED H11', 'Osram', 'H11', 35.00::numeric, 8000, 'ambos', 'antiniebla', 92.00::numeric, 'baja'),
            ('Cool Blue Intense H1', 'Osram', 'H1', 30.00::numeric, 7000, 'reflector_abierto', 'cruce', 86.00::numeric, 'baja'),
            ('Cool Blue Intense H3', 'Osram', 'H3', 30.00::numeric, 6500, 'reflector_abierto', 'antiniebla', 85.00::numeric, 'baja'),
            ('S2 Series H4', 'Fahren', 'H4', 40.00::numeric, 12000, 'ambos', 'cruce_y_largo', 89.00::numeric, 'baja'),
            ('S2 Series H7', 'Fahren', 'H7', 40.00::numeric, 10000, 'ambos', 'cruce', 87.00::numeric, 'baja'),

            -- Gama media (51W - 80W)
            ('Ultinon Pro6000 H4', 'Philips', 'H4', 55.00::numeric, 12000, 'ambos', 'cruce_y_largo', 119.00::numeric, 'media'),
            ('Ultinon Pro6000 H7', 'Philips', 'H7', 55.00::numeric, 11000, 'ambos', 'cruce', 117.00::numeric, 'media'),
            ('Ultinon Pro6000 H11', 'Philips', 'H11', 55.00::numeric, 10000, 'ambos', 'antiniebla', 115.00::numeric, 'media'),
            ('Ultinon Pro6000 9005', 'Philips', '9005', 55.00::numeric, 12000, 'reflector_abierto', 'largo', 121.00::numeric, 'media'),
            ('Night Breaker LED Speed H4', 'Osram', 'H4', 60.00::numeric, 13000, 'ambos', 'cruce_y_largo', 132.00::numeric, 'media'),
            ('Night Breaker LED Speed H7', 'Osram', 'H7', 60.00::numeric, 12000, 'lupa_proyector', 'cruce', 129.00::numeric, 'media'),
            ('Night Breaker LED 9006', 'Osram', '9006', 55.00::numeric, 11000, 'reflector_abierto', 'cruce', 123.00::numeric, 'media'),
            ('SuperVision H7', 'Fahren', 'H7', 60.00::numeric, 14000, 'ambos', 'cruce', 125.00::numeric, 'media'),
            ('SuperVision H11', 'Fahren', 'H11', 55.00::numeric, 12000, 'ambos', 'antiniebla', 124.00::numeric, 'media'),
            ('SuperVision 9005', 'Fahren', '9005', 60.00::numeric, 14000, 'reflector_abierto', 'largo', 128.00::numeric, 'media'),
            ('Z ES H13', 'Fahren', 'H13', 60.00::numeric, 12000, 'ambos', 'cruce_y_largo', 126.00::numeric, 'media'),
            ('S2 Series 880', 'Fahren', '880', 55.00::numeric, 9000, 'reflector_abierto', 'antiniebla', 116.00::numeric, 'media'),

            -- Gama alta (81W - 140W)
            ('Ultinon Pro9000 H4', 'Philips', 'H4', 95.00::numeric, 15000, 'ambos', 'cruce_y_largo', 169.00::numeric, 'alta'),
            ('Ultinon Pro9000 H7', 'Philips', 'H7', 95.00::numeric, 14400, 'ambos', 'cruce', 167.00::numeric, 'alta'),
            ('Ultinon Pro9000 H11', 'Philips', 'H11', 90.00::numeric, 12000, 'ambos', 'antiniebla', 163.00::numeric, 'alta'),
            ('Ultinon Pro9000 9005', 'Philips', '9005', 100.00::numeric, 15000, 'reflector_abierto', 'largo', 172.00::numeric, 'alta'),
            ('SuperVision HB3', 'Fahren', '9005', 110.00::numeric, 18000, 'reflector_abierto', 'largo', 181.00::numeric, 'alta'),
            ('SuperBright H4', 'Fahren', 'H4', 120.00::numeric, 18000, 'ambos', 'cruce_y_largo', 186.00::numeric, 'alta'),
            ('SuperBright H7', 'Fahren', 'H7', 130.00::numeric, 16000, 'lupa_proyector', 'cruce', 188.00::numeric, 'alta'),
            ('SuperBright H11', 'Fahren', 'H11', 110.00::numeric, 15000, 'ambos', 'antiniebla', 179.00::numeric, 'alta'),
            ('LEDriving HL H1', 'Osram', 'H1', 90.00::numeric, 13000, 'reflector_abierto', 'cruce', 171.00::numeric, 'alta'),
            ('LEDriving HL H3', 'Osram', 'H3', 90.00::numeric, 12000, 'reflector_abierto', 'antiniebla', 168.00::numeric, 'alta'),
            ('LEDriving HL 9006', 'Osram', '9006', 100.00::numeric, 14000, 'reflector_abierto', 'cruce', 175.00::numeric, 'alta'),

            -- Gama premium (141W - 180W)
            ('Ultinon Pro9100 H4', 'Philips', 'H4', 150.00::numeric, 20000, 'ambos', 'cruce_y_largo', 229.00::numeric, 'premium'),
            ('Ultinon Pro9100 H7', 'Philips', 'H7', 150.00::numeric, 19000, 'ambos', 'cruce', 226.00::numeric, 'premium'),
            ('Ultinon Pro9100 H11', 'Philips', 'H11', 145.00::numeric, 18000, 'ambos', 'antiniebla', 221.00::numeric, 'premium'),
            ('Ultinon Pro9100 9005', 'Philips', '9005', 160.00::numeric, 20000, 'reflector_abierto', 'largo', 234.00::numeric, 'premium'),
            ('Night Breaker Pro H4', 'Osram', 'H4', 170.00::numeric, 22000, 'ambos', 'cruce_y_largo', 246.00::numeric, 'premium'),
            ('Night Breaker Pro H7', 'Osram', 'H7', 170.00::numeric, 20000, 'lupa_proyector', 'cruce', 242.00::numeric, 'premium'),
            ('Night Breaker Pro H11', 'Osram', 'H11', 160.00::numeric, 18000, 'ambos', 'antiniebla', 236.00::numeric, 'premium'),
            ('XTR Series H4', 'Fahren', 'H4', 180.00::numeric, 28000, 'ambos', 'cruce_y_largo', 259.00::numeric, 'premium'),
            ('XTR Series H7', 'Fahren', 'H7', 180.00::numeric, 26000, 'lupa_proyector', 'cruce', 255.00::numeric, 'premium'),
            ('XTR Series 9005', 'Fahren', '9005', 180.00::numeric, 28000, 'reflector_abierto', 'largo', 262.00::numeric, 'premium'),
            ('XTR Series H13', 'Fahren', 'H13', 175.00::numeric, 24000, 'ambos', 'cruce_y_largo', 251.00::numeric, 'premium'),

            -- Gama super premium (181W - 330W)
            ('Turbo Plus H4', 'Fahren', 'H4', 330.00::numeric, 60000, 'ambos', 'cruce_y_largo', 389.00::numeric, 'super premium'),
            ('Turbo Plus H7', 'Fahren', 'H7', 330.00::numeric, 55000, 'lupa_proyector', 'cruce', 384.00::numeric, 'super premium'),
            ('Turbo Plus H11', 'Fahren', 'H11', 330.00::numeric, 50000, 'ambos', 'antiniebla', 379.00::numeric, 'super premium'),
            ('Turbo Plus 9005', 'Fahren', '9005', 330.00::numeric, 60000, 'reflector_abierto', 'largo', 392.00::numeric, 'super premium'),
            ('Turbo Plus H1', 'Fahren', 'H1', 330.00::numeric, 50000, 'reflector_abierto', 'cruce', 374.00::numeric, 'super premium')
    ) AS t(
        modelo,
        marca,
        casquillo,
        potencia_watts,
        lumens,
        sistema_optico_compatible,
        posicion_aplicable,
        precio,
        gama_comercial
    )
),
catalogo_resuelto AS (
    SELECT
        m.id AS id_marca_led,
        cb.modelo,
        c.id AS id_casquillo,
        cb.posicion_aplicable,
        cb.sistema_optico_compatible,
        cb.lumens,
        6000 AS temperatura_color,
        cb.potencia_watts,
        cb.precio,
        TRUE AS disponible,
        NULL::text AS imagen_path,
        CASE
            WHEN cb.gama_comercial = 'super premium' THEN
                'Advertencia: 330W requiere adaptacion electrica; puede afectar alternador y bateria en uso diario.'
            ELSE
                'Catalogo base cargado por migracion automatica.'
        END AS notas,
        g.id AS id_gama_luz
    FROM catalogo_base cb
    INNER JOIN marcas_led m ON m.nombre = cb.marca
    INNER JOIN casquillos c ON c.codigo = cb.casquillo
    INNER JOIN gamas_luz g
        ON g.activo = TRUE
       AND cb.potencia_watts BETWEEN g.potencia_watts_min AND g.potencia_watts_max
),
insertados AS (
    INSERT INTO productos_led (
        id_marca_led,
        modelo,
        id_casquillo,
        posicion_aplicable,
        sistema_optico_compatible,
        lumens,
        temperatura_color,
        potencia_watts,
        precio,
        disponible,
        imagen_path,
        notas,
        id_gama_luz
    )
    SELECT
        id_marca_led,
        modelo,
        id_casquillo,
        posicion_aplicable,
        sistema_optico_compatible,
        lumens,
        temperatura_color,
        potencia_watts,
        precio,
        disponible,
        imagen_path,
        notas,
        id_gama_luz
    FROM catalogo_resuelto
    RETURNING id
)
SELECT COUNT(*) FROM insertados;
