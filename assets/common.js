/* ===== CXG·AI个人站 · 共享 JS（顶栏渲染 / API Key 集群管理 / 工具函数） ===== */
(function(){
  "use strict";

  var KEYS_STORAGE = "agnes_studio_keys_v3";

  function loadKeys(){
    try{
      var raw = localStorage.getItem(KEYS_STORAGE);
      if(raw){
        var arr = JSON.parse(raw);
        if(Array.isArray(arr)){ return arr; }
      }
    }catch(e){}
    return [];
  }
  function saveKeys(keys){
    try{ localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys)); }catch(e){}
  }
  function maskKey(k){
    if(!k){ return ""; }
    if(k.length <= 10){ return k.slice(0,4) + "…"; }
    return k.slice(0,6) + "…" + k.slice(-4);
  }

  /* 多 Key 智能路由：优先健康(连续成功) + 响应快(avgMs 低)；健康度相同时轮询轮转 */
  function pickKey(keys){
    var alive = keys.filter(function(k){ return !k.dead; });
    if(!alive.length){ return null; }
    var score = function(k){
      return (k.fails > 0 ? 1e9 : 0) + (k.avgMs == null ? 60000 : k.avgMs);
    };
    var best = alive.slice().sort(function(a,b){ return score(a) - score(b); })[0];
    var bestScore = score(best);
    var cand = alive.filter(function(k){ return score(k) === bestScore; });
    if(cand.length > 1){
      window.__agnes_rr = (window.__agnes_rr || 0) + 1;
      return cand[window.__agnes_rr % cand.length];
    }
    return best;
  }
  function recordSuccess(st, ms){
    st.dead = false; st.fails = 0; st.lastMs = ms;
    st.avgMs = (st.avgMs == null) ? ms : (st.avgMs * 2 + ms) / 3;
  }
  function recordFail(st){
    st.fails = (st.fails || 0) + 1;
    if(st.fails >= 2){ st.dead = true; }
  }

  /* 背景图跨页缓存与淡入（消除切换页面时的背景晃动/闪烁） */
  var BG_CACHE_KEY = "agnes_bg_cache_v1";
  var BG_URL = "assets/bg-mech.png";
  function ensureBackground(){
    var mech = document.querySelector(".bg-img.mech");
    var layer = document.querySelector(".bg-layer");
    if(!mech || !layer){ return; }
    layer.classList.add("bg-loading");
    var cached = null;
    try{ cached = sessionStorage.getItem(BG_CACHE_KEY); }catch(e){}
    if(cached){
      mech.style.backgroundImage = "url(\"" + cached + "\")";
      layer.classList.remove("bg-loading");
      return;
    }
    var img = new Image();
    img.onload = function(){
      mech.style.backgroundImage = "url(\"" + BG_URL + "\")";
      layer.classList.remove("bg-loading");
      try{
        var scale = Math.min(1, 1920 / img.naturalWidth);
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        var data = c.toDataURL("image/jpeg", 0.82);
        if(data && data.length < 2.4e6){ try{ sessionStorage.setItem(BG_CACHE_KEY, data); }catch(e){} }
      }catch(e){}
    };
    img.onerror = function(){
      mech.style.backgroundImage = "url(\"" + BG_URL + "\")";
      layer.classList.remove("bg-loading");
    };
    img.src = BG_URL;
  }

  /* 顶栏 + API Key 面板渲染 */
  function renderShell(activePage, keyCountEl, keyListEl, countEl2, activeLabelEl){
    if(!document.querySelector(".bg-layer")){
      var bg = document.createElement("div");
      bg.className = "bg-layer";
      bg.innerHTML = '<div class="bg-img mech"></div><canvas id="fxCanvas"></canvas>';
      document.body.insertBefore(bg, document.body.firstChild);
      ensureBackground();
      initParticles();
    }
    var header = document.querySelector("header.site .right");
    if(header){
      var navHtml = '<nav class="nav" aria-label="主导航">' +
        '<a href="index.html"' + (activePage === "home" ? ' class="active"' : '') + '>首页</a>' +
        '<a href="image.html"' + (activePage === "image" ? ' class="active"' : '') + '>图像生成</a>' +
        '<a href="video.html"' + (activePage === "video" ? ' class="active"' : '') + '>视频生成</a>' +
        '</nav>';
      var hudHtml = '<div class="hud"><span class="dot"></span>节点在线 · <b id="keyCount">' + loadKeys().length + '</b> 个 API Key</div>' +
        '<button class="key-gear" id="keyGear" type="button" aria-label="API Key 设置" title="API Key 管理">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.06z"/></svg>' +
        '</button>';
      header.innerHTML = navHtml + hudHtml;
      bindFxToggle();
    }
    if(keyCountEl){ document.querySelectorAll("#keyCount").forEach(function(el){ el.textContent = keyCountEl; }); }
    if(keyListEl){ renderKeysInto(keyListEl, countEl2, activeLabelEl); }
  }

  /* API Key 管理弹窗（video/image 页面共用）：设置图标打开，含列表/添加/测速/删除 */
  function bindKeyPanel(){
    var gear = document.getElementById("keyGear");
    var modal = null;
    if(!gear){ return; }

    function refresh(){
      var keys = loadKeys();
      renderKeysInto(document.getElementById("keyList"), document.getElementById("keyCount2"), document.getElementById("activeKeyLabel"));
      document.querySelectorAll("#keyCount").forEach(function(el){ el.textContent = keys.length; });
    }
    function doAdd(k){
      k = (k || "").trim();
      if(!k){ return; }
      var keys = loadKeys();
      if(!/^sk-/.test(k)){ showStatus("Key 格式不正确，应以 sk- 开头。", "error"); return; }
      if(keys.some(function(s){ return s.key === k; })){ showStatus("该 Key 已存在。", "info"); return; }
      keys.push({ key:k, avgMs:null, fails:0, dead:false, lastMs:null });
      saveKeys(keys); refresh();
      showStatus("Key 已加入集群，将参与自动调度。", "info");
    }

    function ensureModal(){
      if(modal){ return; }
      modal = document.createElement("div");
      modal.id = "keyModal";
      modal.className = "key-modal";
      modal.innerHTML =
        '<div class="km-mask" data-close="1"></div>' +
        '<div class="km-box" role="dialog" aria-modal="true" aria-label="API Key 管理">' +
          '<div class="km-head"><h3>API Key 管理</h3><button class="km-x" type="button" data-close="1" aria-label="关闭">✕</button></div>' +
          '<p class="km-meta">多 Key 自动路由：<b id="activeKeyLabel">—</b> 当前节点 · 已存 <b id="keyCount2">0</b> 个</p>' +
          '<div class="keys" id="keyList"></div>' +
          '<div class="km-add">' +
            '<input type="text" id="kmInput" placeholder="sk-xxxxxxxx 粘贴新 Key 后回车 / 点击添加" autocomplete="off" spellcheck="false">' +
            '<button class="neon-btn" id="kmAdd" type="button">+ 添加</button>' +
          '</div>' +
          '<div class="km-actions">' +
            '<button class="neon-btn ghost" id="kmTest" type="button">测速</button>' +
            '<button class="neon-btn" type="button" data-close="1">完成</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
      var input = modal.querySelector("#kmInput");
      var addBtn = modal.querySelector("#kmAdd");
      var testBtn = modal.querySelector("#kmTest");
      modal.addEventListener("click", function(e){
        if(e.target && e.target.getAttribute("data-close") === "1"){ close(); }
      });
      modal.addEventListener("keydown", function(e){ if(e.key === "Escape"){ close(); } });
      addBtn.addEventListener("click", function(){
        doAdd(input.value); input.value = "";
        if(loadKeys().length){ input.focus(); }
      });
      input.addEventListener("keydown", function(e){
        if(e.key === "Enter"){ doAdd(this.value); this.value = ""; }
        else if(e.key === "Escape"){ close(); }
      });
      testBtn.addEventListener("click", function(){
        var keys = loadKeys();
        if(!keys.length){ showStatus("没有可测速的 Key。", "error"); return; }
        testBtn.disabled = true; testBtn.textContent = "测速中…";
        showStatus("正在对 " + keys.length + " 个 Key 逐一测速（最小 1K 请求），请稍候…", "info");
        var done = 0;
        keys.forEach(function(st){
          var t0 = Date.now();
          fetch("https://apihub.agnes-ai.com/v1/images/generations", {
            method:"POST",
            headers:{ "Content-Type":"application/json", "Authorization":"Bearer " + st.key },
            body: JSON.stringify({ model:"agnes-image-2.5-flash", prompt:"latency probe", size:"1K", ratio:"1:1", extra_body:{ response_format:"url" } })
          }).then(function(res){
            if(!res.ok){ throw new Error("HTTP " + res.status); }
            return res.json();
          }).then(function(){ recordSuccess(st, Date.now() - t0); })
            .catch(function(){ recordFail(st); })
            .finally(function(){
              done++;
              saveKeys(keys); refresh();
              if(done === keys.length){
                testBtn.disabled = false; testBtn.textContent = "测速";
                showStatus("测速完成：已按响应耗时更新节点健康度。", "info");
              }
            });
        });
      });
    }
    function open(){
      ensureModal();
      refresh();
      modal.classList.add("open");
      document.body.classList.add("modal-open");
    }
    function close(){
      if(modal){ modal.classList.remove("open"); document.body.classList.remove("modal-open"); }
    }
    gear.addEventListener("click", open);
    refresh();
  }

  /* 删除 Key 确认弹窗（惰性创建，全局唯一） */
  function confirmKeyDelete(st, onConfirm){
    var dlg = document.getElementById("keyDelModal");
    if(!dlg){
      dlg = document.createElement("div");
      dlg.id = "keyDelModal";
      dlg.className = "key-modal";
      dlg.innerHTML =
        '<div class="km-mask" data-close="1"></div>' +
        '<div class="km-box" role="dialog" aria-modal="true" aria-label="删除 API Key">' +
          '<div class="km-head"><h3>删除 API Key</h3><button class="km-x" type="button" data-close="1" aria-label="关闭">✕</button></div>' +
          '<p class="km-tip">确定要删除该 API Key 吗？删除后它将不再参与自动调度。<br>待删除：<code class="km-del-key"></code></p>' +
          '<div class="km-actions">' +
            '<button class="neon-btn ghost" type="button" data-close="1">取消</button>' +
            '<button class="neon-btn danger" id="kmDelOk" type="button">确认删除</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(dlg);
      dlg.addEventListener("click", function(e){
        if(e.target && e.target.getAttribute("data-close") === "1"){ closeDel(); }
      });
      dlg.addEventListener("keydown", function(e){ if(e.key === "Escape"){ closeDel(); } });
      dlg.querySelector("#kmDelOk").addEventListener("click", function(){
        closeDel();
        if(onConfirm){ onConfirm(); }
      });
    }
    dlg.querySelector(".km-del-key").textContent = maskKey(st.key);
    dlg.classList.add("open");
    document.body.classList.add("modal-open");
    function closeDel(){
      dlg.classList.remove("open");
      document.body.classList.remove("modal-open");
    }
  }

  function renderKeysInto(listEl, count2El, activeLabelEl){
    if(!listEl){ return; }
    var keys = loadKeys();
    listEl.innerHTML = "";
    keys.forEach(function(st, i){
      var el = document.createElement("div");
      el.className = "key-chip" + (i === 0 ? " primary" : "") + (st.dead ? " dead" : "");
      var hl = document.createElement("span"); hl.className = "hl";
      var mask = document.createElement("span"); mask.className = "mask"; mask.textContent = maskKey(st.key);
      el.appendChild(hl); el.appendChild(mask);
      if(!st.dead && st.avgMs != null){
        var ms = document.createElement("span"); ms.className = "ms"; ms.textContent = Math.round(st.avgMs) + "ms";
        el.appendChild(ms);
      }
      if(st.dead){
        var fail = document.createElement("span"); fail.className = "fail"; fail.textContent = "OFFLINE";
        el.appendChild(fail);
      }
      var rm = document.createElement("button");
      rm.className = "krm"; rm.type = "button"; rm.setAttribute("aria-label","删除此 Key");
      rm.textContent = "✕";
      rm.addEventListener("click", function(){
        confirmKeyDelete(st, function(){
          var ks = loadKeys();
          var idx = -1;
          for(var x = 0; x < ks.length; x++){ if(ks[x].key === st.key){ idx = x; break; } }
          if(idx >= 0){ ks.splice(idx,1); }
          saveKeys(ks);
          renderKeysInto(listEl, count2El, activeLabelEl);
          document.querySelectorAll("#keyCount").forEach(function(el){ el.textContent = ks.length; });
          showStatus(ks.length ? "Key 已删除。" : "已删除最后一个 Key，当前没有可用节点。", "info");
        });
      });
      el.appendChild(rm);
      listEl.appendChild(el);
    });
    if(count2El){ count2El.textContent = keys.length; }
    var act = pickKey(keys);
    if(activeLabelEl){ activeLabelEl.textContent = act ? maskKey(act.key) : "无可用 Key"; }
  }

  /* 状态提示（页面需存在 #status 元素） */
  function showStatus(msg, kind){
    var el = document.getElementById("status");
    if(!el){ return; }
    el.className = "status show " + (kind || "info");
    el.textContent = msg;
  }

  /* 画廊工具函数 */
  function updateCount(gridEl, countEl){
    var n = gridEl.querySelectorAll(".card").length;
    countEl.textContent = n + " 个";
    if(n === 0){
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2.2"/><path d="M21 15l-5.2-5.2a1.6 1.6 0 0 0-2.3 0L3 20"/></svg><div>暂无记录。<span class="glow">等待指令注入…</span></div>';
      gridEl.appendChild(empty);
    }
  }
  function download(src, name){
    var a = document.createElement("a");
    if(src.indexOf("data:") === 0){
      a.href = src; a.download = name || ("agnes-file-" + Date.now() + ".bin");
    } else {
      a.href = src; a.target = "_blank"; a.rel = "noopener";
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ===== 星空粒子特效（参考 jq22 顶部粒子背景） ===== */
  var particleCtl = null;
  function initParticles(){
    if(window.__agnesFx && window.__agnesFx.done){ return; }
    window.__agnesFx = { done: true };
    var cvs = document.getElementById("fxCanvas");
    if(!cvs || !cvs.getContext){ return; }
    var ctx = cvs.getContext("2d");
    var W = 0, H = 0;
    var parts = [];
    var running = false;
    var rafId = null;
    var mx = -9999, my = -9999;   /* 鼠标位置（默认远离视口） */

    function resize(){
      W = cvs.width = window.innerWidth;
      H = cvs.height = window.innerHeight;
      var target = Math.min(110, Math.max(45, Math.round(W * H / 16000)));
      while(parts.length < target){
        parts.push(makeParticle());
      }
      parts.length = target;
    }
    function makeParticle(){
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.6 + Math.random() * 1.7,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -0.1 - Math.random() * 0.35,
        tw: Math.random() * Math.PI * 2,
        tws: 0.008 + Math.random() * 0.02
      };
    }
    function step(){
      ctx.clearRect(0, 0, W, H);
      var i, j, p;
      for(i = 0; i < parts.length; i++){
        p = parts[i];
        p.x += p.vx; p.y += p.vy; p.tw += p.tws;
        /* 鼠标吸引力：靠近光标的粒子向鼠标聚拢 */
        var mdx = mx - p.x, mdy = my - p.y;
        var md2 = mdx * mdx + mdy * mdy;
        if(md2 < 22500 && md2 > 1){
          var md = Math.sqrt(md2);
          var pull = (1 - md / 150) * 1.1;
          p.x += mdx / md * pull;
          p.y += mdy / md * pull;
        }
        if(p.x < -10){ p.x = W + 10; }
        if(p.x > W + 10){ p.x = -10; }
        if(p.y < -10){ p.y = H + 10; }
        if(p.y > H + 10){ p.y = -10; }
        var a = 0.35 + 0.4 * Math.sin(p.tw);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(167,139,250," + a.toFixed(3) + ")";
        ctx.fill();
      }
      for(i = 0; i < parts.length; i++){
        for(j = i + 1; j < parts.length; j++){
          var dx = parts[i].x - parts[j].x;
          var dy = parts[i].y - parts[j].y;
          var d2 = dx * dx + dy * dy;
          if(d2 < 14400){
            var d = Math.sqrt(d2);
            var alpha = (1 - d / 120) * 0.16;
            ctx.beginPath();
            ctx.moveTo(parts[i].x, parts[i].y);
            ctx.lineTo(parts[j].x, parts[j].y);
            ctx.strokeStyle = "rgba(124,58,237," + alpha.toFixed(3) + ")";
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      if(running){ rafId = requestAnimationFrame(step); }
    }
    function start(){
      if(running){ return; }
      running = true;
      rafId = requestAnimationFrame(step);
    }
    function stop(){
      running = false;
      if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
      ctx.clearRect(0, 0, W, H);
    }

    resize();
    start();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", function(e){
      mx = e.clientX; my = e.clientY;
    });
    window.addEventListener("mouseout", function(){
      mx = -9999; my = -9999;
    });
    document.addEventListener("visibilitychange", function(){
      if(document.hidden){ stop(); } else { start(); }
    });
    particleCtl = { stop: stop, start: start };
  }

  /* 背景特效开关（注入到 HUD 旁） */
  function bindFxToggle(){
    var hud = document.querySelector(".hud");
    if(!hud || document.getElementById("fxToggle")){ return; }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "fxToggle";
    btn.className = "fx-toggle";
    btn.textContent = "关闭背景特效";
    btn.addEventListener("click", function(){
      var off = btn.dataset.off === "1";
      var cvs = document.getElementById("fxCanvas");
      if(off){
        btn.dataset.off = "";
        btn.textContent = "关闭背景特效";
        if(cvs){ cvs.style.opacity = "1"; }
        if(particleCtl){ particleCtl.start(); }
      } else {
        btn.dataset.off = "1";
        btn.textContent = "开启背景特效";
        if(cvs){ cvs.style.opacity = "0"; }
        if(particleCtl){ particleCtl.stop(); }
      }
    });
    hud.parentNode.insertBefore(btn, hud);
  }

  /* 已生成图片选择器（图生图 / 图生视频参考图复用图像生成记录） */
  var IMG_RECORDS_KEY = "agnes_i_records_v1";
  function showImagePicker(onPick){
    var records = [];
    try{
      var raw = localStorage.getItem(IMG_RECORDS_KEY);
      if(raw){
        var arr = JSON.parse(raw);
        if(Array.isArray(arr)){ records = arr; }
      }
    }catch(e){}
    var urls = records.filter(function(r){ return r && r.url && /^https?:/i.test(r.url); });
    if(!urls.length){
      showStatus("暂无已生成的图片记录，请先在「图像生成」页生成图片。", "error");
      return;
    }
    var modal = document.getElementById("imgPicker");
    if(!modal){
      modal = document.createElement("div");
      modal.className = "picker-modal";
      modal.id = "imgPicker";
      modal.innerHTML =
        '<div class="picker-box">' +
          '<div class="picker-head"><span>选择已生成的图片<span class="picker-sub">点击后作为参考图加入</span></span>' +
          '<button class="picker-close" type="button" aria-label="关闭">✕</button></div>' +
          '<div class="picker-grid"></div>' +
        '</div>';
      document.body.appendChild(modal);
      modal.querySelector(".picker-close").addEventListener("click", function(){ modal.classList.remove("open"); });
      modal.addEventListener("click", function(e){ if(e.target === modal){ modal.classList.remove("open"); } });
      document.addEventListener("keydown", function(e){ if(e.key === "Escape"){ modal.classList.remove("open"); } });
    }
    var gridEl = modal.querySelector(".picker-grid");
    gridEl.innerHTML = "";
    urls.forEach(function(r){
      var item = document.createElement("button");
      item.type = "button";
      item.className = "picker-item";
      var img = document.createElement("img");
      img.src = r.url; img.loading = "lazy"; img.alt = "";
      var span = document.createElement("span");
      span.textContent = r.dims || "";
      item.appendChild(img); item.appendChild(span);
      item.addEventListener("click", function(){
        modal.classList.remove("open");
        onPick(r.url);
      });
      gridEl.appendChild(item);
    });
    modal.classList.add("open");
  }

  window.AgnesCommon = {
    loadKeys: loadKeys,
    saveKeys: saveKeys,
    maskKey: maskKey,
    pickKey: pickKey,
    recordSuccess: recordSuccess,
    recordFail: recordFail,
    renderShell: renderShell,
    bindKeyPanel: bindKeyPanel,
    showStatus: showStatus,
    updateCount: updateCount,
    download: download,
    bindFxToggle: bindFxToggle,
    showImagePicker: showImagePicker
  };
})();
