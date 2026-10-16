import sys
from PIL import Image
ref='/Users/macbook/Documents/Website Codes/ILLUSZIONZ MEDIA/My Site Reference/screenshots/'
name,mine,out,sl=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4])
a=Image.open(ref+name+'.png').convert('RGB'); b=Image.open(mine+'/'+name+'.png').convert('RGB')
W=a.width; H=max(a.height,b.height)
scale=0.5 if W>600 else 1.0
n=0
for y in range(0,H,sl):
    ca=a.crop((0,y,W,min(a.height,y+sl))) if y<a.height else Image.new('RGB',(W,10),'white')
    cb=b.crop((0,y,W,min(b.height,y+sl))) if y<b.height else Image.new('RGB',(W,10),'white')
    hh=max(ca.height,cb.height)
    im=Image.new('RGB',(W*2+20,hh),(255,0,255))
    im.paste(ca,(0,0)); im.paste(cb,(W+20,0))
    if scale!=1: im=im.resize((int(im.width*scale),int(im.height*scale)))
    im.save(f'{out}-{n}.png'); n+=1
print(n)
