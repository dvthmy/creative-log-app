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
    if(item.mediaId){
      const url = mediaUrl(item);
      const el = (item.mediaType||'').startsWith('video/') ? document.createElement('video') : document.createElement('img');
      el.src = url;
      if(el.tagName === 'VIDEO'){ el.controls = true; el.autoplay = true; el.loop = true; el.playsInline = true; }
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
     DRIVE-LINK MODAL — styled replacement for prompt()
     ===================================================================== */
  const driveModal = document.getElementById('drivemodal');
  const driveInput = document.getElementById('drive-input');
  let driveResolve = null;
  function openDriveModal(){
    return new Promise(resolve=>{
      driveResolve = resolve;
      driveInput.value = '';
      driveModal.classList.add('on');
      setTimeout(()=>driveInput.focus(), 0);
    });
  }
  function closeDriveModal(result){
    driveModal.classList.remove('on');
    if(driveResolve){ driveResolve(result); driveResolve = null; }
  }
  document.getElementById('drive-ok').addEventListener('click', ()=>closeDriveModal(driveInput.value));
  document.getElementById('drive-cancel').addEventListener('click', ()=>closeDriveModal(null));
  driveModal.addEventListener('click', e=>{ if(e.target === driveModal) closeDriveModal(null); });
  driveInput.addEventListener('keydown', e=>{
    if(e.key === 'Enter') closeDriveModal(driveInput.value);
    if(e.key === 'Escape') closeDriveModal(null);
  });

  /* =====================================================================
     MEDIA STACK — a paste-able / uploadable list of images or videos.
     `target` describes where new items get POSTed and how existing items
     get PATCHed/DELETEd:
       { kind:'row', rowId, slot: 'reference'|'result' }  -> /api/rows/:rowId/media , /api/row-media/:id
       { kind:'notes' }                                    -> /api/notes/media , /api/notes/media/:id
     ===================================================================== */
  let selectedAdd = null; // { items, target, rerender }
  let uploadTarget = null;

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
  async function addMediaFile(items, target, file, rerender){
    if(file.size > 200*1048576){ toast('⚠️ File over 200MB — nén lại trước'); return; }
    const ep = endpointsFor(target);
    const fd = new FormData();
    fd.append('file', file);
    if(target.kind === 'row') fd.append('slot', target.slot);
    try{
      const item = await api('POST', ep.add, fd);
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
  async function addDriveMedia(items, target, driveId, rerender){
    const ep = endpointsFor(target);
    const body = { driveId };
    if(target.kind === 'row') body.slot = target.slot;
    try{
      const item = await api('POST', ep.add, body);
      items.push(item);
      rerender();
      toast('✓ Đã thêm video Drive');
    }catch(e){ toast('⚠️ Thêm thất bại: ' + e.message); }
  }
  document.getElementById('madd-file-input').addEventListener('change', function(){
    const f = this.files[0];
    if(f && uploadTarget) addMediaFile(uploadTarget.items, uploadTarget.target, f, uploadTarget.rerender);
    this.value = ''; uploadTarget = null;
  });
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
    if(item.mediaId){
      const tag = (item.mediaType||'').startsWith('video/') ? 'video' : 'img';
      const media = document.createElement(tag); media.src = mediaUrl(item);
      if(tag==='video'){ media.muted = true; media.loop = true; media.playsInline = true; }
      el.appendChild(media);
    }else if(item.driveId){
      const ifr = document.createElement('iframe');
      ifr.src = 'https://drive.google.com/file/d/'+item.driveId+'/preview';
      ifr.loading = 'lazy'; ifr.setAttribute('allow','autoplay');
      el.appendChild(ifr);
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
    wrap.appendChild(el); wrap.appendChild(tools);
    const cap = document.createElement('div'); cap.className = 'mitem-cap'; cap.contentEditable = true;
    cap.setAttribute('data-placeholder','—'); cap.textContent = item.caption || '';
    cap.addEventListener('blur', async ()=>{
      const val = cap.textContent.trim();
      if(val === (item.caption||'')) return;
      item.caption = val;
      const ep = endpointsFor(target);
      try{ await api('PATCH', ep.item(item.id), { caption: val }); }
      catch(err){ toast('⚠️ Lưu caption thất bại: ' + err.message); }
    });
    wrap.appendChild(cap);
    return wrap;
  }
  function renderMediaStack(host, items, target, rerender){
    host.innerHTML = '';
    items.forEach((item, idx)=> host.appendChild(renderMediaItem(item, items, idx, target, rerender)));
    const addWrap = document.createElement('div'); addWrap.className = 'madd-wrap';
    const add = document.createElement('div'); add.className = 'madd'; add.textContent = '+';
    add.title = 'Click để dán link Google Drive, hoặc Cmd/Ctrl+V để dán ảnh/video, hoặc kéo-thả file';
    add.addEventListener('click', async ()=>{
      selectAddTile(add, items, target, rerender);
      const input = await openDriveModal();
      if(!input) return;
      const driveId = extractDriveId(input);
      if(!driveId){ toast('⚠️ Không nhận diện được link/ID Drive'); return; }
      await addDriveMedia(items, target, driveId, rerender);
    });
    add.addEventListener('dragover', e=>{ e.preventDefault(); add.classList.add('selected'); });
    add.addEventListener('drop', e=>{
      e.preventDefault();
      const f = [...e.dataTransfer.files].find(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
      if(f) addMediaFile(items, target, f, rerender);
    });
    addWrap.appendChild(add);
    const upBtn = document.createElement('button'); upBtn.className = 'madd-upload'; upBtn.textContent = 'Upload';
    upBtn.onclick = ()=>{ uploadTarget = { items, target, rerender }; document.getElementById('madd-file-input').click(); };
    addWrap.appendChild(upBtn);
    host.appendChild(addWrap);
  }

  /* =====================================================================
     STATE (loaded once from GET /api/state, mutated locally, synced
     back field-by-field on each edit)
     ===================================================================== */
  let bookwiseRowsState = [];
  let soulieRowsState = [];
  let notesGalState = [];
  let planTableState = [];
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

    const col1 = document.createElement('div');
    const head = document.createElement('div'); head.className = 'exp-head';
    const kindBtn = document.createElement('button'); kindBtn.className = 'kind-toggle';
    kindBtn.textContent = row.mediaKind === 'image' ? 'Image' : 'Video';
    kindBtn.onclick = ()=>{
      row.mediaKind = row.mediaKind === 'image' ? 'video' : 'image';
      kindBtn.textContent = row.mediaKind === 'image' ? 'Image' : 'Video';
      patchRow({ mediaKind: row.mediaKind }); renderSummary();
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
      renderAllRows(); renderSummary();
    };
    head.appendChild(delBtn);
    col1.appendChild(head);
    const nameEl = document.createElement('div'); nameEl.className = 'exp-name'; nameEl.contentEditable = true;
    nameEl.setAttribute('data-placeholder','Tên visual style…');
    nameEl.textContent = row.visualStyle || '';
    nameEl.addEventListener('blur', ()=>{ row.visualStyle = nameEl.textContent.trim(); patchRow({ visualStyle: row.visualStyle }); renderSummary(); });
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

    const col2 = document.createElement('div');
    col2.innerHTML = '<div class="col-label">Reference</div>';
    const refHost = document.createElement('div'); refHost.className = 'mstack';
    col2.appendChild(refHost);
    const refTarget = { kind:'row', rowId: row.id, slot:'reference' };
    const rerenderRef = ()=>renderMediaStack(refHost, row.reference, refTarget, rerenderRef);
    rerenderRef();

    const col3 = document.createElement('div');
    col3.innerHTML = '<div class="col-label">Kết quả của Tool</div>';
    const toolChip = document.createElement('div'); toolChip.className = 'tool-name'; toolChip.contentEditable = true;
    toolChip.setAttribute('data-placeholder','Tên tool…');
    toolChip.textContent = row.tool || '';
    toolChip.addEventListener('blur', ()=>{ row.tool = toolChip.textContent.trim(); patchRow({ tool: row.tool }); });
    col3.appendChild(toolChip);
    const resHost = document.createElement('div'); resHost.className = 'mstack';
    col3.appendChild(resHost);
    const resTarget = { kind:'row', rowId: row.id, slot:'result' };
    const rerenderRes = ()=>renderMediaStack(resHost, row.result, resTarget, rerenderRes);
    rerenderRes();

    const col4 = document.createElement('div');
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
  function groupCount(rows){
    const map = new Map();
    rows.forEach(r=>{
      const key = (r.visualStyle || '(chưa đặt tên)');
      map.set(key, (map.get(key)||0) + 1);
    });
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
  }

  async function savePlanTable(){
    try{ await api('PUT', '/api/plan-rows', { rows: planTableState }); }
    catch(e){ toast('⚠️ Lưu Experiment Plan thất bại: ' + e.message); }
  }
  async function resyncPlanTable(){
    try{
      const { rows } = await api('POST', '/api/plan-rows/resync');
      planTableState = rows;
      renderSummary();
      toast('✓ Đã đồng bộ');
    }catch(e){ toast('⚠️ Đồng bộ thất bại: ' + e.message); }
  }

  function renderBucketCard(title, rows){
    const chips = groupCount(rows);
    const card = document.createElement('div'); card.className = 'dash-card';
    card.innerHTML = '<div class="lbl">'+title+'</div><div class="big">'+rows.length+'</div>';
    const list = document.createElement('div');
    if(!chips.length){
      list.className = 'empty-note'; list.textContent = 'Chưa có dữ liệu';
    }else{
      list.className = 'chip-list';
      chips.forEach(c=>{
        const chip = document.createElement('div'); chip.className = 'style-chip';
        chip.innerHTML = '<b>'+c.count+'</b><span>'+c.name+'</span>';
        list.appendChild(chip);
      });
    }
    card.appendChild(list);
    return card;
  }
  function planCellText(td, getVal, setVal){
    td.contentEditable = true; td.textContent = getVal();
    td.addEventListener('blur', ()=>{ setVal(td.textContent.trim()); savePlanTable(); });
  }
  function renderPlanTable(){
    const body = document.getElementById('plan-table-body');
    body.innerHTML = '';
    if(!planTableState.length){
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="6" style="text-align:center;color:#B7B0A2;font-style:italic">Chưa có thực nghiệm nào</td>';
      body.appendChild(tr);
      return;
    }
    planTableState.forEach((e, idx)=>{
      const tr = document.createElement('tr');
      const tdStyle = document.createElement('td');
      planCellText(tdStyle, ()=>e.visualStyle, v=>e.visualStyle=v);
      const tdApp = document.createElement('td'); tdApp.className = 'app-cell';
      const appBadge = document.createElement('button'); appBadge.className = 'badge ' + (e.app==='Soulie'?'soulie':'bookwise');
      appBadge.style.cursor = 'pointer'; appBadge.style.border = 'none';
      appBadge.textContent = e.app;
      appBadge.onclick = ()=>{ e.app = e.app === 'Soulie' ? 'BookWise' : 'Soulie'; savePlanTable(); renderPlanTable(); };
      tdApp.appendChild(appBadge);
      const tdKind = document.createElement('td'); tdKind.className = 'kind-cell';
      const kindBadge = document.createElement('button'); kindBadge.className = 'badge kind';
      kindBadge.style.cursor = 'pointer'; kindBadge.style.border = 'none';
      kindBadge.textContent = e.mediaKind === 'image' ? 'Image' : 'Video';
      kindBadge.onclick = ()=>{ e.mediaKind = e.mediaKind === 'image' ? 'video' : 'image'; savePlanTable(); renderPlanTable(); };
      tdKind.appendChild(kindBadge);
      const tdCount = document.createElement('td'); tdCount.className = 'count';
      planCellText(tdCount, ()=>e.count, v=>e.count=parseInt(v)||0);
      const tdGroups = document.createElement('td');
      planCellText(tdGroups, ()=>e.groups, v=>e.groups=v);
      const tdDel = document.createElement('td');
      const del = document.createElement('button'); del.className = 'row-del'; del.textContent = '✕';
      del.onclick = ()=>{ planTableState.splice(idx,1); savePlanTable(); renderPlanTable(); };
      tdDel.appendChild(del);
      tr.appendChild(tdStyle); tr.appendChild(tdApp); tr.appendChild(tdKind); tr.appendChild(tdCount); tr.appendChild(tdGroups); tr.appendChild(tdDel);
      body.appendChild(tr);
    });
  }
  document.getElementById('plan-add-row').addEventListener('click', ()=>{
    planTableState.push({ visualStyle:'', app:'Soulie', mediaKind:'video', count:0, groups:'' });
    savePlanTable(); renderPlanTable();
  });
  document.getElementById('plan-sync').addEventListener('click', resyncPlanTable);

  function renderSummary(){
    const dash = document.getElementById('dash-grid');
    dash.innerHTML = '';
    const total = soulieRowsState.length + bookwiseRowsState.length;
    const totalCard = document.createElement('div'); totalCard.className = 'dash-card';
    totalCard.innerHTML = '<div class="lbl">Number of creative produced</div><div class="big">'+total+'</div>';
    dash.appendChild(totalCard);
    dash.appendChild(renderBucketCard('Soulie · Video', soulieRowsState.filter(r=>r.mediaKind==='video')));
    dash.appendChild(renderBucketCard('Soulie · Image', soulieRowsState.filter(r=>r.mediaKind==='image')));
    dash.appendChild(renderBucketCard('BookWise · Video', bookwiseRowsState.filter(r=>r.mediaKind==='video')));
    dash.appendChild(renderBucketCard('BookWise · Image', bookwiseRowsState.filter(r=>r.mediaKind==='image')));
    renderPlanTable();
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
      planTableState = state.planRows;
      swState = state.swState;
      uiState = { collapsed: state.uiState.collapsed || {}, texts: state.uiState.texts || {}, groupCollapsed: state.uiState.groupCollapsed || {} };
    }catch(e){
      toast('⚠️ Không tải được dữ liệu từ server: ' + e.message);
      return;
    }
    renderAllRows();
    renderSummary();
    renderNotesStack();
    applySWState();
    applyUIState();
  }

  init();
})();
