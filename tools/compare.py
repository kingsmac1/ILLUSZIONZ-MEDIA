import sys,glob,os
from PIL import Image, ImageChops
ref='/Users/macbook/Documents/Website Codes/ILLUSZIONZ MEDIA/My Site Reference/screenshots'
mine=sys.argv[1]
names=sys.argv[2].split(',') if len(sys.argv)>2 else None
for f in sorted(glob.glob(mine+'/*.png')):
    n=os.path.basename(f)
    if names and not any(n.startswith(x+'-') for x in names): continue
    r=os.path.join(ref,n)
    if not os.path.exists(r): continue
    a=Image.open(r).convert('RGB'); b=Image.open(f).convert('RGB')
    h=min(a.height,b.height); 
    d=ImageChops.difference(a.crop((0,0,a.width,h)),b.crop((0,0,b.width,h))).convert('L')
    px=sum(1 for v in d.getdata() if v>40); tot=a.width*h
    print(f'{n:40s} ref {a.size} mine {b.size}  heightdiff {b.height-a.height:+d}  diff% {100*px/tot:.1f}')
