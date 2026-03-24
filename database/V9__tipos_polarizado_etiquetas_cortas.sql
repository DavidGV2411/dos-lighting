-- Ajustar etiquetas de tipos de polarizado al formato solicitado en UI.

UPDATE tipos_polarizado
SET descripcion = CASE codigo
    WHEN 'sin polarizado' THEN 'Sin polarizado'
    WHEN '70%' THEN '70% casi transparente'
    WHEN '50%' THEN '50% claro'
    WHEN '35%' THEN '35% medio'
    WHEN '20%' THEN '20% oscuro medio'
    WHEN '5%' THEN '5% super oscuro'
    ELSE descripcion
END
WHERE codigo IN ('sin polarizado', '70%', '50%', '35%', '20%', '5%');

UPDATE perfiles_uso
SET descripcion = CASE valor
    WHEN 'sin polarizado' THEN 'Sin polarizado'
    WHEN '70%' THEN '70% casi transparente'
    WHEN '50%' THEN '50% claro'
    WHEN '35%' THEN '35% medio'
    WHEN '20%' THEN '20% oscuro medio'
    WHEN '5%' THEN '5% super oscuro'
    ELSE descripcion
END
WHERE categoria = 'polarizado'
  AND valor IN ('sin polarizado', '70%', '50%', '35%', '20%', '5%');
