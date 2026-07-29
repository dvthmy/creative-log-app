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
  function openFullscreen(item){
    fsFrame.innerHTML = '';
    fsFrame.style.aspectRatio = '9/16'; // mặc định — sẽ khớp lại đúng tỉ lệ thật nếu biết được
    if(item.mediaId){
      const url = mediaUrl(item);
      const isVideo = (item.mediaType||'').startsWith('video/');
      const el = document.createElement(isVideo ? 'video' : 'img');
      el.src = url;
      if(isVideo){
        el.controls = true; el.autoplay = true; el.loop = true; el.playsInline = true;
        el.addEventListener('loadedmetadata', ()=>{
          if(el.videoWidth && el.videoHeight) fsFrame.style.aspectRatio = el.videoWidth + '/' + el.videoHeight;
        });
      }else{
        el.addEventListener('load', ()=>{
          if(el.naturalWidth && el.naturalHeight) fsFrame.style.aspectRatio = el.naturalWidth + '/' + el.naturalHeight;
        });
      }
      fsFrame.appendChild(el);
    }else if(item.driveId){
      const ifr = document.createElement('iframe');
      ifr.src = 'https://drive.google.com/file/d/'+item.driveId+'/preview';
      ifr.setAttribute('allow','autoplay; fullscreen'); ifr.setAttribute('allowfullscreen','');
      fsFrame.appendChild(ifr);
    }else return;
    fsModal.classList.add('on');
  }
  function closeFullscreen(){ fsModal.classList.remove('on'); fsFrame.innerHTML = ''; }
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
  let uiState = { collapsed:{}, texts:{}, groupCollapsed:{} };

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
    const el = document.createElement('div'); el.className = 'exp-row';
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
      if(!confirm('Xoá dòng "' + (row.visualStyle || '(chưa đặt tên)') + '"? Không thể hoàn tác.')) return;
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

    const col2 = document.createElement('div'); col2.className = 'exp-block';
    col2.innerHTML = '<div class="col-label">Reference</div>';
    const refHost = document.createElement('div'); refHost.className = 'mstack mstack-row';
    col2.appendChild(refHost);
    const refTarget = { kind:'row', rowId: row.id, slot:'reference' };
    const rerenderRef = ()=>renderMediaStack(refHost, row.reference, refTarget, rerenderRef);
    rerenderRef();

    const col3 = document.createElement('div'); col3.className = 'exp-block';
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

    const col4 = document.createElement('div'); col4.className = 'exp-block';
    col4.innerHTML = '<div class="col-label">Nhận xét</div>';
    const comment = document.createElement('div'); comment.className = 'row-comment'; comment.contentEditable = true;
    comment.setAttribute('data-placeholder','Thêm nhận xét…');
    comment.innerHTML = row.comment || '';
    comment.addEventListener('blur', ()=>{ row.comment = comment.innerHTML.trim(); patchRow({ comment: row.comment }); });
    col4.appendChild(comment);

    el.appendChild(col1); el.appendChild(col2); el.appendChild(col3); el.appendChild(col4);
    return el;
  }

  function renderRowsGroup(stateArr, appKey, group, hostId, cntId){
    const host = document.getElementById(hostId);
    host.innerHTML = '';
    const rows = stateArr.filter(r=>r.dateGroup === group);
    document.getElementById(cntId).textContent = rows.length;
    if(!rows.length){
      const empty = document.createElement('div'); empty.className = 'empty-group';
      empty.textContent = 'Chưa có experiment nào trong đợt này';
      host.appendChild(empty);
      return;
    }
    rows.forEach(r=>host.appendChild(createExpRow(r, appKey)));
  }
  function renderAllRows(){
    renderRowsGroup(bookwiseRowsState, 'bookwise', '1-14', 'bw-rows-1', 'bw-cnt-1');
    renderRowsGroup(bookwiseRowsState, 'bookwise', '15-28', 'bw-rows-2', 'bw-cnt-2');
    renderRowsGroup(soulieRowsState, 'soulie', '1-14', 'sl-rows-1', 'sl-cnt-1');
    renderRowsGroup(soulieRowsState, 'soulie', '15-28', 'sl-rows-2', 'sl-cnt-2');
  }
  document.querySelectorAll('.row-add').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const app = btn.dataset.app, group = btn.dataset.group;
      const arr = app === 'soulie' ? soulieRowsState : bookwiseRowsState;
      try{
        const { id } = await api('POST', '/api/rows', { app, dateGroup: group });
        arr.push({ id, mediaKind:'video', visualStyle:'', title:'', dur:'', tool:'', dateGroup:group,
          inputDesc:'', comment:'', reference:[], result:[] });
        renderAllRows(); renderSummary();
      }catch(e){ toast('⚠️ Thêm experiment thất bại: ' + e.message); }
    });
  });

  /* =====================================================================
     OVERVIEW DASHBOARD + EXPERIMENT PLAN TABLE
     ===================================================================== */
  function computePlanRows(rows){
    const map = new Map();
    rows.forEach(r=>{
      const key = (r.visualStyle || '(chưa đặt tên)') + '|' + r.mediaKind;
      if(!map.has(key)) map.set(key, { visualStyle: r.visualStyle || '(chưa đặt tên)', mediaKind: r.mediaKind, count: 0, groups: new Set() });
      const e = map.get(key);
      e.count++; e.groups.add(r.dateGroup);
    });
    return [...map.values()].map(e=>({
      visualStyle: e.visualStyle, mediaKind: e.mediaKind, count: e.count,
      groups: [...e.groups].map(g=>g==='1-14'?'01–14/07':g==='15-28'?'15–28/07':g).join(', ')
    }));
  }

  const WEEK_GROUPS = [['1-14','01–14/07'], ['15-28','15–28/07']];
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
    const perWeek = WEEK_GROUPS.map(([key, label])=>({
      label,
      bw: bookwiseRowsState.filter(r=>r.dateGroup === key && matchesKpiFilter(r)).length,
      sl: soulieRowsState.filter(r=>r.dateGroup === key && matchesKpiFilter(r)).length
    }));
    const bwTotal = perWeek.reduce((s,w)=>s+w.bw, 0);
    const slTotal = perWeek.reduce((s,w)=>s+w.sl, 0);
    const total = bwTotal + slTotal;

    const tiles = document.getElementById('kpi-tiles');
    tiles.innerHTML = '';
    tiles.appendChild(kpiTile('Tổng creative', total, 'BookWise ' + bwTotal + ' · Soulie ' + slTotal, 'total'));
    tiles.appendChild(kpiTile('BookWise', bwTotal, perWeek.map(w=>w.bw).join(' → ') + ' qua ' + perWeek.length + ' đợt', 'bookwise'));
    tiles.appendChild(kpiTile('Soulie', slTotal, perWeek.map(w=>w.sl).join(' → ') + ' qua ' + perWeek.length + ' đợt', 'soulie'));

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
    const recentFirst = planRows.filter(e=>(e.groups||'').includes('15–28/07'));
    const rest = planRows.filter(e=>!(e.groups||'').includes('15–28/07'));
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
  const HIGHLIGHT_DATE_GROUP = '15-28'; // batch gần nhất, giống quy ước 2 đợt cứng của app
  const HIGHLIGHT_MAX = 24;
  function buildHighlightList(){
    const list = [];
    [ ['Soulie','soulie', soulieRowsState], ['BookWise','bookwise', bookwiseRowsState] ].forEach(([appLabel, appCls, arr])=>{
      arr.filter(r=>r.dateGroup === HIGHLIGHT_DATE_GROUP && r.mediaKind === 'video').forEach(r=>{
        (r.result||[]).forEach(m=>{
          const label = r.visualStyle || r.tool || '(chưa đặt tên)';
          if(m.mediaId) list.push({ kind:'upload', url: mediaUrl(m), mediaId: m.mediaId, mediaType: m.mediaType, appLabel, appCls, label });
          else if(m.driveId) list.push({ kind:'drive', driveId: m.driveId, appLabel, appCls, label });
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
    const full = buildHighlightList();
    const list = full.slice(0, HIGHLIGHT_MAX);
    sub.textContent = full.length > HIGHLIGHT_MAX
      ? 'Video kết quả của đợt gần nhất (đang hiện ' + HIGHLIGHT_MAX + '/' + full.length + ')'
      : 'Video kết quả của đợt gần nhất';
    if(!list.length){
      host.className = 'highlight-grid empty-note';
      host.textContent = 'Chưa có video nào trong đợt gần nhất';
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
          const ifr = card.querySelector('iframe');
          if(ifr){ ifr.src = 'https://drive.google.com/file/d/'+card.dataset.driveId+'/preview'; card.dataset.loaded = '1'; }
        }
      });
    }, { threshold: 0.5 });
    list.forEach(item=>{
      const card = document.createElement('div'); card.className = 'hl-card'; card.dataset.kind = item.kind;
      if(item.kind === 'drive') card.dataset.driveId = item.driveId;
      if(item.kind === 'upload'){
        const video = document.createElement('video');
        video.muted = true; video.loop = true; video.playsInline = true; video.src = item.url;
        card.appendChild(video);
      }else{
        const ifr = document.createElement('iframe');
        ifr.loading = 'lazy'; ifr.setAttribute('allow','autoplay');
        card.appendChild(ifr);
      }
      const badge = document.createElement('div'); badge.className = 'hl-badge ' + item.appCls; badge.textContent = item.appLabel;
      const titleWrap = document.createElement('div'); titleWrap.className = 'hl-title-wrap';
      const title = document.createElement('div'); title.className = 'hl-title'; title.textContent = item.label;
      titleWrap.appendChild(title);
      card.appendChild(badge); card.appendChild(titleWrap);
      card.addEventListener('click', ()=>openFullscreen(item));
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
     STRENGTHS & IMPROVEMENTS — one editable block per date-range group
     ===================================================================== */
  function applySWState(){
    ['bw-1-14','bw-15-28','sl-1-14','sl-15-28'].forEach(key=>{
      ['good','bad'].forEach(side=>{
        const el = document.getElementById('sw-'+key+'-'+side);
        if(!el) return;
        el.innerHTML = (swState[key] && swState[key][side]) || '';
        el.addEventListener('blur', async ()=>{
          swState[key] = swState[key] || { good:'', bad:'' };
          swState[key][side] = el.innerHTML.trim();
          try{ await api('PUT', '/api/sw/'+key, swState[key]); }
          catch(e){ toast('⚠️ Lưu thất bại: ' + e.message); }
        });
      });
    });
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
      });
    });
    Object.keys(uiState.texts).forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.innerHTML = uiState.texts[id];
    });
    applyGroupUI();
  }
  function toggleSection(id){ uiState.collapsed[id] = !uiState.collapsed[id]; applyUIState(); saveUI(); }
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
      uiState = { collapsed: state.uiState.collapsed || {}, texts: state.uiState.texts || {}, groupCollapsed: state.uiState.groupCollapsed || {} };
    }catch(e){
      toast('⚠️ Không tải được dữ liệu từ server: ' + e.message);
      return;
    }
    renderAllRows();
    renderSummary();
    renderHighlightGrid();
    renderNotesStack();
    applySWState();
    applyUIState();
  }

  init();
})();
