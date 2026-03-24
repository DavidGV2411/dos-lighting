INSERT INTO tipos_polarizado (codigo, descripcion, activo)
VALUES
    ('sin_polarizado', 'Vehiculo sin polarizado', TRUE),
    ('con_polarizado', 'Vehiculo con polarizado', TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO gamas_luz (nombre, descripcion, temperatura_color_min, temperatura_color_max, activo)
VALUES
    ('calida', 'Tonos calidos orientados a confort visual', 3000, 4300, TRUE),
    ('neutra', 'Balance entre nitidez y confort', 4301, 5500, TRUE),
    ('fria', 'Mayor sensacion de brillo para conduccion nocturna', 5501, 7000, TRUE)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO generaciones_modelo (id_modelo, nombre, anio_desde, anio_hasta, activo)
SELECT id, CONCAT(nombre, ' Base'), anio_desde, anio_hasta, TRUE
FROM modelos_vehiculo
WHERE NOT EXISTS (
    SELECT 1
    FROM generaciones_modelo g
    WHERE g.id_modelo = modelos_vehiculo.id
);

UPDATE productos_led p
SET id_gama_luz = g.id
FROM gamas_luz g
WHERE p.id_gama_luz IS NULL
  AND p.temperatura_color BETWEEN g.temperatura_color_min AND g.temperatura_color_max;
