/**
 * Clase GoalManager
 * 
 * Se encarga de gestionar la lógica para detectar y mostrar
 * animaciones de gol en una interfaz web conectada a un API en tiempo real.
 * Funciona consultando continuamente un endpoint de partidos y activando
 * transiciones de video y CSS cuando el marcador de alguno de los equipos aumenta.
 */
class GoalManager {
    /**
     * Constructor de la clase. Inicializa la configuración, enlaza los elementos del DOM
     * y define el estado interno para manejar el polling y los puntajes.
     * 
     * @param {Object} options - Opciones de configuración.
     * @param {string} [options.apiUrl] - URL base de la API de donde se consultan los partidos.
     * @param {number|string} [options.fixtureId] - ID del partido (fixture) a monitorear.
     * @param {number} [options.pollingIntervalMs] - Intervalo en milisegundos para consultar la API.
     * @param {string} [options.containerSelector] - Selector CSS del contenedor principal de la animación.
     * @param {string} [options.golVideoSelector] - Selector CSS del elemento de video de gol.
     * @param {string} [options.azulHoleSelector] - Selector CSS de la transición circular azul.
     * @param {string} [options.scoreboardId] - ID del elemento DOM que contiene el marcador.
     * @param {string} [options.homeScoreId] - ID del elemento DOM para el puntaje del equipo local.
     * @param {string} [options.awayScoreId] - ID del elemento DOM para el puntaje del equipo visitante.
     * @param {string} [options.homeNameId] - ID del elemento DOM para el nombre del equipo local.
     * @param {string} [options.awayNameId] - ID del elemento DOM para el nombre del equipo visitante.
     * @param {string} [options.homeLogoId] - ID del elemento DOM para el logo/bandera del local.
     * @param {string} [options.awayLogoId] - ID del elemento DOM para el logo/bandera del visitante.
     */
    constructor(options = {}) {
        // --- Configuración de la API y polling ---
        /** @type {string} URL de la API pública */
        this.apiUrl = options.apiUrl || 'https://alacapipollamundialista.alacoohperu.pe/api/public';
        /** @type {number|string} ID del partido observado */
        this.fixtureId = options.fixtureId || 9;
        /** @type {number} Frecuencia en ms para verificar goles */
        this.pollingIntervalMs = options.pollingIntervalMs || 1000;
        
        // --- Elementos del DOM ---
        /** @type {HTMLElement} Contenedor donde se aplican las clases de animación ('is-goal', 'is-goal-other') */
        this.container = document.querySelector(options.containerSelector || '.container');
        /** @type {HTMLVideoElement} Elemento <video> que muestra la animación de gol */
        this.golVideo = document.querySelector(options.golVideoSelector || '.gol-overlay');
        /** @type {HTMLElement} Capa que usamos para detectar el fin de la animación corta */
        this.azulHole = document.querySelector(options.azulHoleSelector || '.azul-hole');
        
        /** @type {HTMLElement} Contenedor visual del marcador completo */
        this.scoreboard = document.getElementById(options.scoreboardId || 'scoreboard');
        /** @type {HTMLElement} Texto con el puntaje local */
        this.homeScoreEl = document.getElementById(options.homeScoreId || 'home-score');
        /** @type {HTMLElement} Texto con el puntaje visitante */
        this.awayScoreEl = document.getElementById(options.awayScoreId || 'away-score');
        /** @type {HTMLElement} Texto con el nombre del local */
        this.homeNameEl = document.getElementById(options.homeNameId || 'home-name');
        /** @type {HTMLElement} Texto con el nombre del visitante */
        this.awayNameEl = document.getElementById(options.awayNameId || 'away-name');
        /** @type {HTMLImageElement} Imagen (logo/bandera) del local */
        this.homeLogoEl = document.getElementById(options.homeLogoId || 'home-logo');
        /** @type {HTMLImageElement} Imagen (logo/bandera) del visitante */
        this.awayLogoEl = document.getElementById(options.awayLogoId || 'away-logo');

        // --- Estado interno de la aplicación ---
        /** @type {number} Timestamp del momento de carga. Útil para la sincronización de videos */
        this.pageLoadTime = Date.now();
        /** @type {number} Puntaje guardado en memoria para el equipo local */
        this.currentHomeScore = 0;
        /** @type {number} Puntaje guardado en memoria para el equipo visitante */
        this.currentAwayScore = 0;
        /** @type {number|null} ID del intervalo de polling (para poder detenerlo si es necesario) */
        this.pollingTimer = null;

        this.initEvents();
    }

    /**
     * Inicializa los escuchadores de eventos (Event Listeners) en los elementos multimedia y del DOM
     * para reaccionar al inicio y término de las animaciones CSS.
     */
    initEvents() {
        if (this.golVideo) {
            // Escucha cuando comienza la animación de mostrar la capa de gol
            this.golVideo.addEventListener('animationstart', () => {
                this.golVideo.pause();
                this.golVideo.currentTime = 0;
                // Calcula cuánto tiempo ha pasado desde que cargó la página
                const elapsed = Date.now() - this.pageLoadTime;
                // Espera hasta que la animación CSS llegue al segundo 3.03s para darle play al video de gol
                const waitTime = Math.max(0, 3030 - elapsed);
                setTimeout(() => {
                    this.golVideo.play().catch(e => console.error("Error al reproducir el video:", e));
                }, waitTime);
            });

            // Resetea las animaciones una vez que el video de gol ha terminado
            this.golVideo.addEventListener('animationend', () => this.resetAnimations());
        }

        if (this.azulHole) {
            // Para la animación sin video (otros equipos), escucha cuando el círculo azul termina
            this.azulHole.addEventListener('animationend', (e) => {
                if (e.animationName === 'otherHoleAzul') {
                    this.resetAnimations();
                }
            });
        }
    }

    /**
     * Remueve las clases de animación ('is-goal', 'is-goal-other') del contenedor principal
     * y reinicia el video de gol, dejándolo listo para la siguiente vez.
     */
    resetAnimations() {
        if (this.container) {
            this.container.classList.remove('is-goal');
            this.container.classList.remove('is-goal-other');
        }
        if (this.golVideo) {
            this.golVideo.pause();
            this.golVideo.currentTime = 0;
        }
    }

    /**
     * Acorta o extrae una representación corta de 3 letras para el nombre de un equipo.
     * 
     * @param {string} name - Nombre completo del equipo.
     * @param {string} codigo_iso - Código ISO de 3 letras proporcionado por la API.
     * @returns {string} El nombre corto o ISO en mayúsculas.
     */
    getShortName(name, codigo_iso) {
        if (codigo_iso && codigo_iso.trim()) return codigo_iso.trim().toUpperCase();
        return name ? name.substring(0, 3).toUpperCase() : "";
    }

    /**
     * Verifica si el gol que acaba de ocurrir fue marcado por la selección de Ecuador,
     * ya que esto detona una animación de video diferente a la animación por defecto.
     * 
     * @param {number} nuevoHome - Puntaje recién obtenido para el local.
     * @param {number} currentHomeScore - Puntaje que teníamos guardado para el local.
     * @param {number} nuevoAway - Puntaje recién obtenido para el visitante.
     * @param {number} currentAwayScore - Puntaje que teníamos guardado para el visitante.
     * @param {Object} partido - Objeto con los datos del partido (incluyendo nombres y códigos de equipos).
     * @returns {boolean} True si el gol fue de Ecuador, False en caso contrario.
     */
    checkEcuadorGoal(nuevoHome, currentHomeScore, nuevoAway, currentAwayScore, partido) {
        let isEcuador = false;
        const checkTeam = (team) => {
            if (!team) return false;
            // Valida por código ISO o nombre de equipo
            if (team.codigo_iso && team.codigo_iso.toUpperCase() === 'ECU') return true;
            if (team.nombre && team.nombre.toUpperCase().includes('ECUADOR')) return true;
            return false;
        };

        // Revisa si el local metió gol y si es Ecuador
        if (nuevoHome > currentHomeScore && checkTeam(partido.local)) {
            isEcuador = true;
        }
        // Revisa si el visitante metió gol y si es Ecuador
        if (nuevoAway > currentAwayScore && checkTeam(partido.visitante)) {
            isEcuador = true;
        }
        return isEcuador;
    }

    /**
     * Detona la animación visual del gol en pantalla. Actualiza la variable CSS de retraso (--delay)
     * y aplica las clases correspondientes dependiendo de quién haya marcado.
     * 
     * @param {number} newHomeScore - Nuevo puntaje del equipo local.
     * @param {number} newAwayScore - Nuevo puntaje del equipo visitante.
     * @param {number} timeElapsed - Tiempo en milisegundos que pasó desde que cargó la página o se detectó el retraso.
     * @param {boolean} isEcuadorGoal - Indica si el gol fue de Ecuador para lanzar la animación completa con video.
     */
    triggerGoalAnimation(newHomeScore, newAwayScore, timeElapsed = 0, isEcuadorGoal = true) {
        console.log(`¡GOL DETECTADO! Sincronizando animación con retraso de ${timeElapsed}ms... (Ecuador: ${isEcuadorGoal})`);
        
        // Actualiza puntajes internos
        this.currentHomeScore = newHomeScore;
        this.currentAwayScore = newAwayScore;

        if (this.container) {
            // Utiliza un --delay negativo en CSS para compensar si la animación empezó tarde
            this.container.style.setProperty('--delay', `-${timeElapsed}ms`);

            if (isEcuadorGoal) {
                // Animación para Ecuador
                this.container.classList.add('is-goal');
                // En la animación normal, el marcador cambia visualmente aprox. a los 3500ms
                const domUpdateWait = Math.max(0, 3500 - timeElapsed);
                setTimeout(() => {
                    if (this.homeScoreEl) this.homeScoreEl.innerText = newHomeScore;
                    if (this.awayScoreEl) this.awayScoreEl.innerText = newAwayScore;
                }, domUpdateWait);
            } else {
                // Animación rápida (círculos) para otros equipos
                this.container.classList.add('is-goal-other');
                // En la animación corta, el marcador cambia cuando se cubre la pantalla (aprox 4030ms total contando el inicio retrasado)
                const domUpdateWait = Math.max(0, 4030 - timeElapsed);
                setTimeout(() => {
                    if (this.homeScoreEl) this.homeScoreEl.innerText = newHomeScore;
                    if (this.awayScoreEl) this.awayScoreEl.innerText = newAwayScore;
                }, domUpdateWait);
            }
        }
    }

    /**
     * Consulta por primera vez los datos del partido. Carga los logotipos, nombres de equipo
     * y el marcador inicial. Además, verifica en LocalStorage si ocurrió un gol antes de que 
     * cargara esta página (ej: cambio en el software de transmisión).
     */
    async fetchInitialData() {
        try {
            const response = await fetch(`${this.apiUrl}/partidos?id=${this.fixtureId}`, { cache: "no-store" });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            
            if (data && data.partidos && data.partidos.length > 0) {
                const partido = data.partidos[0];
                const local = partido.local;
                const visitante = partido.visitante;
                const marcador = partido.marcador;

                const nuevoHome = parseInt(marcador.local) || 0;
                const nuevoAway = parseInt(marcador.visitante) || 0;

                // Consulta de marcadores previos desde la memoria del navegador
                const savedHomeStr = localStorage.getItem(`alac_home_${this.fixtureId}`);
                const savedAwayStr = localStorage.getItem(`alac_away_${this.fixtureId}`);
                const savedHome = savedHomeStr !== null ? parseInt(savedHomeStr) : null;
                const savedAway = savedAwayStr !== null ? parseInt(savedAwayStr) : null;

                let isHiddenGoal = false;

                // Si hay registro previo y el nuevo marcador es mayor, hubo gol mientras la app estaba cerrada
                if (savedHome !== null && savedAway !== null && (nuevoHome > savedHome || nuevoAway > savedAway)) {
                    isHiddenGoal = true;
                    // Muestra primero el puntaje viejo para permitir que la animación destape el nuevo
                    this.currentHomeScore = savedHome;
                    this.currentAwayScore = savedAway;
                } else {
                    this.currentHomeScore = nuevoHome;
                    this.currentAwayScore = nuevoAway;
                }

                // Desoculta el contenedor del marcador una vez cargados los datos
                if (this.scoreboard) this.scoreboard.style.display = 'flex';
                
                // Relleno de datos del Local
                const homeLogoUrl = local.bandera_url || local.bandera || local.logo;
                if (homeLogoUrl && this.homeLogoEl) this.homeLogoEl.src = homeLogoUrl;
                if (this.homeNameEl) this.homeNameEl.innerText = this.getShortName(local.nombre, local.codigo_iso);
                if (this.homeScoreEl) this.homeScoreEl.innerText = this.currentHomeScore;

                // Relleno de datos del Visitante
                const awayLogoUrl = visitante.bandera_url || visitante.bandera || visitante.logo;
                if (awayLogoUrl && this.awayLogoEl) this.awayLogoEl.src = awayLogoUrl;
                if (this.awayNameEl) this.awayNameEl.innerText = this.getShortName(visitante.nombre, visitante.codigo_iso);
                if (this.awayScoreEl) this.awayScoreEl.innerText = this.currentAwayScore;

                // Se actualiza el resultado real de una vez en memoria para futuras lecturas
                localStorage.setItem(`alac_home_${this.fixtureId}`, nuevoHome);
                localStorage.setItem(`alac_away_${this.fixtureId}`, nuevoAway);

                // Si detectamos un "Gol Oculto", disparamos la animación calculando su posible desfase
                if (isHiddenGoal) {
                    const elapsed = Date.now() - this.pageLoadTime;
                    const isEcuador = this.checkEcuadorGoal(nuevoHome, savedHome, nuevoAway, savedAway, partido);
                    this.triggerGoalAnimation(nuevoHome, nuevoAway, elapsed, isEcuador);
                }
                
                // Arranca el proceso constante de revisar nuevos goles
                this.startPolling();
            } else {
                console.error("No se encontró el partido con fixture_id:", this.fixtureId);
            }
        } catch (error) {
            console.error(`Error al consultar el partido inicial ${this.fixtureId}:`, error);
        }
    }

    /**
     * Inicia un ciclo (setInterval) que constantemente consulta el API.
     * Si nota que el marcador ha incrementado en comparación a lo que está en memoria (currentScore),
     * detona de inmediato la animación de gol.
     */
    startPolling() {
        console.log("Iniciando consulta constante para detectar goles...");
        if (this.pollingTimer) clearInterval(this.pollingTimer);
        
        this.pollingTimer = setInterval(async () => {
            try {
                const response = await fetch(`${this.apiUrl}/partidos?id=${this.fixtureId}`, { cache: "no-store" });
                const result = await response.json();
                
                if (result && result.partidos && result.partidos.length > 0) {
                    const partido = result.partidos[0];
                    const nuevoHome = parseInt(partido.marcador.local) || 0;
                    const nuevoAway = parseInt(partido.marcador.visitante) || 0;

                    // ¿Ocurrió un gol ahora mismo?
                    if (nuevoHome > this.currentHomeScore || nuevoAway > this.currentAwayScore) {
                        const timeElapsed = Date.now() - this.pageLoadTime;
                        const isEcuador = this.checkEcuadorGoal(nuevoHome, this.currentHomeScore, nuevoAway, this.currentAwayScore, partido);
                        
                        // Límite de tiempo máximo para sincronizar el gol sin que se vea cortado bruscamente
                        const maxSyncTime = 3030;

                        if (timeElapsed <= maxSyncTime) {
                            // Estamos a tiempo, ejecutamos la animación y guardamos en memoria local
                            this.triggerGoalAnimation(nuevoHome, nuevoAway, timeElapsed, isEcuador);
                            localStorage.setItem(`alac_home_${this.fixtureId}`, nuevoHome);
                            localStorage.setItem(`alac_away_${this.fixtureId}`, nuevoAway);
                        } else {
                            // Ocurrió un gol, pero la página ya llevaba corriendo mucho tiempo desde 
                            // que recargó. Pospone la animación para no romper los tiempos del software de transmisión.
                            console.log(`Gol detectado muy tarde (${timeElapsed}ms). Se pospone la animación para la siguiente pasada.`);
                            // OJO: Se actualiza en memoria RAM pero NO en LocalStorage, para forzar el "HiddenGoal" en el siguiente reinicio.
                            this.currentHomeScore = nuevoHome;
                            this.currentAwayScore = nuevoAway;
                        }
                    }
                }
            } catch (err) {
                console.error("Error consultando endpoint de gol:", err);
            }
        }, this.pollingIntervalMs);
    }
    
    /**
     * Detiene la consulta constante al API. Útil si quieres pausar el monitoreo
     * (por ejemplo, si el partido terminó).
     */
    stopPolling() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }
}
