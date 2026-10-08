"""Extract the user-provided transparent icon sheets without redrawing them."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'tematicos'
OUTPUT.mkdir(exist_ok=True)
sheet_a = Path(r'F:\Projetos\Coleção de Ícones Pokémon Coloridos.png')
sheet_b = Path(r'F:\Projetos\bc605b46-b024-4585-bd4f-b4758b20c06e.png')
rows = [
    (50, 334, [0, 265, 506, 714, 940, 1178, 1410, 1678], ['configuracoes', 'alvo', 'medalha', 'mochila', 'moeda', 'estrela', 'controle']),
    (340, 616, [0, 260, 504, 735, 984, 1181, 1418, 1678], ['lobby', 'bolsa-moedas', 'mundo', 'vento', 'fogo', 'agua', 'rota']),
    (628, 937, [0, 252, 482, 740, 948, 1180, 1436, 1678], ['atualizar', 'buscar', 'bandeira', 'limpar', 'salvar', 'escudo', 'pintura']),
]
manifest = []

def save_icon(source, name, box):
    icon = Image.open(source).convert('RGBA').crop(box)
    bounds = icon.getchannel('A').getbbox()
    if not bounds:
        raise ValueError(name)
    icon = icon.crop(bounds)
    icon.thumbnail((224, 224), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (256, 256))
    canvas.alpha_composite(icon, ((256-icon.width)//2, (256-icon.height)//2))
    canvas.save(OUTPUT / f'{name}.png', optimize=True)
    manifest.append({'name': name, 'source': source.name, 'crop': box})

for top, bottom, columns, names in rows:
    for i, name in enumerate(names):
        save_icon(sheet_a, name, (columns[i], top, columns[i+1], bottom))
for row, names in enumerate([['ponto', 'circuito', 'turbo', 'passe', 'alerta'], ['kart', 'porta', 'ferramentas', 'tempo', 'bot']]):
    for col, name in enumerate(names):
        save_icon(sheet_b, name, (round(col*1024/5), row*253, round((col+1)*1024/5), (row+1)*253))
(OUTPUT / 'sources.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

preview = Image.new('RGB', (1100, 5*156), '#0e1c30')
draw = ImageDraw.Draw(preview)
for i, item in enumerate(manifest):
    icon = Image.open(OUTPUT / (item['name']+'.png'))
    icon.thumbnail((120, 120))
    x, y = (i % 7)*156, (i // 7)*156
    preview.paste(icon, (x+18, y+4), icon)
    draw.text((x+12, y+130), item['name'], fill='white')
preview.save(OUTPUT / 'catalogo.png')
print(f'Extracted {len(manifest)} icons into {OUTPUT}')
