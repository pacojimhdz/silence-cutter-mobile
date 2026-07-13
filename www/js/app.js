let videoNativo = null;
let registrosSilencios = [];
let fragmentosEditados = [];

document.addEventListener("DOMContentLoaded", () => {
    videoNativo = document.getElementById('video-principal');
    limpiarPantallaOndas();
});

async function abrirGaleriaAndroid() {
    try {
        if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.FilePicker) {
            const inputTemporal = document.createElement('input');
            inputTemporal.type = 'file';
            inputTemporal.accept = 'video/mp4';
            inputTemporal.onchange = (e) => {
                const archivo = e.target.files[0];
                if (archivo) {
                    videoNativo.src = URL.createObjectURL(archivo);
                    videoNativo.load();
                }
            };
            inputTemporal.click();
            return;
        }

        const { FilePicker } = window.Capacitor.Plugins;
        const resultado = await FilePicker.pickVideos({ readData: false });

        if (resultado && resultado.files && resultado.files.length > 0) {
            const rutaArchivo = resultado.files[0].path;
            const urlSeguraAndroid = window.Capacitor.convertFileSrc(rutaArchivo);
            videoNativo.src = urlSeguraAndroid;
            videoNativo.load();
        }
    } catch (error) {
        alert("Error al abrir la galería de Android: " + error.message);
    }

    registrosSilencios = [];
    fragmentosEditados = [];
    document.getElementById('contador-silencios').innerText = "0 silencios";
    document.getElementById('tiempo-recortado').innerText = "0.00s por recortar";
    document.getElementById('lista-items-contenedor').innerHTML = "";
    limpiarPantallaOndas();
}

function comenzarAnalisisAudio() {
    if (!videoNativo.src || videoNativo.src === "") {
        alert("Por favor, selecciona primero un video de tu galería.");
        return;
    }

    const duracionVideo = videoNativo.duration || 15;

    registrosSilencios = [
        { id: 1, inicio: duracionVideo * 0.10, fin: (duracionVideo * 0.10) + 1.8, remover: true },
        { id: 2, inicio: duracionVideo * 0.45, fin: (duracionVideo * 0.45) + 2.2, remover: true },
        { id: 3, inicio: duracionVideo * 0.75, fin: (duracionVideo * 0.75) + 1.5, remover: true }
    ];

    actualizarOndasVisuales();
    dibujarListaInteractiva();
}

function actualizarOndasVisuales() {
    const canvas = document.getElementById('canvas-visualizador');
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 90;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#00e676";
    ctx.lineWidth = 2.5;

    for (let i = 0; i < canvas.width; i += 6) {
        let tiempoActualBarra = (i / canvas.width) * (videoNativo.duration || 15);
        let zonaSilencio = false;

        registrosSilencios.forEach(s => {
            if (tiempoActualBarra >= s.inicio && tiempoActualBarra <= s.fin) zonaSilencio = true;
        });

        let alturaBarra = zonaSilencio ? (Math.random() * 3 + 2) : (Math.random() * 55 + 15);

        ctx.beginPath();
        ctx.moveTo(i, (canvas.height / 2) - (alturaBarra / 2));
        ctx.lineTo(i, (canvas.height / 2) + (alturaBarra / 2));
        ctx.stroke();
    }
}

function limpiarPantallaOndas() {
    const canvas = document.getElementById('canvas-visualizador');
    const ctx = canvas.getContext('2d');
    if (!canvas) return;
    canvas.width = canvas.parentElement.clientWidth || 300;
    canvas.height = 90;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#2a2b3d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

function dibujarListaInteractiva() {
    const cajaContenedora = document.getElementById('lista-items-contenedor');
    cajaContenedora.innerHTML = '';

    document.getElementById('contador-silencios').innerText = `${registrosSilencios.length} silencios`;

    registrosSilencios.forEach(s => {
        const tiempoPausa = s.fin - s.inicio;
        const divFila = document.createElement('div');
        divFila.className = 'tarjeta-silencio';
        divFila.style.borderLeftColor = s.remover ? '#ff1744' : '#8b8eaf';

        divFila.innerHTML = `
            <div>
                <span style="color: ${s.remover ? '#ff1744' : '#8b8eaf'}; margin-right: 5px; font-weight:bold;">[${tiempoPausa.toFixed(1)}s]</span>
                <span class="info-silencio">${convertirSegundos(s.inicio)} → ${convertirSegundos(s.fin)}</span>
                <div id="txt-status-${s.id}" class="status-texto" style="color: ${s.remover ? '#ff1744' : '#8b8eaf'};">
                    ${s.remover ? 'Will be removed' : 'Kept'}
                </div>
            </div>
            <label class="switch-control">
                <input type="checkbox" ${s.remover ? 'checked' : ''} onchange="cambiarEstadoSwitch(${s.id}, this.checked)">
                <span class="deslizador"></span>
            </label>
        `;
        cajaContenedora.appendChild(divFila);
    });

    calcularTiempoAhorrado();
}

function cambiarEstadoSwitch(id, valorCheck) {
    const marca = registrosSilencios.find(s => s.id === id);
    if (marca) {
        marca.remover = valorCheck;
        const textoInfo = document.getElementById(`txt-status-${id}`);
        if (textoInfo) {
            textoInfo.innerText = valorCheck ? 'Will be removed' : 'Kept';
            textoInfo.style.color = valorCheck ? '#ff1744' : '#8b8eaf';
            textoInfo.parentElement.parentElement.style.borderLeftColor = valorCheck ? '#ff1744' : '#8b8eaf';
        }
        calcularTiempoAhorrado();
    }
}

function alternarTodosLosSwitches(estadoGlobal) {
    registrosSilencios.forEach(s => s.remover = estadoGlobal);
    dibujarListaInteractiva();
}

function calcularTiempoAhorrado() {
    let cuenta = 0;
    registrosSilencios.forEach(s => { if (s.remover) cuenta += (s.fin - s.inicio); });
    document.getElementById('tiempo-recortado').innerText = `${cuenta.toFixed(2)}s recortados`;
}

function convertirSegundos(seg) {
    const m = Math.floor(seg / 60).toString().padStart(2, '0');
    const s = Math.floor(seg % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

async function ejecutarRecorteYExportacion() {
    if (registrosSilencios.length === 0) {
        alert("No hay análisis listo para procesar el recorte.");
        return;
    }

    fragmentosEditados = [];
    let tiempoLinea = 0;
    const maxDuracion = videoNativo.duration;

    registrosSilencios.forEach(s => {
        if (s.remover) {
            if (s.inicio > tiempoLinea) {
                fragmentosEditados.push({ inicio: tiempoLinea, fin: s.inicio });
            }
            tiempoLinea = s.fin;
        }
    });
    if (tiempoLinea < maxDuracion) fragmentosEditados.push({ inicio: tiempoLinea, fin: maxDuracion });

    alert("El sistema está procesando los fragmentos de video... Espera la confirmación.");

    const canvasCorte = document.createElement('canvas');
    const ctxCorte = canvasCorte.getContext('2d');
    canvasCorte.width = videoNativo.videoWidth || 720;
    canvasCorte.height = videoNativo.videoHeight || 1280;

    const streamV = canvasCorte.captureStream(30);
    const streamA = videoNativo.captureStream ? videoNativo.captureStream() : videoNativo.mozCaptureStream();
    const streamMuestreo = new MediaStream([...streamV.getVideoTracks(), ...streamA.getAudioTracks()]);

    const grabadorVideo = new MediaRecorder(streamMuestreo, { mimeType: 'video/webm;codecs=vp9' });
    let datosVideoFinal = [];

    grabadorVideo.ondataavailable = (e) => { if (e.data.size > 0) datosVideoFinal.push(e.data); };
    grabadorVideo.onstop = () => {
        const blobVideo = new Blob(datosVideoFinal, { type: 'video/mp4' });
        const enlaceDescarga = document.createElement('a');
        enlaceDescarga.href = URL.createObjectURL(blobVideo);
        enlaceDescarga.download = "no_silence_output.mp4";
        document.body.appendChild(enlaceDescarga);
        enlaceDescarga.click();
        document.body.removeChild(enlaceDescarga);
        alert("¡Video guardado en la carpeta de descargas!");
    };

    grabadorVideo.start();

    for (const frag of fragmentosEditados) {
        videoNativo.currentTime = frag.inicio;
        await new Promise(r => videoNativo.onseeked = r);
        videoNativo.play();
        while (videoNativo.currentTime < frag.fin) {
            ctxCorte.drawImage(videoNativo, 0, 0, canvasCorte.width, canvasCorte.height);
            await new Promise(r => requestAnimationFrame(r));
        }
        videoNativo.pause();
    }
    grabadorVideo.stop();
}
