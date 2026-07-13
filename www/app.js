// VARIABLES GLOBALES DE CONTROL
let videoElemento = null;
let listaDeSilencios = [];
let fragmentosConVoz = [];
let urlVideoOriginal = "";

// SE EJECUTA AL INICIAR LA APP
document.addEventListener("DOMContentLoaded", () => {
    videoElemento = document.getElementById('reproductor-video');
    dibujarCanvasVacio();
});

// 1. CUANDO EL USUARIO SELECCIONA UN VIDEO
function alSeleccionarVideo(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    
    // Si corre en el celular usamos el convertidor de Capacitor, si no, el tradicional de PC
    if (window.Capacitor) {
        urlVideoOriginal = window.Capacitor.convertFileSrc(archivo.name);
    } else {
        urlVideoOriginal = URL.createObjectURL(archivo);
    }
    
    videoElemento.src = urlVideoOriginal;
    videoElemento.load();
    
    // Reiniciar interfaz
    listaDeSilencios = [];
    fragmentosConVoz = [];
    document.getElementById('txt-contador-silencios').innerText = "0 silencios";
    document.getElementById('txt-tiempo-recuperable').innerText = "0.00s recortados";
    document.getElementById('lista-silencios-interactiva').innerHTML = "";
    dibujarCanvasVacio();
}

// 2. ANALIZAR LAS ONDAS DE AUDIO Y DETECTAR SILENCIOS
function analizarOndasDeAudio() {
    if (!videoElemento.src) {
        alert("Por favor, selecciona primero un video.");
        return;
    }

    // SIMULACIÓN DEL ESCANEO DE AUDIO (Aquí se integra el algoritmo de volumen)
    // Generamos marcas automáticas basadas en la duración del video
    const duracion = videoElemento.duration || 30;
    listaDeSilencios = [
        { id: 1, inicio: duracion * 0.1, fin: (duracion * 0.1) + 2.4, eliminar: true },
        { id: 2, inicio: duracion * 0.4, fin: (duracion * 0.4) + 1.8, eliminar: true },
        { id: 3, inicio: duracion * 0.7, fin: (duracion * 0.7) + 3.1, eliminar: true }
    ];

    // Pintar las ondas verdes en el canvas
    dibujarOndasVerdes();
    // Renderizar los renglones con los interruptores activos
    renderizarListaSilencios();
}

// DIBUJAR ONDAS ESTILO JUMPCUTTER
function dibujarOndasVerdes() {
    const canvas = document.getElementById('canvas-ondas');
    const ctx = canvas.getContext('2d');
    
    // Ajustar resolución real del cuadro
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 100;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#00e676"; // Verde fosforescente
    ctx.lineWidth = 2;
    
    // Dibujar líneas verticales densas simétricas
    for (let i = 0; i < canvas.width; i += 5) {
        let esSilencio = false;
        
        // Verificar si este punto de la barra coincide con un silencio detectado
        let tiempoPunto = (i / canvas.width) * (videoElemento.duration || 30);
        listaDeSilencios.forEach(s => {
            if (tiempoPunto >= s.inicio && tiempoPunto <= s.fin) esSilencio = true;
        });

        // Si es silencio hacemos la onda casi plana, si hay voz la hacemos alta
        let altura = esSilencio ? (Math.random() * 5 + 2) : (Math.random() * 60 + 15);
        
        ctx.beginPath();
        ctx.moveTo(i, (canvas.height / 2) - (altura / 2));
        ctx.lineTo(i, (canvas.height / 2) + (altura / 2));
        ctx.stroke();
    }
}

function dibujarCanvasVacio() {
    const canvas = document.getElementById('canvas-ondas');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 300;
    canvas.height = 100;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#2a2b3d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

// RECREAR LA LISTA EN PANTALLA CON LOS SWITCHES
function renderizarListaSilencios() {
    const contenedor = document.getElementById('lista-silencios-interactiva');
    contenedor.innerHTML = '';
    
    document.getElementById('txt-contador-silencios').innerText = `${listaDeSilencios.length} silencios`;
    
    listaDeSilencios.forEach((silencio) => {
        const duracionPausa = silencio.fin - silencio.inicio;
        const item = document.createElement('div');
        item.className = 'item-silencio';
        item.style.borderLeftColor = silencio.eliminar ? '#ff1744' : '#8b8eaf';
        
        item.innerHTML = `
            <div class="item-info">
                <span class="badge-duracion" style="color: ${silencio.eliminar ? '#ff1744' : '#8b8eaf'}; background: ${silencio.eliminar ? 'rgba(255,23,68,0.15)' : 'rgba(139,142,175,0.15)'};">
                    ${duracionPausa.toFixed(1)}s
                </span>
                <div>
                    <div class="item-timestamps">${formatearTiempo(silencio.inicio)} → ${formatearTiempo(silencio.fin)}</div>
                    <div id="status-${silencio.id}" class="item-status" style="color: ${silencio.eliminar ? '#ff1744' : '#8b8eaf'};">
                        ${silencio.eliminar ? 'Will be removed' : 'Kept'}
                    </div>
                </div>
            </div>
            <label class="switch-container">
                <input type="checkbox" ${silencio.eliminar ? 'checked' : ''} onchange="conmutarSwitch(${silencio.id}, this.checked)">
                <span class="slider"></span>
            </label>
        `;
        contenedor.appendChild(item);
    });
    
    recalcularTiempoTotal();
}

// CUANDO EL USUARIO ACTIVA/DESACTIVA UN INTERRUPTOR
function conmutarSwitch(id, estaActivo) {
    const silencio = listaDeSilencios.find(s => s.id === id);
    if (silencio) {
        silencio.eliminar = estaActivo;
        
        // Cambiar textos y colores visuales del renglón de inmediato
        const txtStatus = document.getElementById(`status-${id}`);
        if (txtStatus) {
            txtStatus.innerText = estaActivo ? 'Will be removed' : 'Kept';
            txtStatus.style.color = estaActivo ? '#ff1744' : '#8b8eaf';
            txtStatus.parentElement.parentElement.parentElement.style.borderLeftColor = estaActivo ? '#ff1744' : '#8b8eaf';
        }
        recalcularTiempoTotal();
    }
}

function marcarTodos(status) {
    listaDeSilencios.forEach(s => s.eliminar = status);
    renderizarListaSilencios();
}

function recalcularTiempoTotal() {
    let acumulado = 0;
    listaDeSilencios.forEach(s => {
        if (s.eliminar) acumulado += (s.fin - s.inicio);
    });
    document.getElementById('txt-tiempo-recuperable').innerText = `${acumulado.toFixed(2)}s recortados`;
}

function formatearTiempo(segundos) {
    const m = Math.floor(segundos / 60).toString().padStart(2, '0');
    const s = Math.floor(segundos % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// 3. EXPORTAR EL VIDEO RECORTADO CORRIDO
async function exportarVideoSinSilencios() {
    if (listaDeSilencios.length === 0) {
        alert("Primero debes analizar el video.");
        return;
    }

    // Calcular la línea de tiempo limpia omitiendo los silencios marcados
    fragmentosConVoz = [];
    let posicionActual = 0;
    const duracionTotal = videoElemento.duration;

    listaDeSilencios.forEach(s => {
        if (s.eliminar) {
            if (s.inicio > posicionActual) {
                fragmentosConVoz.push({ inicio: posicionActual, fin: s.inicio });
            }
            posicionActual = s.fin;
        }
    });
    if (posicionActual < duracionTotal) {
        fragmentosConVoz.push({ inicio: posicionActual, fin: duracionTotal });
    }

    alert("Iniciando procesamiento local... Tu video se descargará recortado automáticamente al finalizar.");
    
    // CREACIÓN DEL PROCESADOR DE VIDEO LOCAL (Canvas + MediaRecorder)
    const canvasRender = document.createElement('canvas');
    const ctxRender = canvasRender.getContext('2d');
    canvasRender.width = videoElemento.videoWidth || 720;
    canvasRender.height = videoElemento.videoHeight || 1280; // Mantiene formato vertical de TikTok

    const streamVideo = canvasRender.captureStream(30);
    const streamAudio = videoElemento.captureStream ? videoElemento.captureStream() : videoElemento.mozCaptureStream();
    const streamFinal = new MediaStream([...streamVideo.getVideoTracks(), ...streamAudio.getAudioTracks()]);

    const grabador = new MediaRecorder(streamFinal, { mimeType: 'video/webm;codecs=vp9' });
    let fragmentosBinarios = [];

    grabador.ondataavailable = (e) => { if (e.data.size > 0) fragmentosBinarios.push(e.data); };
    
    grabador.onstop = () => {
        const archivoBlob = new Blob(fragmentosBinarios, { type: 'video/mp4' });
        const urlDescarga = URL.createObjectURL(archivoBlob);
        
        const enlace = document.createElement('a');
        enlace.href = urlDescarga;
        enlace.download = "silence_cutter_tiktok.mp4";
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        
        alert("¡Video exportado con éxito! Revisa la galería de tu dispositivo.");
    };

    grabador.start();

    // Reproducir y saltar en la línea de tiempo fotograma por fotograma
    for (const fragmento of fragmentosConVoz) {
        videoElemento.currentTime = fragmento.inicio;
        await new Promise(r => videoElemento.onseeked = r);

        videoElemento.play();
        while (videoElemento.currentTime < fragmento.fin) {
            ctxRender.drawImage(videoElemento, 0, 0, canvasRender.width, canvasRender.height);
            await new Promise(r => requestAnimationFrame(r));
        }
        videoElemento.pause();
    }

    grabador.stop();
}
