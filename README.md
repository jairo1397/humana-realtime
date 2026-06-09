# Lógica de Sincronización y Animación de Gol

Este documento detalla el funcionamiento interno de la pantalla de marcador en tiempo real y cómo se gestiona la animación de gol para un entorno de Digital Signage (Outdoor), donde el anuncio tiene una ventana de exhibición estricta de **10 segundos**.

## Arquitectura de la Animación

La animación de gol está construida enteramente mediante CSS y Javascript, apoyada en recursos de video. La línea de tiempo completa dura exactamente **7 segundos**, estructurada de la siguiente manera:
- **00:00 - 03:03s**: Tiempo de espera oculto (Fade in progresivo).
- **03:03s**: Aparición principal del "Video Gol".
- **03:11s**: Inicio del desvanecimiento del video.
- **03:50s**: Actualización del texto del marcador en el DOM.
- **06:17s**: Transición de círculos finales para revelar el marcador actualizado.
- **07:00s**: Fin de la animación.
- **07:00s - 10:00s**: El marcador permanece estático mostrando el resultado actualizado hasta que termine el anuncio.

## Lógica de Detección de Goles

### 1. El "Gol Oculto" (Gol Offline)
Como el HTML solo se muestra por 10 segundos y luego el reproductor outdoor pasa a otra publicidad, es muy probable que un gol ocurra cuando el anuncio **no** está en pantalla.
Para solucionar esto, utilizamos `localStorage` de Chromium/Electron:
- Al cargar el HTML (`fetchInitialFixtureData`), el sistema lee el marcador real desde la API y lo compara con el marcador que se guardó en `localStorage` la última vez que la página estuvo visible.
- Si el marcador de la API es **mayor** al guardado, significa que hubo un gol mientras el anuncio estaba apagado.
- Inmediatamente se muestra el marcador "viejo" en pantalla, se dispara la animación de gol (sincronizada en el segundo 0), y durante la misma se revelará el nuevo resultado.

### 2. El "Gol en Vivo" (Polling)
Mientras el anuncio está visible (esos 10 segundos), la página ejecuta una consulta a la API cada segundo (`startGoalPolling`) para detectar si ocurre un gol exactamente en ese momento.

## Sistema de Sincronización Temporal (La Regla de los 03:03s)

El mayor reto es que el reproductor outdoor cortará la pantalla abruptamente a los 10 segundos. Además, visualmente el video debe aparecer sí o sí en la marca de los 03:03s. Existe un "Cronómetro Maestro" (`pageLoadTime`) que sincroniza todo:

- **Gol detectado antes de los 3.03s:** 
  Si el polling detecta un gol en el segundo 1.5, iniciar la animación de cero haría que el video termine fuera del tiempo.
  **Solución:** Se dispara la animación pero se le aplica un *retraso negativo dinámico* (`--delay: -1500ms`). Esto "adelanta" la línea de tiempo de CSS de forma imperceptible. Como resultado, sin importar si el gol entró al segundo 1 o 2, la aparición del video del gol estallará siempre **matemáticamente en la marca de los 03:03s** de la vida del anuncio.

- **Gol detectado después de los 3.03s:**
  Si el gol se detecta muy tarde (ej. a los 5 segundos), iniciar la animación haría que se pierda la parte inicial del video o que no coincida con el diseño planeado.
  **Solución (Postergación Estratégica):** El sistema bloquea la animación y simplemente actualiza las variables en memoria para no seguir consultando, **PERO intencionalmente no actualiza el `localStorage`**. De esta forma, el anuncio terminará tranquilamente mostrando el resultado viejo.
  Cuando el anuncio vuelva a rotar en la pantalla (quizás 3 minutos después), cargará el caché desactualizado, el sistema aplicará la regla del **"Gol Oculto"** y festejará el gol a toda pantalla desde el segundo cero.
