INSERT INTO tipos_vehiculo (nombre, descripcion)
VALUES
    ('Moto', 'Vehiculo de dos ruedas'),
    ('Auto / Sedán', 'Vehiculo liviano de uso urbano/interurbano'),
    ('Camioneta / SUV', 'Vehiculo utilitario y multiproposito');

INSERT INTO marcas_vehiculo (nombre, id_tipo_vehiculo)
VALUES
    ('Chevrolet', (SELECT id FROM tipos_vehiculo WHERE nombre = 'Auto / Sedán')),
    ('Toyota', (SELECT id FROM tipos_vehiculo WHERE nombre = 'Camioneta / SUV')),
    ('Yamaha', (SELECT id FROM tipos_vehiculo WHERE nombre = 'Moto'));

INSERT INTO modelos_vehiculo (nombre, id_marca, anio_desde, anio_hasta)
VALUES
    ('Aveo Emotion', (SELECT id FROM marcas_vehiculo WHERE nombre = 'Chevrolet'), 2008, 2015),
    ('Hilux', (SELECT id FROM marcas_vehiculo WHERE nombre = 'Toyota'), 2016, NULL),
    ('MT-07', (SELECT id FROM marcas_vehiculo WHERE nombre = 'Yamaha'), 2018, NULL);

INSERT INTO casquillos (codigo, descripcion)
VALUES
    ('H1', 'Casquillo halogeno H1'),
    ('H4', 'Casquillo doble filamento H4'),
    ('H7', 'Casquillo halogeno H7'),
    ('H8', 'Casquillo halogeno H8'),
    ('H11', 'Casquillo halogeno H11'),
    ('H16', 'Casquillo halogeno H16'),
    ('9005 (HB3)', 'Casquillo HB3 para luz larga'),
    ('9006 (HB4)', 'Casquillo HB4 para luz baja'),
    ('D1S', 'Casquillo xenon D1S'),
    ('D2S', 'Casquillo xenon D2S');

INSERT INTO compatibilidad_vehiculo_casquillo (
    id_modelo,
    anio_desde,
    anio_hasta,
    posicion_luz,
    id_casquillo,
    tipo_sistema_optico
)
VALUES
    ((SELECT id FROM modelos_vehiculo WHERE nombre = 'Aveo Emotion'), 2008, 2015, 'cruce_y_largo', (SELECT id FROM casquillos WHERE codigo = 'H4'), 'reflector_abierto'),
    ((SELECT id FROM modelos_vehiculo WHERE nombre = 'Aveo Emotion'), 2008, 2015, 'antiniebla', (SELECT id FROM casquillos WHERE codigo = 'H11'), 'reflector_abierto'),
    ((SELECT id FROM modelos_vehiculo WHERE nombre = 'Hilux'), 2016, NULL, 'cruce', (SELECT id FROM casquillos WHERE codigo = 'H7'), 'lupa_proyector'),
    ((SELECT id FROM modelos_vehiculo WHERE nombre = 'Hilux'), 2016, NULL, 'largo', (SELECT id FROM casquillos WHERE codigo = '9005 (HB3)'), 'reflector_abierto'),
    ((SELECT id FROM modelos_vehiculo WHERE nombre = 'Hilux'), 2016, NULL, 'antiniebla', (SELECT id FROM casquillos WHERE codigo = 'H11'), 'reflector_abierto');

INSERT INTO marcas_led (nombre, pais_origen, sitio_web)
VALUES
    ('Philips', 'Paises Bajos', 'https://www.philips.com'),
    ('Osram', 'Alemania', 'https://www.osram.com'),
    ('Fahren', 'Estados Unidos', NULL);

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
    notas
)
VALUES
    ((SELECT id FROM marcas_led WHERE nombre = 'Philips'), 'Ultinon Pro9000 H4', (SELECT id FROM casquillos WHERE codigo = 'H4'), 'cruce_y_largo', 'ambos', 15000, 5800, 60.00, 120.00, TRUE, 'assets/productos/philips-pro9000-h4.jpg', 'Alto rendimiento para uso mixto'),
    ((SELECT id FROM marcas_led WHERE nombre = 'Osram'), 'Night Breaker LED H11', (SELECT id FROM casquillos WHERE codigo = 'H11'), 'antiniebla', 'ambos', 8000, 6000, 35.00, 95.00, TRUE, 'assets/productos/osram-night-breaker-h11.jpg', 'Buen equilibrio entre potencia y consumo'),
    ((SELECT id FROM marcas_led WHERE nombre = 'Fahren'), 'SuperVision HB3', (SELECT id FROM casquillos WHERE codigo = '9005 (HB3)'), 'largo', 'reflector_abierto', 10000, 6500, 40.00, 70.00, TRUE, 'assets/productos/fahren-hb3.jpg', 'Recomendada para carretera nocturna'),
    ((SELECT id FROM marcas_led WHERE nombre = 'Osram'), 'Cool Blue H7', (SELECT id FROM casquillos WHERE codigo = 'H7'), 'cruce', 'lupa_proyector', 9000, 6200, 45.00, 110.00, TRUE, 'assets/productos/osram-cool-blue-h7.jpg', 'Perfil orientado a visibilidad urbana');

INSERT INTO perfiles_uso (categoria, valor, descripcion)
VALUES
    ('horario_manejo', 'diurno', 'Mayormente de dia'),
    ('horario_manejo', 'mixto', 'Uso diurno y nocturno'),
    ('horario_manejo', 'nocturno', 'Mayormente de noche'),
    ('zona_manejo', 'urbano', 'Principalmente ciudad'),
    ('zona_manejo', 'carretera', 'Principalmente carretera'),
    ('zona_manejo', 'rural', 'Principalmente zona rural'),
    ('zona_manejo', 'mixto', 'Ciudad y carretera/rural'),
    ('uso_vehiculo', 'uso_personal', 'Uso personal diario'),
    ('uso_vehiculo', 'trabajo', 'Uso laboral frecuente'),
    ('uso_vehiculo', 'offroad', 'Uso en caminos exigentes'),
    ('polarizado', 'con_polarizado', 'El vehiculo tiene polarizado'),
    ('polarizado', 'sin_polarizado', 'El vehiculo no tiene polarizado');

INSERT INTO reglas_recomendacion (id_perfil_uso, id_producto_led, puntaje, motivo)
VALUES
    ((SELECT id FROM perfiles_uso WHERE categoria = 'horario_manejo' AND valor = 'nocturno'), (SELECT id FROM productos_led WHERE modelo = 'Ultinon Pro9000 H4'), 10, 'Buen rendimiento para manejo nocturno'),
    ((SELECT id FROM perfiles_uso WHERE categoria = 'zona_manejo' AND valor = 'rural'), (SELECT id FROM productos_led WHERE modelo = 'Ultinon Pro9000 H4'), 8, 'Alcance adecuado para zonas poco iluminadas'),
    ((SELECT id FROM perfiles_uso WHERE categoria = 'polarizado' AND valor = 'con_polarizado'), (SELECT id FROM productos_led WHERE modelo = 'Ultinon Pro9000 H4'), 4, 'Compensa perdida de visibilidad por polarizado'),

    ((SELECT id FROM perfiles_uso WHERE categoria = 'zona_manejo' AND valor = 'carretera'), (SELECT id FROM productos_led WHERE modelo = 'SuperVision HB3'), 9, 'Excelente para luces largas en carretera'),
    ((SELECT id FROM perfiles_uso WHERE categoria = 'horario_manejo' AND valor = 'diurno'), (SELECT id FROM productos_led WHERE modelo = 'SuperVision HB3'), -3, 'Potencia innecesaria para uso mayormente diurno'),

    ((SELECT id FROM perfiles_uso WHERE categoria = 'zona_manejo' AND valor = 'urbano'), (SELECT id FROM productos_led WHERE modelo = 'Cool Blue H7'), 6, 'Patron de luz adecuado para ciudad'),
    ((SELECT id FROM perfiles_uso WHERE categoria = 'uso_vehiculo' AND valor = 'trabajo'), (SELECT id FROM productos_led WHERE modelo = 'Night Breaker LED H11'), 5, 'Balance entre consumo y durabilidad para uso intensivo');

INSERT INTO usuarios (username, password_hash, nombre_completo, activo)
VALUES
    ('admin', crypt('admin123', gen_salt('bf')), 'Administrador del sistema', TRUE);
