-- Tipos de polarizado oficiales (solo porcentaje + "sin polarizado")
-- Lista objetivo:
-- 5%, 20%, 35%, 50%, 70%, sin polarizado

-- 1) Desactivar tipos legacy que no pertenecen a la lista oficial
UPDATE tipos_polarizado
SET activo = FALSE
WHERE LOWER(codigo) NOT IN ('5%', '20%', '35%', '50%', '70%', 'sin polarizado');

-- 2) Crear/activar tipos oficiales con descripcion corta (sin texto largo)
INSERT INTO tipos_polarizado (codigo, descripcion, activo)
VALUES
    ('5%', '5%', TRUE),
    ('20%', '20%', TRUE),
    ('35%', '35%', TRUE),
    ('50%', '50%', TRUE),
    ('70%', '70%', TRUE),
    ('sin polarizado', 'sin polarizado', TRUE)
ON CONFLICT (codigo) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo = TRUE;

-- 3) Perfiles de uso para scoring por polarizado con los mismos codigos
UPDATE perfiles_uso
SET activo = FALSE
WHERE categoria = 'polarizado'
  AND LOWER(valor) NOT IN ('5%', '20%', '35%', '50%', '70%', 'sin polarizado');

INSERT INTO perfiles_uso (categoria, valor, descripcion, activo)
VALUES
    ('polarizado', '5%', '5%', TRUE),
    ('polarizado', '20%', '20%', TRUE),
    ('polarizado', '35%', '35%', TRUE),
    ('polarizado', '50%', '50%', TRUE),
    ('polarizado', '70%', '70%', TRUE),
    ('polarizado', 'sin polarizado', 'sin polarizado', TRUE)
ON CONFLICT (categoria, valor) DO UPDATE
SET descripcion = EXCLUDED.descripcion,
    activo = TRUE;

-- 4) Reglas de recomendacion por intensidad de polarizado.
-- Entre mas oscuro el polarizado, mayor preferencia por productos de mayor lumen.
DELETE FROM reglas_recomendacion rr
USING perfiles_uso pu
WHERE rr.id_perfil_uso = pu.id
  AND pu.categoria = 'polarizado';

WITH factores AS (
    SELECT id, valor,
           CASE valor
               WHEN '5%' THEN 10
               WHEN '20%' THEN 7
               WHEN '35%' THEN 4
               WHEN '50%' THEN 2
               WHEN '70%' THEN 1
               WHEN 'sin polarizado' THEN 0
               ELSE 0
           END AS factor
    FROM perfiles_uso
    WHERE categoria = 'polarizado'
      AND activo = TRUE
      AND valor IN ('5%', '20%', '35%', '50%', '70%', 'sin polarizado')
),
reglas_generadas AS (
    SELECT
        f.id AS id_perfil_uso,
        p.id AS id_producto_led,
        CASE
            WHEN f.factor = 0 THEN 0
            WHEN p.lumens >= 12000 THEN f.factor
            WHEN p.lumens >= 9000 THEN GREATEST(f.factor - 2, 0)
            ELSE GREATEST(f.factor - 5, -2)
        END AS puntaje,
        CASE
            WHEN f.valor = 'sin polarizado' THEN
                'Sin polarizado: ajuste neutro por transmision de luz alta.'
            ELSE
                'Polarizado ' || f.valor || ': se prioriza intensidad luminica acorde al nivel de oscurecimiento.'
        END AS motivo
    FROM factores f
    CROSS JOIN productos_led p
)
INSERT INTO reglas_recomendacion (id_perfil_uso, id_producto_led, puntaje, motivo)
SELECT id_perfil_uso, id_producto_led, puntaje, motivo
FROM reglas_generadas;
