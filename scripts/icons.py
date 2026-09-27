from PIL import Image, ImageDraw
from pathlib import Path
target=Path('public/icons');target.mkdir(parents=True,exist_ok=True)
for size in (16,48,128):
    im=Image.new('RGBA',(256,256),(0,0,0,0));d=ImageDraw.Draw(im)
    d.rounded_rectangle((4,4,252,252),radius=55,fill='#2563eb')
    d.rounded_rectangle((66,40,190,216),radius=14,fill='white')
    d.polygon([(151,40),(190,79),(151,79)],fill='#a5c5ff')
    for y,x2 in [(108,163),(137,163),(166,142)]:d.rounded_rectangle((91,y,x2,y+9),radius=4,fill='#2563eb')
    im.resize((size,size),Image.Resampling.LANCZOS).save(target/f'{size}.png')
