// Gera artes a partir do logo e dos ícones do projeto. Não acessa contas externas.
const fs = require('fs');
const path = require('path');
const {pathToFileURL} = require('url');
const {chromium} = require('C:/Users/jonat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..');
const data = p => 'data:image/'+(p.endsWith('.svg')?'svg+xml':'png')+';base64,'+fs.readFileSync(path.join(root,p)).toString('base64');
const logo = data('img/logo.png');
const icon = name => data('icones/tematicos/'+name+'.png');
const esc = s => s.replace(/[&<>\"]/g, x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
const records = [];
const css = `*{box-sizing:border-box}html,body{margin:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#f5f8ff}.art{position:relative;overflow:hidden;width:1080px;height:1350px;background:radial-gradient(ellipse at 90% 18%,#174453 0,transparent 47%),radial-gradient(ellipse at 2% 100%,#173858 0,transparent 55%),#06111f;padding:78px;display:flex;flex-direction:column;isolation:isolate}.art:before{content:'';position:absolute;width:750px;height:750px;border:3px solid #ffffff0c;border-radius:50%;top:340px;left:440px;box-shadow:0 0 0 90px #ffffff03,0 0 0 180px #ffffff02;z-index:-1}.art:after{content:'';position:absolute;top:-80px;left:-90px;width:260px;height:280px;transform:rotate(25deg);background:repeating-conic-gradient(#ffffff0c 0 25%,transparent 0 50%) 0/60px 60px;z-index:-1}.logo{width:420px;object-fit:contain;align-self:flex-start;margin-bottom:58px}.kicker{font-size:25px;font-weight:800;letter-spacing:6px;color:var(--accent,#ffd344);text-transform:uppercase}.title{font-size:100px;line-height:1.02;letter-spacing:-4px;font-weight:950;margin:25px 0 28px;text-transform:uppercase;font-style:italic;max-width:910px}.title em{color:var(--accent,#ffd344);font-style:inherit}.copy{font-size:34px;line-height:1.4;color:#c1d3df;max-width:790px;margin:0}.hero{width:345px;height:345px;object-fit:contain;align-self:center;margin:25px 0;filter:drop-shadow(0 22px 28px #0008)}.chips{display:flex;flex-wrap:wrap;gap:14px;margin-top:38px}.chip{border:1px solid #78a0b955;border-radius:16px;padding:18px 23px;font-size:25px;color:#e9f1f5;background:#112538}.cta{margin-top:auto;border-top:2px solid #5a7c9040;padding-top:28px;display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:26px;font-weight:700}.cta span{color:var(--accent,#ffd344)}.page{position:absolute;right:78px;top:90px;color:#afc3d3;font-size:25px;letter-spacing:3px}.road{position:absolute;right:-160px;bottom:330px;width:570px;height:500px;border:65px solid #65d8f414;border-radius:45% 20% 40% 30%;transform:rotate(-20deg);z-index:-1}.modes{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:42px 0}.mode{padding:28px;border:1px solid #92bcd738;background:#0b2234;border-radius:26px;display:flex;gap:22px;align-items:center;font-size:29px;font-weight:900}.mode img{height:75px;width:75px;object-fit:contain}.story{height:1920px;padding:250px 90px 300px}.story .logo{width:440px;margin-bottom:95px}.story .title{font-size:108px}.story .hero{width:420px;height:420px;margin:65px auto}.story .copy{font-size:39px}.story .cta{font-size:30px}.cover{height:1920px;justify-content:center;align-items:center;padding:0}.cover .logo{position:absolute;width:370px;top:260px;align-self:center}.seal{width:480px;height:480px;border-radius:50%;border:5px solid var(--accent,#ffd344);background:radial-gradient(circle,#184661,#071b2e 72%);box-shadow:0 0 0 26px #ffd34408;display:flex;align-items:center;justify-content:center}.seal img{width:275px;height:275px;object-fit:contain;filter:drop-shadow(0 20px 20px #0008)}.cover .label{position:absolute;top:1340px;font-size:42px;letter-spacing:8px;font-weight:800;text-transform:uppercase}.avatar{width:1080px;height:1080px;padding:0;justify-content:center;align-items:center}.avatar .seal{width:850px;height:850px;border-width:12px}.avatar .seal img{width:570px;height:570px}.eyebrow{font-size:24px;text-transform:uppercase;letter-spacing:4px;color:#87a6ba;margin-top:34px}`;
function add(file, title, body, kind='feed', accent='#ffd344') {
 const html=`<!doctype html><meta charset="utf-8"><style>${css}</style><main class="art ${kind==='feed'?'':kind}" style="--accent:${accent}">${body}</main>`;
 records.push({file,title,kind,html,width:1080,height:kind==='avatar'?1080:kind==='feed'?1350:1920});
}
function post(file,kicker,title,copy,img,page,accent='#ffd344',extra=''){
 add(file,kicker,`<img class="logo" src="${logo}"><div class="page">${page}</div><div class="kicker">${kicker}</div><h1 class="title">${title}</h1><p class="copy">${copy}</p>${img?`<img class="hero" src="${icon(img)}">`:''}${extra}<div class="road"></div><footer class="cta"><span>EM BREVE</span><b>@poke_kart</b></footer>`,'feed',accent);
}
post('feed/01-apresentacao.png','Chegamos à pista','Sua próxima<br><em>corrida</em><br>começa aqui.','Conheça o PokéKart.<br>Corrida. Coleção. Vitória.','kart','01','#ffd344','<div class="eyebrow">Acompanhe o lançamento</div>');
post('feed/02-modos-01.png','Escolha seu desafio','Qual é o seu<br><em>modo</em> de<br>correr?','Quatro formas de entrar na disputa.',null,'1 / 5','#65dbf6',`<div class="modes">${[['controle','Solo','#65dbf6'],['mundo','Multiplayer','#ca95ff'],['escudo','Torre','#ffd344'],['alvo','Desafio','#ff7186']].map(([i,t,c])=>`<div class="mode" style="color:${c}"><img src="${icon(i)}">${t}</div>`).join('')}</div><div class="eyebrow">Deslize e descubra →</div>`);
post('feed/02-modos-02.png','Modo solo','Treine.<br>Faça drift.<br><em>Acelere.</em>','Encontre seu ritmo e enfrente os bots nas pistas.','controle','2 / 5','#65dbf6');
post('feed/02-modos-03.png','Multiplayer','Uma pista.<br>Vários<br><em>rivais.</em>','Entre na disputa com outros jogadores.','mundo','3 / 5','#ca95ff');
post('feed/02-modos-04.png','Modo torre','Cada andar.<br>Um novo<br><em>desafio.</em>','Avance pelas corridas até enfrentar o líder do ginásio.','escudo','4 / 5','#ffd344');
post('feed/02-modos-05.png','Modo desafio','Encare os<br><em>líderes.</em>','Escolha seu desafio e mostre o que você faz na pista.','alvo','5 / 5','#ff7186');
post('feed/03-pistas-01.png','Criador de pistas','A próxima<br>pista pode<br>ser <em>sua.</em>','Desenhe seu circuito.<br>Escolha as curvas. Crie o desafio.','ferramentas','1 / 2','#65dbf6');
post('feed/03-pistas-02.png','Sua ideia na pista','Curvas<br>fechadas ou<br><em>retão?</em>','Como seria o seu circuito ideal?<br>Conte nos comentários.','rota','2 / 2','#65dbf6');
const highlights=[['comece','Comece aqui','bandeira','#ffd344','Bem-vindo<br>ao <em>PokéKart.</em>','Este é o começo.<br>Acompanhe as novidades e o lançamento.'],['karts','Karts','kart','#65dbf6','Qual kart<br>é a sua<br><em>escolha?</em>','Vamos mostrar os karts e os detalhes da garagem por aqui.'],['pistas','Pistas','rota','#65dbf6','Seu traçado.<br>Seu <em>desafio.</em>','Conheça os circuitos e o criador de pistas.'],['torre','Torre','escudo','#ffd344','Conquiste<br>a <em>torre.</em>','Suba os andares e enfrente os líderes dos ginásios.'],['gameplay','Gameplay','controle','#ca95ff','Da garagem<br>para a<br><em>pista.</em>','Corridas, drift e habilidades.<br>Os próximos vídeos chegam por aqui.'],['novidades','Novidades','estrela','#ffd344','O próximo<br>capítulo<br>vem <em>aí.</em>','Ainda sem data de lançamento.<br>Siga @poke_kart para acompanhar.']];
for(const [slug,title,i,color,h,p] of highlights){
 add(`destaques/${slug}.png`,title,`<img class="logo" src="${logo}"><div class="seal"><img src="${icon(i)}"></div><div class="label">${title}</div>`,'cover',color);
 add(`stories/${slug}.png`,title,`<img class="logo" src="${logo}"><div class="kicker">${title}</div><h1 class="title">${h}</h1><img class="hero" src="${icon(i)}"><p class="copy">${p}</p><footer class="cta"><span>ACOMPANHE</span><b>@poke_kart</b></footer>`,'story',color);
}
add('perfil/avatar.png','Avatar',`<div class="seal"><img src="${icon('configuracoes')}"></div>`,'avatar');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({deviceScaleFactor:1});
 for(const r of records){
  fs.mkdirSync(path.dirname(path.join(__dirname,r.file)),{recursive:true});
  await page.setViewportSize({width:r.width,height:r.height});
  await page.setContent(r.html);
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  const overflow=await page.evaluate(()=>{
   const a=document.querySelector('.art'), box=a.getBoundingClientRect();
   return [...a.children].filter(e=>!['road','page'].some(c=>e.classList.contains(c))).filter(e=>{
    const r=e.getBoundingClientRect();return r.bottom>box.bottom+1||r.right>box.right+1||r.left<box.left-1;
   }).map(e=>e.className);
  });
  if(overflow.length) throw new Error('Conteúdo fora da arte '+r.file+': '+overflow.join(', '));
  await page.screenshot({path:path.join(__dirname,r.file)});
 }
 fs.writeFileSync(path.join(__dirname,'manifesto.json'),JSON.stringify(records.map(({html,...r})=>r),null,2));
 const thumbs=records.filter(r=>r.kind!=='story').map(r=>`<a href="${r.file}"><img src="${r.file}" loading="lazy"><span>${esc(r.file)}</span></a>`).join('');
 const gallery=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PokéKart — kit de pré-lançamento</title><style>body{margin:0;padding:40px;background:#06111f;color:#f5f8ff;font:17px 'Segoe UI',sans-serif}main{max-width:1250px;margin:auto}h1{font-size:40px}p{line-height:1.6;color:#bed2df}b{color:#ffd344}.bio{white-space:pre-line;background:#102739;padding:24px;border:1px solid #365266;border-radius:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}a{color:#9edff6;text-decoration:none}a img{width:100%;border-radius:12px}a span{display:block;font-size:12px;padding:8px 0}.warning{color:#ffd344}@media(max-width:700px){body{padding:20px}.grid{grid-template-columns:repeat(2,1fr)}h1{font-size:30px}}</style><main><p class="warning">PRÉVIA PARA REVISÃO • AINDA NÃO PUBLICADO</p><h1>@poke_kart — a primeira largada</h1><p>Artes de pré-lançamento com o logo e os ícones do projeto. Os três posts abaixo são apresentação, modos de jogo (5 slides) e criador de pistas (2 slides).</p><h2>Perfil sugerido</h2><p><b>Nome:</b> PokéKart | Corrida Pokémon</p><div class="bio">🏁 Corrida. Coleção. Vitória.
⚡ Karts, pistas e desafios Pokémon
🛠️ Crie sua pista. Conquiste a torre.
🚦 Lançamento em breve. Acompanhe!</div><p><b>Link da bio:</b> <a href="https://pokekart.online/index.html">pokekart.online/index.html</a></p><h2>Feed, capas e avatar</h2><div class="grid">${thumbs}</div><h2>Stories de abertura</h2><div class="grid">${records.filter(r=>r.kind==='story').map(r=>`<a href="${r.file}"><img src="${r.file}" loading="lazy"><span>${esc(r.title)}</span></a>`).join('')}</div><p><a href="plano-lancamento.md">Abrir legendas, calendário e instruções de publicação</a></p><p>As capas usam o ícone no centro para o recorte circular. Nos stories, adicione os stickers sugeridos no plano diretamente no Instagram.</p></main></html>`;
 fs.writeFileSync(path.join(__dirname,'previa.html'),gallery);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(pathToFileURL(path.join(__dirname,'previa.html')).href);
 await page.screenshot({path:path.join(__dirname,'previa.png'),fullPage:true});
 await browser.close();
 console.log(`Geradas ${records.length} artes e prévia HTML.`);
})();
