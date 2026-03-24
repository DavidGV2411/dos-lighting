-- Normalizar perfiles de uso para captura separada por factor:
-- 1) horario_manejo
-- 2) zona_manejo
-- 3) uso_vehiculo

INSERT INTO perfiles_uso (categoria, valor, descripcion, activo)
VALUES
    ('horario_manejo', 'diurno', 'Mayormente de dia', TRUE),
    ('horario_manejo', 'mixto', 'Uso diurno y nocturno', TRUE),
    ('horario_manejo', 'nocturno', 'Mayormente de noche', TRUE),
    ('zona_manejo', 'urbano', 'Principalmente ciudad', TRUE),
    ('zona_manejo', 'carretera', 'Principalmente carretera', TRUE),
    ('zona_manejo', 'rural', 'Principalmente zona rural', TRUE),
    ('zona_manejo', 'mixto', 'Ciudad y carretera/rural', TRUE),
    ('uso_vehiculo', 'uso_personal', 'Uso personal diario', TRUE),
    ('uso_vehiculo', 'trabajo', 'Uso laboral frecuente', TRUE),
    ('uso_vehiculo', 'offroad', 'Uso en caminos exigentes', TRUE)
ON CONFLICT (categoria, valor) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo = TRUE;

UPDATE perfiles_uso
SET activo = FALSE
WHERE (categoria = 'horario_manejo' AND valor NOT IN ('diurno', 'mixto', 'nocturno'))
   OR (categoria = 'zona_manejo' AND valor NOT IN ('urbano', 'carretera', 'rural', 'mixto'))
   OR (categoria = 'uso_vehiculo' AND valor NOT IN ('uso_personal', 'trabajo', 'offroad'));
