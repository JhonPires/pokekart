from pathlib import Path
from PIL import Image, ImageDraw
import json, shutil

root = Path(__file__).resolve().parent
sources = json.loads((root / 'generated-sources.json').read_text(encoding='utf-8'))
originals = root / 'gerados'
originals.mkdir(exist_ok=True)
for name, source in sources.items():
    source = Path(source)
    shutil.copyfile(source, originals / (name + '.png'))
    icon = Image.open(source).convert('RGBA')
    assert icon.getchannel('A').getextrema()[0] == 0, f'{name}: missing transparency'
    icon = icon.crop(icon.getchannel('A').getbbox())
    icon.thumbnail((224, 224), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (256, 256))
    canvas.alpha_composite(icon, ((256-icon.width)//2, (256-icon.height)//2))
    canvas.save(root / 'tematicos' / (name+'.png'), optimize=True)

files = [p for p in (root / 'tematicos').glob('*.png') if p.stem != 'catalogo']
files.sort()
preview = Image.new('RGB', (1100, ((len(files)+6)//7)*156), '#0e1c30')
draw = ImageDraw.Draw(preview)
for i, p in enumerate(files):
    icon = Image.open(p)
    icon.thumbnail((120, 120))
    x, y = (i % 7)*156, (i // 7)*156
    preview.paste(icon, (x+18, y+4), icon)
    draw.text((x+12, y+130), p.stem, fill='white')
preview.save(root / 'tematicos' / 'catalogo.png')
print(f'{len(sources)} generated icons saved; catalog contains {len(files)} icons')
