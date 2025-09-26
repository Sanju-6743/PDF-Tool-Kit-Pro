/* =========================
   PDF Toolkit Pro — Single file JavaScript
   Modular functions, comments, and UI wiring
   ========================= */

(async function(){
  // Global variables
  const app = document.getElementById('app');
  const overlay = document.getElementById('overlay');
  const loaderText = document.getElementById('loaderText');
  const loaderProgress = document.getElementById('loaderProgress');
  let currentPdfBytes = null;
  let currentPdfDoc = null;
  let currentPdfJsDoc = null;
  let currentScale = 1.0;
  let recentFiles = JSON.parse(localStorage.getItem('pdftk.recent') || '[]');

  // Processing counters
  let totalUploaded = 0;
  let totalProcessed = 0;
  let errorsCount = 0;
  let processingTimes = [];
  let processingStartTime = null;
  let errorNotifications = [];
  let failedItems = [];

  // Update counters display
  function updateCounters() {
    document.getElementById('uploadedCount').textContent = totalUploaded;
    document.getElementById('processedCount').textContent = totalProcessed;
    document.getElementById('errorsCount').textContent = errorsCount;
    const avg = processingTimes.length ? (processingTimes.reduce((a,b)=>a+b,0) / processingTimes.length / 1000).toFixed(1) : 0;
    document.getElementById('avgTime').textContent = avg + 's';
    // Update badge
    const badge = document.getElementById('notificationBadge');
    if(errorNotifications.length > 0){
      badge.textContent = errorNotifications.length;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }

  // New tool variables
  let rotatePdfFile = null;
  let deletePdfFile = null;
  let extractPagesPdfFile = null;
  let pageNumbersPdfFile = null;
  let customTextPdfFile = null;
  let metadataPdfFile = null;
  let passwordPdfFile = null;
  let unlockPdfFile = null;
  let pdfToImagesPdfFile = null;
  let extractImagesPdfFile = null;
  let ocrFile = null;
  let signaturePdfFile = null;
  let searchPdfFile = null;
  let splitFiles = [];
  let annotatePdfFile = null;
  let annotatePdfDoc = null;
  let currentAnnotatePage = 1;
  let annotations = [];
  let currentTool = null;
  let isDrawing = false;
  let startX, startY;

  // Shapes tool variables
  let shapesPdfFile = null;
  let shapesPdfDoc = null;
  let currentShapesPage = 1;
  let shapes = [];
  let currentShapeTool = null;
  let isDrawingShape = false;
  let shapeStartX, shapeStartY;

  // Fill Forms variables
  let fillFormsPdfFile = null;
  let fillFormsPdfDoc = null;
  let formFieldsData = [];

  // Extract Images variables
  let extractImagesPdfDoc = null;
  let extractedImages = [];

  // Chatbot variables
  let chatbotFile = null;
  let chatMessages = [];
  let currentSummary = '';

  // Popup system
  let popupQueue = [];

  // PDF.js worker config (CDN worker)
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  // Helpers: overlay + progress
  function showOverlay(message='Working...', progress='') {
    loaderText.textContent = message;
    loaderProgress.textContent = progress || '';
    overlay.classList.add('show');
  }
  function hideOverlay() { overlay.classList.remove('show'); loaderProgress.textContent=''; }

  // Utility: show success/warn
  function toastSuccess(msg){ Swal.fire({toast:true,position:'top-end',icon:'success',title:msg,showConfirmButton:false,timer:1800}) }
  function toastError(msg){ Swal.fire({toast:true,position:'top-end',icon:'error',title:msg,showConfirmButton:false,timer:2500}) }
  function confirmDialog(title,text){ return Swal.fire({title, text, icon:'question', showCancelButton:true}).then(r=>r.isConfirmed) }

  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  themeToggle.addEventListener('click',()=>{
    const el = document.body;
    const cur = el.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = cur==='dark' ? 'light' : 'dark';
    el.setAttribute('data-theme', next);
    themeToggle.querySelector('label').textContent = next==='dark' ? 'Dark' : 'Light';
    themeToggle.querySelector('i').className = next==='dark' ? 'fa-regular fa-moon' : 'fa-regular fa-sun';
  });

  // Notifications button
  document.getElementById('notificationsBtn').addEventListener('click', ()=> {
    if(errorNotifications.length === 0){
      Swal.fire('No errors','No errors have occurred yet.','info');
      return;
    }
    const html = errorNotifications.map(e => `<div style="text-align:left; margin-bottom:8px; padding:8px; border:1px solid #ccc; border-radius:4px;"><strong>${e.fileName}</strong>${e.pageNumber ? ` (Page ${e.pageNumber})` : ''}: ${e.errorMessage}</div>`).join('');
    Swal.fire({
      title: 'Error Notifications',
      html: html,
      width: 600,
      confirmButtonText: 'Close'
    });
  });

  // Sidebar tool switching
  document.getElementById('toolNav').addEventListener('click', (ev)=>{
    const btn = ev.target.closest('button');
    if(!btn) return;
    document.querySelectorAll('#toolNav button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tool = btn.dataset.tool;
    document.querySelectorAll('.tool').forEach(t=>t.classList.remove('active'));
    document.getElementById(tool).classList.add('active');

    anime({
      targets: '#app .content',
      translateY: [-8,0],
      opacity: [0.6,1],
      duration: 380,
      easing: 'easeOutQuad'
    });
  });

  // Quick upload and global file input
  const globalInput = document.getElementById('globalFileInput');
  document.getElementById('quickUpload').addEventListener('click', ()=> globalInput.click());
  document.getElementById('fileInputLabel').addEventListener('click', ()=> globalInput.click());
  globalInput.addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if(files.length===0) return;
    totalUploaded += files.length;
    updateCounters();
    // If single pdf, open in viewer
    const pdfFile = files.find(f => f.type==='application/pdf');
    if(pdfFile){
      await openInViewer(pdfFile);
      toastSuccess('PDF loaded to Viewer');
    } else {
      Swal.fire('Uploaded', `${files.length} file(s) added`, 'success');
    }
    // store in recent
    storeRecentFiles(files);
  });

  // Drag & drop (global)
  const dropAreaBtn = document.getElementById('dropAreaBtn');
  const viewerDrop = document.getElementById('viewerDrop');
  ['dragenter','dragover'].forEach(e => {
    viewerDrop.addEventListener(e, (ev)=>{ ev.preventDefault(); viewerDrop.style.borderColor='var(--accent)'; });
  });
  ['dragleave','drop'].forEach(e => {
    viewerDrop.addEventListener(e, (ev)=>{ ev.preventDefault(); viewerDrop.style.borderColor=''; });
  });
  viewerDrop.addEventListener('drop', async (ev)=>{
    const f = ev.dataTransfer.files[0];
    if(!f) return;
    if(f.type==='application/pdf') await openInViewer(f);
    else Swal.fire('Unsupported', 'Please drop a PDF file', 'warning');
  });

  // ---------- Viewer Implementation ----------
  const canvas = document.getElementById('pdf-canvas');
  const ctx = canvas.getContext('2d');
  const thumbsBox = document.getElementById('thumbs');

  document.getElementById('viewerOpenBtn').addEventListener('click', ()=> document.getElementById('globalFileInput').click());
  document.getElementById('zoomInBtn').addEventListener('click', ()=> setScale(currentScale + 0.1));
  document.getElementById('zoomOutBtn').addEventListener('click', ()=> setScale(Math.max(0.2, currentScale - 0.1)));
  document.getElementById('zoomRange').addEventListener('input', (e)=> setScale(e.target.value/100));

  document.getElementById('renderAllBtn').addEventListener('click', ()=> renderThumbnails());

  async function openInViewer(file){
    try{
      showOverlay('Loading PDF...');
      const arrayBuffer = await file.arrayBuffer();
      currentPdfBytes = new Uint8Array(arrayBuffer);
      currentPdfJsDoc = await pdfjsLib.getDocument({data: currentPdfBytes}).promise;
      const page = await currentPdfJsDoc.getPage(1);
      await renderPageToCanvas(page, canvas, 1.0);
      hideOverlay();
      // generate small thumbs for pages 1..min(8,nPages)
      renderThumbsPreview( Math.min(8, currentPdfJsDoc.numPages) );
      // save recent
      storeRecentFiles([file]);
    } catch(err){
      hideOverlay();
      console.error(err);
      Swal.fire('Error','Could not load PDF: '+err.message,'error');
    }
  }

  function setScale(scale){
    currentScale = scale;
    document.getElementById('zoomRange').value = Math.round(scale*100);
    if(currentPdfJsDoc) {
      currentPdfJsDoc.getPage(1).then(page => renderPageToCanvas(page, canvas, currentScale));
    }
  }

  async function renderPageToCanvas(page, canvasEl, scale){
    const viewport = page.getViewport({scale});
    canvasEl.width = Math.floor(viewport.width);
    canvasEl.height = Math.floor(viewport.height);
    const renderContext = {
      canvasContext: canvasEl.getContext('2d'),
      viewport
    };
    await page.render(renderContext).promise;
  }

  async function renderThumbsPreview(count){
    thumbsBox.innerHTML='';
    for(let i=1;i<=count;i++){
      const page = await currentPdfJsDoc.getPage(i);
      const canvasThumb = document.createElement('canvas');
      canvasThumb.width = 200; canvasThumb.height = 280;
      await renderPageToCanvas(page, canvasThumb, 0.6);
      canvasThumb.addEventListener('click', ()=> {
        renderPageToCanvas(page, canvas, currentScale);
      });
      thumbsBox.appendChild(canvasThumb);
    }
  }

  async function renderThumbnails(){
    if(!currentPdfJsDoc) { Swal.fire('No PDF','Open a PDF first.','info'); return; }
    showOverlay('Rendering thumbnails...', 'This may take a moment.');
    thumbsBox.innerHTML='';
    for(let i=1;i<=currentPdfJsDoc.numPages;i++){
      loaderProgress.textContent = `Rendering page ${i} / ${currentPdfJsDoc.numPages}`;
      const page = await currentPdfJsDoc.getPage(i);
      const c = document.createElement('canvas');
      c.width = 160; c.height = 220;
      await renderPageToCanvas(page, c, 0.5);
      thumbsBox.appendChild(c);
      await new Promise(r=>setTimeout(r,50)); // allow UI updates
    }
    hideOverlay();
  }

  // ---------- Extract Text ----------
  const extractDrop = document.getElementById('extractDrop');
  const extractedText = document.getElementById('extractedText');
  document.getElementById('extractOpenBtn').addEventListener('click', ()=> document.getElementById('globalFileInput').click());
  document.getElementById('extractRunBtn').addEventListener('click', ()=> {
    if(!currentPdfJsDoc) Swal.fire('No PDF','Open a PDF in Viewer first (or upload here).','info');
    else extractTextFromPdf(currentPdfJsDoc);
  });
  document.getElementById('downloadTxtBtn').addEventListener('click', ()=>{
    const txt = extractedText.value || '';
    if(!txt) { toastError('No text to download'); return; }
    const blob = new Blob([txt], {type:'text/plain;charset=utf-8'});
    saveAs(blob, 'extracted.txt');
    toastSuccess('Downloaded extracted text');
  });

  extractDrop.addEventListener('drop', async (ev)=>{
    ev.preventDefault();
    const f = ev.dataTransfer.files[0];
    if(!f) return;
    const sb = await f.arrayBuffer();
    currentPdfJsDoc = await pdfjsLib.getDocument({data: sb}).promise;
    Swal.fire('Loaded','PDF loaded for text extraction','success');
    storeRecentFiles([f]);
  });

  async function extractTextFromPdf(pdfjsDoc){
    try{
      showOverlay('Extracting text...', '');
      let full = '';
      for(let i=1;i<=pdfjsDoc.numPages;i++){
        loaderProgress.textContent = `Page ${i} / ${pdfjsDoc.numPages}`;
        const page = await pdfjsDoc.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(it => it.str);
        full += strings.join(' ') + '\n\n';
        await new Promise(r=>setTimeout(r,10));
      }
      extractedText.value = full;
      hideOverlay();
      toastSuccess('Text extracted');
    } catch(err){
      hideOverlay();
      toastError('Extraction failed: '+err.message);
    }
  }

  // ---------- Merge PDFs ----------
  const mergeInput = document.getElementById('mergeInput');
  const mergeList = document.getElementById('mergeList');
  let mergeFiles = [];
  document.getElementById('mergeChoose').addEventListener('click', ()=> mergeInput.click());
  mergeInput.addEventListener('change', (e)=> {
    mergeFiles = [...e.target.files];
    totalUploaded += mergeFiles.length;
    updateCounters();
    renderMergeList();
  });
  document.getElementById('mergeRun').addEventListener('click', ()=> mergePdfs());
  document.getElementById('downloadFailedZip').addEventListener('click', async ()=> {
    if(failedItems.length === 0) return;
    try{
      showOverlay('Creating ZIP...');
      const zip = new JSZip();
      failedItems.forEach(item => {
        zip.file(item.name, item.blob);
      });
      const content = await zip.generateAsync({type: 'blob'});
      saveAs(content, 'failed_items.zip');
      hideOverlay();
      toastSuccess('Failed items ZIP downloaded');
    } catch(err){
      hideOverlay();
      toastError('ZIP creation failed: '+err.message);
    }
  });
  document.getElementById('mergeUp').addEventListener('click', ()=> moveSelectedInMerge(-1));
  document.getElementById('mergeDown').addEventListener('click', ()=> moveSelectedInMerge(1));
  document.getElementById('mergeRemove').addEventListener('click', ()=> removeSelectedInMerge());

  function renderMergeList(){
    mergeList.innerHTML = '';
    if(mergeFiles.length===0){ mergeList.textContent='No files selected. Drag PDFs here or click Choose.'; return; }
    const ul = document.createElement('div');
    ul.style.display='flex'; ul.style.flexDirection='column'; ul.style.gap='8px';
    mergeFiles.forEach((f, idx) => {
      const el = document.createElement('div');
      el.style.display='flex'; el.style.justifyContent='space-between'; el.style.alignItems='center';
      el.style.padding='8px'; el.style.borderRadius='8px'; el.style.background='var(--glass)';
      el.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><input type="radio" name="mergeSel" ${idx===0 ? 'checked' : ''}><div style="font-weight:600">${f.name}</div><div class="muted" style="font-size:12px">${(f.size/1024/1024).toFixed(2)} MB</div></div><div>${idx+1}</div>`;
      ul.appendChild(el);
    });
    mergeList.appendChild(ul);
  }

  function getSelectedMergeIndex(){
    const radios = mergeList.querySelectorAll('input[name="mergeSel"]');
    for(let i=0;i<radios.length;i++) if(radios[i].checked) return i;
    return 0;
  }
  function moveSelectedInMerge(dir){
    const idx = getSelectedMergeIndex();
    const newIdx = idx + dir;
    if(newIdx<0 || newIdx>=mergeFiles.length) return;
    const item = mergeFiles.splice(idx,1)[0];
    mergeFiles.splice(newIdx,0,item);
    renderMergeList();
  }
  function removeSelectedInMerge(){
    const idx = getSelectedMergeIndex();
    mergeFiles.splice(idx,1);
    renderMergeList();
  }

  async function mergePdfs(){
    if(mergeFiles.length<2) { Swal.fire('Need at least 2 PDFs','Choose two or more PDFs to merge.','warning'); return; }
    try{
      showOverlay('Merging PDFs...');
      const mergedPdf = await PDFLib.PDFDocument.create();
      failedItems = [];
      for(let i=0;i<mergeFiles.length;i++){
        loaderProgress.textContent = `Processing ${i+1}/${mergeFiles.length}: ${mergeFiles[i].name}`;
        try{
          const arr = await mergeFiles[i].arrayBuffer();
          const donor = await PDFLib.PDFDocument.load(arr);
          const pageIndices = donor.getPageIndices();
          for(let j=0; j<pageIndices.length; j++){
            try{
              const copied = await mergedPdf.copyPages(donor, [pageIndices[j]]);
              copied.forEach(p => mergedPdf.addPage(p));
            } catch(pageErr){
              errorsCount++;
              errorNotifications.push({fileName: mergeFiles[i].name, pageNumber: j+1, errorMessage: pageErr.message});
              // Create single page PDF for failed page
              const singlePdf = await PDFLib.PDFDocument.create();
              const copiedPage = await singlePdf.copyPages(donor, [pageIndices[j]]);
              copiedPage.forEach(p => singlePdf.addPage(p));
              const bytes = await singlePdf.save();
              failedItems.push({name: `${mergeFiles[i].name}_page_${j+1}.pdf`, blob: new Blob([bytes], {type:'application/pdf'})});
              updateCounters();
            }
          }
          totalProcessed++; // per file loaded successfully
        } catch(fileErr){
          errorsCount++;
          errorNotifications.push({fileName: mergeFiles[i].name, errorMessage: fileErr.message});
          updateCounters();
        }
        await new Promise(r=>setTimeout(r,20));
      }
      if(mergedPdf.getPageCount() > 0){
        const out = await mergedPdf.save();
        saveAs(new Blob([out],{type:'application/pdf'}), 'merged.pdf');
        toastSuccess('Merged PDF saved');
      } else {
        toastError('No pages could be merged');
      }
      if(failedItems.length > 0){
        document.getElementById('downloadFailedZip').style.display = 'inline-block';
      }
      hideOverlay();
    } catch(err){
      hideOverlay(); toastError('Merge failed: '+err.message);
    }
  }

  // ---------- Split PDF ----------
  const splitInput = document.getElementById('splitInput');
  const splitThumbs = document.getElementById('splitThumbs');
  let splitFile = null;
  document.getElementById('splitChoose').addEventListener('click', ()=> splitInput.click());
  splitInput.addEventListener('change', async (e)=>{
    splitFile = e.target.files[0];
    await prepareSplitFile(splitFile);
  });
  document.getElementById('splitRun').addEventListener('click', ()=> splitPdfToPages());
  document.getElementById('splitZipBtn').addEventListener('click', ()=> downloadAllSplitAsZip());

  document.getElementById('splitDrop').addEventListener('drop', async (ev)=> {
    ev.preventDefault();
    const f = ev.dataTransfer.files[0];
    if(f) { splitFile = f; await prepareSplitFile(f); }
  });

  async function prepareSplitFile(file){
    try{
      showOverlay('Loading PDF for split...');
      splitFiles = []; // Reset
      const arr = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(arr);
      splitDoc = pdf;
      splitThumbs.innerHTML='';
      const pages = pdf.getPageCount();
      // Load PDF.js document once outside the loop
      const pdfJsDoc = await pdfjsLib.getDocument({data:arr}).promise;
      for(let i=0;i<pages;i++){
        const single = await PDFLib.PDFDocument.create();
        const [copied] = await single.copyPages(pdf, [i]);
        single.addPage(copied);
        const bytes = await single.save();
        const filename = `Split_Page_${i+1}.pdf`;
        splitFiles.push({filename, bytes});
        // render thumbnail from original via pdf.js for better visuals
        const pageJs = await pdfJsDoc.getPage(i+1);
        const c = document.createElement('canvas'); c.width=160; c.height=220;
        await renderPageToCanvas(pageJs, c, 0.6);
        const card = document.createElement('div'); card.className='page-card';
        card.appendChild(c);
        const btn = document.createElement('button'); btn.className='btn small'; btn.textContent='Download'; btn.style.marginTop='6px';
        btn.addEventListener('click', ()=> saveAs(new Blob([bytes],{type:'application/pdf'}), filename));
        card.appendChild(btn);
        splitThumbs.appendChild(card);
        await new Promise(r=>setTimeout(r,10));
      }
      document.getElementById('splitZipBtn').style.display = 'inline-block';
      hideOverlay();
      toastSuccess('Split ready — click Download on pages or Download All as ZIP');
    } catch(err){ hideOverlay(); toastError('Split failed: '+err.message); }
  }

  async function splitPdfToPages(){
    if(!splitFile) { Swal.fire('No file','Upload a PDF to split first.','info'); return; }
    // Already prepared in thumbnails; offer zip-like multiple download not implemented — instead offer single-by-one or packaged output.
    Swal.fire('Split ready','Use the Download buttons on each page thumbnail to save individually.','info');
  }

  // ---------- Create PDF from Text ----------
  document.getElementById('textSampleBtn').addEventListener('click', ()=> {
    document.getElementById('textToPdf').value = `PDF Toolkit Pro\n\nThis is a sample document generated from text.\n\n- Bullet 1\n- Bullet 2\n\nGenerated on ${new Date().toLocaleString()}`;
    toastSuccess('Sample inserted');
  });

  document.getElementById('createTextPdf').addEventListener('click', async ()=>{
    const content = document.getElementById('textToPdf').value.trim();
    if(!content) { toastError('Enter some text first'); return; }
    showOverlay('Generating PDF from text...');
    try{
      const doc = await PDFLib.PDFDocument.create();
      const page = doc.addPage([595.28, 841.89]); // A4
      const timesRomanFont = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      const fontSize = Number(document.getElementById('textPdfSize').value) || 12;
      const title = document.getElementById('textPdfTitle').value || '';
      let y = 800;
      if(title){
        page.drawText(title, {x:48, y:y, size:18, font:timesRomanFont, color:PDFLib.rgb(0,0,0)});
        y -= 30;
      }
      const lines = wrapText(content, 80);
      for(const line of lines){
        if(y < 48){ // new page
          y = 800;
          page = doc.addPage([595.28, 841.89]);
        }
        page.drawText(line, {x:48, y:y, size:fontSize, font:timesRomanFont, color:PDFLib.rgb(0,0,0)});
        y -= fontSize + 6;
      }
      const bytes = await doc.save();
      saveAs(new Blob([bytes],{type:'application/pdf'}), (title || 'document') + '.pdf');
      hideOverlay(); toastSuccess('PDF created');
    } catch(err){
      hideOverlay(); toastError('Creation failed: '+err.message);
    }
  });

  // naive word-wrap by char length
  function wrapText(text, width){
    const words = text.split(' ');
    const lines = []; let cur = '';
    for(const w of words){
      if((cur+w).length > width){ lines.push(cur); cur = w + ' '; }
      else cur += w + ' ';
    }
    if(cur) lines.push(cur);
    return lines;
  }

  // ---------- Images to PDF ----------
  const imagesInput = document.getElementById('imagesInput');
  const imagesArea = document.getElementById('imagesArea');
  const imagesGrid = document.getElementById('imagesGrid');
  let imagesList = [];
  document.getElementById('imagesChoose').addEventListener('click', ()=> imagesInput.click());
  imagesInput.addEventListener('change', (e)=> handleImages([...e.target.files]));
  imagesArea.addEventListener('drop', (ev)=> { ev.preventDefault(); handleImages([...ev.dataTransfer.files]); });
  imagesArea.addEventListener('dragover', (e)=> e.preventDefault());
  document.getElementById('imagesCreate').addEventListener('click', ()=> createPdfFromImages());

  function handleImages(files){
    const imgFiles = files.filter(f=>f.type.startsWith('image/'));
    for(const f of imgFiles) imagesList.push(f);
    renderImagesGrid();
  }

  function renderImagesGrid(){
    imagesGrid.innerHTML='';
    imagesList.forEach((img, idx)=>{
      const card = document.createElement('div'); card.className='page-card';
      const iEl = document.createElement('img'); iEl.style.width='100%'; iEl.style.height='100px'; iEl.style.objectFit='cover';
      const reader = new FileReader();
      reader.onload = (ev)=> iEl.src = ev.target.result;
      reader.readAsDataURL(img);
      card.appendChild(iEl);
      const controls = document.createElement('div'); controls.style.display='flex'; controls.style.gap='6px'; controls.style.marginTop='6px';
      const up = document.createElement('button'); up.className='btn small'; up.innerHTML='<i class="fa-solid fa-arrow-up"></i>'; up.onclick = ()=> { if(idx>0){ [imagesList[idx-1], imagesList[idx]]=[imagesList[idx], imagesList[idx-1]]; renderImagesGrid(); } };
      const down = document.createElement('button'); down.className='btn small'; down.innerHTML='<i class="fa-solid fa-arrow-down"></i>'; down.onclick = ()=> { if(idx<imagesList.length-1){ [imagesList[idx+1], imagesList[idx]]=[imagesList[idx], imagesList[idx+1]]; renderImagesGrid(); } };
      const rem = document.createElement('button'); rem.className='btn small'; rem.innerHTML='<i class="fa-solid fa-trash"></i>'; rem.onclick = ()=> { imagesList.splice(idx,1); renderImagesGrid(); };
      controls.appendChild(up); controls.appendChild(down); controls.appendChild(rem);
      card.appendChild(controls);
      imagesGrid.appendChild(card);
    });
  }

  async function createPdfFromImages(){
    if(imagesList.length===0){ toastError('Add images first'); return; }
    try{
      showOverlay('Creating PDF from images...');
      const doc = await PDFLib.PDFDocument.create();
      for(let i=0;i<imagesList.length;i++){
        loaderProgress.textContent = `Processing image ${i+1}/${imagesList.length}`;
        const arr = await imagesList[i].arrayBuffer();
        const mime = imagesList[i].type;
        let img;
        if(mime.includes('png')) img = await doc.embedPng(arr);
        else img = await doc.embedJpg(arr);
        const page = doc.addPage([img.width, img.height]);
        page.drawImage(img, {x:0, y:0, width: img.width, height: img.height});
        await new Promise(r=>setTimeout(r,10));
      }
      const bytes = await doc.save();
      saveAs(new Blob([bytes],{type:'application/pdf'}), 'images.pdf');
      hideOverlay(); toastSuccess('PDF created from images');
    } catch(err){ hideOverlay(); toastError('Creation from images failed: '+err.message); }
  }

  // ---------- Watermark ----------
  const wmInput = document.getElementById('wmInput');
  document.getElementById('wmChoose').addEventListener('click', ()=> wmInput.click());
  wmInput.addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { currentPdfBytes = new Uint8Array(await f.arrayBuffer()); Swal.fire('Loaded','PDF loaded for watermark','success'); }
  });
  document.getElementById('wmRun').addEventListener('click', ()=> addWatermark());
  document.getElementById('wmDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ currentPdfBytes = new Uint8Array(await f.arrayBuffer()); Swal.fire('Loaded','PDF loaded for watermark','success'); } });

  async function addWatermark(){
    if(!currentPdfBytes) { Swal.fire('No PDF','Upload a PDF first','info'); return; }
    const text = document.getElementById('wmText').value || 'PDF TOOLKIT PRO';
    const size = Number(document.getElementById('wmSize').value) || 48;
    const opacity = Number(document.getElementById('wmOpacity').value) || 0.25;
    try{
      showOverlay('Adding watermark...');
      const pdfDoc = await PDFLib.PDFDocument.load(currentPdfBytes);
      const helv = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      for(let i=0;i<pages.length;i++){
        loaderProgress.textContent = `Watermarking page ${i+1}/${pages.length}`;
        const p = pages[i];
        const {width, height} = p.getSize();
        p.drawText(text, {
          x: width/10,
          y: height/2,
          size,
          font: helv,
          color: PDFLib.rgb(0.5,0.5,0.5),
          rotate: PDFLib.degrees(-35),
          opacity
        });
        await new Promise(r=>setTimeout(r,5));
      }
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'watermarked.pdf');
      hideOverlay(); toastSuccess('Watermark added');
    } catch(err){ hideOverlay(); toastError('Watermarking failed: '+err.message); }
  }

  // ---------- Reorder Pages ----------
  const reorderInput = document.getElementById('reorderInput');
  const reorderGrid = document.getElementById('reorderGrid');
  document.getElementById('reorderChoose').addEventListener('click', ()=> reorderInput.click());
  reorderInput.addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) await loadReorderFile(f);
  });
  document.getElementById('reorderRun').addEventListener('click', ()=> exportReorderedPdf());
  document.getElementById('reorderDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f) await loadReorderFile(f); });

  let reorderPdfBytes = null;
  let reorderPageOrder = [];

  async function loadReorderFile(file){
    try{
      showOverlay('Preparing pages for reorder...');
      reorderPdfBytes = await file.arrayBuffer();
      const pdfjsDoc = await pdfjsLib.getDocument({data: reorderPdfBytes}).promise;
      reorderGrid.innerHTML='';
      reorderPageOrder = [];
      for(let i=1;i<=pdfjsDoc.numPages;i++){
        loaderProgress.textContent = `Page ${i}/${pdfjsDoc.numPages}`;
        const page = await pdfjsDoc.getPage(i);
        const c = document.createElement('canvas'); c.width=140; c.height=200;
        await renderPageToCanvas(page, c, 0.55);
        const card = document.createElement('div'); card.className='page-card';
        card.appendChild(c);
        card.dataset.index = i-1;
        card.draggable = true;
        card.addEventListener('dragstart', (ev)=> { ev.dataTransfer.setData('text/plain', card.dataset.index); ev.currentTarget.style.opacity='0.6'; });
        card.addEventListener('dragend', (ev)=> ev.currentTarget.style.opacity='1');
        card.addEventListener('dragover', (ev)=> ev.preventDefault());
        card.addEventListener('drop', (ev)=> {
          ev.preventDefault();
          const from = Number(ev.dataTransfer.getData('text/plain'));
          const to = Number(card.dataset.index);
          // reorder DOM elements and dataset indexes
          const nodes = Array.from(reorderGrid.children);
          const nodeFrom = nodes.find(n => Number(n.dataset.index) === from);
          const nodeTo = nodes.find(n => Number(n.dataset.index) === to);
          reorderGrid.insertBefore(nodeFrom, nodeTo);
          // rebuild indexes
          const updated = Array.from(reorderGrid.children);
          updated.forEach((n,idx) => n.dataset.index = idx);
        });
        reorderGrid.appendChild(card);
        reorderPageOrder.push(i-1);
      }
      hideOverlay();
      toastSuccess('Pages ready — drag to reorder');
    } catch(err){ hideOverlay(); toastError('Prepare reorder failed: '+err.message); }
  }

  async function exportReorderedPdf(){
    if(!reorderPdfBytes) { Swal.fire('No PDF','Upload a PDF to reorder','info'); return; }
    try{
      showOverlay('Generating reordered PDF...');
      const original = await PDFLib.PDFDocument.load(reorderPdfBytes);
      const outDoc = await PDFLib.PDFDocument.create();
      // get current order from DOM
      const order = Array.from(reorderGrid.children).map(n => Number(n.dataset.index));
      // But note: dataset indexes reflect positions; we need to map original pages according to original order, so we'll get original pages in order
      const indices = order; // they represent new order positions
      const copied = await outDoc.copyPages(original, indices);
      copied.forEach(p => outDoc.addPage(p));
      const out = await outDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'reordered.pdf');
      hideOverlay(); toastSuccess('Reordered PDF saved');
    } catch(err){ hideOverlay(); toastError('Reorder failed: '+err.message); }
  }

  // ---------- Compress PDF (basic) ----------
  const compressInput = document.getElementById('compressInput');
  document.getElementById('compressChoose').addEventListener('click', ()=> compressInput.click());
  compressInput.addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { compressPdfFile = f; Swal.fire('Loaded','PDF loaded for compression','success'); }
  });
  document.getElementById('compressRun').addEventListener('click', ()=> compressPdf());
  document.getElementById('compressScale').addEventListener('input', (e)=> document.getElementById('compressVal').textContent = e.target.value);

  let compressPdfFile = null;

  // ---------- Rotate Pages ----------
  document.getElementById('rotateChoose').addEventListener('click', ()=> document.getElementById('rotateInput').click());
  document.getElementById('rotateInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { rotatePdfFile = f; Swal.fire('Loaded','PDF loaded for rotation','success'); }
  });
  document.getElementById('rotateRun').addEventListener('click', ()=> rotatePages());
  document.getElementById('rotateDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ rotatePdfFile = f; Swal.fire('Loaded','PDF loaded for rotation','success'); } });

  // ---------- Delete Pages ----------
  document.getElementById('deleteChoose').addEventListener('click', ()=> document.getElementById('deleteInput').click());
  document.getElementById('deleteInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { deletePdfFile = f; Swal.fire('Loaded','PDF loaded for page deletion','success'); }
  });
  document.getElementById('deleteRun').addEventListener('click', ()=> deletePages());
  document.getElementById('deleteDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ deletePdfFile = f; Swal.fire('Loaded','PDF loaded for page deletion','success'); } });

  // ---------- Extract Pages ----------
  document.getElementById('extractPagesChoose').addEventListener('click', ()=> document.getElementById('extractPagesInput').click());
  document.getElementById('extractPagesInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { extractPagesPdfFile = f; Swal.fire('Loaded','PDF loaded for page extraction','success'); }
  });
  document.getElementById('extractPagesRun').addEventListener('click', ()=> extractPages());
  document.getElementById('extractPagesDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ extractPagesPdfFile = f; Swal.fire('Loaded','PDF loaded for page extraction','success'); } });

  // ---------- Add Page Numbers ----------
  document.getElementById('pageNumbersChoose').addEventListener('click', ()=> document.getElementById('pageNumbersInput').click());
  document.getElementById('pageNumbersInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { pageNumbersPdfFile = f; Swal.fire('Loaded','PDF loaded for page numbering','success'); }
  });
  document.getElementById('pageNumbersRun').addEventListener('click', ()=> addPageNumbers());
  document.getElementById('pageNumbersDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ pageNumbersPdfFile = f; Swal.fire('Loaded','PDF loaded for page numbering','success'); } });

  // ---------- Add Custom Text ----------
  document.getElementById('customTextChoose').addEventListener('click', ()=> document.getElementById('customTextInput').click());
  document.getElementById('customTextInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { customTextPdfFile = f; Swal.fire('Loaded','PDF loaded for custom text','success'); }
  });
  document.getElementById('customTextRun').addEventListener('click', ()=> addCustomText());
  document.getElementById('customTextDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ customTextPdfFile = f; Swal.fire('Loaded','PDF loaded for custom text','success'); } });

  // ---------- Edit Metadata ----------
  document.getElementById('metadataChoose').addEventListener('click', ()=> document.getElementById('metadataInput').click());
  document.getElementById('metadataInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { metadataPdfFile = f; Swal.fire('Loaded','PDF loaded for metadata editing','success'); }
  });
  document.getElementById('metadataRun').addEventListener('click', ()=> updateMetadata());
  document.getElementById('metadataDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ metadataPdfFile = f; Swal.fire('Loaded','PDF loaded for metadata editing','success'); } });

  // ---------- Password Protect ----------
  document.getElementById('passwordChoose').addEventListener('click', ()=> document.getElementById('passwordInput').click());
  document.getElementById('passwordInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { passwordPdfFile = f; Swal.fire('Loaded','PDF loaded for password protection','success'); }
  });
  document.getElementById('passwordRun').addEventListener('click', ()=> addPassword());
  document.getElementById('passwordDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ passwordPdfFile = f; Swal.fire('Loaded','PDF loaded for password protection','success'); } });

  // ---------- Unlock PDF ----------
  document.getElementById('unlockChoose').addEventListener('click', ()=> document.getElementById('unlockInput').click());
  document.getElementById('unlockInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { unlockPdfFile = f; Swal.fire('Loaded','PDF loaded for unlocking','success'); }
  });
  document.getElementById('unlockRun').addEventListener('click', ()=> unlockPdf());
  document.getElementById('unlockDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ unlockPdfFile = f; Swal.fire('Loaded','PDF loaded for unlocking','success'); } });

  // ---------- PDF to Images ----------
  document.getElementById('pdfToImagesChoose').addEventListener('click', ()=> document.getElementById('pdfToImagesInput').click());
  document.getElementById('pdfToImagesInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { pdfToImagesPdfFile = f; Swal.fire('Loaded','PDF loaded for image conversion','success'); }
  });
  document.getElementById('pdfToImagesRun').addEventListener('click', ()=> convertPdfToImages());
  document.getElementById('pdfToImagesDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ pdfToImagesPdfFile = f; Swal.fire('Loaded','PDF loaded for image conversion','success'); } });

  // ---------- OCR ----------
  document.getElementById('ocrChoose').addEventListener('click', ()=> document.getElementById('ocrInput').click());
  document.getElementById('ocrInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { ocrFile = f; Swal.fire('Loaded','File loaded for OCR','success'); }
  });
  document.getElementById('ocrRun').addEventListener('click', ()=> runOcr());
  document.getElementById('ocrDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ ocrFile = f; Swal.fire('Loaded','File loaded for OCR','success'); } });

  // ---------- Add Signature ----------
  document.getElementById('signatureChoose').addEventListener('click', ()=> document.getElementById('signatureInput').click());
  document.getElementById('signatureInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { signaturePdfFile = f; Swal.fire('Loaded','PDF loaded for signing','success'); }
  });
  document.getElementById('signatureRun').addEventListener('click', ()=> addSignature());
  document.getElementById('signatureDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ signaturePdfFile = f; Swal.fire('Loaded','PDF loaded for signing','success'); } });

  // ---------- Search PDF ----------
  document.getElementById('searchChoose').addEventListener('click', ()=> document.getElementById('searchInput').click());
  document.getElementById('searchInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { searchPdfFile = f; Swal.fire('Loaded','PDF loaded for search','success'); }
  });
  document.getElementById('searchRun').addEventListener('click', ()=> searchPdf());
  document.getElementById('searchDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ searchPdfFile = f; Swal.fire('Loaded','PDF loaded for search','success'); } });

  // ---------- AI Chatbot ----------
  document.getElementById('chatbotUploadBtn').addEventListener('click', ()=> document.getElementById('chatbotFileInput').click());
  document.getElementById('chatbotFileInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) await loadChatbotFile(f);
  });
  document.getElementById('chatbotDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f) await loadChatbotFile(f); });
  document.getElementById('sendBtn').addEventListener('click', ()=> sendMessage());
  document.getElementById('chatInput').addEventListener('keypress', (e)=> { if(e.key === 'Enter') sendMessage(); });
  document.getElementById('chatbotDownloadBtn').addEventListener('click', ()=> downloadSummary());

  // ---------- Annotate PDF ----------
  document.getElementById('annotateChoose').addEventListener('click', ()=> document.getElementById('annotateInput').click());
  document.getElementById('annotateInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { annotatePdfFile = f; await loadAnnotatePdf(f); }
  });
  document.getElementById('annotateRun').addEventListener('click', ()=> exportAnnotatedPdf());
  document.getElementById('annotateDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ annotatePdfFile = f; await loadAnnotatePdf(f); } });
  document.getElementById('annotatePageSelect').addEventListener('change', (e)=> {
    currentAnnotatePage = Number(e.target.value);
    renderAnnotatePage();
  });
  document.getElementById('highlightBtn').addEventListener('click', ()=> setTool('highlight'));
  document.getElementById('underlineBtn').addEventListener('click', ()=> setTool('underline'));
  document.getElementById('noteBtn').addEventListener('click', ()=> setTool('note'));
  document.getElementById('penBtn').addEventListener('click', ()=> setTool('pen'));
  document.getElementById('eraserBtn').addEventListener('click', ()=> setTool('eraser'));
  document.getElementById('clearBtn').addEventListener('click', ()=> { annotations = []; renderAnnotations(); });

  const annotateCanvas = document.getElementById('annotateCanvas');
  annotateCanvas.addEventListener('mousedown', (e)=> {
    if(!currentTool) return;
    isDrawing = true;
    const rect = annotateCanvas.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    if(currentTool === 'note'){
      const text = prompt('Enter note text:');
      if(text){
        annotations.push({type: 'note', x: startX, y: startY, text, page: currentAnnotatePage});
        renderAnnotations();
      }
      isDrawing = false;
    } else if(currentTool === 'pen'){
      annotations.push({type: 'path', points: [{x: startX, y: startY}], page: currentAnnotatePage, color: 'black', lineWidth: 2});
    }
  });
  annotateCanvas.addEventListener('mousemove', (e)=> {
    if(!isDrawing || !currentTool) return;
    const rect = annotateCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if(currentTool === 'pen'){
      const last = annotations[annotations.length-1];
      last.points.push({x, y});
      renderAnnotations();
    }
  });
  annotateCanvas.addEventListener('mouseup', (e)=> {
    if(!isDrawing || !currentTool) return;
    const rect = annotateCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if(currentTool === 'highlight' || currentTool === 'underline'){
      const w = x - startX;
      const h = y - startY;
      annotations.push({type: currentTool, x: startX, y: startY, w, h, page: currentAnnotatePage});
      renderAnnotations();
    }
    isDrawing = false;
  });

  // ---------- Draw Shapes ----------
  document.getElementById('shapesChoose').addEventListener('click', ()=> document.getElementById('shapesInput').click());
  document.getElementById('shapesInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { shapesPdfFile = f; await loadShapesPdf(f); }
  });
  document.getElementById('shapesRun').addEventListener('click', ()=> exportShapesPdf());
  document.getElementById('shapesDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ shapesPdfFile = f; await loadShapesPdf(f); } });
  document.getElementById('shapesPageSelect').addEventListener('change', (e)=> {
    currentShapesPage = Number(e.target.value);
    renderShapesPage();
  });
  document.getElementById('rectBtn').addEventListener('click', ()=> setShapeTool('rect'));
  document.getElementById('circleBtn').addEventListener('click', ()=> setShapeTool('circle'));
  document.getElementById('arrowBtn').addEventListener('click', ()=> setShapeTool('arrow'));
  document.getElementById('lineBtn').addEventListener('click', ()=> setShapeTool('line'));
  document.getElementById('shapesClearBtn').addEventListener('click', ()=> { shapes = []; renderShapes(); });

  const shapesCanvas = document.getElementById('shapesCanvas');
  shapesCanvas.addEventListener('mousedown', (e)=> {
    if(!currentShapeTool) return;
    isDrawingShape = true;
    const rect = shapesCanvas.getBoundingClientRect();
    shapeStartX = e.clientX - rect.left;
    shapeStartY = e.clientY - rect.top;
  });
  shapesCanvas.addEventListener('mouseup', (e)=> {
    if(!isDrawingShape || !currentShapeTool) return;
    const rect = shapesCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = x - shapeStartX;
    const h = y - shapeStartY;
    const color = document.getElementById('shapeColor').value;
    const thickness = Number(document.getElementById('shapeThickness').value);
    const fill = document.getElementById('shapeFill').checked;
    shapes.push({type: currentShapeTool, x: shapeStartX, y: shapeStartY, w, h, color, thickness, fill, page: currentShapesPage});
    renderShapes();
    isDrawingShape = false;
  });

  // ---------- Fill Forms ----------
  document.getElementById('fillFormsChoose').addEventListener('click', ()=> document.getElementById('fillFormsInput').click());
  document.getElementById('fillFormsInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) { fillFormsPdfFile = f; await loadFillFormsPdf(f); }
  });
  document.getElementById('fillFormsRun').addEventListener('click', ()=> exportFilledPdf());
  document.getElementById('fillFormsDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f){ fillFormsPdfFile = f; await loadFillFormsPdf(f); } });

  // ---------- Extract Images ----------
  document.getElementById('extractImagesChoose').addEventListener('click', ()=> document.getElementById('extractImagesInput').click());
  document.getElementById('extractImagesInput').addEventListener('change', async (e)=> {
    const f = e.target.files[0];
    if(f) await loadExtractImagesPdf(f);
  });
  document.getElementById('extractImagesRun').addEventListener('click', ()=> extractImagesFromPdf());
  document.getElementById('extractImagesDrop').addEventListener('drop', async (ev)=> { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if(f) await loadExtractImagesPdf(f); });
  document.getElementById('extractImagesBtn').addEventListener('click', ()=> extractImagesFromPdf());
  document.getElementById('downloadImagesZipBtn').addEventListener('click', ()=> downloadImagesAsZip());
  async function compressPdf(){
    if(!compressPdfFile) { Swal.fire('No PDF','Upload a PDF to compress','info'); return; }
    const scale = Number(document.getElementById('compressScale').value);
    try{
      showOverlay('Compressing PDF (downscaling images)...');
      const arr = await compressPdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const pages = pdfDoc.getPages();
      // Load PDF.js document once outside the loop
      const pdfJsDoc = await pdfjsLib.getDocument({data:arr}).promise;
      // Instead of modifying original in-place (complex), we'll create a fresh PDF from rendered pages
      const newDoc = await PDFLib.PDFDocument.create();
      for(let i=0;i<pages.length;i++){
        loaderProgress.textContent = `Processing page ${i+1}/${pages.length}`;
        const pageJs = await pdfJsDoc.getPage(i+1);
        const canvasTmp = document.createElement('canvas');
        await renderPageToCanvas(pageJs, canvasTmp, scale);
        const url = canvasTmp.toDataURL('image/jpeg', 0.8);
        const imgArr = dataURLToArrayBuffer(url);
        const img = await newDoc.embedJpg(imgArr);
        const p = newDoc.addPage([img.width, img.height]);
        p.drawImage(img, {x:0,y:0,width:img.width,height:img.height});
        await new Promise(r=>setTimeout(r,10));
      }
      const out = await newDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'compressed.pdf');
      hideOverlay(); toastSuccess('Compressed PDF saved — note: frontend compression limits apply');
    } catch(err){ hideOverlay(); toastError('Compression failed: '+err.message); console.error(err); }
  }

  function dataURLToArrayBuffer(dataURL){
    const base64 = dataURL.split(',')[1];
    const binStr = atob(base64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for(let i=0;i<len;i++) bytes[i] = binStr.charCodeAt(i);
    return bytes;
  }

  // Parse pages string like "1,3-5" to array [1,3,4,5]
  function parsePages(str){
    const pages = [];
    if(!str) return pages;
    const parts = str.split(',');
    for(let part of parts){
      part = part.trim();
      if(part.includes('-')){
        const [start, end] = part.split('-').map(n=>parseInt(n));
        for(let i=start; i<=end; i++) pages.push(i);
      } else {
        pages.push(parseInt(part));
      }
    }
    return pages;
  }

  // Rotate Pages
  async function rotatePages(){
    if(!rotatePdfFile) { Swal.fire('No PDF','Upload a PDF to rotate','info'); return; }
    const angle = Number(document.getElementById('rotateAngle').value);
    const pagesStr = document.getElementById('rotatePages').value;
    const pages = parsePages(pagesStr);
    if(pages.length === 0) { Swal.fire('No pages','Specify pages to rotate','info'); return; }
    try{
      showOverlay('Rotating pages...');
      const arr = await rotatePdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const totalPages = pdfDoc.getPageCount();
      for(let p of pages){
        if(p > 0 && p <= totalPages){
          const page = pdfDoc.getPage(p-1);
          page.setRotation(PDFLib.degrees(angle));
        }
      }
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'rotated.pdf');
      hideOverlay(); toastSuccess('Rotated PDF saved');
    } catch(err){
      hideOverlay(); toastError('Rotation failed: '+err.message);
    }
  }

  // Delete Pages
  async function deletePages(){
    if(!deletePdfFile) { Swal.fire('No PDF','Upload a PDF to delete pages','info'); return; }
    const pagesStr = document.getElementById('deletePages').value;
    const pagesToDelete = parsePages(pagesStr);
    if(pagesToDelete.length === 0) { Swal.fire('No pages','Specify pages to delete','info'); return; }
    try{
      showOverlay('Deleting pages...');
      const arr = await deletePdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const totalPages = pdfDoc.getPageCount();
      const indicesToKeep = [];
      for(let i=1; i<=totalPages; i++){
        if(!pagesToDelete.includes(i)) indicesToKeep.push(i-1);
      }
      const newDoc = await PDFLib.PDFDocument.create();
      const copied = await newDoc.copyPages(pdfDoc, indicesToKeep);
      copied.forEach(p => newDoc.addPage(p));
      const out = await newDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'deleted_pages.pdf');
      hideOverlay(); toastSuccess('Pages deleted, PDF saved');
    } catch(err){
      hideOverlay(); toastError('Deletion failed: '+err.message);
    }
  }

  // Extract Pages
  async function extractPages(){
    if(!extractPagesPdfFile) { Swal.fire('No PDF','Upload a PDF to extract pages','info'); return; }
    const pagesStr = document.getElementById('extractPagesList').value;
    const pagesToExtract = parsePages(pagesStr);
    if(pagesToExtract.length === 0) { Swal.fire('No pages','Specify pages to extract','info'); return; }
    try{
      showOverlay('Extracting pages...');
      const arr = await extractPagesPdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const indices = pagesToExtract.map(p => p-1).filter(i => i >= 0 && i < pdfDoc.getPageCount());
      const newDoc = await PDFLib.PDFDocument.create();
      const copied = await newDoc.copyPages(pdfDoc, indices);
      copied.forEach(p => newDoc.addPage(p));
      const out = await newDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'extracted_pages.pdf');
      hideOverlay(); toastSuccess('Pages extracted, PDF saved');
    } catch(err){
      hideOverlay(); toastError('Extraction failed: '+err.message);
    }
  }

  // Add Page Numbers
  async function addPageNumbers(){
    if(!pageNumbersPdfFile) { Swal.fire('No PDF','Upload a PDF to add page numbers','info'); return; }
    const position = document.getElementById('pageNumbersPosition').value;
    const fontSize = Number(document.getElementById('pageNumbersSize').value);
    try{
      showOverlay('Adding page numbers...');
      const arr = await pageNumbersPdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const pages = pdfDoc.getPages();
      const helv = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      for(let i=0; i<pages.length; i++){
        const page = pages[i];
        const {width, height} = page.getSize();
        const text = (i+1).toString();
        const textWidth = helv.widthOfTextAtSize(text, fontSize);
        let x, y;
        switch(position){
          case 'top-left':
            x = 20;
            y = height - 20;
            break;
          case 'top-center':
            x = (width - textWidth) / 2;
            y = height - 20;
            break;
          case 'top-right':
            x = width - textWidth - 20;
            y = height - 20;
            break;
          case 'bottom-left':
            x = 20;
            y = 20;
            break;
          case 'bottom-center':
            x = (width - textWidth) / 2;
            y = 20;
            break;
          case 'bottom-right':
            x = width - textWidth - 20;
            y = 20;
            break;
          default:
            x = (width - textWidth) / 2;
            y = 20;
        }
        page.drawText(text, {x, y, size: fontSize, font: helv, color: PDFLib.rgb(0,0,0)});
      }
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'numbered.pdf');
      hideOverlay(); toastSuccess('Page numbers added');
    } catch(err){
      hideOverlay(); toastError('Adding page numbers failed: '+err.message);
    }
  }

  // Add Custom Text
  async function addCustomText(){
    if(!customTextPdfFile) { Swal.fire('No PDF','Upload a PDF to add text','info'); return; }
    const text = document.getElementById('customTextContent').value;
    const x = Number(document.getElementById('customTextX').value);
    const y = Number(document.getElementById('customTextY').value);
    const pageNum = Number(document.getElementById('customTextPage').value) - 1;
    if(!text) { Swal.fire('No text','Enter text to add','info'); return; }
    try{
      showOverlay('Adding custom text...');
      const arr = await customTextPdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const pages = pdfDoc.getPages();
      if(pageNum >= 0 && pageNum < pages.length){
        const page = pages[pageNum];
        const helv = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        page.drawText(text, {x, y, size: 12, font: helv, color: PDFLib.rgb(0,0,0)});
      }
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'custom_text.pdf');
      hideOverlay(); toastSuccess('Custom text added');
    } catch(err){
      hideOverlay(); toastError('Adding text failed: '+err.message);
    }
  }

  // Update Metadata
  async function updateMetadata(){
    if(!metadataPdfFile) { Swal.fire('No PDF','Upload a PDF to update metadata','info'); return; }
    const title = document.getElementById('metaTitle').value;
    const author = document.getElementById('metaAuthor').value;
    const subject = document.getElementById('metaSubject').value;
    try{
      showOverlay('Updating metadata...');
      const arr = await metadataPdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      pdfDoc.setTitle(title);
      pdfDoc.setAuthor(author);
      pdfDoc.setSubject(subject);
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'updated_metadata.pdf');
      hideOverlay(); toastSuccess('Metadata updated');
    } catch(err){
      hideOverlay(); toastError('Metadata update failed: '+err.message);
    }
  }

  // Add Password
  async function addPassword(){
    if(!passwordPdfFile) { Swal.fire('No PDF','Upload a PDF to protect','info'); return; }
    const password = document.getElementById('pdfPassword').value;
    if(!password) { Swal.fire('No password','Enter a password','info'); return; }
    try{
      showOverlay('Adding password protection...');
      const arr = await passwordPdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const out = await pdfDoc.save({userPassword: password});
      saveAs(new Blob([out],{type:'application/pdf'}), 'protected.pdf');
      hideOverlay(); toastSuccess('Password protection added');
    } catch(err){
      hideOverlay(); toastError('Password protection failed: '+err.message);
    }
  }

  // Unlock PDF
  async function unlockPdf(){
    if(!unlockPdfFile) { Swal.fire('No PDF','Upload a PDF to unlock','info'); return; }
    const password = document.getElementById('unlockPassword').value;
    if(!password) { Swal.fire('No password','Enter the password','info'); return; }
    try{
      showOverlay('Unlocking PDF...');
      const arr = await unlockPdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr, {password});
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'unlocked.pdf');
      hideOverlay(); toastSuccess('PDF unlocked');
    } catch(err){
      hideOverlay(); toastError('Unlock failed: '+err.message);
    }
  }

  // Convert PDF to Images
  async function convertPdfToImages(){
    if(!pdfToImagesPdfFile) { Swal.fire('No PDF','Upload a PDF to convert','info'); return; }
    const format = document.getElementById('imageFormat').value;
    const dpi = Number(document.getElementById('imageDpi').value);
    try{
      showOverlay('Converting to images...');
      const arr = await pdfToImagesPdfFile.arrayBuffer();
      const pdfJsDoc = await pdfjsLib.getDocument({data: arr}).promise;
      for(let i=1; i<=pdfJsDoc.numPages; i++){
        loaderProgress.textContent = `Converting page ${i}/${pdfJsDoc.numPages}`;
        const page = await pdfJsDoc.getPage(i);
        const canvas = document.createElement('canvas');
        const scale = dpi / 72; // assuming 72 DPI base
        const viewport = page.getViewport({scale});
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({canvasContext: ctx, viewport}).promise;
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mime);
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `page_${i}.${format}`;
        link.click();
        await new Promise(r=>setTimeout(r,100));
      }
      hideOverlay(); toastSuccess('Images downloaded');
    } catch(err){
      hideOverlay(); toastError('Conversion failed: '+err.message);
    }
  }

  // Run OCR
  async function runOcr(){
    if(!ocrFile) { Swal.fire('No file','Upload a file for OCR','info'); return; }
    try{
      showOverlay('Running OCR...');
      let imageElement;
      if(ocrFile.type.startsWith('image/')){
        const img = new Image();
        img.src = URL.createObjectURL(ocrFile);
        await new Promise(r => img.onload = r);
        imageElement = img;
      } else {
        // For PDF, render first page
        const arr = await ocrFile.arrayBuffer();
        const pdfJsDoc = await pdfjsLib.getDocument({data: arr}).promise;
        const page = await pdfJsDoc.getPage(1);
        const canvas = document.createElement('canvas');
        const viewport = page.getViewport({scale: 2});
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({canvasContext: ctx, viewport}).promise;
        imageElement = canvas;
      }
      const result = await Tesseract.recognize(imageElement, 'eng');
      document.getElementById('ocrText').value = result.data.text;
      hideOverlay(); toastSuccess('OCR completed');
    } catch(err){
      console.error('OCR error:', err);
      hideOverlay(); toastError('OCR failed: ' + (err.message || 'Unknown error'));
    }
  }

  // Add Signature
  async function addSignature(){
    if(!signaturePdfFile) { Swal.fire('No PDF','Upload a PDF to sign','info'); return; }
    const text = document.getElementById('signatureText').value;
    const pageNum = Number(document.getElementById('signaturePage').value) - 1;
    if(!text) { Swal.fire('No signature','Enter signature text','info'); return; }
    try{
      showOverlay('Adding signature...');
      const arr = await signaturePdfFile.arrayBuffer();
      const pdfDoc = await PDFLib.PDFDocument.load(arr);
      const pages = pdfDoc.getPages();
      if(pageNum >= 0 && pageNum < pages.length){
        const page = pages[pageNum];
        const {width, height} = page.getSize();
        const helv = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        page.drawText(text, {x: width - 100, y: 50, size: 20, font: helv, color: PDFLib.rgb(0,0,0)});
      }
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'signed.pdf');
      hideOverlay(); toastSuccess('Signature added');
    } catch(err){
      hideOverlay(); toastError('Signature failed: '+err.message);
    }
  }

  // Search PDF
  async function searchPdf(){
    if(!searchPdfFile) { Swal.fire('No PDF','Upload a PDF to search','info'); return; }
    const term = document.getElementById('searchTerm').value;
    if(!term) { Swal.fire('No term','Enter search term','info'); return; }
    try{
      showOverlay('Searching PDF...');
      const arr = await searchPdfFile.arrayBuffer();
      const pdfJsDoc = await pdfjsLib.getDocument({data: arr}).promise;
      const results = [];
      for(let i=1; i<=pdfJsDoc.numPages; i++){
        const page = await pdfJsDoc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(it => it.str).join(' ');
        if(text.toLowerCase().includes(term.toLowerCase())){
          results.push(`Page ${i}: ${text.substring(0,100)}...`);
        }
      }
      const resultsDiv = document.getElementById('searchResults');
      resultsDiv.innerHTML = results.length ? results.map(r => `<div>${r}</div>`).join('') : 'No matches found';
      hideOverlay(); toastSuccess('Search completed');
    } catch(err){
      hideOverlay(); toastError('Search failed: '+err.message);
    }
  }

  // Download All Split as ZIP
  async function downloadAllSplitAsZip(){
    if(splitFiles.length === 0) { Swal.fire('No files','Split a PDF first','info'); return; }
    try{
      showOverlay('Creating ZIP file...');
      const zip = new JSZip();
      splitFiles.forEach(file => {
        zip.file(file.filename, file.bytes);
      });
      const content = await zip.generateAsync({type: 'blob'});
      saveAs(content, 'split_pages.zip');
      hideOverlay(); toastSuccess('ZIP downloaded');
    } catch(err){
      hideOverlay(); toastError('ZIP creation failed: '+err.message);
    }
  }

  // Load Annotate PDF
  async function loadAnnotatePdf(file){
    try{
      showOverlay('Loading PDF for annotation...');
      const arr = await file.arrayBuffer();
      annotatePdfDoc = await pdfjsLib.getDocument({data: arr}).promise;
      const select = document.getElementById('annotatePageSelect');
      select.innerHTML = '';
      for(let i=1; i<=annotatePdfDoc.numPages; i++){
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = `Page ${i}`;
        select.appendChild(opt);
      }
      currentAnnotatePage = 1;
      annotations = [];
      document.getElementById('annotateContainer').style.display = 'block';
      document.getElementById('annotateDrop').style.display = 'none';
      renderAnnotatePage();
      hideOverlay();
    } catch(err){
      hideOverlay();
      toastError('Failed to load PDF: '+err.message);
    }
  }

  // Render Annotate Page
  async function renderAnnotatePage(){
    const page = await annotatePdfDoc.getPage(currentAnnotatePage);
    const canvas = document.getElementById('annotateCanvas');
    const overlay = document.getElementById('annotateOverlay');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({scale: 1.5});
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    overlay.width = viewport.width;
    overlay.height = viewport.height;
    await page.render({canvasContext: ctx, viewport}).promise;
    renderAnnotations();
  }

  // Render Annotations
  function renderAnnotations(){
    const overlay = document.getElementById('annotateOverlay');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0,0,overlay.width,overlay.height);
    annotations.forEach(ann => {
      if(ann.page !== currentAnnotatePage) return;
      ctx.strokeStyle = ann.color || 'yellow';
      ctx.lineWidth = ann.lineWidth || 2;
      if(ann.type === 'highlight'){
        ctx.fillStyle = 'rgba(255,255,0,0.3)';
        ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
      } else if(ann.type === 'underline'){
        ctx.beginPath();
        ctx.moveTo(ann.x, ann.y);
        ctx.lineTo(ann.x + ann.w, ann.y);
        ctx.stroke();
      } else if(ann.type === 'path'){
        ctx.beginPath();
        ann.points.forEach((p, i) => {
          if(i===0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }
    });
    // For notes, add divs.
    const noteContainer = document.getElementById('noteContainer');
    noteContainer.innerHTML = '';
    annotations.forEach(ann => {
      if(ann.type === 'note' && ann.page === currentAnnotatePage){
        const div = document.createElement('div');
        div.style.position = 'absolute';
        div.style.left = ann.x + 'px';
        div.style.top = ann.y + 'px';
        div.style.background = 'yellow';
        div.style.padding = '4px';
        div.style.border = '1px solid black';
        div.style.fontSize = '12px';
        div.contentEditable = true;
        div.textContent = ann.text;
        div.addEventListener('input', (e)=> ann.text = e.target.textContent);
        noteContainer.appendChild(div);
      }
    });
  }

  // Set Tool
  function setTool(tool){
    currentTool = tool;
    document.querySelectorAll('#annotateContainer .btn').forEach(b=>b.classList.remove('active'));
    document.getElementById(tool + 'Btn').classList.add('active');
  }

  // Export Annotated PDF
  async function exportAnnotatedPdf(){
    if(!annotatePdfDoc) { Swal.fire('No PDF','Upload a PDF first','info'); return; }
    try{
      showOverlay('Exporting annotated PDF...');
      const pdfDoc = await PDFLib.PDFDocument.create();
      for(let i=1; i<=annotatePdfDoc.numPages; i++){
        const page = await annotatePdfDoc.getPage(i);
        const viewport = page.getViewport({scale: 1.5});
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({canvasContext: ctx, viewport}).promise;
        // Draw annotations
        annotations.forEach(ann => {
          if(ann.page !== i) return;
          if(ann.type === 'highlight'){
            ctx.fillStyle = 'rgba(255,255,0,0.3)';
            ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
          } else if(ann.type === 'underline'){
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ann.x, ann.y);
            ctx.lineTo(ann.x + ann.w, ann.y);
            ctx.stroke();
          } else if(ann.type === 'path'){
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = ann.lineWidth;
            ctx.beginPath();
            ann.points.forEach((p, idx) => {
              if(idx===0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
          } else if(ann.type === 'note'){
            ctx.fillStyle = 'yellow';
            ctx.fillRect(ann.x, ann.y, 100, 20);
            ctx.fillStyle = 'black';
            ctx.font = '12px Arial';
            ctx.fillText(ann.text, ann.x + 2, ann.y + 15);
          }
        });
        const imgData = canvas.toDataURL('image/png');
        const img = await pdfDoc.embedPng(imgData);
        const newPage = pdfDoc.addPage([img.width, img.height]);
        newPage.drawImage(img, {x:0, y:0, width: img.width, height: img.height});
      }
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'annotated.pdf');
      hideOverlay(); toastSuccess('Annotated PDF exported');
    } catch(err){
      hideOverlay(); toastError('Export failed: '+err.message);
    }
  }

  // Load Shapes PDF
  async function loadShapesPdf(file){
    try{
      showOverlay('Loading PDF for shapes...');
      const arr = await file.arrayBuffer();
      shapesPdfDoc = await pdfjsLib.getDocument({data: arr}).promise;
      const select = document.getElementById('shapesPageSelect');
      select.innerHTML = '';
      for(let i=1; i<=shapesPdfDoc.numPages; i++){
        const opt = document.createElement('option');
        opt.value = i;
        opt.text = `Page ${i}`;
        select.appendChild(opt);
      }
      currentShapesPage = 1;
      shapes = [];
      document.getElementById('shapesContainer').style.display = 'block';
      document.getElementById('shapesDrop').style.display = 'none';
      renderShapesPage();
      hideOverlay();
    } catch(err){
      hideOverlay();
      toastError('Failed to load PDF: '+err.message);
    }
  }

  // Render Shapes Page
  async function renderShapesPage(){
    const page = await shapesPdfDoc.getPage(currentShapesPage);
    const canvas = document.getElementById('shapesCanvas');
    const overlay = document.getElementById('shapesOverlay');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({scale: 1.5});
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    overlay.width = viewport.width;
    overlay.height = viewport.height;
    await page.render({canvasContext: ctx, viewport}).promise;
    renderShapes();
  }

  // Render Shapes
  function renderShapes(){
    const overlay = document.getElementById('shapesOverlay');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0,0,overlay.width,overlay.height);
    shapes.forEach(shape => {
      if(shape.page !== currentShapesPage) return;
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.thickness;
      if(shape.fill){
        ctx.fillStyle = shape.color;
      }
      if(shape.type === 'rect'){
        if(shape.fill) ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        else ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if(shape.type === 'circle'){
        const radius = Math.abs(shape.w / 2);
        ctx.beginPath();
        ctx.arc(shape.x + shape.w / 2, shape.y + shape.h / 2, radius, 0, 2 * Math.PI);
        if(shape.fill) ctx.fill();
        else ctx.stroke();
      } else if(shape.type === 'line'){
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
        ctx.stroke();
      } else if(shape.type === 'arrow'){
        // Draw line
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
        ctx.stroke();
        // Draw arrowhead
        const angle = Math.atan2(shape.h, shape.w);
        const arrowLength = 10;
        ctx.beginPath();
        ctx.moveTo(shape.x + shape.w, shape.y + shape.h);
        ctx.lineTo(shape.x + shape.w - arrowLength * Math.cos(angle - Math.PI / 6), shape.y + shape.h - arrowLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(shape.x + shape.w, shape.y + shape.h);
        ctx.lineTo(shape.x + shape.w - arrowLength * Math.cos(angle + Math.PI / 6), shape.y + shape.h - arrowLength * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    });
  }

  // Set Shape Tool
  function setShapeTool(tool){
    currentShapeTool = tool;
    document.querySelectorAll('#shapesContainer .btn').forEach(b=>b.classList.remove('active'));
    document.getElementById(tool + 'Btn').classList.add('active');
  }

  // Export Shapes PDF
  async function exportShapesPdf(){
    if(!shapesPdfDoc) { Swal.fire('No PDF','Upload a PDF first','info'); return; }
    try{
      showOverlay('Exporting PDF with shapes...');
      const pdfDoc = await PDFLib.PDFDocument.create();
      for(let i=1; i<=shapesPdfDoc.numPages; i++){
        const page = await shapesPdfDoc.getPage(i);
        const viewport = page.getViewport({scale: 1.5});
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({canvasContext: ctx, viewport}).promise;
        // Draw shapes
        shapes.forEach(shape => {
          if(shape.page !== i) return;
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = shape.thickness;
          if(shape.fill){
            ctx.fillStyle = shape.color;
          }
          if(shape.type === 'rect'){
            if(shape.fill) ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
            else ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
          } else if(shape.type === 'circle'){
            const radius = Math.abs(shape.w / 2);
            ctx.beginPath();
            ctx.arc(shape.x + shape.w / 2, shape.y + shape.h / 2, radius, 0, 2 * Math.PI);
            if(shape.fill) ctx.fill();
            else ctx.stroke();
          } else if(shape.type === 'line'){
            ctx.beginPath();
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
            ctx.stroke();
          } else if(shape.type === 'arrow'){
            ctx.beginPath();
            ctx.moveTo(shape.x, shape.y);
            ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
            ctx.stroke();
            const angle = Math.atan2(shape.h, shape.w);
            const arrowLength = 10;
            ctx.beginPath();
            ctx.moveTo(shape.x + shape.w, shape.y + shape.h);
            ctx.lineTo(shape.x + shape.w - arrowLength * Math.cos(angle - Math.PI / 6), shape.y + shape.h - arrowLength * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(shape.x + shape.w, shape.y + shape.h);
            ctx.lineTo(shape.x + shape.w - arrowLength * Math.cos(angle + Math.PI / 6), shape.y + shape.h - arrowLength * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
          }
        });
        const imgData = canvas.toDataURL('image/png');
        const img = await pdfDoc.embedPng(imgData);
        const newPage = pdfDoc.addPage([img.width, img.height]);
        newPage.drawImage(img, {x:0, y:0, width: img.width, height: img.height});
      }
      const out = await pdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'shaped.pdf');
      hideOverlay(); toastSuccess('PDF with shapes exported');
    } catch(err){
      hideOverlay(); toastError('Export failed: '+err.message);
    }
  }

  // Load Fill Forms PDF
  async function loadFillFormsPdf(file){
    try{
      showOverlay('Loading PDF form...');
      const arr = await file.arrayBuffer();
      fillFormsPdfDoc = await PDFLib.PDFDocument.load(arr);
      const form = fillFormsPdfDoc.getForm();
      const fields = form.getFields();
      formFieldsData = [];
      const fieldsList = document.getElementById('fieldsList');
      fieldsList.innerHTML = '';
      fields.forEach(field => {
        const fieldData = {field, name: field.getName(), type: field.constructor.name};
        formFieldsData.push(fieldData);
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '8px';
        div.innerHTML = `<label style="min-width:120px">${field.getName()}</label>`;
        if(field.constructor.name === 'PDFTextField'){
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = 'Enter text';
          input.value = field.getText() || '';
          input.addEventListener('input', (e)=> fieldData.value = e.target.value);
          div.appendChild(input);
        } else if(field.constructor.name === 'PDFCheckBox'){
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = field.isChecked();
          input.addEventListener('change', (e)=> fieldData.value = e.target.checked);
          div.appendChild(input);
        } else if(field.constructor.name === 'PDFRadioGroup'){
          const options = field.getOptions();
          const select = document.createElement('select');
          options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.text = opt;
            select.appendChild(option);
          });
          select.value = field.getSelected();
          select.addEventListener('change', (e)=> fieldData.value = e.target.value);
          div.appendChild(select);
        } else if(field.constructor.name === 'PDFDropdown'){
          const options = field.getOptions();
          const select = document.createElement('select');
          options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.text = opt;
            select.appendChild(option);
          });
          select.value = field.getSelected();
          select.addEventListener('change', (e)=> fieldData.value = e.target.value);
          div.appendChild(select);
        }
        fieldsList.appendChild(div);
      });
      document.getElementById('formFields').style.display = 'block';
      document.getElementById('fillFormsDrop').style.display = 'none';
      hideOverlay();
    } catch(err){
      hideOverlay();
      toastError('Failed to load PDF form: '+err.message);
    }
  }

  // Export Filled PDF
  async function exportFilledPdf(){
    if(!fillFormsPdfDoc) { Swal.fire('No PDF','Upload a PDF first','info'); return; }
    try{
      showOverlay('Filling form and exporting...');
      const form = fillFormsPdfDoc.getForm();
      formFieldsData.forEach(data => {
        if(data.value !== undefined){
          if(data.type === 'PDFTextField'){
            data.field.setText(data.value);
          } else if(data.type === 'PDFCheckBox'){
            if(data.value) data.field.check();
            else data.field.uncheck();
          } else if(data.type === 'PDFRadioGroup' || data.type === 'PDFDropdown'){
            data.field.select(data.value);
          }
        }
      });
      const out = await fillFormsPdfDoc.save();
      saveAs(new Blob([out],{type:'application/pdf'}), 'filled_form.pdf');
      hideOverlay(); toastSuccess('Filled PDF exported');
    } catch(err){
      hideOverlay(); toastError('Export failed: '+err.message);
    }
  }

  // Load Extract Images PDF
  async function loadExtractImagesPdf(file){
    try{
      showOverlay('Loading PDF for image extraction...');
      const arr = await file.arrayBuffer();
      extractImagesPdfDoc = await pdfjsLib.getDocument({data: arr}).promise;
      document.getElementById('extractImagesContainer').style.display = 'block';
      document.getElementById('extractImagesDrop').style.display = 'none';
      hideOverlay();
    } catch(err){
      hideOverlay();
      toastError('Failed to load PDF: '+err.message);
    }
  }

  // Extract Images from PDF
  async function extractImagesFromPdf(){
    if(!extractImagesPdfDoc) { Swal.fire('No PDF','Upload a PDF first','info'); return; }
    try{
      showOverlay('Extracting images...');
      extractedImages = [];
      const grid = document.getElementById('extractedImagesGrid');
      grid.innerHTML = '';
      for(let i=1; i<=extractImagesPdfDoc.numPages; i++){
        loaderProgress.textContent = `Processing page ${i}/${extractImagesPdfDoc.numPages}`;
        const page = await extractImagesPdfDoc.getPage(i);
        const operatorList = await page.getOperatorList();
        const images = [];
        for(let j=0; j<operatorList.fnArray.length; j++){
          if(operatorList.fnArray[j] === pdfjsLib.OPS.paintImageXObject || operatorList.fnArray[j] === pdfjsLib.OPS.paintInlineImageXObject){
            const objId = operatorList.argsArray[j][0];
            const img = page.objs.get(objId);
            if(img){
              images.push(img);
            }
          }
        }
        for(let k=0; k<images.length; k++){
          const img = images[k];
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          const imgData = ctx.createImageData(img.width, img.height);
          imgData.data.set(img.data);
          ctx.putImageData(imgData, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          const filename = `page_${i}_image_${k+1}.png`;
          extractedImages.push({filename, dataUrl});
          const card = document.createElement('div');
          card.className = 'page-card';
          const imgEl = document.createElement('img');
          imgEl.src = dataUrl;
          imgEl.style.width = '100%';
          imgEl.style.height = '100px';
          imgEl.style.objectFit = 'cover';
          card.appendChild(imgEl);
          const btn = document.createElement('button');
          btn.className = 'btn small';
          btn.textContent = 'Download';
          btn.style.marginTop = '6px';
          btn.addEventListener('click', ()=> {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = filename;
            link.click();
          });
          card.appendChild(btn);
          grid.appendChild(card);
        }
      }
      if(extractedImages.length > 0){
        document.getElementById('downloadImagesZipBtn').style.display = 'inline-block';
      }
      hideOverlay();
      toastSuccess('Images extracted');
    } catch(err){
      hideOverlay();
      toastError('Extraction failed: '+err.message);
    }
  }

  // Download Images as ZIP
  async function downloadImagesAsZip(){
    if(extractedImages.length === 0) { Swal.fire('No images','Extract images first','info'); return; }
    try{
      showOverlay('Creating ZIP file...');
      const zip = new JSZip();
      extractedImages.forEach(img => {
        const base64 = img.dataUrl.split(',')[1];
        zip.file(img.filename, base64, {base64: true});
      });
      const content = await zip.generateAsync({type: 'blob'});
      saveAs(content, 'extracted_images.zip');
      hideOverlay();
      toastSuccess('ZIP downloaded');
    } catch(err){
      hideOverlay();
      toastError('ZIP creation failed: '+err.message);
    }
  }

  // Load Chatbot File
  async function loadChatbotFile(file){
    try{
      showOverlay('Loading file...');
      let text = await extractTextFromFile(file);
      text = text.substring(0, 10000); // Limit to 10k chars for API
      chatMessages = [{role: 'system', content: `Document content: ${text}`}];
      document.getElementById('chatbotContainer').style.display = 'block';
      document.getElementById('chatbotDrop').style.display = 'none';
      addMessage('AI', 'Document loaded. You can now ask questions or request a summary.');
      hideOverlay();
    } catch(err){
      hideOverlay();
      toastError('Failed to load file: '+err.message);
    }
  }

  // Extract Text from File
  async function extractTextFromFile(file){
    if(file.type === 'text/plain'){
      return await file.text();
    } else if(file.type === 'application/pdf'){
      const arr = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({data: arr}).promise;
      let text = '';
      for(let i=1; i<=pdfDoc.numPages; i++){
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(it => it.str).join(' ') + '\n';
      }
      return text;
    } else if(file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
      const arr = await file.arrayBuffer();
      const result = await mammoth.extractRawText({arrayBuffer: arr});
      return result.value;
    } else {
      throw new Error('Unsupported file type');
    }
  }

  // Add Message to Chat
  function addMessage(sender, message){
    const chatWindow = document.getElementById('chatWindow');
    const div = document.createElement('div');
    div.style.marginBottom = '10px';
    div.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Send Message
  async function sendMessage(){
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if(!message) return;
    addMessage('You', message);
    input.value = '';
    showOverlay('Thinking...');
    try{
      const style = document.getElementById('summaryStyle').value;
      const prompt = `Based on the document, ${message}. Provide a ${style} response.`;
      const response = await callGeminiAPI(prompt);
      addMessage('AI', response);
      currentSummary = response;
      document.getElementById('chatbotDownloadBtn').style.display = 'inline-block';
      hideOverlay();
    } catch(err){
      hideOverlay();
      addMessage('AI', 'Sorry, an error occurred: ' + err.message);
    }
  }

  // Call Gemini API
  async function callGeminiAPI(prompt){
    const apiKey = 'AIzaSyDvU17JfnBiIyZRW3fpFcxCXc254HyqZ4Y'; // User's API key - WARNING: Exposing API key in frontend is insecure!
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-002:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        contents: [{
          parts: [{text: prompt}]
        }]
      })
    });
    const data = await response.json();
    console.log('Gemini API response:', data);
    if(data.error){
      throw new Error(data.error.message);
    }
    if(data.candidates && data.candidates[0]){
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('No response from AI');
    }
  }

  // Download Summary
  function downloadSummary(){
    if(!currentSummary) { toastError('No summary to download'); return; }
    const blob = new Blob([currentSummary], {type: 'text/plain'});
    saveAs(blob, 'ai_summary.txt');
  }

  // ---------- Recent Files localStorage ----------
  function storeRecentFiles(files){
    const items = files.map(f => ({name:f.name, size:f.size, type:f.type, time: Date.now()}));
    recentFiles = (items.concat(recentFiles)).slice(0,10);
    localStorage.setItem('pdftk.recent', JSON.stringify(recentFiles));
  }
  document.getElementById('recentBtn').addEventListener('click', ()=> {
    if(recentFiles.length===0) return Swal.fire('No recent files','You have not uploaded files yet.','info');
    const html = recentFiles.map(r => `<div style="display:flex;justify-content:space-between;padding:6px 0"><div>${r.name}</div><div class="muted">${(r.size/1024/1024).toFixed(2)} MB</div></div>`).join('');
    Swal.fire({title:'Recent', html: html, width:600});
  });

  // ---------- Utility: keyboard shortcuts ----------
  document.addEventListener('keydown', (e)=> {
    if(e.key==='/' && (e.ctrlKey||e.metaKey)){ e.preventDefault(); document.getElementById('globalFileInput').click(); }
  });

  // Initial small animation
  anime({
    targets: '.logo',
    scale: [0.9,1],
    rotate: [0,6],
    duration: 900,
    easing: 'spring(1,80,10,0)'
  });

  // Helpful: load sample PDF from remote (disabled by default)
  // END main IIFE
})();
