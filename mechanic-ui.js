(function () {
  'use strict';
  const api = () => PokeKartMechanic.getService();
  const node = (tag, className, text) => {
    const el = document.createElement(tag); if (className) el.className = className;
    if (text !== undefined) el.textContent = text; return el;
  };
  const picture = (path, alt) => { const img = node('img'); img.src = path; img.alt = alt; return img; };
  function updateCoins() {
    for (const id of ['storeUserCoins','playerCoinsText','playerCoins']) {
      const el = document.getElementById(id); if (el) el.textContent = api().state.coins;
    }
  }
  function status(el, text, error=false) { el.textContent=text; el.classList.toggle('is-error',error); }
  const purchaseIds = new Map();
  async function renderShop(grid) {
    const host=node('div','mechanic-shop-intro'); grid.replaceChildren(host);
    const message=node('p','mechanic-message','Carregando peças...'); host.append(message);
    async function draw() {
      if (!host.isConnected) return;
      host.replaceChildren();
      host.append(node('p','mechanic-note','Mecânica Pokémon • Compre peças e equipe na garagem. Uma peça por categoria em cada kart. A durabilidade é usada na largada; abandonar a corrida também conta.'));
      const link=node('a','mechanic-link','Abrir Mecânica na garagem'); link.href='garage.html?mechanic=1'; host.append(link,message);
      const cards=node('div','mechanic-grid'); host.append(cards);
      for (const part of api().state.catalog) {
        const card=node('article','mechanic-card'); card.append(picture(part.icon,part.name),node('h3','',part.name),
          node('p','',part.description),node('span','mechanic-life',`${part.durability} corridas • ${part.price} moedas`));
        const owned=api().state.parts.filter(p=>p.part_id===part.id).length;
        card.append(node('p','',`No inventário: ${owned}`));
        const buy=node('button','pk-modal-primary',`Comprar • ${part.price} moedas`); buy.type='button';
        buy.disabled=api().state.coins<part.price;
        buy.onclick=async()=>{
          cards.querySelectorAll('button').forEach(b=>b.disabled=true);
          status(message,'Salvando compra...');
          if (!purchaseIds.has(part.id)) purchaseIds.set(part.id,PokeKartMechanic.newId());
          try {
            await api().buy(part.id,purchaseIds.get(part.id)); purchaseIds.delete(part.id); updateCoins();
            status(message,`${part.name} comprado! Equipe na Mecânica da garagem.`);
          } catch(error) { status(message,error.message,true); }
          await draw();
        };
        card.append(buy); cards.append(card);
      }
    }
    try { await api().load(); if (!host.isConnected) return; updateCoins(); status(message,''); await draw(); }
    catch(error) { status(message,error.message,true); const retry=node('button','pk-modal-secondary','Tentar novamente'); retry.onclick=()=>renderShop(grid); host.append(retry); }
  }
  let dialog;
  async function openGarage(kart, canUse=true) {
    if (!kart || dialog) return;
    const previousFocus=document.activeElement;
    const overlay=node('div','pk-modal-overlay mechanic-dialog-overlay');
    overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true'); overlay.setAttribute('aria-labelledby','mechanicTitle');
    const card=node('div','pk-modal mechanic-dialog'); overlay.append(card); dialog=overlay;
    const close=node('button','pk-modal-close','×'); close.type='button'; close.setAttribute('aria-label','Fechar Mecânica Pokémon');
    const closeDialog=()=>{overlay.remove();dialog=null;document.removeEventListener('keydown',onKey);previousFocus?.focus();};
    close.onclick=closeDialog;
    const onKey=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeDialog();}
      if(event.key==='Tab'){
        const focusable=[...card.querySelectorAll('button:not(:disabled),select:not(:disabled):not([aria-hidden="true"]),a[href],[role="option"][tabindex="0"]')];
        if(event.shiftKey&&document.activeElement===focusable[0]){event.preventDefault();focusable.at(-1)?.focus();}
        else if(!event.shiftKey&&document.activeElement===focusable.at(-1)){event.preventDefault();focusable[0]?.focus();}
      }
    };
    document.addEventListener('keydown',onKey); document.body.append(overlay); close.focus();
    const heading=node('div','mechanic-heading'); const title=node('h2','','MECÂNICA POKÉMON'); title.id='mechanicTitle';
    heading.append(picture('icones/tematicos/ferramentas.png',''),title);
    const message=node('p','mechanic-message','Carregando sua oficina...');
    const content=node('div'); card.append(close,heading,node('strong','',kart.name),message,content);
    function draw() {
      if(!overlay.isConnected)return;
      content.replaceChildren();
      content.append(node('p','mechanic-note','As peças ficam neste kart até serem removidas, transferidas ou esgotadas. Trocar de kart não restaura a durabilidade. A última carga vale durante toda a corrida.'));
      if(!canUse)content.append(node('p','mechanic-note','Desbloqueie este kart para equipar peças. Karts da rotação diária também podem ser equipados.'));
      const effective=PokeKartMechanic.applyParts(kart.physics,api().equipped(kart.id));
      const base=PokeKartMechanic.applyParts(kart.physics,[]);
      const summary=node('div','mechanic-stats');
      for(const [key,label] of Object.entries({maxSpeed:'Velocidade',accel:'Aceleração',brakeDecel:'Freios',turboBonus:'Duração nitro',grip:'Aderência',driftControl:'Controle drift'})){
        const stat=node('div','mechanic-stat');
        stat.append(node('span','',`${label} • base → com peças`),node('strong','',`${+base[key].toFixed(2)} → ${+effective[key].toFixed(2)}`)); summary.append(stat);
      }
      content.append(summary);
      const slots=node('div','mechanic-grid'); content.append(slots);
      for(const [slot,label] of Object.entries(PokeKartMechanic.slots)){
        const equipped=api().state.parts.find(p=>p.kart_id===kart.id&&p.slot===slot);
        const items=api().state.parts.filter(p=>p.slot===slot&&p.remaining>0&&api().state.catalog.some(c=>c.id===p.part_id));
        const box=node('section','mechanic-card'+(equipped?' is-equipped':''));
        const catalog=api().state.catalog.find(c=>c.slot===slot);
        box.append(picture(catalog?.icon||'icones/tematicos/ferramentas.png',label),node('h3','',label));
        box.append(node('p','mechanic-life',equipped?`${api().state.catalog.find(c=>c.id===equipped.part_id)?.name || label} • ${equipped.remaining} corridas restantes`:'Sem peça equipada'));
        if(catalog)box.append(node('p','',catalog.description));
        const select=node('select'); select.setAttribute('aria-label',`Peça de ${label}`);
        const placeholder=node('option','',items.length?'Selecione uma peça':'Compre esta peça na loja'); placeholder.value='';select.append(placeholder);
        for(const item of items){
          const meta=api().state.catalog.find(c=>c.id===item.part_id);
          const option=node('option','',`${meta.name} • ${item.remaining} corridas${item.kart_id&&item.kart_id!==kart.id?' • em outro kart':''}`); option.value=item.id;select.append(option);
        }
        if(equipped)select.value=equipped.id;
        select.disabled=!canUse||!items.length;
        const equip=node('button','pk-modal-primary','Equipar'); equip.type='button'; equip.disabled=select.disabled;
        const save=async(id,target)=>{
          slots.querySelectorAll('button,select').forEach(el=>el.disabled=true);status(message,'Salvando equipamento...');
          try{await api().equip(id,target);status(message,target?'Peça equipada!':'Peça removida. A durabilidade foi preservada.');}
          catch(error){status(message,error.message,true);}
          draw();
        };
        equip.onclick=()=>{if(select.value)save(select.value,kart.id);};
        const picker=node('div','garage-select-wrap mechanic-part-picker');
        select.id=`mechanicPart-${slot}`; picker.append(select);
        createGarageDropdown(picker,select,`Peça de ${label}`);
        box.append(picker,equip);
        if(equipped){const remove=node('button','pk-modal-secondary','Remover peça');remove.type='button';remove.onclick=()=>save(equipped.id,null);box.append(remove);}
        slots.append(box);
      }
      const link=node('a','mechanic-link','Comprar mais peças na loja');link.href='index.html?shop=parts';content.append(link);
    }
    try{await api().load();status(message,'');draw();}
    catch(error){status(message,error.message,true);const retry=node('button','pk-modal-secondary','Tentar novamente');retry.onclick=async()=>{try{await api().load();status(message,'');draw();}catch(e){status(message,e.message,true);}};content.append(retry);}
  }
  window.PokeMechanicUI={renderShop,openGarage};
})();
