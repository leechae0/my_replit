const http=require('http');
const fs=require('fs');
const path=require('path');
const PORT=process.env.PORT||3000;

function decode(s=''){
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function text(tag,block){
  const m=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
  return m?decode(m[1].trim()):'';
}
function parseRSS(xml,kind){
  const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0,10);
  return items.map(m=>{
    const b=m[1];
    return {
      title:text('title',b).replace(/\s+-\s+[^-]+$/,''),
      link:text('link',b),
      date:text('pubDate',b),
      source:text('source',b)|| (kind==='domestic'?'국내 뉴스':'해외 뉴스'),
      kind
    };
  });
}
async function fetchNews(q,kind){
  const base=kind==='domestic'
    ? 'https://news.google.com/rss/search?hl=ko&gl=KR&ceid=KR:ko&q='
    : 'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q=';
  const r=await fetch(base+encodeURIComponent(q),{headers:{'User-Agent':'Mozilla/5.0'}});
  if(!r.ok) throw new Error('뉴스를 가져오지 못했습니다.');
  return parseRSS(await r.text(),kind);
}
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/news'){
    const q=(u.searchParams.get('q')||'').trim();
    if(!q){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});return res.end(JSON.stringify({error:'검색어를 입력하세요.'}));}
    try{
      const [domestic,foreign]=await Promise.all([fetchNews(q,'domestic'),fetchNews(q,'foreign')]);
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
      return res.end(JSON.stringify({domestic,foreign}));
    }catch(e){
      res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'});
      return res.end(JSON.stringify({error:e.message}));
    }
  }
  let file=u.pathname==='/'?'index.html':u.pathname.slice(1);
  const p=path.join(__dirname,'public',file);
  if(!p.startsWith(path.join(__dirname,'public'))||!fs.existsSync(p)){res.writeHead(404);return res.end('Not found');}
  const ext=path.extname(p);
  res.writeHead(200,{'Content-Type':ext==='.html'?'text/html; charset=utf-8':'text/plain; charset=utf-8'});
  fs.createReadStream(p).pipe(res);
});
server.listen(PORT,()=>console.log('listening on '+PORT));