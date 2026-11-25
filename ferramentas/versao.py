#!/usr/bin/env python3
"""Carimba uma versão nova no index.html antes de publicar.

O Cloudflare deixa o navegador guardar JS/CSS por 4 horas; o index.html sempre vem fresco.
Este script gera um import map com ?v=<versão> para cada módulo em js/ e põe ?v= no CSS,
assim toda publicação força o navegador a buscar os arquivos novos.
Uso: python3 ferramentas/versao.py   (rodar antes de cada commit que mude js/ ou css/)
"""
import hashlib, json, pathlib, re

raiz = pathlib.Path(__file__).resolve().parent.parent
arquivos = sorted(p for p in (raiz / 'js').rglob('*.js'))
h = hashlib.sha1()
for p in arquivos + [raiz / 'css' / 'app.css']:
    h.update(p.read_bytes())
v = h.hexdigest()[:10]

mapa = {'/' + p.relative_to(raiz).as_posix(): '/' + p.relative_to(raiz).as_posix() + '?v=' + v for p in arquivos}
bloco = ('<script type="importmap">\n' + json.dumps({'imports': mapa}, indent=2) + '\n  </script>')

idx = raiz / 'index.html'
s = idx.read_text(encoding='utf-8')
s = re.sub(r'<script type="importmap">.*?</script>\s*', '', s, flags=re.S)
s = re.sub(r'href="/?css/app\.css(\?v=[^"]*)?"', f'href="/css/app.css?v={v}"', s)
s = re.sub(r'<script type="module" src="/?js/app\.js(\?v=[^"]*)?"></script>',
           f'{bloco}\n  <script type="module" src="/js/app.js?v={v}"></script>', s)
idx.write_text(s, encoding='utf-8')
print('versão', v, '-', len(arquivos), 'módulos')
