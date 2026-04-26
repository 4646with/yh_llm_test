const CONFIG = {
    stations: {
        bc_openai: { text: { base: 'https://csp.burncloud.com/v1', adapter: 'openai', defaultModel: 'gpt-3.5-turbo' }, image: { base: 'https://csp.burncloud.com/v1', adapter: 'dalle3', defaultModel: 'gpt-image-2' } },
        bc_anthropic: { text: { base: 'https://csp.burncloud.com/v1', adapter: 'anthropic', defaultModel: 'claude-3-haiku-20240307' }, image: { base: 'https://csp.burncloud.com/v1', adapter: 'dalle3', defaultModel: 'dall-e-3' } },
        bc_gemini: { text: { base: 'https://csp.burncloud.com', adapter: 'gemini', defaultModel: 'gemini-2.0-flash-001' }, image: { base: 'https://csp.burncloud.com', adapter: 'gemini_image', defaultModel: 'gemini-2.0-flash-001' } },
        pinova: { text: { base: 'https://pinova.ai/v1', adapter: 'openai', defaultModel: 'gpt-3.5-turbo' }, image: { base: 'https://pinova.ai/v1', adapter: 'dalle3', defaultModel: 'gpt-image-2' } },
        pinova_gemini: { text: { base: 'https://pinova.ai', adapter: 'gemini', defaultModel: 'gemini-2.5-flash' }, image: { base: 'https://pinova.ai', adapter: 'gemini_image', defaultModel: 'gemini-2.5-flash-image' } }
    },
    adapters: {
        text: {
            openai: { endpoint: '/chat/completions', buildPayload: (i) => ({ model: i.modelId, messages: [{ role: 'user', content: i.prompt }] }), parseResponse: (d) => d.choices?.[0]?.message?.content || JSON.stringify(d) },
            anthropic: { endpoint: '/messages', buildPayload: (i) => ({ model: i.modelId, max_tokens: 1024, messages: [{ role: 'user', content: i.prompt }] }), parseResponse: (d) => d.content?.[0]?.text || JSON.stringify(d) },
            gemini: { getEndpoint: (id) => `/v1beta/models/${id}:generateContent`, buildPayload: (i) => ({ contents: [{ role: 'user', parts: [{ text: i.prompt }] }] }), parseResponse: (d) => d.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(d) }
        },
        image: {
            gemini_image: {
                getEndpoint: (id) => `/v1beta/models/${id}:generateContent`,
                buildPayload: (i) => {
                    const parts = [{ text: i.prompt }];
                    const isEdit = i.localImgData || i.refUrl;

                    if (i.refUrl && i.refUrl.startsWith('http')) {
                        let mime = "image/jpeg";
                        if (i.refUrl.endsWith('.png')) mime = "image/png";
                        else if (i.refUrl.endsWith('.webp')) mime = "image/webp";

                        parts.push({
                            fileData: {
                                mimeType: mime,
                                fileUri: i.refUrl
                            }
                        });
                    }
                    else if (i.localImgData) {
                        parts.push({
                            inlineData: {
                                mimeType: i.localImgType || "image/jpeg",
                                data: i.localImgData
                            }
                        });
                    }

                    const p = { contents: [{ role: "user", parts: parts }], generationConfig: { imageConfig: {} } };
                    if (!isEdit && i.size !== 'auto') {
                        const map = { '1024x1024': ['1:1', '1K'], '2048x2048': ['1:1', '2K'], '3840x2160': ['16:9', '4K'] };
                        const [ratio, sz] = map[i.size] || ['1:1', '1K'];
                        p.generationConfig.imageConfig.aspectRatio = ratio; p.generationConfig.imageConfig.imageSize = sz;
                    }
                    if (i.format !== 'png') p.generationConfig.imageConfig.outputMimeType = `image/${i.format}`;
                    if (Object.keys(p.generationConfig.imageConfig).length === 0) delete p.generationConfig.imageConfig;
                    return p;
                },
                parseResponse: (d) => {
                    const p = d.candidates?.[0]?.content?.parts?.[0];
                    if (p?.inlineData?.data) return { status: 'success', url: `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}` };
                    const m = JSON.stringify(d).match(/"(?:data|bytesBase64Encoded|b64_json)"\s*:\s*"([^"]+)"/);
                    return m?.[1]?.length > 100 ? { status: 'success', url: `data:image/png;base64,${m[1]}` } : { status: 'error', msg: '未解析到图像数据' };
                }
            },
            dalle3: {
                getEndpoint: (id) => {
                    const sid = document.getElementById('station-select').value;
                    if (sid.startsWith('bc_openai') || sid.startsWith('bc_anthropic') || sid === 'pinova' || id.startsWith('gpt-image-2')) return '/chat/completions';
                    return '/images/generations';
                },
                buildPayload: (i) => {
                    const ep = CONFIG.adapters.image.dalle3.getEndpoint(i.modelId);
                    const isChat = ep.includes('/chat/completions');
                    const p = { model: i.modelId };
                    if (isChat) {
                        const content = [{ type: 'text', text: i.prompt }];
                        if (i.localImgData) content.push({ type: 'image_url', image_url: { url: `data:${i.localImgType || 'image/jpeg'};base64,${i.localImgData}` } });
                        else if (i.refUrl) content.push({ type: 'image_url', image_url: { url: i.refUrl } });
                        p.messages = [{ role: 'user', content: content }];
                    } else {
                        p.prompt = i.prompt; p.n = 1;
                    }
                    if (i.size !== 'auto') p.size = i.size;
                    p.format = i.format; // 始终传 format，PNG 也明确写入
                    return p;
                },
                parseResponse: (d, i) => {
                    if (d.choices?.[0]?.message) {
                        const c = d.choices[0].message.content;
                        const m = c.match(/!\[.*?\]\((.*?)\)/) || c.match(/https?:\/\/[^\s)]+/);
                        return m ? { status: 'success', url: m[1] || m[0] } : { status: 'error', msg: '响应不含图片链接' };
                    }
                    const mime = i.format !== 'png' ? `image/${i.format}` : 'image/png';
                    return { status: 'success', url: d.data?.[0]?.url || `data:${mime};base64,${d.data?.[0]?.b64_json}` };
                }
            }
        }
    }
};

let currentType = 'text', localImageBase64 = null, localImageType = null, localFileRaw = null, lastFullRequest = {}, lastFullResponse = {};

const DOM = {
    station: document.getElementById('station-select'), base: document.getElementById('base-url'), key: document.getElementById('api-key'),
    tabT: document.getElementById('tab-text'), tabI: document.getElementById('tab-image'),
    panelT: document.getElementById('panel-text'), panelI: document.getElementById('panel-image'),
    btnT: document.getElementById('btn-submit-text'), btnI: document.getElementById('btn-submit-image'),
    res: document.getElementById('result-container'), logQ: document.getElementById('log-request'), logS: document.getElementById('log-response'),
    badge: document.getElementById('status-badge'), toast: document.getElementById('toast-container'),
    fileInput: document.getElementById('image-file-input'), fileLabel: document.getElementById('file-label'),
    imgPreview: document.getElementById('img-preview'), imgPreviewBox: document.getElementById('img-preview-box'),
    btnClearImg: document.getElementById('btn-clear-img'), sizeParamContainer: document.getElementById('size-param-container'),
    imageRefUrl: document.getElementById('image-ref-url'), dropArea: document.getElementById('drop-area'),
    uploadStatus: document.getElementById('upload-status-bar'), progress: document.getElementById('upload-progress'), statusText: document.getElementById('upload-status-text'), btnForceUpload: document.getElementById('btn-force-upload')
};

function showToast(msg, type = 'info') {
    const div = document.createElement('div');
    const cls = { error: 'bg-red-100 border-red-500 text-red-700', success: 'bg-green-100 border-green-500 text-green-700', info: 'bg-blue-100 border-blue-500 text-blue-700' };
    div.className = `toast-enter ${cls[type]} border-l-4 p-4 rounded shadow-md w-80 text-xs`;
    div.innerText = msg; DOM.toast.appendChild(div);
    setTimeout(() => { div.classList.replace('toast-enter', 'toast-leave'); setTimeout(() => div.remove(), 300); }, 3000);
}

function setStatus(text, cls) { DOM.badge.innerText = text; DOM.badge.className = `px-2 py-1 text-[10px] rounded ${cls}`; DOM.badge.classList.remove('hidden'); }

function truncateDeep(obj) {
    if (typeof obj === 'string' && obj.length > 800) return obj.substring(0, 40) + `... [已自动压缩截断显示]`;
    if (Array.isArray(obj)) return obj.map(v => truncateDeep(v));
    if (typeof obj === 'object' && obj !== null) { const r = {}; for (const k in obj) r[k] = truncateDeep(obj[k]); return r; }
    return obj;
}

function restoreDeep(display, original) {
    if (typeof display === 'string' && display.includes('... [已自动压缩')) return original;
    if (Array.isArray(display) && Array.isArray(original)) return display.map((v, i) => restoreDeep(v, original[i]));
    if (typeof display === 'object' && display !== null && typeof original === 'object' && original !== null) {
        const r = {}; for (const k in display) r[k] = restoreDeep(display[k], original[k]); return r;
    }
    return display;
}

function copyFullJson(id) {
    const text = JSON.stringify(id === 'log-request' ? lastFullRequest : lastFullResponse, null, 2);
    const el = document.createElement('textarea'); el.value = text; document.body.appendChild(el); el.select();
    document.execCommand('copy'); document.body.removeChild(el); showToast('已复制完整 JSON', 'success');
}

async function processFile(file) {
    if (!file || !file.type.startsWith('image/')) return showToast('无效图片', 'error');
    DOM.uploadStatus.classList.remove('hidden');
    DOM.statusText.innerText = "⚡ 正在本地解析...";
    DOM.progress.style.width = "40%";
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            const max = 1536;
            if (w > h && w > max) { h *= max / w; w = max; } else if (h > max) { w *= max / h; h = max; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            localImageBase64 = dataUrl.split(',')[1];
            localImageType = 'image/jpeg';
            DOM.imgPreview.src = dataUrl;
            DOM.imgPreviewBox.classList.remove('hidden');
            DOM.btnClearImg.classList.remove('hidden');
            DOM.fileLabel.innerText = `${file.name} (已读取)`;

            canvas.toBlob((blob) => {
                localFileRaw = blob;
                autoCloudUpload();
            }, 'image/jpeg', 0.8);
        };
    };
}

async function autoCloudUpload() {
    if (!localFileRaw) return;
    DOM.statusText.innerText = "☁️ 正在自动生成公网 URL...";
    DOM.progress.style.width = "60%";
    DOM.btnForceUpload.classList.add('hidden');

    const fd = new FormData();
    fd.append('file', localFileRaw, 'image.jpg');
    try {
        const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: fd });
        const d = await res.json();
        if (d.status === 'success') {
            const url = encodeURI(d.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/'));
            DOM.imageRefUrl.value = url;
            DOM.progress.style.width = "100%";
            DOM.statusText.innerText = "✅ URL 已自动生成填入";
            showToast('已成功转化为公网 URL', 'success');
            updateLog();
            setTimeout(() => DOM.uploadStatus.classList.add('hidden'), 3000);
        } else throw new Error(d.message);
    } catch (e) {
        DOM.statusText.innerText = "❌ URL 自动生成失败，请重试或手动粘贴链接";
        DOM.btnForceUpload.classList.remove('hidden');
        showToast(`自动转换失败: ${e.message}`, 'error');
    }
}

function updateLog() {
    const sid = DOM.station.value, route = CONFIG.stations[sid][currentType], adapter = CONFIG.adapters[currentType][route.adapter];
    const isEdit = localImageBase64 || DOM.imageRefUrl.value.trim();
    if (currentType === 'image') DOM.sizeParamContainer.classList.toggle('opacity-40', !!isEdit);
    const inputs = {
        modelId: document.getElementById(`${currentType}-model-id`).value.trim(),
        prompt: document.getElementById(`${currentType}-prompt`).value.trim(),
        refUrl: currentType === 'image' ? DOM.imageRefUrl.value.trim() : null,
        localImgData: localImageBase64, localImgType: localImageType,
        size: currentType === 'image' ? document.getElementById('image-size').value : 'auto',
        format: currentType === 'image' ? document.getElementById('image-format').value : 'png'
    };
    const payload = adapter.buildPayload(inputs);
    const ep = adapter.getEndpoint ? adapter.getEndpoint(inputs.modelId) : adapter.endpoint;
    let url = route.base.replace(/\/+$/, '');
    ['/chat/completions', '/messages', '/images/generations'].forEach(e => { if (url.endsWith(e)) url = url.slice(0, -e.length); });
    url = url.replace(/\/+$/, '') + ep;
    const headers = { 'Content-Type': 'application/json' };
    headers[route.adapter === 'anthropic' ? 'x-api-key' : 'Authorization'] = route.adapter === 'anthropic' ? '***' : 'Bearer ***';
    lastFullRequest = { url, method: 'POST', headers, body: payload };
    DOM.logQ.value = JSON.stringify(truncateDeep(lastFullRequest), null, 2);
}

async function run() {
    const isT = currentType === 'text', btn = isT ? DOM.btnT : DOM.btnI, spin = document.getElementById(`spinner-${currentType}`);
    let disp; try { disp = JSON.parse(DOM.logQ.value); } catch (e) { return showToast('JSON 格式错误', 'error'); }
    const config = restoreDeep(disp, lastFullRequest), key = DOM.key.value.trim();
    if (!key) return showToast('请输入 API Key', 'error');
    btn.disabled = true; spin.classList.remove('hidden'); setStatus('请求中...', 'bg-blue-100 text-blue-700');
    DOM.logS.value = 'Waiting for response...';
    const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 180000), start = Date.now();
    try {
        const ak = CONFIG.stations[DOM.station.value][currentType].adapter;
        if (ak === 'anthropic' && config.headers['x-api-key'] === '***') config.headers['x-api-key'] = key;
        else if (config.headers['Authorization'] === 'Bearer ***') config.headers['Authorization'] = `Bearer ${key}`;
        const res = await fetch(config.url, { method: 'POST', headers: config.headers, body: JSON.stringify(config.body), signal: ctrl.signal });
        const dur = ((Date.now() - start) / 1000).toFixed(1);
        clearTimeout(tid);
        const ct = res.headers.get("content-type");
        let data;
        if (ct && ct.includes("application/json")) {
            data = await res.json(); lastFullResponse = data;
            DOM.logS.value = `[耗时: ${dur}s]\n` + JSON.stringify(truncateDeep(data), null, 2);
        } else {
            const text = await res.text(); DOM.logS.value = `[耗时: ${dur}s] (非 JSON 响应)\n${text}`;
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
        }
        if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
        const adapter = CONFIG.adapters[currentType][ak];
        if (isT) {
            DOM.res.innerHTML = `<div class="text-sm whitespace-pre-wrap">${adapter.parseResponse(data)}</div>`;
            setStatus('成功', 'bg-green-100 text-green-700');
        } else {
            const r = adapter.parseResponse(data, { format: document.getElementById('image-format').value });
            if (r.status === 'success') {
                DOM.res.innerHTML = `<img src="${r.url}" class="max-w-full rounded shadow border">`;
                setStatus('完成', 'bg-green-100 text-green-700');
            } else throw new Error(r.msg);
        }
    } catch (err) {
        clearTimeout(tid); const dur = ((Date.now() - start) / 1000).toFixed(1);
        let m = err.name === 'AbortError' ? '180s 客户端超时' : err.message;
        DOM.logS.value = `[请求失败 / 第 ${dur}s]\n错误详情: ${m}`;
        DOM.res.innerHTML = `<div class="text-red-500 text-xs font-mono bg-red-50 p-3 rounded">ERR: ${m}</div>`;
        setStatus('失败', 'bg-red-100 text-red-700');
    } finally { btn.disabled = false; spin.classList.add('hidden'); }
}

DOM.dropArea.ondragover = (e) => { e.preventDefault(); DOM.dropArea.classList.add('drop-zone-active'); };
DOM.dropArea.ondragleave = () => { DOM.dropArea.classList.remove('drop-zone-active'); };
DOM.dropArea.ondrop = (e) => { e.preventDefault(); DOM.dropArea.classList.remove('drop-zone-active'); if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]); };
DOM.fileInput.onchange = (e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); };
DOM.btnClearImg.onclick = () => { localImageBase64 = null; localFileRaw = null; DOM.fileInput.value = ''; DOM.imgPreview.src = ''; DOM.imgPreviewBox.classList.add('hidden'); DOM.btnClearImg.classList.add('hidden'); DOM.btnForceUpload.classList.add('hidden'); DOM.imageRefUrl.value = ''; DOM.fileLabel.innerText = '选择图片'; DOM.uploadStatus.classList.add('hidden'); updateLog(); };
DOM.btnForceUpload.onclick = autoCloudUpload;
DOM.station.onchange = () => { const r = CONFIG.stations[DOM.station.value][currentType]; DOM.base.value = r.base; document.getElementById(`${currentType}-model-id`).value = r.defaultModel; updateLog(); };
['text-model-id', 'text-prompt', 'image-model-id', 'image-ref-url', 'image-prompt', 'image-size', 'image-format'].forEach(id => { document.getElementById(id).oninput = updateLog; });
DOM.tabT.onclick = () => { currentType = 'text'; DOM.tabT.className = "flex-1 py-2 text-center border-b-2 border-blue-600 font-bold text-blue-600"; DOM.tabI.className = "flex-1 py-2 text-center border-b-2 border-transparent text-gray-400"; DOM.panelT.classList.remove('hidden'); DOM.panelI.classList.add('hidden'); DOM.station.dispatchEvent(new Event('change')); };
DOM.tabI.onclick = () => { currentType = 'image'; DOM.tabI.className = "flex-1 py-2 text-center border-b-2 border-indigo-600 font-bold text-indigo-600"; DOM.tabT.className = "flex-1 py-2 text-center border-b-2 border-transparent text-gray-400"; DOM.panelI.classList.remove('hidden'); DOM.panelT.classList.add('hidden'); DOM.station.dispatchEvent(new Event('change')); };
DOM.btnT.onclick = run; DOM.btnI.onclick = run;
DOM.station.dispatchEvent(new Event('change'));