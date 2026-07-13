const btnPick = document.getElementById('btn-pick');
const btnProcess = document.getElementById('btn-process');
const btnExport = document.getElementById('btn-export');
const fileInput = document.getElementById('file-input');
const statusLog = document.getElementById('status-log');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

const videoPlayer = document.getElementById('video-player');
const previewContainer = document.getElementById('preview-container');
const noVideoText = document.getElementById('no-video-text');

const thresholdSlider = document.getElementById('threshold');
const thresholdVal = document.getElementById('threshold-val');
const durationSlider = document.getElementById('duration');
const durationVal = document.getElementById('duration-val');
const paddingSlider = document.getElementById('padding');
const paddingVal = document.getElementById('padding-val');

let datosVideoMesa = null;
let segmentosDeVoz = [];
let controladorAsignado = false;

// Actualizacion visual dinamica de controles deslizantes
thresholdSlider.addEventListener('input', (e) => { thresholdVal.textContent = `${e.target.value} dB`; });
durationSlider.addEventListener('input', (e) => { durationVal.textContent = `${e.target.value} ms`; });
paddingSlider.addEventListener('input', (e) => { paddingVal.textContent = `${e.target.value} ms`; });

btnPick.addEventListener('click', () => { fileInput.click(); });

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        datosVideoMesa = file;
        
        // Montaje del archivo multimedia en la vista movil
        videoPlayer.src = URL.createObjectURL(file);
        noVideoText.style.display = 'none';
        previewContainer.style.display = 'block';
        
        btnProcess.style.display = 'block';
        btnExport.style.display = 'none';
        statusLog.textContent = "Video cargado con éxito. Listo para procesar.";
        
        // Limpieza de memoria previa
        segmentosDeVoz = [];
        progressContainer.style.display = 'none';
    }
});

function actualizarProgreso(porcentaje, textoEstado) {
    progressContainer.style.display = 'block';
    progressBar.style.width = `${porcentaje}%`;
    progressText.textContent = `${porcentaje}%`;
    if (textoEstado) statusLog.textContent = textoEstado;
}

// PASO 1: DECODIFICACIÓN Y ANÁLISIS POR HARDWARE MÓVIL
btnProcess.addEventListener('click', async () => {
    if (!datosVideoMesa) return;
    
    actualizarProgreso(15, 'Extrayendo pista de audio binaria...');
    
    try {
        const arrayBuffer = await datosVideoMesa.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        
        actualizarProgreso(45, 'Analizando picos de frecuencia...');
        
        audioCtx.decodeAudioData(arrayBuffer, (audioBuffer) => {
            const canalDatos = audioBuffer.getChannelData(0); // Analizar canal primario
            const muestraRatio = audioBuffer.sampleRate;
            const longitudMuestras = canalDatos.length;
            
            const umbralDb = parseFloat(thresholdSlider.value);
            const umbralLineal = Math.pow(10, umbralDb / 20);
            const minDuracionMs = parseFloat(durationSlider.value);
            const paddingMs = parseFloat(paddingSlider.value) / 1000;
            
            const muestrasMinimasSilencio = (minDuracionMs / 1000) * muestraRatio;
            
            segmentosDeVoz = [];
            let estaEnSilencio = true;
            let marcaInicio = 0;
            let acumuladorSilencio = 0;

            for (let i = 0; i < longitudMuestras; i++) {
                const amplitudMuestra = Math.abs(canalDatos[i]);
                
                if (amplitudMuestra < umbralLineal) {
                    acumuladorSilencio++;
                } else {
                    if (estaEnSilencio) {
                        marcaInicio = Math.max(0, (i / muestraRatio) - paddingMs);
                        estaEnSilencio = false;
                    }
                    acumuladorSilencio = 0;
                }

                if (!estaEnSilencio && acumuladorSilencio >= muestrasMinimasSilencio) {
                    let marcaFin = (i / muestraRatio) + paddingMs;
                    segmentosDeVoz.push({ inicio: marcaInicio, fin: marcaFin });
                    estaEnSilencio = true;
                }
            }

            if (!estaEnSilencio) {
                segmentosDeVoz.push({ inicio: marcaInicio, fin: longitudMuestras / muestraRatio });
            }

            actualizarProgreso(100, `Análisis completo. ${segmentosDeVoz.length} zonas de audio detectadas.`);
            btnExport.style.display = 'block';
        }, (error) => {
            actualizarProgreso(0, 'Fallo al procesar el decodificador de audio.');
            console.error(error);
        });
        
    } catch (err) {
        actualizarProgreso(0, 'El archivo seleccionado está dañado o no es soportado.');
        console.error(err);
    }
});

// PASO 2: CONSTRUCCIÓN DE LA LÍNEA DE TIEMPO DINÁMICA
btnExport.addEventListener('click', () => {
    if (segmentosDeVoz.length === 0) {
        alert('Modifica los parámetros de los sliders; no se detectaron partes habladas.');
        return;
    }

    actualizarProgreso(50, 'Sincronizando saltos de reproducción...');

    // Evitar acumulacion de listeners en ejecuciones consecutivas
    if (!controladorAsignado) {
        videoPlayer.addEventListener('timeupdate', () => {
            const tiempoActual = videoPlayer.currentTime;
            let dentroDeZonaVoz = false;

            for (let i = 0; i < segmentosDeVoz.length; i++) {
                if (tiempoActual >= segmentosDeVoz[i].inicio && tiempoActual <= segmentosDeVoz[i].fin) {
                    dentroDeZonaVoz = true;
                    break;
                }
            }

            if (!dentroDeZonaVoz && !videoPlayer.paused) {
                // Localizar el siguiente bloque de voz válido
                const siguienteSegmento = segmentosDeVoz.find(seg => seg.inicio > tiempoActual);
                if (siguienteSegmento) {
                    videoPlayer.currentTime = siguienteSegmento.inicio;
                }
            }
        });
        controladorAsignado = true;
    }

    actualizarProgreso(100, '¡Filtro de silencios activo!');
    alert('¡Línea de tiempo modificada con éxito!\nDale PLAY al video y verás cómo omite automáticamente todas las pausas.');
});