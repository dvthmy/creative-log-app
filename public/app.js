(function(){

  /* =====================================================================
     API HELPERS
     ===================================================================== */
  async function api(method, url, body){
    const opts = { method, headers: {} };
    if(body instanceof FormData){
      opts.body = body;
    }else if(body !== undefined){
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if(!res.ok){
      const err = await res.json().catch(()=>({error:'Lỗi không xác định'}));
      throw new Error(err.error || 'Lỗi không xác định');
    }
    return res.status === 204 ? null : res.json();
  }

  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 3200);
  }

  /* =====================================================================
     FULLSCREEN VIEWER — shared by every media item on the page
     ===================================================================== */
  const fsModal = document.getElementById('fsmodal');
  const fsFrame = document.getElementById('fs-frame');
  function mediaUrl(item){ return item.mediaId ? '/uploads/' + item.mediaId : null; }

  /* ---- custom video controls, shared by the fullscreen modal + highlight cards ---- */
  const VIDEO_MUTE_KEY = 'clog-video-muted';
  function getRememberedMute(){ return localStorage.getItem(VIDEO_MUTE_KEY) !== '0'; }
  function setRememberedMute(m){ localStorage.setItem(VIDEO_MUTE_KEY, m ? '1' : '0'); }
  function fmtTime(sec){
    if(!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec/60), s = Math.floor(sec%60);
    return m + ':' + String(s).padStart(2,'0');
  }
  // wrap: element with position:relative that the video already sits inside of
  function attachVideoControls(video, wrap, opts){
    opts = opts || {};
    wrap.classList.add('vctrl-wrap');
    const bar = document.createElement('div'); bar.className = 'vctrl-bar';

    const playBtn = document.createElement('button'); playBtn.className = 'vctrl-btn'; playBtn.type = 'button';
    const back10 = document.createElement('button'); back10.className = 'vctrl-btn'; back10.type = 'button';
    back10.textContent = '⏪'; back10.title = 'Lùi 10s';
    const fwd10 = document.createElement('button'); fwd10.className = 'vctrl-btn'; fwd10.type = 'button';
    fwd10.textContent = '⏩'; fwd10.title = 'Tiến 10s';
    const seek = document.createElement('input'); seek.type = 'range'; seek.min = 0; seek.max = 1000; seek.value = 0;
    seek.className = 'vctrl-seek';
    const timeLabel = document.createElement('div'); timeLabel.className = 'vctrl-time'; timeLabel.textContent = '0:00 / 0:00';
    const muteBtn = document.createElement('button'); muteBtn.className = 'vctrl-btn'; muteBtn.type = 'button';
    const fsBtn = document.createElement('button'); fsBtn.className = 'vctrl-btn'; fsBtn.type = 'button';
    fsBtn.textContent = '⛶'; fsBtn.title = 'Toàn màn hình';

    function setPlayIcon(){ playBtn.textContent = video.paused ? '▶' : '⏸'; playBtn.title = video.paused ? 'Phát' : 'Tạm dừng'; }
    function setMuteIcon(){ muteBtn.textContent = video.muted ? '🔇' : '🔊'; muteBtn.title = video.muted ? 'Bật tiếng' : 'Tắt tiếng'; }
    setPlayIcon(); setMuteIcon();

    playBtn.addEventListener('click', e=>{ e.stopPropagation(); if(video.paused) video.play().catch(()=>{}); else video.pause(); });
    back10.addEventListener('click', e=>{ e.stopPropagation(); video.currentTime = Math.max(0, video.currentTime - 10); });
    fwd10.addEventListener('click', e=>{ e.stopPropagation(); video.currentTime = Math.min(video.duration || 1e9, video.currentTime + 10); });
    muteBtn.addEventListener('click', e=>{
      e.stopPropagation();
      video.muted = !video.muted;
      if(opts.rememberMute) setRememberedMute(video.muted);
      setMuteIcon();
    });

    let seeking = false;
    seek.addEventListener('pointerdown', e=>{ e.stopPropagation(); seeking = true; });
    seek.addEventListener('input', ()=>{ if(video.duration) video.currentTime = (seek.value/1000) * video.duration; });
    seek.addEventListener('pointerup', e=>{ e.stopPropagation(); seeking = false; });
    seek.addEventListener('click', e=>e.stopPropagation());

    function updateProgress(){
      if(!video.duration || seeking) return;
      seek.value = Math.round((video.currentTime/video.duration)*1000);
      timeLabel.textContent = fmtTime(video.currentTime) + ' / ' + fmtTime(video.duration);
    }
    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', updateProgress);
    video.addEventListener('play', setPlayIcon);
    video.addEventListener('pause', setPlayIcon);

    bar.appendChild(playBtn); bar.appendChild(back10); bar.appendChild(fwd10);
    bar.appendChild(seek); bar.appendChild(timeLabel); bar.appendChild(muteBtn);
    if(opts.fullscreen){
      fsBtn.addEventListener('click', e=>{
        e.stopPropagation();
        if(document.fullscreenElement) document.exitFullscreen();
        else if(video.requestFullscreen) video.requestFullscreen().catch(()=>{});
      });
      bar.appendChild(fsBtn);
    }
    wrap.appendChild(bar);

    // auto show/hide: appears on hover/tap, hides itself after idle while playing
    let hideTimer;
    function showBar(){
      bar.classList.add('show');
      clearTimeout(hideTimer);
      if(!video.paused){
        hideTimer = setTimeout(()=>{ if(!bar.matches(':hover')) bar.classList.remove('show'); }, 2500);
      }
    }
    wrap.addEventListener('mousemove', showBar);
    wrap.addEventListener('touchstart', showBar, { passive:true });
    video.addEventListener('pause', ()=>{ clearTimeout(hideTimer); bar.classList.add('show'); });
    video.addEventListener('play', showBar);
    showBar();

    let keyHandler = null;
    if(opts.keyboard){
      keyHandler = e=>{
        if(e.key === ' '){ e.preventDefault(); playBtn.click(); }
        else if(e.key === 'm' || e.key === 'M'){ muteBtn.click(); }
        else if(e.key === 'ArrowLeft'){ back10.click(); }
        else if(e.key === 'ArrowRight'){ fwd10.click(); }
        else if((e.key === 'f' || e.key === 'F') && opts.fullscreen){ fsBtn.click(); }
      };
      document.addEventListener('keydown', keyHandler);
    }
    return { destroy(){ clearTimeout(hideTimer); if(keyHandler) document.removeEventListener('keydown', keyHandler); } };
  }

  let currentFsVideoCtrl = null;
  function openFullscreen(item){
    fsFrame.innerHTML = '';
    if(currentFsVideoCtrl){ currentFsVideoCtrl.destroy(); currentFsVideoCtrl = null; }
    if(item.mediaId){
      const url = mediaUrl(item);
      const isVideo = (item.mediaType||'').startsWith('video/');
      if(isVideo){
        const wrap = document.createElement('div'); wrap.style.width = '100%'; wrap.style.height = '100%';
        const el = document.createElement('video');
        el.src = url; el.autoplay = true; el.loop = true; el.playsInline = true;
        el.muted = getRememberedMute();
        wrap.appendChild(el);
        fsFrame.appendChild(wrap);
        currentFsVideoCtrl = attachVideoControls(el, wrap, { fullscreen: true, keyboard: true, rememberMute: true });
      }else{
        const el = document.createElement('img'); el.src = url;
        fsFrame.appendChild(el);
      }
    }else if(item.driveId){
      const ifr = document.createElement('iframe');
      ifr.src = 'https://drive.google.com/file/d/'+item.driveId+'/preview';
      ifr.setAttribute('allow','autoplay; fullscreen'); ifr.setAttribute('allowfullscreen','');
      fsFrame.appendChild(ifr);
    }else return;
    fsModal.classList.add('on');
  }
  function closeFullscreen(){
    fsModal.classList.remove('on'); fsFrame.innerHTML = '';
    if(currentFsVideoCtrl){ currentFsVideoCtrl.destroy(); currentFsVideoCtrl = null; }
  }
  document.getElementById('fs-close').addEventListener('click', closeFullscreen);
  fsModal.addEventListener('click', e=>{ if(e.target === fsModal) closeFullscreen(); });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeFullscreen(); });

  /* =====================================================================
     ADD MEDIA MODAL — pick Drive link or device upload, plus a name, in one place
     ===================================================================== */
  const addMediaModal = document.getElementById('drivemodal');
  const driveInput = document.getElementById('drive-input');
  const amCaptionInput = document.getElementById('am-caption-input');
  const amTabDrive = document.getElementById('am-tab-drive');
  const amTabUpload = document.getElementById('am-tab-upload');
  const amPanelDrive = document.getElementById('am-panel-drive');
  const amPanelUpload = document.getElementById('am-panel-upload');
  const amPickFileBtn = document.getElementById('am-pick-file');
  const amFileNameEl = document.getElementById('am-file-name');
  const amFileInput = document.getElementById('madd-file-input');
  let amMode = 'drive';
  let amFile = null;
  let amResolve = null;

  function setAmMode(mode){
    amMode = mode;
    amTabDrive.classList.toggle('active', mode === 'drive');
    amTabUpload.classList.toggle('active', mode === 'upload');
    amPanelDrive.style.display = mode === 'drive' ? '' : 'none';
    amPanelUpload.style.display = mode === 'upload' ? '' : 'none';
  }
  amTabDrive.addEventListener('click', ()=>setAmMode('drive'));
  amTabUpload.addEventListener('click', ()=>setAmMode('upload'));
  amPickFileBtn.addEventListener('click', ()=>amFileInput.click());
  amFileInput.addEventListener('change', function(){
    amFile = this.files[0] || null;
    amFileNameEl.textContent = amFile ? amFile.name : 'Chưa chọn file nào';
    this.value = '';
  });

  function openAddMediaModal(){
    return new Promise(resolve=>{
      amResolve = resolve;
      driveInput.value = '';
      amCaptionInput.value = '';
      amFile = null;
      amFileNameEl.textContent = 'Chưa chọn file nào';
      setAmMode('drive');
      addMediaModal.classList.add('on');
      setTimeout(()=>driveInput.focus(), 0);
    });
  }
  function closeAddMediaModal(result){
    addMediaModal.classList.remove('on');
    if(amResolve){ amResolve(result); amResolve = null; }
  }
  document.getElementById('drive-ok').addEventListener('click', ()=>{
    const caption = amCaptionInput.value.trim();
    if(amMode === 'drive') closeAddMediaModal({ mode:'drive', driveInput: driveInput.value, caption });
    else closeAddMediaModal({ mode:'upload', file: amFile, caption });
  });
  document.getElementById('drive-cancel').addEventListener('click', ()=>closeAddMediaModal(null));
  addMediaModal.addEventListener('click', e=>{ if(e.target === addMediaModal) closeAddMediaModal(null); });
  driveInput.addEventListener('keydown', e=>{
    if(e.key === 'Enter') document.getElementById('drive-ok').click();
    if(e.key === 'Escape') closeAddMediaModal(null);
  });

  /* =====================================================================
     MEDIA STACK — a paste-able / uploadable list of images or videos.
     `target` describes where new items get POSTed and how existing items
     get PATCHed/DELETEd:
       { kind:'row', rowId, slot: 'reference'|'result' }  -> /api/rows/:rowId/media , /api/row-media/:id
       { kind:'notes' }                                    -> /api/notes/media , /api/notes/media/:id
     ===================================================================== */
  let selectedAdd = null; // { items, target, rerender }

  function endpointsFor(target){
    if(target.kind === 'row'){
      return { add: '/api/rows/'+target.rowId+'/media', item: id => '/api/row-media/'+id };
    }
    return { add: '/api/notes/media', item: id => '/api/notes/media/'+id };
  }

  function selectAddTile(el, items, target, rerender){
    document.querySelectorAll('.madd.selected').forEach(a=>a.classList.remove('selected'));
    el.classList.add('selected');
    selectedAdd = { items, target, rerender };
  }
  async function addMediaFile(items, target, file, rerender, caption){
    if(file.size > 200*1048576){ toast('⚠️ File over 200MB — nén lại trước'); return; }
    const ep = endpointsFor(target);
    const fd = new FormData();
    fd.append('file', file);
    if(target.kind === 'row') fd.append('slot', target.slot);
    try{
      const item = await api('POST', ep.add, fd);
      if(caption){
        item.caption = caption;
        try{ await api('PATCH', ep.item(item.id), { caption }); }catch(e){}
      }
      items.push(item);
      rerender();
      toast('✓ Đã thêm ' + (file.type.startsWith('video/') ? 'video' : 'ảnh'));
    }catch(e){ toast('⚠️ Thêm media thất bại: ' + e.message); }
  }

  function extractDriveId(input){
    input = (input || '').trim();
    let m = input.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if(m) return m[1];
    m = input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if(m) return m[1];
    if(/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
    return null;
  }
  async function addDriveMedia(items, target, driveId, rerender, caption){
    const ep = endpointsFor(target);
    const body = { driveId };
    if(target.kind === 'row') body.slot = target.slot;
    try{
      const item = await api('POST', ep.add, body);
      if(caption){
        item.caption = caption;
        try{ await api('PATCH', ep.item(item.id), { caption }); }catch(e){}
      }
      items.push(item);
      rerender();
      toast('✓ Đã thêm video Drive');
    }catch(e){ toast('⚠️ Thêm thất bại: ' + e.message); }
  }
  document.addEventListener('paste', e=>{
    if(!selectedAdd) return;
    const item = [...e.clipboardData.items].find(i=>i.type.startsWith('image/')||i.type.startsWith('video/'));
    if(!item) return;
    e.preventDefault();
    addMediaFile(selectedAdd.items, selectedAdd.target, item.getAsFile(), selectedAdd.rerender);
  });

  function renderMediaItem(item, items, idx, target, rerender){
    const wrap = document.createElement('div'); wrap.className = 'mitem-wrap';
    const el = document.createElement('div'); el.className = 'mitem';
    let isVideo = false;
    if(item.mediaId){
      isVideo = (item.mediaType||'').startsWith('video/');
      const tag = isVideo ? 'video' : 'img';
      const media = document.createElement(tag); media.src = mediaUrl(item);
      if(tag==='video'){ media.muted = true; media.loop = true; media.playsInline = true; }
      el.appendChild(media);
    }else if(item.driveId){
      isVideo = true; // các link Drive trong app này luôn là video demo
      const ifr = document.createElement('iframe');
      ifr.src = 'https://drive.google.com/file/d/'+item.driveId+'/preview';
      ifr.loading = 'lazy'; ifr.setAttribute('allow','autoplay');
      el.appendChild(ifr);
    }
    if(isVideo){
      const play = document.createElement('div'); play.className = 'mitem-play';
      el.appendChild(play);
    }
    el.addEventListener('click', ()=>openFullscreen(item));
    const tools = document.createElement('div'); tools.className = 'mitem-tools';
    const exp = document.createElement('button'); exp.className = 'micon-btn'; exp.textContent = '⤢'; exp.title = 'Xem toàn màn hình';
    exp.onclick = e=>{ e.stopPropagation(); openFullscreen(item); };
    const rm = document.createElement('button'); rm.className = 'micon-btn'; rm.textContent = '✕'; rm.title = 'Xoá';
    rm.onclick = async e=>{
      e.stopPropagation();
      const ep = endpointsFor(target);
      try{ await api('DELETE', ep.item(item.id)); }
      catch(err){ toast('⚠️ Xoá thất bại: ' + err.message); return; }
      items.splice(idx,1); rerender();
    };
    if(target.kind === 'row' && target.slot === 'result'){
      const star = document.createElement('button'); star.className = 'micon-btn micon-star' + (item.highlighted ? ' on' : '');
      star.textContent = item.highlighted ? '★' : '☆';
      star.title = item.highlighted ? 'Bỏ khỏi Highlights this week' : 'Đánh dấu highlight tuần này';
      star.onclick = async e=>{
        e.stopPropagation();
        const next = !item.highlighted;
        try{ await api('PATCH', endpointsFor(target).item(item.id), { highlighted: next }); }
        catch(err){ toast('⚠️ Lưu highlight thất bại: ' + err.message); return; }
        item.highlighted = next;
        star.className = 'micon-btn micon-star' + (item.highlighted ? ' on' : '');
        star.textContent = item.highlighted ? '★' : '☆';
        star.title = item.highlighted ? 'Bỏ khỏi Highlights this week' : 'Đánh dấu highlight tuần này';
        renderHighlightGrid();
      };
      tools.appendChild(star);
    }
    tools.appendChild(exp); tools.appendChild(rm);
    const titleWrap = document.createElement('div'); titleWrap.className = 'mitem-title-wrap';
    const cap = document.createElement('div'); cap.className = 'mitem-title'; cap.contentEditable = true;
    cap.setAttribute('data-placeholder','—'); cap.textContent = item.caption || '';
    cap.addEventListener('click', e=>e.stopPropagation());
    cap.addEventListener('blur', async ()=>{
      const val = cap.textContent.trim();
      if(val === (item.caption||'')) return;
      item.caption = val;
      const ep = endpointsFor(target);
      try{ await api('PATCH', ep.item(item.id), { caption: val }); }
      catch(err){ toast('⚠️ Lưu caption thất bại: ' + err.message); }
    });
    titleWrap.appendChild(cap);
    el.appendChild(titleWrap);
    el.appendChild(tools);
    wrap.appendChild(el);
    return wrap;
  }
  function renderMediaStack(host, items, target, rerender){
    host.innerHTML = '';
    items.forEach((item, idx)=> host.appendChild(renderMediaItem(item, items, idx, target, rerender)));
    const addWrap = document.createElement('div'); addWrap.className = 'madd-wrap';
    const add = document.createElement('div'); add.className = 'madd'; add.textContent = '+';
    add.title = 'Click để thêm — hoặc Cmd/Ctrl+V để dán, kéo-thả file';
    add.addEventListener('click', async ()=>{
      selectAddTile(add, items, target, rerender);
      const result = await openAddMediaModal();
      if(!result) return;
      if(result.mode === 'drive'){
        const driveId = extractDriveId(result.driveInput);
        if(!driveId){ toast('⚠️ Không nhận diện được link/ID Drive'); return; }
        await addDriveMedia(items, target, driveId, rerender, result.caption);
      }else{
        if(!result.file){ toast('⚠️ Chưa chọn file nào'); return; }
        await addMediaFile(items, target, result.file, rerender, result.caption);
      }
    });
    add.addEventListener('dragover', e=>{ e.preventDefault(); add.classList.add('selected'); });
    add.addEventListener('drop', e=>{
      e.preventDefault();
      const f = [...e.dataTransfer.files].find(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
      if(f) addMediaFile(items, target, f, rerender);
    });
    addWrap.appendChild(add);
    host.appendChild(addWrap);
  }

  /* =====================================================================
     STATE (loaded once from GET /api/state, mutated locally, synced
     back field-by-field on each edit)
     ===================================================================== */
  let bookwiseRowsState = [];
  let soulieRowsState = [];
  let notesGalState = [];
  let swState = {};
  let weeksState = []; // [{ key, label }], sorted oldest -> newest
  let uiState = { collapsed:{}, texts:{}, groupCollapsed:{} };
  function latestWeek(){ return weeksState.length ? weeksState[weeksState.length-1] : null; }

  function debounce(fn, ms){
    let t;
    return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
  }
  const saveUI = debounce(async ()=>{
    try{ await api('PUT', '/api/ui', uiState); }
    catch(e){ toast('⚠️ Lưu UI thất bại: ' + e.message); }
  }, 300);

  /* =====================================================================
     EXPERIMENT ROW CARD — shared by BookWise and Soulie sections
     ===================================================================== */
  function createExpRow(row, appKey){
    const el = document.createElement('div'); el.className = 'exp-row'; el.id = 'exp-row-' + row.id;
    el.style.setProperty('--rowaccent', appKey === 'soulie' ? 'var(--soulie)' : 'var(--bookwise)');

    async function patchRow(fields){
      try{ await api('PATCH', '/api/rows/'+row.id, fields); }
      catch(e){ toast('⚠️ Lưu thất bại: ' + e.message); }
    }

    const col1 = document.createElement('div'); col1.className = 'exp-block';
    const head = document.createElement('div'); head.className = 'exp-head';
    const kindBtn = document.createElement('button'); kindBtn.className = 'kind-toggle';
    kindBtn.textContent = row.mediaKind === 'image' ? 'Image' : 'Video';
    kindBtn.onclick = ()=>{
      row.mediaKind = row.mediaKind === 'image' ? 'video' : 'image';
      kindBtn.textContent = row.mediaKind === 'image' ? 'Image' : 'Video';
      patchRow({ mediaKind: row.mediaKind }); renderSummary(); renderHighlightGrid();
    };
    head.appendChild(kindBtn);
    const delBtn = document.createElement('button'); delBtn.className = 'kind-toggle'; delBtn.textContent = '✕ Xoá dòng';
    delBtn.title = 'Xoá cả dòng experiment này';
    delBtn.onclick = async ()=>{
      if(!confirm('Xoá dòng "' + (row.visualStyle || 'Unknown') + '"? Không thể hoàn tác.')) return;
      try{ await api('DELETE', '/api/rows/'+row.id); }
      catch(e){ toast('⚠️ Xoá thất bại: ' + e.message); return; }
      const arr = appKey === 'soulie' ? soulieRowsState : bookwiseRowsState;
      const idx = arr.findIndex(r=>r.id === row.id);
      if(idx !== -1) arr.splice(idx, 1);
      renderAllRows(); renderSummary(); renderHighlightGrid();
    };
    head.appendChild(delBtn);
    col1.appendChild(head);
    const nameEl = document.createElement('div'); nameEl.className = 'exp-name'; nameEl.contentEditable = true;
    nameEl.setAttribute('data-placeholder','Tên visual style…');
    nameEl.textContent = row.visualStyle || '';
    nameEl.addEventListener('blur', ()=>{ row.visualStyle = nameEl.textContent.trim(); patchRow({ visualStyle: row.visualStyle }); renderSummary(); renderHighlightGrid(); });
    col1.appendChild(nameEl);
    if(row.title){
      const t = document.createElement('div'); t.className = 'row-title'; t.textContent = row.title + (row.dur ? ' · '+row.dur : '');
      col1.appendChild(t);
    }
    const inputDesc = document.createElement('div'); inputDesc.className = 'exp-input'; inputDesc.contentEditable = true;
    inputDesc.setAttribute('data-placeholder','Mô tả yêu cầu đầu vào…');
    inputDesc.innerHTML = row.inputDesc || '';
    inputDesc.addEventListener('blur', ()=>{ row.inputDesc = inputDesc.innerHTML.trim(); patchRow({ inputDesc: row.inputDesc }); });
    col1.appendChild(inputDesc);

    const mediaCols = document.createElement('div'); mediaCols.className = 'exp-block exp-media-cols';
    function updateColBalance(){
      const n = row.reference.length;
      // Ngân sách bề rộng cột Reference tách biệt với kích thước tile hiển thị (260/210/170/150px) —
      // để Reference ít/trống thì nhường phần lớn không gian cho Kết quả, dư thì tự cuộn ngang.
      const slots = n === 0 ? 1 : Math.min(n, 3) + 1;
      const refWidth = slots * 180 + (slots - 1) * 14;
      mediaCols.style.gridTemplateColumns = refWidth + 'px 1fr';
    }

    const col2 = document.createElement('div');
    col2.innerHTML = '<div class="col-label">Reference</div>';
    const refHost = document.createElement('div'); refHost.className = 'mstack mstack-row';
    col2.appendChild(refHost);
    const refTarget = { kind:'row', rowId: row.id, slot:'reference' };
    const rerenderRef = ()=>{ renderMediaStack(refHost, row.reference, refTarget, rerenderRef); updateColBalance(); };
    rerenderRef();

    const col3 = document.createElement('div');
    col3.innerHTML = '<div class="col-label">Kết quả của Tool</div>';
    const toolChip = document.createElement('div'); toolChip.className = 'tool-name'; toolChip.contentEditable = true;
    toolChip.setAttribute('data-placeholder','Tên tool…');
    toolChip.textContent = row.tool || '';
    toolChip.addEventListener('blur', ()=>{ row.tool = toolChip.textContent.trim(); patchRow({ tool: row.tool }); });
    col3.appendChild(toolChip);
    const resHost = document.createElement('div'); resHost.className = 'mstack mstack-row';
    col3.appendChild(resHost);
    const resTarget = { kind:'row', rowId: row.id, slot:'result' };
    const rerenderRes = ()=>{ renderMediaStack(resHost, row.result, resTarget, rerenderRes); renderHighlightGrid(); };
    rerenderRes();

    mediaCols.appendChild(col2); mediaCols.appendChild(col3);
    updateColBalance();

    const col4 = document.createElement('div'); col4.className = 'exp-block';
    col4.innerHTML = '<div class="col-label">Nhận xét</div>';
    const comment = document.createElement('div'); comment.className = 'row-comment'; comment.contentEditable = true;
    comment.setAttribute('data-placeholder','Thêm nhận xét…');
    comment.innerHTML = row.comment || '';
    comment.addEventListener('blur', ()=>{ row.comment = comment.innerHTML.trim(); patchRow({ comment: row.comment }); });
    col4.appendChild(comment);

    el.appendChild(col1); el.appendChild(mediaCols); el.appendChild(col4);
    return el;
  }

  function renderRowsGroup(stateArr, appKey, week, rowsHost, cntEl){
    rowsHost.innerHTML = '';
    const rows = stateArr.filter(r=>r.dateGroup === week.key);
    cntEl.textContent = rows.reduce((sum,r)=>sum+(r.result||[]).length, 0);
    if(!rows.length){
      const empty = document.createElement('div'); empty.className = 'empty-group';
      empty.textContent = 'Chưa có experiment nào trong tuần này';
      rowsHost.appendChild(empty);
      return;
    }
    rows.forEach(r=>rowsHost.appendChild(createExpRow(r, appKey)));
  }

  let groupHosts = { bookwise:{}, soulie:{} }; // groupHosts[appKey][weekKey] = { rowsHost, cntEl }

  function createGroupBlock(appKey, week){
    const gkey = (appKey === 'soulie' ? 'sl-' : 'bw-') + week.key;
    const bodyId = 'body-' + gkey;
    const block = document.createElement('div'); block.className = 'group-block';

    const head = document.createElement('div'); head.className = 'group-head';
    head.dataset.gkey = gkey; head.dataset.target = bodyId;
    const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '▸';
    const h3 = document.createElement('h3'); h3.textContent = week.label;
    const cntEl = document.createElement('span'); cntEl.className = 'cnt'; cntEl.textContent = '0';
    head.appendChild(arrow); head.appendChild(h3); head.appendChild(cntEl);
    head.addEventListener('click', ()=>{
      uiState.groupCollapsed = uiState.groupCollapsed || {};
      uiState.groupCollapsed[gkey] = !isGroupCollapsed(gkey);
      applyGroupUI(); saveUI();
    });

    const body = document.createElement('div'); body.className = 'group-body collapsed'; body.id = bodyId;
    const rowsHost = document.createElement('div');
    body.appendChild(rowsHost);

    const addBtn = document.createElement('button'); addBtn.className = 'row-add'; addBtn.textContent = '+ Thêm experiment';
    addBtn.addEventListener('click', async ()=>{
      const arr = appKey === 'soulie' ? soulieRowsState : bookwiseRowsState;
      try{
        const { id } = await api('POST', '/api/rows', { app: appKey, dateGroup: week.key });
        arr.push({ id, mediaKind:'video', visualStyle:'', title:'', dur:'', tool:'', dateGroup: week.key,
          inputDesc:'', comment:'', reference:[], result:[] });
        renderAllRows(); renderSummary();
      }catch(e){ toast('⚠️ Thêm experiment thất bại: ' + e.message); }
    });
    body.appendChild(addBtn);

    const swBlock = document.createElement('div'); swBlock.className = 'sw-block';
    const sw = document.createElement('div'); sw.className = 'sw';
    function buildSwCol(side, label, symbol){
      const col = document.createElement('div'); col.className = 'col ' + side;
      const h3s = document.createElement('h3'); h3s.textContent = symbol + ' ' + label;
      col.appendChild(h3s);
      const edit = document.createElement('div'); edit.className = 'sw-edit'; edit.contentEditable = true;
      edit.setAttribute('data-placeholder', side === 'good' ? 'Thêm điểm mạnh…' : 'Thêm điều cần cải thiện…');
      edit.innerHTML = (swState[gkey] && swState[gkey][side]) || '';
      edit.addEventListener('blur', async ()=>{
        swState[gkey] = swState[gkey] || { good:'', bad:'' };
        swState[gkey][side] = edit.innerHTML.trim();
        try{ await api('PUT', '/api/sw/'+gkey, swState[gkey]); }
        catch(e){ toast('⚠️ Lưu thất bại: ' + e.message); }
      });
      col.appendChild(edit);
      return col;
    }
    sw.appendChild(buildSwCol('good', 'Điểm mạnh', '▲'));
    sw.appendChild(buildSwCol('bad', 'Cần cải thiện', '▼'));
    swBlock.appendChild(sw);
    body.appendChild(swBlock);

    block.appendChild(head); block.appendChild(body);
    return { block, rowsHost, cntEl };
  }

  function renderGroupStructure(){
    ['bookwise','soulie'].forEach(appKey=>{
      const container = document.getElementById(appKey + '-groups');
      container.innerHTML = '';
      groupHosts[appKey] = {};
      weeksState.forEach(week=>{
        const { block, rowsHost, cntEl } = createGroupBlock(appKey, week);
        container.appendChild(block);
        groupHosts[appKey][week.key] = { rowsHost, cntEl };
      });
    });
    applyGroupUI();
  }

  function renderAllRows(){
    ['bookwise','soulie'].forEach(appKey=>{
      const stateArr = appKey === 'soulie' ? soulieRowsState : bookwiseRowsState;
      weeksState.forEach(week=>{
        const hosts = groupHosts[appKey][week.key];
        if(!hosts) return;
        renderRowsGroup(stateArr, appKey, week, hosts.rowsHost, hosts.cntEl);
      });
    });
  }

  /* =====================================================================
     OVERVIEW DASHBOARD + EXPERIMENT PLAN TABLE
     ===================================================================== */
  function computePlanRows(rows){
    const map = new Map();
    rows.forEach(r=>{
      const key = (r.visualStyle || 'Unknown') + '|' + r.mediaKind;
      if(!map.has(key)) map.set(key, { visualStyle: r.visualStyle || 'Unknown', mediaKind: r.mediaKind, count: 0, groups: new Set() });
      const e = map.get(key);
      e.count += (r.result||[]).length; e.groups.add(r.dateGroup);
    });
    const labelByKey = new Map(weeksState.map(w=>[w.key, w.label]));
    return [...map.values()].map(e=>({
      visualStyle: e.visualStyle, mediaKind: e.mediaKind, count: e.count,
      groups: [...e.groups].map(g=>labelByKey.get(g) || g).join(', ')
    }));
  }

  let kpiFilter = 'all'; // 'all' | 'video' | 'image'
  function matchesKpiFilter(row){ return kpiFilter === 'all' || row.mediaKind === kpiFilter; }
  function kpiTile(label, big, sub, cls){
    const el = document.createElement('div'); el.className = 'kpi-tile' + (cls ? ' ' + cls : '');
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = label;
    const bigEl = document.createElement('div'); bigEl.className = 'big'; bigEl.textContent = big;
    const subEl = document.createElement('div'); subEl.className = 'sub'; subEl.textContent = sub;
    el.appendChild(lbl); el.appendChild(bigEl); el.appendChild(subEl);
    return el;
  }
  function kpiTableRow(label, bw, sl, total){
    const tr = document.createElement('tr');
    [label, bw, sl, total].forEach(v=>{ const td = document.createElement('td'); td.textContent = v; tr.appendChild(td); });
    return tr;
  }
  function renderKpiSection(){
    const countVideos = rows => rows.filter(matchesKpiFilter).reduce((sum,r)=>sum+(r.result||[]).length, 0);
    const perWeek = weeksState.map(w=>({
      label: w.label,
      bw: countVideos(bookwiseRowsState.filter(r=>r.dateGroup === w.key)),
      sl: countVideos(soulieRowsState.filter(r=>r.dateGroup === w.key))
    }));
    const bwTotal = perWeek.reduce((s,w)=>s+w.bw, 0);
    const slTotal = perWeek.reduce((s,w)=>s+w.sl, 0);
    const total = bwTotal + slTotal;

    const tiles = document.getElementById('kpi-tiles');
    tiles.innerHTML = '';
    tiles.appendChild(kpiTile('Tổng creative', total, 'BookWise ' + bwTotal + ' · Soulie ' + slTotal, 'total'));
    tiles.appendChild(kpiTile('BookWise', bwTotal, perWeek.map(w=>w.bw).join(' → ') + ' qua ' + perWeek.length + ' tuần', 'bookwise'));
    tiles.appendChild(kpiTile('Soulie', slTotal, perWeek.map(w=>w.sl).join(' → ') + ' qua ' + perWeek.length + ' tuần', 'soulie'));

    const body = document.getElementById('kpi-table-body');
    body.innerHTML = '';
    perWeek.forEach(w=> body.appendChild(kpiTableRow(w.label, w.bw, w.sl, w.bw + w.sl)));
    body.appendChild(kpiTableRow('Tổng', bwTotal, slTotal, total));
  }
  document.querySelectorAll('.kpi-filter-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.kpi-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      kpiFilter = btn.dataset.kind;
      renderKpiSection();
    });
  });
  const planExpanded = { bookwise:false, soulie:false };
  const PLAN_TABLE_CAP = 10;
  function renderPlanColumn(appKey, rows, bodyId){
    const body = document.getElementById(bodyId);
    body.innerHTML = '';
    const planRows = computePlanRows(rows);
    if(!planRows.length){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;color:#B7B0A2;font-style:italic">Chưa có thực nghiệm nào</td>';
      body.appendChild(tr);
      return;
    }
    const lw = latestWeek();
    const recentFirst = lw ? planRows.filter(e=>(e.groups||'').includes(lw.label)) : [];
    const rest = lw ? planRows.filter(e=>!(e.groups||'').includes(lw.label)) : planRows;
    const sorted = recentFirst.concat(rest);
    const visible = planExpanded[appKey] ? sorted : sorted.slice(0, PLAN_TABLE_CAP);
    visible.forEach(e=>{
      const tr = document.createElement('tr');
      const tdStyle = document.createElement('td'); tdStyle.textContent = e.visualStyle;
      const tdKind = document.createElement('td'); tdKind.className = 'kind-cell';
      const kindBadge = document.createElement('span'); kindBadge.className = 'badge kind';
      kindBadge.textContent = e.mediaKind === 'image' ? 'Image' : 'Video';
      tdKind.appendChild(kindBadge);
      const tdCount = document.createElement('td'); tdCount.className = 'count'; tdCount.textContent = e.count;
      const tdGroups = document.createElement('td'); tdGroups.textContent = e.groups;
      tr.appendChild(tdStyle); tr.appendChild(tdKind); tr.appendChild(tdCount); tr.appendChild(tdGroups);
      const matches = rows.filter(r=>(r.visualStyle||'Unknown')===e.visualStyle && r.mediaKind===e.mediaKind);
      const match = (lw && matches.find(r=>r.dateGroup===lw.key)) || matches[0];
      if(match){
        tr.className = 'plan-row-link';
        tr.title = 'Xem chi tiết experiment này';
        tr.addEventListener('click', ()=>scrollToExpRow(match.id, appKey, match.dateGroup));
      }
      body.appendChild(tr);
    });
    if(sorted.length > PLAN_TABLE_CAP){
      const tr = document.createElement('tr');
      const td = document.createElement('td'); td.colSpan = 4; td.style.textAlign = 'center';
      const btn = document.createElement('button'); btn.className = 'sync-btn';
      btn.textContent = planExpanded[appKey] ? '↑ Thu gọn' : '↓ Xem thêm (' + (sorted.length - PLAN_TABLE_CAP) + ' còn lại)';
      btn.onclick = ()=>{ planExpanded[appKey] = !planExpanded[appKey]; renderPlanColumn(appKey, rows, bodyId); };
      td.appendChild(btn); tr.appendChild(td); body.appendChild(tr);
    }
  }
  function renderPlanTable(){
    renderPlanColumn('bookwise', bookwiseRowsState, 'plan-table-body-bookwise');
    renderPlanColumn('soulie', soulieRowsState, 'plan-table-body-soulie');
  }

  function renderSummary(){
    renderKpiSection();
    renderPlanTable();
  }

  /* =====================================================================
     HIGHLIGHTS THIS WEEK — grid of latest-batch result videos, each
     playing/pausing itself as it scrolls in/out of view
     ===================================================================== */
  const HIGHLIGHT_MAX = 24;
  let selectedHighlightWeekKey = null;
  function highlightWeek(){
    return weeksState.find(w=>w.key === selectedHighlightWeekKey) || latestWeek();
  }
  function renderHighlightWeekSelect(){
    const dd = document.getElementById('hl-week-dd');
    const btn = document.getElementById('hl-week-dd-btn');
    const list = document.getElementById('hl-week-dd-list');
    const lw = latestWeek();
    if(!selectedHighlightWeekKey || !weeksState.some(w=>w.key === selectedHighlightWeekKey)){
      selectedHighlightWeekKey = lw ? lw.key : '';
    }
    list.innerHTML = '';
    weeksState.forEach(w=>{
      const li = document.createElement('li');
      li.className = 'hl-week-dd-item' + (w.key === selectedHighlightWeekKey ? ' active' : '');
      li.textContent = w.label;
      li.onclick = ()=>{
        selectedHighlightWeekKey = w.key;
        dd.classList.remove('on');
        renderHighlightWeekSelect();
        renderHighlightGrid();
      };
      list.appendChild(li);
    });
    const current = weeksState.find(w=>w.key === selectedHighlightWeekKey);
    btn.textContent = current ? current.label : '';
    btn.onclick = (e)=>{ e.stopPropagation(); dd.classList.toggle('on'); };
  }
  document.addEventListener('click', (e)=>{
    const dd = document.getElementById('hl-week-dd');
    if(dd && !dd.contains(e.target)) dd.classList.remove('on');
  });
  function buildHighlightList(){
    const wk = highlightWeek();
    if(!wk) return [];
    const list = [];
    [ ['Soulie','soulie', soulieRowsState], ['BookWise','bookwise', bookwiseRowsState] ].forEach(([appLabel, appCls, arr])=>{
      arr.filter(r=>r.dateGroup === wk.key && r.mediaKind === 'video').forEach(r=>{
        (r.result||[]).filter(m=>m.highlighted).forEach(m=>{
          const label = r.visualStyle || r.tool || 'Unknown';
          if(m.mediaId) list.push({ kind:'upload', url: mediaUrl(m), mediaId: m.mediaId, mediaType: m.mediaType, appLabel, appCls, label, rowId: r.id, dateGroup: r.dateGroup });
          else if(m.driveId) list.push({ kind:'drive', driveId: m.driveId, appLabel, appCls, label, rowId: r.id, dateGroup: r.dateGroup });
        });
      });
    });
    return list;
  }
  let hlObserver = null;
  function renderHighlightGrid(){
    const host = document.getElementById('highlight-grid');
    const sub = document.getElementById('highlight-sub');
    host.innerHTML = '';
    if(hlObserver) hlObserver.disconnect();
    const wk = highlightWeek();
    const wkLabel = wk ? wk.label : 'tuần gần nhất';
    const full = buildHighlightList();
    const list = full.slice(0, HIGHLIGHT_MAX);
    sub.textContent = full.length > HIGHLIGHT_MAX
      ? 'Video được chọn highlight của tuần ' + wkLabel + ' (đang hiện ' + HIGHLIGHT_MAX + '/' + full.length + ')'
      : 'Video được chọn highlight của tuần ' + wkLabel;
    if(!list.length){
      host.className = 'highlight-grid empty-note';
      host.textContent = 'Chưa chọn video highlight nào cho tuần ' + wkLabel + ' — bấm ☆ trên video kết quả để thêm';
      return;
    }
    host.className = 'highlight-grid';
    hlObserver = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const card = entry.target;
        if(card.dataset.kind === 'upload'){
          const video = card.querySelector('video');
          if(!video) return;
          if(entry.isIntersecting) video.play().catch(()=>{});
          else video.pause();
        }else if(entry.isIntersecting && !card.dataset.loaded){
          // NOTE: Drive's `mute` URL param isn't an official/reliable API — this autoplay
          // can still end up with sound depending on the browser's autoplay heuristics.
          const ifr = card.querySelector('iframe');
          if(ifr){ ifr.src = 'https://drive.google.com/file/d/'+card.dataset.driveId+'/preview?autoplay=1&mute=1'; card.dataset.loaded = '1'; }
        }
      });
    }, { threshold: 0.5 });
    list.forEach(item=>{
      const card = document.createElement('div'); card.className = 'hl-card'; card.dataset.kind = item.kind;
      if(item.kind === 'drive') card.dataset.driveId = item.driveId;
      let video = null, ifr = null;
      if(item.kind === 'upload'){
        video = document.createElement('video');
        video.muted = true; video.loop = true; video.playsInline = true; video.src = item.url;
        video.addEventListener('loadeddata', ()=>card.classList.add('hl-ready'), { once:true });
        video.addEventListener('error', ()=>card.classList.add('hl-ready'), { once:true });
        card.appendChild(video);
      }else{
        ifr = document.createElement('iframe');
        ifr.loading = 'lazy'; ifr.setAttribute('allow','autoplay');
        ifr.addEventListener('load', ()=>card.classList.add('hl-ready'), { once:true });
        card.appendChild(ifr);
      }
      const badge = document.createElement('div'); badge.className = 'hl-badge ' + item.appCls; badge.textContent = item.appLabel;
      badge.title = 'Xem chi tiết experiment này';
      badge.addEventListener('click', e=>{
        e.stopPropagation();
        scrollToExpRow(item.rowId, item.appCls, item.dateGroup);
      });
      const titleWrap = document.createElement('div'); titleWrap.className = 'hl-title-wrap';
      const title = document.createElement('div'); title.className = 'hl-title'; title.textContent = item.label;
      titleWrap.appendChild(title);
      const jumpBtn = document.createElement('button'); jumpBtn.className = 'hl-jump'; jumpBtn.textContent = '→';
      jumpBtn.title = 'Xem chi tiết experiment này';
      jumpBtn.addEventListener('click', e=>{
        e.stopPropagation();
        scrollToExpRow(item.rowId, item.appCls, item.dateGroup);
      });
      const tools = document.createElement('div'); tools.className = 'hl-tools';
      const zoomBtn = document.createElement('button'); zoomBtn.className = 'hl-tool-btn'; zoomBtn.textContent = '⤢';
      zoomBtn.title = 'Xem toàn màn hình';
      zoomBtn.addEventListener('click', e=>{ e.stopPropagation(); openFullscreen(item); });
      tools.appendChild(zoomBtn);
      if(item.kind === 'upload'){
        const muteBtn = document.createElement('button'); muteBtn.className = 'hl-tool-btn';
        function setMuteIcon(){
          muteBtn.textContent = video.muted ? '🔇' : '🔊';
          muteBtn.title = video.muted ? 'Bật tiếng' : 'Tắt tiếng';
        }
        setMuteIcon();
        muteBtn.addEventListener('click', e=>{ e.stopPropagation(); video.muted = !video.muted; setMuteIcon(); });
        const back10Btn = document.createElement('button'); back10Btn.className = 'hl-tool-btn'; back10Btn.textContent = '⏪';
        back10Btn.title = 'Lùi 10s';
        back10Btn.addEventListener('click', e=>{ e.stopPropagation(); video.currentTime = Math.max(0, video.currentTime - 10); });
        const fwd10Btn = document.createElement('button'); fwd10Btn.className = 'hl-tool-btn'; fwd10Btn.textContent = '⏩';
        fwd10Btn.title = 'Tiến 10s';
        fwd10Btn.addEventListener('click', e=>{ e.stopPropagation(); video.currentTime = Math.min(video.duration || 1e9, video.currentTime + 10); });
        tools.appendChild(muteBtn); tools.appendChild(back10Btn); tools.appendChild(fwd10Btn);
      }
      // Google Drive embed is cross-origin — mute/seek can't be scripted from outside the iframe,
      // so no mute/tua controls are shown for Drive cards. Open fullscreen (⤢) to use Google's own player controls.
      const playBtn = document.createElement('button'); playBtn.className = 'hl-tool-btn'; playBtn.textContent = '⏸';
      playBtn.title = 'Tạm dừng';
      function setPlayIcon(playing){
        playBtn.textContent = playing ? '⏸' : '▶';
        playBtn.title = playing ? 'Tạm dừng' : 'Phát tiếp';
      }
      function togglePlay(){
        if(item.kind === 'upload'){
          if(!video) return;
          if(video.paused){ video.play().catch(()=>{}); setPlayIcon(true); }
          else{ video.pause(); setPlayIcon(false); }
        }else{
          if(!ifr) return;
          if(card.dataset.stopped === '1'){
            ifr.src = 'https://drive.google.com/file/d/'+item.driveId+'/preview?autoplay=1&mute=1';
            card.dataset.stopped = '0';
            setPlayIcon(true);
          }else{
            ifr.src = '';
            card.dataset.stopped = '1';
            setPlayIcon(false);
          }
        }
      }
      playBtn.addEventListener('click', e=>{ e.stopPropagation(); togglePlay(); });
      tools.appendChild(playBtn);
      card.appendChild(badge); card.appendChild(titleWrap); card.appendChild(jumpBtn); card.appendChild(tools);
      card.addEventListener('click', togglePlay);
      host.appendChild(card);
      hlObserver.observe(card);
    });
  }

  /* =====================================================================
     NOTES STACK (free-form paste-able area, same component as rows)
     ===================================================================== */
  const notesTarget = { kind:'notes' };
  function renderNotesStack(){
    renderMediaStack(document.getElementById('notes-stack'), notesGalState, notesTarget, renderNotesStack);
  }

  /* =====================================================================
     COLLAPSIBLE DATE-RANGE GROUPS — default collapsed
     ===================================================================== */
  function isGroupCollapsed(key){
    return uiState.groupCollapsed && Object.prototype.hasOwnProperty.call(uiState.groupCollapsed, key)
      ? uiState.groupCollapsed[key] : true;
  }
  function applyGroupUI(){
    document.querySelectorAll('.group-head').forEach(h=>{
      const key = h.dataset.gkey;
      const body = document.getElementById(h.dataset.target);
      const collapsed = isGroupCollapsed(key);
      body.classList.toggle('collapsed', collapsed);
      h.querySelector('.arrow').textContent = collapsed ? '▸' : '▾';
    });
  }
  document.querySelectorAll('.group-head').forEach(h=>{
    h.addEventListener('click', ()=>{
      const key = h.dataset.gkey;
      uiState.groupCollapsed = uiState.groupCollapsed || {};
      uiState.groupCollapsed[key] = !isGroupCollapsed(key);
      applyGroupUI(); saveUI();
    });
  });

  /* =====================================================================
     SECTION UI (collapse / sidebar / data-editable-text)
     ===================================================================== */
  function applyUIState(){
    document.querySelectorAll('section[id]').forEach(sec=>{
      const collapsed = !!uiState.collapsed[sec.id];
      sec.classList.toggle('collapsed', collapsed);
      document.querySelectorAll('[data-section="'+sec.id+'"]').forEach(btn=>{
        if(btn.classList.contains('sec-toggle') || btn.classList.contains('sb-toggle')){
          btn.textContent = collapsed ? '▸' : '▾';
        }
        if(btn.classList.contains('sb-week')) btn.classList.toggle('sb-week-hidden', collapsed);
      });
    });
    Object.keys(uiState.texts).forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.innerHTML = uiState.texts[id];
    });
    applyGroupUI();
  }
  function toggleSection(id){ uiState.collapsed[id] = !uiState.collapsed[id]; applyUIState(); saveUI(); }

  function scrollToExpRow(rowId, appKey, dateGroup){
    uiState.collapsed[appKey] = false;
    uiState.groupCollapsed = uiState.groupCollapsed || {};
    const groupKey = (appKey === 'soulie' ? 'sl-' : 'bw-') + dateGroup;
    uiState.groupCollapsed[groupKey] = false;
    applyUIState(); saveUI();
    requestAnimationFrame(()=>{
      const el = document.getElementById('exp-row-' + rowId);
      if(!el) return;
      el.scrollIntoView({ behavior:'smooth', block:'center' });
      el.classList.add('flash');
      setTimeout(()=>el.classList.remove('flash'), 1600);
    });
  }
  (function initSectionsUI(){
    document.querySelectorAll('.sec-toggle, .sb-toggle').forEach(btn=>{
      btn.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); toggleSection(btn.dataset.section); });
    });
    document.querySelectorAll('.sb-item').forEach(a=>{
      a.addEventListener('click', e=>{
        if(e.target.closest('.sb-toggle')) return;
        const id = a.dataset.section;
        if(uiState.collapsed[id]){ uiState.collapsed[id] = false; applyUIState(); saveUI(); }
      });
    });
    document.querySelectorAll('[data-editable-text]').forEach(el=>{
      el.addEventListener('blur', ()=>{ uiState.texts[el.id] = el.innerHTML; saveUI(); });
    });
  })();

  function renderSidebarWeeks(){
    ['bookwise','soulie'].forEach(appKey=>{
      const container = document.getElementById('sb-weeks-' + appKey);
      container.innerHTML = '';
      weeksState.forEach(week=>{
        const gkey = (appKey === 'soulie' ? 'sl-' : 'bw-') + week.key;
        const a = document.createElement('a'); a.className = 'sb-week'; a.textContent = week.label;
        a.dataset.section = appKey; a.dataset.gkey = gkey;
        a.addEventListener('click', ()=>{
          uiState.collapsed[appKey] = false;
          uiState.groupCollapsed = uiState.groupCollapsed || {};
          uiState.groupCollapsed[gkey] = false;
          applyUIState(); saveUI();
          requestAnimationFrame(()=>{
            const head = document.querySelector('.group-head[data-gkey="'+gkey+'"]');
            if(head) head.scrollIntoView({ behavior:'smooth', block:'start' });
          });
        });
        container.appendChild(a);
      });
    });
  }

  /* =====================================================================
     ADD WEEK MODAL — pick a date range, creates the week for both apps
     ===================================================================== */
  const weekModal = document.getElementById('weekmodal');
  const weekStartInput = document.getElementById('week-start-input');
  const weekEndInput = document.getElementById('week-end-input');
  document.getElementById('add-week-btn').addEventListener('click', ()=>{
    weekStartInput.value = ''; weekEndInput.value = '';
    weekModal.classList.add('on');
  });
  document.getElementById('week-cancel').addEventListener('click', ()=>weekModal.classList.remove('on'));
  weekModal.addEventListener('click', e=>{ if(e.target === weekModal) weekModal.classList.remove('on'); });
  document.getElementById('week-ok').addEventListener('click', async ()=>{
    const startDate = weekStartInput.value, endDate = weekEndInput.value;
    if(!startDate || !endDate){ toast('⚠️ Chọn đủ ngày bắt đầu và kết thúc'); return; }
    try{
      const week = await api('POST', '/api/weeks', { startDate, endDate });
      weeksState.push({ key: week.key, label: week.label });
      weekModal.classList.remove('on');
      renderGroupStructure();
      renderAllRows();
      renderSidebarWeeks();
      renderSummary();
      renderHighlightWeekSelect();
      renderHighlightGrid();
      toast('✓ Đã thêm tuần ' + week.label);
    }catch(e){ toast('⚠️ Thêm tuần thất bại: ' + e.message); }
  });

  /* =====================================================================
     INIT
     ===================================================================== */
  async function init(){
    try{
      const state = await api('GET', '/api/state');
      bookwiseRowsState = state.rows.bookwise;
      soulieRowsState = state.rows.soulie;
      notesGalState = state.notesMedia;
      swState = state.swState;
      weeksState = state.weeks || [];
      uiState = { collapsed: state.uiState.collapsed || {}, texts: state.uiState.texts || {}, groupCollapsed: state.uiState.groupCollapsed || {} };
    }catch(e){
      toast('⚠️ Không tải được dữ liệu từ server: ' + e.message);
      return;
    }
    renderGroupStructure();
    renderSidebarWeeks();
    renderAllRows();
    renderSummary();
    renderHighlightWeekSelect();
    renderHighlightGrid();
    renderNotesStack();
    applyUIState();
  }

  init();
})();
